import './browser-setup.mjs';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'docs/spawn-validation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile-existing-save' : 'desktop-fresh';
    const context = await browser.newContext({ viewport: mobile ? { width: 384, height: 832 } : { width: 960, height: 700 }, isMobile: mobile, hasTouch: mobile });
    await context.addInitScript(existing => {
      if (existing && !localStorage.getItem('opencity-save-v1')) localStorage.setItem('opencity-save-v1', JSON.stringify({ mapVersion: 'legacy', money: 4321, char: 'tank', pos: [3612, 0, 3612] }));
      const translate = CanvasRenderingContext2D.prototype.translate;
      CanvasRenderingContext2D.prototype.translate = function (x, y) {
        if (this.canvas.id === 'minimap') window.__mapArrow = [x, y];
        return translate.call(this, x, y);
      };
    }, mobile);
    const page = await context.newPage(), log = [];
    page.on('pageerror', e => log.push({ type: 'error', message: e.message }));
    page.on('requestfailed', r => log.push({ type: 'network', url: r.url() }));
    try {
      await page.goto(`http://localhost:${process.env.PORT || 8080}/`);
      await page.waitForFunction(() => window.__debug && !document.querySelector('#playbtn').disabled, null, { timeout: 100000 });
      const before = await page.evaluate(() => ({ player: __debug.player.pos.toArray(), spawn: __debug.world.city.spawn.toArray(), area: __debug.world.city.spawnArea, money: __debug.world.money }));
      assert.equal(before.area, 'Cathedral Square'); assert.deepEqual(before.player, before.spawn);
      if (mobile) assert.equal(before.money, 4321, 'keep existing progress');
      assert.match(await page.locator('#district-travel').textContent(), /Ir para Arcade/);
      await page.locator('#playbtn')[mobile ? 'tap' : 'click']();
      await page.waitForFunction(() => __debug.graphics().frames > 3);
      assert.deepEqual(await page.evaluate(() => __mapArrow), await page.locator('#minimap').evaluate(c => [c.width / 2, c.height / 2]));
      await page.screenshot({ path: `${output}/${name}-spawn.png` });
      if (!mobile) {
        // Follow the connected OSM path using movement input, without teleporting.
        await page.evaluate(async () => {
          const { nearestEdge, findRoute } = await import('./js/road-network.js');
          const c = __debug.world.city, p = __debug.player;
          const from = nearestEdge(c.walkNetwork, [p.pos.x, p.pos.z]);
          const target = nearestEdge(c.walkNetwork, c.osm.landmarks.find(p => p.name === 'Colombo Street').point);
          const path = findRoute(c.walkNetwork, from.edge.to, target.edge.from);
          if (!path) throw new Error('No walking route from actual spawn');
          window.__spawnWalk = { points: [from.edge.b, ...path.map(e => e.b), target.point], index: 0 };
          p.health = 1000;
        });
        await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
        await page.evaluate(() => new Promise((resolve, reject) => {
          const deadline = performance.now() + 150000;
          function follow() {
            const route = window.__spawnWalk, p = __debug.player.pos;
            while (route.index < route.points.length && Math.hypot(p.x - route.points[route.index][0], p.z - route.points[route.index][1]) < 1.5) route.index++;
            if (route.index === route.points.length) return resolve();
            if (performance.now() > deadline) return reject(new Error('Walking route stalled before Colombo Street'));
            const [x, z] = route.points[route.index]; __debug.setCamYaw(Math.atan2(x - p.x, z - p.z));
            requestAnimationFrame(follow);
          } follow();
        }));
        await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
        const arrived = await page.evaluate(() => { const p = __debug.player.pos, q = __debug.world.city.osm.landmarks.find(p => p.name === 'Colombo Street').point; return Math.hypot(p.x - q[0], p.z - q[1]); });
        assert.ok(arrived < 3, 'walked from Square to Colombo Street');
        await page.screenshot({ path: `${output}/colombo-on-foot.png` });
        // Drive an existing car along a clear legal Colombo Street lane.
        const carStart = await page.evaluate(async () => {
          const { lane } = await import('./js/road-traffic.js');
          const { pointBlocked } = await import('./js/city.js');
          const d = __debug, c = d.world.city, car = d.world.parked.find(v => !v.bike);
          const candidates = c.network.edges.filter(e => e.name === 'Colombo Street' && e.length > 15 && Math.hypot(e.a[0] - c.spawn.x, e.a[1] - c.spawn.z) < 350);
          const sample = candidates.flatMap(edge => [.2, .4, .6].map(t => ({ edge, t }))).find(({ edge, t }) => [0, 2, 4, 6].every(m => {
            const [x, z] = lane(edge, t + m / edge.length);
            return t + m / edge.length < .95 && !pointBlocked({ x, y: 0, z }, c.colliders, 2) && [...d.world.parked, ...d.world.traffic].every(v => v === car || Math.hypot(v.pos.x - x, v.pos.z - z) > 8);
          }));
          if (!sample) throw new Error('No clear Colombo driving lane');
          const [x, z] = lane(sample.edge, sample.t); car.pos.set(x, 0, z); car.vel.set(0, 0, 0);
          car.heading = Math.atan2(sample.edge.b[0] - sample.edge.a[0], sample.edge.b[1] - sample.edge.a[1]);
          d.enterCarDirect(car); return [x, z];
        });
        await page.keyboard.down('KeyW');
        await page.waitForFunction(([x, z]) => { const car = __debug.player.inCar; return car && Math.hypot(car.pos.x - x, car.pos.z - z) > 3 && car.vel.length() > 3; }, carStart, { timeout: 30000 });
        await page.keyboard.up('KeyW');
        await page.screenshot({ path: `${output}/colombo-driving.png` });
      } else {
        await page.reload();
        await page.waitForFunction(() => window.__debug && !document.querySelector('#playbtn').disabled, null, { timeout: 100000 });
        assert.deepEqual(await page.evaluate(() => __debug.player.pos.toArray()), before.spawn, 'reload uses real Square spawn even with saved progress');
        assert.equal(await page.evaluate(() => __debug.world.money), 4321);
        await page.locator('#playbtn').tap();
        await page.waitForFunction(() => __debug.getState() === 'play');
        await page.evaluate(() => __debug.pauseGame());
        await page.getByRole('button', { name: 'RESTART (RESPAWN)', exact: true }).tap();
        assert.ok(await page.evaluate(() => __debug.player.pos.distanceTo(__debug.world.city.spawn) < .1), 'real respawn returns to the safe Square point');
      }
      assert.deepEqual(log, []);
      results.push({ name, ...before, passed: true }); console.log('PASS', name);
    } finally { await writeFile(`${output}/${name}-log.json`, JSON.stringify(log, null, 2)); await context.close(); }
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log('PASS Square spawn, saved progress/reload, centred minimap, walking to Colombo and driving on Colombo');
} finally { await browser.close(); }
