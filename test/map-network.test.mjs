import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork, findRoute, leftOffset, permitsCars, polygonContact, project, ORIGIN } from '../js/road-network.js';
import { advanceTraffic, lane } from '../js/road-traffic.js';
import { prepare, validate } from '../scripts/prepare-christchurch.mjs';
import { syntheticMap } from './fixtures/christchurch-synthetic.mjs';

const road = (id, nodes, points, tags = {}) => ({ id, nodes, points, width: 10, tags: { highway: 'residential', ...tags } });
test('projection uses metres, east X and south Z', () => {
  assert.deepEqual(project(ORIGIN.lat, ORIGIN.lon), [0, -0]);
  assert.ok(project(ORIGIN.lat, ORIGIN.lon + 0.001)[0] > 80);
  assert.ok(project(ORIGIN.lat + 0.001, ORIGIN.lon)[1] < -110);
});
test('left lane is consistent in all four headings', () => {
  for (const b of [[10, 0], [-10, 0], [0, 10], [0, -10]]) {
    const off = leftOffset([0, 0], b, 2);
    assert.ok(off[0] * b[1] - off[1] * b[0] > 0);
    assert.equal(Math.hypot(...off), 2);
  }
});
test('oneway yes, reverse and roundabouts retain legal directed edges', () => {
  for (const tags of [{ oneway: 'yes' }, { junction: 'roundabout' }]) {
    const net = buildNetwork([road(1, [1, 2], [[0, 0], [10, 0]], tags)]);
    assert.equal(findRoute(net, 1, 2).length, 1);
    assert.equal(findRoute(net, 2, 1), null);
  }
  const net = buildNetwork([road(1, [1, 2], [[0, 0], [10, 0]], { oneway: '-1' })]);
  assert.equal(findRoute(net, 1, 2), null);
  assert.equal(findRoute(net, 2, 1).length, 1);
});
test('shared OSM nodes connect ways; geometric crossings do not invent junctions', () => {
  const net = buildNetwork([road(1, [1, 2], [[0, 0], [10, 0]]), road(2, [2, 3], [[10, 0], [10, 10]]),
    road(3, [4, 5], [[5, -5], [5, 5]])]);
  assert.equal(findRoute(net, 1, 3).length, 2);
  assert.equal(findRoute(net, 1, 5), null);
});
test('pedestrian streets and parks are walkable but not ordinary traffic routes', () => {
  const roads = [road(1, [1, 2], [[0, 0], [10, 0]], { highway: 'footway' })];
  assert.equal(buildNetwork(roads).edges.length, 0);
  assert.equal(buildNetwork(roads, { walking: true }).edges.length, 2);
  assert.equal(permitsCars({ highway: 'service', access: 'private' }), false);
  assert.equal(permitsCars({ highway: 'service', access: 'no', motor_vehicle: 'yes' }), true);
});
test('polygon collisions do not fill the empty corners of a diagonal building AABB', () => {
  const diamond = [[0, 5], [5, 0], [10, 5], [5, 10]];
  assert.equal(polygonContact(0, 0, diamond, 0.5), null);
  const contact = polygonContact(5, 5, diamond, 1);
  assert.ok(contact.depth > 4);
  assert.ok(polygonContact(5, -0.2, diamond, 1));
});
test('traffic follows connected legal edges, turns and stays in its left lane', () => {
  const net = buildNetwork([road(1, [1, 2], [[0, 0], [10, 0]], { oneway: 'yes' }),
    road(2, [2, 3], [[10, 0], [10, 10]], { oneway: 'yes' })]);
  const v = { pos: { x: 0, z: 0 }, mesh: { rotation: {} }, ai: { edge: net.edges[0], t: 0, speed: 5 } };
  advanceTraffic(v, net, 5);
  assert.deepEqual([v.pos.x, v.pos.z], lane(net.edges[0], 0.5));
  advanceTraffic(v, net, 12);
  assert.equal(v.ai.edge.to, '3');
  assert.ok(v.pos.z > 0);
  assert.ok(v.pos.x > 10);
});
test('import refuses empty, failed and geographically incomplete extracts', () => {
  assert.throws(() => prepare({ elements: [], remark: 'timeout' }), /timeout/);
  assert.throws(() => prepare({ elements: [] }), /No OSM roads/);
  assert.throws(() => validate({ roads: [road(1, [1, 2], [[0, 0], [10, 0]])], areas: [] }), /must include/);
});
test('landmarks must have connected walking routes', () => {
  assert.equal(validate(syntheticMap).landmarksConnected, true);
  const broken = structuredClone(syntheticMap);
  broken.roads[3].nodes = [90, 91, 92];
  assert.throws(() => validate(broken), /disconnected/);
});
test('Overpass preparation preserves provenance and joins reversed multipolygon members', () => {
  const geometry = (lat, lon) => ({ lat: ORIGIN.lat + lat, lon: ORIGIN.lon + lon });
  const a = geometry(0, 0), b = geometry(0, 0.001), c = geometry(0.001, 0.001), d = geometry(0.001, 0);
  const map = prepare({ osm3s: { timestamp_osm_base: '2026-11-06T00:00:00Z' }, elements: [
    { type: 'way', id: 1, nodes: [1, 2], geometry: [a, b], tags: { highway: 'residential', oneway: '-1' } },
    { type: 'relation', id: 2, tags: { type: 'multipolygon', leisure: 'park', name: 'Test Park' }, members: [
      { type: 'way', role: 'outer', geometry: [a, b, c] },
      { type: 'way', role: 'outer', geometry: [a, d, c] },
    ] },
  ] });
  assert.equal(map.timestamp, '2026-11-06T00:00:00Z');
  assert.equal(map.license, 'ODbL-1.0');
  assert.equal(map.areas.length, 1);
  assert.equal(map.areas[0].points.length, 5);
  assert.equal(map.roads[0].tags.oneway, '-1');
});
