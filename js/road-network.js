// Geography and routing are independent of Three.js and shared by tests/tools.
export const ORIGIN = { lat: -43.5308, lon: 172.6366 };
export function project(lat, lon) {
  const r = Math.PI / 180 * 6371008.8;
  return [(lon - ORIGIN.lon) * r * Math.cos(ORIGIN.lat * Math.PI / 180),
    -(lat - ORIGIN.lat) * r];
}

export function leftOffset(a, b, distance) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  return length ? [dz / length * distance, -dx / length * distance] : [0, 0];
}

export function polygonContact(x, z, polygon, radius = 0) {
  let inside = false, distance = Infinity, nearest;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
    if (!length2) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2));
    const p = [a[0] + t * dx, a[1] + t * dz];
    const d = Math.hypot(x - p[0], z - p[1]);
    if (d < distance) { distance = d; nearest = p; }
  }
  if (!inside && distance >= radius) return null;
  const sign = inside ? -1 : 1;
  const nx = distance > 1e-8 ? sign * (x - nearest[0]) / distance : 1;
  const nz = distance > 1e-8 ? sign * (z - nearest[1]) / distance : 0;
  return { nx, nz, depth: inside ? distance + radius : radius - distance };
}

const NO_CARS = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway',
  'bridleway', 'construction', 'proposed', 'platform', 'corridor', 'motorway', 'motorway_link']);
export function permitsCars(tags) {
  const access = tags.motorcar ?? tags.motor_vehicle ?? tags.vehicle ?? tags.access;
  return !!tags.highway && !NO_CARS.has(tags.highway) && !['no', 'private'].includes(access);
}

export function buildNetwork(roads, { walking = false } = {}) {
  const nodes = new Map(), edges = [], outgoing = new Map();
  const add = (road, i, reverse) => {
    const j = reverse ? i - 1 : i + 1;
    const from = String(road.nodes[i]), to = String(road.nodes[j]);
    const a = road.points[i], b = road.points[j];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.05) return;
    nodes.set(from, a); nodes.set(to, b);
    const edge = { id: edges.length, from, to, a, b, length, roadId: road.id,
      name: road.tags.name || '', width: road.width || 8, walking: !permitsCars(road.tags) };
    edges.push(edge);
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(edge);
  };
  for (const road of roads) {
    if (!walking && !permitsCars(road.tags)) continue;
    if (walking && ['no', 'private'].includes(road.tags.foot ?? road.tags.access)) continue;
    if (walking && ['motorway', 'motorway_link', 'construction', 'proposed'].includes(road.tags.highway)) continue;
    const one = walking ? 'no' : road.tags.oneway ?? (road.tags.junction === 'roundabout' ? 'yes' : 'no');
    for (let i = 0; i < road.points.length - 1; i++) {
      if (one !== '-1') add(road, i, false);
      if (!['yes', '1', 'true'].includes(one)) add(road, i + 1, true);
    }
  }
  return { nodes, edges, outgoing };
}

export function nearestEdge(network, point) {
  let best = null, distance = Infinity;
  for (const edge of network.edges) {
    const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - edge.a[0]) * dx + (point[1] - edge.a[1]) * dz) / edge.length ** 2));
    const p = [edge.a[0] + t * dx, edge.a[1] + t * dz];
    const d = Math.hypot(p[0] - point[0], p[1] - point[1]);
    if (d < distance) { distance = d; best = { edge, point: p, t, distance }; }
  }
  return best;
}

export function findRoute(network, from, to) {
  from = String(from); to = String(to);
  const queue = [from], seen = new Set(queue), previous = new Map();
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (node === to) {
      const route = [];
      for (let n = to; n !== from;) { const edge = previous.get(n); route.unshift(edge); n = edge.from; }
      return route;
    }
    for (const edge of network.outgoing.get(node) || []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to); previous.set(edge.to, edge); queue.push(edge.to);
    }
  }
  return null;
}
