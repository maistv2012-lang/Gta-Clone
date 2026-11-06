import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { project, ORIGIN, buildNetwork, nearestEdge, findRoute, polygonContact } from '../js/road-network.js';

function rings(members) {
  const chains = members.map(m => m.geometry?.map(p => [p.lon, p.lat]));
  if (chains.some(c => !c?.length || c.some(p => !p.every(Number.isFinite)))) throw new Error('Incomplete multipolygon geometry');
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const result = [];
  while (chains.length) {
    const ring = chains.pop().slice();
    while (!same(ring[0], ring.at(-1))) {
      const i = chains.findIndex(c => same(ring.at(-1), c[0]) || same(ring.at(-1), c.at(-1)));
      if (i < 0) throw new Error('Unclosed OSM multipolygon');
      const next = chains.splice(i, 1)[0];
      if (!same(ring.at(-1), next[0])) next.reverse();
      ring.push(...next.slice(1));
    }
    result.push(ring.map(([lon, lat]) => project(lat, lon).map(n => Math.round(n * 100) / 100)));
  }
  return result;
}

export function prepare(raw) {
  if (!Array.isArray(raw.elements) || raw.remark) throw new Error(raw.remark || 'Invalid Overpass response');
  const roads = [], areas = [];
  for (const element of raw.elements) {
    if (element.type === 'relation' && element.tags?.type === 'multipolygon') {
      const outer = rings(element.members.filter(m => m.type === 'way' && (!m.role || m.role === 'outer')));
      const inner = rings(element.members.filter(m => m.type === 'way' && m.role === 'inner'));
      for (const [i, points] of outer.entries()) {
        areas.push({ id: `relation/${element.id}/${i}`, tags: element.tags, points,
          holes: inner.filter(r => polygonContact(r[0][0], r[0][1], points)) });
      }
      continue;
    }
    if (element.type !== 'way' || !element.geometry?.length) continue;
    const tags = element.tags || {};
    if (element.geometry.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) continue;
    const points = element.geometry.map(p => project(p.lat, p.lon).map(n => Math.round(n * 100) / 100));
    if (tags.highway && element.nodes?.length === points.length) {
      const declared = Number.parseFloat(tags.width);
      const lanes = Number.parseInt(tags.lanes, 10);
      const width = Number.isFinite(declared) ? declared : Number.isFinite(lanes) ? lanes * 3.2 :
        ['footway', 'path', 'cycleway', 'steps'].includes(tags.highway) ? 2.5 : tags.highway === 'pedestrian' ? 10 : 9;
      roads.push({ id: element.id, nodes: element.nodes, tags, points, width: Math.max(1, Math.min(35, width)) });
    }
    if ((tags.building || ['park', 'garden'].includes(tags.leisure) || tags.natural === 'water') && element.nodes?.[0] === element.nodes?.at(-1)) {
      const measured = Number.parseFloat(tags.height), levels = Number.parseFloat(tags['building:levels']);
      areas.push({ id: element.id, tags, points, height: Number.isFinite(measured) ? measured : Number.isFinite(levels) ? levels * 3 : 12,
        estimatedHeight: !Number.isFinite(measured) });
    }
  }
  if (!roads.length) throw new Error('No OSM roads found; refusing to write an empty map');
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const item of [...roads, ...areas]) for (const [x, z] of item.points) {
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  return { version: 1, origin: ORIGIN, source: 'OpenStreetMap contributors', license: 'ODbL-1.0',
    timestamp: raw.osm3s?.timestamp_osm_base || null,
    retrievedAt: raw.retrievedAt || null, sourceUrl: raw.sourceUrl || 'https://overpass-api.de/api/interpreter',
    sourceType: raw.sourceType || 'overpass',
    bounds, roads, areas };
}

export function validate(map) {
  const walking = buildNetwork(map.roads, { walking: true });
  const colombo = map.roads.find(r => r.tags.name === 'Colombo Street');
  const square = map.roads.find(r => r.tags.name === 'Cathedral Square');
  const hagley = map.areas.find(a => /Hagley Park/i.test(a.tags.name || ''));
  if (!colombo || !square || !hagley) throw new Error('Extract must include Colombo Street, Cathedral Square and Hagley Park');
  const named = name => nearestEdge({ edges: walking.edges.filter(e => e.name === name) }, [0, 0]);
  const start = named('Cathedral Square'), street = named('Colombo Street');
  if (!start || !street) throw new Error('Named landmarks have no accessible walking edges');
  const landmarks = [{ name: 'Cathedral Square', osmId: start.edge.roadId, point: start.point, node: start.edge.from },
    { name: 'Colombo Street', osmId: street.edge.roadId, point: street.point, node: street.edge.from }];
  for (const park of map.areas.filter(a => /Hagley Park/i.test(a.tags.name || ''))) {
    const center = park.points.reduce((p, q) => [p[0] + q[0] / park.points.length, p[1] + q[1] / park.points.length], [0, 0]);
    const paths = walking.edges.filter(e => {
      const x = (e.a[0] + e.b[0]) / 2, z = (e.a[1] + e.b[1]) / 2;
      return e.walking && polygonContact(x, z, park.points) && !(park.holes || []).some(h => polygonContact(x, z, h));
    });
    const access = nearestEdge({ edges: paths }, center);
    if (!access) throw new Error(`No walking path inside ${park.tags.name}`);
    landmarks.push({ name: park.tags.name, osmId: park.id, point: access.point, node: access.edge.from });
  }
  for (const landmark of landmarks) {
    const route = findRoute(walking, start.edge.from, landmark.node);
    if (!route) throw new Error('Landmark walking network is disconnected');
    landmark.routeEdges = route.length;
    landmark.routeMeters = Math.round(route.reduce((sum, e) => sum + e.length, 0));
  }
  return { roads: map.roads.length, areas: map.areas.length, driveEdges: buildNetwork(map.roads).edges.length,
    walkEdges: walking.edges.length, landmarksConnected: true, landmarks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node scripts/prepare-christchurch.mjs raw-overpass.json [output.json]');
  const map = prepare(JSON.parse(await readFile(input, 'utf8')));
  const report = validate(map);
  map.landmarks = report.landmarks;
  const output = process.argv[3] || 'data/christchurch.json';
  await mkdir(new URL('../data', import.meta.url), { recursive: true });
  await writeFile(output, JSON.stringify(map));
  console.log(JSON.stringify(report, null, 2));
}
