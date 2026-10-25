/* Canvas presentation, browser input, audio, and local expedition persistence. */
(() => {
  'use strict';
  const { Game, TYPES, WIDTH, HEIGHT, clamp, distance } = SwayEngine;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d', { alpha: false });
  const mini = $('minimap').getContext('2d');
  const SAVE_KEY = 'sway.expedition.v1', SETTINGS_KEY = 'sway.settings.v1', RECORD_KEY = 'sway.record.v1';
  let game = new Game(71937), saved = null, mode = 'intro', modalOpen = true;
  let settings = { sound: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  let record = { depth: 1, recruited: 0 };
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (saved) Game.restore(saved); } catch { saved = null; }
  let width = 1000, height = 700, scale = 1, dpr = 1;
  const camera = { x: game.player.x, y: game.player.y };
  const keys = new Set();
  let joystick = { x: 0, y: 0, id: null }, moveTarget = null, aim = null, armed = null, drag = null;
  let lastFrame = 0, accumulator = 0, visualTime = 0, uiTime = 0, saveTime = 0;
  let particles = [], floating = [], ripples = [], toastUntil = 0, announcementUntil = 0, shake = 0;
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
    setModal(`<div class="modal-eyebrow">AN ENDLESS DESCENT</div><h1 id="modal-title">Every enemy.<br><em>A possibility.</em></h1><p class="lead">Beneath the dunes, an ancient kingdom stirs.<br>Weaken its creatures. Survive their resistance.<br><strong>Make their power your procession.</strong></p><div class="intro-steps"><div><b>01</b> Weaken</div><div><b>02</b> Hypnotize</div><div><b>03</b> Descend</div></div><div class="modal-actions">${saved ? '<button class="gold-button" id="resume-expedition">Continue descent <span>↗</span></button><button class="secondary-button" id="new-expedition">New expedition</button>' : '<button class="gold-button" id="new-expedition">Enter the ruins <span>↗</span></button>'}</div><p class="modal-note">${coarse ? 'TWO THUMBS. A THOUSAND POSSIBILITIES.' : 'WASD TO MOVE · E TO SWAY · SPACE TO DODGE'}${record.depth > 1 ? ` &nbsp; / &nbsp; DEEPEST DESCENT ${record.depth}` : ''}</p>`);
    $('new-expedition').onclick = () => start(false);
    if (saved) $('resume-expedition').onclick = () => start(true);
  }
  function start(resume) {
    try { game = resume && saved ? Game.restore(saved) : new Game(Date.now() >>> 0); } catch { game = new Game(); toast('The saved expedition could not be restored. A new path awaits.'); }
    mode = 'game'; hordeSignature = null; camera.x = game.player.x; camera.y = game.player.y;
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
    setModal(`<div class="modal-eyebrow">A MOMENT IN THE SAND</div><h2 id="modal-title">The kingdom can wait.</h2><p class="lead">${reason || 'Your expedition is saved on this browser. Your procession will be here when you return.'}</p><div class="stat-row"><div><b>${game.floor}</b><span>DEPTH</span></div><div><b>${game.allies.length}</b><span>FOLLOWERS</span></div><div><b>${game.player.shards}</b><span>SUN SHARDS</span></div></div><div class="pause-settings"><label><input type="checkbox" id="auto-toggle" ${game.autoAttack ? 'checked' : ''}> Auto-strike</label><label><input type="checkbox" id="effects-toggle" ${settings.reduced ? 'checked' : ''}> Reduced effects</label></div><div class="modal-actions"><button id="return-game" class="gold-button">Continue the descent <span>↗</span></button><button id="open-guide" class="secondary-button">Field guide</button></div><p class="modal-note">EXPEDITION SAVED LOCALLY · ESC TO RESUME</p>`);
    $('return-game').onclick = closeModal; $('open-guide').onclick = guide;
    $('auto-toggle').onchange = e => { game.autoAttack = e.target.checked; save(); updateUI(); };
    $('effects-toggle').onchange = e => { settings.reduced = e.target.checked; persistSettings(); };
  }
  function guide() {
    setModal(`<div class="modal-eyebrow">NOTES FROM THE BURIED WORLD</div><h2 id="modal-title">The wanderer's field guide</h2><div class="guide-grid"><div><b>Weaken, then sway</b><p>Below 32% health, a creature bears a diamond. Select it, then tap Sway or press E. Stay close and keep the tether clear while it continues attacking.</p></div><div><b>Keep moving</b><p>WASD / arrows, click the floor, or use the touch stick. Space dodges. Sway is a toggle: your thumb stays free to dodge. J strikes and cancels Sway.</p></div><div><b>Shape your procession</b><p>R rallies everyone. 1 forms a shield line; 2 creates a statue wall for seven seconds. Choose a command, then drag a segment across the floor. 3 rushes; 4 spreads out.</p></div><div><b>Descend together</b><p>Resolve every creature to open the gate. F interacts. Anchor a follower on the diamond seal in the second chamber to activate its healing sanctuary. Followers persist without a recruitment cap.</p></div><div><b>A fragile connection</b><p>Dodging pauses progress. Hits remove a little. Broken range or blocked sight slowly erodes it. Your followers stop targeting a creature during Sway, but shots already in flight can still kill it.</p></div><div><b>Leave, and return</b><p>Escape pauses and saves. The browser pauses when hidden. Defeat ends this expedition; your deepest descent remains recorded. Headphones and landscape are recommended.</p></div></div><button class="gold-button" id="guide-close">${mode === 'intro' ? 'Back to the ruins' : 'Return to the descent'} <span>↗</span></button>`);
    $('guide-close').onclick = () => mode === 'intro' ? intro() : closeModal();
  }
  function showUpgrades() {
    save();
    setModal(`<div class="modal-eyebrow">THE GATE OPENS · DEPTH ${game.floor} COMPLETE</div><h2 id="modal-title">Take something with you.</h2><p class="lead">Your ${game.allies.length} ${game.allies.length === 1 ? 'follower crosses' : 'followers cross'} with you. Choose a gift from the ruins.</p><div class="upgrade-grid"><button class="upgrade-card" data-upgrade="vitality"><span>♡</span><div><b>Heart of the oasis</b><small>+15 maximum vitality · restore 40 health</small></div></button><button class="upgrade-card" data-upgrade="tether"><span>◉</span><div><b>Voice beyond the veil</b><small>Longer tether · faster Sway</small></div></button><button class="upgrade-card" data-upgrade="power"><span>♜</span><div><b>Will of the ancients</b><small>Stronger strikes · statues last one second longer</small></div></button></div><p class="modal-note">THE NEXT CHAMBER IS WAITING · PROGRESS SAVED</p>`);
    document.querySelectorAll('[data-upgrade]').forEach(button => button.onclick = () => {
      if (!game.descend(button.dataset.upgrade)) return;
      camera.x = game.player.x; camera.y = game.player.y; closeModal(); save(); processEvents(); updateUI();
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
        case 'playerHit': if (!settings.reduced) shake = 4; tone(100, .18, 'triangle', .4); break;
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

  // World coordinates are a flat plane; projection adds the isometric presentation.
  function project(x, y, z = 0) { return { x: width * .53 + ((x - camera.x) - (y - camera.y)) * 33 * scale, y: height * .46 + ((x - camera.x) + (y - camera.y)) * 16.5 * scale - z * scale }; }
  function unproject(sx, sy) { const a = (sx - width * .53) / (33 * scale), b = (sy - height * .46) / (16.5 * scale); return { x: camera.x + (a + b) / 2, y: camera.y + (b - a) / 2 }; }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    scale = width < 650 ? .88 : height < 500 ? .82 : Math.min(1.22, .85 + width / 3300);
  }
  new ResizeObserver(resize).observe(canvas);
  function polygon(points, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function groundPoly(points, fill, stroke = null, lw = 1) { polygon(points.map(p => project(p.x, p.y)), fill, stroke, lw); }
  function ellipse(x, y, rx, ry, fill, stroke = null, lw = 1) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
  function line(points, color, lw = 1) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  function mix(hex, amount) { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp((n >> 16) + amount, 0, 255)},${clamp((n >> 8 & 255) + amount, 0, 255)},${clamp((n & 255) + amount, 0, 255)})`; }
  function groundCircle(x, y, r, fill, stroke = null, lw = 1) { const p = project(x, y); ellipse(p.x, p.y, r * 46 * scale, r * 23 * scale, fill, stroke, lw); }
  function drawFloor() {
    const map = game.map, region = game.region;
    for (let sum = 0; sum < WIDTH + HEIGHT; sum++) for (let x = 0; x < WIDTH; x++) {
      const y = sum - x; if (y < 0 || y >= HEIGHT || !map.tiles[y * WIDTH + x]) continue;
      const p = project(x, y); if (p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) continue;
      const corners = [project(x, y), project(x + 1, y), project(x + 1, y + 1), project(x, y + 1)];
      const noise = ((x * 127 + y * 83 + game.floor * 41) % 19) - 9;
      if (!map.tiles[(y + 1) * WIDTH + x]) polygon([corners[3], corners[2], { x: corners[2].x, y: corners[2].y + 16 * scale }, { x: corners[3].x, y: corners[3].y + 16 * scale }], region.edge, '#141e2430');
      if (!map.tiles[y * WIDTH + x + 1]) polygon([corners[1], corners[2], { x: corners[2].x, y: corners[2].y + 16 * scale }, { x: corners[1].x, y: corners[1].y + 16 * scale }], mix(region.edge, -12), '#141e2430');
      const border = y === 2 || y === 14 || [1, 11, 16, 26, 31, 41].includes(x);
      polygon(corners, mix(region.floor, noise + (border ? -17 : map.tiles[y * WIDTH + x] === 2 ? -12 : 0)), '#4e4a4040', .7 * scale);
      if (border && (x + y) % 2 === 0) { const c = project(x + .5, y + .5); ellipse(c.x, c.y, 2.5 * scale, 1.3 * scale, region.accent + '45'); }
      if ((x * 17 + y * 23) % 11 === 0) { const a = project(x + .2, y + .18), b = project(x + .6, y + .3), c = project(x + .85, y + .75); line([[a.x, a.y], [b.x, b.y], [c.x, c.y]], '#433e3630', .8); }
    }
    // Ancient inlaid geometric medallions.
    for (const room of map.rooms) {
      const center = project(room.cx, room.cy), r = 2.1;
      groundCircle(room.cx, room.cy, r, '#dac18a09', '#e1c69525', 1);
      groundCircle(room.cx, room.cy, r * .82, null, '#e1c69520', 1);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU, b = (i + 3) / 8 * TAU;
        const p = project(room.cx + Math.cos(a) * r * .8, room.cy + Math.sin(a) * r * .8);
        const q = project(room.cx + Math.cos(b) * r * .8, room.cy + Math.sin(b) * r * .8);
        line([[p.x, p.y], [q.x, q.y]], '#e5c88924', .8 * scale);
      }
      ellipse(center.x, center.y, 5 * scale, 2.5 * scale, '#e5c88940');
    }
    for (const d of map.decoration) {
      const p = project(d.x, d.y); if (p.x < -25 || p.x > width + 25 || p.y < -25 || p.y > height + 25) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale * .5); ctx.rotate(d.angle);
      if (d.kind === 0) polygon([{ x: -4, y: -2 }, { x: 4, y: -2 }, { x: 6, y: 2 }, { x: -3, y: 3 }], '#c6a78170', '#4c463b30');
      else if (d.kind === 1) { line([[-5, 0], [4, 1]], '#554e4050', 2); line([[-3, -3], [0, 0]], '#554e4050', 1); }
      else if (d.kind === 2) ellipse(0, 0, 7, 4, '#ccb28e20');
      ctx.restore();
    }
    const plate = map.plate, shrine = map.shrine;
    groundPoly([{ x: plate.x, y: plate.y - .65 }, { x: plate.x + .65, y: plate.y }, { x: plate.x, y: plate.y + .65 }, { x: plate.x - .65, y: plate.y }], game.plateActive ? '#a8d1b56b' : '#243a3a60', game.plateActive ? '#a0ebd5' : '#d8be8780', 1.5);
    const pp = project(plate.x, plate.y); ctx.fillStyle = game.plateActive ? '#a0ebd5' : '#e6c88b'; ctx.font = `${14 * scale}px Georgia`; ctx.textAlign = 'center'; ctx.fillText('◇', pp.x, pp.y + 5 * scale);
    groundCircle(shrine.x, shrine.y, .7, game.claimed ? '#192d2b20' : '#91d8b825', game.plateActive ? '#9de7d4' : '#c3ad7850');
    if (aim && !modalOpen) groundCircle(aim.x, aim.y, .16, null, '#eed09970');
  }
  function drawTelegraphs() {
    for (const e of game.enemies) if (e.windup) {
      const w = e.windup, progress = 1 - w.remaining / w.duration;
      const fill = `rgba(190,66,57,${.10 + progress * .22})`, stroke = `rgba(249,163,113,${.4 + progress * .5})`;
      if (w.kind === 'storm' || w.kind === 'bite') {
        groundCircle(w.x, w.y, w.kind === 'storm' ? 1.05 : .66, fill, stroke, 1.2);
        groundCircle(w.x, w.y, (w.kind === 'storm' ? 1.05 : .66) * progress, null, stroke, 1);
      } else if (w.kind === 'flame') {
        const angle = Math.atan2(w.dy, w.dx), r = TYPES[e.type].range;
        const points = [{ x: e.x, y: e.y }];
        for (let i = 0; i <= 10; i++) { const a = angle - .8 + i / 10 * 1.6; points.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r }); }
        groundPoly(points, fill, stroke);
      } else {
        const r = w.kind === 'charge' ? 3.4 : 4, side = .45;
        groundPoly([{ x: e.x - w.dy * side, y: e.y + w.dx * side }, { x: e.x + w.dx * r - w.dy * side, y: e.y + w.dy * r + w.dx * side }, { x: e.x + w.dx * r + w.dy * side, y: e.y + w.dy * r - w.dx * side }, { x: e.x + w.dy * side, y: e.y - w.dx * side }], fill, stroke);
      }
    }
    for (const zone of game.zones) {
      groundCircle(zone.x, zone.y, zone.radius, '#e4773935', '#f4ac6760');
      const p = project(zone.x, zone.y);
      for (let i = 0; i < 5; i++) { const x = p.x + Math.sin(i * 8) * 17 * scale, y = p.y + Math.cos(i * 8) * 7 * scale; polygon([{ x: x - 3 * scale, y }, { x: x + Math.sin(visualTime * 8 + i) * 4 * scale, y: y - (12 + i * 2) * scale }, { x: x + 4 * scale, y }], i % 2 ? '#ed995a90' : '#ffd68d90'); }
    }
    for (const ripple of ripples) { const t = 1 - ripple.life / ripple.max; ctx.globalAlpha = 1 - t; groundCircle(ripple.x, ripple.y, ripple.radius * t, null, ripple.color, 1.2); ctx.globalAlpha = 1; }
    for (const e of game.allies) if (e.order && (e.mode === 'anchor' || e.mode === 'line')) groundCircle(e.order.x, e.order.y, e.radius + .1, '#ead0970e', '#e7c18b66');
    if (armed && drag) {
      const start = drag.start, end = aim || start, length = Math.min(distance(start, end), 8), actual = distance(start, end) || 1;
      const b = { x: start.x + (end.x - start.x) / actual * length, y: start.y + (end.y - start.y) / actual * length };
      const aScreen = project(start.x, start.y), bScreen = project(b.x, b.y);
      ctx.setLineDash([5, 5]); line([[aScreen.x, aScreen.y], [bScreen.x, bScreen.y]], '#f1cf8b', 3 * scale); ctx.setLineDash([]);
      const count = Math.min(game.allies.length, Math.max(1, Math.ceil(length / .72)));
      for (let i = 0; i < count; i++) { const t = count === 1 ? .5 : i / (count - 1); groundCircle(start.x + (b.x - start.x) * t, start.y + (b.y - start.y) * t, .3, '#efcf8a25', '#efcf8a80'); }
    }
  }
  function drawPillar(pillar) {
    const p = project(pillar.x, pillar.y), size = 19 * scale, h = (pillar.broken ? 30 : 65 * pillar.height / 1.6) * scale;
    if (p.x < -60 || p.x > width + 60 || p.y < -50 || p.y > height + 120) return;
    const playerP = project(game.player.x, game.player.y);
    ctx.save(); if (Math.abs(playerP.x - p.x) < 40 * scale && playerP.y < p.y && playerP.y > p.y - h - 25) ctx.globalAlpha = .35;
    ellipse(p.x + 14 * scale, p.y + 4 * scale, size * 1.4, size * .45, '#17222a30');
    polygon([{ x: p.x - size, y: p.y }, { x: p.x, y: p.y + size * .45 }, { x: p.x, y: p.y - h + size * .45 }, { x: p.x - size, y: p.y - h }], '#77654d', '#4e4b3a80');
    polygon([{ x: p.x, y: p.y + size * .45 }, { x: p.x + size, y: p.y }, { x: p.x + size, y: p.y - h }, { x: p.x, y: p.y - h + size * .45 }], '#9a8261', '#4e4b3a80');
    polygon([{ x: p.x - size, y: p.y - h }, { x: p.x, y: p.y - h - size * .45 }, { x: p.x + size, y: p.y - h }, { x: p.x, y: p.y - h + size * .45 }], '#c2a77a', '#e3c68c40');
    for (let i = 1; i < 4; i++) { const y = p.y - h * i / 4; line([[p.x - size, y], [p.x, y + size * .45], [p.x + size, y]], '#504c3a55', 1); }
    if (!pillar.broken) {
      const top = p.y - h + size * .45;
      line([[p.x + 4 * scale, top + 7 * scale], [p.x + 4 * scale, top + 16 * scale], [p.x + 10 * scale, top + 13 * scale]], '#e1be7e85', 1.5 * scale);
    }
    ctx.restore();
  }
  function drawWall(x, y, axis) {
    const a = project(x, y), b = project(x + (axis === 'x' ? 1 : 0), y + (axis === 'y' ? 1 : 0));
    const h = 26 * scale, ledge = 4 * scale;
    polygon([a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }], axis === 'x' ? '#9d8663' : '#766a53', '#514d3f90');
    polygon([{ x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }, { x: b.x, y: b.y - h - ledge }, { x: a.x, y: a.y - h - ledge }], '#c4aa7e', '#dec18a50');
    line([[a.x, a.y - h * .48], [b.x, b.y - h * .48]], '#4b483a40', 1);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - h * .6;
    line([[mx - 2 * scale, my - 4 * scale], [mx + 2 * scale, my], [mx - 2 * scale, my + 4 * scale]], '#e2c69050', 1);
  }
  function drawBrazier(x, y) {
    const p = project(x, y);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    ellipse(0, 1, 7, 3, '#2c342f55');
    polygon([{ x: -4, y: 0 }, { x: 4, y: 0 }, { x: 2, y: -15 }, { x: -2, y: -15 }], '#5c5b46', '#a08e63');
    polygon([{ x: -8, y: -19 }, { x: 8, y: -19 }, { x: 4, y: -13 }, { x: -4, y: -13 }], '#ba9c66', '#e1c184');
    polygon([{ x: -5, y: -20 }, { x: -7, y: -29 }, { x: -1, y: -25 }, { x: 2 + Math.sin(visualTime * 7) * 2, y: -38 }, { x: 6, y: -28 }, { x: 4, y: -20 }], '#e4a15e');
    polygon([{ x: -2, y: -20 }, { x: 0, y: -30 }, { x: 3, y: -22 }], '#f6d694');
    if (!settings.reduced) { const glow = ctx.createRadialGradient(0, -25, 0, 0, -25, 35); glow.addColorStop(0, '#ffc57b19'); glow.addColorStop(1, '#ffc57b00'); ctx.fillStyle = glow; ctx.fillRect(-35, -60, 70, 70); }
    ctx.restore();
  }
  function drawGate() {
    const gate = game.map.exit, p = project(gate.x, gate.y), open = game.clearRooms.every(Boolean);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    ellipse(0, 0, 43, 19, open ? '#72d7cb20' : '#16272b20', open ? '#a0e6cc80' : '#d4bc8050');
    ctx.fillStyle = '#4b5047'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -58); ctx.quadraticCurveTo(-26, -91, 0, -97); ctx.quadraticCurveTo(26, -91, 26, -58); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c4a77a'; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = '#e5c58d'; ctx.lineWidth = 1; ctx.stroke();
    const gradient = ctx.createLinearGradient(0, -85, 0, 0); gradient.addColorStop(0, open ? '#6ca79d70' : '#0e242e'); gradient.addColorStop(1, open ? '#8fe4cb90' : '#1b3035');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-20, -59); ctx.quadraticCurveTo(-20, -83, 0, -90); ctx.quadraticCurveTo(20, -83, 20, -59); ctx.lineTo(20, 0); ctx.fill();
    if (open) for (let i = 0; i < 9; i++) { const t = (visualTime * .25 + i / 9) % 1; ellipse(Math.sin(i * 39) * 15, -t * 77, 1.2, 2, `rgba(185,244,218,${Math.sin(t * Math.PI)})`); }
    else { line([[-12, -25], [12, -60]], '#bb9d6b70', 2); line([[12, -25], [-12, -60]], '#bb9d6b70', 2); }
    ctx.textAlign = 'center'; ctx.fillStyle = open ? '#d2efd4' : '#cdb88d'; ctx.font = '8px sans-serif'; ctx.fillText(open ? 'D E S C E N D' : 'S E A L E D', 0, 20);
    ctx.restore();
  }
  function drawShrine() {
    const p = project(game.map.shrine.x, game.map.shrine.y);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    polygon([{ x: -14, y: -3 }, { x: 0, y: 4 }, { x: 15, y: -3 }, { x: 0, y: -10 }], '#cdba87', '#e4d19f');
    polygon([{ x: -14, y: -3 }, { x: 0, y: 4 }, { x: 0, y: -11 }, { x: -14, y: -18 }], '#766b51');
    polygon([{ x: 0, y: 4 }, { x: 15, y: -3 }, { x: 15, y: -18 }, { x: 0, y: -11 }], '#a89366');
    polygon([{ x: -15, y: -18 }, { x: 0, y: -11 }, { x: 16, y: -18 }, { x: 0, y: -26 }], '#d3bd87', '#e5ca91');
    if (!game.claimed) { const bob = Math.sin(visualTime * 2) * 3; polygon([{ x: 0, y: -54 + bob }, { x: 8, y: -40 + bob }, { x: 0, y: -31 + bob }, { x: -8, y: -40 + bob }], game.plateActive ? '#a2e5cd' : '#998c6e', '#f1d49c'); }
    ctx.restore();
  }
  function drawCreature(e) {
    const def = TYPES[e.type], p = project(e.x, e.y), ally = e.team === 'ally';
    if (p.x < -80 || p.x > width + 80 || p.y < -40 || p.y > height + 100) return;
    const selected = game.selectedId === e.id, ready = game.eligible(e), anchored = e.mode === 'anchor' && e.order && distance(e, e.order) < .3;
    const s = scale * (e.elite ? 1.3 : 1) * (e.type === 'drake' ? 1.3 : 1);
    ellipse(p.x + 3 * scale, p.y + 3 * scale, def.radius * 39 * s, def.radius * 18 * s, '#13232b40');
    if (ally || selected || ready) groundCircle(e.x, e.y, def.radius + .1, ally ? '#8ce1cb16' : '#a5e2ce10', ally ? '#9ce3cc75' : ready ? '#b4f4dd' : '#eaca91a0', selected ? 1.8 : .9);
    const floatingZ = def.flying && !anchored ? 13 + Math.sin(visualTime * 2.5 + e.id) * 4 : 0;
    ctx.save(); ctx.translate(p.x, p.y - floatingZ * scale); ctx.scale(s * (e.facingX - e.facingY < 0 ? -1 : 1), s);
    if (anchored) ctx.filter = 'grayscale(1) sepia(.3)';
    if (e.flash > 0 && !settings.reduced) ctx.globalAlpha = .55;
    const phase = anchored ? 0 : Math.sin(visualTime * 6 + e.id) * 1.2;
    if (e.type === 'jackal') {
      ctx.strokeStyle = '#675947'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-15, -15); ctx.quadraticCurveTo(-29, -14, -27, -27); ctx.stroke();
      for (const [x, off] of [[-10, 1], [8, -1]]) { line([[x, -10], [x + phase * off, -1]], '#685647', 5); line([[x + 4, -10], [x + 4 - phase * off, -1]], '#ac8f68', 4); }
      ellipse(-1, -16, 17, 10, '#bc9b6d', '#6c5a45', 1.2); ellipse(13, -22, 9, 9, '#c6a875', '#6c5a45');
      polygon([{ x: 8, y: -27 }, { x: 9, y: -41 }, { x: 15, y: -29 }], '#9f825b', '#5c5548'); polygon([{ x: 16, y: -28 }, { x: 21, y: -38 }, { x: 22, y: -24 }], '#be9d6e', '#5c5548');
      polygon([{ x: 18, y: -26 }, { x: 29, y: -20 }, { x: 21, y: -16 }, { x: 16, y: -19 }], '#dac294', '#7e6b4e'); ellipse(27, -21, 2, 2, '#343d39'); ellipse(17, -26, 1.6, 1.6, ally ? '#96eed4' : '#f7d896');
      line([[-10, -19], [-4, -14], [0, -21], [5, -17]], '#ead6a080', 1.2);
    } else if (e.type === 'cinder' || e.type === 'horn') {
      const horn = e.type === 'horn';
      for (const x of [-13, 12]) { polygon([{ x: x - 4, y: -12 }, { x: x + 4, y: -11 }, { x: x + 5 + phase, y: 1 }, { x: x - 4 + phase, y: 1 }], horn ? '#656a6d' : '#5c554a', '#404a45'); }
      ellipse(-3, -20, 23, 16, horn ? '#878d90' : '#7b6c54', '#4b514b', 1.4);
      for (let i = 0; i < 4; i++) polygon([{ x: -22 + i * 9, y: -23 }, { x: -17 + i * 9, y: -36 - Math.sin(i) * 3 }, { x: -9 + i * 9, y: -31 }, { x: -10 + i * 9, y: -20 }], horn ? mix('#9e9f9c', i * -7) : mix('#b59968', i * -10), '#4e554c', 1);
      ellipse(19, -19, 14, 11, horn ? '#9da3a0' : '#8b7758', '#4b514b');
      if (horn) { polygon([{ x: 26, y: -22 }, { x: 34, y: -43 }, { x: 35, y: -19 }], '#dfd3b4', '#7c8176'); polygon([{ x: 10, y: -28 }, { x: 13, y: -41 }, { x: 17, y: -28 }], '#cac7b3', '#7c8176'); }
      else for (let i = 0; i < 4; i++) { const x = -19 + i * 9; polygon([{ x: x - 3, y: -32 }, { x: x + Math.sin(visualTime * 8 + i) * 3, y: -46 - (i % 2) * 6 }, { x: x + 4, y: -33 }], '#e49456'); polygon([{ x: x - 1, y: -33 }, { x: x + 1, y: -42 }, { x: x + 3, y: -33 }], '#f4cf7f'); }
      ellipse(22, -23, 2, 1.5, ally ? '#9fe4cf' : '#f2c580'); line([[27, -15], [33, -15]], '#424b45', 1.4);
    } else if (e.type === 'cloud') {
      for (const [x, y, r, c] of [[-13, -15, 10, '#7d9eae'], [1, -22, 14, '#a1bec8'], [16, -15, 11, '#bbd0cf'], [-1, -12, 18, '#9ebac3']]) ellipse(x, y + phase, r, r * .75, c, '#42667760');
      line([[-8, -5], [-12, 3], [-7, 3], [-10, 11]], '#e3c786', 2); line([[10, -4], [7, 5], [11, 5], [8, 13]], '#b6e6e6', 1.5);
      ellipse(4, -17, 2, 2, '#31565c'); ellipse(13, -16, 2, 2, '#31565c');
    } else if (e.type === 'djinn') {
      ctx.beginPath(); ctx.moveTo(-10, -15); ctx.bezierCurveTo(-27, 5, 17, 13, 0, 21); ctx.bezierCurveTo(30, 5, 8, -4, 14, -18); ctx.closePath(); ctx.fillStyle = '#76a59790'; ctx.fill();
      polygon([{ x: -17, y: -21 }, { x: -8, y: -37 }, { x: 9, y: -37 }, { x: 20, y: -18 }, { x: 0, y: -6 }], '#577e79', '#b1c9ac');
      ellipse(2, -38, 9, 11, '#334e51'); polygon([{ x: -8, y: -39 }, { x: 0, y: -54 }, { x: 12, y: -42 }, { x: 10, y: -34 }], '#a5b9a0', '#dbc99d');
      line([[-1, -36], [4, -36]], '#d9efba', 2); line([[8, -34], [11, -34]], '#d9efba', 2);
      ctx.beginPath(); ctx.ellipse(0, -20, 27, 7, .25, .2, 5.4); ctx.strokeStyle = '#d1caa075'; ctx.lineWidth = 1; ctx.stroke();
    } else if (e.type === 'phoenix') {
      const flap = Math.sin(visualTime * 4 + e.id) * 7;
      polygon([{ x: -3, y: -20 }, { x: -44, y: -42 - flap }, { x: -27, y: -13 }, { x: -13, y: -10 }], '#c1744b', '#e9b66b');
      polygon([{ x: 2, y: -20 }, { x: 36, y: -43 - flap }, { x: 24, y: -12 }, { x: 9, y: -9 }], '#dc9557', '#f4d286');
      for (let i = 0; i < 3; i++) line([[-2, -2], [-15 + i * 11, 24 + Math.sin(visualTime * 3 + i) * 4]], i % 2 ? '#eec77b' : '#ca8050', 3);
      ellipse(1, -17, 8, 16, '#e1a85f', '#8e6544'); ellipse(6, -32, 7, 8, '#f0cc7d'); polygon([{ x: 10, y: -35 }, { x: 19, y: -30 }, { x: 10, y: -28 }], '#fff1b1'); line([[4, -38], [0, -48], [8, -42]], '#f5d286', 2); ellipse(9, -34, 1.5, 1.5, '#5c5443');
    } else if (e.type === 'drake') {
      ctx.beginPath(); ctx.moveTo(-17, -15); ctx.quadraticCurveTo(-43, -8, -35, -27); ctx.strokeStyle = '#748774'; ctx.lineWidth = 7; ctx.stroke();
      polygon([{ x: -8, y: -20 }, { x: -26, y: -53 }, { x: -26, y: -24 }, { x: -35, y: -32 }, { x: -20, y: -9 }], '#667d76', '#b3b68c');
      ellipse(0, -17, 23, 13, '#8a9b7f', '#4d655b');
      for (const x of [-10, 12]) line([[x, -12], [x - 3 + phase, 1], [x + 5, 2]], '#667b6b', 6);
      polygon([{ x: 7, y: -24 }, { x: 16, y: -39 }, { x: 31, y: -30 }, { x: 34, y: -21 }, { x: 16, y: -17 }], '#a3ae8d', '#52695e');
      for (let i = 0; i < 4; i++) polygon([{ x: -17 + i * 7, y: -25 }, { x: -14 + i * 7, y: -35 }, { x: -9 + i * 7, y: -25 }], '#c8c49a');
      ellipse(24, -29, 2, 2, '#f0d293');
    }
    if (anchored) { line([[-10, -22], [-3, -17], [-5, -9], [3, -3]], '#453f3c70', 1.2); }
    ctx.restore();
    if (anchored) {
      const remaining = e.orderTime / game.stats.anchorDuration;
      ctx.strokeStyle = '#e7c68b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, (def.radius + .18) * 46 * scale, (def.radius + .18) * 23 * scale, 0, -Math.PI / 2, -Math.PI / 2 + TAU * remaining); ctx.stroke();
    }
    if (!ally && (e.awake || selected)) {
      const top = p.y - (def.flying ? 57 : 52) * s, barWidth = (e.elite ? 45 : 29) * scale;
      ctx.fillStyle = '#17272b80'; ctx.fillRect(p.x - barWidth / 2, top, barWidth, 3 * scale);
      ctx.fillStyle = ready ? '#b4dfbc' : '#d5a075'; ctx.fillRect(p.x - barWidth / 2, top, barWidth * e.hp / e.maxHp, 3 * scale);
      if (ready) { ctx.fillStyle = '#d6f6d7'; ctx.textAlign = 'center'; ctx.font = `${9 * scale}px sans-serif`; ctx.fillText('◇ SWAY', p.x, top - 7 * scale); }
      if (e.elite) { ctx.fillStyle = '#e9c987'; ctx.font = `${9 * scale}px Georgia`; ctx.textAlign = 'center'; ctx.fillText('✦ GUARDIAN', p.x, top - (ready ? 21 : 7) * scale); }
    } else if (ally && e.hp < e.maxHp * .4) { ctx.fillStyle = '#dca17a'; ctx.fillRect(p.x - 8 * scale, p.y - 45 * s, 16 * scale * e.hp / e.maxHp, 2 * scale); }
  }
  function drawPlayer() {
    const e = game.player, p = project(e.x, e.y);
    groundCircle(e.x, e.y, .35, '#142b3130', '#dfcc9b80');
    ellipse(p.x + 4 * scale, p.y + 3 * scale, 12 * scale, 5 * scale, '#18272b55');
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
    if (e.invulnerable > 0 && !settings.reduced) ctx.globalAlpha = .65 + Math.sin(visualTime * 45) * .25;
    const sway = Math.sin(visualTime * 4) * 1;
    polygon([{ x: -7, y: -28 }, { x: 6, y: -29 }, { x: 12 + sway, y: -3 }, { x: 1, y: 2 }, { x: -12 + sway, y: -3 }], '#d3bc8e', '#635e4d');
    polygon([{ x: -6, y: -28 }, { x: 1, y: -22 }, { x: -3, y: -2 }, { x: -12, y: -3 }], '#a78c68');
    line([[-7, -17], [7, -15]], '#5b736c', 3); line([[1, -25], [5, -3]], '#f0d4a2', 1);
    ellipse(0, -36, 8, 10, '#4b5149', '#c0ac83');
    ctx.beginPath(); ctx.moveTo(-8, -35); ctx.quadraticCurveTo(-13, -47, 0, -49); ctx.quadraticCurveTo(12, -48, 9, -36); ctx.lineTo(5, -41); ctx.lineTo(-7, -38); ctx.fillStyle = '#d9c397'; ctx.fill();
    line([[-7, -42], [6, -44], [11, -39]], '#efdcad', 2); line([[1, -36], [5, -36]], '#eecb86', 1.2);
    line([[9, -22], [17, -19]], '#ae976e', 4); line([[18, -4], [17, -44]], '#655e49', 2.5);
    ellipse(17, -46, 5, 7, '#dfb96c', '#f5dba0'); ellipse(17, -46, 2, 4, '#fbefd0');
    if (!settings.reduced) { const glow = ctx.createRadialGradient(17, -46, 0, 17, -46, 24); glow.addColorStop(0, '#ffda8a22'); glow.addColorStop(1, '#ffda8a00'); ctx.fillStyle = glow; ctx.fillRect(-8, -71, 50, 50); }
    ctx.restore();
  }
  function drawTether() {
    if (!game.sway) return;
    const target = game.entities.find(e => e.id === game.sway.targetId); if (!target) return;
    const a = project(game.player.x, game.player.y, 29), b = project(target.x, target.y, 22);
    const color = game.sway.state === 'broken' ? '#d3a16b' : '#a1efdb';
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5 * scale; ctx.shadowColor = color; ctx.shadowBlur = settings.reduced ? 0 : 9;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + (b.x - a.x) * .3, a.y - 22 * scale, a.x + (b.x - a.x) * .7, b.y - 22 * scale, b.x, b.y); ctx.stroke();
    for (let i = 0; i < 6; i++) { const t = (visualTime * .65 + i / 6) % 1; ellipse(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 17 * scale, 2 * scale, 2 * scale, color); }
    ctx.restore();
  }
  function drawScene(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = game.region.sky; ctx.fillRect(0, 0, width, height);
    const room = game.map.rooms.reduce((a, b) => Math.abs(b.cx - game.player.x) < Math.abs(a.cx - game.player.x) ? b : a);
    const target = { x: game.player.x * .78 + room.cx * .22, y: game.player.y * .78 + room.cy * .22 };
    const ease = 1 - Math.exp(-dt * 5); camera.x += (target.x - camera.x) * ease; camera.y += (target.y - camera.y) * ease;
    ctx.save();
    if (shake > .1) { ctx.translate(Math.sin(visualTime * 89) * shake, Math.cos(visualTime * 63) * shake * .5); shake *= .82; }
    // Contours in the surrounding darkness suggest buried dunes.
    ctx.lineWidth = 1;
    for (let i = 0; i < 13; i++) { ctx.beginPath(); for (let x = -50; x < width + 100; x += 30) { const y = height * .1 + i * 61 + Math.sin(x / 180 + i * .6) * 30; x === -50 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = '#a7b8aa05'; ctx.stroke(); }
    drawFloor(); drawTelegraphs();
    for (const pickup of game.pickups) {
      const p = project(pickup.x, pickup.y, 8 + Math.sin(visualTime * 3 + pickup.x) * 2);
      polygon([{ x: p.x, y: p.y - 5 * scale }, { x: p.x + 3 * scale, y: p.y }, { x: p.x, y: p.y + 5 * scale }, { x: p.x - 3 * scale, y: p.y }], '#f2d184', '#f9e6aa');
    }
    const objects = game.entities.map(e => ({ depth: e.x + e.y, draw: () => drawCreature(e) }));
    objects.push({ depth: game.player.x + game.player.y, draw: drawPlayer });
    for (const room of game.map.rooms) {
      for (let x = room.x; x < room.x + room.w; x++) objects.push({ depth: x + .5 + room.y, draw: () => drawWall(x, room.y, 'x') });
      for (let y = room.y; y < room.y + room.h; y++) if (!game.map.tiles[y * WIDTH + room.x - 1]) objects.push({ depth: room.x + y + .5, draw: () => drawWall(room.x, y, 'y') });
    }
    for (const x of [12.4, 27.4]) for (const y of [7.35, 9.65]) objects.push({ depth: x + y, draw: () => drawBrazier(x, y) });
    for (const p of game.map.pillars) objects.push({ depth: p.x + p.y + .1, draw: () => drawPillar(p) });
    objects.push({ depth: game.map.exit.x + game.map.exit.y, draw: drawGate }, { depth: game.map.shrine.x + game.map.shrine.y, draw: drawShrine });
    objects.sort((a, b) => a.depth - b.depth).forEach(o => o.draw());
    drawTether();
    for (const shot of game.projectiles) {
      const p = project(shot.x, shot.y, 17), color = shot.team === 'hostile' ? '#eaaa85' : shot.team === 'ally' ? '#afe0c8' : '#ffe5a8';
      const prev = project(shot.x - shot.vx * .035, shot.y - shot.vy * .035, 17);
      line([[prev.x, prev.y], [p.x, p.y]], color + '88', 3 * scale); ellipse(p.x, p.y, 2.4 * scale, 2.4 * scale, color);
    }
    for (const particle of particles) { const p = project(particle.x, particle.y, particle.z); ctx.globalAlpha = Math.min(1, particle.life * 1.8); ctx.fillStyle = particle.color; ctx.fillRect(p.x, p.y, 2 * scale, 2 * scale); }
    ctx.globalAlpha = 1;
    for (const f of floating) { const p = project(f.x, f.y, 48 + (1 - f.life / .7) * 22); ctx.globalAlpha = f.life / .7; ctx.fillStyle = f.color; ctx.textAlign = 'center'; ctx.font = `500 ${11 * scale}px sans-serif`; ctx.fillText(f.text, p.x, p.y); }
    ctx.globalAlpha = 1;
    // Small motes are decorative only, independent of simulation or army size.
    if (!settings.reduced) for (let i = 0; i < 30; i++) {
      const x = (i * 137.7 + visualTime * (3 + i % 3)) % (width + 40) - 20, y = (i * 83.1 + Math.sin(visualTime * .3 + i) * 12) % height;
      ellipse(x, y, i % 3 ? .8 : 1.3, .7, '#f0d19b35');
    }
    ctx.restore();
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
    $('health-label').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; $('health-fill').style.width = `${p.hp / p.maxHp * 100}%`;
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
    if (Math.hypot(sx, sy) > .1) { moveTarget = null; const x = sx + sy * 2, y = -sx + sy * 2, d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
    if (moveTarget) { const d = distance(game.player, moveTarget); if (d < .2) moveTarget = null; else return { x: (moveTarget.x - game.player.x) / d, y: (moveTarget.y - game.player.y) / d, goal: moveTarget }; }
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
    else if (key === '?') pause(true);
    processEvents(); updateUI();
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  canvas.addEventListener('pointerdown', event => {
    if (modalOpen || event.button > 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    const point = pointerPosition(event); aim = unproject(point.x, point.y);
    if (armed) { drag = { start: aim, screen: point, id: event.pointerId }; return; }
    const picked = game.enemies.map(e => { const p = project(e.x, e.y, 20); return { e, d: Math.hypot(point.x - p.x, point.y - p.y) }; }).filter(o => o.d < Math.max(26, TYPES[o.e.type].radius * 65 * scale)).sort((a, b) => a.d - b.d)[0];
    if (picked) { if (game.sway && game.sway.targetId !== picked.e.id) game.sway = null; game.selectedId = picked.e.id; moveTarget = null; }
    else if (game.isWalkable(aim.x, aim.y)) { moveTarget = aim; ripples.push({ ...aim, color: '#e3c18b', life: .5, max: .5, radius: .5 }); }
    updateUI();
  });
  canvas.addEventListener('pointermove', event => { if (modalOpen) return; const p = pointerPosition(event); aim = unproject(p.x, p.y); });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId || !armed) return;
    const p = pointerPosition(event), end = unproject(p.x, p.y), start = drag.start;
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
