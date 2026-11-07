import './browser-setup.mjs';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (process.env.GTC_LOW_GFX === '1') throw new Error('Run this visual test without GTC_LOW_GFX: it must exercise the default graphics pipeline.');
const root = process.env.GTC_PREVIEW_URL || `http://localhost:${process.env.PORT || 8080}/`;
const artifacts = process.env.GTC_PREVIEW_ARTIFACTS || 'docs/black-screen';
await mkdir(artifacts, { recursive: true });
const parent = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%;background:black}iframe{width:100%;height:100%;border:0}</style>
<iframe title="Prévia da web" src="${root}" sandbox="allow-scripts allow-same-origin"></iframe>`);
});
await new Promise(resolve => parent.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let passed = 0;
const summaries = [];

async function screenshot(page, name) {
  const png = await page.screenshot({ path: `${artifacts}/${name}.png`, scale: 'css' });
  return pixels(page, png);
}
async function pixels(page, png) {
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const g = canvas.getContext('2d'); g.drawImage(image, 0, 0);
    // Central scene region, excluding HUD/minimap/touch buttons. A black WebGL
    // canvas with working HTML controls must still fail this check.
    const bytes = g.getImageData(image.width * .15, image.height * .25, image.width * .7, image.height * .35).data;
    let sum = 0, square = 0, n = 0; const colors = new Set();
    for (let i = 0; i < bytes.length; i += 4) {
      const value = .2126 * bytes[i] + .7152 * bytes[i + 1] + .0722 * bytes[i + 2];
      sum += value; square += value * value; n++;
      colors.add(`${bytes[i] >> 3},${bytes[i + 1] >> 3},${bytes[i + 2] >> 3}`);
    }
    return { luminanceStd: Math.sqrt(Math.max(0, square / n - (sum / n) ** 2)), colors: colors.size };
  }, png.toString('base64'));
}
async function menu(frame) {
  await frame.waitForFunction(() => window.__debug && !document.getElementById('playbtn').disabled, null, { timeout: 100000 });
  assert.equal(await frame.locator('#start').isVisible(), true);
  assert.match(await frame.locator('#start h1').textContent(), /Grand Theft Christchurch/);
  const box = await frame.locator('#playbtn').boundingBox();
  assert.ok(box && box.width > 100 && box.height > 30 && box.y < 832 && box.y >= 0, 'PLAY must be on screen');
  assert.deepEqual(await frame.evaluate(() => window.__debug.graphics()), { initialized: false, frames: 0 }, 'menu must appear without allocating a WebGL context');
}
async function enter(page, frame, name) {
  await frame.locator('#playbtn').tap();
  await frame.waitForFunction(() => window.__debug?.getState() === 'play' && window.__debug.graphics().frames > 2, null, { timeout: 45000 });
  assert.equal(await frame.locator('#start').isVisible(), false);
  const stats = await screenshot(page, name);
  assert.ok(stats.luminanceStd > 8 && stats.colors > 8, `3D scene must contain rendered pixels, not black behind HUD: ${JSON.stringify(stats)}`);
  return { pixels: stats, graphics: await frame.evaluate(() => window.__debug.graphics()) };
}
async function scenario(name, { noFloat = false, noWebGL = false, blackReadback = false, mapFailure = false, sameSite = false, blockWorker = false } = {}, test) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, deviceScaleFactor: 3.75,
    isMobile: true, hasTouch: true, colorScheme: 'dark', serviceWorkers: blockWorker ? 'block' : 'allow',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
  });
  const log = [];
  context.on('console', m => log.push({ kind: 'console', level: m.type(), message: m.text() }));
  if (noFloat || noWebGL || blackReadback) await context.addInitScript(({ noFloat, noWebGL, blackReadback }) => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (noWebGL && /webgl/.test(type)) return null;
      const gl = get.call(this, type, ...args);
      if (gl && blackReadback && /webgl/.test(type)) gl.readPixels = (...args) => args.at(-1).set([9, 13, 19, 255]);
      if (gl && noFloat && /webgl/.test(type)) {
        const extension = gl.getExtension.bind(gl), supported = gl.getSupportedExtensions.bind(gl);
        gl.getExtension = name => /EXT_color_buffer_(float|half_float)/.test(name) ? null : extension(name);
        gl.getSupportedExtensions = () => supported().filter(name => !/EXT_color_buffer_(float|half_float)/.test(name));
      }
      return gl;
    };
  }, { noFloat, noWebGL, blackReadback });
  if (mapFailure) await context.route('**/data/christchurch.json', r => r.fulfill({ status: 404, body: 'missing map' }));
  const page = await context.newPage();
  page.on('pageerror', e => log.push({ kind: 'pageerror', message: e.stack }));
  page.on('requestfailed', r => log.push({ kind: 'requestfailed', url: r.url(), error: r.failure() }));
  page.on('response', r => log.push({ kind: 'response', url: r.url(), status: r.status(), worker: r.fromServiceWorker() }));
  try {
    await page.goto(`http://${sameSite ? 'localhost' : '127.0.0.1'}:${parent.address().port}/`, { waitUntil: 'domcontentloaded' });
    const frame = page.frames().find(f => f.parentFrame());
    const result = await test({ page, frame, context, log });
    summaries.push({ name, ...result }); passed++;
    console.log(`PASS ${name}`, JSON.stringify(result));
  } finally { await writeFile(`${artifacts}/${name}-log.json`, JSON.stringify(log, null, 2)); await context.close(); }
}

try {
  await scenario('s24-preview', {}, async ({ page, frame, log }) => {
    await menu(frame); await screenshot(page, 'menu-after');
    const result = await enter(page, frame, 'scene-after');
    assert.ok(result.graphics.hdr, 'default HDR path is tested, not the low-graphics test setting');
    assert.equal(log.filter(e => e.kind === 'pageerror').length, 0);
    return result;
  });
  await scenario('s24-worker-blocked', { blockWorker: true }, async ({ page, frame }) => {
    await menu(frame); return enter(page, frame, 'worker-blocked-scene');
  });
  await scenario('s24-warm-reload', { sameSite: true }, async ({ page, frame }) => {
    await menu(frame); await frame.waitForFunction(() => navigator.serviceWorker.controller);
    await frame.goto(root); await menu(frame);
    return enter(page, frame, 'warm-reload-scene');
  });
  await scenario('s24-no-float', { noFloat: true }, async ({ page, frame, log }) => {
    await menu(frame); await screenshot(page, 'gpu-menu-after');
    const result = await enter(page, frame, 'gpu-after');
    assert.equal(result.graphics.hdr, false);
    assert.equal(log.filter(e => /GL_INVALID|Framebuffer is incomplete|Attachment is not renderable/.test(e.message || '')).length, 0);
    const old = await pixels(page, await readFile('docs/black-screen/gpu-before.png'));
    assert.ok(old.luminanceStd < 8, 'the visual assertion must reject the reproduced old black scene');
    return { ...result, oldBlackFrame: old };
  });
  await scenario('s24-cache-recovery', { sameSite: true }, async ({ page, frame, context }) => {
    await menu(frame); await frame.waitForFunction(() => navigator.serviceWorker.controller);
    await frame.goto(root); await menu(frame);
    await frame.evaluate(async () => {
      const name = (await caches.keys()).find(k => k.endsWith('rugby-v5'));
      if (!name) throw new Error('new scoped service worker cache not active');
      const cache = await caches.open(name);
      await cache.put(location.href, new Response('', { headers: { 'content-type': 'text/html' } }));
      await cache.delete(new URL('index.html', location.href));
      const old = await caches.open('christchurch-startup-v2');
      await old.put(location.href, new Response('', { headers: { 'content-type': 'text/html' } }));
    });
    await context.setOffline(true); const response = await frame.goto(root);
    assert.equal(response.headers()['x-christchurch-recovery'], 'invalid-or-unavailable-navigation');
    await frame.getByRole('alert').waitFor();
    assert.equal(await frame.locator('#start h1').isVisible(), true);
    assert.equal(await frame.locator('#playbtn').isDisabled(), true);
    await screenshot(page, 'cache-after');
    await context.setOffline(false); await frame.locator('#retry-load').tap();
    await menu(frame); return enter(page, frame, 'cache-recovered-scene');
  });
  await scenario('s24-map-error', { mapFailure: true }, async ({ page, frame }) => {
    await frame.getByRole('alert').waitFor({ timeout: 30000 });
    assert.match(await frame.locator('#loading-error').textContent(), /HTTP 404/);
    assert.equal(await frame.locator('#start h1').isVisible(), true);
    assert.equal(await frame.locator('#playbtn').isDisabled(), true);
    assert.equal(await frame.evaluate(() => !!window.__debug), false);
    await screenshot(page, 'map-error'); return { menuVisible: true, replacementWorld: false };
  });
  await scenario('s24-webgl-error', { noWebGL: true }, async ({ page, frame }) => {
    await menu(frame); await frame.locator('#playbtn').tap();
    await frame.getByRole('alert').waitFor();
    assert.equal(await frame.locator('#start').isVisible(), true);
    assert.match(await frame.locator('#loading-error').textContent(), /WebGL/);
    await screenshot(page, 'webgl-error'); return { menuVisible: true };
  });
  await scenario('s24-late-js-error', {}, async ({ page, frame }) => {
    await menu(frame); await enter(page, frame, 'late-js-before');
    await frame.evaluate(() => {
      window.__debug.pauseGame = () => { throw new Error('cleanup unavailable'); };
      setTimeout(() => { throw new Error('Erro de teste após PLAY'); }, 0);
    });
    await frame.getByRole('alert').waitFor();
    assert.equal(await frame.locator('#start').isVisible(), true);
    assert.match(await frame.locator('#loading-error').textContent(), /Erro de teste/);
    await screenshot(page, 'late-js-error'); return { menuVisible: true };
  });
  await scenario('s24-silent-black-frame', { blackReadback: true }, async ({ page, frame }) => {
    await menu(frame); await frame.locator('#playbtn').tap();
    await frame.getByRole('alert').waitFor();
    assert.equal(await frame.locator('#start').isVisible(), true);
    assert.match(await frame.locator('#loading-error').textContent(), /frame preto/);
    await screenshot(page, 'silent-black-frame-error'); return { menuVisible: true };
  });
  await writeFile(`${artifacts}/results.json`, JSON.stringify(summaries, null, 2));
  console.log(`${passed}/${passed} visual preview scenarios passed`);
} finally {
  await browser.close();
  await new Promise(resolve => parent.close(resolve));
}
