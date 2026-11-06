import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SHIRTS = [
  '#7a2a22',
  '#8c8c84',
  '#2a4a6a',
  '#9a8a3a',
  '#5a3a6a',
  '#2a6a5a',
  '#8a5222',
  '#23303d',
  '#6a3a4a',
];
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
    key: 'web',
    name: 'WEAVER',
    tagline: 'Balanced all-rounder',
    colors: { shirt: '#c1121f', pants: '#1f3fa8', skin: '#c98e63' },
    speed: 1,
    health: 100,
    jump: 1,
    webReel: 1,
  },
  {
    key: 'dash',
    name: 'BOLT',
    tagline: 'Fast & agile, glass cannon',
    colors: { shirt: '#f5a800', pants: '#2a2a30', skin: '#8d5a3a' },
    speed: 1.25,
    health: 80,
    jump: 1.15,
    webReel: 1.2,
  },
  {
    key: 'tank',
    name: 'BRICK',
    tagline: 'Tough bruiser, hits hard',
    colors: { shirt: '#2a6a5a', pants: '#181f28', skin: '#6b4226', build: 'heavy' },
    speed: 0.85,
    health: 150,
    jump: 0.9,
    webReel: 0.85,
    melee: 1.6,
  },
];

// Articulated anatomical rig, retaining the existing animation/wardrobe interface.
let cloth;
let policePatch;
let characterQuality = 'medium';
const rigGeometry = new Map();
let sharedPbr, sharedLow;
export function setCharacterQuality(name, scene) {
  characterQuality = name;
  scene.traverse((object) => {
    if (object.isSkinnedMesh && object.userData.lowPalette)
      object.material = name === 'low' ? object.userData.lowPalette : object.userData.pbrPalette;
  });
}
function clothTexture() {
  if (cloth) return cloth;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'),
    image = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4,
        v = 225 + ((x * 17 + y * 31) % 19) + (x % 2 ? 0 : 5);
      image.data.set([v, v, v, 255], i);
    }
  g.putImageData(image, 0, 0);
  cloth = new THREE.CanvasTexture(canvas);
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.repeat.set(4, 4);
  cloth.colorSpace = THREE.SRGBColorSpace;
  return cloth;
}
export function createCharacter({
  shirt = '#ffffff',
  pants = '#2c3e66',
  skin = '#c98e63',
  hair = '#221a14',
  build = 'regular',
  police = false,
} = {}) {
  const group = new THREE.Group(),
    bones = [],
    joints = [];
  if (!sharedPbr) {
    sharedPbr = new THREE.MeshStandardMaterial({ map: clothTexture(), vertexColors: true, roughness: .85 });
    sharedLow = new THREE.MeshLambertMaterial({ map: clothTexture(), vertexColors: true });
  }
  const materials = Object.fromEntries(Object.entries({shirt,pants,skin,hair,dark:0x20252b}).map(([key,color])=>[key,{color:new THREE.Color(color)}]));
  const prototype = rigGeometry.get(police ? 'police' : 'civilian');
  const palette = Object.values(materials),
    buckets = palette.map(() => []);
  function bone(x, y, z, parent) {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  }
  const root = bone(0, 0, 0),
    headBone = bone(0, 1.72, 0.015, root);
  function part(geometry, material, joint, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    if (prototype) { geometry.dispose(); return; }
    geometry.scale(sx, sy, sz);
    geometry.translate(x, y, z);
    const count = geometry.attributes.position.count,
      indices = new Uint16Array(count * 4),
      weights = new Float32Array(count * 4),
      index = bones.indexOf(joint);
    for (let i = 0; i < count; i++) {
      indices[i * 4] = index;
      weights[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    buckets[palette.indexOf(material)].push(geometry);
  }
  if (!prototype) {
  const torso = new THREE.LatheGeometry(
    [
      [0.16, 0.84],
      [0.17, 0.94],
      [0.2, 1.15],
      [0.245, 1.4],
      [0.2, 1.48],
      [0.085, 1.53],
    ].map((p) => new THREE.Vector2(...p)),
    12
  );
  part(torso, materials.shirt, root, 0, 0, 0, 1, 1, 0.75);
  part(
    new THREE.SphereGeometry(0.18, 12, 8),
    materials.skin,
    headBone,
    0,
    1.72,
    0.015,
    0.88,
    1.13,
    0.93
  );
  part(
    new THREE.SphereGeometry(0.183, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
    materials.hair,
    headBone,
    0,
    1.78,
    0.008,
    0.95,
    0.75,
    1
  );
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.18, 8), materials.skin, root, 0, 1.53, 0);
  }
  function limb(x, y, arm) {
    const upper = bone(x, y, 0, root),
      length = arm ? 0.31 : 0.38,
      r = arm ? 0.078 : 0.105;
    const lower = bone(0, -length, 0, upper),
      material = arm ? materials.skin : materials.pants;
    if (!prototype) {
    part(new THREE.CapsuleGeometry(r, length - r * 2, 3, 8), material, upper, x, y - length / 2, 0);
    part(
      new THREE.CapsuleGeometry(r * 0.87, length - r * 1.74, 3, 8),
      material,
      lower,
      x,
      y - length * 1.5,
      0
    );
    if (arm) {
      part(new THREE.CapsuleGeometry(0.087, 0.09, 3, 8), materials.shirt, upper, x, y - 0.105, 0);
      part(
        new THREE.SphereGeometry(0.073, 8, 6),
        materials.skin,
        lower,
        x,
        y - length * 2 - 0.025,
        0
      );
    } else {
      part(
        new THREE.SphereGeometry(1, 8, 6),
        materials.dark,
        lower,
        x,
        y - length * 2 + 0.005,
        0.065,
        0.108,
        0.065,
        0.2
      );
    }
    }
    joints.push({ lower, arm, side: x < 0 ? 1 : -1 });
    return upper;
  }
  const lArm = limb(-0.31, 1.48, true),
    rArm = limb(0.31, 1.48, true),
    lLeg = limb(-0.14, 0.82, false),
    rLeg = limb(0.14, 0.82, false);
  if (!prototype) {
  part(new THREE.SphereGeometry(0.04, 6, 4), materials.skin, headBone, 0, 1.7, 0.175, 0.65, 1, 1.1);
  for (const x of [-0.06, 0.06]) {
    part(new THREE.SphereGeometry(0.012, 6, 4), materials.dark, headBone, x, 1.75, 0.175);
    part(
      new THREE.SphereGeometry(0.037, 6, 4),
      materials.skin,
      headBone,
      x < 0 ? -0.165 : 0.165,
      1.72,
      0,
      0.5,
      1,
      0.7
    );
  }
  part(new THREE.BoxGeometry(0.025, 0.48, 0.022), materials.dark, root, 0, 1.22, 0.18);
  part(new THREE.BoxGeometry(0.38, 0.05, 0.3), materials.dark, root, 0, 0.85, 0);
  if (police) {
    part(new THREE.BoxGeometry(0.43, 0.45, 0.08), materials.dark, root, 0, 1.23, 0.17);
    part(
      new THREE.SphereGeometry(0.19, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.dark,
      headBone,
      0,
      1.84,
      0,
      1,
      0.45,
      1
    );
    part(new THREE.BoxGeometry(0.26, 0.025, 0.16), materials.dark, headBone, 0, 1.84, 0.18);
  }
  }
  let template = prototype;
  if (!template) {
    const combined = buckets.map(list=>{const g=mergeGeometries(list,false);list.forEach(p=>p.dispose());return g;});
    template=mergeGeometries(combined,true);combined.forEach(g=>g.dispose());
    rigGeometry.set(police ? 'police' : 'civilian',template);
  }
  // Share immutable vertex/index buffers; each actor owns only its palette colours.
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(template.attributes)) geometry.setAttribute(name,attribute);
  geometry.setIndex(template.index);
  const colors=new THREE.Float32BufferAttribute(new Float32Array(template.attributes.position.count*3),3);
  geometry.setAttribute('color',colors);
  const refreshColors=()=>{
    for(let material=0;material<template.groups.length;material++){
      const range=template.groups[material],color=palette[material].color;
      for(let i=range.start;i<range.start+range.count;i++){const vertex=template.index.getX(i);colors.setXYZ(vertex,color.r,color.g,color.b);}
    }
    colors.needsUpdate=true;
  };refreshColors();
  geometry.addGroup(0,template.index.count,0);
  const mesh=new THREE.SkinnedMesh(geometry,[characterQuality==='low'?sharedLow:sharedPbr]);
  mesh.add(root);group.add(mesh);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;
  mesh.userData.pbrPalette=[sharedPbr];mesh.userData.lowPalette=[sharedLow];
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.5);
  if (police) {
    if (!policePatch) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#172331';
      ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 25px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 64, 25);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      policePatch = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.075), policePatch);
    patch.position.set(0, 1.34, 0.216);
    root.add(patch);
  }
  const setBuild = (value) => {
    group.scale.x = value === 'heavy' ? 1.13 : 1;
  };
  setBuild(build);
  return { group, lArm, rArm, lLeg, rLeg, joints, materials, setBuild, refreshColors, skin: mesh };
}

// Wardrobe/barber and character selection retain their palette/stat interfaces.
export function applySuit(ch, { shirt, pants, skin, hair, build }) {
  for (const [key, color] of Object.entries({ shirt, pants, skin, hair }))
    if (color) ch.materials[key].color.set(color);
  ch.refreshColors();
  if (build) ch.setBuild(build);
}

export function animateWalk(ch, t, amp) {
  const s = Math.sin(t) * amp;
  const c = Math.cos(t * 2) * amp; // knee/elbow bend at twice the stride
  for (const joint of ch.joints || [])
    joint.lower.rotation.x = joint.arm
      ? -0.12 - Math.max(0, Math.sin(t * joint.side)) * amp * 0.4
      : Math.max(0, -Math.sin(t * joint.side)) * amp * 0.7;
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
  for (const joint of ch.joints || []) joint.lower.rotation.x = joint.arm ? -0.12 : 0;
  const g = ch.group;
  const t = performance.now() * 0.001;
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
  for (const joint of ch.joints || []) joint.lower.rotation.x = joint.arm ? -dip : dip * 1.2;
  ch.lLeg.rotation.x = dip;
  ch.rLeg.rotation.x = dip;
  ch.lArm.rotation.x = -dip * 0.7;
  ch.rArm.rotation.x = -dip * 0.7;
  ch.group.position.y = (ch.group.userData.baseY || 0) - dip * 0.35;
}
