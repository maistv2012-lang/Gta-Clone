import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cathedralSpawn } from '../js/christchurch-spawn.js';
import { buildNetwork, findRoute, nearestEdge, polygonContact } from '../js/road-network.js';
import { syntheticMap } from './fixtures/christchurch-synthetic.mjs';
const data = JSON.parse(await readFile(new URL('../data/christchurch.json', import.meta.url)));
const network = buildNetwork(data.roads, { walking: true });
const colliders = data.areas.filter(a => a.tags.building).map(a => ({ polygon: a.points }));
const start = cathedralSpawn(data, network, colliders);
test('real default spawn is inside Cathedral Square approach, clear of buildings', () => {
  assert.ok(start.distance < 60);
  assert.equal(start.edge.name, 'Cathedral Square');
  assert.ok(!colliders.some(c => polygonContact(start.x, start.z, c.polygon, 3)));
  assert.ok(Math.hypot(start.x - 3612, start.z - 3612) > 5000);
});
test('spawn lies on a rendered pedestrian surface or sidewalk', () => {
  const near = nearestEdge({ edges: [start.edge] }, [start.x, start.z]);
  const limit = start.edge.walking ? start.edge.width / 2 : start.edge.width / 2 + 1.5;
  assert.ok(near.distance < limit);
  assert.ok(start.edge.walking || near.distance > start.edge.width / 2);
});
test('spawn walking graph connects to Colombo Street and Hagley Park', () => {
  for (const name of ['Colombo Street', 'Hagley Park North', 'Hagley Park South']) {
    const landmark = data.landmarks.find(p => p.name === name);
    const target = nearestEdge(network, landmark.point);
    assert.ok(findRoute(network, start.edge.to, target.edge.from), name);
  }
});
test('nearby legal driving graph reaches Colombo Street in both directions', () => {
  const driving = buildNetwork(data.roads);
  const from = nearestEdge(driving, [start.x, start.z]);
  const target = nearestEdge({ edges: driving.edges.filter(e => e.name === 'Colombo Street') }, [start.x, start.z]);
  assert.ok(from.distance < 20 && target.distance < 100);
  assert.ok(findRoute(driving, from.edge.to, target.edge.from));
  assert.ok(findRoute(driving, target.edge.to, from.edge.from));
});
test('blocked or absent Cathedral Square fails explicitly instead of spawning in Arcade', () => {
  assert.throws(() => cathedralSpawn(data, network, [{ x0: -100, x1: 150, z0: -150, z1: 100 }]), /ponto inicial/);
  assert.throws(() => cathedralSpawn({ ...data, roads: [] }, network, []), /não está presente/);
});
test('synthetic integration fixture retains a valid explicit Square spawn', () => {
  const point = cathedralSpawn(syntheticMap, buildNetwork(syntheticMap.roads, { walking: true }), []);
  assert.ok(point.distance < 60);
});
