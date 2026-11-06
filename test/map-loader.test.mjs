import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChristchurch, validateMap } from '../js/map-loader.js';
import { syntheticMap } from './fixtures/christchurch-synthetic.mjs';
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
test('valid map loads with the requested URL and abort signal', async () => {
  const url = new URL('https://example.test/Gta-Clone/data/christchurch.json');
  let observed;
  const result = await loadChristchurch(url, { fetchImpl: async (input, options) => { observed = { input, options }; return response(syntheticMap); } });
  assert.deepEqual(result, syntheticMap);
  assert.equal(observed.input, url);
  assert.ok(observed.options.signal instanceof AbortSignal);
});
test('HTTP 404 is an explicit error, never a legacy-map fallback', async () => {
  await assert.rejects(loadChristchurch('/data/map.json', { fetchImpl: async () => new Response('', { status: 404 }) }), /HTTP 404/);
});
test('successful HTML fallback routes are rejected as non-JSON', async () => {
  await assert.rejects(loadChristchurch('/data/map.json', { fetchImpl: async () => new Response('<html>app shell</html>', { headers: { 'content-type': 'text/html' } }) }), /não entregou um JSON/);
});
test('truncated JSON and invalid geometry fail before engine initialization', async () => {
  await assert.rejects(loadChristchurch('/data/map.json', { fetchImpl: async () => new Response('{', { headers: { 'content-type': 'application/json' } }) }), /JSON.*inválido/);
  const invalid = structuredClone(syntheticMap); invalid.bounds.maxX = NaN;
  assert.throws(() => validateMap(invalid), /inválidos ou incompatíveis/);
});
test('network errors explain that the download failed', async () => {
  await assert.rejects(loadChristchurch('/data/map.json', { fetchImpl: async () => { throw new TypeError('offline'); } }), /Falha de rede/);
});
test('timeout covers a server that never sends response headers', async () => {
  let signal;
  await assert.rejects(loadChristchurch('/data/map.json', { timeoutMs: 20, fetchImpl: (_, options) => { signal = options.signal; return new Promise(() => {}); } }), /não respondeu a tempo/);
  assert.equal(signal.aborted, true);
});
test('timeout also covers a stalled JSON body after HTTP 200', async () => {
  await assert.rejects(loadChristchurch('/data/map.json', { timeoutMs: 20, fetchImpl: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: () => new Promise(() => {}) }) }), /não respondeu a tempo/);
});
