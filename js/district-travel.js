// Preserve original activities outside the geographic extract. Travel works on
// desktop and touch without stealing an existing vehicle/combat input binding.
export function initDistrictTravel(world, isPlaying, stopSwing) {
  if (!world.city.osm) return;
  const button = document.createElement('button');
  button.id = 'district-travel';
  button.textContent = 'F8 · Ir para Arcade District (fictício)';
  button.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;max-width:45vw;padding:8px;color:white;background:#17202bdd;border:1px solid #8996a5;border-radius:5px;font:12px Arial';
  const travel = () => {
    if (!isPlaying() || world.wanted || world.player.inHeli || world.player.inBoat || world.player.inPlane) return;
    const player = world.player;
    const toArcade = player.pos.distanceTo(world.city.legacySpawn) > 800;
    const destination = toArcade ? world.city.legacySpawn : world.city.spawn;
    stopSwing();
    player.pos.copy(destination); player.vel.set(0, 0, 0); player.vy = 0;
    if (player.inCar) {
      const point = toArcade ? destination : world.city.roadPoint(destination, 0, 100);
      player.inCar.pos.copy(point); player.inCar.vel.set(0, 0, 0); player.pos.copy(point);
    }
    button.textContent = toArcade ? 'F8 · Ir para Cathedral Square' : 'F8 · Ir para Arcade District (fictício)';
  };
  button.title = 'Available during free roam, on foot or in a car, without wanted stars';
  button.addEventListener('click', travel);
  window.addEventListener('keydown', event => {
    if (event.code === 'F8' && !event.repeat) { event.preventDefault(); travel(); }
  });
  document.body.appendChild(button);
}
