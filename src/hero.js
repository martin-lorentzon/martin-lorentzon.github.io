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

  const CURSOR_GLOW_RADIUS = 3.6;
  const CURSOR_ATTRACT_RADIUS = 7;
  const CURSOR_ATTRACT_ACCELERATION = prefersReducedMotion ? 0 : 10;
  const MAX_LINEAR_SPEED = 3.2;
  const MAX_ANGULAR_SPEED = 6;
  const GLOW_RAMP_SPEED = 6;
  const FRESNEL_POWER = 3.0; // higher = thinner, sharper rim
  const GLOW_RIM_FRACTION = 0.66;

  const SPAWN_AREA_FRACTION = 1.4;
  const INITIAL_SPEED_SPREAD = 1.6;
  const INITIAL_SPIN_SPREAD = 0.6;
  const MAX_TIMESTEP = 1 / 30;
  const COLLISION_SPIN_TRANSFER = 0.15;
  const ANGULAR_DAMPING_PER_SECOND = 0.25;

  const LIGHT_THEME = {
    ambient: { color: 0xfff3e2, intensity: 0.95 },
    key: { color: 0xffffff, intensity: 1.1 },
    fill: { color: 0xffd9a0, intensity: 0.35 },
    glow: { color: 0xff9142, intensity: 1.6 },
    exposure: 2,
  };
  const DARK_THEME = {
    ambient: { color: 0x2e3452, intensity: 0.5 },
    key: { color: 0x89a8ff, intensity: 1.5 }, // vivid moonlight
    fill: { color: 0xcf946e, intensity: 0.35 },
    glow: { color: 0xffb066, intensity: 0.7 },
    exposure: 1.05,
  };

  const themeCheckbox = document.querySelector('.theme-controller');
  let isDarkTheme = !!(themeCheckbox && themeCheckbox.checked);
  let theme = isDarkTheme ? DARK_THEME : LIGHT_THEME;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.exposure;
  renderer.domElement.classList.add('h-full', 'w-full', 'block');
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity);
  const keyLight = new THREE.DirectionalLight(theme.key.color, theme.key.intensity);
  keyLight.position.set(4, 6, 8);
  const fillLight = new THREE.DirectionalLight(theme.fill.color, theme.fill.intensity);
  fillLight.position.set(-6, -2, 4);
  scene.add(ambientLight, keyLight, fillLight);

  function applyTheme(isDark) {
    isDarkTheme = isDark;
    theme = isDarkTheme ? DARK_THEME : LIGHT_THEME;
    ambientLight.color.setHex(theme.ambient.color);
    ambientLight.intensity = theme.ambient.intensity;
    keyLight.color.setHex(theme.key.color);
    keyLight.intensity = theme.key.intensity;
    fillLight.color.setHex(theme.fill.color);
    fillLight.intensity = theme.fill.intensity;
    renderer.toneMappingExposure = theme.exposure;
    for (const p of popcorns) {
      if (p.glowUniforms) {
        p.glowUniforms.uGlowColor.value.setHex(theme.glow.color);
        p.glowUniforms.uGlowMax.value = theme.glow.intensity;
      }
    }
  }

  if (themeCheckbox) {
    themeCheckbox.addEventListener('change', () => {
      applyTheme(themeCheckbox.checked);
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

      mesh.position.set(randomSpread(halfWidth * SPAWN_AREA_FRACTION), randomSpread(halfHeight * SPAWN_AREA_FRACTION), 0);
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
          : new THREE.Vector3(randomSpread(INITIAL_SPEED_SPREAD), randomSpread(INITIAL_SPEED_SPREAD), 0),
        angularVelocity: prefersReducedMotion
          ? new THREE.Vector3()
          : new THREE.Vector3(randomSpread(INITIAL_SPIN_SPREAD), randomSpread(INITIAL_SPIN_SPREAD), randomSpread(INITIAL_SPIN_SPREAD)),
        glow: 0,
        glowUniforms: null,
      };

      // Fresnel-rim glow: mostly driven by grazing-angle edges (GLOW_RIM_FRACTION), with a
      // faint flat base so the piece doesn't look unlit when viewed face-on.
      mesh.material.onBeforeCompile = (shader) => {
        shader.uniforms.uGlow = { value: 0 };
        shader.uniforms.uGlowColor = { value: new THREE.Color(theme.glow.color) };
        shader.uniforms.uGlowMax = { value: theme.glow.intensity };
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
            totalEmissiveRadiance += uGlowColor * (uGlow * uGlowMax * (vFresnel * ${GLOW_RIM_FRACTION.toFixed(2)} + ${(1 - GLOW_RIM_FRACTION).toFixed(2)}));`,
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
  const _relVel = new THREE.Vector3();
  const _torque = new THREE.Vector3();

  function step(dt) {
    for (const p of popcorns) {
      let glowTarget = 0;

      if (cursorActive) {
        scratch.copy(cursorWorld).sub(p.mesh.position);
        scratch.z = 0;
        const dist = scratch.length();

        if (dist < CURSOR_GLOW_RADIUS) glowTarget = 1 - dist / CURSOR_GLOW_RADIUS;

        if (CURSOR_ATTRACT_ACCELERATION > 0 && dist > 0.001 && dist < CURSOR_ATTRACT_RADIUS) {
          const pull = (1 - dist / CURSOR_ATTRACT_RADIUS) * CURSOR_ATTRACT_ACCELERATION;
          p.velocity.addScaledVector(scratch.normalize(), pull * dt);
        }
      }

      p.glow += (glowTarget - p.glow) * Math.min(1, dt * GLOW_RAMP_SPEED);
      if (p.glowUniforms) p.glowUniforms.uGlow.value = p.glow;

      if (p.velocity.length() > MAX_LINEAR_SPEED) p.velocity.setLength(MAX_LINEAR_SPEED);
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.position.z = 0;

      p.angularVelocity.multiplyScalar(Math.max(0, 1 - ANGULAR_DAMPING_PER_SECOND * dt));
      if (p.angularVelocity.length() > MAX_ANGULAR_SPEED) p.angularVelocity.setLength(MAX_ANGULAR_SPEED);
      p.mesh.rotation.x += p.angularVelocity.x * dt;
      p.mesh.rotation.y += p.angularVelocity.y * dt;
      p.mesh.rotation.z += p.angularVelocity.z * dt;

      // Bounce off the viewport edges using this popcorn's just-updated position/rotation.
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

              // Convincing-enough spin: torque from the collision normal crossed with
              // the full relative velocity, applied equal-and-opposite to each piece.
              _relVel.copy(a.velocity).sub(b.velocity);
              _torque.crossVectors(normal, _relVel).multiplyScalar(COLLISION_SPIN_TRANSFER);
              a.angularVelocity.add(_torque);
              b.angularVelocity.sub(_torque);
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
    const dt = Math.min(timer.getDelta(), MAX_TIMESTEP);
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
