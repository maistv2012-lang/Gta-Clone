import './browser-setup.mjs';
import { chromium, devices } from 'playwright-core';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const root = `http://localhost:${process.env.PORT || 8080}/`;
// The nested-path regression must not depend on a manually started second server.
let nestedServer, nestedPort = process.env.NESTED_PORT;
if (!nestedPort) {
  const directory = fileURLToPath(new URL('../', import.meta.url));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  nestedServer = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/Gta-Clone/')) { response.writeHead(404).end(); return; }
      const relative = pathname.slice('/Gta-Clone/'.length) || 'index.html';
      const filename = resolve(directory, relative);
      if (!filename.startsWith(resolve(directory) + sep)) { response.writeHead(403).end(); return; }
      const body = await readFile(filename);
      const extension = filename.slice(filename.lastIndexOf('.'));
      response.writeHead(200, { 'content-type': types[extension] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    nestedServer.once('error', reject);
    nestedServer.listen(0, '127.0.0.1', resolve);
  });
  nestedPort = nestedServer.address().port;
}
let passed = 0;
async function scenario(name, fn) {
  const context = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
  try { await fn(context); passed++; console.log(`PASS ${name}`); }
  finally { await context.close(); }
}
async function failed(page, pattern, initialized = false) {
  await page.getByRole('alert').waitFor({ timeout: 20000 });
  assert.match(await page.locator('#loading-error').textContent(), pattern);
  assert.equal(await page.locator('#playbtn').isDisabled(), true);
  assert.equal(await page.locator('#retry-load').isVisible(), true);
  assert.equal(await page.evaluate(() => !!window.__debug), initialized, 'map failures must not initialize a replacement world');
  assert.equal(await page.locator('#start').isVisible(), true);
}
async function play(page) {
  await page.waitForFunction(() => window.__debug && !document.getElementById('playbtn').disabled, null, { timeout: 100000 });
  assert.equal(await page.evaluate(() => !!window.__debug.world.city.osm), true);
  await page.tap('#playbtn');
  await page.waitForFunction(() => window.__debug.getState() === 'play');
  assert.equal(await page.locator('#start').isVisible(), false);
}
try {
  await scenario('mobile boots and PLAY enters the real game with all remote hosts blocked', async context => {
    const external = [], mapRequests = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) { external.push(url.href); return route.abort(); }
      if (url.pathname.endsWith('/data/christchurch.json')) mapRequests.push(url.pathname);
      return route.continue();
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(root);
    await play(page);
    assert.deepEqual(external, []);
    assert.deepEqual(mapRequests, ['/data/christchurch.json']);
    assert.deepEqual(errors, []);
  });
  await scenario('missing map shows HTTP 404, no fallback, and retry can enter PLAY', async context => {
    let missing = true;
    await context.route('**/data/christchurch.json', r => missing ? r.fulfill({ status: 404, body: 'not found' }) : r.continue());
    const page = await context.newPage(); await page.goto(root);
    await failed(page, /HTTP 404/);
    missing = false;
    await page.locator('#retry-load').click();
    await play(page);
  });
  await scenario('HTML returned as HTTP 200 at the JSON path is explained', async context => {
    await context.route('**/data/christchurch.json', r => r.fulfill({ contentType: 'text/html', body: '<html>wrong fallback</html>' }));
    const page = await context.newPage(); await page.goto(root); await failed(page, /não entregou um JSON/);
  });
  await scenario('invalid map bounds stop initialization with a clear data error', async context => {
    await context.route('**/data/christchurch.json', r => r.fulfill({ json: { version: 1, roads: [{}], areas: [{}] } }));
    const page = await context.newPage(); await page.goto(root); await failed(page, /inválidos ou incompatíveis/);
  });
  await scenario('stalled map download times out instead of loading forever', async context => {
    let requested;
    const request = new Promise(resolve => { requested = resolve; });
    await context.route('**/data/christchurch.json', () => { requested(); return new Promise(() => {}); });
    const page = await context.newPage(); await page.clock.install(); await page.goto(root);
    await request;
    await page.clock.fastForward(46000);
    await failed(page, /não respondeu a tempo/);
  });
  await scenario('missing engine module is caught before PLAY is enabled', async context => {
    await context.route('**/vendor/three/three.module.js', r => r.abort('failed'));
    const page = await context.newPage(); await page.goto(root); await failed(page, /fetch|module|load/i);
  });
  await scenario('WebGL failure is visible instead of a permanent loading label', async context => {
    await context.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : get.call(this, type, ...args);
      };
    });
    const page = await context.newPage(); await page.goto(root);
    await page.waitForFunction(() => window.__debug && !document.getElementById('playbtn').disabled);
    assert.equal(await page.locator('#start').isVisible(), true);
    await page.tap('#playbtn'); await failed(page, /WebGL/, true);
  });
  await scenario('stalled module import is bounded by the overall startup watchdog', async context => {
    let requested;
    const request = new Promise(resolve => { requested = resolve; });
    await context.route('**/js/main.js', () => { requested(); return new Promise(() => {}); });
    const page = await context.newPage(); await page.clock.install(); await page.goto(root);
    await request; await page.clock.fastForward(91000); await failed(page, /90 segundos/);
  });
  await scenario('WebGL context loss during construction stops startup with a visible error', async context => {
    await context.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const result = get.call(this, type, ...args);
        if (result && /webgl/i.test(type)) setTimeout(() => this.dispatchEvent(new Event('webglcontextlost', { cancelable: true })), 0);
        return result;
      };
    });
    const page = await context.newPage(); await page.goto(root);
    await page.waitForFunction(() => window.__debug && !document.getElementById('playbtn').disabled);
    await page.tap('#playbtn'); await failed(page, /contexto WebGL/, true);
  });
  await scenario('missing bootstrap script itself gives a visible error', async context => {
    await context.route('**/js/boot.js', r => r.abort('failed'));
    const page = await context.newPage(); await page.goto(root);
    await page.getByRole('alert').waitFor();
    assert.match(await page.locator('#map-status').textContent(), /arquivos do jogo/);
    assert.equal(await page.locator('#playbtn').isDisabled(), true);
  });
  // A real directory mount catches paths that root-only testing can miss.
  const nested = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'allow' });
  try {
    const page = await nested.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const session = await nested.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`http://localhost:${nestedPort}/Gta-Clone/`);
    await play(page);
    assert.match(page.url(), /\/Gta-Clone\/$/);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.reload(); await play(page);
    assert.deepEqual(errors, []);
    passed++; console.log('PASS nested /Gta-Clone/ mobile startup and warm reload with service worker and 4x CPU slowdown');
  } finally { await nested.close(); }
  console.log(`${passed}/${passed} startup scenarios passed`);
} finally {
  await browser.close();
  if (nestedServer) await new Promise(resolve => nestedServer.close(resolve));
}
