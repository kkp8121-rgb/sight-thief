import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createThief, createLenskeeper, createRelic } from '../src/models.js';

test('each collectible owns its animated material and has a distinct geometric silhouette', () => {
  const relics = Array.from({ length: 6 }, (_, index) => createRelic(index));
  assert.equal(new Set(relics.map(relic => relic.userData.core.geometry.type)).size, 6);
  assert.equal(new Set(relics.map(relic => relic.userData.core.material)).size, 6);
  const untouched = relics[2].userData.core.material.opacity;
  relics[0].userData.core.material.opacity = .01;
  assert.equal(relics[2].userData.core.material.opacity, untouched);
  assert.ok(relics.every(relic => !relic.userData.core.material.userData.sharedMaterial));
});

test('the observed thief body stands on the floor in both standing and crouching poses', () => {
  const thief = createThief(), body = thief.userData.body;
  thief.remove(body); body.visible = true;
  for (const crouching of [false, true]) {
    body.scale.set(1, crouching ? .72 : 1, 1);
    body.position.set(0, crouching ? 1.03 : 1.43, 0);
    const bounds = new THREE.Box3().setFromObject(body);
    assert.ok(Math.abs(bounds.min.y) < .025, `floor alignment: ${bounds.min.y}`);
    assert.ok(bounds.max.y > (crouching ? 1.2 : 1.65));
  }
  assert.ok(body.children.length >= 10, 'body includes the head, sleeves, hands, torso and legs');
});

test('the Lenskeeper ruby eye occupies the front of the porcelain head', () => {
  const guard = createLenskeeper(), ruby = guard.children.find(mesh => mesh.material?.emissiveIntensity === 1.5);
  assert.ok(ruby && ruby.position.z < -.4);
  guard.rotation.y = -Math.PI / 2; guard.updateMatrixWorld(true);
  assert.ok(ruby.getWorldPosition(new THREE.Vector3()).x > .4, 'positive game yaw faces positive world X');
});
