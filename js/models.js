import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 3D model library: buildings and cars from Kenney's CC0 "City Kit
// (Commercial)" and "Car Kit" (see assets/models/LICENSE.txt). Models are
// loaded once before the world is built; if loading fails the game falls
// back to its procedural boxes.

const BUILDING_NAMES = [ // the lighter models only: there are ~1600 buildings in the city
  ...'abcdfgh'.split('').map((c) => `building-${c}`),
  ...'abcde'.split('').map((c) => `building-skyscraper-${c}`),
];
const CAR_NAMES = ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'van', 'truck',
  'taxi', 'police', 'delivery', 'ambulance', 'firetruck', 'garbage-truck'];
export const CIVILIAN_CARS = ['sedan', 'sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'van', 'truck'];
const KEEP_PAINT = new Set(['taxi', 'police', 'ambulance', 'firetruck', 'garbage-truck']);

// the kit's cars are stubby; stretch the bodies to road-car proportions
const CAR_SX = 1.33, CAR_SY = 1.12, CAR_SZ = 1.62, WHEEL_S = 1.2;

export const models = {
  ready: false,
  buildings: [],     // { geo (unit box, roof at y=1), far (cheap distant version), aspect }
  boxGeo: null,      // plain block for buildings buried inside a city block
  buildingMat: null,
  cars: {},          // name -> { geo, paint, wheels: [{ geo, x, z }], box }
  carMat: null,
  glow: { value: 0 }, // 0 day .. 1 night: lights the building windows
};

// merge every mesh under root (minus skipped nodes) into one triangle soup
function flatten(root, skip = () => false) {
  root.updateMatrixWorld(true);
  const geos = [];
  root.traverse((o) => {
    if (!o.isMesh || skip(o)) return;
    const g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.applyMatrix4(o.matrixWorld);
    geos.push(g.index ? g.toNonIndexed() : g);
  });
  return mergeGeometries(geos, false);
}

// read palette colours straight out of the kit's colour-map texture
function paletteSampler(texture) {
  const img = texture.image;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  return (u, v) => {
    const x = Math.min(c.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * c.width)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * c.height)));
    const i = (y * c.width + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
}

const triUv = (uv, t) => [
  (uv.getX(t * 3) + uv.getX(t * 3 + 1) + uv.getX(t * 3 + 2)) / 3,
  (uv.getY(t * 3) + uv.getY(t * 3 + 1) + uv.getY(t * 3 + 2)) / 3,
];

function prepBuilding(geo, sample) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const tris = pos.count / 3;

  // glass = the blue swatches. Group touching glass triangles into panes so a
  // whole window switches on or off together at night.
  const lit = new Float32Array(pos.count).fill(-1);
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const key = (i) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const glass = [];
  for (let t = 0; t < tris; t++) {
    const [r, g, b] = sample(...triUv(uv, t));
    const isGlass = r <= g + 20 && (b - r > 55 || (b > 240 && b - r > 40));
    if (!isGlass) continue;
    glass.push(t);
    const ks = [key(t * 3), key(t * 3 + 1), key(t * 3 + 2)];
    for (const k of ks) if (!parent.has(k)) parent.set(k, k);
    parent.set(find(ks[1]), find(ks[0]));
    parent.set(find(ks[2]), find(ks[0]));
  }
  const paneRand = new Map();
  const paneSize = new Map();
  for (const t of glass) {
    const root = find(key(t * 3));
    if (!paneRand.has(root)) paneRand.set(root, Math.random());
    paneSize.set(root, (paneSize.get(root) || 0) + 1);
  }
  for (const t of glass) {
    const root = find(key(t * 3));
    // curtain walls (many joined panes) get 2+: the shader lights them floor by floor
    const v = paneRand.get(root) + (paneSize.get(root) > 6 ? 2 : 0);
    lit[t * 3] = lit[t * 3 + 1] = lit[t * 3 + 2] = v;
  }
  geo.setAttribute('aLit', new THREE.BufferAttribute(lit, 1));

  // main roof = the highest level with a big flat area (ignores vents, masts)
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
  const levels = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    n.subVectors(b, a).cross(c.sub(a));
    const area = n.length() / 2;
    if (area < 1e-9 || n.y / (area * 2) < 0.9) continue;
    const lv = Math.round(a.y / 0.03);
    levels.set(lv, (levels.get(lv) || 0) + area);
  }
  let roof = bb.max.y;
  const flat = [...levels.entries()].filter(([, ar]) => ar > sx * sz * 0.3).map(([lv]) => lv * 0.03);
  if (flat.length) roof = Math.max(...flat);
  roof = Math.max(roof - bb.min.y, (bb.max.y - bb.min.y) * 0.5);

  // normalise to a unit footprint with the roof at y = 1
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(1 / sx, 1 / roof, 1 / sz);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  // distant version: only the big faces (walls, roofs, glass) that make up
  // most of the surface; frames, vents and trim vanish at range anyway
  const p2 = geo.attributes.position;
  const areas = [];
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(p2, t * 3); b.fromBufferAttribute(p2, t * 3 + 1); c.fromBufferAttribute(p2, t * 3 + 2);
    areas.push([b.sub(a).cross(c.sub(a)).length(), t]);
  }
  areas.sort((p, q) => q[0] - p[0]);
  const total = areas.reduce((s, e) => s + e[0], 0);
  const keep = [];
  for (let i = 0, acc = 0; i < areas.length && acc < total * 0.93; i++) { acc += areas[i][0]; keep.push(areas[i][1]); }
  const far = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'aLit']) {
    const src = geo.attributes[name];
    const n = src.itemSize;
    const arr = new Float32Array(keep.length * 3 * n);
    keep.forEach((t, i) => { for (let k = 0; k < 3 * n; k++) arr[i * 3 * n + k] = src.array[t * 3 * n + k]; });
    far.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  far.boundingBox = geo.boundingBox.clone();
  far.boundingSphere = geo.boundingSphere.clone();
  return { geo, far, aspect: roof / ((sx + sz) / 2) };
}

function buildingMaterial(map) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBGlow = models.glow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aLit;
        varying float vLit;
        varying float vSeed;
        varying vec3 vBPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLit = aLit;
        vBPos = position;
        #ifdef USE_INSTANCING
          vBPos = (instanceMatrix * vec4(position, 1.0)).xyz;
        #endif
        #ifdef USE_INSTANCING
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vSeed = 0.0;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uBGlow;
        varying float vLit;
        varying float vSeed;
        varying vec3 vBPos;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float bGlass = step(0.0, vLit);
        diffuseColor.rgb *= 1.0 - bGlass * uBGlow * 0.72; // dark glass after sunset`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // single windows switch as a whole; curtain walls light per floor and bay
        float bCell = step(2.0, vLit) * (floor(vBPos.y / 3.4) * 0.37 + floor((vBPos.x + vBPos.z) / 4.5) * 0.61);
        float bOn = bGlass * step(0.64, fract(vLit + vSeed + bCell));
        vec3 bTint = mix(vec3(1.0, 0.72, 0.4), vec3(0.72, 0.86, 1.0), step(0.78, fract(vLit * 7.3 + vSeed)));
        totalEmissiveRadiance += bOn * uBGlow * bTint * 0.7;`);
  };
  return mat;
}

function prepCar(name, root, sample) {
  const wheels = [];
  for (const o of root.children) {
    if (!o.name.startsWith('wheel-')) continue;
    const front = o.position.z > 0;
    wheels.push({
      geo: o.geometry, front, x: o.position.x,
      px: Math.sign(o.position.x) * (Math.abs(o.position.x) * CAR_SX + 0.05),
      pz: o.position.z * CAR_SZ,
    });
  }
  wheels.sort((p, q) => (q.front - p.front) || (p.x - q.x)); // front pair first, like the box cars
  let geo = flatten(root, (o) => o.name.startsWith('wheel-'));
  geo.scale(CAR_SX, CAR_SY, CAR_SZ);

  // the swatch covering the most bodywork is the paint: split it off so each
  // car can be sprayed any colour while trim, glass and lights keep theirs
  let paint = false;
  if (!KEEP_PAINT.has(name)) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const tris = pos.count / 3;
    const area = new Map();
    const bucket = new Array(tris);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < tris; t++) {
      const [u, v] = triUv(uv, t);
      const [r, g, bl] = sample(u, v);
      const k = `${Math.floor((u - Math.floor(u)) * 16)},${Math.floor((v - Math.floor(v)) * 4)}`;
      bucket[t] = k;
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx < 60 || (mx - mn) / mx < 0.3) continue; // greys and blacks are trim
      a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
      area.set(k, (area.get(k) || 0) + b.sub(a).cross(c.sub(a)).length());
    }
    const best = [...area.entries()].sort((p, q) => q[1] - p[1])[0];
    if (best) {
      const order = [];
      for (let t = 0; t < tris; t++) if (bucket[t] === best[0]) order.push(t);
      const nPaint = order.length;
      for (let t = 0; t < tris; t++) if (bucket[t] !== best[0]) order.push(t);
      const sorted = geo.clone();
      for (const attr of ['position', 'normal', 'uv']) {
        const src = geo.attributes[attr], dst = sorted.attributes[attr];
        const n = src.itemSize;
        order.forEach((t, i) => {
          for (let k = 0; k < 3 * n; k++) dst.array[i * 3 * n + k] = src.array[t * 3 * n + k];
        });
      }
      sorted.clearGroups();
      sorted.addGroup(0, nPaint * 3, 0);
      sorted.addGroup(nPaint * 3, (tris - nPaint) * 3, 1);
      geo = sorted;
      paint = true;
    }
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geo, paint, wheels, box: geo.boundingBox.clone() };
}

// Build a car from the library. Same contract as the box car in car.js:
// faces +z, children[0] is the body, wheels are front pair then rear pair.
export function createCarModel(color, opts = {}) {
  const name = models.cars[opts.model] ? opts.model
    : opts.police ? 'police'
    : CIVILIAN_CARS[(Math.random() * CIVILIAN_CARS.length) | 0];
  const car = models.cars[name];
  const group = new THREE.Group();
  const body = new THREE.Mesh(car.geo, car.paint
    ? [new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.34 }), models.carMat]
    : models.carMat);
  body.castShadow = true;
  group.add(body);
  group.userData.paint = car.paint;

  const wheels = [];
  for (const w of car.wheels) {
    const m = new THREE.Mesh(w.geo, models.carMat);
    m.rotation.order = 'YXZ';
    m.position.set(w.px, 0.3 * WHEEL_S, w.pz);
    m.scale.setScalar(WHEEL_S);
    group.add(m);
    wheels.push(m);
  }

  // glowing head and tail lights (the kit's are painted on)
  const lamp = (c, e, z) => {
    for (const x of [-0.58, 0.58]) {
      const l = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: c, emissive: e }));
      l.position.set(x, 0.62, z);
      group.add(l);
    }
  };
  lamp('#fff7cc', 0xaa9930, car.box.max.z + 0.01);
  lamp('#aa1111', 0x880000, car.box.min.z - 0.01);

  let lightbar = null;
  if (opts.police) {
    const y = car.box.max.y + 0.02;
    const red = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xcc0000 }));
    red.position.set(-0.3, y, -0.1);
    group.add(red);
    const blue = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0011cc }));
    blue.position.set(0.3, y, -0.1);
    group.add(blue);
    lightbar = { red, blue };
  }
  return { group, wheels, lightbar };
}
const lampGeo = new THREE.BoxGeometry(0.34, 0.14, 0.06);
const barGeo = new THREE.BoxGeometry(0.5, 0.14, 0.34);

export async function loadModels() {
  const loader = new GLTFLoader();
  const [buildings, cars] = await Promise.all([
    Promise.all(BUILDING_NAMES.map((n) => loader.loadAsync(`assets/models/city/${n}.glb`))),
    Promise.all(CAR_NAMES.map((n) => loader.loadAsync(`assets/models/cars/${n}.glb`))),
  ]);

  const firstMap = (gltf) => {
    let map = null;
    gltf.scene.traverse((o) => { if (!map && o.isMesh && o.material.map) map = o.material.map; });
    return map;
  };
  const cityMap = firstMap(buildings[0]);
  const citySample = paletteSampler(cityMap);
  models.buildingMat = buildingMaterial(cityMap);
  models.buildings = buildings.map((g) => prepBuilding(flatten(g.scene), citySample));
  // plain block: unit box, roof at y = 1, painted with a wall swatch
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).toNonIndexed();
  box.attributes.uv.array.fill(0); // swatch picked below
  for (let i = 0; i < box.attributes.uv.count; i++) box.attributes.uv.setXY(i, 0.42, 0.56);
  box.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(box.attributes.position.count).fill(-1), 1));
  models.boxGeo = box;

  const carMap = firstMap(cars[0]);
  const carSample = paletteSampler(carMap);
  models.carMat = new THREE.MeshStandardMaterial({ map: carMap, roughness: 0.55, metalness: 0.15 });
  CAR_NAMES.forEach((n, i) => { models.cars[n] = prepCar(n, cars[i].scene, carSample); });

  models.ready = true;
}
