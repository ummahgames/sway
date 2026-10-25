const assert = require('node:assert/strict');
const { Game, TYPES, WIDTH, distance } = require('./engine.js');
let passed = 0;
function test(name, run) { try { run(); console.log(`✓ ${name}`); passed++; } catch (error) { console.error(`✗ ${name}`); throw error; } }
function tick(game, seconds, input = {}) { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.update(1 / 60, typeof input === 'function' ? input(i) : input); }
function empty(seed = 33) { const g = new Game(seed); g.entities = []; g.autoAttack = false; g.events = []; return g; }

test('Weakening is a prerequisite; Sway remains an active hostile encounter', () => {
  const g = empty(), e = g.spawn('jackal', 5.15, 8.5);
  g.selectedId = e.id; assert.equal(g.beginSway(), false);
  e.hp = e.maxHp * .3; assert.equal(g.beginSway(), true);
  assert.equal(e.team, 'hostile'); tick(g, 1.2);
  assert(g.player.hp < 100, 'A target must continue attacking during hypnosis');
  assert(g.sway && g.sway.progress > 0); assert.equal(e.team, 'hostile');
});
test('Dodging preserves the selected target and accumulated Sway progress', () => {
  const g = empty(), e = g.spawn('cinder', 6, 8.5); e.hp = 15; g.selectedId = e.id; g.beginSway();
  tick(g, .3); const progress = g.sway.progress;
  g.dodge(-1, 0); tick(g, .12);
  assert.equal(g.sway.targetId, e.id); assert.equal(g.sway.progress, progress);
});
test('A maintained tether recruits with a useful health floor and no defeat loot', () => {
  const g = empty(), e = g.spawn('jackal', 5.4, 8.5); e.hp = 8; g.selectedId = e.id;
  g.beginSway(); tick(g, 5);
  assert.equal(e.team, 'ally'); assert.equal(g.sway, null); assert.equal(g.metrics.recruited, 1);
  assert(e.hp >= e.maxHp * .55); assert.equal(g.pickups.length, 0);
});
test('Broken range and pillar occlusion interrupt the connection without instant reset', () => {
  const g = empty(), e = g.spawn('cinder', 6, 8.5); e.hp = 12; g.selectedId = e.id; g.beginSway(); tick(g, .5);
  const progress = g.sway.progress; g.player.x = 34.5; tick(g, .3);
  assert.equal(g.sway.progress, progress); assert.equal(g.sway.state, 'broken');
  tick(g, 3); assert.equal(g.sway, null);
  assert.equal(g.lineOfSight({ x: 2.5, y: 4.5 }, { x: 5.5, y: 4.5 }), false);
});
test('Capture orders suppress fresh allied attacks while existing shots remain dangerous', () => {
  const g = empty(), e = g.spawn('jackal', 6.3, 8.5), ally = g.spawn('jackal', 6, 8.5, 'ally');
  e.hp = 10; g.selectedId = e.id; g.beginSway(); ally.attackCd = 0; const hp = e.hp;
  tick(g, .2); assert.equal(e.hp, hp);
  g.projectiles.push({ x: 5.9, y: 8.5, vx: 5, vy: 0, life: .5, damage: 20, team: 'ally', ownerId: ally.id, radius: .1 });
  tick(g, .2); assert.equal(e.hp, 0); assert.equal(g.sway, null);
});
test('Explicit strikes cancel Sway, and a fallen follower never drops enemy loot', () => {
  const g = empty(), e = g.spawn('jackal', 6.3, 8.5); e.hp = 10; g.selectedId = e.id; g.beginSway();
  assert.equal(g.strike(true), true); assert.equal(g.sway, null);
  const a = g.spawn('horn', 5, 8, 'ally'); g.hurt(a, 1000); assert.equal(g.pickups.length, 0);
});
test('A newly swayed creature is not attacked by its allies in the conversion frame', () => {
  const g = empty(), target = g.spawn('jackal', 5.5, 8.5), ally = g.spawn('jackal', 5.6, 8.5, 'ally');
  target.hp = 7; g.selectedId = target.id; g.beginSway();
  g.sway.progress = g.sway.duration - .001; ally.attackCd = 0;
  tick(g, 1 / 60);
  assert.equal(target.team, 'ally'); assert.equal(target.hp, target.maxHp * .55);
});
test('Anchors form real barriers, absorb projectiles, preserve health, and expire', () => {
  const g = empty(), a = g.spawn('horn', 6.5, 8.5, 'ally'), enemy = g.spawn('jackal', 7.5, 8.5);
  a.hp = 25; g.commandHorde('anchor', { x: 6.4, y: 8.5 }, { x: 6.6, y: 8.5 });
  tick(g, .1); assert.equal(a.hp, 25); assert.equal(g.canOccupy(enemy, a.x, a.y), false);
  g.entities = [a]; g.projectiles.push({ x: 7.1, y: 8.5, vx: -5, vy: 0, life: .4, damage: 10, team: 'hostile', ownerId: 999, radius: .15 });
  tick(g, .2); assert(a.hp < 25 && a.hp > 20, 'Statues reduce damage and intercept the shot');
  tick(g, 8); assert.equal(a.mode, 'follow'); assert.equal(g.command, 'follow');
});
test('Sanctuary requires an anchored seal and grants its reward only once', () => {
  const g = empty(); g.player.x = g.map.shrine.x; g.player.y = g.map.shrine.y; g.player.hp = 40;
  assert.equal(g.interact(), 'lockedShrine'); assert.equal(g.player.hp, 40);
  const a = g.spawn('horn', g.map.plate.x, g.map.plate.y, 'ally');
  g.commandHorde('anchor', { x: a.x - .1, y: a.y }, { x: a.x + .1, y: a.y }); tick(g, .1);
  const beforeGift = g.player.hp;
  assert.equal(g.interact(), 'shrine'); assert.equal(g.player.hp, Math.min(g.player.maxHp, beforeGift + 30)); assert.equal(g.player.shards, 5);
  assert.equal(g.interact(), null); assert.equal(g.player.shards, 5);
});
test('Uncapped hordes survive level transitions without replacement or health resets', () => {
  const g = empty();
  for (let i = 0; i < 240; i++) { const e = g.spawn(Object.keys(TYPES)[i % 7], 5 + i % 3 * .2, 8 + Math.floor(i / 3) % 3 * .2, 'ally'); e.hp = 15; }
  const ids = g.allies.map(e => e.id); g.status = 'upgrade'; assert(g.descend('tether'));
  assert.equal(g.allies.length, 240); assert.deepEqual(g.allies.map(e => e.id), ids); assert(g.allies.every(e => e.hp === 15));
  assert(g.allies.every(e => g.isWalkable(e.x, e.y))); assert.equal(g.floor, 2);
});
test('Shared routes guide a procession through corridors and around pillars', () => {
  const g = empty(), ally = g.spawn('jackal', 4.5, 8.5, 'ally'); g.player.x = 35.5;
  tick(g, 18); assert(distance(ally, g.player) < 3, `Follower failed to arrive: ${ally.x},${ally.y}`);
  const goal = { x: 2.5, y: 4.5 }; g.player.x = 5.5; g.player.y = 4.5;
  tick(g, 4, { goal }); assert(distance(g.player, goal) < .25);
});
test('A live expedition round-trips mid-channel, including hazards and formation state', () => {
  const g = empty(), e = g.spawn('cloud', 6, 8.5), ally = g.spawn('horn', 5, 9, 'ally'); e.hp = 9;
  g.selectedId = e.id; g.beginSway(); g.commandHorde('anchor', { x: 5, y: 9 }, { x: 5.2, y: 9 }); tick(g, .4);
  g.zones.push({ x: 8, y: 8, radius: .6, tick: .3, life: 2, damage: 2, team: 'neutral' });
  const serialized = JSON.parse(JSON.stringify(g.serialize())), restored = Game.restore(serialized);
  assert.deepEqual(restored.serialize(), serialized); assert.equal(restored.entities.find(e => e.id === ally.id).mode, 'anchor');
  tick(g, 1); tick(restored, 1); assert.deepEqual(restored.serialize(), g.serialize());
});
test('Every generated floor has connected routes and non-overlapping creature IDs', () => {
  for (const floor of [1, 2, 3, 15, 100, 10000]) {
    const g = new Game(99); g.floor = floor; g.entities = []; g.generateFloor();
    assert.equal(new Set(g.entities.map(e => e.id)).size, g.entities.length);
    assert(g.entities.every(e => g.isWalkable(e.x, e.y)));
    const field = g.flowFor(g.map.exit); assert(field[8 * WIDTH + 4] >= 0);
  }
});
test('Save validation rejects corrupt or incompatible expeditions', () => {
  const data = new Game(88).serialize();
  assert.throws(() => Game.restore({ ...data, version: 99 }));
  assert.throws(() => Game.restore({ ...data, player: { ...data.player, hp: NaN } }));
  assert.throws(() => Game.restore({ ...data, entities: [{ ...data.entities[0], type: 'unknown' }] }));
});
test('A completed floor opens its exit, and gifts cannot be claimed twice', () => {
  const g = empty(); tick(g, .1); assert(g.clearRooms.every(Boolean));
  g.player.x = g.map.exit.x; g.player.y = g.map.exit.y;
  assert.equal(g.interact(), 'descend'); assert.equal(g.status, 'upgrade');
  assert(g.descend('power')); const damage = g.stats.damage;
  assert.equal(g.descend('power'), false); assert.equal(g.stats.damage, damage);
});
console.log(`\n${passed} gameplay checks passed.`);
