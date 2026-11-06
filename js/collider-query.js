// Only explicitly immutable geographic bounds enter the grid. Moving game
// colliders (train carriages, etc.) are always read live in original array order.
const caches = new WeakMap();
const CELL = 64;
function indexFor(colliders) {
  let index = caches.get(colliders);
  if (index?.length === colliders.length) return index;
  const grid = new Map(), live = [];
  colliders.forEach((c, id) => {
    if (!c.spatialStatic) { live.push(id); return; }
    for (let x = Math.floor(c.x0 / CELL); x <= Math.floor(c.x1 / CELL); x++)
      for (let z = Math.floor(c.z0 / CELL); z <= Math.floor(c.z1 / CELL); z++) {
        const key = `${x},${z}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(id);
      }
  });
  index = { length: colliders.length, grid, live };caches.set(colliders, index);return index;
}
function candidates(index, pos, radius, after = -1) {
  const ids = new Set(index.live.filter(id => id > after));
  for (let x = Math.floor((pos.x - radius) / CELL); x <= Math.floor((pos.x + radius) / CELL); x++)
    for (let z = Math.floor((pos.z - radius) / CELL); z <= Math.floor((pos.z + radius) / CELL); z++)
      for (const id of index.grid.get(`${x},${z}`) || []) if (id > after) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}
export function* nearbyColliders(colliders, pos, radius) {
  const index = indexFor(colliders);
  if (!index.grid.size || !Number.isFinite(pos.x + pos.z + radius)) { yield* colliders; return; }
  let queue = candidates(index, pos, radius), cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++], x = pos.x, z = pos.z;
    yield colliders[id];
    // A push can enter a later collider outside the original query. Re-query
    // after a displacement, never revisit earlier entries (same as the old loop).
    if (pos.x !== x || pos.z !== z) { queue = candidates(index, pos, radius, id);cursor = 0; }
  }
}
