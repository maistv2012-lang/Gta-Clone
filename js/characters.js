import * as THREE from 'three';
import { rugbyMaterials } from './rugby-materials.js';
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

CHARACTERS.push({ key: 'rugby', name: 'RUGBY', tagline: 'Rugby fighter · strong & balanced',
  colors: { shirt: '#17191d', pants: '#14171c', skin: '#bc8968', hair: '#241e1a', model: 'rugby' },
  speed: .95, health: 130, jump: 1, webReel: 1, melee: 1.3 });

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
  model = 'civilian',
} = {}) {
  const group = new THREE.Group(),
    bones = [],
    joints = [];
  if (!sharedPbr) {
    sharedPbr = new THREE.MeshStandardMaterial({ map: clothTexture(), vertexColors: true, roughness: .85 });
    sharedLow = new THREE.MeshLambertMaterial({ map: clothTexture(), vertexColors: true });
  }
  const fighter = model === 'rugby' && !police;
  const rigKey = police ? 'police' : fighter ? 'rugby' : 'civilian';
  const actorMaterials = fighter ? rugbyMaterials() : { pbr: sharedPbr, low: sharedLow };
  const materials = Object.fromEntries(Object.entries({shirt,pants,skin,hair,dark:0x20252b}).map(([key,color])=>[key,{color:new THREE.Color(color)}]));
  if (fighter) materials.wrap = {color:new THREE.Color('#e2ded1')};
  const prototype = rigGeometry.get(rigKey);
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
    if (fighter) {
      const uv = geometry.attributes.uv;
      const tattoo = material === materials.skin && joint !== headBone;
      // Extruded panels use metre-based UVs; normalize before packing the atlas.
      let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
      for(let i=0;i<uv.count;i++){u0=Math.min(u0,uv.getX(i));u1=Math.max(u1,uv.getX(i));v0=Math.min(v0,uv.getY(i));v1=Math.max(v1,uv.getY(i));}
      for(let i=0;i<uv.count;i++) uv.setXY(i,(tattoo ? .02 : .53)+(uv.getX(i)-u0)/(u1-u0||1)*.44,.02+(uv.getY(i)-v0)/(v1-v0||1)*.96);
    }
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
    if (!geometry.index) geometry.setIndex(Array.from({length:count},(_,i)=>i));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    buckets[palette.indexOf(material)].push(geometry);
  }
  if (!prototype) {
  const torso = new THREE.LatheGeometry(
    (fighter ? [[.18,.84],[.19,.96],[.205,1.1],[.23,1.25],[.255,1.36],[.25,1.43],[.205,1.49],[.08,1.55]] : [
      [0.16, 0.84],
      [0.17, 0.94],
      [0.2, 1.15],
      [0.245, 1.4],
      [0.2, 1.48],
      [0.085, 1.53],
    ]).map((p) => new THREE.Vector2(...p)),
    fighter ? 24 : 12
  );
  part(torso, fighter ? materials.skin : materials.shirt, root, 0, 0, 0, fighter ? 1.12 : 1, 1, fighter ? .8 : .75);
  if (fighter) {
    // Open sleeveless vest: real side/back panels, leaving the chest exposed.
    for (const side of [-1,1]) {
      const outline=new THREE.Shape();
      [[.08,1.48],[.22,1.48],[.25,1.33],[.205,.95],[.1,.95],[.12,1.3]].forEach(([x,y],i)=>i?outline.lineTo(x*side,y):outline.moveTo(x*side,y));
      outline.closePath();
      const panel=new THREE.ExtrudeGeometry(outline,{depth:.045,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1});
      part(panel,materials.shirt,root,0,0,.13);
      part(new THREE.SphereGeometry(1,12,8),materials.skin,root,side*.105,1.33,.125,.115,.095,.045);
      part(new THREE.CylinderGeometry(.008,.008,.23,5),materials.wrap,root,side*.165,1.36,.215);
    }
    const back=new THREE.LatheGeometry([[.195,.95],[.225,1.14],[.29,1.38],[.225,1.49]].map(p=>new THREE.Vector2(...p)),16,Math.PI/2,Math.PI);
    part(back,materials.shirt,root,0,0,-.012,1,1,.85);
    part(new THREE.TorusGeometry(.14,.055,8,20,Math.PI*1.4),materials.shirt,root,0,1.49,-.1,1,.8,.7);
    for (let row=0;row<3;row++) for (const side of [-1,1])
      part(new THREE.SphereGeometry(1,8,6),materials.skin,root,side*.052,1.18-row*.085,.133,.052,.04,.018);
  }
  part(
    new THREE.SphereGeometry(fighter ? .145 : .18, fighter ? 20 : 12, fighter ? 12 : 8),
    materials.skin,
    headBone,
    0,
    fighter ? 1.76 : 1.72,
    0.015,
    0.88,
    fighter ? 1 : 1.13,
    0.93
  );
  part(
    new THREE.SphereGeometry(fighter ? .148 : .183, fighter ? 20 : 12, fighter ? 8 : 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
    materials.hair,
    headBone,
    0,
    fighter ? 1.81 : 1.78,
    0.008,
    0.95,
    0.75,
    1
  );
  part(new THREE.CylinderGeometry(0.075, 0.085, 0.18, 8), materials.skin, root, 0, 1.53, 0);
  }
  function limb(x, y, arm) {
    const upper = bone(x, y, 0, root),
      length = arm ? 0.31 : fighter ? .42 : 0.38,
      r = fighter ? (arm ? .103 : .125) : (arm ? .078 : .105);
    const lower = bone(0, -length, 0, upper),
      material = arm || fighter ? materials.skin : materials.pants;
    if (!prototype) {
    part(new THREE.CapsuleGeometry(r, length - r * 2 + (fighter ? .10 : 0), fighter ? 6 : 3, fighter ? 12 : 8), material, upper, x, y - length / 2, 0);
    part(
      new THREE.CapsuleGeometry(r * 0.87, length - r * 1.74 + (fighter ? .08 : 0), fighter ? 6 : 3, fighter ? 12 : 8),
      material,
      lower,
      x,
      y - length * 1.5,
      0
    );
    if (arm) {
      if (!fighter) part(new THREE.CapsuleGeometry(0.087, 0.09, 3, 8), materials.shirt, upper, x, y - 0.105, 0);
      else part(new THREE.CylinderGeometry(.092,.085,.105,12),materials.wrap,lower,x,y-length*1.87,0);
      part(
        new THREE.SphereGeometry(0.073, 8, 6),
        materials.skin,
        lower,
        x,
        y - length * 2 - 0.025,
        0
      );
    } else {
      if (fighter) {
        part(new THREE.CylinderGeometry(.14,.15,.23,12),materials.pants,upper,x,y-.09,0);
        part(new THREE.CylinderGeometry(.121,.119,.22,12),materials.dark,lower,x,.21,0);
        for (const h of [.25,.28]) part(new THREE.CylinderGeometry(.123,.123,.018,12),materials.wrap,lower,x,h,0);
        part(new THREE.CylinderGeometry(.105,.12,.16,12),materials.dark,lower,x,.14,0);
        for (let lace=0;lace<3;lace++) part(new THREE.BoxGeometry(.12,.008,.012),materials.wrap,lower,x,.13,.07+lace*.03);
      }
      part(
        new THREE.SphereGeometry(1, fighter ? 16 : 8, fighter ? 10 : 6),
        materials.dark,
        lower,
        x,
        y - length * 2 + (fighter ? .015 : .005),
        0.065,
        fighter ? .12 : .108,
        fighter ? .075 : .065,
        fighter ? .22 : .2
      );
    }
    }
    joints.push({ lower, arm, side: x < 0 ? 1 : -1 });
    return upper;
  }
  const lArm = limb(-0.31, 1.48, true),
    rArm = limb(0.31, 1.48, true),
    lLeg = limb(-0.14, fighter ? .9 : .82, false),
    rLeg = limb(0.14, fighter ? .9 : .82, false);
  if (!prototype) {
  part(new THREE.SphereGeometry(fighter ? .03 : .04, fighter ? 8 : 6, fighter ? 6 : 4), materials.skin, headBone, 0, fighter ? 1.735 : 1.7, fighter ? .15 : .175, .65, 1, 1.1);
  for (const x of [-0.06, 0.06]) {
    part(new THREE.SphereGeometry(0.012, 6, 4), materials.dark, headBone, x*(fighter ? .85 : 1), fighter ? 1.785 : 1.75, fighter ? .145 : .175);
    part(
      new THREE.SphereGeometry(0.037, 6, 4),
      materials.skin,
      headBone,
      (x < 0 ? -1 : 1)*(fighter ? .13 : .165),
      fighter ? 1.76 : 1.72,
      0,
      0.5,
      1,
      0.7
    );
  }
  if (!fighter) part(new THREE.BoxGeometry(0.025, 0.48, 0.022), materials.dark, root, 0, 1.22, 0.18);
  if (fighter) {
    part(new THREE.SphereGeometry(.147,20,10,0,Math.PI*2,Math.PI*.58,Math.PI*.42),materials.hair,headBone,0,1.76,.015,.9,1,.94);
    part(new THREE.BoxGeometry(.045,.007,.012),materials.skin,headBone,0,1.708,.147);
    for (const x of [-.06,.06]) part(new THREE.BoxGeometry(.075,.018,.02),materials.hair,headBone,x*.85,1.807,.144);
  }
  part(new THREE.BoxGeometry(0.38, 0.05, 0.3), materials.dark, root, 0, fighter ? .91 : .85, 0);
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
    rigGeometry.set(rigKey,template);
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
  const mesh=new THREE.SkinnedMesh(geometry,[characterQuality==='low'?actorMaterials.low:actorMaterials.pbr]);
  mesh.add(root);group.add(mesh);mesh.bind(new THREE.Skeleton(bones));mesh.castShadow=true;
  mesh.userData.pbrPalette=[actorMaterials.pbr];mesh.userData.lowPalette=[actorMaterials.low];
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
  return { model: fighter ? 'rugby' : 'civilian', group, lArm, rArm, lLeg, rLeg, joints, materials, setBuild, refreshColors, skin: mesh };
}

// Keep the player group (physics/camera/mission references) stable when changing rigs.
// At most two player rigs are retained, so selecting repeatedly does not allocate meshes.
export function setCharacterModel(ch, outfit) {
  const model = outfit.model === 'rugby' ? 'rugby' : 'civilian';
  if (ch.model === model) return;
  const group = ch.group, pool = ch._models || new Map();
  const snapshot = {...ch}; delete snapshot._models;
  pool.set(ch.model, snapshot);
  const next = pool.get(model) || createCharacter(outfit);
  const gold = ch.skin.userData.pbrPalette?.[0]?.vertexColors === false;
  const palettes = {pbrPalette:ch.skin.userData.pbrPalette,lowPalette:ch.skin.userData.lowPalette};
  group.remove(ch.skin);
  group.add(next.skin);
  Object.assign(ch,next,{group,_models:pool});
  ch.setBuild = value => {group.scale.x = value === 'heavy' ? 1.13 : 1;};
  ch.skin.material = characterQuality === 'low' ? ch.skin.userData.lowPalette : ch.skin.userData.pbrPalette;
  if (gold) {
    Object.assign(ch.skin.userData,palettes);
    ch.skin.material = characterQuality === 'low' ? palettes.lowPalette : palettes.pbrPalette;
  }
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
