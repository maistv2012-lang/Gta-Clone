import * as THREE from 'three';

const SHIRTS = ['#7a2a22', '#8c8c84', '#2a4a6a', '#9a8a3a', '#5a3a6a', '#2a6a5a', '#8a5222', '#23303d', '#6a3a4a'];
const PANTS = ['#22304d', '#28333d', '#181f28', '#43302a', '#33333a', '#1f2566'];
const SKINS = ['#c98e63', '#8d5a3a', '#e6b88f', '#6b4226', '#d9a06e'];

export function randomOutfit() {
  return {
    shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
    pants: PANTS[(Math.random() * PANTS.length) | 0],
    skin: SKINS[(Math.random() * SKINS.length) | 0],
  };
}

// Playable roster: pick one at the start screen. Each tweaks the feel.
export const CHARACTERS = [
  {
    key: 'ruck', name: 'RUCK', tagline: 'Rugby powerhouse, hits like a truck',
    build: 'ruck', // detailed body instead of the classic blocks
    colors: { shirt: '#15161a', pants: '#121316', skin: '#b9805a', hair: '#1c1612' },
    speed: 0.95, health: 160, jump: 0.95, webReel: 0.9, melee: 1.8,
  },
  {
    key: 'web', name: 'WEAVER', tagline: 'Balanced all-rounder',
    colors: { shirt: '#c1121f', pants: '#1f3fa8', skin: '#c98e63' },
    speed: 1, health: 100, jump: 1, webReel: 1,
  },
  {
    key: 'dash', name: 'BOLT', tagline: 'Fast & agile, glass cannon',
    colors: { shirt: '#f5a800', pants: '#2a2a30', skin: '#8d5a3a' },
    speed: 1.25, health: 80, jump: 1.15, webReel: 1.2,
  },
  {
    key: 'tank', name: 'BRICK', tagline: 'Tough bruiser, hits hard',
    colors: { shirt: '#2a6a5a', pants: '#181f28', skin: '#6b4226' },
    speed: 0.85, health: 150, jump: 0.9, webReel: 0.85, melee: 1.6,
  },
];

// Character rig, feet at y=0, facing +z. `build` picks the body: the classic
// blocks, or 'ruck' — a heavyweight in a sleeveless hoodie and rugby shorts.
// Contract for every build (the wardrobe, barber and poses rely on it):
// group.children = [torso/top, head, hair, ...]; each limb is a pivot whose
// children[0] is its main mesh.
export function createCharacter(opts = {}) {
  const g = new THREE.Group();
  const ch = { group: g };
  populate(ch, opts);
  return ch;
}

// Swap an existing rig to another build in place, keeping anything else
// attached to it (skateboard, crown...) and the group everyone points at.
export function rebuildCharacter(ch, opts = {}) {
  const g = ch.group;
  const extras = g.children.filter((o) => !o.userData.body);
  for (const o of [...g.children]) g.remove(o);
  populate(ch, opts);
  for (const o of extras) g.add(o);
}

function populate(ch, opts) {
  const before = ch.group.children.length;
  if (opts.build === 'ruck') buildRuck(ch, opts);
  else buildClassic(ch, opts);
  ch.group.userData.build = opts.build || null;
  for (let i = before; i < ch.group.children.length; i++) ch.group.children[i].userData.body = true;
}

function buildClassic(ch, { shirt = '#ffffff', pants = '#2c3e66', skin = '#c98e63', hair = '#221a14' } = {}) {
  const g = ch.group;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), mat(shirt));
  torso.position.y = 1.17;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mat(skin));
  head.position.y = 1.74;
  head.castShadow = true;
  g.add(head);

  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), mat(hair));
  hairMesh.position.y = 1.95;
  g.add(hairMesh);

  function limb(w, len, color, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat(color));
    m.position.y = -len / 2;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  }

  ch.lArm = limb(0.18, 0.66, skin, -0.4, 1.48);
  ch.rArm = limb(0.18, 0.66, skin, 0.4, 1.48);
  ch.lLeg = limb(0.22, 0.8, pants, -0.17, 0.82);
  ch.rLeg = limb(0.22, 0.8, pants, 0.17, 0.82);
}

// Ink for the heavyweight's tattoos: dark line work on white, so the skin
// colour multiplies through. Abstract geometric bands, nothing symbolic.
let _sleeveTex = null;
let _chestTex = null;
const INK = 'rgba(40,48,58,0.6)';
function sleeveTexture() {
  if (_sleeveTex) return _sleeveTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 2.5;
  let y = 6;
  const bands = ['tri', 'wave', 'spiral', 'bar', 'dots', 'tri', 'arc', 'bar', 'wave', 'spiral'];
  for (const kind of bands) {
    const h = kind === 'bar' ? 8 : 26;
    if (kind === 'bar') g.fillRect(0, y, 256, 5);
    for (let x = 0; x < 256; x += 32) {
      g.beginPath();
      if (kind === 'tri') { g.moveTo(x + 2, y + h); g.lineTo(x + 16, y + 3); g.lineTo(x + 30, y + h); g.closePath(); g.stroke(); }
      else if (kind === 'wave') { g.moveTo(x, y + h / 2); g.quadraticCurveTo(x + 8, y - 4, x + 16, y + h / 2); g.quadraticCurveTo(x + 24, y + h + 4, x + 32, y + h / 2); g.stroke(); }
      else if (kind === 'spiral') { for (let a = 0; a < 9; a += 0.25) { const r = 1.2 * a; g.lineTo(x + 16 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r); } g.stroke(); }
      else if (kind === 'dots') { g.arc(x + 8, y + h / 2, 4, 0, 7); g.arc(x + 24, y + h / 2, 4, 0, 7); g.fill(); }
      else if (kind === 'arc') { for (const r of [5, 9, 13]) { g.beginPath(); g.arc(x + 16, y + h, r, Math.PI, 0); g.stroke(); } }
    }
    y += h;
  }
  _sleeveTex = new THREE.CanvasTexture(c);
  _sleeveTex.colorSpace = THREE.SRGBColorSpace;
  _sleeveTex.wrapS = THREE.RepeatWrapping;
  return _sleeveTex;
}
function chestTexture() {
  if (_chestTex) return _chestTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 4;
  // the torso's front is the seam of the texture, so draw around u = 0 / 1
  const front = (ox) => {
    g.save();
    g.translate(ox, 0);
    for (let k = 0; k < 14; k++) { // sunburst over the sternum
      const a = (k / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 14, 70 + Math.sin(a) * 14);
      g.lineTo(Math.cos(a) * 44, 70 + Math.sin(a) * 44);
      g.stroke();
    }
    g.beginPath(); g.arc(0, 70, 10, 0, 7); g.fill();
    for (const sx of [-1, 1]) { // mirrored curls across chest and ribs
      for (const [cx, cy, r] of [[70, 60, 24], [58, 130, 20], [96, 110, 16], [40, 190, 22]]) {
        g.beginPath();
        for (let a = 0; a < 10; a += 0.2) g.lineTo(sx * (cx + Math.cos(a) * r * a / 10), cy + Math.sin(a) * r * a / 10);
        g.stroke();
      }
      g.beginPath(); g.moveTo(sx * 20, 120); g.quadraticCurveTo(sx * 60, 170, sx * 14, 236); g.stroke();
    }
    g.restore();
  };
  front(0);
  front(512);
  _chestTex = new THREE.CanvasTexture(c);
  _chestTex.colorSpace = THREE.SRGBColorSpace;
  _chestTex.wrapS = THREE.RepeatWrapping;
  return _chestTex;
}

function buildRuck(ch, { shirt = '#15161a', pants = '#121316', skin = '#b9805a', hair = '#1c1612' } = {}) {
  const g = ch.group;
  // role tags let the wardrobe recolour every part, not just the main meshes
  const mesh = (geo, color, role, map) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, map: map || null }));
    m.castShadow = true;
    if (role) m.userData.role = role;
    return m;
  };
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const WRAP = '#e9e4d8', BOOT = '#17171a';

  // sleeveless hoodie, open down the front (children[0] takes the shirt colour)
  const vestGeo = new THREE.CylinderGeometry(0.33, 0.255, 0.6, 14, 1, true, 0.5, Math.PI * 2 - 1.0);
  vestGeo.scale(1.38, 1, 0.84);
  const vest = at(mesh(vestGeo, shirt), 0, 1.4, 0);
  vest.material.side = THREE.DoubleSide;
  g.add(vest);

  const headGeo = new THREE.SphereGeometry(0.185, 14, 12);
  headGeo.scale(0.94, 1.12, 1.02);
  g.add(at(mesh(headGeo, skin), 0, 1.95, 0));

  const hairGeo = new THREE.SphereGeometry(0.195, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.34);
  hairGeo.scale(0.96, 1.1, 1.04);
  g.add(at(mesh(hairGeo, hair), 0, 1.965, -0.008));

  // bare torso under the vest: wide shoulders tapering to the waist
  const torsoGeo = cyl(0.305, 0.225, 0.64, 14);
  torsoGeo.scale(1.34, 1, 0.8);
  g.add(at(mesh(torsoGeo, skin, 'skin', chestTexture()), 0, 1.39, 0));
  for (const x of [-0.15, 0.15]) { // pecs
    const pec = new THREE.SphereGeometry(0.17, 10, 8);
    pec.scale(1, 0.66, 0.3);
    g.add(at(mesh(pec, skin, 'skin', chestTexture()), x, 1.54, 0.19));
  }
  g.add(at(mesh(cyl(0.115, 0.13, 0.14), skin, 'skin'), 0, 1.76, 0)); // thick neck
  const hood = new THREE.SphereGeometry(0.2, 10, 8);
  hood.scale(1.25, 0.7, 0.6);
  g.add(at(mesh(hood, shirt, 'shirt'), 0, 1.7, -0.2));
  const beard = new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4);
  beard.scale(0.97, 1.12, 1.06);
  g.add(at(mesh(beard, hair, 'hair'), 0, 1.95, 0.004));
  for (const x of [-0.065, 0.065]) { // eyes and brow line
    g.add(at(mesh(new THREE.BoxGeometry(0.035, 0.022, 0.02), '#15110e'), x, 1.975, 0.182));
    g.add(at(mesh(new THREE.BoxGeometry(0.06, 0.016, 0.02), hair, 'hair'), x, 2.005, 0.178));
  }

  // rugby shorts: waist block plus a short leg on each thigh
  const hipsGeo = cyl(0.235, 0.25, 0.2, 14);
  hipsGeo.scale(1.3, 1, 0.82);
  g.add(at(mesh(hipsGeo, pants, 'pants'), 0, 1.02, 0));
  for (const y of [0.98, 1.02]) g.add(at(mesh(new THREE.BoxGeometry(0.012, 0.022, 0.12), WRAP), 0.326, y, 0.02)); // side stripes

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.5, 1.6, 0);
    const sleeve = sleeveTexture();
    pivot.add(at(mesh(cyl(0.128, 0.108, 0.36), skin, 'skin', sleeve), 0, -0.2, 0)); // upper arm
    const delt = new THREE.SphereGeometry(0.165, 10, 8);
    delt.scale(1, 0.92, 1.02);
    pivot.add(at(mesh(delt, skin, 'skin', sleeve), 0, -0.02, 0));
    pivot.add(at(mesh(cyl(0.108, 0.08, 0.3), skin, 'skin', sleeve), 0, -0.52, 0));   // forearm
    pivot.add(at(mesh(cyl(0.086, 0.084, 0.12), WRAP), 0, -0.67, 0));                 // wrist wrap
    pivot.add(at(mesh(new THREE.BoxGeometry(0.11, 0.13, 0.13), skin, 'skin'), 0, -0.79, 0)); // fist
    g.add(pivot);
    return pivot;
  };
  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.19, 0.98, 0);
    const sleeve = sleeveTexture();
    pivot.add(at(mesh(cyl(0.185, 0.18, 0.24), pants), 0, -0.1, 0));                        // shorts leg
    pivot.add(at(mesh(cyl(0.172, 0.125, 0.36), skin, 'skin', sleeve), 0, -0.36, 0));       // thigh
    pivot.add(at(mesh(cyl(0.132, 0.09, 0.3), skin, 'skin', sleeve), 0, -0.66, 0.005));    // calf
    pivot.add(at(mesh(cyl(0.09, 0.088, 0.13), BOOT), 0, -0.8, 0));                         // sock
    for (const y of [-0.755, -0.785]) pivot.add(at(mesh(cyl(0.093, 0.093, 0.014), WRAP), 0, y, 0)); // sock bands
    pivot.add(at(mesh(new THREE.BoxGeometry(0.2, 0.15, 0.36), BOOT), 0, -0.905, 0.045));   // boot
    g.add(pivot);
    return pivot;
  };
  ch.lArm = arm(-1);
  ch.rArm = arm(1);
  ch.lLeg = leg(-1);
  ch.rLeg = leg(1);
}

// Recolour by role tag: reaches every part of the detailed builds.
export function applyRoleColors(ch, colors) {
  ch.group.traverse((o) => {
    const c = o.isMesh && o.userData.role && colors[o.userData.role];
    if (c) o.material.color.set(c);
  });
}

// Recolor an existing character — used by the wardrobe suits.
export function applySuit(ch, { shirt, pants, skin, hair }) {
  const g = ch.group;
  const set = (mesh, c) => { if (c) mesh.material.color.set(c); };
  set(g.children[0], shirt);          // torso
  set(g.children[1], skin);           // head
  set(g.children[2], hair ?? '#221a14'); // hair
  set(ch.lArm.children[0], skin);
  set(ch.rArm.children[0], skin);
  set(ch.lLeg.children[0], pants);
  set(ch.rLeg.children[0], pants);
  applyRoleColors(ch, { shirt, pants, skin, hair: hair ?? '#221a14' });
}

export function animateWalk(ch, t, amp) {
  const s = Math.sin(t) * amp;
  const c = Math.cos(t * 2) * amp; // knee/elbow bend at twice the stride
  ch.lLeg.rotation.x = s;
  ch.rLeg.rotation.x = -s;
  ch.lArm.rotation.x = -s * 0.85;
  ch.rArm.rotation.x = s * 0.85;
  // subtle counter-rotation and bob so it reads as real running
  ch.lArm.rotation.z = 0.08;
  ch.rArm.rotation.z = -0.08;
  const g = ch.group;
  g.position.y = (g.userData.baseY || 0) + Math.abs(c) * 0.06 * amp;
  g.rotation.z = Math.sin(t) * 0.04 * amp; // slight torso sway
}

export function animateIdle(ch) {
  const g = ch.group;
  const t = (performance.now() * 0.001);
  // breathing sway instead of a dead-still statue
  const b = Math.sin(t * 1.6) * 0.03;
  ch.lLeg.rotation.x = 0;
  ch.rLeg.rotation.x = 0;
  ch.lArm.rotation.x = b;
  ch.rArm.rotation.x = -b;
  ch.lArm.rotation.z = 0.06;
  ch.rArm.rotation.z = -0.06;
  g.rotation.z = Math.sin(t * 0.8) * 0.012;
  g.position.y = (g.userData.baseY || 0) + Math.sin(t * 1.6) * 0.015;
}

// Landing crouch: absorb impact, spring back. p goes 0 (deep) -> 1 (stood).
export function animateLand(ch, p) {
  const dip = (1 - p) * 0.6;
  ch.lLeg.rotation.x = dip;
  ch.rLeg.rotation.x = dip;
  ch.lArm.rotation.x = -dip * 0.7;
  ch.rArm.rotation.x = -dip * 0.7;
  ch.group.position.y = (ch.group.userData.baseY || 0) - dip * 0.35;
}
