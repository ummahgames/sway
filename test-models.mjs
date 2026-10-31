import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.min.js';
import { createCharacter, animateCharacter } from './models3d.js';

for (const type of ['player', 'jackal', 'cinder', 'horn', 'cloud', 'djinn', 'phoenix', 'drake']) {
  const model = createCharacter(type);
  const entity = { id: 1, type, x: 3, y: 5, facingX: 1, facingY: 0, team: 'hostile', mode: 'follow', attackCd: .5 };
  animateCharacter(model, entity, 1, 1 / 60);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  assert([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite));
  assert(bounds.max.y - bounds.min.y > .3, `${type}: model needs real height`);
  assert(bounds.max.x - bounds.min.x > .15 && bounds.max.z - bounds.min.z > .15, `${type}: model must occupy three dimensions`);
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const attribute of Object.values(mesh.geometry.attributes)) assert([...attribute.array].every(Number.isFinite), `${type}: invalid mesh data`);
  });
  entity.mode = 'anchor'; entity.order = { x: entity.x, y: entity.y };
  animateCharacter(model, entity, 2, 1 / 60);
  model.traverse(mesh => { if (mesh.isMesh) assert.notEqual(mesh.material, mesh.userData.originalMaterial, `${type}: statue appearance missing`); });
  entity.mode = 'follow'; entity.team = 'ally'; entity.x += .1;
  animateCharacter(model, entity, 3, 1 / 60, true);
  model.traverse(mesh => { if (mesh.isMesh) assert.equal(mesh.material, mesh.userData.originalMaterial, `${type}: failed to release statue`); });
  assert.equal(model.userData.rig.eyeMaterial.color.getHexString(), '9de5cc');
  console.log(`✓ ${type}: finite 3D geometry, animated rig, statue transformation, allegiance color`);
  for (const geometry of model.userData.privateGeometries) geometry.dispose();
  model.userData.rig.eyeMaterial.dispose();
}
console.log('\n8 model checks passed. These validate assets; GPU/browser checks are separate.');
