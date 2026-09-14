import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/three/loaders/DRACOLoader.js';

const container = document.getElementById('hero-canvas');
if (container) initPopcornHero(container);

function initPopcornHero(container) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCompact = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;

  const POPCORN_COUNT = isCompact ? 7 : 14;
  const PIXEL_RATIO_CAP = isCompact ? 1.5 : 2;
  const CAMERA_Z = 12;
  const FOV = 50;
  const TONE_MAPPING_EXPOSURE = 2;

  const GLOW_RADIUS = 3.6; // distance at which cursor proximity starts triggering glow
  const ATTRACT_RADIUS = 7; // distance at which the cursor starts pulling popcorns in
  const ATTRACT_STRENGTH = prefersReducedMotion ? 0 : 10; // magnet pull acceleration
  const MAX_SPEED = 3.2; // speed cap applied to every popcorn, attracted or not
  const GLOW_LERP_SPEED = 6; // how fast each popcorn's glow ramps toward its target
  const FRESNEL_POWER = 3.0; // rim tightness: higher = thinner, sharper edge glow
  const GLOW_RIM_MIX = 0.5; // fraction of glow driven by the fresnel rim vs a flat base

  const SPAWN_SPREAD = 1.4; // fraction of the viewport half-size popcorns can spawn across
  const INITIAL_SPEED = 1.6; // spread of each popcorn's random initial linear velocity
  const INITIAL_SPIN = 0.6; // spread of each popcorn's random initial angular velocity
  const MAX_DT = 1 / 30; // clamp on the simulation timestep to avoid big jumps after a stall

  const THEMES = {
    light: {
      ambient: { color: 0xfff3e2, intensity: 0.95 },
      key: { color: 0xffffff, intensity: 1.1 },
      fill: { color: 0xffd9a0, intensity: 0.35 },
      glow: { color: 0xff9142, max: 1.6, multiply: 1 },
    },
    dark: {
      ambient: { color: 0x4A527A, intensity: 0.55 },
      key: { color: 0xcdd8ff, intensity: 0.85 },
      fill: { color: 0xff8a3d, intensity: 0.4 },
      glow: { color: 0xffb066, max: 2.4, multiply: 0.25 },
    },
  };

  // Effective glow ceiling for a theme: max * multiply, so multiply is a quick per-theme
  // dial without needing to recompute the tuned max value.
  function themeGlowMax(t) {
    return t.glow.max * t.glow.multiply;
  }

  const themeCheckbox = document.querySelector('.theme-controller');
  let theme = THEMES[themeCheckbox && themeCheckbox.checked ? 'dark' : 'light'];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.domElement.classList.add('h-full', 'w-full', 'block');
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity);
  const keyLight = new THREE.DirectionalLight(theme.key.color, theme.key.intensity);
  keyLight.position.set(4, 6, 8);
  const fillLight = new THREE.DirectionalLight(theme.fill.color, theme.fill.intensity);
  fillLight.position.set(-6, -2, 4);
  scene.add(ambientLight, keyLight, fillLight);

  function applyTheme(next) {
    theme = next;
    ambientLight.color.setHex(theme.ambient.color);
    ambientLight.intensity = theme.ambient.intensity;
    keyLight.color.setHex(theme.key.color);
    keyLight.intensity = theme.key.intensity;
    fillLight.color.setHex(theme.fill.color);
    fillLight.intensity = theme.fill.intensity;
    for (const p of popcorns) {
      if (p.glowUniforms) {
        p.glowUniforms.uGlowColor.value.setHex(theme.glow.color);
        p.glowUniforms.uGlowMax.value = themeGlowMax(theme);
      }
    }
  }

  if (themeCheckbox) {
    themeCheckbox.addEventListener('change', () => {
      applyTheme(THEMES[themeCheckbox.checked ? 'dark' : 'light']);
    });
  }

  const popcorns = [];
  let halfWidth = 1;
  let halfHeight = 1;

  const WORLD_X = new THREE.Vector3(1, 0, 0);
  const WORLD_Y = new THREE.Vector3(0, 1, 0);
  const _invQuat = new THREE.Quaternion();
  const _localDir = new THREE.Vector3();

  // Radius of a popcorn's ellipsoid collider along a given world-space direction,
  // accounting for its current rotation (each piece keeps spinning via angularVelocity).
  function ellipsoidRadius(popcorn, worldDir) {
    _invQuat.copy(popcorn.mesh.quaternion).invert();
    _localDir.copy(worldDir).applyQuaternion(_invQuat);
    const he = popcorn.halfExtents;
    const nx = _localDir.x / he.x;
    const ny = _localDir.y / he.y;
    const nz = _localDir.z / he.z;
    return 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
  }

  function resizeRendererToDisplaySize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    halfHeight = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    halfWidth = halfHeight * camera.aspect;

    for (const p of popcorns) {
      const rx = ellipsoidRadius(p, WORLD_X);
      const ry = ellipsoidRadius(p, WORLD_Y);
      p.mesh.position.x = THREE.MathUtils.clamp(p.mesh.position.x, -halfWidth + rx, halfWidth - rx);
      p.mesh.position.y = THREE.MathUtils.clamp(p.mesh.position.y, -halfHeight + ry, halfHeight - ry);
    }
  }

  resizeRendererToDisplaySize();
  const resizeObserver = new ResizeObserver(resizeRendererToDisplaySize);
  resizeObserver.observe(container);

  function randomSpread(scale) {
    return (Math.random() - 0.5) * scale;
  }

  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('vendor/three/libs/draco/gltf/');
  loader.setDRACOLoader(dracoLoader);

  loader.load('gltf/Popcorn.glb', (gltf) => {
    const sourceMeshes = gltf.scene.children.filter((child) => child.isMesh);
    for (let i = sourceMeshes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sourceMeshes[i], sourceMeshes[j]] = [sourceMeshes[j], sourceMeshes[i]];
    }

    for (let i = 0; i < POPCORN_COUNT; i++) {
      const source = sourceMeshes[i % sourceMeshes.length];
      const mesh = source.clone();
      mesh.material = source.material.clone();

      mesh.position.set(randomSpread(halfWidth * SPAWN_SPREAD), randomSpread(halfHeight * SPAWN_SPREAD), 0);
      mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      scene.add(mesh);

      if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
      const box = source.geometry.boundingBox;

      const popcorn = {
        mesh,
        halfExtents: new THREE.Vector3(
          (box.max.x - box.min.x) / 2,
          (box.max.y - box.min.y) / 2,
          (box.max.z - box.min.z) / 2,
        ),
        velocity: prefersReducedMotion
          ? new THREE.Vector3()
          : new THREE.Vector3(randomSpread(INITIAL_SPEED), randomSpread(INITIAL_SPEED), 0),
        angularVelocity: prefersReducedMotion
          ? new THREE.Vector3()
          : new THREE.Vector3(randomSpread(INITIAL_SPIN), randomSpread(INITIAL_SPIN), randomSpread(INITIAL_SPIN)),
        glow: 0,
        glowUniforms: null,
      };

      // Fresnel-rim glow: mostly driven by grazing-angle edges (GLOW_RIM_MIX), with a
      // faint flat base so the piece doesn't look unlit when viewed face-on.
      mesh.material.onBeforeCompile = (shader) => {
        shader.uniforms.uGlow = { value: 0 };
        shader.uniforms.uGlowColor = { value: new THREE.Color(theme.glow.color) };
        shader.uniforms.uGlowMax = { value: themeGlowMax(theme) };
        shader.uniforms.uFresnelPower = { value: FRESNEL_POWER };

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform float uGlow;
            uniform vec3 uGlowColor;
            uniform float uGlowMax;
            uniform float uFresnelPower;`,
          )
          .replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
            float vFresnel = pow(clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), uFresnelPower);`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += uGlowColor * (uGlow * uGlowMax * (vFresnel * ${GLOW_RIM_MIX.toFixed(2)} + ${(1 - GLOW_RIM_MIX).toFixed(2)}));`,
          );

        popcorn.glowUniforms = shader.uniforms;
      };

      popcorns.push(popcorn);
    }

    resizeRendererToDisplaySize();
    startLoop();
  });

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const popcornPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const cursorWorld = new THREE.Vector3();
  let cursorActive = false;

  function setPointerFromClient(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.ray.intersectPlane(popcornPlane, cursorWorld)) {
      cursorActive = true;
    }
  }

  window.addEventListener('pointermove', (event) => setPointerFromClient(event.clientX, event.clientY));
  window.addEventListener('pointerdown', (event) => setPointerFromClient(event.clientX, event.clientY));
  window.addEventListener('blur', () => { cursorActive = false; });
  document.addEventListener('pointerleave', () => { cursorActive = false; });
  container.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches[0]) setPointerFromClient(event.touches[0].clientX, event.touches[0].clientY);
    },
    { passive: true },
  );
  container.addEventListener('touchend', () => { cursorActive = false; });

  const scratch = new THREE.Vector3();

  function step(dt) {
    for (const p of popcorns) {
      let glowTarget = 0;

      if (cursorActive) {
        scratch.copy(cursorWorld).sub(p.mesh.position);
        scratch.z = 0;
        const dist = scratch.length();

        if (dist < GLOW_RADIUS) glowTarget = 1 - dist / GLOW_RADIUS;

        if (ATTRACT_STRENGTH > 0 && dist > 0.001 && dist < ATTRACT_RADIUS) {
          const pull = (1 - dist / ATTRACT_RADIUS) * ATTRACT_STRENGTH;
          p.velocity.addScaledVector(scratch.normalize(), pull * dt);
        }
      }

      p.glow += (glowTarget - p.glow) * Math.min(1, dt * GLOW_LERP_SPEED);
      if (p.glowUniforms) p.glowUniforms.uGlow.value = p.glow;

      if (p.velocity.length() > MAX_SPEED) p.velocity.setLength(MAX_SPEED);
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.position.z = 0;

      p.mesh.rotation.x += p.angularVelocity.x * dt;
      p.mesh.rotation.y += p.angularVelocity.y * dt;
      p.mesh.rotation.z += p.angularVelocity.z * dt;
    }

    for (const p of popcorns) {
      const pos = p.mesh.position;
      const rx = ellipsoidRadius(p, WORLD_X);
      const ry = ellipsoidRadius(p, WORLD_Y);
      if (pos.x - rx < -halfWidth) { pos.x = -halfWidth + rx; p.velocity.x = Math.abs(p.velocity.x); }
      if (pos.x + rx > halfWidth) { pos.x = halfWidth - rx; p.velocity.x = -Math.abs(p.velocity.x); }
      if (pos.y - ry < -halfHeight) { pos.y = -halfHeight + ry; p.velocity.y = Math.abs(p.velocity.y); }
      if (pos.y + ry > halfHeight) { pos.y = halfHeight - ry; p.velocity.y = -Math.abs(p.velocity.y); }
    }

    for (let i = 0; i < popcorns.length; i++) {
      for (let j = i + 1; j < popcorns.length; j++) {
        const a = popcorns[i];
        const b = popcorns[j];
        const delta = scratch.copy(a.mesh.position).sub(b.mesh.position);
        const dist = delta.length();

        if (dist > 0.0001) {
          const normal = delta.multiplyScalar(1 / dist);
          const minDist = ellipsoidRadius(a, normal) + ellipsoidRadius(b, normal);

          if (dist < minDist) {
            const overlap = minDist - dist;
            a.mesh.position.addScaledVector(normal, overlap / 2);
            b.mesh.position.addScaledVector(normal, -overlap / 2);

            const relVel = a.velocity.dot(normal) - b.velocity.dot(normal);
            if (relVel < 0) {
              a.velocity.addScaledVector(normal, -relVel);
              b.velocity.addScaledVector(normal, relVel);
            }
          }
        }
      }
    }
  }

  const timer = new THREE.Timer();
  timer.connect(document);
  let running = !document.hidden;
  let loopActive = false;

  function frame() {
    if (!running) { loopActive = false; return; }
    timer.update();
    const dt = Math.min(timer.getDelta(), MAX_DT);
    step(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function startLoop() {
    if (loopActive || !running) return;
    loopActive = true;
    timer.reset();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) startLoop();
  });
}
