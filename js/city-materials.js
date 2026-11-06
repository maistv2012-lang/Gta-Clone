import * as THREE from 'three';
let cached;
export async function cityMaterials() {
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  const texture = async (name, color = false) => {
    let value;
    try {
      value = await loader.loadAsync(
        new URL(`../assets/christchurch/${name}`, import.meta.url).href
      );
    } catch (error) {
      throw new Error(
        `Não foi possível carregar a textura local assets/christchurch/${name}. Verifique se os assets foram incluídos.`,
        { cause: error }
      );
    }
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    value.anisotropy = 4;
    return value;
  };
  const result = {};
  await Promise.all(
    ['stone', 'limestone', 'paving', 'asphalt', 'roof', 'brick'].map(async (name) => {
      const [map, normalMap, roughnessMap] = await Promise.all([
        texture(`${name}-color.jpg`, true),
        texture(`${name}-normal.png`),
        texture(`${name}-roughness.png`),
      ]);
      result[name] = new THREE.MeshStandardMaterial({
        map,
        normalMap,
        roughnessMap,
        roughness: 0.95,
        side: THREE.DoubleSide,
        normalScale: new THREE.Vector2(0.45, 0.45),
      });
    })
  );
  result.trim = new THREE.MeshStandardMaterial({ color: 0xb7b7a8, roughness: 0.82 });
  result.metal = new THREE.MeshStandardMaterial({
    color: 0x343d3e,
    metalness: 0.65,
    roughness: 0.5,
  });
  result.glass = new THREE.MeshStandardMaterial({
    color: 0x344b54,
    metalness: 0.65,
    roughness: 0.2,
  });
  result.wood = new THREE.MeshStandardMaterial({ color: 0x78543b, roughness: 0.8 });
  result.white = new THREE.MeshStandardMaterial({ color: 0xdedaca, roughness: 0.85 });
  const foliage = await texture('foliage-color.png', true);
  result.leaf = new THREE.MeshStandardMaterial({
    map: foliage,
    color: 0xb5ba91,
    roughness: 1,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  cached = result;
  return result;
}
// Metre-scaled UVs, including extruded OSM walls and sloping roofs.
export function worldUV(geometry, scale = 2) {
  const p = geometry.attributes.position,
    n = geometry.attributes.normal,
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const horizontal = Math.abs(n.getY(i)) > 0.6;
    uv[i * 2] = (horizontal || Math.abs(n.getZ(i)) > 0.5 ? p.getX(i) : p.getZ(i)) / scale;
    uv[i * 2 + 1] = (horizontal ? p.getZ(i) : p.getY(i)) / scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
