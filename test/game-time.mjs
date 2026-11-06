// The engine caps dt at 50ms, so wall-clock sleeps under-run gameplay on
// software WebGL. Keep each test's original simulation duration and assertions.
export async function waitForGame(page, milliseconds) {
  const state = await page.evaluate(() => {
    const d = window.__debug;
    return d && { time: d.world.time, state: d.getState() };
  });
  if (!state || !['play', 'over'].includes(state.state)) return page.waitForTimeout(milliseconds);
  await page.waitForFunction(target => {
    const d = window.__debug;
    return d.world.time >= target || !['play', 'over'].includes(d.getState());
  }, state.time + milliseconds / 1000, { timeout: 90000 });
}
