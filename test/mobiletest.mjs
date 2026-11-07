import { waitForGame } from './game-time.mjs';
// Mobile playability test: emulate a phone (touch, no pointer lock) and drive
// the game through the virtual joystick and buttons.
import { chromium, devices } from 'playwright-core';

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}
const context = await browser.newContext({ ...devices['Pixel 5'] });
const page = await context.newPage();
let errors = 0;
page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR:', e.message); });

await page.goto(`http://localhost:${process.env.PORT || 8080}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__debug, null, { timeout: 20000 });
if (process.env.GTC_TEST_CHARACTER) {
  await page.locator('.charcard').filter({hasText:process.env.GTC_TEST_CHARACTER.toUpperCase()}).tap();
  const selected=await page.evaluate(()=>__debug.player.charDef.key);
  if(selected!==process.env.GTC_TEST_CHARACTER)throw new Error('Requested mobile character was not selected');
  console.log(`PASS mobile roster selects ${selected}`);
}
await page.tap('#playbtn');
await waitForGame(page, 700);

const ev = (fn, arg) => page.evaluate(fn, arg);

// touch UI appears on a touch device
const ui = await ev(() => ({
  ui: !!document.getElementById('touchui'),
  pad: !!document.getElementById('joypad'),
  web: !!document.getElementById('btn-web'),
}));
console.log(`touch UI present: ${ui.ui && ui.pad && ui.web ? 'PASS' : 'FAIL'}`);

// synthetic touch helper lives in the page
await ev(() => {
  window.__touch = (elId, type, dx = 0, dy = 0, id = 7) => {
    const el = document.getElementById(elId);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 + dx;
    const y = r.top + r.height / 2 + dy;
    const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent(type, {
      changedTouches: [t],
      touches: type === 'touchend' ? [] : [t],
      bubbles: true,
      cancelable: true,
    }));
  };
});

// joystick pushes the player forward
{
  const a = await ev(() => {
    const d = window.__debug;
    d.setCamYaw(0);
    d.player.vel.set(0, 0, 0);
    return { x: d.player.pos.x, z: d.player.pos.z };
  });
  await ev(() => { window.__touch('joypad', 'touchstart'); window.__touch('joypad', 'touchmove', 0, -40); });
  await waitForGame(page, 700);
  await ev(() => window.__touch('joypad', 'touchend'));
  const b = await ev(() => ({ x: window.__debug.player.pos.x, z: window.__debug.player.pos.z }));
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  console.log(`joystick move: ${moved.toFixed(2)}m ${moved > 1 ? 'PASS' : 'FAIL'}`);
}

// jump button
{
  await ev(() => window.__touch('btn-jump', 'touchstart'));
  await waitForGame(page, 150);
  const vy = await ev(() => window.__debug.player.vy);
  await ev(() => window.__touch('btn-jump', 'touchend'));
  console.log(`jump button: vy=${vy.toFixed(1)} ${vy > 2 ? 'PASS' : 'FAIL'}`);
  await waitForGame(page, 800);
}

// web button swings without pointer lock
{
  await ev(() => {
    const d = window.__debug;
    // The swing ray fan needs a wide facade and a clear approach. The first
    // random tall collider can be narrow/obstructed, selecting a distant rope
    // that legitimately has not lifted the player at the 700ms assertion.
    const c = d.world.city.colliders.find(c => {
      if(c.h<40||c.x1-c.x0<16)return false;
      const x=(c.x0+c.x1)/2,z=c.z0-12;
      return !d.world.city.colliders.some(o=>x>o.x0-.8&&x<o.x1+.8&&z>o.z0-.8&&z<o.z1+.8)&&
        [...d.world.traffic,...d.world.parked].every(v=>Math.hypot(v.pos.x-x,v.pos.z-z)>6);
    });
    if(!c)throw new Error('No wide, clear facade for the mobile WEB button audit');
    d.player.pos.set((c.x0 + c.x1) / 2, 0, c.z0 - 12);
    d.player.vel.set(0, 0, 0);
    d.player.vy = 0;
    d.setCamYaw(0);
  });
  await waitForGame(page, 400);
  await ev(() => window.__touch('btn-web', 'touchstart'));
  await waitForGame(page, 700);
  const s = await ev(() => ({ att: window.__debug.web.attached, y: window.__debug.player.pos.y, anchor:window.__debug.web.anchor.toArray(), rope:window.__debug.web.len, target:window.__debug.web.targetLen }));
  await ev(() => window.__touch('btn-web', 'touchend'));
  console.log(`web button swings: airborne ${s.y.toFixed(1)}m ${s.att && s.y > 0.3 ? 'PASS' : 'FAIL'} — ${JSON.stringify(s)}`);
  await waitForGame(page, 1500);
}

// fire button shoots without pointer lock
{
  await ev(() => { window.__debug.world.wanted = 0; });
  const shots = await ev(async () => {
    const d = window.__debug;
    const before = d.world.lastShot;
    window.__touch('btn-fire', 'touchstart');
    await new Promise((r) => setTimeout(r, 400));
    window.__touch('btn-fire', 'touchend');
    return d.world.lastShot !== before;
  });
  console.log(`fire button shoots: ${shots ? 'PASS' : 'FAIL'}`);
  await ev(() => { window.__debug.world.wanted = 0; });
}

// kiosk digit buttons appear at the casino
{
  await ev(() => {
    const d = window.__debug;
    d.player.inCar = null;
    d.player.pos.copy(d.shops.casinoPos);
    d.player.vel.set(0, 0, 0);
  });
  await waitForGame(page, 500);
  const shown = await ev(() =>
    [...document.querySelectorAll('.kioskbtn')].some((b) => b.style.display !== 'none'));
  console.log(`kiosk digit buttons: ${shown ? 'PASS' : 'FAIL'}`);
  await ev(() => { window.__debug.player.pos.x += 30; });
}

// FIGHT button appears at the arena ring and starts a wave
{
  await ev(() => {
    const d = window.__debug;
    d.player.pos.set(d.world.arena.pos.x + 3, 0, d.world.arena.pos.z);
    d.player.vel.set(0, 0, 0);
  });
  await waitForGame(page, 500);
  const visible = await ev(() => document.getElementById('btn-arena')?.style.display !== 'none');
  await ev(() => window.__touch('btn-arena', 'touchstart'));
  await waitForGame(page, 120);
  await ev(() => window.__touch('btn-arena', 'touchend'));
  await waitForGame(page, 400);
  const started = await ev(() => window.__debug.world.arena.active);
  console.log(`FIGHT button (arena): shown=${visible} started=${started} ${visible && started ? 'PASS' : 'FAIL'}`);
  await ev(() => { // walk out to end it
    const d = window.__debug;
    d.player.pos.set(d.world.arena.pos.x + 60, 0, d.world.arena.pos.z);
  });
  await waitForGame(page, 400);
}

// BUY button appears under a property beam and buys it
{
  await ev(() => {
    const d = window.__debug;
    d.world.money = 10000;
    delete d.world.props.owned.casino;
    const m = d.world.propMarks[0];
    m.beam.visible = true;
    d.player.pos.set(m.pos.x, 0, m.pos.z);
    d.player.vel.set(0, 0, 0);
  });
  await waitForGame(page, 500);
  const visible = await ev(() => document.getElementById('btn-buy')?.style.display !== 'none');
  await ev(() => window.__touch('btn-buy', 'touchstart'));
  await waitForGame(page, 120);
  await ev(() => window.__touch('btn-buy', 'touchend'));
  await waitForGame(page, 300);
  const owned = await ev(() => !!window.__debug.world.props.owned.casino);
  console.log(`BUY button (property): shown=${visible} bought=${owned} ${visible && owned ? 'PASS' : 'FAIL'}`);
}

// boat drives with the joystick
{
  await ev(() => window.__debug.boardBoat(0));
  await waitForGame(page, 200);
  await ev(() => { window.__touch('joypad', 'touchstart'); window.__touch('joypad', 'touchmove', 0, -40); });
  await waitForGame(page, 2000);
  const sp = await ev(() => window.__debug.player.inBoat?.vel.length() ?? 0);
  await ev(() => window.__touch('joypad', 'touchend'));
  console.log(`boat via joystick: ${sp.toFixed(1)} m/s ${sp > 6 ? 'PASS' : 'FAIL'}`);
  await ev(async () => {
    const d = window.__debug;
    d.player.inBoat.vel.set(0, 0, 0);
    await new Promise((r) => setTimeout(r, 150));
    d.exitBoat();
  });
}

await waitForGame(page, 800);
console.log(`mobile runtime errors: ${errors} ${errors === 0 ? 'PASS' : 'FAIL'}`);
await browser.close();
