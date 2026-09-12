import * as THREE from "./vendor/three.module.js";

const canvas = document.getElementById("hero-canvas");

if (canvas) {
  // --- Geometry ---
  const GEOMETRY_RADIUS = 3.4;
  const GEOMETRY_TUBE = 1.1;
  const TUBULAR_SEGMENTS = 420 * 2;
  const RADIAL_SEGMENTS = 48 * 2;
  const KNOT_P = 2;
  const KNOT_Q = 3;

  // --- Camera ---
  const CAMERA_FOV = 50;
  const MOBILE_BREAKPOINT = 768; // container width (px) at/below which the mobile camera position is used
  const CAMERA_POSITION_DESKTOP = { x: -2, y: 0, z: 10 };
  const CAMERA_POSITION_MOBILE = { x: -2.5, y: 0, z: 16 };

  // --- Depth of field ---
  // How far in front of the knot's center (toward the camera) the focal
  // plane sits. 0 = focused on the center; larger values bias the sharp
  // zone toward the near/front-facing surface instead.
  const FOCAL_DISTANCE_OFFSET = 1;
  const FOCAL_DISTANCE = CAMERA_POSITION_DESKTOP.z - FOCAL_DISTANCE_OFFSET;
  const FOCAL_RANGE = 9; // depth range over which points ramp from in-focus to fully "away"
  // Depth cues for points farther than the focal plane ("away" from the
  // camera), conveyed purely through size and jitter - no blur/fade/tint.
  const AWAY_SIZE = 0.05; // point-size multiplier at full defocus
  const AWAY_JITTER = 20; // max 3D wobble displacement at full defocus

  // --- Point appearance ---
  const BASE_POINT_SIZE = 0.05;
  // Always-on random size multiplier, independent of focus, so the cloud
  // has natural size variance instead of every point being identical.
  const SIZE_VARIATION = 1;
  // Fixed per-point scatter along the knot's local surface (tangent to the
  // normal), so points don't sit exactly on the tubular/radial segment grid.
  const SURFACE_TANGENT_OFFSET = 0.15;

  // --- Motion ---
  const AUTO_ROTATE_SPEED = 0.12;
  const PARALLAX_LERP = 0.06;
  const PARALLAX_TILT = 0.25;

  // --- Cursor ---
  const CURSOR_LERP = 0.055; // how quickly the dot/avoidance point catches up to the raycast hit
  const CURSOR_ACTIVE_LERP = 0.12; // fade in/out speed when the pointer enters/leaves
  // Radius/strength/jitter are in the knot's own local units (radius 3.4,
  // tube 1.1), since the cursor is a real 3D point on/near its surface.
  const CURSOR_RADIUS = 1.6; // radius of the avoidance zone around the cursor point
  const CURSOR_STRENGTH = 1.6; // max push applied to points inside the radius
  const CURSOR_JITTER = 2; // extra wobble amplitude for points near the cursor
  const CURSOR_SIZE_BOOST = 0.35; // point-size multiplier at the cursor's center
  const CURSOR_DOT_SIZE = 0.55; // world-space diameter of the cursor dot sprite
  // The raycast proxy only needs to roughly match the knot's shape, not the
  // point cloud's full density, so it stays cheap to hit-test - cheap enough
  // to raycast once per rendered frame (see animate below) rather than only
  // on pointer movement, which is what keeps the cursor point glued to the
  // mouse instead of drifting with the knot's auto-rotation.
  const PROXY_TUBULAR_SEGMENTS = 90;
  const PROXY_RADIAL_SEGMENTS = 12;

  const CLEAR_ALPHA = 1;

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uFocalDistance;
    uniform float uFocalRange;
    uniform float uAwaySize;
    uniform float uAwayJitter;
    uniform float uSizeVariation;
    uniform float uBasePointSize;
    uniform float uPixelRatio;
    uniform float uSurfaceTangentOffset;
    uniform vec3 uCursorPos;
    uniform float uCursorActive;
    uniform float uCursorRadius;
    uniform float uCursorStrength;
    uniform float uCursorJitter;
    uniform float uCursorSizeBoost;

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
      // Scatter each point a little along the surface (tangent to the
      // normal) so the tubular/radial segment grid doesn't read as a
      // uniform lattice. Hashes distinct from the jitter ones below keep
      // the two effects uncorrelated.
      vec3 arbitraryUp = abs(normal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 tangentA = normalize(cross(normal, arbitraryUp));
      vec3 tangentB = cross(normal, tangentA);
      vec2 tangentSeed = hash3(position * 3.1 + 11.0).xy - 0.5;
      vec3 scatteredPosition = position + (tangentA * tangentSeed.x + tangentB * tangentSeed.y) * uSurfaceTangentOffset;

      vec4 mvPositionBase = modelViewMatrix * vec4(scatteredPosition, 1.0);
      float camDist = -mvPositionBase.z;
      // No abs() here: only points farther than the focal plane should blur.
      // Points nearer the camera stay sharp regardless of how close they get.
      // smoothstep (not a linear ramp) eases the transition in and out so
      // it reads as a gradual falloff rather than a hard sharp/blurry line.
      float coc = smoothstep(0.0, uFocalRange, camDist - uFocalDistance);

      vec3 seed = hash3(scatteredPosition) - 0.5;
      float wobble = sin(uTime * (0.5 + hash(scatteredPosition) * 0.7) + hash(scatteredPosition * 1.7) * 6.2831);
      vec3 offset = seed * wobble * uAwayJitter * coc;

      // Push points away from uCursorPos - a real 3D point on/near the
      // knot's surface found by raycasting on the JS side - in the same
      // local space as scatteredPosition, not a screen-space trick, so
      // the push reads as true 3D displacement once projected. Reuses the
      // seed/wobble from the jitter above so it reads as the same effect.
      vec3 toPoint = scatteredPosition - uCursorPos;
      float cursorDist = length(toPoint);
      float cursorFalloff = 1.0 - smoothstep(0.0, uCursorRadius, cursorDist);
      // sqrt() keeps the push strong across most of the radius, tapering
      // off sharply only right at the edge.
      float cursorInfluence = sqrt(cursorFalloff) * uCursorActive;
      vec3 avoidDir = cursorDist > 0.0001 ? toPoint / cursorDist : seed;
      vec3 cursorOffset = avoidDir * uCursorStrength * cursorInfluence + seed * wobble * uCursorJitter * cursorInfluence;

      vec4 mvPosition = modelViewMatrix * vec4(scatteredPosition + offset + cursorOffset, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Always-on random size multiplier, independent of coc, so points
      // don't all read as the same uniform dot size.
      float sizeVariationRandom = hash(scatteredPosition * 5.2 + 3.0);
      float sizeVariationMultiplier = mix(1.0 - uSizeVariation, 1.0 + uSizeVariation, sizeVariationRandom);

      float size = uBasePointSize * (1.0 + coc * uAwaySize + cursorInfluence * uCursorSizeBoost) * sizeVariationMultiplier;
      gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;

    void main() {
      // Flat, hard-edged circle - no radial falloff/glow, just a disc.
      if (length(gl_PointCoord - 0.5) > 0.5) discard;
      gl_FragColor = vec4(uColor, uOpacity);
    }
  `;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(CAMERA_POSITION_DESKTOP.x, CAMERA_POSITION_DESKTOP.y, CAMERA_POSITION_DESKTOP.z);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.TorusKnotGeometry(GEOMETRY_RADIUS, GEOMETRY_TUBE, TUBULAR_SEGMENTS, RADIAL_SEGMENTS, KNOT_P, KNOT_Q);
  // TorusKnotGeometry is indexed for triangle rendering, which makes Points
  // draw once per index entry (~6x per shared vertex) instead of once per
  // unique position. Drop the index so each vertex becomes exactly one point.
  geometry.setIndex(null);
  // The knot curve's bounding-box centroid isn't exactly at the local origin
  // for asymmetric (p,q) pairs like (2,3), so rotating it around Y (0,0,0)
  // makes it visibly orbit off-center instead of spinning in place.
  geometry.center();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFocalDistance: { value: FOCAL_DISTANCE },
      uFocalRange: { value: FOCAL_RANGE },
      uAwaySize: { value: AWAY_SIZE },
      uAwayJitter: { value: AWAY_JITTER },
      uSizeVariation: { value: SIZE_VARIATION },
      uSurfaceTangentOffset: { value: SURFACE_TANGENT_OFFSET },
      uBasePointSize: { value: BASE_POINT_SIZE },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uColor: { value: new THREE.Color(0xffffff) },
      uOpacity: { value: 0.9 },
      uCursorPos: { value: new THREE.Vector3() },
      uCursorActive: { value: 0 },
      uCursorRadius: { value: CURSOR_RADIUS },
      uCursorStrength: { value: CURSOR_STRENGTH },
      uCursorJitter: { value: CURSOR_JITTER },
      uCursorSizeBoost: { value: CURSOR_SIZE_BOOST },
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

  // The visual Points geometry has no triangles to hit-test (its index was
  // stripped above), so raycasting the cursor onto the knot needs a second,
  // low-poly stand-in mesh with its index intact. It's parented under
  // `points` so it always shares the exact same rotation, and never drawn.
  const proxyGeometry = new THREE.TorusKnotGeometry(GEOMETRY_RADIUS, GEOMETRY_TUBE, PROXY_TUBULAR_SEGMENTS, PROXY_RADIAL_SEGMENTS, KNOT_P, KNOT_Q);
  proxyGeometry.center();
  const raycastProxyMesh = new THREE.Mesh(proxyGeometry, new THREE.MeshBasicMaterial());
  raycastProxyMesh.visible = false;
  points.add(raycastProxyMesh);

  // Cursor dot: a camera-facing sprite marking the raycast hit point (see
  // updateCursorTarget below), parented under `points` so it perspective-
  // scales and rotates with the knot like a real point on its surface.
  // Drawn as a flat hard-edged disc, matching the point cloud's own circles.
  const cursorDotCanvas = document.createElement("canvas");
  cursorDotCanvas.width = cursorDotCanvas.height = 64;
  const cursorDotCtx = cursorDotCanvas.getContext("2d");
  cursorDotCtx.fillStyle = "#ffffff";
  cursorDotCtx.beginPath();
  cursorDotCtx.arc(32, 32, 32, 0, Math.PI * 2);
  cursorDotCtx.fill();

  const cursorDotMaterial = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cursorDotCanvas),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const cursorDotSprite = new THREE.Sprite(cursorDotMaterial);
  cursorDotSprite.scale.set(CURSOR_DOT_SIZE, CURSOR_DOT_SIZE, 1);
  points.add(cursorDotSprite);

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

    renderer.setClearColor(baseColor, CLEAR_ALPHA);

    material.uniforms.uColor.value.copy(inkColor);
    material.uniforms.uOpacity.value = isDark ? 0.85 : 0.95;
    cursorDotMaterial.color.copy(inkColor);
    // NormalBlending in light mode - Additive would blow overlapping
    // circles out to solid white against a light background.
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

  let containerWidth = 1;
  let containerHeight = 1;

  function updateSize() {
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    containerWidth = width;
    containerHeight = height;
    camera.aspect = width / height;

    const pos = width <= MOBILE_BREAKPOINT ? CAMERA_POSITION_MOBILE : CAMERA_POSITION_DESKTOP;
    camera.position.set(pos.x, pos.y, pos.z);
    material.uniforms.uFocalDistance.value = Math.hypot(pos.x, pos.y, pos.z) - FOCAL_DISTANCE_OFFSET;

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

  // Wherever the cursor dot overlaps the hero heading, the overlapping
  // glyph pixels swap to the theme's background color instead of the whole
  // circle changing - implemented as a clone of the heading, colored with
  // the swapped color, revealed only within a circle clipped to the dot's
  // current screen position/size. The clone is wrapped in a full-hero
  // layer so the clip-path's coordinate space matches the screen-position
  // math below (a clip-path on the heading itself would be relative to its
  // own shrink-to-fit box instead).
  const heroHeading = document.getElementById("hero-heading");
  let invertedHeadingLayer = null;
  if (heroHeading) {
    const invertedHeading = heroHeading.cloneNode(true);
    invertedHeading.removeAttribute("id");
    invertedHeading.classList.add("text-base-100");

    invertedHeadingLayer = document.createElement("div");
    invertedHeadingLayer.className = "pointer-events-none absolute inset-0 z-20";
    invertedHeadingLayer.setAttribute("aria-hidden", "true");
    invertedHeadingLayer.style.clipPath = "circle(0px at 0px 0px)";
    invertedHeadingLayer.appendChild(invertedHeading);
    container.appendChild(invertedHeadingLayer);
  }

  const raycaster = new THREE.Raycaster();
  const cursorNdc = new THREE.Vector2();
  const cursorTarget3D = new THREE.Vector3();
  const cursorCurrent3D = new THREE.Vector3();
  const cursorWorldPos = new THREE.Vector3();
  let hasCursorTarget = false;
  let cursorActiveTarget = 0;
  let cursorActiveCurrent = 0;

  // Scratch objects reused across raycasts (see updateCursorTarget) instead
  // of allocating a Plane/Vector3/array on every call.
  const focalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  const focalPlaneHit = new THREE.Vector3();
  const raycastHits = [];

  // The mouse position alone isn't enough to know where the cursor point is
  // on the knot - the knot keeps auto-rotating underneath it - so this is
  // re-run every rendered frame (from the last known mouse position) rather
  // than only on pointer movement, or the cursor would drift along with the
  // rotation whenever the mouse held still.
  let mouseClientX = 0;
  let mouseClientY = 0;

  function updateCursorTarget(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    cursorNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    cursorNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    // Refresh just the matrices this raycast depends on (ancestors, `points`
    // itself, and its children) before casting the ray against the proxy.
    points.updateWorldMatrix(true, true);
    raycaster.setFromCamera(cursorNdc, camera);
    raycastHits.length = 0;
    raycaster.intersectObject(raycastProxyMesh, false, raycastHits);

    let worldPoint = raycastHits[0]?.point;
    if (!worldPoint) {
      // The knot has gaps the ray can miss entirely - fall back to the same
      // focal plane the depth-of-field effect treats as "in focus".
      focalPlane.constant = -(camera.position.z - material.uniforms.uFocalDistance.value);
      worldPoint = raycaster.ray.intersectPlane(focalPlane, focalPlaneHit);
      if (!worldPoint) return;
    }

    // `points`, the proxy mesh and the cursor sprite all share the same
    // rotating local space, so express the target there.
    points.worldToLocal(worldPoint);
    cursorTarget3D.copy(worldPoint);

    if (!hasCursorTarget) {
      cursorCurrent3D.copy(cursorTarget3D);
      hasCursorTarget = true;
    }
  }

  container.addEventListener(
    "pointermove",
    (event) => {
      mouseClientX = event.clientX;
      mouseClientY = event.clientY;
    },
    { passive: true }
  );
  container.addEventListener(
    "pointerenter",
    (event) => {
      mouseClientX = event.clientX;
      mouseClientY = event.clientY;
      updateCursorTarget(mouseClientX, mouseClientY);
      cursorActiveTarget = 1;
    },
    { passive: true }
  );
  container.addEventListener("pointerleave", () => {
    cursorActiveTarget = 0;
  });

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
    parallaxGroup.rotation.y = parallaxCurrentX * PARALLAX_TILT * 0.4 * motionScale;

    if (cursorActiveTarget === 1) updateCursorTarget(mouseClientX, mouseClientY);
    cursorCurrent3D.lerp(cursorTarget3D, CURSOR_LERP);
    cursorActiveCurrent += (cursorActiveTarget - cursorActiveCurrent) * CURSOR_ACTIVE_LERP;

    cursorDotSprite.position.copy(cursorCurrent3D);
    cursorDotMaterial.opacity = cursorActiveCurrent;

    material.uniforms.uCursorPos.value.copy(cursorCurrent3D);
    // Reduced-motion users still see the dot, but the particle cloud itself
    // stays still - same treatment as the parallax tilt above.
    material.uniforms.uCursorActive.value = cursorActiveCurrent * motionScale;

    if (invertedHeadingLayer) {
      // Project the dot's world position to a screen-space circle matching
      // where/how big it actually renders, so the heading-invert clip lines
      // up with the visible dot. getWorldPosition() also refreshes the
      // matrices this depends on. Depth uses the camera's Z-distance (not
      // full 3D distance) since the camera never rotates - the same metric
      // the shader's own depth-of-field math uses.
      cursorDotSprite.getWorldPosition(cursorWorldPos);
      const depth = camera.position.z - cursorWorldPos.z;
      cursorWorldPos.project(camera);
      const screenX = (cursorWorldPos.x * 0.5 + 0.5) * containerWidth;
      const screenY = (1 - (cursorWorldPos.y * 0.5 + 0.5)) * containerHeight;
      const pixelsPerWorldUnit = containerHeight / (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      const radiusPx = (CURSOR_DOT_SIZE / 2) * pixelsPerWorldUnit;

      invertedHeadingLayer.style.clipPath = `circle(${radiusPx}px at ${screenX}px ${screenY}px)`;
      invertedHeadingLayer.style.opacity = cursorActiveCurrent;
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
} else {
  console.warn('hero-particles.js: no element with id="hero-canvas" found, skipping init.');
}
