import './browser-setup.mjs';
import { chromium, devices } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { syntheticMap } from './fixtures/christchurch-synthetic.mjs';
import { validate } from '../scripts/prepare-christchurch.mjs';

const real = process.env.GTC_REAL_MAP === '1';
const map = real ? JSON.parse(await readFile(new URL('../data/christchurch.json', import.meta.url), 'utf8')) : syntheticMap;
console.log(real ? 'REAL OSM EXTRACT: integration checks' : 'SYNTHETIC FIXTURE: integration only, not geographic validation');
console.log(validate(map));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
let count = 0;
const check = (name, ok) => { assert.ok(ok, name); count++; console.log(`PASS ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
  if (!real) await context.route('**/data/christchurch.json', route => route.fulfill({ json: map }));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.PORT || 8080}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__debug, null, { timeout: 60000 });
  check('map loaded and named', await page.evaluate(() => !!window.__debug.world.city.osm && document.title === 'Grand Theft Christchurch'));
  check('player starts at the real Cathedral Square spawn, outside Arcade', await page.evaluate(() => {
    const d = window.__debug, c = d.world.city;
    const reference = c.osm.landmarks?.find(p => p.name === 'Cathedral Square')?.point;
    return c.spawnArea === 'Cathedral Square' && d.player.pos.distanceTo(c.spawn) < .1 &&
      (!reference || Math.hypot(c.spawn.x - reference[0], c.spawn.z - reference[1]) < 60) &&
      d.player.pos.distanceTo(c.legacySpawn) > 800;
  }));
  check('spawn has building clearance and no kiosk overlapping the player', await page.evaluate(async () => {
    const { pointBlocked } = await import('./js/city.js');
    const d = window.__debug;
    const services = [d.shops.denPos, d.shops.wardrobePos, d.shops.casinoPos, d.shops.dealerPos, d.shops.garagePos];
    return !pointBlocked(d.player.pos, d.world.city.colliders, 2) && services.every(p => d.player.pos.distanceTo(p) > 10);
  }));
  check('roads and pedestrians have a connected network', await page.evaluate(() => {
    const c = window.__debug.world.city;
    return c.network.edges.length > 0 && c.walkNetwork.edges.length > c.network.edges.length;
  }));
  check('traffic uses left lanes and only directed driving edges', await page.evaluate(async () => {
    const { lane } = await import('./js/road-traffic.js');
    const c = window.__debug.world.city;
    return window.__debug.world.traffic.every(v => {
      const p = lane(v.ai.edge, v.ai.t);
      return c.network.edges.includes(v.ai.edge) && Math.hypot(v.pos.x - p[0], v.pos.z - p[1]) < 0.01;
    });
  }));
  check('service kiosks are separated', await page.evaluate(() => {
    const s = window.__debug.shops;
    const points = [s.denPos, s.wardrobePos, s.casinoPos, s.dealerPos, s.garagePos].filter(Boolean);
    return points.every((p, i) => points.every((q, j) => i === j || p.distanceTo(q) > 9));
  }));
  if (real) check('Cathedral Square, Colombo Street and Hagley Park access points are unobstructed', await page.evaluate(async () => {
    const { pointBlocked } = await import('./js/city.js');
    const city = window.__debug.world.city;
    return city.osm.landmarks.length >= 3 && city.osm.landmarks.every(({ point: [x, z] }) => !pointBlocked({ x, y: 0, z }, city.colliders, 0.5));
  }));
  await page.click('#playbtn');
  if (real && process.env.GTC_SCREENSHOT_PATH) {
    await page.waitForFunction(() => window.__debug.world.time > 0.3);
    await page.screenshot({ path: process.env.GTC_SCREENSHOT_PATH });
  }
  await page.evaluate(() => {
    const d = window.__debug; d.player.health = 1000; d.setCamYaw(0);
    d.player.pos.copy(d.world.city.roadPoint(d.world.city.spawn, 40, 100));
  });
  const before = await page.evaluate(() => window.__debug.player.pos.toArray());
  await page.keyboard.down('KeyW');
  await page.waitForFunction(a => {
    const p = window.__debug.player.pos; return Math.hypot(p.x - a[0], p.z - a[2]) > 0.2;
  }, before, { timeout: 20000 });
  await page.keyboard.up('KeyW');
  check('walking moves the player', await page.evaluate(a => {
    const p = window.__debug.player.pos; return Math.hypot(p.x - a[0], p.z - a[2]) > 0.2;
  }, before));
  check('polygon collision and existing vehicle physics', await page.evaluate(async () => {
    const { physStep } = await import('./js/car.js');
    const { polygonContact } = await import('./js/road-network.js');
    const d = window.__debug, c = d.world.city.realColliders[0];
    if (!c) return false;
    const vehicle = d.world.parked.find(v => !v.bike);
    vehicle.pos.set((c.x0 + c.x1) / 2, 0, (c.z0 + c.z1) / 2); vehicle.vel.set(0, 0, 0);
    physStep(vehicle, { throttle: 0, steer: 0, handbrake: false }, 1 / 60, [c]);
    return !polygonContact(vehicle.pos.x, vehicle.pos.z, c.polygon, (vehicle.rad || 1.6) - 0.01);
  }));
  await page.evaluate(async () => {
    const { lane } = await import('./js/road-traffic.js');
    const { pointBlocked } = await import('./js/city.js');
    const d = window.__debug, v = d.world.parked.find(v => !v.bike);
    const city = d.world.city;
    // Find a short clear acceleration corridor. A miniature fixture can have
    // parked cars along most of a long edge, unlike the full real extract.
    const sample = city.network.edges.filter(e => e.length > 40 && Math.hypot(e.a[0] - d.player.pos.x, e.a[1] - d.player.pos.z) < 500)
      .flatMap(edge => [0.1, 0.25, 0.4, 0.55, 0.7].map(t => ({ edge, t }))).find(({ edge: e, t: start }) =>
      [0, 1, 2, 4].every(distance => {
        const t = start + distance / e.length;
        const [x, z] = lane(e, t);
        return !pointBlocked({ x, y: 0, z }, city.colliders, 2) &&
          [...d.world.traffic, ...d.world.parked].every(o => o === v || Math.hypot(o.pos.x - x, o.pos.z - z) > 8);
      }));
    if (!sample) throw new Error('No clear driving segment near the spawn');
    const { edge, t } = sample;
    const [x, z] = lane(edge, t);
    v.pos.set(x, 0, z); v.heading = Math.atan2(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]); v.vel.set(0, 0, 0);
    d.enterCarDirect(v);
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__debug.player.inCar?.vel.length() > 3, null, { timeout: 20000 });
  await page.keyboard.up('KeyW');
  check('driving accelerates the existing vehicle', await page.evaluate(() => window.__debug.player.inCar?.vel.length() > 3));
  await page.keyboard.press('KeyE');
  await page.evaluate(() => { const d = window.__debug; d.world.wanted = 0; d.mission.active = false; });
  await page.keyboard.press('F8');
  check('original activities remain accessible in the fictional district', await page.evaluate(() => {
    const d = window.__debug; return d.player.pos.distanceTo(d.world.city.legacySpawn) < 5;
  }));
  await page.keyboard.press('F8');
  check('district travel returns to Christchurch', await page.evaluate(() => {
    const d = window.__debug; return d.player.pos.distanceTo(d.world.city.spawn) < 120;
  }));
  await page.evaluate(() => { const w = window.__debug.world; w.wanted = 3; w.wantedTimer = 0; });
  await page.waitForFunction(() => {
    const d = window.__debug; return d.world.cops.some(c => !c.dead && c.pos.distanceTo(d.player.pos) < 220);
  }, null, { timeout: 20000 });
  check('police pursuit spawns live police near the player', await page.evaluate(() => {
    const d = window.__debug;
    return d.world.cops.some(c => !c.dead && c.pos.distanceTo(d.player.pos) < 220);
  }));
  check('wanted-star display matches police heat', await page.evaluate(() => document.querySelectorAll('#stars .lit').length === window.__debug.world.wanted));
  await page.evaluate(() => {
    const d = window.__debug; d.world.wanted = 0; d.player.health = 1000;
    d.player.pos.copy(d.mission.markerPos);
  });
  await page.waitForFunction(() => window.__debug.mission.active, null, { timeout: 20000 });
  check('missions still start in the new map', await page.evaluate(() => window.__debug.mission.active));
  check('no desktop page errors', errors.length === 0);
  await context.close();
  const mobile = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
  if (!real) await mobile.route('**/data/christchurch.json', route => route.fulfill({ json: map }));
  const phone = await mobile.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(`http://localhost:${process.env.PORT || 8080}`, { waitUntil: 'networkidle' });
  await phone.waitForFunction(() => window.__debug, null, { timeout: 60000 });
  await phone.tap('#playbtn');
  check('mobile map, joystick and buttons load', await phone.evaluate(() => !!window.__debug.world.city.osm && !!document.getElementById('joypad') && !!document.getElementById('btn-web')));
  await phone.evaluate(() => {
    window.__mapTouch = (id, type, dx = 0, dy = 0) => {
      const element = document.getElementById(id), r = element.getBoundingClientRect();
      const touch = new Touch({ identifier: 42, target: element, clientX: r.x + r.width / 2 + dx, clientY: r.y + r.height / 2 + dy });
      element.dispatchEvent(new TouchEvent(type, { changedTouches: [touch], touches: type === 'touchend' ? [] : [touch], bubbles: true, cancelable: true }));
    };
    const d = window.__debug;
    // Exercise touch movement from the actual initial spawn, without teleporting.
    d.player.health = 1000; d.setCamYaw(0);
    window.__walkStart = d.player.pos.clone();
    window.__mapTouch('joypad', 'touchstart'); window.__mapTouch('joypad', 'touchmove', 0, -40);
  });
  await phone.waitForFunction(() => window.__debug.player.pos.distanceTo(window.__walkStart) > 1, null, { timeout: 20000 });
  await phone.evaluate(() => window.__mapTouch('joypad', 'touchend'));
  check('mobile joystick moves the player', true);
  await phone.evaluate(() => {
    const d = window.__debug; d.stopSwing(); d.world.lastShot = null;
    window.__mapTouch('btn-fire', 'touchstart');
  });
  await phone.waitForFunction(() => !!window.__debug.world.lastShot, null, { timeout: 20000 });
  await phone.evaluate(() => window.__mapTouch('btn-fire', 'touchend'));
  check('mobile combat fires through the touch button', true);
  check('no mobile page errors', errors.length === 0);
  await mobile.close();
  console.log(`${count}/${count} checks passed (${real ? 'real OSM data' : 'synthetic fixture'})`);
} catch (error) {
  // Keep actionable startup/render diagnostics when a movement assertion times out.
  for (const context of browser.contexts()) for (const page of context.pages()) {
    console.error('MAP TEST FAILURE', await page.evaluate(() => ({
      state: window.__debug?.getState(), graphics: window.__debug?.graphics(),
      bootFailed: window.__gtcBoot?.failed,
      message: document.getElementById('loading-error')?.textContent,
      player: window.__debug?.player.pos.toArray(),
    })).catch(() => ({ pageUnavailable: true })));
  }
  console.error('Captured page errors:', errors);
  throw error;
} finally { await browser.close(); }
