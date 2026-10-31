/* 3D presentation controller, browser input, audio, and local persistence. */
import './engine.js';
import { DungeonRenderer } from './renderer3d.js';
(() => {
  'use strict';
  const { Game, TYPES, WIDTH, HEIGHT, clamp, distance } = SwayEngine;
  const $ = id => document.getElementById(id);
  const canvas = $('world');
  let view;
  try { view = new DungeonRenderer(canvas, $('world-labels')); }
  catch (error) {
    $('loading-screen').hidden = true;
    $('render-error').hidden = false;
    console.error('WebGL initialization failed:', error);
    return;
  }
  $('loading-screen').hidden = true;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (mode === 'game' && !modalOpen) pause(false, 'The graphics connection was interrupted. Your expedition is saved. Reload to return.'); });
  const mini = $('minimap').getContext('2d');
  const SAVE_KEY = 'sway.expedition.v1', SETTINGS_KEY = 'sway.settings.v1', RECORD_KEY = 'sway.record.v1';
  let game = new Game(71937), saved = null, mode = 'intro', modalOpen = true;
  let settings = { sound: false, detail: matchMedia('(pointer:coarse)').matches ? 'balanced' : 'detailed', reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  let record = { depth: 1, recruited: 0 };
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (saved) Game.restore(saved); } catch { saved = null; }
  view.setDetail(settings.detail);
  view.focus.set(game.player.x, .1, game.player.y);
  const keys = new Set();
  let joystick = { x: 0, y: 0, id: null }, moveTarget = null, aim = null, armed = null, drag = null;
  let lastFrame = 0, accumulator = 0, visualTime = 0, uiTime = 0, saveTime = 0;
  let particles = [], floating = [], ripples = [], toastUntil = 0, announcementUntil = 0;
  let hordeSignature = '', audio = null, master = null, storageWarning = false;
  const coarse = matchMedia('(pointer:coarse)').matches;
  const TAU = Math.PI * 2;

  function persistSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Sound remains usable without storage. */ } }
  function save() {
    if (mode === 'intro') return;
    try {
      if (game.status === 'dead') localStorage.removeItem(SAVE_KEY);
      else { saved = game.serialize(); localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); }
      record.depth = Math.max(record.depth || 1, game.floor); record.recruited = Math.max(record.recruited || 0, game.metrics.recruited);
      localStorage.setItem(RECORD_KEY, JSON.stringify(record));
    } catch {
      if (!storageWarning) { storageWarning = true; toast('Browser storage is unavailable. Keep this tab open to continue your expedition.'); }
    }
  }
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastUntil = visualTime + 3.8; }
  function announce(eyebrow, title, subtitle) {
    $('announcement').replaceChildren();
    for (const [tag, text] of [['small', eyebrow], ['strong', title], ['p', subtitle]]) { const el = document.createElement(tag); el.textContent = text; $('announcement').append(el); }
    $('announcement').classList.add('visible'); announcementUntil = visualTime + 3.8;
  }
  function resetInput() { keys.clear(); joystick.x = joystick.y = 0; joystick.id = null; moveTarget = null; drag = null; $('joystick-knob').style.transform = ''; }
  function setModal(html) {
    resetInput(); modalOpen = true; $('modal').hidden = false; $('modal-content').innerHTML = html;
    requestAnimationFrame(() => $('modal-content').querySelector('button')?.focus({ preventScroll: true }));
  }
  function closeModal() { modalOpen = false; $('modal').hidden = true; resetInput(); canvas.focus({ preventScroll: true }); lastFrame = performance.now(); accumulator = 0; }
  function intro() {
    setModal(`<div class="modal-eyebrow">AN ENDLESS DUNGEON CRAWLER</div><h1 id="modal-title" class="game-title">SWAY</h1><div class="game-subtitle">THE BURIED KINGDOM</div><p class="lead">Beneath the dunes, an ancient kingdom stirs.<br>Weaken its creatures. Survive their resistance.<br><strong>Make their power your procession.</strong></p><div class="intro-steps"><div><b>01</b> Weaken</div><div><b>02</b> Hypnotize</div><div><b>03</b> Descend</div></div><div class="modal-actions">${saved ? '<button class="gold-button" id="resume-expedition">Continue descent <span>↗</span></button><button class="secondary-button" id="new-expedition">New expedition</button>' : '<button class="gold-button" id="new-expedition">Begin your descent <span>↗</span></button>'}</div><p class="modal-note">${coarse ? 'TWO THUMBS. A THOUSAND POSSIBILITIES.' : 'WASD TO MOVE · E TO SWAY · SPACE TO DODGE'}${record.depth > 1 ? ` &nbsp; / &nbsp; DEEPEST DESCENT ${record.depth}` : ''}</p>`);
    $('new-expedition').onclick = () => start(false);
    if (saved) $('resume-expedition').onclick = () => start(true);
  }
  function start(resume) {
    try { game = resume && saved ? Game.restore(saved) : new Game(Date.now() >>> 0); } catch { game = new Game(); toast('The saved expedition could not be restored. A new path awaits.'); }
    mode = 'game'; document.body.classList.remove('in-menu'); hordeSignature = null; view.focus.set(game.player.x, .1, game.player.y);
    closeModal(); initAudio();
    if (game.status === 'upgrade') showUpgrades();
    else { announce(`DEPTH ${String(game.floor).padStart(2, '0')}`, game.region.name, game.region.subtitle); if (!resume) toast('Move toward a creature. Weaken it, then press E or tap Sway.'); }
    save(); updateUI();
  }
  function pause(showGuide = false, reason = '') {
    if (mode === 'intro') { if (showGuide) guide(); return; }
    if (game.status === 'dead' || game.status === 'upgrade') return;
    save(); armed = null; $('placement-hint').hidden = true;
    if (showGuide) { guide(); return; }
    setModal(`<div class="modal-eyebrow">A MOMENT IN THE SAND</div><h2 id="modal-title">The kingdom can wait.</h2><p class="lead">${reason || 'Your expedition is saved on this browser. Your procession will be here when you return.'}</p><div class="stat-row"><div><b>${game.floor}</b><span>DEPTH</span></div><div><b>${game.allies.length}</b><span>FOLLOWERS</span></div><div><b>${game.player.shards}</b><span>SUN SHARDS</span></div></div><div class="pause-settings"><label><input type="checkbox" id="auto-toggle" ${game.autoAttack ? 'checked' : ''}> Auto-strike</label><label><input type="checkbox" id="effects-toggle" ${settings.reduced ? 'checked' : ''}> Reduced effects</label><label>Graphics <select id="detail-select"><option value="detailed" ${settings.detail === 'detailed' ? 'selected' : ''}>Detailed</option><option value="balanced" ${settings.detail === 'balanced' ? 'selected' : ''}>Balanced</option></select></label></div><div class="modal-actions"><button id="return-game" class="gold-button">Continue the descent <span>↗</span></button><button id="open-guide" class="secondary-button">Field guide</button></div><p class="modal-note">EXPEDITION SAVED LOCALLY · ESC TO RESUME</p>`);
    $('return-game').onclick = closeModal; $('open-guide').onclick = guide;
    $('auto-toggle').onchange = e => { game.autoAttack = e.target.checked; save(); updateUI(); };
    $('detail-select').onchange = e => { settings.detail = e.target.value; view.setDetail(settings.detail); persistSettings(); };
    $('effects-toggle').onchange = e => { settings.reduced = e.target.checked; persistSettings(); };
  }
  function guide() {
    setModal(`<div class="modal-eyebrow">NOTES FROM THE BURIED WORLD</div><h2 id="modal-title">The wanderer's field guide</h2><div class="guide-grid"><div><b>Weaken, then sway</b><p>Below 32% health, a creature bears a diamond. Select it, then tap Sway or press E. Stay close and keep the tether clear while it continues attacking.</p></div><div><b>Keep moving</b><p>WASD / arrows, click the floor, or use the touch stick. Scroll to zoom; Q / C turn the camera. Space dodges. Sway is a toggle: your thumb stays free to dodge. J strikes and cancels Sway.</p></div><div><b>Shape your procession</b><p>R rallies everyone. 1 forms a shield line; 2 creates a statue wall for seven seconds. Choose a command, then drag a segment across the floor. 3 rushes; 4 spreads out.</p></div><div><b>Descend together</b><p>Resolve every creature to open the gate. F interacts. Anchor a follower on the diamond seal in the second chamber to activate its healing sanctuary. Followers persist without a recruitment cap.</p></div><div><b>A fragile connection</b><p>Dodging pauses progress. Hits remove a little. Broken range or blocked sight slowly erodes it. Your followers stop targeting a creature during Sway, but shots already in flight can still kill it.</p></div><div><b>Leave, and return</b><p>Escape pauses and saves. The browser pauses when hidden. Defeat ends this expedition; your deepest descent remains recorded. Headphones and landscape are recommended.</p></div></div><button class="gold-button" id="guide-close">${mode === 'intro' ? 'Back to the ruins' : 'Return to the descent'} <span>↗</span></button>`);
    $('guide-close').onclick = () => mode === 'intro' ? intro() : closeModal();
  }
  function showUpgrades() {
    save();
    setModal(`<div class="modal-eyebrow">THE GATE OPENS · DEPTH ${game.floor} COMPLETE</div><h2 id="modal-title">Take something with you.</h2><p class="lead">Your ${game.allies.length} ${game.allies.length === 1 ? 'follower crosses' : 'followers cross'} with you. Choose a gift from the ruins.</p><div class="upgrade-grid"><button class="upgrade-card" data-upgrade="vitality"><span>♡</span><div><b>Heart of the oasis</b><small>+15 maximum vitality · restore 40 health</small></div></button><button class="upgrade-card" data-upgrade="tether"><span>◉</span><div><b>Voice beyond the veil</b><small>Longer tether · faster Sway</small></div></button><button class="upgrade-card" data-upgrade="power"><span>♜</span><div><b>Will of the ancients</b><small>Stronger strikes · statues last one second longer</small></div></button></div><p class="modal-note">THE NEXT CHAMBER IS WAITING · PROGRESS SAVED</p>`);
    document.querySelectorAll('[data-upgrade]').forEach(button => button.onclick = () => {
      if (!game.descend(button.dataset.upgrade)) return;
      view.focus.set(game.player.x, .1, game.player.y); closeModal(); save(); processEvents(); updateUI();
    });
  }
  function showDeath() {
    save(); saved = null;
    setModal(`<div class="modal-eyebrow">THE SAND CLAIMS ANOTHER STORY</div><h2 id="modal-title">A whisper remains.</h2><p class="lead">Your expedition ends here. Somewhere above, another wanderer hears the buried kingdom calling.</p><div class="stat-row"><div><b>${game.floor}</b><span>DEPTH REACHED</span></div><div><b>${game.metrics.recruited}</b><span>CREATURES SWAYED</span></div><div><b>${game.metrics.highestHorde}</b><span>LARGEST HORDE</span></div></div><button class="gold-button" id="try-again">Begin another descent <span>↗</span></button><p class="modal-note">DEEPEST EXPEDITION ${record.depth} · NO TWO PATHS QUITE THE SAME</p>`);
    $('try-again').onclick = () => start(false);
  }

  function initAudio() {
    if (!settings.sound) return;
    try { if (!audio) { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = .13; master.connect(audio.destination); } if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch { settings.sound = false; }
  }
  function tone(freq, duration = .13, waveform = 'sine', volume = .3, delay = 0) {
    if (!settings.sound || !audio || !master) return;
    const oscillator = audio.createOscillator(), envelope = audio.createGain(), t = audio.currentTime + delay;
    oscillator.type = waveform; oscillator.frequency.setValueAtTime(freq, t); oscillator.frequency.exponentialRampToValueAtTime(freq * .7, t + duration);
    envelope.gain.setValueAtTime(.001, t); envelope.gain.exponentialRampToValueAtTime(volume, t + .015); envelope.gain.exponentialRampToValueAtTime(.001, t + duration);
    oscillator.connect(envelope); envelope.connect(master); oscillator.start(t); oscillator.stop(t + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function burst(x, y, color, count = 10) {
    if (settings.reduced) count = Math.min(count, 4);
    for (let i = 0; i < count; i++) particles.push({ x, y, z: 10, vx: Math.cos(i * 2.399) * (1 + i % 3), vy: Math.sin(i * 2.399) * (1 + i % 3), vz: 20 + i % 5 * 8, color, life: .6 + i % 4 * .1, max: 1 });
    if (particles.length > 350) particles.splice(0, particles.length - 350);
  }
  function processEvents() {
    for (const event of game.events.splice(0)) {
      switch (event.kind) {
        case 'notice': toast(event.text); break;
        case 'ready': burst(event.x, event.y, '#a7e0cc', 6); if (!game.sway) toast(`${event.name} is weakened. Press E or tap Sway.`); tone(460, .16, 'sine', .2); break;
        case 'damage': floating.push({ x: event.x, y: event.y, text: String(Math.ceil(event.amount)), color: event.ally ? '#e7a48e' : '#e8d3aa', life: .7 }); break;
        case 'playerHit': if (!settings.reduced) view.impact = .085; tone(100, .18, 'triangle', .4); break;
        case 'strike': tone(440, .06, 'triangle', .08); break;
        case 'dodge': ripples.push({ x: event.x, y: event.y, color: '#dac192', life: .35, max: .35, radius: .6 }); tone(230, .1, 'sine', .12); break;
        case 'channel': tone(330, .3, 'sine', .2); break;
        case 'recruit': burst(event.x, event.y, '#8de3d1', 28); ripples.push({ x: event.x, y: event.y, color: '#8de3d1', life: .9, max: .9, radius: 1.4 }); toast(`${TYPES[event.type].name} joins your procession.`); [330, 440, 660].forEach((f, i) => tone(f, .5, 'sine', .3, i * .09)); save(); break;
        case 'dissolve': burst(event.x, event.y, event.color, 14); break;
        case 'command': ripples.push({ x: event.x, y: event.y, color: '#e5c38c', life: .7, max: .7, radius: 2 }); tone(185, .2, 'triangle', .2); break;
        case 'lightning': burst(event.x, event.y, '#b5d4ef', 15); ripples.push({ x: event.x, y: event.y, color: '#b5d4ef', life: .4, max: .4, radius: 1 }); tone(65, .16, 'sawtooth', .15); break;
        case 'impact': burst(event.x, event.y, '#d3ad7f', 6); break;
        case 'flame': tone(90, .2, 'triangle', .2); break;
        case 'shard': tone(820, .1, 'sine', .12); break;
        case 'roomClear': if (event.all) { announce('THE WAY IS OPEN', 'The next depth calls.', 'Find the luminous gate in the eastern chamber'); } else toast('Chamber quieted. The ruins restore 8 vitality.'); save(); break;
        case 'sanctuary': burst(game.player.x, game.player.y, '#a0e8cf', 25); tone(520, .7, 'sine', .3); save(); break;
        case 'renew': ripples.push({ x: event.x, y: event.y, color: '#e9be78', life: .7, max: .7, radius: 2 }); break;
        case 'upgrade': showUpgrades(); break;
        case 'floor': announce(`DEPTH ${String(game.floor).padStart(2, '0')}`, game.region.name, game.region.subtitle); break;
        case 'death': showDeath(); break;
      }
    }
  }

  function unproject(x, y) { return view.screenToWorld(x, y); }
  function resize() {
    view.resize();
  }
  new ResizeObserver(resize).observe(canvas);
  function drawScene(dt) {
    view.render(game, { dt, time: visualTime, intro: mode === 'intro', modal: modalOpen,
      aim, armed, drag, particles, floating, ripples, reduced: settings.reduced });
  }
  function drawMinimap() {
    mini.clearRect(0, 0, 224, 102);
    const sx = 4.8, sy = 4.8, ox = 7, oy = 6;
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (game.map.tiles[y * WIDTH + x]) {
      mini.fillStyle = game.map.blocked.has(y * WIDTH + x) ? '#9b98764a' : '#bec3a51b'; mini.fillRect(ox + x * sx, oy + y * sy, sx - .5, sy - .5);
    }
    for (const room of game.map.rooms) { mini.strokeStyle = game.clearRooms[room.index] ? '#92c8ad50' : '#e6bc7a30'; mini.strokeRect(ox + room.x * sx, oy + room.y * sy, room.w * sx, room.h * sy); }
    for (const e of game.enemies) { mini.fillStyle = '#dc9874'; mini.fillRect(ox + e.x * sx - 1, oy + e.y * sy - 1, 2, 2); }
    for (const e of game.allies) { mini.fillStyle = '#8bd0bb66'; mini.fillRect(ox + e.x * sx - .7, oy + e.y * sy - .7, 1.5, 1.5); }
    mini.fillStyle = '#fff1cb'; mini.beginPath(); mini.arc(ox + game.player.x * sx, oy + game.player.y * sy, 2.5, 0, TAU); mini.fill();
    mini.strokeStyle = game.clearRooms.every(Boolean) ? '#b6ebc8' : '#a59572'; mini.strokeRect(ox + game.map.exit.x * sx - 3, oy + game.map.exit.y * sy - 3, 6, 6);
  }
  function updateUI() {
    const p = game.player, allies = game.allies, target = game.selected;
    $('health-label').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; $('health-fill').style.height = `${p.hp / p.maxHp * 100}%`;
    $('shards').textContent = p.shards; $('auto-status').textContent = game.autoAttack ? 'Auto-strike on' : 'Manual strike';
    $('depth').textContent = String(game.floor).padStart(2, '0'); $('room-count').textContent = `${game.clearRooms.filter(Boolean).length} / 3 chambers`;
    $('region-label').textContent = `STRATUM ${Math.floor((game.floor - 1) / 3) + 1} · DEPTH ${String(game.floor).padStart(2, '0')}`;
    $('floor-label').textContent = game.region.name; $('horde-count').textContent = allies.length;
    const grouped = Object.keys(TYPES).map(type => { const group = allies.filter(e => e.type === type); return { type, count: group.length, health: group.length ? group.reduce((n, e) => n + e.hp / e.maxHp, 0) / group.length : 0 }; }).filter(g => g.count);
    const signature = grouped.map(g => `${g.type}:${g.count}:${Math.round(g.health * 20)}`).join('|');
    if (signature !== hordeSignature) {
      hordeSignature = signature;
      $('horde-list').innerHTML = grouped.length ? grouped.map(g => `<div class="horde-species" style="--species:${TYPES[g.type].color}"><span class="creature-icon">${TYPES[g.type].glyph}</span><span class="species-copy"><b>${TYPES[g.type].name}</b><small><i style="width:${Math.round(g.health * 100)}%"></i></small></span><strong>${g.count}</strong></div>`).join('') : '<p class="empty-horde">You arrived alone.<br>You need not descend alone.</p>';
    }
    $('target-card').hidden = !target || target.team !== 'hostile';
    if (target && target.team === 'hostile') {
      $('target-name').textContent = `${target.elite ? 'Ancient ' : ''}${TYPES[target.type].name}`; $('target-health').textContent = `${Math.ceil(target.hp)} / ${Math.ceil(target.maxHp)}`;
      $('target-health-fill').style.width = `${target.hp / target.maxHp * 100}%`; $('target-kind').textContent = game.eligible(target) ? '◇ WEAKENED · SWAYABLE' : 'HOSTILE CREATURE';
      $('target-hint').textContent = game.sway ? game.sway.state === 'broken' ? 'Connection fading — move closer / clear your sight' : game.sway.state === 'dodging' ? 'Dodging — the connection holds' : `Hold the connection · ${Math.max(0, game.sway.duration - game.sway.progress).toFixed(1)}s` : game.eligible(target) ? 'E / Sway to hypnotize · it will keep attacking' : 'Weaken below 32% health to begin Sway';
      $('sway-track').hidden = !game.sway; $('sway-fill').style.width = game.sway ? `${game.sway.progress / game.sway.duration * 100}%` : '0%';
    }
    $('sway-button').classList.toggle('ready', !game.sway && game.enemies.some(e => game.eligible(e) && distance(p, e) < game.stats.tether));
    $('sway-button').classList.toggle('channeling', !!game.sway);
    $('bond-status').textContent = game.sway ? 'The connection holds' : $('sway-button').classList.contains('ready') ? 'A mind is open' : 'Weaken. Connect. Sway.';
    $('sway-orb-fill').style.height = game.sway ? `${game.sway.progress / game.sway.duration * 100}%` : '100%';
    $('bond-orb').classList.toggle('casting', !!game.sway);
    $('dodge-cooldown').style.height = `${p.dodgeCd / 1.5 * 100}%`;
    const interaction = game.interaction(); $('interact-button').hidden = !interaction || modalOpen;
    $('interact-button').innerHTML = `${interaction === 'descend' ? 'Descend to the next depth' : interaction === 'shrine' ? 'Receive the sanctuary’s gift' : 'Sanctuary · seal dormant'} <kbd>F</kbd>`;
    $('objective').textContent = game.clearRooms.every(Boolean) ? 'The eastern gate is open' : `${game.enemies.length} creatures remain`;
    const commandNames = { follow: 'Following your lead', rally: 'Gathering your procession', line: 'Holding a shield line', anchor: 'A wall of living stone', rush: 'Rushing the enemy', spread: 'Giving the storm room' };
    $('formation-status').textContent = armed ? `Place your ${armed === 'anchor' ? 'statue wall' : armed}` : commandNames[game.command] || commandNames.follow;
    document.querySelectorAll('[data-command]').forEach(b => b.classList.toggle('active', b.dataset.command === (armed || game.command)));
    $('sound-button').setAttribute('aria-pressed', String(settings.sound)); $('sound-button').setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Enable sound');
    drawMinimap();
  }

  function movement() {
    let sx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joystick.x;
    let sy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + joystick.y;
    if (Math.hypot(sx, sy) > .1) { moveTarget = null; return view.screenDirection(sx, sy); }
    if (moveTarget) { const d = distance(game.player, moveTarget); if (d < (moveTarget.stopDistance || .2)) moveTarget = null; else return { x: (moveTarget.x - game.player.x) / d, y: (moveTarget.y - game.player.y) / d, goal: moveTarget }; }
    return { x: 0, y: 0 };
  }
  function doDodge() { if (modalOpen) return; const input = movement(); game.dodge(input.x || input.y ? input.x : game.player.facingX, input.x || input.y ? input.y : game.player.facingY); }
  function command(name) {
    if (modalOpen) return;
    if (!game.allies.length) { toast('Weaken and sway a creature to begin your procession.'); return; }
    if (name === 'rally' || name === 'spread') { armed = null; game.commandHorde(name); }
    else { armed = armed === name ? null : name; if (armed) toast(name === 'rush' ? 'Choose a point in the dungeon to rush.' : 'Drag a short line across the floor. Nearby followers will take position.'); }
    $('placement-hint').hidden = !armed; $('placement-hint').firstChild.textContent = armed === 'rush' ? 'Choose a point to rush ' : 'Drag across the floor to place a formation ';
    drag = null; updateUI();
  }
  function interact() { if (!modalOpen) { game.interact(); processEvents(); updateUI(); } }
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'tab' && modalOpen) {
      const focusable = [...$('modal-content').querySelectorAll('button:not(:disabled), input')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (key === 'escape') {
      event.preventDefault(); if (armed) { armed = null; drag = null; $('placement-hint').hidden = true; }
      else if (modalOpen && mode !== 'intro' && game.status === 'playing') closeModal(); else if (!modalOpen) pause(); return;
    }
    if (modalOpen || event.target instanceof HTMLInputElement) return;
    keys.add(key); if (event.repeat) return;
    if (key === 'e') game.beginSway(); else if (key === ' ') doDodge(); else if (key === 'j') game.strike(true);
    else if (key === 'f') interact(); else if (key === 'r') command('rally'); else if (['1', '2', '3', '4'].includes(key)) command(['line', 'anchor', 'rush', 'spread'][Number(key) - 1]);
    else if (key === 'q') view.rotate(-.15); else if (key === 'c') view.rotate(.15);
    else if (key === '=' || key === '+') view.zoomBy(-1); else if (key === '-') view.zoomBy(1);
    else if (key === '?') pause(true);
    processEvents(); updateUI();
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  canvas.addEventListener('pointerdown', event => {
    if (modalOpen || event.button > 2) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    const point = pointerPosition(event); aim = unproject(point.x, point.y); if (!aim) return;
    if (armed) { drag = { start: aim, screen: point, id: event.pointerId }; return; }
    const picked = view.pickEnemy(point.x, point.y, game);
    if (picked) {
      if (game.sway && game.sway.targetId !== picked.id) game.sway = null;
      game.selectedId = picked.id;
      moveTarget = !game.sway && distance(game.player, picked) > 3.3 ? { x: picked.x, y: picked.y, stopDistance: 3 } : null;
      if (event.button === 2) { game.beginSway(); processEvents(); }
    }
    else if (game.isWalkable(aim.x, aim.y)) { moveTarget = aim; ripples.push({ ...aim, color: '#e3c18b', life: .5, max: .5, radius: .5 }); }
    updateUI();
  });
  canvas.addEventListener('pointermove', event => { if (modalOpen) return; const p = pointerPosition(event); aim = unproject(p.x, p.y); });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId || !armed) return;
    const p = pointerPosition(event), end = unproject(p.x, p.y), start = drag.start; if (!end) { drag = null; return; }
    if (armed === 'rush') game.commandHorde('rush', end);
    else {
      let a = start, b = end;
      if (Math.hypot(p.x - drag.screen.x, p.y - drag.screen.y) < 10) {
        const f = game.player; a = { x: end.x - f.facingY * 1.2, y: end.y + f.facingX * 1.2 }; b = { x: end.x + f.facingY * 1.2, y: end.y - f.facingX * 1.2 };
      }
      if (distance(game.player, a) > 8 || distance(game.player, b) > 8) toast('Place formations within reach of your procession.');
      else game.commandHorde(armed, a, b);
    }
    armed = null; drag = null; $('placement-hint').hidden = true; processEvents(); updateUI();
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', event => { event.preventDefault(); view.zoomBy(Math.sign(event.deltaY) * .75); }, { passive: false });
  $('camera-left').onclick = () => view.rotate(-.15);
  $('camera-right').onclick = () => view.rotate(.15);
  $('camera-in').onclick = () => view.zoomBy(-1);
  $('camera-out').onclick = () => view.zoomBy(1);
  $('camera-home').onclick = () => view.resetCamera();
  const stick = $('joystick');
  function moveStick(event) {
    const rect = stick.getBoundingClientRect(), dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy), max = rect.width * .34, factor = length > max ? max / length : 1;
    joystick.x = dx * factor / max; joystick.y = dy * factor / max;
    $('joystick-knob').style.transform = `translate(${dx * factor}px,${dy * factor}px)`;
  }
  stick.addEventListener('pointerdown', e => { if (modalOpen) return; e.preventDefault(); joystick.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', e => { if (joystick.id === e.pointerId) moveStick(e); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(name, e => { if (joystick.id === e.pointerId) { joystick = { x: 0, y: 0, id: null }; $('joystick-knob').style.transform = ''; } });
  $('sway-button').onclick = () => { if (!modalOpen) { game.beginSway(); processEvents(); updateUI(); } };
  $('strike-button').onclick = () => { if (!modalOpen) { game.strike(true); processEvents(); } };
  $('dodge-button').onclick = doDodge;
  document.querySelectorAll('[data-command]').forEach(button => button.onclick = () => command(button.dataset.command));
  $('pause-button').onclick = () => { if (mode === 'intro') return; if (modalOpen && game.status === 'playing') closeModal(); else if (!modalOpen) pause(); };
  $('help-button').onclick = () => pause(true);
  $('interact-button').onclick = interact;
  $('sound-button').onclick = () => { settings.sound = !settings.sound; initAudio(); persistSettings(); updateUI(); if (settings.sound) tone(440, .3); };
  $('fullscreen-button').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('This browser already uses the available screen. Add to your home screen for a full-screen view.'); }
    catch { toast('Full screen is unavailable in this browser window.'); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game' && !modalOpen) pause(false, 'The expedition paused while you were away. Your creatures are safe.'); lastFrame = performance.now(); accumulator = 0; });
  window.addEventListener('blur', () => { resetInput(); if (mode === 'game' && !modalOpen) pause(); });
  window.addEventListener('pagehide', save);

  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - (lastFrame || now)) / 1000)); lastFrame = now; visualTime += dt;
    if (!modalOpen && game.status === 'playing') {
      accumulator += dt;
      while (accumulator >= 1 / 60) { game.update(1 / 60, movement()); accumulator -= 1 / 60; if (game.status !== 'playing') break; }
      processEvents(); saveTime += dt; if (saveTime > 4) { saveTime = 0; save(); }
    }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 50 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    for (const f of floating) f.life -= dt; floating = floating.filter(f => f.life > 0);
    for (const r of ripples) r.life -= dt; ripples = ripples.filter(r => r.life > 0);
    if (visualTime > toastUntil) $('toast').classList.remove('visible');
    if (visualTime > announcementUntil) $('announcement').classList.remove('visible');
    drawScene(dt); uiTime += dt; if (uiTime > .1) { uiTime = 0; updateUI(); }
    requestAnimationFrame(frame);
  }
  resize(); intro(); updateUI(); requestAnimationFrame(frame);
})();
