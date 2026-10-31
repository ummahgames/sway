/* WebGL world: local Three.js, original models, procedural textures, and real lighting. */
import * as THREE from './vendor/three.module.min.js';
import { createCharacter, animateCharacter, GEO, material, part } from './models3d.js';

const TAU = Math.PI * 2;
const { TYPES, WIDTH, HEIGHT, distance, clamp } = globalThis.SwayEngine;
function seeded(seed) { return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
function canvasTexture(size, draw, repeat = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4; return texture;
}
function stoneTexture(seed, base, tiled = true) {
  return canvasTexture(256, (ctx, size) => {
    const random = seeded(seed); ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 6800; i++) { const shade = random() < .5 ? '0,0,0' : '255,245,205'; ctx.fillStyle = `rgba(${shade},${random() * .075})`; const r = 1 + random() * 10; ctx.fillRect(random() * size, random() * size, r, r * .3); }
    for (let i = 0; i < 180; i++) { ctx.fillStyle = `rgba(20,17,12,${random() * .14})`; ctx.beginPath(); ctx.ellipse(random() * size, random() * size, random() * 5 + 1, random() * 2 + .4, random() * TAU, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 5; i++) { let x = random() * size, y = random() * size; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (random() - .5) * 45; y += random() * 18; ctx.lineTo(x, y); } ctx.strokeStyle = '#302c2325'; ctx.lineWidth = random() + .5; ctx.stroke(); }
    if (tiled) {
      const grad = ctx.createLinearGradient(0, 0, size, size); grad.addColorStop(0, '#f7e8bd15'); grad.addColorStop(.5, '#00000000'); grad.addColorStop(1, '#161a1925'); ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#24271f75'; ctx.lineWidth = 8; ctx.strokeRect(1, 1, size - 2, size - 2);
      ctx.strokeStyle = '#eee0b52c'; ctx.lineWidth = 2; ctx.strokeRect(7, 7, size - 14, size - 14);
    }
  }, true);
}
function radialTexture() {
  return canvasTexture(128, (ctx, size) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#ffffffb0'); g.addColorStop(.6, '#ffffff33'); g.addColorStop(1, '#ffffff00'); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); });
}
function mandalaTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.translate(s / 2, s / 2); ctx.strokeStyle = '#d5bd8c';
    for (const radius of [218, 209, 164, 155, 65, 51]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.lineWidth = radius > 200 ? 3 : 1.4; ctx.stroke(); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, b = (i + 5) / 16 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 157, Math.sin(a) * 157); ctx.lineTo(Math.cos(b) * 157, Math.sin(b) * 157); ctx.stroke(); ctx.save(); ctx.rotate(a); ctx.strokeRect(176, -7, 17, 14); ctx.restore(); }
    ctx.fillStyle = '#d5bd8c'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
  });
}
function rugTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#654235'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 256; i += 3) { ctx.strokeStyle = i % 2 ? '#cfac6b15' : '#1d211b30'; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke(); }
    for (const inset of [9, 16, 24, 35]) { ctx.strokeStyle = inset % 2 ? '#b89e69' : '#9e7e55'; ctx.lineWidth = 2; ctx.strokeRect(inset, inset, s - inset * 2, s - inset * 2); }
    ctx.translate(128, 128); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#c4ab79'; ctx.lineWidth = 3;
    for (const size of [85, 55, 29]) ctx.strokeRect(-size / 2, -size / 2, size, size);
  });
}
function meshPlane(parent, geometry, mat, x, z, size, y = .065) {
  const mesh = new THREE.Mesh(geometry, mat); mesh.rotation.x = -Math.PI / 2; mesh.scale.set(size, size, 1); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function makeArc(radius, start, end, width, steps = 30) {
  const points = [];
  for (let i = 0; i <= steps; i++) { const a = start + (end - start) * i / steps; points.push(new THREE.Vector2(Math.sin(a) * radius, Math.cos(a) * radius)); }
  const shape = new THREE.Shape(); shape.moveTo(0, 0); for (const p of points) shape.lineTo(p.x, p.y); shape.closePath(); return new THREE.ShapeGeometry(shape);
}

export class DungeonRenderer {
  constructor(canvas, overlay) {
    this.canvas = canvas; this.overlay = overlay; this.ctx = overlay.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#171d20');
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#171d20'); this.scene.fog = new THREE.Fog('#171d20', 15, 36);
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 75);
    this.focus = new THREE.Vector3(6.5, .1, 8.5); this.azimuth = .76; this.zoom = 15.5; this.zoomTarget = 15.5;
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.screenPoint = new THREE.Vector3();
    this.models = new Map(); this.floorKey = ''; this.torches = []; this.floorMaterials = [];
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.actors = new THREE.Group(); this.scene.add(this.actors);
    this.effects = new THREE.Group(); this.scene.add(this.effects);
    this.dynamic = new THREE.Group(); this.effects.add(this.dynamic);
    this.radial = radialTexture(); this.medallion = mandalaTexture(); this.rug = rugTexture();
    this.floorTexture = stoneTexture(711, '#a49b86'); this.wallTexture = stoneTexture(937, '#938770', false);
    this.coarseTexture = stoneTexture(129, '#756955', false);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ color: '#0b1113', map: this.radial, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.ringGeometry = new THREE.RingGeometry(.94, 1, 48);
    this.discGeometry = new THREE.CircleGeometry(1, 48); this.planeGeometry = new THREE.PlaneGeometry(1, 1);
    this.stone = material('#b8ae96', { map: this.wallTexture, bumpMap: this.wallTexture, bumpScale: .055, roughness: .96 });
    this.darkStone = material('#66665b', { map: this.coarseTexture, roughness: .98 });
    this.gold = material('#c19d5c', { metalness: .58, roughness: .48 });
    this.moon = new THREE.HemisphereLight('#b8c9c9', '#4e3d2a', 2.1); this.scene.add(this.moon);
    this.sun = new THREE.DirectionalLight('#ffe0ab', 3.1); this.sun.position.set(-3, 13, -4); this.sun.castShadow = true;
    const shadow = this.sun.shadow; shadow.mapSize.set(2048, 2048); shadow.camera.left = -11; shadow.camera.right = 11; shadow.camera.top = 11; shadow.camera.bottom = -11; shadow.camera.near = .5; shadow.camera.far = 35; shadow.normalBias = .035; shadow.bias = -.00015; shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.torchLights = Array.from({ length: 3 }, () => { const light = new THREE.PointLight('#ffb768', 18, 9, 2); this.scene.add(light); return light; });
    this.lanternLight = new THREE.PointLight('#8dd9cb', 2.5, 4.2, 2); this.scene.add(this.lanternLight);
    this.hero = createCharacter('player'); this.actors.add(this.hero);
    this.heroShadow = meshPlane(this.actors, this.planeGeometry, this.shadowMaterial, 0, 0, 1.2);
    this.createEffectPools();
    this.pickable = [];
    this.resize();
  }
  createEffectPools() {
    const basic = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    this.sparks = new THREE.InstancedMesh(GEO.gem, basic, 350); this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.sparks.count = 0; this.sparks.frustumCulled = false; this.effects.add(this.sparks);
    this.bolts = new THREE.InstancedMesh(GEO.sphere, basic, 350); this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.bolts.count = 0; this.bolts.frustumCulled = false; this.effects.add(this.bolts);
    this.matrixObject = new THREE.Object3D(); this.color = new THREE.Color();
    this.telegraphs = []; this.ripples = []; this.firePatches = []; this.formationMarkers = [];
    this.aimMarker = meshPlane(this.effects, this.ringGeometry, new THREE.MeshBasicMaterial({ color: '#eac992', transparent: true, opacity: .5, depthWrite: false }), 0, 0, .13, .085);
    this.tetherGeometry = new THREE.BufferGeometry(); this.tetherPositions = new Float32Array(65 * 3); this.tetherGeometry.setAttribute('position', new THREE.BufferAttribute(this.tetherPositions, 3));
    this.tether = new THREE.Line(this.tetherGeometry, new THREE.LineBasicMaterial({ color: '#a4f4d8', transparent: true, opacity: .95, toneMapped: false, depthTest: false })); this.tether.frustumCulled = false; this.effects.add(this.tether);
    this.tetherBeads = Array.from({ length: 8 }, () => { const bead = part(this.effects, GEO.sphere, material('#b2f5dc', { emissive: '#79dfbf', emissiveIntensity: 2 }), [0, 0, 0], [.04, .04, .04]); bead.castShadow = false; return bead; });
    this.placementLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#f6d38d', dashSize: .13, gapSize: .1, depthTest: false })); this.effects.add(this.placementLine);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width || 1; this.height = rect.height || 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.detail === 'balanced' ? 1.25 : this.width < 650 ? 1.5 : 1.75);
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.width, this.height, false);
    this.overlay.width = Math.round(this.width * this.dpr); this.overlay.height = Math.round(this.height * this.dpr);
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
  }
  setDetail(detail) {
    this.detail = detail === 'balanced' ? 'balanced' : 'detailed';
    const size = this.detail === 'balanced' ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.renderer.shadowMap.needsUpdate = true;
    }
    this.resize();
  }
  rotate(amount) { this.azimuth = clamp(this.azimuth + amount, .12, 1.45); }
  zoomBy(amount) { this.zoomTarget = clamp(this.zoomTarget + amount, 9, 23); }
  resetCamera() { this.azimuth = .76; this.zoomTarget = 15.5; }
  screenDirection(x, y) {
    const c = Math.cos(this.azimuth), s = Math.sin(this.azimuth);
    const dx = x * c + y * s, dy = -x * s + y * c, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
  screenToWorld(x, y) {
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, point)) return null;
    return { x: point.x, y: point.z };
  }
  project(x, y, height = 0) {
    this.screenPoint.set(x, height, y).project(this.camera);
    return { x: (this.screenPoint.x + 1) * this.width / 2, y: (1 - this.screenPoint.y) * this.height / 2, visible: this.screenPoint.z < 1 && this.screenPoint.z > -1 };
  }
  pickEnemy(x, y, game) {
    this.raycaster.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera);
    const hits = this.raycaster.intersectObjects(this.pickable, true);
    for (const hit of hits) { let object = hit.object; while (object && object.userData.entityId == null) object = object.parent; if (object) { const e = game.entities.find(e => e.id === object.userData.entityId); if (e && e.team === 'hostile') return e; } }
    // A generous silhouette fallback makes small creatures practical to target by touch.
    let best = null, bestDistance = 30;
    for (const e of game.enemies) { const p = this.project(e.x, e.y, .65); const d = Math.hypot(x - p.x, y - p.y); if (p.visible && d < bestDistance) { best = e; bestDistance = d; } }
    return best;
  }
  clearFloor() {
    // Cached geometry/materials are shared. Dispose only floor-owned allocations.
    for (const object of this.world.children) object.traverse(child => { if (child.isInstancedMesh) child.dispose(); if (child.userData.ownedGeometry) child.geometry.dispose(); });
    this.world.clear(); this.torches = [];
    for (const mat of this.floorMaterials) mat.dispose(); this.floorMaterials = [];
  }
  ownMaterial(mat) { this.floorMaterials.push(mat); return mat; }
  buildFloor(game) {
    this.clearFloor(); this.floorKey = `${game.seed}:${game.floor}`;
    const random = seeded(game.seed + game.floor * 503), region = game.region;
    const tint = new THREE.Color(region.floor).lerp(new THREE.Color('#bdb198'), .5);
    const floorMat = this.ownMaterial(new THREE.MeshStandardMaterial({ color: tint, map: this.floorTexture, bumpMap: this.floorTexture, bumpScale: .065, roughness: .95 }));
    const count = game.map.tiles.filter(Boolean).length;
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(.98, .14, .98), floorMat, count); tiles.userData.ownedGeometry = true; tiles.receiveShadow = true;
    let index = 0; const matrix = new THREE.Object3D(), color = new THREE.Color();
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (game.map.tiles[y * WIDTH + x]) {
      matrix.position.set(x + .5, -.055 + random() * .012, y + .5); matrix.rotation.y = Math.floor(random() * 4) * Math.PI / 2; matrix.scale.set(1, 1, 1); matrix.updateMatrix(); tiles.setMatrixAt(index, matrix.matrix);
      const light = .87 + random() * .22; color.setRGB(light, light, light); tiles.setColorAt(index++, color);
    }
    this.world.add(tiles); tiles.instanceMatrix.needsUpdate = true;
    // A rough excavated foundation surrounds the rooms, replacing floating platforms.
    const bed = part(this.world, GEO.box, this.darkStone, [21.5, -.49, 9], [46, .72, 22]); bed.castShadow = false;
    const walls = [];
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      if (!game.map.tiles[y * WIDTH + x]) continue;
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dz;
        if (nx >= 0 && ny >= 0 && nx < WIDTH && ny < HEIGHT && game.map.tiles[ny * WIDTH + nx]) continue;
        const back = dx < 0 || dz < 0, rows = back ? 5 : 1;
        const px = x + .5 + dx * .58, pz = y + .5 + dz * .58;
        for (let row = 0; row < rows; row++) walls.push({ x: px, y: .22 + row * .48, z: pz, dx, dz, row, top: row === rows - 1 });
      }
    }
    const wallGeo = new THREE.BoxGeometry(.98, .46, .42), wallMesh = new THREE.InstancedMesh(wallGeo, this.stone, walls.length); wallMesh.castShadow = true; wallMesh.receiveShadow = true; wallMesh.userData.ownedGeometry = true;
    walls.forEach((w, i) => { matrix.position.set(w.x, w.y, w.z); matrix.rotation.set(0, w.dx ? Math.PI / 2 : 0, 0); matrix.scale.set(1, w.top ? .8 : 1, 1); matrix.updateMatrix(); wallMesh.setMatrixAt(i, matrix.matrix); const l = .85 + random() * .24; wallMesh.setColorAt(i, color.setRGB(l, l, l)); });
    this.world.add(wallMesh);
    for (const room of game.map.rooms) {
      const inlay = meshPlane(this.world, this.planeGeometry, this.ownMaterial(new THREE.MeshStandardMaterial({ color: '#e3d1a1', map: this.medallion, transparent: true, opacity: .32, roughness: .9, depthWrite: false })), room.cx, room.cy, 4.6, .037); inlay.receiveShadow = true;
      const rug = meshPlane(this.world, this.planeGeometry, this.ownMaterial(new THREE.MeshStandardMaterial({ map: this.rug, color: '#d5bda0', roughness: 1 })), room.x + 2.9, 8.4, 1, .045); rug.scale.set(1.45, 3.2, 1); rug.receiveShadow = true;
      for (const p of game.map.pillars.filter(p => p.x > room.x && p.x < room.x + 11)) this.buildPillar(p);
      for (const [x, z] of [[room.x + 1.1, 5.1], [room.x + 8.6, 3.1], [room.x + 7.1, 13.5]]) this.buildTorch(x, z);
      this.buildUrn(room.x + 1.05, 3.1, .88, random);
      this.buildUrn(room.x + 1.7, 3, .62, random);
      this.buildUrn(room.x + 9.7, 13.5, .85, random);
      this.buildCrate(room.x + 9.8, 4, .68, .15);
      this.buildCrate(room.x + 9.8, 4.9, .52, -.12);
      this.buildBanner(room.x + 5.5, 2.15);
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1, x = room.cx + side * (4.7 - random() * .4), z = 3.1 + random() * 10.8;
        const rock = part(this.world, GEO.lowSphere, this.darkStone, [x, .06, z], [.09 + random() * .14, .08 + random() * .1, .1 + random() * .2]); rock.rotation.set(random(), random() * TAU, random()); rock.castShadow = false;
      }
    }
    for (const x of [12.35, 16, 27.35, 31]) { this.buildArch(x, 8.5); this.buildTorch(x + .15, 7.25); }
    this.buildGate(game); this.buildSanctuary(game);
    this.pickupGroup = new THREE.Group(); this.world.add(this.pickupGroup); this.lastPickups = '';
    const dustGeo = new THREE.BufferGeometry(), dust = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) { dust[i * 3] = 1 + random() * 41; dust[i * 3 + 1] = .2 + random() * 2.8; dust[i * 3 + 2] = 2 + random() * 12; }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.dust = new THREE.Points(dustGeo, this.ownMaterial(new THREE.PointsMaterial({ color: '#e3c996', size: .025, transparent: true, opacity: .4, depthWrite: false }))); this.dust.userData.ownedGeometry = true; this.world.add(this.dust);
    this.scene.fog.color.set(region.sky).lerp(new THREE.Color('#25271f'), .35); this.scene.background.copy(this.scene.fog.color);
    this.batchArchitecture();
  }
  batchArchitecture() {
    // Bake immobile props by material. Hundreds of stones become a handful of draw calls.
    this.world.updateMatrixWorld(true);
    const groups = new Map();
    this.world.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.material.isShaderMaterial || mesh.userData.dynamic) return;
      let ancestor = mesh.parent;
      while (ancestor && ancestor !== this.world) { if (ancestor.userData.dynamic) return; ancestor = ancestor.parent; }
      const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(mesh);
    });
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
    for (const meshes of groups.values()) {
      if (meshes.length < 3) continue;
      const positions = [], normals = [], uvs = [];
      for (const mesh of meshes) {
        const geo = mesh.geometry, vertex = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
        const count = geo.index ? geo.index.count : vertex.count;
        normalMatrix.getNormalMatrix(mesh.matrixWorld);
        for (let i = 0; i < count; i++) {
          const index = geo.index ? geo.index.getX(i) : i;
          point.fromBufferAttribute(vertex, index).applyMatrix4(mesh.matrixWorld); positions.push(point.x, point.y, point.z);
          if (n) normal.fromBufferAttribute(n, index).applyMatrix3(normalMatrix).normalize(); else normal.set(0, 1, 0);
          normals.push(normal.x, normal.y, normal.z); uvs.push(uv ? uv.getX(index) : 0, uv ? uv.getY(index) : 0);
        }
        mesh.removeFromParent();
        if (mesh.userData.ownedGeometry) geo.dispose();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.computeBoundingSphere();
      const batch = new THREE.Mesh(geo, meshes[0].material); batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow; batch.userData.ownedGeometry = true; this.world.add(batch);
    }
  }
  buildPillar(p) {
    const height = p.broken ? 1.05 : 2.4 + p.height * .3;
    const base = part(this.world, GEO.box, this.stone, [p.x, .12, p.y], [.96, .24, .96]); base.receiveShadow = true;
    part(this.world, GEO.box, this.gold, [p.x, .27, p.y], [.77, .06, .77]);
    for (let i = 0; i < Math.ceil(height / .43); i++) part(this.world, GEO.cylinder, this.stone, [p.x, .46 + i * .43, p.y], [.35 + (i % 2) * .015, .415, .35 + (i % 2) * .015]);
    part(this.world, GEO.box, this.stone, [p.x, height + .4, p.y], [.86, .2, .86]);
    part(this.world, GEO.box, this.gold, [p.x, height + .29, p.y], [.72, .07, .72]);
    const gem = part(this.world, GEO.gem, this.gold, [p.x + .352, 1.1, p.y], [.025, .17, .1]); gem.rotation.z = .1;
    meshPlane(this.world, this.planeGeometry, this.shadowMaterial, p.x + .12, p.y + .12, 1.8);
  }
  buildTorch(x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.world.add(group);
    part(group, GEO.cylinder, this.darkStone, [0, .14, 0], [.24, .28, .24]);
    part(group, GEO.cylinder, this.gold, [0, .57, 0], [.065, .82, .065]);
    part(group, new THREE.CylinderGeometry(.23, .13, .18, 10), this.gold, [0, 1.04, 0]).userData.ownedGeometry = true;
    const outer = part(group, GEO.sphere, this.ownMaterial(new THREE.MeshBasicMaterial({ color: '#ef9b36', toneMapped: false })), [0, 1.3, 0], [.11, .27, .11]); outer.castShadow = false; outer.userData.dynamic = true;
    const core = part(group, GEO.cone, this.ownMaterial(new THREE.MeshBasicMaterial({ color: '#ffe2a0', toneMapped: false })), [0, 1.28, .02], [.065, .3, .065]); core.castShadow = false; core.userData.dynamic = true;
    const glow = meshPlane(this.world, this.planeGeometry, this.ownMaterial(new THREE.MeshBasicMaterial({ map: this.radial, color: '#d5903b', transparent: true, opacity: .23, depthWrite: false, blending: THREE.AdditiveBlending })), x, z, 5.2, .047);
    this.torches.push({ x, z, group, outer, core, glow, phase: x * 7 + z });
  }
  buildUrn(x, z, scale, random) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); group.rotation.y = random() * TAU; this.world.add(group);
    const points = [[.02, 0], [.2, .04], [.3, .18], [.34, .43], [.26, .61], [.14, .7], [.13, .82], [.18, .84]].map(p => new THREE.Vector2(...p));
    part(group, new THREE.LatheGeometry(points, 14), material('#b59263', { map: this.coarseTexture, roughness: .85 }), [0, 0, 0]).userData.ownedGeometry = true;
    for (const y of [.15, .56, .78]) part(group, GEO.ring, this.gold, [0, y, 0], [y === .15 ? .27 : y === .56 ? .29 : .15, y === .15 ? .27 : y === .56 ? .29 : .15, y === .15 ? .27 : y === .56 ? .29 : .15], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) { const handle = part(group, GEO.ring, this.gold, [side * .25, .63, 0], [.12, .15, .12], [0, Math.PI / 2, 0]); handle.castShadow = false; }
    meshPlane(this.world, this.planeGeometry, this.shadowMaterial, x, z, .85 * scale);
  }
  buildCrate(x, z, scale, angle) {
    const group = new THREE.Group(); group.position.set(x, scale * .5, z); group.rotation.y = angle; this.world.add(group);
    const wood = material('#665039', { map: this.coarseTexture, roughness: .95 }), edge = material('#92744b', { roughness: .9 });
    part(group, GEO.box, wood, [0, 0, 0], [scale, scale, scale]);
    for (const a of [-1, 1]) { part(group, GEO.box, edge, [a * scale * .42, 0, scale * .51], [scale * .1, scale, .04]); part(group, GEO.box, edge, [0, a * scale * .42, scale * .51], [scale, scale * .1, .04]); }
    part(group, GEO.box, edge, [0, 0, scale * .52], [scale * .1, scale * 1.25, .03], [0, 0, -.75]);
  }
  buildBanner(x, z) {
    const group = new THREE.Group(); group.position.set(x, 1.35, z); this.world.add(group);
    part(group, GEO.cylinder, this.gold, [0, .79, 0], [.035, 1.25, .035], [0, 0, Math.PI / 2]);
    const geo = new THREE.PlaneGeometry(.95, 1.43, 6, 8), vertices = geo.attributes.position;
    for (let i = 0; i < vertices.count; i++) { const px = vertices.getX(i), py = vertices.getY(i); vertices.setZ(i, Math.sin(px * 11) * .045); if (py < -.65) vertices.setY(i, py + Math.abs(px) * .35); }
    geo.computeVertexNormals();
    const cloth = part(group, geo, material('#475859', { side: THREE.DoubleSide, roughness: 1 }), [0, 0, .05]); cloth.userData.ownedGeometry = true;
    const diamond = part(group, GEO.gem, this.gold, [0, .03, .12], [.19, .33, .022]); diamond.castShadow = false;
  }
  buildArch(x, z) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = Math.PI / 2; this.world.add(group);
    for (const side of [-1, 1]) { part(group, GEO.box, this.stone, [side * 1.65, 1.03, 0], [.43, 2.06, .62]); part(group, GEO.box, this.gold, [side * 1.65, .16, 0], [.51, .12, .69]); }
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; const stone = part(group, GEO.box, this.stone, [Math.cos(a) * 1.65, 2.04 + Math.sin(a) * .86, 0], [.46, .46, .64]); stone.rotation.z = a - Math.PI / 2; }
  }
  buildGate(game) {
    const group = new THREE.Group(); group.position.set(game.map.exit.x, 0, game.map.exit.y); group.rotation.y = .76; this.world.add(group); this.gate = group;
    for (let i = 0; i < 4; i++) part(group, GEO.box, this.stone, [0, i * .08, .45 - i * .23], [2.05, .15, .32]);
    for (const side of [-1, 1]) { part(group, GEO.box, this.stone, [side * 1.08, 1.15, 0], [.35, 2.3, .45]); part(group, GEO.box, this.gold, [side * 1.08, .2, 0], [.44, .12, .52]); }
    for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI; const stone = part(group, GEO.box, this.stone, [Math.cos(a) * 1.08, 2.2 + Math.sin(a) * 1.08, 0], [.36, .4, .47]); stone.rotation.z = a - Math.PI / 2; }
    const portalGeo = new THREE.PlaneGeometry(1.83, 2.8);
    const portalMat = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { time: { value: 0 }, open: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec2 vUv; uniform float time; uniform float open; void main(){vec2 p=(vUv-.5)*2.;float r=length(vec2(p.x,p.y*.72));float arch=1.-smoothstep(.86,1.,r);float swirl=sin(r*19.-time*2.8+atan(p.y,p.x)*3.)*.5+.5;vec3 c=mix(vec3(.06,.12,.14),vec3(.18,.67,.56)+swirl*vec3(.11,.22,.13),open);float a=arch*(.5+open*.24);gl_FragColor=vec4(c,a);}' });
    this.ownMaterial(portalMat);
    this.portal = part(group, portalGeo, portalMat, [0, 1.4, .02]); this.portal.castShadow = false; this.portal.userData.ownedGeometry = true;
    this.gateGlow = new THREE.PointLight('#83dec8', 0, 6, 2); this.gateGlow.position.set(0, 1.1, .7); group.add(this.gateGlow);
  }
  buildSanctuary(game) {
    const p = game.map.shrine, group = new THREE.Group(); group.position.set(p.x, 0, p.y); this.world.add(group); this.shrine = group;
    part(group, GEO.cylinder, this.stone, [0, .12, 0], [.66, .24, .66]); part(group, GEO.cylinder, this.gold, [0, .29, 0], [.48, .1, .48]);
    part(group, GEO.cylinder, this.stone, [0, .56, 0], [.34, .47, .34]); part(group, GEO.cylinder, this.gold, [0, .83, 0], [.5, .09, .5]);
    this.shrineGem = part(group, GEO.gem, material('#9ce0cf', { emissive: '#5bbaa8', emissiveIntensity: 1.2, metalness: .1, roughness: .2 }), [0, 1.23, 0], [.18, .34, .18]); this.shrineGem.userData.dynamic = true;
    const seal = game.map.plate;
    this.seal = meshPlane(this.world, this.planeGeometry, this.ownMaterial(new THREE.MeshStandardMaterial({ map: this.medallion, color: '#c4b888', transparent: true, roughness: .7, depthWrite: false })), seal.x, seal.y, 1.6, .055); this.seal.rotation.z = .25;
  }
  ensureModel(e) {
    if (this.models.has(e.id)) return this.models.get(e.id);
    const root = createCharacter(e.type); root.userData.entityId = e.id;
    const size = e.elite ? 1.28 : e.type === 'drake' ? 1.18 : 1; root.scale.setScalar(size); this.actors.add(root);
    const shadow = meshPlane(this.actors, this.planeGeometry, this.shadowMaterial, e.x, e.y, (e.radius * 3.7 + .15) * size);
    const ring = meshPlane(this.actors, this.ringGeometry, new THREE.MeshBasicMaterial({ color: '#9ee2ce', transparent: true, opacity: .6, depthWrite: false, toneMapped: false }), e.x, e.y, e.radius + .16, .06);
    const gem = part(this.actors, GEO.gem, material('#b5ead3', { emissive: '#66c8a9', emissiveIntensity: 1.4 }), [e.x, 1.3, e.y], [.06, .1, .06]); gem.castShadow = false;
    const model = { root, shadow, ring, gem, size }; this.models.set(e.id, model); return model;
  }
  removeModel(id) {
    const model = this.models.get(id); if (!model) return;
    this.actors.remove(model.root, model.shadow, model.ring, model.gem);
    model.ring.material.dispose(); model.root.userData.rig.eyeMaterial.dispose();
    for (const geo of model.root.userData.privateGeometries) geo.dispose();
    this.models.delete(id);
  }
  poolPlane(pool, index, ring = false) {
    if (!pool[index]) { const mat = new THREE.MeshBasicMaterial({ color: '#e5946c', transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide }); const mesh = meshPlane(this.effects, ring ? this.ringGeometry : this.discGeometry, mat, 0, 0, 1, .07); pool[index] = mesh; }
    pool[index].visible = true; return pool[index];
  }
  updateEffects(game, state) {
    const t = state.time;
    for (const pool of [this.telegraphs, this.ripples, this.firePatches, this.formationMarkers]) for (const object of pool) object.visible = false;
    let marker = 0;
    for (const e of game.enemies) if (e.windup) {
      const w = e.windup, progress = 1 - w.remaining / w.duration;
      let mesh = this.poolPlane(this.telegraphs, marker++), radius = w.kind === 'storm' ? 1.05 : .66;
      mesh.material.color.set('#dc7753'); mesh.material.opacity = .12 + progress * .2;
      if (w.kind === 'flame' || w.kind === 'charge' || w.kind === 'orb') {
        if (!mesh.userData.attackGeometry || mesh.userData.kind !== w.kind || mesh.userData.range !== TYPES[e.type].range) {
          if (mesh.userData.attackGeometry) mesh.userData.attackGeometry.dispose();
          const geo = w.kind === 'flame' ? makeArc(TYPES[e.type].range, -.8, .8) : new THREE.PlaneGeometry(.9, w.kind === 'charge' ? 3.4 : 4);
          mesh.geometry = geo; mesh.userData.attackGeometry = geo; mesh.userData.kind = w.kind; mesh.userData.range = TYPES[e.type].range;
        }
        mesh.geometry = mesh.userData.attackGeometry;
        mesh.position.set(e.x, .08, e.y); mesh.scale.set(1, 1, 1); mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-w.dx, -w.dy));
        if (w.kind !== 'flame') { const length = w.kind === 'charge' ? 3.4 : 4; mesh.position.x += w.dx * length / 2; mesh.position.z += w.dy * length / 2; }
      } else {
        mesh.geometry = this.discGeometry; mesh.rotation.set(-Math.PI / 2, 0, 0); mesh.position.set(w.x, .07, w.y); mesh.scale.set(radius, radius, 1);
        const ring = this.poolPlane(this.telegraphs, marker++, true); ring.geometry = this.ringGeometry; ring.position.set(w.x, .08, w.y); ring.scale.set(radius * progress, radius * progress, 1); ring.rotation.set(-Math.PI / 2, 0, 0); ring.material.opacity = .8;
      }
    }
    game.zones.forEach((z, i) => { const mesh = this.poolPlane(this.firePatches, i); mesh.position.set(z.x, .09, z.y); mesh.scale.set(z.radius, z.radius, 1); mesh.material.color.set('#ed8e38'); mesh.material.opacity = .2 + Math.sin(t * 10 + i) * .05; });
    state.ripples.forEach((r, i) => { const mesh = this.poolPlane(this.ripples, i, true), progress = 1 - r.life / r.max; mesh.geometry = this.ringGeometry; mesh.position.set(r.x, .08, r.y); mesh.scale.setScalar(r.radius * progress); mesh.rotation.x = -Math.PI / 2; mesh.material.color.set(r.color); mesh.material.opacity = 1 - progress; });
    this.aimMarker.visible = !!state.aim && !state.modal;
    if (state.aim) this.aimMarker.position.set(state.aim.x, .085, state.aim.y);
    this.placementLine.visible = !!state.armed && !!state.drag;
    if (this.placementLine.visible) {
      const a = state.drag.start, end = state.aim || a, d = distance(a, end) || 1, length = Math.min(d, 8);
      const b = { x: a.x + (end.x - a.x) / d * length, y: a.y + (end.y - a.y) / d * length };
      const positions = this.placementLine.geometry.attributes.position; positions.setXYZ(0, a.x, .09, a.y); positions.setXYZ(1, b.x, .09, b.y); positions.needsUpdate = true; this.placementLine.computeLineDistances();
      const count = Math.min(game.allies.length, Math.max(1, Math.ceil(length / .72)));
      for (let i = 0; i < count; i++) { const mesh = this.poolPlane(this.formationMarkers, i, true), u = count === 1 ? .5 : i / (count - 1); mesh.position.set(a.x + (b.x - a.x) * u, .09, a.y + (b.y - a.y) * u); mesh.scale.setScalar(.32); mesh.material.color.set('#f1d295'); mesh.material.opacity = .8; }
    }
    const matrix = this.matrixObject;
    this.sparks.count = Math.min(state.particles.length, 350);
    for (let i = 0; i < this.sparks.count; i++) { const p = state.particles[i]; matrix.position.set(p.x, .15 + p.z * .025, p.y); matrix.rotation.set(p.life * 3, p.x, p.y); matrix.scale.setScalar(.025 + Math.max(0, p.life) * .025); matrix.updateMatrix(); this.sparks.setMatrixAt(i, matrix.matrix); this.sparks.setColorAt(i, this.color.set(p.color)); }
    this.sparks.instanceMatrix.needsUpdate = true; if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
    this.bolts.count = Math.min(game.projectiles.length, 350);
    for (let i = 0; i < this.bolts.count; i++) { const shot = game.projectiles[i]; matrix.position.set(shot.x, .72, shot.y); matrix.rotation.set(0, Math.atan2(shot.vx, shot.vy), 0); matrix.scale.set(.045, .045, .12); matrix.updateMatrix(); this.bolts.setMatrixAt(i, matrix.matrix); this.bolts.setColorAt(i, this.color.set(shot.team === 'hostile' ? '#ffc483' : shot.team === 'ally' ? '#a5e9cf' : '#ffe0a3')); }
    this.bolts.instanceMatrix.needsUpdate = true; if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
    const target = game.sway && game.entities.find(e => e.id === game.sway.targetId);
    this.tether.visible = !!target; for (const bead of this.tetherBeads) bead.visible = !!target;
    if (target) {
      const a = new THREE.Vector3(game.player.x, 1.25, game.player.y), b = new THREE.Vector3(target.x, TYPES[target.type].flying ? 1.4 : .8, target.y);
      this.tether.material.color.set(game.sway.state === 'broken' ? '#e8b57b' : '#a4f4d8');
      for (let i = 0; i < 65; i++) { const u = i / 64; this.tetherPositions[i * 3] = a.x + (b.x - a.x) * u; this.tetherPositions[i * 3 + 1] = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * .45 + Math.sin(u * 18 + t * 5) * .035; this.tetherPositions[i * 3 + 2] = a.z + (b.z - a.z) * u; }
      this.tetherGeometry.attributes.position.needsUpdate = true;
      this.tetherBeads.forEach((bead, i) => { const u = (t * .6 + i / 8) % 1; bead.position.lerpVectors(a, b, u); bead.position.y += Math.sin(u * Math.PI) * .45; });
    }
  }
  updatePickups(game, time) {
    const signature = game.pickups.map(p => `${p.x}:${p.y}`).join('|');
    if (signature !== this.lastPickups) {
      this.lastPickups = signature; this.pickupGroup.clear();
      for (const p of game.pickups) {
        const group = new THREE.Group(); group.position.set(p.x, .12, p.y); this.pickupGroup.add(group);
        for (let i = 0; i < 4; i++) part(group, GEO.cylinder, this.gold, [Math.sin(i * 4) * .12, i * .017, Math.cos(i * 4) * .1], [.09, .025, .09]);
        const gem = part(group, GEO.gem, material('#eac87c', { emissive: '#b07823', emissiveIntensity: .6 }), [0, .33, 0], [.05, .09, .05]); group.userData.gem = gem;
      }
    }
    this.pickupGroup.children.forEach((g, i) => { g.userData.gem.position.y = .33 + Math.sin(time * 3 + i) * .08; g.userData.gem.rotation.y = time * .7; });
  }
  render(game, state) {
    if (this.gameSeed !== game.seed) { for (const id of [...this.models.keys()]) this.removeModel(id); this.gameSeed = game.seed; }
    if (`${game.seed}:${game.floor}` !== this.floorKey) this.buildFloor(game);
    const dt = state.dt, t = state.time;
    const destination = state.intro ? new THREE.Vector3(3, .1, 10.1) : new THREE.Vector3(game.player.x, .1, game.player.y);
    if (this.floorChanged || state.snap) this.focus.copy(destination);
    this.focus.lerp(destination, 1 - Math.exp(-dt * 5));
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 7));
    const zoom = this.zoom * (this.width < 650 ? 1.03 : 1), horizontal = zoom * .78;
    this.camera.position.set(this.focus.x + Math.sin(this.azimuth) * horizontal, zoom * .86, this.focus.z + Math.cos(this.azimuth) * horizontal);
    if (this.impact > 0 && !state.reduced) { this.camera.position.x += Math.sin(t * 83) * this.impact; this.camera.position.z += Math.cos(t * 91) * this.impact; }
    this.impact = Math.max(0, (this.impact || 0) - dt * .8);
    this.camera.lookAt(this.focus.x, .1, this.focus.z);
    this.camera.updateMatrixWorld();
    this.sun.position.set(this.focus.x - 4, 13, this.focus.z - 5); this.sun.target.position.copy(this.focus); this.sun.target.updateMatrixWorld();
    this.lanternLight.position.set(game.player.x, 1.5, game.player.y);
    const nearest = this.torches.slice().sort((a, b) => Math.hypot(a.x - this.focus.x, a.z - this.focus.z) - Math.hypot(b.x - this.focus.x, b.z - this.focus.z));
    this.torchLights.forEach((light, i) => { const torch = nearest[i]; light.position.set(torch.x, 1.5, torch.z); light.intensity = state.reduced ? 17 : 17 + Math.sin(t * 8 + i) * 1.2; });
    for (const torch of this.torches) { torch.outer.scale.y = state.reduced ? .27 : .25 + Math.sin(t * 9 + torch.phase) * .035; torch.core.rotation.z = Math.sin(t * 7 + torch.phase) * .1; }
    animateCharacter(this.hero, game.player, t, dt, !!game.sway, state.reduced);
    this.heroShadow.position.set(game.player.x, .055, game.player.y);
    const live = new Set(game.entities.map(e => e.id));
    for (const id of [...this.models.keys()]) if (!live.has(id)) this.removeModel(id);
    this.pickable = [];
    for (const e of game.entities) {
      const model = this.ensureModel(e), ready = game.eligible(e), selected = game.selectedId === e.id;
      animateCharacter(model.root, e, t, dt, false, state.reduced);
      model.shadow.position.set(e.x, .052, e.y);
      model.ring.position.set(e.x, .065, e.y); model.ring.visible = e.team === 'ally' || ready || selected;
      model.ring.material.color.set(e.team === 'ally' ? '#85bca5' : ready ? '#bbe6b6' : '#eac48b'); model.ring.material.opacity = selected || ready ? .8 : .32;
      model.gem.visible = ready; model.gem.position.set(e.x, (TYPES[e.type].flying ? 1.7 : 1.3) * model.size + Math.sin(t * 3) * .06, e.y); model.gem.rotation.y = t;
      model.root.visible = distance(e, game.player) < 18 || state.intro;
      if (e.team === 'hostile' && model.root.visible) this.pickable.push(model.root);
    }
    this.portal.material.uniforms.time.value = t; this.portal.material.uniforms.open.value = game.clearRooms.every(Boolean) ? 1 : 0;
    this.gateGlow.intensity = game.clearRooms.every(Boolean) ? 12 : 0;
    this.shrineGem.visible = !game.claimed; this.shrineGem.position.y = 1.25 + Math.sin(t * 2) * .09; this.shrineGem.rotation.y = t * .4;
    this.seal.material.emissive.set(game.plateActive ? '#67b9a0' : '#000000'); this.seal.material.emissiveIntensity = .5;
    this.dust.visible = !state.reduced; this.dust.rotation.y = Math.sin(t * .04) * .002;
    this.updatePickups(game, t); this.updateEffects(game, state);
    this.renderer.render(this.scene, this.camera); this.drawLabels(game, state);
  }
  drawLabels(game, state) {
    const ctx = this.ctx, ratio = this.dpr;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    for (const e of game.entities) {
      if (e.team === 'ally' || !e.awake || distance(e, game.player) > 10) continue;
      const ready = game.eligible(e), selected = game.selectedId === e.id;
      if (!ready && !selected && e.hp >= e.maxHp) continue;
      const p = this.project(e.x, e.y, (TYPES[e.type].flying ? 1.85 : 1.45) * (e.elite ? 1.3 : 1)); if (!p.visible) continue;
      const width = selected ? 48 : 34;
      ctx.fillStyle = '#101818dc'; ctx.fillRect(p.x - width / 2 - 1, p.y - 1, width + 2, 5);
      ctx.fillStyle = ready ? '#b7d2a0' : '#b0583f'; ctx.fillRect(p.x - width / 2, p.y, width * e.hp / e.maxHp, 3);
      if (ready) { ctx.font = '10px Georgia'; ctx.fillStyle = '#e4edbb'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3; ctx.fillText('◇ SWAY', p.x, p.y - 8); ctx.shadowBlur = 0; }
    }
    for (const f of state.floating) { const p = this.project(f.x, f.y, 1.15 + (1 - f.life / .7) * .45); if (!p.visible) continue; ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = 'bold 13px Georgia'; ctx.fillStyle = f.color; ctx.shadowColor = '#111'; ctx.shadowBlur = 3; ctx.fillText(f.text, p.x, p.y); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const p of game.pickups) if (distance(p, game.player) < 6) { const screen = this.project(p.x, p.y, .48); if (!screen.visible) continue; ctx.font = '10px Georgia'; ctx.fillStyle = '#ead29b'; ctx.shadowColor = '#181a12'; ctx.shadowBlur = 2; ctx.fillText(`${p.value} sun shard${p.value > 1 ? 's' : ''}`, screen.x, screen.y - 10); }
    ctx.shadowBlur = 0;
  }
}
