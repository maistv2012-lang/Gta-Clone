import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { validate } from '../scripts/prepare-christchurch.mjs';
import { buildNetwork, permitsCars, leftOffset } from '../js/road-network.js';
const map = JSON.parse(await readFile(new URL('../data/christchurch.json', import.meta.url), 'utf8'));
assert.equal(map.source, 'OpenStreetMap contributors');
assert.equal(map.license, 'ODbL-1.0');
assert.ok(map.timestamp || map.retrievedAt, 'source date recorded');
assert.ok(map.roads.some(r => r.tags.name === 'Cathedral Square'));
assert.ok(map.roads.some(r => r.tags.name === 'Colombo Street'));
assert.ok(map.areas.some(a => /Hagley Park North/.test(a.tags.name || '')));
assert.ok(map.areas.some(a => /Hagley Park South/.test(a.tags.name || '')));
const report = validate(map);
const legal = new Map();
for (const road of map.roads) {
  const pairs = new Set(), one = road.tags.oneway ?? (road.tags.junction === 'roundabout' ? 'yes' : 'no');
  if (permitsCars(road.tags)) for (let i = 1; i < road.nodes.length; i++) {
    const a = road.nodes[i - 1], b = road.nodes[i];
    if (one !== '-1') pairs.add(`${a}/${b}`);
    if (!['yes', '1', 'true'].includes(one)) pairs.add(`${b}/${a}`);
  }
  legal.set(road.id, pairs);
}
for (const edge of buildNetwork(map.roads).edges) {
  assert.ok(legal.get(edge.roadId).has(`${edge.from}/${edge.to}`), `illegal direction on OSM way ${edge.roadId}`);
  const [x, z] = leftOffset(edge.a, edge.b, Math.min(2.5, edge.width / 4));
  assert.ok(x * (edge.b[1] - edge.a[1]) - z * (edge.b[0] - edge.a[0]) > 0, 'lane must be left of travel direction');
}
await writeFile(new URL('../data/christchurch-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS real OSM provenance, named places, ${report.driveEdges} legal directed left-lane edges`);
for (const place of report.landmarks) console.log(`PASS ${place.name}: OSM ${place.osmId}, ${place.routeEdges} connected edges from Cathedral Square (${place.routeMeters}m along the graph)`);
