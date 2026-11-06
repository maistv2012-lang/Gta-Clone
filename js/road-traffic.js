import { leftOffset } from './road-network.js';

export function lane(edge, t, parking = false) {
  const offset = leftOffset(edge.a, edge.b, parking ? edge.width / 2 - 1 : Math.min(2.5, edge.width / 4));
  return [edge.a[0] + (edge.b[0] - edge.a[0]) * t + offset[0],
    edge.a[1] + (edge.b[1] - edge.a[1]) * t + offset[1]];
}

export function advanceTraffic(vehicle, network, distance, random = Math.random) {
  const ai = vehicle.ai;
  for (let i = 0; i < 100 && distance > 0; i++) {
    const a = ai.turn?.a || lane(ai.edge, 0), b = ai.turn?.b || lane(ai.edge, 1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const move = Math.min(distance, Math.max(0, length * (1 - ai.t)));
    ai.t = length ? Math.min(1, ai.t + move / length) : 1;
    vehicle.pos.x = a[0] + (b[0] - a[0]) * ai.t;
    vehicle.pos.z = a[1] + (b[1] - a[1]) * ai.t;
    if (length > 0.01) {
      ai.fx = (b[0] - a[0]) / length; ai.fz = (b[1] - a[1]) / length;
      vehicle.heading = Math.atan2(ai.fx, ai.fz);
      vehicle.mesh.rotation.y = vehicle.heading;
    }
    distance -= move;
    if (ai.t < 1) break;
    if (ai.turn) { ai.turn = null; ai.t = 0; continue; }
    const outgoing = network.outgoing.get(ai.edge.to) || [];
    const forward = outgoing.filter(e => e.to !== ai.edge.from);
    const candidates = forward.length ? forward : outgoing;
    if (!candidates.length) { ai.speed = 0; break; }
    const next = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    ai.turn = { a: b, b: lane(next, 0) };
    ai.edge = next; ai.t = 0;
  }
}
