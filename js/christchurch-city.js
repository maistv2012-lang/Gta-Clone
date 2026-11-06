import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildNetwork, nearestEdge, leftOffset, findRoute, polygonContact } from './road-network.js';

function surface(scene, points, color, y, holes = []) {
  if (points.length < 3) return;
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const ring of holes) shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  mesh.position.y = y; mesh.receiveShadow = true; scene.add(mesh);
}

function strip(scene, a, b, width, color, y) {
  const offset = leftOffset(a, b, width / 2);
  surface(scene, [[a[0] + offset[0], a[1] + offset[1]], [b[0] + offset[0], b[1] + offset[1]],
    [b[0] - offset[0], b[1] - offset[1]], [a[0] - offset[0], a[1] - offset[1]]], color, y);
}

export async function addChristchurch(targetScene, city, data) {
  const checkpoint = async message => {
    window.__gtcBoot?.progress(message);
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  // Merge static surfaces in spatial chunks for mobile draw-call budgets.
  const buckets = new Map();
  const scene = { add(mesh) {
    mesh.updateMatrix();
    mesh.geometry.applyMatrix4(mesh.matrix);
    mesh.geometry.computeBoundingBox();
    const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    const key = `${Math.floor(center.x / 300)},${Math.floor(center.z / 300)},${mesh.material.color.getHex()},${!!mesh.geometry.index}`;
    if (!buckets.has(key)) buckets.set(key, { material: mesh.material, geometries: [], shadow: mesh.castShadow });
    const bucket = buckets.get(key);
    if (mesh.material !== bucket.material) mesh.material.dispose();
    bucket.geometries.push(mesh.geometry);
    // Compact intermediate buffers instead of retaining tens of thousands of
    // temporary geometries until the end of mobile initialization.
    if (bucket.geometries.length >= 64) {
      const merged = mergeGeometries(bucket.geometries, false);
      if (!merged) throw new Error('Unable to batch Christchurch geometry');
      bucket.geometries.forEach(g => g.dispose());
      bucket.geometries = [merged];
    }
  } };
  city.osm = data;
  city.network = buildNetwork(data.roads);
  city.walkNetwork = buildNetwork(data.roads, { walking: true });
  city.realColliders = [];
  for (const [index, area] of data.areas.entries()) {
    if (index % 128 === 0) await checkpoint(`Preparando edifícios e áreas: ${index}/${data.areas.length}…`);
    if (!area.tags.building) {
      surface(scene, area.points, area.tags.natural === 'water' ? 0x477d91 : 0x507644, 0.02, area.holes || []);
      continue;
    }
    // Broad-phase AABBs and polygon narrow-phase reuse the existing collision API.
    const shape = new THREE.Shape(area.points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const height = Math.max(2, Math.min(180, area.height));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x969384, roughness: 0.9 }));
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    const xs = area.points.map(p => p[0]), zs = area.points.map(p => p[1]);
    const collider = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), h: height + 0.3,
      polygon: area.points };
    city.colliders.push(collider); city.realColliders.push(collider);
  }
  for (const [index, road] of data.roads.entries()) {
    if (index % 128 === 0) await checkpoint(`Preparando ruas: ${index}/${data.roads.length}…`);
    const pedestrian = ['footway', 'pedestrian', 'path', 'cycleway', 'steps'].includes(road.tags.highway);
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i];
      if (!pedestrian) strip(scene, a, b, road.width + 3, 0x969c96, 0.05);
      strip(scene, a, b, road.width, pedestrian ? 0xb1a58e : 0x363e42, 0.08);
    }
  }
  const square = data.roads.find(r => r.tags.name === 'Cathedral Square');
  const start = nearestEdge(city.walkNetwork, data.landmarks?.find(p => p.name === 'Cathedral Square')?.point || square?.points[0] || [0, 0]);
  city.legacySpawn = city.spawn.clone();
  city.spawn.set(...[start.point[0], 0, start.point[1]]);
  // Return safe points for cars and sidewalk activities without assuming a grid.
  city.roadPoint = (near = city.spawn, min = 0, max = Infinity) => {
    const candidates = city.network.edges.filter(e => {
      const d = Math.hypot((e.a[0] + e.b[0]) / 2 - near.x, (e.a[1] + e.b[1]) / 2 - near.z);
      return d >= min && d <= max;
    });
    const edge = candidates[(Math.random() * candidates.length) | 0] || nearestEdge(city.network, [near.x, near.z]).edge;
    const off = leftOffset(edge.a, edge.b, Math.min(2.5, edge.width / 4));
    return new THREE.Vector3((edge.a[0] + edge.b[0]) / 2 + off[0], 0, (edge.a[1] + edge.b[1]) / 2 + off[1]);
  };
  city.nearestRoad = (position) => nearestEdge(city.network, [position.x, position.z]);
  const reserved = [];
  city.safePoint = (position, reserve = false) => {
    // Prefer a nearby walkable edge, rejecting building footprints and keeping
    // roadside kiosks outside the carriageway. Search several candidates so a
    // plaza touching a building doesn't put the player inside its walls.
    const candidates = city.walkNetwork.edges.flatMap(edge => {
      const off = leftOffset(edge.a, edge.b, edge.walking ? 0 : edge.width / 2 + 2);
      const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1];
      const closest = Math.max(0.1, Math.min(0.9, ((position.x - edge.a[0]) * dx + (position.z - edge.a[1]) * dz) / edge.length ** 2));
      return [closest, 0.2, 0.5, 0.8].map(t => {
        const x = edge.a[0] + dx * t + off[0], z = edge.a[1] + dz * t + off[1];
        return { x, z, d: Math.hypot(x - position.x, z - position.z) };
      });
    }).sort((a, b) => a.d - b.d);
    const point = candidates.find(p => (!reserve || reserved.every(r => Math.hypot(r.x - p.x, r.z - p.z) > 10)) && !city.realColliders.some(c => p.x >= c.x0 - 3 && p.x <= c.x1 + 3 && p.z >= c.z0 - 3 && p.z <= c.z1 + 3 && polygonContact(p.x, p.z, c.polygon, 3)));
    if (reserve && point) reserved.push(point);
    return point ? new THREE.Vector3(point.x, 0, point.z) : city.legacySpawn.clone();
  };
  city.spawn.copy(city.safePoint(city.spawn));
  city.route = (from, to) => {
    const a = city.nearestRoad(from), b = city.nearestRoad(to);
    return findRoute(city.network, a.edge.to, b.edge.from);
  };
  // Compact walking loops on real paths retain the existing pedestrian logic.
  city.pedRects = city.walkNetwork.edges.filter((_, i) => i % 4 === 0).map(e => {
    const x = (e.a[0] + e.b[0]) / 2, z = (e.a[1] + e.b[1]) / 2;
    const offset = leftOffset(e.a, e.b, e.walking ? 0 : e.width / 2 + 1);
    return { x0: x + offset[0] - 0.4, x1: x + offset[0] + 0.4,
      z0: z + offset[1] - 0.4, z1: z + offset[1] + 0.4 };
  });
  await checkpoint('Finalizando a geometria de Christchurch…');
  let bucketIndex = 0;
  for (const bucket of buckets.values()) {
    if (bucketIndex++ % 32 === 0) await checkpoint('Finalizando a geometria de Christchurch…');
    const geometry = mergeGeometries(bucket.geometries, false);
    if (!geometry) throw new Error('Unable to batch Christchurch geometry');
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.receiveShadow = true; mesh.castShadow = bucket.shadow;
    targetScene.add(mesh);
    bucket.geometries.forEach(g => g.dispose());
  }
}

const roadLayers = new WeakMap();
const roadAtlases = new WeakMap();
export function drawRoads(context, city, transform, scale, view = null) {
  if (!city.osm) return;
  const size = context.canvas.width;
  if (view) {
    // A reusable world atlas avoids redrawing 9,000 ways every frame while the
    // minimap follows the player. The full map keeps its own labelled layer.
    const half = city.legacyBounds.max, extent = half * 2 + 30;
    let atlas = roadAtlases.get(city);
    if (!atlas) {
      atlas = document.createElement('canvas'); atlas.width = atlas.height = 2048;
      const g = atlas.getContext('2d'); g.strokeStyle = context.strokeStyle;
      const sc = atlas.width / extent;
      drawRoads(g, city, (x, z) => [(x + half + 15) * sc, (z + half + 15) * sc], sc);
      roadAtlases.set(city, atlas);
    }
    const sc = atlas.width / extent;
    context.drawImage(atlas, (view.minX + half + 15) * sc, (view.minZ + half + 15) * sc,
      view.extent * sc, view.extent * sc, 0, 0, size, context.canvas.height);
    return;
  }
  let cached = roadLayers.get(context.canvas);
  if (cached?.city === city && cached.size === size) { context.drawImage(cached.canvas, 0, 0); return; }
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = context.canvas.height;
  const layer = canvas.getContext('2d');
  layer.strokeStyle = context.strokeStyle;
  for (const road of city.osm.roads) {
    layer.lineWidth = Math.max(1, road.width * scale);
    layer.beginPath();
    road.points.forEach(([x, z], i) => {
      const p = transform(x, z);
      if (i) layer.lineTo(...p); else layer.moveTo(...p);
    });
    layer.stroke();
  }
  layer.font = 'bold 11px Arial'; layer.fillStyle = '#ffe5a0';
  const labels = new Set();
  for (const landmark of size < 1500 ? city.osm.landmarks || [] : []) {
    if (labels.has(landmark.name)) continue;
    labels.add(landmark.name);
    const [x, y] = transform(...landmark.point);
    layer.fillText(landmark.name, x + 3, y - 3);
  }
  roadLayers.set(context.canvas, { city, size, canvas });
  context.drawImage(canvas, 0, 0);
}
