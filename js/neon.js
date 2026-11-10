import * as THREE from 'three';

// Street-level city lights: lit storefronts along every street-facing facade
// and vertical neon blade signs hanging off the buildings. Everything is
// instanced (one draw call per texture variant) and brightens with the
// night / overcast glow so rainy dusk streets light up.

const SHOP_NAMES = ['DAIRY', 'FISH & CHIPS', 'CHEMIST', 'TAKEAWAYS', 'BOOKS', 'FLAT WHITE CAFE', 'HOT PIES', 'OP SHOP', 'SUPERETTE', 'LAUNDROMAT', 'BOTTLE STORE', 'BAKERY'];
const SIGN_WORDS = ['HOTEL', 'BAR', 'DAIRY', 'PIES', 'OPEN', 'KEBAB', 'CAFE', 'SUSHI', 'CHEMIST', 'CINEMA', 'TAXI', 'BACKPACKERS'];
const SIGN_STYLES = [
  { bg: '#1a0f04', ink: '#ffb347', edge: '#ff8a1e' }, // amber
  { bg: '#c81e1e', ink: '#fff2e0', edge: '#ff5a4a' }, // red box, pale letters
  { bg: '#04160c', ink: '#7dff8a', edge: '#35d05a' }, // green
  { bg: '#03131c', ink: '#6fe3ff', edge: '#2aa8e0' }, // cyan
  { bg: '#1a0416', ink: '#ff7ad9', edge: '#e03aa8' }, // pink
  { bg: '#aeb6c0', ink: '#14161a', edge: '#d8dee6' }, // white lightbox
];

function shopTexture(i) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const warm = i % 3 !== 2;
  g.fillStyle = '#101216';
  g.fillRect(0, 0, 512, 128);

  // fascia sign band
  const style = SIGN_STYLES[(i * 5 + 1) % SIGN_STYLES.length];
  g.fillStyle = style.bg;
  g.fillRect(6, 4, 500, 30);
  g.fillStyle = style.ink;
  g.font = 'bold 24px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(SHOP_NAMES[i % SHOP_NAMES.length], 256, 20);

  // glazing: bright interior fading toward the floor
  const glass = g.createLinearGradient(0, 40, 0, 124);
  glass.addColorStop(0, warm ? '#fff0c8' : '#e2f2ff');
  glass.addColorStop(1, warm ? '#d99a4a' : '#8fb6d8');
  g.fillStyle = glass;
  g.fillRect(8, 40, 496, 84);

  // shelves and goods silhouetted against the light
  for (let n = 0; n < 34; n++) {
    const x = 12 + Math.random() * 480;
    const w = 6 + Math.random() * 22;
    const h = 8 + Math.random() * 34;
    g.fillStyle = `rgba(${warm ? '70,40,20' : '25,45,70'},${0.25 + Math.random() * 0.45})`;
    g.fillRect(x, 124 - h, w, h);
  }
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(8, 78, 496, 3);

  // mullions, door, stall riser
  g.fillStyle = '#0c0d10';
  for (let x = 8; x <= 504; x += 62) g.fillRect(x - 2, 38, 4, 90);
  g.fillRect(226, 38, 6, 90);
  g.fillRect(280, 38, 6, 90);
  g.fillRect(0, 34, 512, 6);
  g.fillRect(0, 120, 222, 8);
  g.fillRect(290, 120, 222, 8);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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

export function buildNeon(scene, city) {
  const SHOP_VARIANTS = 6;
  const SIGN_VARIANTS = 12;
  const shopM = Array.from({ length: SHOP_VARIANTS }, () => []);
  const signM = Array.from({ length: SIGN_VARIANTS }, () => []);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const put = (list, x, y, z, ry, sx, sy) => {
    q.setFromAxisAngle(Y, ry);
    list.push(m.compose(p.set(x, y, z), q, s.set(sx, sy, 1)).clone());
  };

  for (const lot of city.lots) {
    // the two facades that face a street: [is x-facing, outward sign]
    for (const [onX, dir] of [[true, lot.sx], [false, lot.sz]]) {
      const len = onX ? lot.d : lot.w;       // facade length
      const off = (onX ? lot.w : lot.d) / 2; // centre -> facade
      const fx = onX ? lot.x + dir * (off + 0.08) : lot.x;
      const fz = onX ? lot.z : lot.z + dir * (off + 0.08);
      const ry = onX ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI);
      put(shopM[(Math.random() * SHOP_VARIANTS) | 0], fx, 2.44, fz, ry, len - 0.8, 4.4);

      // blade signs stick out over the pavement, readable from along the street
      const count = Math.random() < 0.6 ? (Math.random() < 0.35 ? 2 : 1) : 0;
      for (let k = 0; k < count; k++) {
        const along = (Math.random() - 0.5) * (len - 4);
        const hgt = 5 + Math.random() * 4;
        const y = 5.4 + hgt / 2 + Math.random() * Math.max(0.5, Math.min(lot.h - hgt - 7, 8));
        const out = off + 1.25;
        const x = onX ? lot.x + dir * out : lot.x + along;
        const z = onX ? lot.z + along : lot.z + dir * out;
        const list = signM[(Math.random() * SIGN_VARIANTS) | 0];
        const r0 = onX ? 0 : Math.PI / 2; // plane normal runs along the street
        put(list, x, y, z, r0, 1.9, hgt);
        put(list, x, y, z, r0 + Math.PI, 1.9, hgt);
      }
    }
  }

  const geo = new THREE.PlaneGeometry(1, 1);
  const mats = [];
  const add = (lists, makeTex) => {
    lists.forEach((list, i) => {
      if (!list.length) return;
      const mat = new THREE.MeshBasicMaterial({ map: makeTex(i) });
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((mx, k) => mesh.setMatrixAt(k, mx));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; // instances span the whole city
      scene.add(mesh);
      mats.push(mat);
    });
    return mats.length;
  };
  const shopCount = add(shopM, shopTexture);
  add(signM, signTexture);

  return {
    // glow: 0 bright day .. 1 night / heavy overcast
    update(glow) {
      for (let i = 0; i < mats.length; i++) {
        // values above 1 feed the bloom pass
        mats[i].color.setScalar(i < shopCount ? 0.35 + glow * 0.5 : 0.45 + glow * 1.0);
      }
    },
  };
}
