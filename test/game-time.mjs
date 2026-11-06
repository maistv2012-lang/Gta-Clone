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
    return !!d && (d.world.time >= target || !['play', 'over'].includes(d.getState()));
  }, state.time + milliseconds / 1000, { timeout: 90000 });
}

// Browser-side equivalent for existing page.evaluate scenarios. This observes
// simulation time; it never changes dt, advances the game manually or skips checks.
export function waitInGame(milliseconds) {
  const d=globalThis.__debug;
  if(!d||!['play','over'].includes(d.getState()))return new Promise(resolve=>setTimeout(resolve,milliseconds));
  const target=d.world.time+milliseconds/1000,deadline=performance.now()+90000;
  return new Promise((resolve,reject)=>{
    function poll(){
      if(d.world.time>=target||!['play','over'].includes(d.getState()))return resolve();
      if(performance.now()>deadline)return reject(new Error(`Simulation did not advance ${milliseconds}ms`));
      requestAnimationFrame(poll);
    }poll();
  });
}
