import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const outline = new THREE.Shape();
outline.moveTo(-0.8, -2.1);
outline.lineTo(0.8, -2.1);
outline.quadraticCurveTo(1, -2.1, 1, -1.9);
outline.lineTo(1, 1.9);
outline.quadraticCurveTo(1, 2.1, 0.8, 2.1);
outline.lineTo(-0.8, 2.1);
outline.quadraticCurveTo(-1, 2.1, -1, 1.9);
outline.lineTo(-1, -1.9);
outline.quadraticCurveTo(-1, -2.1, -0.8, -2.1);
export const carBodyGeometry = new THREE.ExtrudeGeometry(outline, {
  depth: 0.4,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 1,
  bevelSize: 0.07,
  bevelThickness: 0.07,
  curveSegments: 4,
});
carBodyGeometry.rotateX(-Math.PI / 2);
export const carCabinGeometry = new THREE.BoxGeometry(1.7, 0.52, 2);
const cp = carCabinGeometry.attributes.position;
for (let i = 0; i < cp.count; i++)
  if (cp.getY(i) > 0) {
    cp.setX(i, cp.getX(i) * 0.84);
    cp.setZ(i, cp.getZ(i) * 0.76);
  }
cp.needsUpdate = true;
carCabinGeometry.computeVertexNormals();
const chrome = new THREE.MeshStandardMaterial({ color: 0x8b9193, metalness: 0.8, roughness: 0.27 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x22272b, roughness: 0.8 });
const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
const rim = new THREE.TorusGeometry(0.235, 0.036, 4, 12);
rim.rotateY(Math.PI / 2);
let policeLabel, plate;
function label(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 43px Arial';
  g.textAlign = 'center';
  g.fillText(text, 128, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 });
}
export function enhanceCar(group, wheels, paint, police) {
  const near = new THREE.Group(),
    lod = new THREE.LOD();
  lod.addLevel(near, 0);
  lod.addLevel(new THREE.Group(), 45);
  group.add(lod);
  const buckets = new Map();
  function box(m, x, y, z, w, h, d) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y, z);
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(geometry);
  }
  box(paint, 0, 1.42, -0.3, 1.45, 0.1, 1.55);
  box(rubber, 0, 0.4, 2.13, 1.76, 0.16, 0.12);
  box(rubber, 0, 0.4, -2.13, 1.76, 0.16, 0.12);
  box(chrome, 0, 0.65, 2.16, 0.85, 0.2, 0.04);
  for (let side of [-1, 1]) {
    box(paint, side * 0.96, 1.02, 0.44, 0.19, 0.12, 0.29);
    box(chrome, side * 1.01, 1.03, 0.44, 0.03, 0.08, 0.2);
    box(rubber, side * 0.96, 0.84, -0.15, 0.035, 0.035, 3);
    box(chrome, side * 1.005, 0.8, -0.45, 0.025, 0.04, 0.28);
    box(paint, side * 0.72, 1.13, 0.53, 0.08, 0.55, 0.1);
    box(paint, side * 0.74, 1.14, -1.03, 0.1, 0.53, 0.12);
    box(paint, side * 0.78, 1.14, -0.3, 0.075, 0.5, 0.08);
  }
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    near.add(mesh);
  }
  for (const wheel of wheels) {
    const detail = new THREE.LOD(),
      g = new THREE.Group();
    for (const x of [-0.16, 0.16]) {
      const ring = new THREE.Mesh(rim, chrome);
      ring.position.x = x;
      g.add(ring);
    }
    detail.addLevel(g, 0);
    detail.addLevel(new THREE.Group(), 28);
    wheel.add(detail);
  }
  if (!plate) plate = label('GTC 024', '#e0e0d6', '#222a2b');
  const number = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.13), plate);
  number.position.set(0, 0.55, -2.185);
  number.rotation.y = Math.PI;
  near.add(number);
  if (police) {
    const checks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.23, 0.43), white, 12),
      o = new THREE.Object3D(),
      color = new THREE.Color();
    let i = 0;
    for (const side of [-1, 1])
      for (let j = 0; j < 6; j++) {
        o.position.set(side * 1.095, 0.63, -1.28 + j * 0.47);
        o.updateMatrix();
        checks.setMatrixAt(i, o.matrix);
        color.set(j % 2 ? 0xd7df31 : 0x235bb2);
        checks.setColorAt(i++, color);
      }
    group.add(checks);
    if (!policeLabel) policeLabel = label('POLICE', '#f1f1e9', '#183f72');
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.27), policeLabel);
      sign.position.set(side * 1.115, 0.94, -0.3);
      sign.rotation.y = (side * Math.PI) / 2;
      near.add(sign);
    }
  }
}
