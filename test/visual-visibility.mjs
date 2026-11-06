import './browser-setup.mjs';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  await context.addInitScript(() =>
    localStorage.setItem(
      'opencity-save-v1',
      JSON.stringify({ settings: { quality: 'low', lowGfx: true, fps: 30 } })
    )
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${process.env.PORT || 8080}/`);
  await page.waitForFunction(
    () => window.__debug && !document.querySelector('#playbtn').disabled,
    null,
    { timeout: 100000 }
  );
  await page.click('#playbtn');
  await page.waitForFunction(() => __debug.world.city.detailing.stats.trees > 0, null, {
    timeout: 30000,
  });
  const counts = [];
  await page.evaluate(() => __debug.pauseGame());
  for (const [quality, layers] of [
    ['low', 3],
    ['medium', 6],
    ['high', 9],
  ]) {
    await page.locator('#graphics-quality').selectOption(quality);
    const result = await page.evaluate(() => __debug.world.city.detailing.stats);
    assert.equal(result.visibleTrunks, result.trees, 'all colliding trunks must remain visible');
    assert.equal(result.leafCardsPerTree, layers);
    counts.push({ quality, ...result });
  }
  await page.locator('#graphics-quality').selectOption('low');
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await page.waitForFunction(() => !__debug.world.city.detailing.pending, null, {
    timeout: 240000,
  });
  const clearance = await page.evaluate(async () => {
    const { makeVehicle } = await import('./js/car.js');
    const { createCharacter } = await import('./js/characters.js');
    const T = await import('three');
    const d = __debug;
    d.player.pos.set(-53, 0, -28);
    d.setCamYaw(0.95);
    d.setCharacter('tank');
    const vehicle = makeVehicle(d.world.scene, -44, -22, Math.PI * 0.6, '#eeeeee', {
      police: true,
    });
    const checks = vehicle.mesh.children.find((m) => m.isInstancedMesh && m.count === 12),
      matrix = new T.Matrix4();
    checks.getMatrixAt(0, matrix);
    const offset = Math.abs(matrix.elements[12]);
    vehicle.mesh.children[0].geometry.computeBoundingBox();
    const bodyExtent = vehicle.mesh.children[0].geometry.boundingBox.max.x;
    const cop = createCharacter({
      shirt: '#44718a',
      pants: '#141e2c',
      skin: '#c98e63',
      police: true,
    });
    cop.group.position.set(-48, 0, -19);
    cop.group.rotation.y = Math.PI;
    d.world.scene.add(cop.group);
    return { offset, bodyExtent, visible: offset > bodyExtent + 0.01 };
  });
  assert.ok(clearance.visible, 'police checks must be outside the beveled body');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'docs/visual-demo/police-livery-verified.png' });
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/visual-demo/visibility-results.json',
    JSON.stringify({ counts, clearance, errors }, null, 2)
  );
  console.log(
    'PASS all trees visible/collidable in every quality and NZ livery outside body',
    JSON.stringify(clearance)
  );
  await context.close();
} finally {
  await browser.close();
}
