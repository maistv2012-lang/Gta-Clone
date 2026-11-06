import * as THREE from 'three';
import { polygonContact } from './road-network.js';
// Reuse a small local collision set rather than raycasting the whole city each frame.
export function createChaseCameraClip(city) {
  let near = [],
    lastX = Infinity,
    lastZ = Infinity,
    count = -1;
  const point = new THREE.Vector3(),
    previous = new THREE.Vector3();
  return (camera, target) => {
    if (Math.hypot(target.x - lastX, target.z - lastZ) > 3 || city.colliders.length !== count) {
      near = city.colliders.filter(
        (c) =>
          c.x0 < target.x + 9 && c.x1 > target.x - 9 && c.z0 < target.z + 9 && c.z1 > target.z - 9
      );
      lastX = target.x;
      lastZ = target.z;
      count = city.colliders.length;
    }
    previous.copy(target);
    for (let i = 1; i <= 18; i++) {
      point.lerpVectors(target, camera.position, i / 18);
      const blocked = near.some(
        (c) =>
          point.y < (c.h || 0) &&
          point.x >= c.x0 - 0.3 &&
          point.x <= c.x1 + 0.3 &&
          point.z >= c.z0 - 0.3 &&
          point.z <= c.z1 + 0.3 &&
          (!c.polygon || polygonContact(point.x, point.z, c.polygon, 0.3))
      );
      if (blocked) {
        camera.position.copy(previous);
        camera.lookAt(target);
        return;
      }
      previous.copy(point);
    }
  };
}
