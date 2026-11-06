import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { qualityProfile, targetFrameRate } from '../js/visual-quality.js';
import { demonstrationAreas, boundsOf, facadeLevels } from '../js/city-detailing.js';
import { createChaseCameraClip } from '../js/chase-camera.js';
import { initWeb, fireWeb } from '../js/web.js';
const map = JSON.parse(await readFile(new URL('../data/christchurch.json', import.meta.url)));
test('quality defaults are conservative for touch and retain old lowGfx saves', () => {
  assert.equal(qualityProfile({}, true).name, 'medium');
  assert.equal(qualityProfile({}, false).name, 'high');
  assert.equal(qualityProfile({ quality: 'high', lowGfx: true }).name, 'low');
  assert.equal(qualityProfile({ quality: 'invalid' }, true).name, 'medium');
  assert.ok(qualityProfile({ quality: 'low' }).near < qualityProfile({ quality: 'high' }).near);
});
test('30 and 60 FPS are targets with validated fallback, independent of simulation', () => {
  assert.equal(targetFrameRate({}, true), 30);
  assert.equal(targetFrameRate({}, false), 60);
  assert.equal(targetFrameRate({ fps: 60 }, true), 60);
  assert.equal(targetFrameRate({ fps: 30 }), 30);
  assert.equal(targetFrameRate({ fps: 0 }, true), 30);
});
test('demonstration is bounded to actual OSM buildings and contains Cathedral/library', () => {
  const original = JSON.stringify(map);
  const areas = demonstrationAreas(map);
  assert.ok(areas.length <= 24);
  assert.ok(areas.some((a) => a.id === 30366472));
  assert.ok(areas.some((a) => /Tūranga/.test(a.tags.name || '')));
  assert.deepEqual(boundsOf(areas.find((a) => a.id === 30366472)), {
    x0: 4.68,
    x1: 73.53,
    z0: -5.5,
    z1: 32.14,
  });
  assert.equal(JSON.stringify(map), original, 'visual selection must not mutate source geography');
});
test('chase camera stops in front of a nearby wall, without changing player coordinates', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, -5);
  const target = new THREE.Vector3(0, 1.5, 0),
    before = target.clone();
  const clip = createChaseCameraClip({ colliders: [{ x0: -2, x1: 2, z0: -3, z1: -2, h: 4 }] });
  clip(camera, target);
  assert.ok(camera.position.z > -2);
  assert.ok(target.equals(before));
});
test('unobstructed chase view remains unchanged', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, -5);
  const before = camera.position.clone();
  createChaseCameraClip({ colliders: [] })(camera, new THREE.Vector3(0, 1.5, 0));
  assert.ok(camera.position.equals(before));
});

test('swing audit setup needs a wide facade to intercept all side rays', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2.1, -17.6);
  camera.lookAt(0, 1.55, -12);
  const target = { pos: new THREE.Vector3(0, 0, -12) },
    anchors = [];
  for (const width of [4, 10]) {
    const web = initWeb(new THREE.Scene());
    assert.ok(
      fireWeb(web, target, camera, [
        { x0: -width, x1: width, z0: 0, z1: 10, h: 42 },
        { x0: 10, x1: 30, z0: 40, z1: 60, h: 24 },
      ])
    );
    anchors.push(web.anchor.z);
  }
  assert.equal(anchors[0], 40, 'narrow facade side rays can select the farther building');
  assert.equal(anchors[1], 0, 'wide facade makes the swing fixture target unambiguous');
});

test('facade storeys use source levels when available rather than inventing extra floors', () => {
  const hotel = map.areas.find(a => a.id === 92832065);
  assert.equal(facadeLevels(hotel), 12);
  assert.equal(facadeLevels({height: 14, tags: {}}), 4);
});
