/* Sway's deterministic world and combat simulation. No DOM or renderer dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SwayEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 43, HEIGHT = 18, VERSION = 1;
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const TYPES = {
    jackal:  { name: 'Dune Jackal', glyph: '♢', color: '#c9aa79', hp: 44, speed: 2.0, damage: 7, range: .85, cooldown: 1.8, sway: 2.5, radius: .26, attack: 'bite', description: 'A swift hunter of the buried roads.' },
    cinder:  { name: 'Cinderback', glyph: '♨', color: '#d47a4f', hp: 68, speed: 1.15, damage: 11, range: 2.7, cooldown: 3.0, sway: 4.0, radius: .4, attack: 'flame', description: 'Bronze plates conceal a living furnace.' },
    cloud:   { name: 'Stormwisp', glyph: '☁', color: '#9bcad2', hp: 40, speed: 1.25, damage: 9, range: 4.1, cooldown: 3.0, sway: 3.5, radius: .3, attack: 'storm', flying: true, description: 'A small storm with a very long memory.' },
    horn:    { name: 'Basalt Horn', glyph: '▲', color: '#9c9ca4', hp: 88, speed: 1.05, damage: 13, range: 4.2, cooldown: 3.5, sway: 4.7, radius: .46, attack: 'charge', description: 'The stone remembers how to run.' },
    djinn:   { name: 'Veiled Djinn', glyph: '◈', color: '#89bcb0', hp: 56, speed: 1.5, damage: 10, range: 4.2, cooldown: 2.4, sway: 5.0, radius: .32, attack: 'orb', flying: true, description: 'An old whisper, clothed in smoke.' },
    phoenix: { name: 'Sun Phoenix', glyph: '✧', color: '#f0b765', hp: 76, speed: 1.75, damage: 12, range: 3.4, cooldown: 3.2, sway: 5.5, radius: .36, attack: 'flame', flying: true, description: 'The last light of a forgotten sun.' },
    drake:   { name: 'Dune Drake', glyph: '♜', color: '#a0b899', hp: 116, speed: 1.1, damage: 15, range: 3.4, cooldown: 3.6, sway: 6.5, radius: .52, attack: 'flame', description: 'A desert kingdom sleeps beneath its scales.' }
  };
  const REGIONS = [
    { name: 'Buried Caravan Halls', subtitle: 'Where the sand remembers', floor: '#a78462', edge: '#594f43', accent: '#d6b57a', sky: '#18242d' },
    { name: 'Ember Necropolis', subtitle: 'The furnaces still breathe', floor: '#a16d52', edge: '#503c37', accent: '#eea36a', sky: '#251f27' },
    { name: 'Cisterns of the Unseen', subtitle: 'Something moves beneath', floor: '#718f8b', edge: '#3a5455', accent: '#9edacc', sky: '#142831' },
    { name: 'Palace of Suspended Storms', subtitle: 'A sky beneath the earth', floor: '#8b889e', edge: '#45465c', accent: '#bbbee7', sky: '#202337' },
    { name: 'The Deep Gates', subtitle: 'No one remembers who sealed them', floor: '#968468', edge: '#494c46', accent: '#ebca8c', sky: '#172224' }
  ];
  function randomSource(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeMap(floor, seed) {
    const random = randomSource(seed + floor * 997);
    const tiles = new Array(WIDTH * HEIGHT).fill(0), blocked = new Set();
    const rooms = [1, 16, 31].map((x, i) => ({ x, y: 2, w: 11, h: 13, cx: x + 5.5, cy: 8.5, index: i }));
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) tiles[y * WIDTH + x] = 1;
    }
    for (const x0 of [12, 27]) for (let x = x0; x < x0 + 4; x++) for (let y = 7; y <= 9; y++) tiles[y * WIDTH + x] = 2;
    const pillars = [];
    for (const room of rooms) {
      for (const [dx, dy] of [[2, 2], [8, 2], [2, 10], [8, 10]]) {
        const x = room.x + dx, y = room.y + dy;
        blocked.add(y * WIDTH + x);
        pillars.push({ x: x + .5, y: y + .5, height: 1.4 + random() * .4, broken: random() < .25 });
      }
    }
    const decoration = [];
    for (let i = 0; i < 58; i++) {
      const room = rooms[Math.floor(random() * 3)];
      decoration.push({ x: room.x + random() * 10 + .5, y: 2.5 + random() * 12, kind: Math.floor(random() * 4), angle: random() * TAU });
    }
    return { tiles, blocked, rooms, pillars, decoration, exit: { x: 39.5, y: 8.5 }, plate: { x: 20.5, y: 12.5 }, shrine: { x: 24.5, y: 11.5 } };
  }
  function pointSegmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  class Game {
    constructor(seed = Date.now() >>> 0) {
      this.seed = seed >>> 0;
      this.floor = 1; this.time = 0; this.nextId = 1;
      this.player = { x: 4.5, y: 8.5, hp: 100, maxHp: 100, radius: .24, speed: 3.15, facingX: .707, facingY: -.707, attackCd: 0, dodgeCd: 0, dodgeTime: 0, invulnerable: 0, shards: 0 };
      this.stats = { damage: 12, tether: 5.2, swaySpeed: 1, anchorDuration: 7 };
      this.metrics = { recruited: 0, defeated: 0, highestHorde: 0 };
      this.entities = []; this.projectiles = []; this.zones = []; this.pickups = []; this.events = [];
      this.sway = null; this.selectedId = null; this.command = 'follow';
      this.autoAttack = true; this.status = 'playing'; this.claimed = false;
      this.generateFloor();
    }
    get region() { return REGIONS[Math.floor((this.floor - 1) / 3) % REGIONS.length]; }
    get allies() { return this.entities.filter(e => e.team === 'ally' && e.hp > 0); }
    get enemies() { return this.entities.filter(e => e.team === 'hostile' && e.hp > 0); }
    get selected() { return this.entities.find(e => e.id === this.selectedId && e.hp > 0) || null; }
    event(kind, data = {}) { this.events.push({ kind, ...data }); }
    generateFloor() {
      this.map = makeMap(this.floor, this.seed); this.flowCache = new Map();
      this.clearRooms = [false, false, false]; this.claimed = false; this.plateActive = false;
      this.projectiles = []; this.zones = []; this.pickups = []; this.sway = null; this.selectedId = null;
      const random = randomSource(this.seed + this.floor * 217);
      const available = ['jackal', 'cinder', 'cloud', 'horn', 'djinn', 'phoenix', 'drake'].slice(0, Math.min(7, 3 + Math.floor(this.floor / 2)));
      this.map.rooms.forEach((room, ri) => {
        const count = Math.min(8, (ri === 0 ? 2 : 3) + Math.floor((this.floor - 1) / 2));
        for (let i = 0; i < count; i++) {
          let type = available[Math.floor(random() * available.length)];
          if (this.floor === 1 && ri === 0) type = i === 0 ? 'jackal' : 'cinder';
          if (this.floor === 1 && ri === 1 && i === 0) type = 'cloud';
          const angle = i * 2.399 + ri;
          const entity = this.spawn(type, room.cx + 1 + Math.cos(angle) * 2.1, room.cy + Math.sin(angle) * 3, 'hostile');
          entity.room = ri; entity.awake = false;
          if (this.floor % 3 === 0 && ri === 2 && i === 0) {
            entity.elite = true; entity.maxHp *= 1.5; entity.hp = entity.maxHp;
          }
        }
      });
    }
    spawn(type, x, y, team = 'hostile') {
      const def = TYPES[type];
      if (!def) throw new Error('Unknown creature type');
      const scale = 1 + (this.floor - 1) * .065;
      const entity = { id: this.nextId++, type, team, x, y, hp: def.hp * scale, maxHp: def.hp * scale, radius: def.radius, attackCd: .5 + (this.nextId % 5) * .25, windup: null, facingX: -1, facingY: 0, mode: 'follow', order: null, orderTime: 0, awake: true, room: 0, stagger: 0, flash: 0, healCd: 10 };
      if (!this.isWalkable(x, y)) { const point = this.nearestFloor(x, y); entity.x = point.x; entity.y = point.y; }
      this.entities.push(entity); return entity;
    }
    isWalkable(x, y) {
      const gx = Math.floor(x), gy = Math.floor(y);
      return gx >= 0 && gy >= 0 && gx < WIDTH && gy < HEIGHT && !!this.map.tiles[gy * WIDTH + gx] && !this.map.blocked.has(gy * WIDTH + gx);
    }
    nearestFloor(x, y) {
      let best = { x: 4.5, y: 8.5 }, score = Infinity;
      for (let gy = 0; gy < HEIGHT; gy++) for (let gx = 0; gx < WIDTH; gx++) {
        if (!this.isWalkable(gx + .5, gy + .5)) continue;
        const d = (gx + .5 - x) ** 2 + (gy + .5 - y) ** 2;
        if (d < score) { score = d; best = { x: gx + .5, y: gy + .5 }; }
      }
      return best;
    }
    lineOfSight(a, b) {
      const steps = Math.ceil(distance(a, b) * 5);
      for (let i = 1; i < steps; i++) if (!this.isWalkable(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps)) return false;
      return true;
    }
    flowFor(target) {
      let tx = Math.floor(target.x), ty = Math.floor(target.y);
      if (!this.isWalkable(tx + .5, ty + .5)) { const p = this.nearestFloor(target.x, target.y); tx = Math.floor(p.x); ty = Math.floor(p.y); }
      const key = ty * WIDTH + tx;
      if (this.flowCache.has(key)) return this.flowCache.get(key);
      const field = new Int16Array(WIDTH * HEIGHT).fill(-1), queue = [key]; field[key] = 0;
      for (let q = 0; q < queue.length; q++) {
        const current = queue[q], x = current % WIDTH, y = Math.floor(current / WIDTH);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, ni = ny * WIDTH + nx;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT || field[ni] !== -1 || !this.isWalkable(nx + .5, ny + .5)) continue;
          field[ni] = field[current] + 1; queue.push(ni);
        }
      }
      if (this.flowCache.size > 35) this.flowCache.clear();
      this.flowCache.set(key, field); return field;
    }
    canOccupy(entity, x, y) {
      const r = entity.radius * .72;
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) if (!this.isWalkable(x + dx, y + dy)) return false;
      if (entity.team === 'hostile') for (const ally of this._allies || this.allies) {
        if ((ally.mode === 'anchor' || ally.mode === 'line') && Math.hypot(ally.x - x, ally.y - y) < entity.radius + ally.radius * .9) return false;
      }
      return true;
    }
    move(entity, dx, dy) {
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .15));
      let moved = false;
      for (let i = 0; i < steps; i++) {
        if (this.canOccupy(entity, entity.x + dx / steps, entity.y)) { entity.x += dx / steps; moved = true; }
        if (this.canOccupy(entity, entity.x, entity.y + dy / steps)) { entity.y += dy / steps; moved = true; }
      }
      return moved;
    }
    steer(entity, goal, speed, dt) {
      let dx = goal.x - entity.x, dy = goal.y - entity.y, d = Math.hypot(dx, dy);
      if (d < .09) return;
      if (!this.lineOfSight(entity, goal)) {
        const field = this.flowFor(goal), x = Math.floor(entity.x), y = Math.floor(entity.y);
        let best = field[y * WIDTH + x], next = null;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ox, ny = y + oy, value = field[ny * WIDTH + nx];
          if (nx >= 0 && ny >= 0 && nx < WIDTH && ny < HEIGHT && value >= 0 && (best < 0 || value < best)) { best = value; next = { x: nx + .5, y: ny + .5 }; }
        }
        if (next) { dx = next.x - entity.x; dy = next.y - entity.y; d = Math.hypot(dx, dy); }
      }
      const length = Math.min(speed * dt, d);
      entity.facingX = dx / d; entity.facingY = dy / d;
      this.move(entity, dx / d * length, dy / d * length);
    }
    nearestEnemy(origin, maxDistance = Infinity, exclude = null) {
      let best = null, bd = maxDistance;
      for (const enemy of this._enemies || this.enemies) {
        if (enemy.hp <= 0 || enemy.team !== 'hostile' || enemy.id === exclude || !enemy.awake) continue;
        const d = distance(origin, enemy);
        if (d < bd) { best = enemy; bd = d; }
      }
      return best;
    }
    eligible(entity) { return !!entity && entity.team === 'hostile' && entity.hp > 0 && entity.hp <= entity.maxHp * .32; }
    beginSway() {
      if (this.status !== 'playing') return false;
      if (this.sway) { this.cancelSway(); return false; }
      let target = this.selected;
      if (!this.eligible(target)) target = this.enemies.filter(e => this.eligible(e) && distance(this.player, e) <= this.stats.tether).sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
      if (!target) { this.event('notice', { text: 'Weaken a creature below 32% health first.' }); return false; }
      if (distance(this.player, target) > this.stats.tether) { this.event('notice', { text: 'Move closer to establish the tether.' }); return false; }
      this.selectedId = target.id;
      this.sway = { targetId: target.id, progress: 0, duration: TYPES[target.type].sway * (target.elite ? 1.45 : 1) * (.75 + target.hp / target.maxHp), broken: 0, state: 'channeling' };
      this.event('channel', { x: target.x, y: target.y }); return true;
    }
    cancelSway() { this.sway = null; this.event('notice', { text: 'The tether is released.' }); }
    dodge(dx = this.player.facingX, dy = this.player.facingY) {
      const p = this.player;
      if (p.dodgeCd > 0 || this.status !== 'playing') return false;
      const length = Math.hypot(dx, dy) || 1;
      p.dodgeX = dx / length; p.dodgeY = dy / length; p.dodgeTime = .22; p.dodgeCd = 1.5; p.invulnerable = .3;
      this.event('dodge', { x: p.x, y: p.y }); return true;
    }
    strike(manual = false) {
      if (this.status !== 'playing' || this.player.attackCd > 0 || (!manual && this.sway)) return false;
      if (manual && this.sway) this.sway = null;
      let target = this.selected;
      if (!target || target.team !== 'hostile' || distance(this.player, target) > 4.1 || !target.awake) target = this.nearestEnemy(this.player, 4.1);
      if (!target || !this.lineOfSight(this.player, target)) return false;
      const p = this.player, d = distance(p, target) || 1;
      p.facingX = (target.x - p.x) / d; p.facingY = (target.y - p.y) / d;
      this.projectiles.push({ x: p.x, y: p.y, vx: p.facingX * 9, vy: p.facingY * 9, radius: .1, life: .65, damage: this.stats.damage, team: 'player', ownerId: 0, targetId: target.id });
      p.attackCd = this.eligible(target) ? .95 : .62;
      this.event('strike', { x: p.x, y: p.y }); return true;
    }
    hurt(target, amount, sourceTeam = 'neutral') {
      if (target.hp <= 0) return;
      if (target === this.player) {
        if (target.invulnerable > 0) return;
        target.invulnerable = .5;
        if (this.sway) this.sway.progress = Math.max(0, this.sway.progress - .35);
        this.event('playerHit');
      } else {
        if (target.mode === 'anchor') amount *= .35;
        else if (target.mode === 'line' && sourceTeam === 'hostile') amount *= .65;
        target.flash = .13;
      }
      target.hp = Math.max(0, target.hp - amount);
      this.event('damage', { x: target.x, y: target.y, amount, ally: target === this.player || target.team === 'ally' });
      if (target.hp === 0) {
        if (target === this.player) {
          this.status = 'dead'; this.sway = null; this.event('death');
        } else {
          if (target.team === 'hostile') { this.metrics.defeated++; this.pickups.push({ x: target.x, y: target.y, value: target.elite ? 4 : 1 }); }
          if (this.sway && this.sway.targetId === target.id) { this.sway = null; this.event('notice', { text: 'The creature fell before the bond could form.' }); }
          this.event('dissolve', { x: target.x, y: target.y, color: TYPES[target.type].color });
        }
      } else if (target.team === 'hostile' && this.eligible(target) && !target.readyNotified) {
        target.readyNotified = true;
        this.event('ready', { x: target.x, y: target.y, name: TYPES[target.type].name });
      }
    }
    commandHorde(command, a, b) {
      const allies = this.allies;
      if (!allies.length) { this.event('notice', { text: 'Sway your first creature to command a procession.' }); return false; }
      this.command = command;
      if (command === 'rally' || command === 'spread') {
        for (const e of allies) { e.mode = command === 'rally' ? 'rally' : 'spread'; e.order = null; e.orderTime = command === 'rally' ? 4 : 8; e.windup = null; }
      } else if (command === 'rush') {
        const goal = this.nearestFloor(a.x, a.y);
        for (const e of allies) { e.mode = 'rush'; e.order = goal; e.orderTime = 6; e.windup = null; }
      } else if (command === 'line' || command === 'anchor') {
        if (!a || !b) return false;
        const length = clamp(distance(a, b), .5, 8);
        const dx = b.x - a.x, dy = b.y - a.y, actual = Math.hypot(dx, dy) || 1;
        const end = { x: a.x + dx / actual * length, y: a.y + dy / actual * length };
        const available = allies.slice().sort((x, y) => {
          const weight = e => distance(e, a) - TYPES[e.type].radius * 3;
          return weight(x) - weight(y);
        });
        const count = Math.min(available.length, Math.max(1, Math.ceil(length / .72)));
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? .5 : i / (count - 1);
          const raw = { x: a.x + (end.x - a.x) * t, y: a.y + (end.y - a.y) * t };
          const point = this.isWalkable(raw.x, raw.y) ? raw : this.nearestFloor(raw.x, raw.y);
          const e = available[i]; e.mode = command; e.order = point; e.orderTime = this.stats.anchorDuration; e.windup = null;
        }
      } else return false;
      this.event('command', { command, x: a ? a.x : this.player.x, y: a ? a.y : this.player.y }); return true;
    }
    updateSway(dt) {
      if (!this.sway) return;
      const s = this.sway, target = this.entities.find(e => e.id === s.targetId && e.hp > 0);
      if (!target || target.team !== 'hostile') { this.sway = null; return; }
      const valid = distance(this.player, target) <= this.stats.tether && this.lineOfSight(this.player, target);
      if (valid) {
        s.broken = 0; s.state = this.player.dodgeTime > 0 ? 'dodging' : 'channeling';
        if (this.player.dodgeTime <= 0) s.progress += dt * this.stats.swaySpeed;
      } else {
        s.broken += dt; s.state = 'broken';
        if (s.broken > .65) s.progress = Math.max(0, s.progress - dt * .65);
        if (s.broken > 3) { this.sway = null; this.event('notice', { text: 'The connection faded. Move closer and try again.' }); return; }
      }
      if (s.progress >= s.duration) {
        target.team = 'ally'; target.hp = Math.max(target.hp, target.maxHp * .55);
        target.mode = 'follow'; target.windup = null; target.attackCd = .5; target.stagger = 0;
        target.order = null; target.orderTime = 0;
        this.sway = null; this.selectedId = null; this.command = 'follow';
        this.metrics.recruited++; this.metrics.highestHorde = Math.max(this.metrics.highestHorde, this.allies.length);
        this.event('recruit', { type: target.type, x: target.x, y: target.y });
      }
    }
    updateEnemy(e, dt) {
      const def = TYPES[e.type], p = this.player;
      if (!e.awake) {
        if (distance(e, p) < 7.4 || e.hp < e.maxHp) e.awake = true;
        else return;
      }
      if (e.stagger > 0) return;
      if (e.windup) {
        e.windup.remaining -= dt;
        if (e.windup.remaining <= 0) { this.resolveAttack(e); e.windup = null; e.attackCd = def.cooldown; }
        return;
      }
      let target = p, bd = distance(e, p) * .83;
      if (!this.sway || this.sway.targetId !== e.id) {
        for (const ally of this._allies) { const d = distance(e, ally); if (d < bd) { bd = d; target = ally; } }
      }
      const d = distance(e, target);
      if (d > def.range * .83) this.steer(e, target, def.speed, dt);
      else if (e.attackCd <= 0 && this.lineOfSight(e, target)) {
        const dx = target.x - e.x, dy = target.y - e.y, len = Math.hypot(dx, dy) || 1;
        e.facingX = dx / len; e.facingY = dy / len;
        const duration = def.attack === 'storm' ? 1.05 : def.attack === 'bite' ? .6 : .85;
        e.windup = { kind: def.attack, x: target.x, y: target.y, dx: dx / len, dy: dy / len, remaining: duration, duration };
      }
    }
    resolveAttack(e) {
      const def = TYPES[e.type], w = e.windup, victims = [this.player, ...this._allies];
      const damage = def.damage * (1 + (this.floor - 1) * .035) * (e.elite ? 1.2 : 1);
      if (w.kind === 'orb') {
        this.projectiles.push({ x: e.x, y: e.y, vx: w.dx * 4.4, vy: w.dy * 4.4, radius: .18, life: 2, damage, team: 'hostile', ownerId: e.id });
      } else if (w.kind === 'storm') {
        for (const t of victims) if (distance(t, w) < 1.05 + t.radius) this.hurt(t, damage, 'hostile');
        this.event('lightning', { x: w.x, y: w.y });
      } else if (w.kind === 'charge') {
        const end = { x: e.x + w.dx * 3.4, y: e.y + w.dy * 3.4 };
        for (const t of victims) if (pointSegmentDistance(t, e, end) < .55 + t.radius) this.hurt(t, damage, 'hostile');
        this.move(e, w.dx * 2.8, w.dy * 2.8);
        this.event('impact', { x: e.x, y: e.y });
      } else if (w.kind === 'flame') {
        for (const t of victims) {
          const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
          if (d < def.range + t.radius && (dx * w.dx + dy * w.dy) / (d || 1) > .68) this.hurt(t, damage, 'hostile');
        }
        const zone = { x: e.x + w.dx * 1.9, y: e.y + w.dy * 1.9, radius: .65, life: 2.3, tick: .3, damage: 4, team: 'hostile', ownerId: e.id };
        if (this.isWalkable(zone.x, zone.y)) this.zones.push(zone);
        this.event('flame', { x: e.x, y: e.y });
      } else {
        for (const t of victims) if (distance(t, w) < .66 + t.radius && distance(t, e) < 1.4) this.hurt(t, damage, 'hostile');
        this.event('impact', { x: w.x, y: w.y });
      }
    }
    updateAlly(e, index, dt) {
      const def = TYPES[e.type];
      if (e.orderTime > 0) { e.orderTime -= dt; if (e.orderTime <= 0) { e.mode = 'follow'; e.order = null; } }
      if (e.type === 'phoenix') {
        e.healCd -= dt;
        if (e.healCd <= 0) { for (const a of this._allies) if (distance(e, a) < 2.5) a.hp = Math.min(a.maxHp, a.hp + 4); e.healCd = 12; this.event('renew', { x: e.x, y: e.y }); }
      }
      if ((e.mode === 'anchor' || e.mode === 'line') && e.order) {
        if (distance(e, e.order) > .12) this.steer(e, e.order, 3.5, dt);
        if (e.mode === 'anchor') return;
      }
      const captureId = this.sway ? this.sway.targetId : null;
      const enemy = this.nearestEnemy(e, e.mode === 'rush' ? 8 : 5.5, captureId);
      if (enemy && e.mode !== 'rally' && (distance(enemy, this.player) < 7.5 || e.mode === 'rush')) {
        const ranged = def.flying || def.attack === 'flame';
        const range = ranged ? 3.2 : e.radius + enemy.radius + .35;
        if (distance(e, enemy) > range) {
          if (e.mode !== 'line') this.steer(e, enemy, def.speed * 1.45, dt);
        } else if (e.attackCd <= 0 && this.lineOfSight(e, enemy)) {
          const d = distance(e, enemy) || 1;
          e.facingX = (enemy.x - e.x) / d; e.facingY = (enemy.y - e.y) / d;
          if (ranged) this.projectiles.push({ x: e.x, y: e.y, vx: e.facingX * 6, vy: e.facingY * 6, radius: .1, life: .8, damage: 6.5, team: 'ally', ownerId: e.id, targetId: enemy.id });
          else { this.hurt(enemy, def.attack === 'charge' ? 9 : 6.5, 'ally'); if (e.mode === 'rush' && def.attack === 'charge') enemy.stagger = .65; }
          e.attackCd = 1.2 + (e.id % 3) * .12;
        }
      } else if (e.mode === 'rush' && e.order) this.steer(e, e.order, def.speed * 1.8, dt);
      else if (e.mode !== 'line') {
        const angle = index * 2.39996, radius = (e.mode === 'spread' ? 2.2 : .9) + Math.sqrt(index + 1) * .23;
        const raw = { x: this.player.x + Math.cos(angle) * radius, y: this.player.y + Math.sin(angle) * radius };
        const goal = this.isWalkable(raw.x, raw.y) ? raw : this.player;
        if (distance(e, goal) > .3) this.steer(e, goal, Math.max(3.4, def.speed * 1.5), dt);
      }
    }
    updateProjectiles(dt) {
      for (const shot of this.projectiles) {
        if (shot.life <= 0) continue;
        const steps = Math.max(1, Math.ceil(Math.hypot(shot.vx, shot.vy) * dt / .15));
        for (let i = 0; i < steps && shot.life > 0; i++) {
          shot.x += shot.vx * dt / steps; shot.y += shot.vy * dt / steps;
          if (!this.isWalkable(shot.x, shot.y)) { shot.life = 0; break; }
          const targets = shot.team === 'hostile' ? [...this._allies, this.player] : this._enemies;
          for (const target of targets) {
            if (target.hp <= 0 || target.id === shot.ownerId || (shot.team !== 'hostile' && target.team !== 'hostile')) continue;
            if (distance(shot, target) <= target.radius + shot.radius) { this.hurt(target, shot.damage, shot.team); shot.life = 0; break; }
          }
        }
        shot.life -= dt;
      }
      this.projectiles = this.projectiles.filter(p => p.life > 0);
    }
    separateAllies(dt) {
      const cells = new Map();
      for (const e of this._allies) {
        const key = `${Math.floor(e.x)},${Math.floor(e.y)}`;
        if (!cells.has(key)) cells.set(key, []); cells.get(key).push(e);
      }
      for (const e of this._allies) {
        if (e.mode === 'anchor' || e.mode === 'line') continue;
        const cx = Math.floor(e.x), cy = Math.floor(e.y);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          for (const other of cells.get(`${cx + ox},${cy + oy}`) || []) {
            if (e.id >= other.id) continue;
            const dx = e.x - other.x, dy = e.y - other.y, d = Math.hypot(dx, dy), space = (e.radius + other.radius) * .65;
            if (d < space && d > .001) {
              const push = Math.min((space - d) * .5, dt * 1.5);
              this.move(e, dx / d * push, dy / d * push);
              if (other.mode !== 'anchor' && other.mode !== 'line') this.move(other, -dx / d * push, -dy / d * push);
            }
          }
        }
      }
    }
    update(dt, input = {}) {
      if (this.status !== 'playing') return;
      dt = clamp(dt, 0, .05); this.time += dt;
      this._allies = this.allies; this._enemies = this.enemies;
      const p = this.player;
      p.attackCd = Math.max(0, p.attackCd - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
      if (p.dodgeTime > 0) { p.dodgeTime -= dt; this.move(p, p.dodgeX * 12 * dt, p.dodgeY * 12 * dt); }
      else {
        const dx = input.x || 0, dy = input.y || 0, d = Math.hypot(dx, dy);
        if (input.goal) this.steer(p, input.goal, p.speed, dt);
        else if (d > .04) { p.facingX = dx / d; p.facingY = dy / d; this.move(p, dx / Math.max(1, d) * p.speed * dt, dy / Math.max(1, d) * p.speed * dt); }
      }
      for (const e of this.entities) { e.attackCd = Math.max(0, e.attackCd - dt); e.stagger = Math.max(0, e.stagger - dt); e.flash = Math.max(0, e.flash - dt); }
      this.updateSway(dt);
      if (this.autoAttack && !this.sway && p.dodgeTime <= 0) this.strike();
      for (const e of this._enemies) if (e.team === 'hostile' && e.hp > 0) this.updateEnemy(e, dt);
      for (let i = 0; i < this._allies.length; i++) if (this._allies[i].hp > 0) this.updateAlly(this._allies[i], i, dt);
      this.separateAllies(dt); this.updateProjectiles(dt);
      for (const zone of this.zones) {
        zone.life -= dt; zone.tick -= dt;
        if (zone.tick <= 0) {
          zone.tick = .5;
          const targets = zone.team === 'neutral' ? [p, ...this.entities] : [p, ...this._allies];
          for (const t of targets) if (t.hp > 0 && distance(t, zone) < zone.radius + t.radius) this.hurt(t, zone.damage, zone.team);
        }
      }
      this.zones = this.zones.filter(z => z.life > 0);
      for (const pickup of this.pickups) if (distance(p, pickup) < 1.5) { p.shards += pickup.value; pickup.collected = true; this.event('shard', { x: pickup.x, y: pickup.y }); }
      this.pickups = this.pickups.filter(pickup => !pickup.collected);
      this.entities = this.entities.filter(e => e.hp > 0);
      this._allies = null; this._enemies = null;
      if (this.command !== 'follow' && !this.allies.some(e => e.mode === this.command)) this.command = 'follow';
      if (this.status !== 'playing') return;
      for (let i = 0; i < 3; i++) if (!this.clearRooms[i] && !this.enemies.some(e => e.room === i)) {
        this.clearRooms[i] = true; p.hp = Math.min(p.maxHp, p.hp + 8);
        this.event('roomClear', { room: i, all: this.clearRooms.every(Boolean) });
      }
      this.plateActive = this.allies.some(e => e.mode === 'anchor' && distance(e, this.map.plate) < 1.1);
    }
    interaction() {
      if (distance(this.player, this.map.exit) < 1.65 && this.clearRooms.every(Boolean)) return 'descend';
      if (distance(this.player, this.map.shrine) < 1.6 && !this.claimed) return this.plateActive ? 'shrine' : 'lockedShrine';
      return null;
    }
    interact() {
      const action = this.interaction();
      if (action === 'descend') { this.status = 'upgrade'; this.sway = null; this.event('upgrade'); }
      else if (action === 'shrine') {
        this.claimed = true; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30); this.player.shards += 5;
        for (const e of this.allies) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .3);
        this.event('notice', { text: 'The sanctuary restores your procession. +5 sun shards.' }); this.event('sanctuary');
      } else if (action === 'lockedShrine') this.event('notice', { text: 'Anchor a follower on the diamond seal to awaken this sanctuary.' });
      return action;
    }
    descend(upgrade) {
      if (this.status !== 'upgrade') return false;
      if (!['vitality', 'tether', 'power'].includes(upgrade)) return false;
      if (upgrade === 'vitality') { this.player.maxHp += 15; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40); }
      if (upgrade === 'tether') { this.stats.tether += .4; this.stats.swaySpeed += .08; }
      if (upgrade === 'power') { this.stats.damage += 2; this.stats.anchorDuration += 1; }
      const allies = this.allies;
      this.floor++; this.entities = allies; this.player.x = 4.5; this.player.y = 8.5; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
      this.player.dodgeTime = 0; this.player.invulnerable = .5;
      for (let i = 0; i < allies.length; i++) {
        const e = allies[i], angle = i * 2.39996, radius = .6 + Math.sqrt(i) * .15;
        e.x = 4.5 + Math.cos(angle) * radius; e.y = 8.5 + Math.sin(angle) * radius;
        e.mode = 'follow'; e.order = null; e.orderTime = 0; e.windup = null;
      }
      this.status = 'playing'; this.command = 'follow'; this.generateFloor();
      for (const e of allies) if (!this.canOccupy(e, e.x, e.y)) { const point = this.nearestFloor(e.x, e.y); e.x = point.x; e.y = point.y; }
      this.event('floor', { floor: this.floor }); return true;
    }
    serialize() {
      return { version: VERSION, seed: this.seed, floor: this.floor, time: this.time, nextId: this.nextId, player: { ...this.player }, stats: { ...this.stats }, metrics: { ...this.metrics }, entities: this.entities.map(e => JSON.parse(JSON.stringify(e))), projectiles: this.projectiles.map(p => ({ ...p })), zones: this.zones.map(z => ({ ...z })), pickups: this.pickups.map(p => ({ ...p })), clearRooms: [...this.clearRooms], claimed: this.claimed, plateActive: this.plateActive, sway: this.sway ? { ...this.sway } : null, selectedId: this.selectedId, command: this.command, autoAttack: this.autoAttack, status: this.status };
    }
    static restore(data) {
      if (!data || data.version !== VERSION || !Number.isSafeInteger(data.floor) || data.floor < 1 || !Number.isFinite(data.seed) || !Array.isArray(data.entities) || !data.player || !data.stats || !data.metrics || !Array.isArray(data.clearRooms) || data.clearRooms.length !== 3 || !['playing', 'upgrade'].includes(data.status)) throw new Error('Invalid expedition save');
      const finite = (obj, keys) => keys.every(key => Number.isFinite(obj[key]));
      if (!finite(data.player, ['x', 'y', 'hp', 'maxHp', 'attackCd', 'dodgeCd', 'dodgeTime', 'invulnerable', 'shards']) || data.player.hp <= 0 || data.player.maxHp <= 0 || !finite(data.stats, ['damage', 'tether', 'swaySpeed', 'anchorDuration']) || data.entities.some(e => !TYPES[e.type] || !['ally', 'hostile'].includes(e.team) || !finite(e, ['id', 'x', 'y', 'hp', 'maxHp', 'attackCd', 'radius']) || e.maxHp <= 0)) throw new Error('Invalid expedition data');
      const game = new Game(data.seed);
      for (const key of ['floor', 'time', 'nextId', 'player', 'stats', 'metrics', 'entities', 'projectiles', 'zones', 'pickups', 'clearRooms', 'claimed', 'plateActive', 'sway', 'selectedId', 'command', 'autoAttack', 'status']) if (data[key] !== undefined) game[key] = JSON.parse(JSON.stringify(data[key]));
      game.map = makeMap(game.floor, game.seed); game.flowCache = new Map(); game.events = [];
      if (!game.isWalkable(game.player.x, game.player.y)) throw new Error('Player is outside the dungeon');
      return game;
    }
  }
  return { Game, TYPES, REGIONS, WIDTH, HEIGHT, clamp, distance, makeMap, pointSegmentDistance };
});
