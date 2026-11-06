import './browser-setup.mjs';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'docs/visual-demo';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const summaries = [];
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'mobile' : 'desktop',
      log = [];
    const context = await browser.newContext({
      viewport: mobile ? { width: 384, height: 832 } : { width: 1100, height: 700 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => log.push({ type: 'pageerror', message: e.message }));
    page.on('console', (m) => log.push({ type: 'console', level: m.type(), message: m.text() }));
    page.on('requestfailed', (r) =>
      log.push({ type: 'requestfailed', url: r.url(), error: r.failure() })
    );
    page.on('response', (r) => {
      if (r.status() >= 400) log.push({ type: 'http-error', url: r.url(), status: r.status() });
    });
    try {
      await page.goto(`http://localhost:${process.env.PORT || 8080}/`);
      await page.waitForFunction(
        () => window.__debug && !document.querySelector('#playbtn').disabled,
        null,
        { timeout: 100000 }
      );
      assert.deepEqual(await page.evaluate(() => __debug.graphics()), {
        initialized: false,
        frames: 0,
      });
      await page.locator('#playbtn')[mobile ? 'tap' : 'click']();
      await page.waitForFunction(
        () => __debug.graphics().frames > 2 && !__debug.world.city.detailing.pending,
        null,
        { timeout: 240000 }
      );
      const original = await page.evaluate(() => ({
        osm: !!__debug.world.city.osm,
        area: __debug.world.city.spawnArea,
        details: __debug.world.city.detailing.stats,
        quality: __debug.world.city.detailing.quality,
        rig: __debug.player.ch.skin.isSkinnedMesh,
        bones: __debug.player.ch.skin.skeleton.bones.length,
      }));
      assert.ok(original.osm && original.rig && original.bones >= 10);
      assert.equal(original.area, 'Cathedral Square');
      assert.equal(original.quality, mobile ? 'medium' : 'high');
      assert.equal(original.details.buildings, 24);
      assert.ok(original.details.props > 0 && original.details.trees > 0);
      await page.screenshot({ path: `${output}/${name}-spawn.png` });
      // Switch existing UI controls, rather than changing internal quality flags.
      const profiles = [];
      for (const quality of ['low', 'medium', 'high']) {
        await page.evaluate(() => __debug.pauseGame());
        await page.locator('#graphics-quality').selectOption(quality);
        await page.locator('#graphics-fps').selectOption('60');
        assert.equal(await page.evaluate(() => __debug.world.city.detailing.quality), quality);
        assert.equal(await page.evaluate(() => __debug.world.settings.fps), 60);
        await page.getByRole('button', { name: 'RESUME', exact: true }).click();
        await page.waitForFunction(
          () => __debug.getState() === 'play' && __debug.graphics().frames > 3
        );
        profiles.push({ quality, graphics: await page.evaluate(() => __debug.graphics()) });
      }
      // Revert to the conservative mobile/default target before collecting timing.
      await page.evaluate(() => __debug.pauseGame());
      await page.locator('#graphics-quality').selectOption(mobile ? 'medium' : 'high');
      await page.locator('#graphics-fps').selectOption(mobile ? '30' : '60');
      await page.getByRole('button', { name: 'RESUME', exact: true }).click();
      const before = await page.evaluate(() => ({
        frames: __debug.graphics().frames,
        time: performance.now(),
      }));
      await page.waitForTimeout(6000);
      const after = await page.evaluate(() => ({
        frames: __debug.graphics().frames,
        time: performance.now(),
      }));
      const observedFps = ((after.frames - before.frames) * 1000) / (after.time - before.time);
      // This is software WebGL timing, NOT a physical S24 acceptance benchmark.
      await page.evaluate(() => {
        __debug.player.pos.set(-53, 0, -28);
        __debug.setCamYaw(0.95);
      });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${output}/${name}-cathedral.png` });
      await page.evaluate(async () => {
        const { createCharacter } = await import('./js/characters.js');
        const { makeVehicle } = await import('./js/car.js');
        const d = __debug;
        d.setCharacter('tank');
        const cop = createCharacter({
          shirt: '#44718a',
          pants: '#141e2c',
          skin: '#c98e63',
          police: true,
        });
        cop.group.position.set(-48, 0, -19);
        cop.group.rotation.y = Math.PI;
        d.world.scene.add(cop.group);
        const car = makeVehicle(d.world.scene, -44, 0, 0, '#eeeeee', { police: true });
        car.pos.set(-44, 0, -22);
        car.mesh.position.copy(car.pos);
        car.mesh.rotation.y = Math.PI * 0.6;
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${output}/${name}-brick-police.png` });
      assert.equal(await page.evaluate(() => __debug.player.charDef.name), 'BRICK');
      assert.equal(await page.evaluate(() => __debug.player.health), 150);
      assert.equal(
        log.filter(
          (e) =>
            ['pageerror', 'requestfailed', 'http-error'].includes(e.type) ||
            /GL_INVALID|Framebuffer is incomplete/.test(e.message || '')
        ).length,
        0
      );
      const result = {
        name,
        ...original,
        profiles,
        observedSoftwareFps: observedFps,
        physicalS24Verified: false,
      };
      summaries.push(result);
      console.log('PASS', JSON.stringify(result));
    } finally {
      await writeFile(`${output}/${name}-log.json`, JSON.stringify(log, null, 2));
      await context.close();
    }
  }
  // A missing PBR file must leave an actionable menu, never a black screen.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/assets/christchurch/stone-color.jpg', (r) =>
    r.fulfill({ status: 404, body: 'missing' })
  );
  const page = await context.newPage();
  await page.goto(`http://localhost:${process.env.PORT || 8080}/`);
  await page.getByRole('alert').waitFor({ timeout: 30000 });
  assert.match(await page.locator('#loading-error').textContent(), /textura local/);
  assert.equal(await page.locator('#start').isVisible(), true);
  await context.close();
  await writeFile(`${output}/results.json`, JSON.stringify(summaries, null, 2));
  console.log('PASS missing material recovers to explicit menu error');
} finally {
  await browser.close();
}
