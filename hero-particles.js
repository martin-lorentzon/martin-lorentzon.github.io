import * as THREE from "./vendor/three.module.js";

const canvas = document.getElementById("hero-canvas");

if (canvas) {
  const GEOMETRY_RADIUS = 3.4;
  const GEOMETRY_TUBE = 1.1;
  const TUBULAR_SEGMENTS = 420;
  const RADIAL_SEGMENTS = 48;
  const KNOT_P = 2;
  const KNOT_Q = 3;

  const CAMERA_FOV = 50;
  const CAMERA_Z = 9;

  const FOCAL_DISTANCE = CAMERA_Z;
  const FOCAL_RANGE = 3.2;
  const JITTER_STRENGTH = 0.9;
  const BASE_POINT_SIZE = 0.12;

  const AUTO_ROTATE_SPEED = 0.12;
  const PARALLAX_LERP = 0.06;
  const PARALLAX_TILT = 0.35;

  const CLEAR_ALPHA = 1;

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uFocalDistance;
    uniform float uFocalRange;
    uniform float uJitterStrength;
    uniform float uBasePointSize;
    uniform float uPixelRatio;

    varying float vCoc;

    // GLSL has no built-in random/noise function, so hash a per-vertex
    // pseudo-random seed from its own position (stable across frames).
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    vec3 hash3(vec3 p) {
      return vec3(
        hash(p),
        hash(p + vec3(19.19, 0.0, 0.0)),
        hash(p + vec3(0.0, 27.53, 0.0))
      );
    }

    void main() {
      vec4 mvPositionBase = modelViewMatrix * vec4(position, 1.0);
      float camDist = -mvPositionBase.z;
      float coc = clamp(abs(camDist - uFocalDistance) / uFocalRange, 0.0, 1.0);
      vCoc = coc;

      vec3 seed = hash3(position) - 0.5;
      float wobble = sin(uTime * (0.5 + hash(position) * 0.7) + hash(position * 1.7) * 6.2831);
      vec3 offset = seed * wobble * uJitterStrength * coc;

      vec4 mvPosition = modelViewMatrix * vec4(position + offset, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float size = uBasePointSize * (1.0 + coc * 2.5);
      gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uAccentColor;
    uniform float uOpacity;

    varying float vCoc;

    void main() {
      vec2 centered = gl_PointCoord - 0.5;
      float dist = length(centered);
      if (dist > 0.5) discard;

      float core = smoothstep(0.5, 0.0, dist);
      vec3 color = mix(uColor, uAccentColor, vCoc * 0.6);
      float alpha = core * uOpacity * (1.0 - vCoc * 0.75);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.z = CAMERA_Z;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.TorusKnotGeometry(GEOMETRY_RADIUS, GEOMETRY_TUBE, TUBULAR_SEGMENTS, RADIAL_SEGMENTS, KNOT_P, KNOT_Q);
  // TorusKnotGeometry is indexed for triangle rendering, which makes Points
  // draw once per index entry (~6x per shared vertex) instead of once per
  // unique position. Drop the index so each vertex becomes exactly one point.
  geometry.setIndex(null);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFocalDistance: { value: FOCAL_DISTANCE },
      uFocalRange: { value: FOCAL_RANGE },
      uJitterStrength: { value: JITTER_STRENGTH },
      uBasePointSize: { value: BASE_POINT_SIZE },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uColor: { value: new THREE.Color(0xffffff) },
      uAccentColor: { value: new THREE.Color(0xffffff) },
      uOpacity: { value: 0.9 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);

  const parallaxGroup = new THREE.Group();
  parallaxGroup.add(points);
  scene.add(parallaxGroup);

  // Resolve a CSS color string of any color space (oklch, hsl, hex, ...) to
  // an sRGB THREE.Color via the canvas 2D API, which parses it the same way
  // the browser renders it. THREE.Color's own parser only understands
  // rgb/hsl/hex, which would silently fail on daisyUI v5's oklch() tokens.
  const colorProbe = document.createElement("canvas");
  colorProbe.width = colorProbe.height = 1;
  const colorProbeCtx = colorProbe.getContext("2d", { willReadFrequently: true });

  function resolveCSSColor(cssString, fallbackHex) {
    colorProbeCtx.fillStyle = fallbackHex;
    if (cssString) colorProbeCtx.fillStyle = cssString;
    colorProbeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = colorProbeCtx.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  }

  function applyTheme() {
    const style = getComputedStyle(document.documentElement);
    const isDark = style.colorScheme.trim().includes("dark");

    const baseFallback = isDark ? "#000000" : "#ffffff";
    const inkFallback = isDark ? "#f5f5f7" : "#1a1a24";

    const baseColor = resolveCSSColor(style.getPropertyValue("--color-base-100").trim(), baseFallback);
    const inkColor = resolveCSSColor(style.getPropertyValue("--color-base-content").trim(), inkFallback);
    const accentColor = resolveCSSColor(style.getPropertyValue("--color-primary").trim(), inkFallback);

    renderer.setClearColor(baseColor, CLEAR_ALPHA);

    material.uniforms.uColor.value.copy(inkColor);
    material.uniforms.uAccentColor.value.copy(accentColor);
    material.uniforms.uOpacity.value = isDark ? 0.85 : 0.95;
    // NormalBlending (not Multiply) so the shader's own alpha falloff stays
    // in control of edge softness and out-of-focus fade in light mode.
    material.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  let themeUpdateScheduled = false;
  function scheduleThemeUpdate() {
    if (themeUpdateScheduled) return;
    themeUpdateScheduled = true;
    requestAnimationFrame(() => {
      themeUpdateScheduled = false;
      applyTheme();
    });
  }

  // This site's daisyUI v5 theme-controller toggles theme purely via a CSS
  // :has() selector reacting to the checkbox's checked state - the
  // documentElement's data-theme/class attributes never actually change, so
  // a MutationObserver alone would never fire. Listening for the controller's
  // own change event is what actually catches the live toggle; the observer
  // is kept as a fallback for any theme that IS switched via attribute.
  new MutationObserver(scheduleThemeUpdate).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });

  document.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.classList.contains("theme-controller")) {
      scheduleThemeUpdate();
    }
  });

  applyTheme();

  // The canvas is sized to its containing section, not the viewport, so it
  // needs to track that section's size (which changes on text reflow, not
  // just window resize) rather than window resize events. Observing the
  // canvas itself would self-feedback-loop: resizing its drawing buffer
  // changes the element being observed. The parent section's size comes
  // from the text content next to it, which is unaffected by the canvas.
  const container = canvas.parentElement;

  function updateSize() {
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    // false = don't let Three.js write inline width/height styles onto the
    // canvas; it's CSS (absolute inset-0) that stretches it to fill its
    // section, and inline styles would fight that on every resize.
    renderer.setSize(width, height, false);
    material.uniforms.uPixelRatio.value = pixelRatio;
  }
  new ResizeObserver(updateSize).observe(container);

  let parallaxTargetX = 0;
  let parallaxTargetY = 0;
  let parallaxCurrentX = 0;
  let parallaxCurrentY = 0;

  window.addEventListener(
    "pointermove",
    (event) => {
      parallaxTargetX = (event.clientX / window.innerWidth) * 2 - 1;
      parallaxTargetY = (event.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let motionScale = prefersReducedMotion.matches ? 0 : 1;
  prefersReducedMotion.addEventListener("change", (event) => {
    motionScale = event.matches ? 0 : 1;
  });

  let lastTime = performance.now();
  let autoRotationY = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    material.uniforms.uTime.value = now * 0.001;

    autoRotationY += AUTO_ROTATE_SPEED * motionScale * delta;
    parallaxCurrentX += (parallaxTargetX - parallaxCurrentX) * PARALLAX_LERP;
    parallaxCurrentY += (parallaxTargetY - parallaxCurrentY) * PARALLAX_LERP;

    points.rotation.y = autoRotationY;
    parallaxGroup.rotation.x = parallaxCurrentY * PARALLAX_TILT * motionScale;
    parallaxGroup.rotation.z = -parallaxCurrentX * PARALLAX_TILT * 0.4 * motionScale;

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
} else {
  console.warn('hero-particles.js: no element with id="hero-canvas" found, skipping init.');
}
