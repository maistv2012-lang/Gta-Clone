import { facadeStyle } from './facade-style.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityMaterials, worldUV } from './city-materials.js';
import { nearestEdge, leftOffset, polygonContact } from './road-network.js';

export function boundsOf(area) {
  const xs = area.points.map((p) => p[0]),
    zs = area.points.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
export function demonstrationAreas(data) {
  return data.areas
    .filter((a) => a.tags.building)
    .map((a) => {
      const b = boundsOf(a);
      return { area: a, distance: Math.hypot((b.x0 + b.x1) / 2 - 24, (b.z0 + b.z1) / 2 + 36) };
    })
    .filter((a) => a.distance < 230)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 24)
    .map((a) => a.area);
}
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
function batch() {
  const parts = new Map(),
    transform = new THREE.Object3D();
  return {
    add(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, angle = 0) {
      transform.position.set(x, y, z);
      transform.rotation.set(0, angle, 0);
      transform.scale.set(sx, sy, sz);
      transform.updateMatrix();
      const copy = geometry.clone().applyMatrix4(transform.matrix);
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material).push(copy);
    },
    box(material, x, y, z, sx, sy, sz, angle = 0) {
      this.add(unitBox, material, x, y, z, sx, sy, sz, angle);
    },
    finish() {
      const group = new THREE.Group();
      for (const [material, list] of parts) {
        const geometry = mergeGeometries(list, false);
        list.forEach((g) => g.dispose());
        if (!geometry) throw new Error('Unable to batch Cathedral Square details');
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      return group;
    },
  };
}
function arch(width, height) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(-width / 2, height * 0.62);
  s.quadraticCurveTo(-width * 0.45, height * 0.83, 0, height);
  s.quadraticCurveTo(width * 0.45, height * 0.83, width / 2, height * 0.62);
  s.lineTo(width / 2, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s, 6);
}
function gable(x0, x1, z0, z1, wall, top) {
  const mid = (z0 + z1) / 2;
  const points = [
    x0,
    wall,
    z0,
    x1,
    wall,
    z0,
    x1,
    top,
    mid,
    x0,
    wall,
    z0,
    x1,
    top,
    mid,
    x0,
    top,
    mid,
    x0,
    top,
    mid,
    x1,
    top,
    mid,
    x1,
    wall,
    z1,
    x0,
    top,
    mid,
    x1,
    wall,
    z1,
    x0,
    wall,
    z1,
    x0,
    wall,
    z1,
    x0,
    wall,
    z0,
    x0,
    top,
    mid,
    x1,
    wall,
    z0,
    x1,
    wall,
    z1,
    x1,
    top,
    mid,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return worldUV(g, 3);
}
function churchBase(area, mats) {
  const shape = new THREE.Shape(area.points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 16, bevelEnabled: false });
  body.rotateX(-Math.PI / 2);
  worldUV(body, 3);
  const group = new THREE.Group();
  const wall = new THREE.Mesh(body, mats.stone);
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
  const roof = new THREE.Mesh(gable(11, 64, 4.5, 27.4, 16, area.height), mats.roof);
  roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  return group;
}
function churchDetails(area, mats) {
  const b = batch(),
    window = arch(2.3, 7.2),
    outer = arch(2.9, 7.8);
  for (let x = 17; x < 63; x += 6)
    for (const [z, angle] of [
      [4.17, Math.PI],
      [27.85, 0],
    ]) {
      b.add(outer, mats.trim, x, 5.4, z, 1, 1, 1, angle);
      b.add(window, mats.glass, x, 5.65, z + (angle ? -0.035 : 0.035), 1, 1, 1, angle);
      b.box(mats.trim, x, 9.1, z + (angle ? -0.08 : 0.08), 0.12, 6.6, 0.14);
      for (let j = 0; j < 3; j++)
        b.box(mats.trim, x, 6.8 + j * 1.7, z + (angle ? -0.08 : 0.08), 2.1, 0.1, 0.15);
    }
  for (let x = 12; x < 65; x += 6)
    for (const z of [3.8, 28.1]) {
      b.box(mats.stone, x, 7, z, 0.85, 14, 1.5);
      b.box(mats.trim, x, 12.6, z, 1.05, 0.25, 1.8);
      b.box(mats.trim, x, 0.9, z, 1.2, 1.8, 2.1);
    }
  // West entry and rose window; no invented intact pre-earthquake spire.
  const door = arch(3.6, 6.2);
  b.add(door, mats.wood, 4.6, 0.1, 16, 1, 1, 1, -Math.PI / 2);
  const ring = new THREE.TorusGeometry(2.1, 0.22, 6, 24);
  b.add(ring, mats.trim, 4.5, 11.5, 16, 1, 1, 1, -Math.PI / 2);
  const disc = new THREE.CircleGeometry(1.9, 24);
  b.add(disc, mats.glass, 4.55, 11.5, 16, 1, 1, 1, -Math.PI / 2);
  for (let j = 0; j < 8; j++) {
    const a = (j * Math.PI) / 4;
    b.box(mats.trim, 4.4, 11.5 + Math.sin(a) * 1.1, 16 + Math.cos(a) * 1.1, 0.14, 0.12, 2.2, 0);
  }
  // Lightweight restoration scaffold within the inaccessible building footprint.
  for (let x = 8.8; x < 20; x += 2.5)
    for (const z of [-4.8, 3.2]) b.add(unitCylinder, mats.metal, x, 9, z, 0.065, 18, 0.065);
  for (let y = 3; y < 19; y += 3) {
    b.box(mats.metal, 14, y, -4.8, 11, 0.1, 0.1);
    b.box(mats.metal, 14, y, 3.2, 11, 0.1, 0.1);
    b.box(mats.wood, 14, y, -0.8, 10.8, 0.12, 7.8);
  }
  window.dispose();
  outer.dispose();
  door.dispose();
  ring.dispose();
  disc.dispose();
  return b.finish();
}
export function facadeLevels(area) {
  const source = Number.parseInt(area.tags['building:levels'], 10);
  return Math.max(1, Math.min(20, source > 0 ? source : Math.floor(area.height / 3.5)));
}

function facade(area, mats, detailed, onlyEdge = null) {
  const b = batch(),
    height = area.height,
    library = /Tūranga/.test(area.tags.name || '');
  const style = facadeStyle(area), modern = style.modern;
  const frame = library ? mats.gold : mats.trim;
  const floors = facadeLevels(area);
  const pts = area.points,
    unique = pts.length - (pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1] ? 1 : 0);
  let winding = 0;
  for (let i = 0; i < unique; i++) {
    const a = pts[i],
      c = pts[(i + 1) % unique];
    winding += a[0] * c[1] - c[0] * a[1];
  }
  for (let i = 0; i < unique; i++) {
    if (onlyEdge !== null && i !== onlyEdge) continue;
    const a = pts[i],
      c = pts[(i + 1) % unique],
      dx = c[0] - a[0],
      dz = c[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 3.5) continue;
    const outward = winding > 0 ? 1 : -1,
      nx = (dz / length) * outward,
      nz = (-dx / length) * outward;
    const angle = Math.atan2(nx, nz),
      count = Math.max(1, Math.floor(length / style.bayWidth)),
      spacing = length / count;
    for (let floor = 0; floor < floors; floor++)
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          x = a[0] + dx * t,
          z = a[1] + dz * t,
          y = 1.9 + (floor * (height - 1)) / floors;
        const width = Math.min(spacing * 0.66, style.windowWidth),
          wh = floor === 0 ? 2.5 : 1.9;
        b.box(frame, x + nx * 0.12, y, z + nz * 0.12, width + 0.28, wh + 0.28, 0.2, angle);
        b.box(mats.glass, x + nx * 0.24, y, z + nz * 0.24, width, wh, 0.065, angle);
        if (detailed) {
          // Ground-floor transoms and flanking reveals add actual facade depth.
          if (floor === 0) {
            b.box(frame,x+nx*.3,y+.65,z+nz*.3,width,.075,.085,angle);
            for (const side of [-1,1]) {
              const along = side*(width/2+.2);
              b.box(mats.limestone,x+nx*.11+dx/length*along,y,z+nz*.11+dz/length*along,.12,wh+.5,.34,angle);
            }
          }
          // Sills and lintels establish depth without individual draw calls.
          if (style.recessed) b.box(mats.limestone, x + nx * .16, y + wh / 2 + .2, z + nz * .16, width + .65, .2, .4, angle);
          b.box(frame, x + nx * 0.3, y, z + nz * 0.3, 0.07, wh, 0.075, angle);
          b.box(frame, x + nx * 0.3, y - wh * 0.15, z + nz * 0.3, width, 0.065, 0.075, angle);
          b.box(
            frame,
            x + nx * 0.22,
            y - wh / 2 - 0.13,
            z + nz * 0.22,
            width + 0.5,
            0.16,
            0.55,
            angle
          );
        }
      }
    if (detailed && style.pilasters)
      for (const t of [.035, .965]) b.box(frame, a[0]+dx*t+nx*.18, height/2, a[1]+dz*t+nz*.18, .38, height, .42, angle);
    for (const y of [height - 0.2, 0.35])
      b.box(
        frame,
        (a[0] + c[0]) / 2 + nx * 0.12,
        y,
        (a[1] + c[1]) / 2 + nz * 0.12,
        length,
        0.35,
        0.4,
        angle
      );
    if (detailed) {
      // Stepped cornice remains below source roof height and uses existing batches.
      const x=(a[0]+c[0])/2,z=(a[1]+c[1])/2;
      b.box(frame,x+nx*.16,height-.55,z+nz*.16,length,.15,.56,angle);
      b.box(mats.limestone,x+nx*.14,height-.08,z+nz*.14,length,.12,.62,angle);
    }
    if (detailed && modern)
      for (let j = 0; j < count * 2; j++) {
        const t = (j + 0.5) / (count * 2);
        b.box(
          frame,
          a[0] + dx * t + nx * 0.4,
          height / 2,
          a[1] + dz * t + nz * 0.4,
          0.12,
          height - 0.6,
          0.5,
          angle
        );
      }
    if (detailed && length > 12) {
      const x = (a[0] + c[0]) / 2,
        z = (a[1] + c[1]) / 2;
      b.box(mats.metal, x + nx * 0.3, 1.35, z + nz * 0.3, 1.8, 2.7, 0.2, angle);
      b.box(mats.glass, x + nx * 0.42, 1.5, z + nz * 0.42, 1.4, 2.1, 0.08, angle);
      b.box(frame, x + nx * 0.65, 3.2, z + nz * 0.65, 3.2, 0.18, 1.1, angle);
      b.box(mats.metal, x+nx*.49, 1.5, z+nz*.49, .055, 2.1, .05, angle);
      b.box(frame, x+nx*.52, 1.1, z+nz*.52, .45, .055, .08, angle);
    }
  }
  return b.finish();
}
export async function createCityDetailing(scene, city, data) {
  window.__gtcBoot?.progress('Carregando materiais PBR de Cathedral Square…');
  const mats = await cityMaterials();
  // Infill the otherwise unclassified ground inside the named Square approaches.
  // Explicit OSM parks/water, buildings, sidewalks and roads retain their higher layers.
  const points = data.roads
    .filter((r) => r.tags.name === 'Cathedral Square')
    .flatMap((r) => r.points)
    .filter((p) => Math.hypot(p[0] - 24, p[1] + 36) < 200)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [],
    upper = [];
  for (const p of points) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...points].reverse()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length > 2) {
    const shape = new THREE.Shape(hull.map(([x, z]) => new THREE.Vector2(x, -z))),
      geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    worldUV(geometry, 3);
    const mesh = new THREE.Mesh(geometry, mats.paving);
    mesh.position.y = 0.005;
    mesh.receiveShadow = true;
    mesh.name = 'Square pavement infill derived from OSM approaches';
    scene.add(mesh);
  }

  mats.gold = new THREE.MeshStandardMaterial({ color: 0xb3a26c, metalness: 0.5, roughness: 0.48 });
  const selected = new Set(demonstrationAreas(data).map((a) => a.id)),
    jobs = [],
    lods = [],
    instanced = [];
  let profile = 'medium',
    built = 0;
  const settings = { low: [35, 120], medium: [85, 220], high: [160, 360] };
  const stats = {
    buildings: selected.size,
    source: 'OSM footprints + original procedural geometry',
    props: 0,
    trees: 0,
  };
  const addBuilding = (area) => {
    const church = area.tags.building === 'cathedral';
    let base;
    if (church) base = churchBase(area, mats);
    else {
      const shape = new THREE.Shape(area.points.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: area.height,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);
      worldUV(geometry, 3);
      base = new THREE.Group();
      const mesh = new THREE.Mesh(
        geometry,
        mats[facadeStyle(area).finish]
      );
      mesh.castShadow = mesh.receiveShadow = true;
      base.add(mesh);
    }
    const bounds = boundsOf(area),
      cx = (bounds.x0 + bounds.x1) / 2,
      cz = (bounds.z0 + bounds.z1) / 2;
    base.position.set(-cx, 0, -cz);
    const near = new THREE.Group(),
      middle = new THREE.Group(),
      far = new THREE.Group();
    near.add(base);
    middle.add(base.clone());
    far.add(base.clone());
    const lod = new THREE.LOD();
    lod.name = `OSM ${area.id} · ${area.tags.name || 'Square facade'}`;
    lod.position.set(cx, 0, cz);
    lod.addLevel(near, 0);
    lod.addLevel(middle, settings[profile][0]);
    lod.addLevel(far, settings[profile][1]);
    scene.add(lod);
    lods.push(lod);
    const highChunks = [],
      mediumChunks = [];
    const compact = (chunks) => {
      const groups = new Map();
      for (const part of chunks)
        for (const mesh of part.children) {
          if (!groups.has(mesh.material)) groups.set(mesh.material, []);
          groups.get(mesh.material).push(mesh.geometry);
        }
      const group = new THREE.Group();
      for (const [material, geometries] of groups) {
        const geometry = mergeGeometries(geometries, false);
        geometries.forEach((g) => g.dispose());
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      }
      group.position.set(-cx, 0, -cz);
      return group;
    };
    if (church)
      jobs.push(() => {
        const detail = churchDetails(area, mats);
        detail.position.set(-cx, 0, -cz);
        near.add(detail);
        middle.add(detail.clone());
      });
    else {
      for (let edge = 0; edge < area.points.length - 1; edge++) {
        if (
          Math.hypot(
            area.points[edge + 1][0] - area.points[edge][0],
            area.points[edge + 1][1] - area.points[edge][1]
          ) < 3.5
        )
          continue;
        jobs.push(() => {
          highChunks.push(facade(area, mats, true, edge));
          mediumChunks.push(facade(area, mats, false, edge));
        });
      }
      jobs.push(() => {
        near.add(compact(highChunks));
        middle.add(compact(mediumChunks));
      });
    }
  };
  // Furniture stays clear of the spawn, landmark access points and road lanes.
  const safeProp = (x, z, r = 0.5) =>
    Math.hypot(x - city.spawn.x, z - city.spawn.z) > 7 &&
    !(data.landmarks || []).some((l) => Math.hypot(x - l.point[0], z - l.point[1]) < 3) &&
    !city.colliders.some(
      (c) =>
        x >= c.x0 - r &&
        x <= c.x1 + r &&
        z >= c.z0 - r &&
        z <= c.z1 + r &&
        (c.polygon ? polygonContact(x, z, c.polygon, r) : true)
    );
  const furniture = () => {
    const b = batch(),
      seen = [],
      signs = new Set();
    for (const edge of city.network.edges) {
      if (Math.hypot(edge.a[0] - 24, edge.a[1] + 36) > 210 || edge.length < 18) continue;
      const off = leftOffset(edge.a, edge.b, edge.width / 2 + 1.2),
        x = (edge.a[0] + edge.b[0]) / 2 + off[0],
        z = (edge.a[1] + edge.b[1]) / 2 + off[1];
      if (!safeProp(x, z, 0.3) || seen.some((p) => Math.hypot(p[0] - x, p[1] - z) < 23)) continue;
      seen.push([x, z]);
      if (edge.name && !signs.has(edge.name) && signs.size < 8) {
        signs.add(edge.name);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 48;
        const context = canvas.getContext('2d');
        context.fillStyle = '#233b34';
        context.fillRect(0, 0, 256, 48);
        context.strokeStyle = '#d7ded7';
        context.strokeRect(2, 2, 252, 44);
        context.fillStyle = '#f0f0e8';
        context.font = 'bold 21px Arial';
        context.textAlign = 'center';
        context.fillText(edge.name, 128, 31, 242);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(2.2, 0.42),
          new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, side: THREE.DoubleSide })
        );
        sign.position.set(x, 2.8, z + 0.12);
        scene.add(sign);
      }
      const angle = Math.atan2(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]);
      b.add(unitCylinder, mats.metal, x, 3.8, z, 0.085, 7.6, 0.085);
      b.box(mats.metal, x, 7.5, z, 1.4, 0.12, 0.12, angle);
      b.box(mats.white, x, 7.42, z + 0.4, 0.65, 0.12, 0.35, angle);
      city.colliders.push({ x0: x - 0.16, x1: x + 0.16, z0: z - 0.16, z1: z + 0.16, h: 7.6 });
      stats.props++;
      if (seen.length > 28) break;
    }
    for (const [x, z, angle] of [
      [-5, -35, 0],
      [40, -38, 0],
      [-28, 3, Math.PI / 2],
      [-45, -32, 0],
      [85, 45, 0],
    ]) {
      if (!safeProp(x, z, 2)) continue;
      const road = city.nearestRoad({ x, z });
      if (road.distance < road.edge.width / 2 + 2) continue;
      for (let j = 0; j < 5; j++)
        b.box(mats.wood, x, 0.55 + j * 0.005, z + (j - 2) * 0.11, 2.4, 0.065, 0.09, angle);
      b.box(mats.wood, x, 0.95, z + 0.32, 2.4, 0.65, 0.09, angle);
      for (const dx of [-0.8, 0.8]) b.box(mats.metal, x + dx, 0.28, z, 0.07, 0.55, 0.58, angle);
      city.colliders.push({ x0: x - 1.3, x1: x + 1.3, z0: z - 0.5, z1: z + 0.5, h: 1.3 });
      stats.props++;
    }
    const seenSegments = new Set();
    const tags = new Map(data.roads.map((r) => [r.id, r.tags]));
    for (const edge of city.network.edges) {
      if (Math.hypot(edge.a[0] - 24, edge.a[1] + 36) > 230) continue;
      const key = [edge.from, edge.to].sort().join('/');
      if (seenSegments.has(key)) continue;
      seenSegments.add(key);
      const dx = (edge.b[0] - edge.a[0]) / edge.length,
        dz = (edge.b[1] - edge.a[1]) / edge.length,
        angle = Math.atan2(dx, dz);
      if (edge.width > 5.5 && !['yes', '1', '-1'].includes(tags.get(edge.roadId)?.oneway))
        for (let d = 3; d < edge.length - 2; d += 9)
          b.box(
            mats.white,
            edge.a[0] + dx * d,
            0.096,
            edge.a[1] + dz * d,
            0.1,
            0.012,
            Math.min(3, edge.length - d),
            angle
          );
      if (edge.length > 6)
        for (const sign of [-1, 1]) {
          const off = leftOffset(edge.a, edge.b, sign * (edge.width / 2 + 0.15));
          b.box(
            mats.trim,
            (edge.a[0] + edge.b[0]) / 2 + off[0],
            0.14,
            (edge.a[1] + edge.b[1]) / 2 + off[1],
            0.18,
            0.16,
            edge.length - 4,
            angle
          );
        }
    }
    for (const road of data.roads.filter((r) => r.tags.footway === 'crossing')) {
      const a = road.points[0],
        c = road.points.at(-1),
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (Math.hypot(a[0] - 24, a[1] + 36) > 230 || len < 2) continue;
      const dx = (c[0] - a[0]) / len,
        dz = (c[1] - a[1]) / len,
        angle = Math.atan2(dx, dz);
      for (let d = 0.5; d < len; d += 1.2)
        b.box(mats.white, a[0] + dx * d, 0.105, a[1] + dz * d, 2.6, 0.018, 0.5, angle);
    }
    scene.add(b.finish());
  };
  const trees = () => {
    const positions = [];
    // Streetside trees, screened against actual buildings, lanes and walking paths.
    for (let x = -135; x < 155; x += 23)
      for (let z = -150; z < 140; z += 29) {
        const road = city.nearestRoad({ x, z });
        if (road.distance < road.edge.width / 2 + 4 || road.distance > 28 || !safeProp(x, z, 3))
          continue;
        const walk = nearestEdge(city.walkNetwork, [x, z]);
        if (walk.distance < 3) continue;
        positions.push([x, z]);
      }
    // Park trees remain inside the real Hagley polygon; paths remain open.
    const park = data.areas.find((a) => /Hagley Park North/.test(a.tags.name || ''));
    if (park) {
      const b = boundsOf(park);
      for (let x = b.x0; x < b.x1; x += 52)
        for (let z = b.z0; z < b.z1; z += 57) {
          if (
            !polygonContact(x, z, park.points) ||
            nearestEdge(city.walkNetwork, [x, z]).distance < 5
          )
            continue;
          positions.push([x, z]);
          if (positions.length >= 160) break;
        }
    }
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.3, 5, 7),
      mats.wood,
      positions.length
    );
    const canopy = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      mats.leaf,
      positions.length * 9
    );
    const t = new THREE.Object3D(),
      color = new THREE.Color();
    positions.forEach(([x, z], i) => {
      const size = 0.85 + (i % 7) * 0.08;
      t.position.set(x, 2.5, z);
      t.scale.set(size, 1, size);
      t.updateMatrix();
      trunk.setMatrixAt(i, t.matrix);
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) {
          t.position.set(x + (j - 1) * 1.4, 5.5 + (j % 2) * 1.3, z + Math.sin(i + j));
          t.scale.set(5 * size, 6 * size, 1);
          t.rotation.y = i + (k * Math.PI) / 3;
          t.updateMatrix();
          canopy.setMatrixAt((j * 3 + k) * positions.length + i, t.matrix);
          color.setHSL(0.18 + (i % 6) * 0.008, 0.18, 0.63 + (j % 3) * 0.035);
          canopy.setColorAt((j * 3 + k) * positions.length + i, color);
        }
      city.colliders.push({ x0: x - 0.28, x1: x + 0.28, z0: z - 0.28, z1: z + 0.28, h: 5 });
    });
    trunk.castShadow = canopy.castShadow = true;
    trunk.receiveShadow = canopy.receiveShadow = true;
    scene.add(trunk, canopy);
    instanced.push(
      { mesh: trunk, total: positions.length },
      { mesh: canopy, total: positions.length * 9 }
    );
    stats.trees = positions.length;
  };
  jobs.push(furniture, trees);
  return {
    mats,
    selected,
    addBuilding,
    stats,
    get pending() {
      return jobs.length;
    },
    get built() {
      return built;
    },
    get quality() {
      return profile;
    },
    setQuality(name) {
      profile = settings[name] ? name : 'medium';
      for (const lod of lods) {
        lod.levels[1].distance = settings[profile][0];
        lod.levels[2].distance = settings[profile][1];
      }
      for (const item of instanced)
        item.mesh.count =
          stats.trees *
          (item.mesh === instanced[0]?.mesh
            ? 1
            : profile === 'low'
              ? 3
              : profile === 'medium'
                ? 6
                : 9);
      stats.visibleTrunks = instanced[0]?.mesh.count || 0;
      stats.leafCardsPerTree = profile === 'low' ? 3 : profile === 'medium' ? 6 : 9;
    },
    update(camera) {
      const start = performance.now();
      let count = 0;
      while (jobs.length && count++ < 8 && performance.now() - start < 5) {
        const job = jobs.shift();
        job();
        built++;
      }
      if (count) this.setQuality(profile);
      for (const lod of lods) lod.update(camera);
    },
  };
}
