// Official OSM map API fallback: small serial requests respect its node limit.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = promisify(execFile);
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/fetch-osm-api.mjs output.json');
const directory = await mkdtemp(join(tmpdir(), 'christchurch-osm-'));
const elements = new Map();
const retrievedAt = new Date().toISOString();
const merge = data => {
  if (!Array.isArray(data.elements)) throw new Error('Invalid OSM API response');
  for (const e of data.elements) {
    const key = `${e.type}/${e.id}`, previous = elements.get(key);
    if (!previous || (e.version || 0) >= (previous.version || 0)) elements.set(key, e);
  }
};
async function get(path) {
  const file = join(directory, 'response.json');
  await run('curl', ['--fail', '--show-error', '--silent', '--location', '--max-time', '90',
    '--user-agent', 'GrandTheftChristchurch/0.1 (OpenStreetMap development importer)',
    `https://www.openstreetmap.org/api/0.6/${path}`, '--output', file]);
  return JSON.parse(await readFile(file, 'utf8'));
}
try {
  for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
    const west = 172.605 + column * 0.01125, south = -43.545 + row * 0.01;
    const box = [west, south, west + 0.01125, south + 0.01].map(n => n.toFixed(6)).join(',');
    merge(await get(`map.json?bbox=${box}`));
    console.log(`OSM API tile ${row * 4 + column + 1}/12 received`);
  }
  // map API relations can reference members outside a tile. Complete only the
  // park relations needed by this extract, rather than unrelated regional ones.
  const parks = [...elements.values()].filter(e => e.type === 'relation' && e.tags?.type === 'multipolygon' && ['park', 'garden'].includes(e.tags.leisure));
  for (const relation of parks) {
    if (relation.members.some(m => m.type === 'way' && !elements.has(`way/${m.ref}`))) merge(await get(`relation/${relation.id}/full.json`));
  }
  const geometry = way => way.nodes?.map(id => elements.get(`node/${id}`)).map(n => n && ({ lat: n.lat, lon: n.lon }));
  const result = [];
  for (const e of elements.values()) {
    if (e.type === 'way') result.push({ ...e, geometry: geometry(e) });
    if (e.type === 'relation' && e.tags?.type === 'multipolygon' && ['park', 'garden'].includes(e.tags.leisure)) {
      result.push({ ...e, members: e.members.map(m => ({ ...m, geometry: m.type === 'way' ? geometry(elements.get(`way/${m.ref}`) || {}) : undefined })) });
    }
  }
  await writeFile(output, JSON.stringify({ elements: result, sourceUrl: 'https://www.openstreetmap.org/api/0.6/map', retrievedAt,
    sourceType: 'osm-api-0.6', license: 'ODbL-1.0' }));
} finally { await rm(directory, { recursive: true, force: true }); }
