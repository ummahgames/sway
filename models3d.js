/* Original, articulated models. All geometry and surface detail are generated locally. */
import * as THREE from './vendor/three.module.min.js';

const geometries = new Map(), materials = new Map();
const geometry = (key, make) => { if (!geometries.has(key)) geometries.set(key, make()); return geometries.get(key); };
export const GEO = {
  sphere: geometry('sphere', () => new THREE.SphereGeometry(1, 16, 12)),
  lowSphere: geometry('lowSphere', () => new THREE.SphereGeometry(1, 10, 8)),
  box: geometry('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cone: geometry('cone', () => new THREE.ConeGeometry(1, 1, 10)),
  cylinder: geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 12)),
  gem: geometry('gem', () => new THREE.OctahedronGeometry(1)),
  ring: geometry('ring', () => new THREE.TorusGeometry(1, .045, 5, 48))
};
export function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .83, ...options }));
  return materials.get(key);
}
export function part(parent, geo, mat, position, size = [1, 1, 1], rotation = null) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position); mesh.scale.set(...size);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
const ball = (p, mat, pos, size) => part(p, GEO.sphere, mat, pos, size);
const box = (p, mat, pos, size, rot) => part(p, GEO.box, mat, pos, size, rot);
const cone = (p, mat, pos, size, rot) => part(p, GEO.cone, mat, pos, size, rot);
const cylinder = (p, mat, pos, size, rot) => part(p, GEO.cylinder, mat, pos, size, rot);
function curveTube(points, radius = .05, segments = 12) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false); }
function limb(parent, mat, x, y, z, length, radius = .095, bootMat = mat) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  ball(pivot, mat, [0, -length * .35, 0], [radius, length * .55, radius]);
  ball(pivot, bootMat, [0, -length + .05, .045], [radius * 1.12, .09, radius * 1.55]);
  return pivot;
}
function eyePair(parent, mat, z, y, spread = .12, size = .027) {
  for (const x of [-spread, spread]) ball(parent, mat, [x, y, z], [size, size * .8, size * .7]);
}
function wing(parent, mat, side, origin, length = 1, width = .6) {
  const pivot = new THREE.Group(); pivot.position.set(...origin); parent.add(pivot);
  const vertices = new Float32Array([0, 0, 0, side * length * .7, .34, -width * .25, side * length, .08, -width, side * length * .52, -.04, -width * .5, side * length * .33, -.08, -width * .93, 0, 0, -width * .5]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geo.setIndex([0, 1, 3, 1, 2, 3, 3, 2, 4, 0, 3, 5, 3, 4, 5]); geo.computeVertexNormals();
  part(pivot, geo, mat, [0, 0, 0]);
  return pivot;
}
function mane(parent, mat, y, z, count = 7) {
  for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2; cone(parent, mat, [Math.cos(a) * .21, y + Math.sin(a) * .2, z], [.07, .22, .065], [0, 0, a - Math.PI / 2]); }
}
function optimizeModel(root, rig, eye) {
  // Bake surface colors into static body pieces; retain the independently moving rig.
  // This keeps a large procession from issuing one draw call per armor rivet.
  root.updateMatrixWorld(true);
  const protectedObjects = new Set([rig.body, rig.head, rig.rightArm, rig.leftArm, ...rig.legs, ...rig.wings, ...rig.tails, ...rig.glow].filter(Boolean));
  const skin = material('#ffffff', { vertexColors: true, roughness: .82, metalness: .08, side: THREE.DoubleSide });
  const parents = [rig.body, rig.head, rig.rightArm, rig.leftArm, ...rig.legs, ...rig.wings].filter(Boolean);
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), transform = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  for (const parent of parents) {
    const meshes = [];
    const visit = object => {
      for (const child of object.children) {
        if (protectedObjects.has(child)) continue;
        if (child.isMesh && !child.children.length && child.material !== eye && (!child.material.emissive || child.material.emissive.getHex() === 0)) meshes.push(child);
        else visit(child);
      }
    };
    visit(parent); if (meshes.length < 2) continue;
    const positions = [], normals = [], colors = [], inverse = parent.matrixWorld.clone().invert();
    for (const mesh of meshes) {
      transform.multiplyMatrices(inverse, mesh.matrixWorld); normalMatrix.getNormalMatrix(transform);
      const geo = mesh.geometry, pos = geo.attributes.position, norm = geo.attributes.normal, count = geo.index ? geo.index.count : pos.count, color = mesh.material.color;
      for (let i = 0; i < count; i++) {
        const index = geo.index ? geo.index.getX(i) : i;
        point.fromBufferAttribute(pos, index).applyMatrix4(transform); normal.fromBufferAttribute(norm, index).applyMatrix3(normalMatrix).normalize();
        positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); colors.push(color.r, color.g, color.b);
      }
      mesh.removeFromParent();
      if (![...geometries.values()].includes(geo)) geo.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeBoundingSphere();
    part(parent, geo, skin, [0, 0, 0]);
  }
}

export function createCharacter(type) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rig = { body, legs: [], wings: [], tails: [], glow: [], baseY: 0, type };
  const eye = new THREE.MeshStandardMaterial({ color: '#ffcd74', emissive: '#ffb856', emissiveIntensity: 1.8, roughness: .3 });
  rig.eyeMaterial = eye;
  const gold = material('#c49c50', { metalness: .55, roughness: .43 });
  const dark = material('#282b2b'), bone = material('#d9c89b');

  if (type === 'player') {
    const cloth = material('#334d52'), trim = material('#a7b6a0'), leather = material('#4d3429'), skin = material('#a37c53');
    rig.legs.push(limb(body, leather, -.12, .56, 0, .5, .09), limb(body, leather, .12, .56, 0, .5, .09));
    const robeGeo = geometry('robe', () => new THREE.CylinderGeometry(.23, .35, .66, 12));
    part(body, robeGeo, cloth, [0, .68, 0]);
    const hem = geometry('hem', () => new THREE.CylinderGeometry(.345, .36, .065, 12));
    part(body, hem, gold, [0, .37, 0]);
    ball(body, cloth, [0, 1.02, 0], [.265, .22, .18]);
    cylinder(body, leather, [0, .8, 0], [.254, .09, .185]);
    box(body, gold, [0, .8, .194], [.13, .1, .035]);
    box(body, trim, [-.1, 1.01, .17], [.13, .37, .035], [0, 0, -.3]);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group(); shoulder.position.set(side * .25, 1.05, 0); body.add(shoulder);
      ball(shoulder, gold, [side * .035, 0, 0], [.12, .095, .13]);
      ball(shoulder, cloth, [side * .03, -.18, .015], [.09, .23, .095]);
      ball(shoulder, skin, [side * .04, -.35, .04], [.075, .08, .075]);
      rig[side === 1 ? 'rightArm' : 'leftArm'] = shoulder;
    }
    const head = new THREE.Group(); head.position.set(0, 1.37, 0); body.add(head); rig.head = head;
    ball(head, skin, [0, 0, .01], [.17, .2, .16]);
    ball(head, material('#c1b290'), [0, .11, -.015], [.215, .15, .195]);
    for (let i = 0; i < 3; i++) {
      const band = part(head, GEO.ring, i === 1 ? gold : material('#ddd1ae'), [0, .09 + i * .045, 0], [.2, .2, .2], [Math.PI / 2, 0, -.15]);
      band.scale.z = .85;
    }
    ball(head, material('#263b3d'), [0, -.06, .12], [.175, .1, .08]);
    eyePair(head, eye, .168, .035, .062, .015);
    box(head, material('#a8b19c'), [-.16, -.12, -.04], [.11, .4, .04], [0, .2, -.13]);
    const staff = new THREE.Group(); staff.position.set(.06, -.24, .04); rig.rightArm.add(staff);
    cylinder(staff, leather, [0, .08, 0], [.035, 1.3, .035]);
    part(staff, GEO.ring, gold, [0, .77, 0], [.14, .19, .14]);
    const crystal = part(staff, GEO.gem, material('#8bdfd0', { emissive: '#5ac6b6', emissiveIntensity: 2.5, roughness: .25 }), [0, .77, 0], [.075, .12, .075]); rig.glow.push(crystal);
    cone(staff, gold, [0, .57, 0], [.07, .1, .07]);
    const book = box(body, leather, [-.26, .71, -.02], [.13, .22, .16], [0, 0, -.1]);
    box(book, gold, [0, 0, .51], [1.04, .12, .04]);
    const cloakGeo = new THREE.ConeGeometry(.36, .86, 9, 1, true, Math.PI * .5, Math.PI);
    const cloak = part(body, cloakGeo, material('#2b4046', { side: THREE.DoubleSide }), [0, .76, -.08], [1, 1, .7]); rig.cloak = cloak;
  } else if (type === 'jackal') {
    const fur = material('#80654c'), light = material('#ad8d61'), black = material('#3c3531');
    ball(body, fur, [0, .48, -.03], [.23, .25, .48]);
    ball(body, light, [0, .54, .22], [.22, .26, .23]);
    for (const x of [-.17, .17]) for (const z of [-.29, .26]) rig.legs.push(limb(body, fur, x, .4, z, .35, .058, black));
    const head = new THREE.Group(); head.position.set(0, .73, .35); body.add(head); rig.head = head;
    ball(head, light, [0, 0, 0], [.18, .19, .22]);
    ball(head, fur, [0, -.035, .23], [.11, .085, .21]);
    ball(head, black, [0, -.01, .4], [.065, .05, .04]);
    for (const x of [-.12, .12]) { cone(head, fur, [x, .23, -.055], [.09, .35, .075], [0, 0, -x * 2]); cone(head, light, [x, .245, -.03], [.045, .22, .03]); }
    eyePair(head, eye, .17, .06, .12, .022);
    const tailGeo = curveTube([[0, .5, -.4], [0, .57, -.73], [.14, .8, -.9], [.2, .9, -.8]], .07);
    rig.tails.push(part(body, tailGeo, fur, [0, 0, 0]));
    const collar = part(body, GEO.ring, gold, [0, .59, .28], [.22, .22, .22]); collar.rotation.x = .1;
    for (let i = 0; i < 4; i++) box(body, gold, [(i % 2 ? 1 : -1) * .23, .53 + Math.floor(i / 2) * .08, -.03], [.022, .045, .22], [0, 0, .3]);
  } else if (type === 'cinder' || type === 'horn') {
    const horn = type === 'horn', hide = material(horn ? '#636a6a' : '#65513b');
    const plate = material(horn ? '#828985' : '#9a7846', { metalness: horn ? .12 : .5, roughness: .62 });
    const seam = material('#f0a15a', { emissive: '#e14f15', emissiveIntensity: 1.3 });
    ball(body, hide, [0, .51, -.05], [.4, .35, .58]);
    for (const x of [-.26, .26]) for (const z of [-.36, .29]) rig.legs.push(limb(body, hide, x, .43, z, .36, .12, dark));
    for (let i = 0; i < 4; i++) {
      const z = -.48 + i * .26;
      ball(body, plate, [0, .65, z], [.44 - Math.abs(i - 1.5) * .025, .24, .17]);
      if (!horn) { const fire = cone(body, seam, [0, .98, z], [.075, .36 + (i % 2) * .16, .075], [.15, 0, 0]); rig.glow.push(fire); }
      for (const x of [-.4, .4]) ball(body, gold, [x, .63, z], [.025, .025, .025]);
    }
    const head = new THREE.Group(); head.position.set(0, .54, .5); body.add(head); rig.head = head;
    ball(head, hide, [0, 0, .05], [.29, .23, .35]);
    ball(head, plate, [0, .13, -.02], [.33, .14, .28]);
    ball(head, hide, [0, -.05, .29], [.26, .14, .18]);
    eyePair(head, eye, .24, .08, .245, .028);
    for (const x of [-.22, .22]) cone(head, plate, [x, .26, -.07], [.09, .18, .06], [0, 0, -x * 1.3]);
    if (horn) { cone(head, bone, [0, .25, .38], [.13, .62, .15], [.4, 0, 0]); cone(head, bone, [0, .24, .04], [.075, .24, .075], [.2, 0, 0]); }
    else { for (const x of [-.15, .15]) cone(head, bone, [x, -.01, .34], [.05, .15, .05], [Math.PI, 0, x]); }
    rig.tails.push(part(body, curveTube([[0, .55, -.6], [0, .6, -.85], [.12, .68, -.9]], .055), hide, [0, 0, 0]));
  } else if (type === 'cloud') {
    rig.baseY = .7;
    const vapor = material('#a2b5c4', { roughness: .98 }), shade = material('#788d9e', { roughness: .98 });
    for (const [x, y, z, s] of [[-.22, 0, 0, .25], [.14, .12, -.03, .29], [.28, -.05, .02, .22], [0, -.09, .12, .27], [-.1, .19, -.12, .22]]) ball(body, x < 0 ? shade : vapor, [x, .55 + y, z], [s, s * .8, s]);
    eyePair(body, eye, .34, .57, .1, .035);
    const electric = material('#c5e6fa', { emissive: '#57b6ef', emissiveIntensity: 2 });
    for (const side of [-1, 1]) { const bolt = part(body, curveTube([[side * .13, .3, .06], [side * .24, .13, .06], [side * .14, .13, .06], [side * .24, -.07, .06]], .018), electric, [0, 0, 0]); rig.glow.push(bolt); }
    for (let i = 0; i < 3; i++) { const ring = part(body, GEO.ring, material('#81c1d4', { emissive: '#427989', emissiveIntensity: .4 }), [0, .1 - i * .08, 0], [.24 - i * .05, .24 - i * .05, .24 - i * .05], [Math.PI / 2, 0, i]); rig.tails.push(ring); }
  } else if (type === 'djinn') {
    rig.baseY = .55;
    const cloth = material('#385761'), smoke = material('#6e989a', { transparent: true, opacity: .76 }), jewel = material('#c2caa0', { metalness: .6 });
    const tail = part(body, new THREE.CylinderGeometry(.2, .015, .75, 12), smoke, [0, .3, -.05], [1, 1, 1], [0, 0, -.16]); rig.tails.push(tail);
    ball(body, cloth, [0, .86, 0], [.3, .32, .2]);
    cylinder(body, gold, [0, .65, 0], [.25, .1, .2]);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .27, 1.04, 0); body.add(arm);
      ball(arm, cloth, [side * .08, -.15, .02], [.12, .24, .12]); cylinder(arm, gold, [side * .08, -.23, .02], [.13, .065, .13]);
      ball(arm, smoke, [side * .1, -.4, .1], [.09, .13, .09]);
      rig[side > 0 ? 'rightArm' : 'leftArm'] = arm;
    }
    const head = new THREE.Group(); head.position.set(0, 1.25, 0); body.add(head); rig.head = head;
    ball(head, dark, [0, 0, 0], [.17, .22, .16]);
    ball(head, jewel, [0, .15, -.025], [.24, .15, .19]);
    cone(head, jewel, [0, .34, -.03], [.11, .3, .11], [0, 0, -.2]);
    ball(head, cloth, [0, -.06, .13], [.18, .13, .05]); eyePair(head, eye, .163, .055, .065, .02);
    for (let i = 0; i < 3; i++) { const ring = part(body, GEO.ring, gold, [0, .14 + i * .12, 0], [.28 + i * .045, .28 + i * .045, .28 + i * .045], [Math.PI / 2 + i * .12, 0, i * .5]); rig.tails.push(ring); }
  } else if (type === 'phoenix') {
    rig.baseY = .85;
    const feather = material('#b06435', { roughness: .65 }), goldFeather = material('#dc9d46', { roughness: .6, emissive: '#6f2907', emissiveIntensity: .3 });
    ball(body, feather, [0, .45, 0], [.18, .24, .4]);
    ball(body, goldFeather, [0, .66, .31], [.14, .2, .14]);
    cone(body, bone, [0, .66, .49], [.07, .23, .07], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) {
      const w = wing(body, material('#ce8d45', { side: THREE.DoubleSide, roughness: .7 }), side, [side * .1, .56, 0], .95, .62); rig.wings.push(w);
      for (let i = 0; i < 6; i++) {
        const featherMesh = ball(w, i % 2 ? goldFeather : feather, [side * (.26 + i * .115), .04, -.2 - i * .075], [.07, .035, .3 - i * .015]); featherMesh.rotation.y = -side * .32;
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .09;
      const tail = part(body, curveTube([[x, .44, -.3], [x * 2, .22, -.7], [x * 3, .1, -1.08]], .04), i % 2 ? goldFeather : feather, [0, 0, 0]); rig.tails.push(tail);
    }
    mane(body, goldFeather, .83, .22, 5); eyePair(body, eye, .38, .72, .095, .024);
  } else if (type === 'drake') {
    const hide = material('#647966'), scales = material('#86927b'), membrane = material('#755c42', { side: THREE.DoubleSide, roughness: .95 });
    ball(body, hide, [0, .62, -.05], [.42, .32, .65]);
    for (const x of [-.28, .28]) for (const z of [-.35, .35]) rig.legs.push(limb(body, hide, x, .5, z, .42, .12, bone));
    const head = new THREE.Group(); head.position.set(0, .76, .56); body.add(head); rig.head = head;
    ball(head, scales, [0, .03, .1], [.25, .21, .35]); ball(head, hide, [0, -.05, .35], [.21, .12, .22]);
    for (const side of [-1, 1]) { cone(head, bone, [side * .19, .28, -.07], [.06, .37, .07], [-.4, 0, -side * .4]); const w = wing(body, membrane, side, [side * .24, .85, -.05], 1, .8); rig.wings.push(w); }
    eyePair(head, eye, .32, .12, .2, .027);
    for (let i = 0; i < 6; i++) cone(body, bone, [0, .96, .25 - i * .18], [.055, .22, .085], [-.2, 0, 0]);
    rig.tails.push(part(body, curveTube([[0, .6, -.6], [.1, .45, -1], [.4, .3, -1.35], [.55, .34, -1.5]], .08, 16), hide, [0, 0, 0]));
  }
  optimizeModel(root, rig, eye);
  root.userData.rig = rig;
  root.userData.privateGeometries = new Set();
  root.traverse(object => { if (object.isMesh && ![...geometries.values()].includes(object.geometry)) root.userData.privateGeometries.add(object.geometry); });
  root.traverse(object => { if (object.isMesh) object.userData.originalMaterial = object.material; });
  return root;
}

export function animateCharacter(root, entity, time, dt, channeling = false, reduced = false) {
  const rig = root.userData.rig;
  const previous = root.userData.previous || { x: entity.x, y: entity.y };
  const speed = Math.hypot(entity.x - previous.x, entity.y - previous.y) / Math.max(dt, .001);
  root.userData.previous = { x: entity.x, y: entity.y };
  const anchored = entity.mode === 'anchor' && entity.order && Math.hypot(entity.x - entity.order.x, entity.y - entity.order.y) < .3;
  const desiredAngle = Math.atan2(entity.facingX || 0, entity.facingY || 1);
  let angle = desiredAngle - root.rotation.y; angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  root.rotation.y += angle * Math.min(1, dt * 13);
  const walking = !anchored && speed > .12;
  const phase = time * (rig.type === 'player' ? 11 : 9) + (entity.id || 0) * 1.3;
  for (let i = 0; i < rig.legs.length; i++) rig.legs[i].rotation.x = walking ? Math.sin(phase + (i % 3 ? Math.PI : 0)) * .55 : 0;
  rig.body.position.y = anchored ? 0 : walking ? Math.abs(Math.sin(phase)) * .035 : reduced ? 0 : Math.sin(time * 2 + (entity.id || 0)) * .012;
  root.position.set(entity.x, rig.baseY + (!anchored && rig.baseY && !reduced ? Math.sin(time * 2.4 + (entity.id || 0)) * .08 : 0), entity.y);
  for (let i = 0; i < rig.wings.length; i++) rig.wings[i].rotation.z = anchored ? 0 : Math.sin(time * 5 + (entity.id || 0)) * (i ? -1 : 1) * .3;
  for (let i = 0; i < rig.tails.length; i++) if (!anchored) rig.tails[i].rotation.y = Math.sin(time * 2.7 + i) * .09;
  for (let i = 0; i < rig.glow.length; i++) if (!anchored) rig.glow[i].scale.y = rig.type === 'cinder' ? .35 + Math.sin(time * 8 + i) * .08 : rig.glow[i].scale.y;
  if (rig.rightArm) rig.rightArm.rotation.x = channeling ? -1.1 : entity.attackCd > .4 ? -.4 : walking ? Math.sin(phase) * .22 : -.1;
  if (rig.leftArm) rig.leftArm.rotation.x = channeling ? -.9 : walking ? -Math.sin(phase) * .25 : -.12;
  if (rig.head) rig.head.rotation.x = entity.windup ? -.13 : channeling ? -.06 : 0;
  if (root.userData.anchored !== anchored) {
    root.userData.anchored = anchored;
    const stone = material('#89816d', { roughness: 1 });
    root.traverse(object => { if (object.isMesh) object.material = anchored ? stone : object.userData.originalMaterial; });
  }
  rig.eyeMaterial.color.set(entity.team === 'ally' ? '#9de5cc' : '#ffcd74');
  rig.eyeMaterial.emissive.set(entity.team === 'ally' ? '#50c6b0' : '#ffad52');
}
