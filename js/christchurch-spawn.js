import { leftOffset, nearestEdge, polygonContact } from './road-network.js';

// Choose once during map preparation; never send a failed real-map spawn to Arcade.
export function cathedralSpawn(data, network, colliders) {
  const square = data.roads.find(r => r.tags.name === 'Cathedral Square');
  const anchor = data.landmarks?.find(p => p.name === 'Cathedral Square')?.point || square?.points[0];
  if (!anchor || !square) throw new Error('Cathedral Square não está presente no mapa real.');
  const reference = nearestEdge(network, anchor);
  if (!reference) throw new Error('Cathedral Square não possui acesso caminhável.');
  const reachable = new Set([reference.edge.from]), queue = [reference.edge.from];
  for (let i = 0; i < queue.length; i++) for (const edge of network.outgoing.get(queue[i]) || []) {
    if (!reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
  }
  const candidates = [];
  for (const edge of network.edges) {
    if (!reachable.has(edge.from)) continue;
    const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1];
    const t = Math.max(.1, Math.min(.9, ((anchor[0] - edge.a[0]) * dx + (anchor[1] - edge.a[1]) * dz) / edge.length ** 2));
    // Pedestrian paths: their centre. Roads: the middle of the rendered sidewalk.
    const off = leftOffset(edge.a, edge.b, edge.walking ? 0 : edge.width / 2 + .75);
    for (const along of [t, .2, .5, .8]) {
      const x = edge.a[0] + dx * along + off[0], z = edge.a[1] + dz * along + off[1];
      const distance = Math.hypot(x - anchor[0], z - anchor[1]);
      if (distance > 60 || (edge.name !== 'Cathedral Square' && !edge.walking)) continue;
      if (colliders.some(c => c.polygon ? polygonContact(x, z, c.polygon, 3) :
        x >= c.x0 - 3 && x <= c.x1 + 3 && z >= c.z0 - 3 && z <= c.z1 + 3)) continue;
      if (data.areas.some(a => a.tags.natural === 'water' && polygonContact(x, z, a.points, .5) &&
        !(a.holes || []).some(h => polygonContact(x, z, h)))) continue;
      candidates.push({ x, z, edge, distance, score: distance + (edge.walking ? 0 : 10) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) throw new Error('Não foi encontrado um ponto inicial livre e caminhável em Cathedral Square.');
  return candidates[0];
}
