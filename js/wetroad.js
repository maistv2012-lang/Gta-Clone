import * as THREE from 'three';

// Wet streets. Any road material can be patched to darken and take a sheen
// when the streets are wet; on high quality a planar reflection of the city
// (rendered from a mirrored camera) is blended in as well — puddles mirror
// sharply, damp tarmac gets a blurred reflection. The mirror pass only runs
// while the road is actually wet, so dry weather costs nothing.

const ROAD_Y = 0.07; // carriageways sit at 0.04–0.08

export const wetUniforms = {
  tWetRefl: { value: null },
  uWetMatrix: { value: new THREE.Matrix4() },
  uWet: { value: 0 },      // 0 dry .. 1 soaked
  uWetRefl: { value: 0 },  // 1 while the reflection texture is live
};

// Patch a Lambert/Standard road material so it darkens and shines when wet.
export function patchWetMaterial(material) {
  if (!material || material.userData.wet) return;
  material.userData.wet = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wetUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uWetMatrix;
        varying vec4 vWetUv;
        varying vec3 vWetPos;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wetWorld = modelMatrix * vec4(transformed, 1.0);
        vWetPos = wetWorld.xyz;
        vWetUv = uWetMatrix * wetWorld;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tWetRefl;
        uniform float uWet;
        uniform float uWetRefl;
        varying vec4 vWetUv;
        varying vec3 vWetPos;
        float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wetNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x),
                     mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
      .replace('#include <opaque_fragment>', `
        if (uWet > 0.01) {
          // puddles pool in the low spots; the rest of the tarmac is just damp
          float pool = wetNoise(vWetPos.xz * 0.06) * 0.7 + wetNoise(vWetPos.xz * 0.21) * 0.3;
          float puddle = smoothstep(0.3, 0.75, pool + (uWet - 0.6) * 0.5);
          float film = uWet * mix(0.78, 1.0, puddle);
          vec3 wetV = normalize(cameraPosition - vWetPos);
          float fres = 0.04 + 0.96 * pow(1.0 - max(wetV.y, 0.0), 5.0);
          outgoingLight *= 1.0 - 0.34 * film; // wet asphalt goes dark
          if (uWetRefl > 0.5) {
            // tiny ripples bend the mirror; damp areas read a blurrier mip
            vec2 rip = vec2(wetNoise(vWetPos.xz * 2.3), wetNoise(vWetPos.zx * 2.3 + 17.0)) - 0.5;
            vec4 uv = vWetUv;
            uv.xy += rip * uv.w * mix(0.014, 0.004, puddle);
            vec3 refl = texture2DProj(tWetRefl, uv, mix(2.4, 0.8, puddle)).rgb;
            outgoingLight += refl * fres * film * mix(0.7, 0.95, puddle);
          } else {
            outgoingLight += vec3(0.2, 0.235, 0.28) * (0.12 + fres) * film; // cheap sky sheen
          }
        }
        #include <opaque_fragment>`);
  };
  material.needsUpdate = true;
}

// The mirror pass (high quality only). render() goes right before the main render.
export function createWetMirror(renderer, scale = 0.5) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(
    Math.max(2, Math.floor(size.x * scale)), Math.max(2, Math.floor(size.y * scale)),
    { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }
  );
  wetUniforms.tWetRefl.value = target.texture;
  const mirrorCam = new THREE.PerspectiveCamera();
  const _plane = new THREE.Plane();
  const _clip = new THREE.Vector4();
  const _q = new THREE.Vector4();
  const _look = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _rot = new THREE.Matrix4();
  const _normal = new THREE.Vector3(0, 1, 0);
  const _origin = new THREE.Vector3(0, ROAD_Y, 0);
  let wetMeshes = [], scannedAt = -Infinity;

  return {
    setSize(w, h) { target.setSize(Math.max(2, Math.floor(w * scale)), Math.max(2, Math.floor(h * scale))); },
    render(scene, camera, enabled) {
      wetUniforms.uWetRefl.value = 0;
      if (!enabled || wetUniforms.uWet.value <= 0.02) return;
      camera.updateMatrixWorld();
      _camPos.setFromMatrixPosition(camera.matrixWorld);
      if (_camPos.y <= ROAD_Y + 0.05) return; // camera under the street (subway, diving)

      // mirror the camera through the road plane
      _rot.extractRotation(camera.matrixWorld);
      _look.set(0, 0, -1).applyMatrix4(_rot).add(_camPos);
      mirrorCam.position.set(_camPos.x, 2 * ROAD_Y - _camPos.y, _camPos.z);
      mirrorCam.up.set(0, 1, 0).applyMatrix4(_rot);
      mirrorCam.up.y *= -1;
      _look.y = 2 * ROAD_Y - _look.y;
      mirrorCam.lookAt(_look);
      mirrorCam.far = camera.far;
      mirrorCam.updateMatrixWorld();
      mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
      wetUniforms.uWetMatrix.value.set(
        0.5, 0, 0, 0.5,
        0, 0.5, 0, 0.5,
        0, 0, 0.5, 0.5,
        0, 0, 0, 1
      ).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);

      // oblique near plane: clip everything below the street out of the mirror
      _plane.setFromNormalAndCoplanarPoint(_normal, _origin).applyMatrix4(mirrorCam.matrixWorldInverse);
      _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
      const pm = mirrorCam.projectionMatrix.elements;
      _q.x = (Math.sign(_clip.x) + pm[8]) / pm[0];
      _q.y = (Math.sign(_clip.y) + pm[9]) / pm[5];
      _q.z = -1;
      _q.w = (1 + pm[10]) / pm[14];
      _clip.multiplyScalar(2 / _clip.dot(_q));
      pm[2] = _clip.x;
      pm[6] = _clip.y;
      pm[10] = _clip.z + 1 - 0.003;
      pm[14] = _clip.w;

      // never sample the target while drawing into it: hide the wet surfaces.
      // Static geometry is batched after startup, so rescan now and then.
      const now = performance.now();
      if (now - scannedAt > 3000) {
        scannedAt = now;
        wetMeshes = [];
        scene.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.wet) wetMeshes.push(o); });
      }
      const shown = wetMeshes.map((m) => m.visible);
      for (const m of wetMeshes) m.visible = false;
      const prevTarget = renderer.getRenderTarget();
      const prevShadows = renderer.shadowMap.autoUpdate;
      const prevNeeds = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.autoUpdate = false; // reuse the existing shadow map
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(prevTarget);
      renderer.shadowMap.autoUpdate = prevShadows;
      renderer.shadowMap.needsUpdate = prevNeeds;
      wetMeshes.forEach((m, i) => { m.visible = shown[i]; });
      wetUniforms.uWetRefl.value = 1;
    },
  };
}
