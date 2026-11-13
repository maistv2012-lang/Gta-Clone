import * as THREE from 'three';

// Vertical neon blade signs hanging off street-facing walls: the Arcade
// District's lots and the real Christchurch buildings near the centre.
// Instanced (one draw call per sign design); they brighten at night and
// under heavy cloud.

const SIGN_WORDS = ['HOTEL', 'BAR', 'DAIRY', 'PIES', 'OPEN', 'KEBAB', 'CAFE', 'SUSHI', 'CHEMIST', 'CINEMA', 'TAXI', 'BACKPACKERS'];
const SIGN_STYLES = [
  { bg: '#1a0f04', ink: '#ffb347', edge: '#ff8a1e' }, // amber
  { bg: '#c81e1e', ink: '#fff2e0', edge: '#ff5a4a' }, // red box, pale letters
  { bg: '#04160c', ink: '#7dff8a', edge: '#35d05a' }, // green
  { bg: '#03131c', ink: '#6fe3ff', edge: '#2aa8e0' }, // cyan
  { bg: '#1a0416', ink: '#ff7ad9', edge: '#e03aa8' }, // pink
  { bg: '#aeb6c0', ink: '#14161a', edge: '#d8dee6' }, // white lightbox
];
const CIVIC = new Set(['church', 'cathedral', 'chapel', 'religious', 'place_of_worship', 'townhall', 'library', 'courthouse', 'school', 'university', 'college', 'hospital', 'police', 'fire_station', 'museum', 'government', 'public', 'civic']);
const MAX_REAL_SIGNS = 700;
const REAL_RADIUS = 650; // metres around the spawn that get signs

function signTexture(i) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const s = SIGN_STYLES[i % SIGN_STYLES.length];
  const word = SIGN_WORDS[i % SIGN_WORDS.length];
  g.fillStyle = s.bg;
  g.fillRect(0, 0, 64, 256);
  g.strokeStyle = s.edge;
  g.lineWidth = 4;
  g.strokeRect(4, 4, 56, 248);
  g.fillStyle = s.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = Math.min(40, 232 / word.length);
  g.font = `bold ${Math.floor(step * 0.92)}px Arial`;
  const y0 = 128 - (step * (word.length - 1)) / 2;
  for (let k = 0; k < word.length; k++) g.fillText(word[k], 32, y0 + k * step + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function inside(x, z, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

export function buildNeon(scene, city) {
  const VARIANTS = SIGN_WORDS.length;
  const lists = Array.from({ length: VARIANTS }, () => []);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  // a double-sided blade: wall point (x, z), outward unit normal (nx, nz)
  const blade = (x, z, nx, nz, y, hgt) => {
    const list = lists[(Math.random() * VARIANTS) | 0];
    const ry = Math.atan2(-nz, nx); // plane faces along the street, blade sticks out from the wall
    for (const r of [ry, ry + Math.PI]) {
      q.setFromAxisAngle(Y, r);
      list.push(m.compose(p.set(x + nx * 1.25, y, z + nz * 1.25), q, s.set(1.9, hgt, 1)).clone());
    }
  };

  // Arcade District: the two street-facing walls of every lot
  for (const lot of city.lots || []) {
    for (const [onX, dir] of [[true, lot.sx], [false, lot.sz]]) {
      const len = onX ? lot.d : lot.w, off = (onX ? lot.w : lot.d) / 2;
      const count = Math.random() < 0.6 ? (Math.random() < 0.35 ? 2 : 1) : 0;
      for (let k = 0; k < count; k++) {
        const along = (Math.random() - 0.5) * (len - 4);
        const hgt = 5 + Math.random() * 4;
        const y = 5.4 + hgt / 2 + Math.random() * Math.max(0.5, Math.min(lot.h - hgt - 7, 8));
        if (onX) blade(lot.x + dir * off, lot.z + along, dir, 0, y, hgt);
        else blade(lot.x + along, lot.z + dir * off, 0, dir, y, hgt);
      }
    }
  }

  // Christchurch: long walls of taller buildings that front a street
  if (city.osm) {
    const CELL = 8, roadCells = new Set();
    for (const road of city.osm.roads) {
      if (['footway', 'path', 'cycleway', 'steps', 'service'].includes(road.tags.highway)) continue;
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
        for (let k = 0; k <= n; k++) {
          roadCells.add(`${Math.floor((a[0] + (b[0] - a[0]) * k / n) / CELL)},${Math.floor((a[1] + (b[1] - a[1]) * k / n) / CELL)}`);
        }
      }
    }
    const nearRoad = (x, z) => {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (roadCells.has(`${cx + i},${cz + j}`)) return true;
      return false;
    };
    const cx0 = city.spawn.x, cz0 = city.spawn.z;
    let placed = 0;
    for (const area of city.osm.areas) {
      if (placed >= MAX_REAL_SIGNS) break;
      if (!area.tags.building || area.height < 9) continue;
      const t = area.tags; // shops and offices get signs; churches, heritage and civic buildings don't
      if (CIVIC.has(t.building) || CIVIC.has(t.amenity) || t.historic || t.tourism === 'attraction' || t.religion) continue;
      const pts = area.points;
      if (Math.hypot(pts[0][0] - cx0, pts[0][1] - cz0) > REAL_RADIUS) continue;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        if (len < 9 || Math.random() > 0.45) continue;
        let nx = dz / len, nz = -dx / len;
        const f = 0.25 + Math.random() * 0.5;
        const wx = a[0] + dx * f, wz = a[1] + dz * f;
        if (inside(wx + nx * 0.6, wz + nz * 0.6, pts)) { nx = -nx; nz = -nz; }
        if (!nearRoad(wx + nx * 9, wz + nz * 9)) continue; // back walls and courtyards stay dark
        const hgt = Math.min(4 + Math.random() * 4, area.height - 5);
        const y = 4.6 + hgt / 2 + Math.random() * Math.max(0.3, Math.min(area.height - hgt - 5.5, 7));
        blade(wx, wz, nx, nz, y, hgt);
        placed++;
      }
    }
  }

  const geo = new THREE.PlaneGeometry(1, 1);
  const mats = [];
  lists.forEach((list, i) => {
    if (!list.length) return;
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(i) });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mx, k) => mesh.setMatrixAt(k, mx));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false; // instances span the whole city
    scene.add(mesh);
    mats.push(mat);
  });

  return {
    // glow: 0 bright day .. 1 night / heavy overcast (values above 1 feed bloom)
    update(glow) { for (const mat of mats) mat.color.setScalar(0.45 + glow * 1.0); },
  };
}
