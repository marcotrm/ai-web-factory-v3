import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import gsap from 'https://esm.sh/gsap@3.12.5';
import { ScrollTrigger } from 'https://esm.sh/gsap@3.12.5/ScrollTrigger';
import { EffectComposer } from 'https://unpkg.com/three@0.157.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.157.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.157.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.157.0/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Experience.js
 * Main Three.js experience class managing all 3D rendering,
 * animations, post-processing, and scroll-driven interactions.
 */
export default class Experience {
  constructor(canvas) {
    // Store reference to the canvas element
    this.canvas = canvas;

    // Viewport dimensions object updated on resize
    this.dimensions = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Normalized mouse position in range -1..1
    this.mouse = new THREE.Vector2(0, 0);

    // Clock for delta-time and elapsed-time calculations
    this.clock = new THREE.Clock();

    // Accumulated elapsed time in seconds
    this.time = 0;

    // ── Scroll state ──────────────────────────────────────────────────
    // Normalised 0..1 progress through entire page
    this.scrollProgress = 0;
    // Which full-page section (0-based) is currently active
    this.currentSection = 0;
    // Raw scroll Y in pixels
    this.scrollY = 0;
    // Animated heights for the stats bar chart (one per bar)
    this.barHeights = [0, 0, 0, 0];
    // Amplitude driven by scroll speed for the showcase wave plane
    this.waveAmplitude = 0;
    // Scale multiplier for the contact sphere
    this.contactSphereScale = 1;

    // Mesh dictionary for quick external / internal access
    this.meshes = {};

    // ── Boot sequence ─────────────────────────────────────────────────
    this._initRenderer();
    this._initCamera();
    this._initLights();
    this._initGeometries();
    this._initShaders();
    this._initParticleSystem();
    this._initPostProcessing();
    this._initEventListeners();

    // Allow DOM / GSAP ScrollTrigger to settle before wiring scroll
    setTimeout(() => this._initScrollAnimations(), 100);

    // Start the render loop
    this._tick();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERER
  // ─────────────────────────────────────────────────────────────────────────
  _initRenderer() {
    // Create WebGLRenderer with smooth edges and transparency support
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });

    // Cap pixel-ratio at 2 to balance quality vs performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.dimensions.width, this.dimensions.height);

    // Enable soft shadow mapping
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Use SRGB output for physically correct colours
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ACES filmic tone-mapping gives a cinematic look
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Create the scene with a transparent (null) background
    this.scene = new THREE.Scene();
    this.scene.background = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CAMERA
  // ─────────────────────────────────────────────────────────────────────────
  _initCamera() {
    const { width, height } = this.dimensions;

    // Perspective camera with 60° FoV
    this.camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      200
    );

    // Default position: slightly in front of origin, looking toward it
    this.camera.position.set(0, 0, 5);
    this.scene.add(this.camera);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  _initLights() {
    // Soft ambient fill so nothing is completely black
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Warm key light coming from upper-right-front
    const warmLight = new THREE.DirectionalLight(0xff9966, 1.5);
    warmLight.position.set(5, 5, 5);
    warmLight.castShadow = true;
    // Shadow map resolution
    warmLight.shadow.mapSize.width = 1024;
    warmLight.shadow.mapSize.height = 1024;
    warmLight.shadow.camera.near = 0.5;
    warmLight.shadow.camera.far = 50;
    this.scene.add(warmLight);

    // Cool fill light from the opposite side for colour contrast
    const coolLight = new THREE.DirectionalLight(0x6699ff, 1.2);
    coolLight.position.set(-5, 3, -3);
    this.scene.add(coolLight);

    // Dynamic point light that follows the mouse cursor
    this.mouseLight = new THREE.PointLight(0xffffff, 1.0);
    this.scene.add(this.mouseLight);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GEOMETRIES  (one group per scroll section)
  // ─────────────────────────────────────────────────────────────────────────
  _initGeometries() {
    // ── Section 0 – Hero ─────────────────────────────────────────────
    this.heroGroup = new THREE.Group();
    this.heroGroup.position.y = 0;
    this.scene.add(this.heroGroup);

    const heroGeo = new THREE.TorusKnotGeometry(1.2, 0.4, 200, 32);
    const heroMat = new THREE.MeshStandardMaterial({
      color: 0x6633cc,
      metalness: 0.7,
      roughness: 0.2,
      wireframe: true
    });
    const heroMesh = new THREE.Mesh(heroGeo, heroMat);
    this.heroGroup.add(heroMesh);
    this.meshes.hero = heroMesh;

    // ── Section 1 – Features ─────────────────────────────────────────
    this.featuresGroup = new THREE.Group();
    this.featuresGroup.position.y = -10;
    this.scene.add(this.featuresGroup);

    const featureColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1];
    const featureXPositions = [-2.5, 0, 2.5];
    this.meshes.features = [];

    featureXPositions.forEach((xPos, i) => {
      const geo = new THREE.IcosahedronGeometry(0.6, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: featureColors[i],
        metalness: 0.6,
        roughness: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = xPos;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.featuresGroup.add(mesh);
      this.meshes.features.push(mesh);
    });

    // ── Section 2 – Showcase ─────────────────────────────────────────
    this.showcaseGroup = new THREE.Group();
    this.showcaseGroup.position.y = -20;
    this.scene.add(this.showcaseGroup);

    // High-subdivision plane used for GPU vertex-shader wave deformation
    const showcaseGeo = new THREE.PlaneGeometry(8, 6, 128, 128);
    const showcaseMat = new THREE.MeshStandardMaterial({
      color: 0x9966ff,
      side: THREE.DoubleSide,
      metalness: 0.5,
      roughness: 0.4
    });
    const showcaseMesh = new THREE.Mesh(showcaseGeo, showcaseMat);
    // Tilt the plane for a dramatic angled look
    showcaseMesh.rotation.x = -Math.PI / 3;
    this.showcaseGroup.add(showcaseMesh);
    this.meshes.showcase = showcaseMesh;

    // ── Section 3 – Stats ────────────────────────────────────────────
    this.statsGroup = new THREE.Group();
    this.statsGroup.position.y = -30;
    this.scene.add(this.statsGroup);

    // Bar-chart geometry: four pillars with different target heights
    const barBaseHeights = [2, 3, 2.5, 3.5];
    const barColors = [0xff6b6b, 0x4ecdc4, 0xffd93d, 0x6c5ce7];
    const barXPositions = [-2.25, -0.75, 0.75, 2.25];
    this.meshes.bars = [];

    barXPositions.forEach((xPos, i) => {
      const geo = new THREE.BoxGeometry(0.6, barBaseHeights[i], 0.6);
      const mat = new THREE.MeshStandardMaterial({
        color: barColors[i],
        metalness: 0.4,
        roughness: 0.5
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.x = xPos;
      // Store the full target height so we can animate from 0
      bar.userData.targetHeight = barBaseHeights[i];
      bar.castShadow = true;
      this.statsGroup.add(bar);
      this.meshes.bars.push(bar);
    });

    // ── Section 4 – Contact ──────────────────────────────────────────
    this.contactGroup = new THREE.Group();
    this.contactGroup.position.y = -40;
    this.scene.add(this.contactGroup);

    // Outer point-cloud sphere
    const contactSphereGeo = new THREE.SphereGeometry(1.5, 64, 64);
    const contactPointsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      sizeAttenuation: true
    });
    const contactPoints = new THREE.Points(contactSphereGeo, contactPointsMat);
    this.contactGroup.add(contactPoints);
    this.meshes.contactPoints = contactPoints;

    // Inner solid wireframe sphere for depth
    const innerSphereGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const innerSphereMat = new THREE.MeshStandardMaterial({
      color: 0x6c5ce7,
      wireframe: true
    });
    const innerSphere = new THREE.Mesh(innerSphereGeo, innerSphereMat);
    this.contactGroup.add(innerSphere);
    this.meshes.contactSphere = innerSphere;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────
  _initEventListeners() {
    // ── Resize ───────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
      // Update cached dimensions
      this.dimensions.width = window.innerWidth;
      this.dimensions.height = window.innerHeight;

      // Keep camera aspect ratio correct
      this.camera.aspect = this.dimensions.width / this.dimensions.height;
      this.camera.updateProjectionMatrix();

      // Resize renderer and composer to match new viewport
      this.renderer.setSize(this.dimensions.width, this.dimensions.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      if (this.composer) {
        this.composer.setSize(this.dimensions.width, this.dimensions.height);
      }
    });

    // ── Mouse move ───────────────────────────────────────────────────
    window.addEventListener('mousemove', (event) => {
      // Normalise to -1..1 range (x: left=-1 right=1, y: top=1 bottom=-1)
      this.mouse.x = (event.clientX / this.dimensions.width) * 2 - 1;
      this.mouse.y = -(event.clientY / this.dimensions.height) * 2 + 1;
    });

    // ── Scroll ───────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
      // Store raw pixel scroll offset for use in _tick and scroll animations
      this.scrollY = window.scrollY;

      // Compute 0..1 progress through the entire scrollable document
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      this.scrollProgress = maxScroll > 0 ? this.scrollY / maxScroll : 0;

      // Derive which section (full viewport heights) we are in
      this.currentSection = Math.floor(
        this.scrollY / this.dimensions.height
      );
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PASS 2 & 3: SHADERS, PARTICLES, POST-PROCESSING
  // ════════════════════════════════════════════════════════════════

_getTorusVertexShader() {
    return `
      uniform float uTime;
      uniform float uScrollProgress;

      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDisplacement;
      varying vec3 vColor;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      void main() {
        vPosition = position;
        vNormal = normal;

        float displacement = snoise(position * 2.0 + uTime * 0.5) * 0.3;
        vDisplacement = displacement;

        vec3 displacedPosition = position + normal * displacement;

        float t = (displacedPosition.y + 1.5) / 3.0;
        t = clamp(t, 0.0, 1.0);
        vec3 deepPurple = vec3(0.1, 0.0, 0.2);
        vec3 electricBlue = vec3(0.0, 0.83, 1.0);
        vColor = mix(deepPurple, electricBlue, t);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
      }
    `;
  }

  _getTorusFragmentShader() {
    return `
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDisplacement;
      varying vec3 vColor;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        vec3 norm = normalize(vNormal);

        float fresnel = pow(1.0 - abs(dot(norm, viewDir)), 3.0);
        fresnel = clamp(fresnel, 0.0, 1.0);

        float shimmer = sin(vDisplacement * 10.0) * 0.5 + 0.5;

        vec3 color = vColor;
        color += vec3(shimmer) * 0.15;
        color = mix(color, vec3(1.0), fresnel * 0.6);

        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  _getWaveVertexShader() {
    return `
      uniform float uTime;
      uniform float uAmplitude;
      uniform float uScrollProgress;

      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 pos = position;
        float wave = sin(pos.x * 3.0 + uTime) * cos(pos.z * 2.0 + uTime * 0.7) * uAmplitude;
        pos.y += wave;
        vHeight = wave;
        vPosition = pos;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
  }

  _getWaveFragmentShader() {
    return `
      uniform float uTime;

      varying float vHeight;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        vec3 norm = normalize(vNormal);

        float fresnel = pow(1.0 - abs(dot(norm, viewDir)), 2.5);
        fresnel = clamp(fresnel, 0.0, 1.0);

        float t = clamp((vHeight + 1.0) * 0.5, 0.0, 1.0);

        vec3 deepBlue = vec3(0.0, 0.05, 0.3);
        vec3 cyan = vec3(0.0, 0.8, 1.0);
        vec3 magenta = vec3(1.0, 0.0, 0.8);

        vec3 color = mix(deepBlue, cyan, t);
        color = mix(color, magenta, t * t);

        float iridescence = sin(dot(norm, viewDir) * 8.0 + uTime * 2.0) * 0.5 + 0.5;
        color += vec3(iridescence * 0.1, iridescence * 0.05, iridescence * 0.2);

        color = mix(color, vec3(0.8, 0.9, 1.0), fresnel * 0.5);

        gl_FragColor = vec4(color, 0.85);
      }
    `;
  }

  _getParticleVertexShader() {
    return `
      attribute float aScale;
      attribute vec3 aRandomness;
      attribute float aPhase;
      attribute vec3 aColor;

      uniform float uTime;
      uniform float uScrollProgress;
      uniform vec2 uMouse;
      uniform float uSize;

      varying vec3 vColor;
      varying float vAlpha;

      vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute4(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise3(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289v3(i);
        vec4 p = permute4(permute4(permute4(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      vec3 curlNoise(vec3 p) {
        float eps = 0.01;
        float n1, n2;
        vec3 curl;

        n1 = snoise3(p + vec3(0.0, eps, 0.0));
        n2 = snoise3(p - vec3(0.0, eps, 0.0));
        curl.x = (n1 - n2) / (2.0 * eps);

        n1 = snoise3(p + vec3(0.0, 0.0, eps));
        n2 = snoise3(p - vec3(0.0, 0.0, eps));
        curl.y = (n1 - n2) / (2.0 * eps);

        n1 = snoise3(p + vec3(eps, 0.0, 0.0));
        n2 = snoise3(p - vec3(eps, 0.0, 0.0));
        curl.z = (n1 - n2) / (2.0 * eps);

        return curl;
      }

      void main() {
        vColor = aColor;

        vec3 pos = position;
        float t = uTime * 0.3 + aPhase;

        vec3 curl = curlNoise(pos * 0.3 + vec3(t * 0.1));
        pos += curl * 0.5;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vec2 screenPos = mvPosition.xy / mvPosition.w;

        vec2 mouseDir = screenPos - uMouse;
        float mouseDist = length(mouseDir);
        float repulsion = smoothstep(0.5, 0.0, mouseDist);
        vec3 repulsionVec = vec3(normalize(mouseDir) * repulsion * 1.5, 0.0);
        mvPosition.xyz += repulsionVec;

        vAlpha = 0.6 + 0.4 * sin(uTime + aPhase);

        gl_PointSize = uSize * aScale * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
  }

  _getParticleFragmentShader() {
    return `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);

        if (dist > 0.5) discard;

        float glow = exp(-dist * dist * 8.0);
        float alpha = glow * vAlpha;

        alpha *= smoothstep(0.5, 0.3, dist);

        gl_FragColor = vec4(vColor, alpha);
      }
    `;
  }

  _initShaders() {
    if (!this.torusKnot || !this.showcasePlane) return;

    this.torusUniforms = {
      uTime: { value: 0.0 },
      uScrollProgress: { value: 0.0 }
    };

    const torusMaterial = new THREE.ShaderMaterial({
      vertexShader: this._getTorusVertexShader(),
      fragmentShader: this._getTorusFragmentShader(),
      uniforms: this.torusUniforms,
      side: THREE.DoubleSide
    });

    this.torusKnot.material = torusMaterial;

    this.waveUniforms = {
      uTime: { value: 0.0 },
      uAmplitude: { value: 0.5 },
      uScrollProgress: { value: 0.0 }
    };

    const waveMaterial = new THREE.ShaderMaterial({
      vertexShader: this._getWaveVertexShader(),
      fragmentShader: this._getWaveFragmentShader(),
      uniforms: this.waveUniforms,
      side: THREE.DoubleSide,
      transparent: true
    });

    this.showcasePlane.material = waveMaterial;
  }

  _initParticleSystem() {
    const count = 80000;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const randomness = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0.5, 0.0, 0.8),
      new THREE.Color(0.0, 0.5, 1.0),
      new THREE.Color(1.0, 0.0, 0.6),
      new THREE.Color(1.0, 1.0, 1.0)
    ];

    const arms = 3;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      const r = Math.sqrt(Math.random()) * 5.0;
      const armIndex = Math.floor(Math.random() * arms);
      const armOffset = (armIndex / arms) * Math.PI * 2.0;
      const theta = Math.random() * Math.PI * 2.0 + armOffset + r * 0.5;
      const y = (Math.random() - 0.5) * 2.0;

      positions[i3]     = Math.cos(theta) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(theta) * r;

      scales[i] = Math.random() * 1.5 + 0.5;

      randomness[i3]     = (Math.random() - 0.5) * 2.0;
      randomness[i3 + 1] = (Math.random() - 0.5) * 2.0;
      randomness[i3 + 2] = (Math.random() - 0.5) * 2.0;

      phases[i] = Math.random() * Math.PI * 2.0;

      const colorChoice = palette[Math.floor(Math.random() * palette.length)];
      colors[i3]     = colorChoice.r;
      colors[i3 + 1] = colorChoice.g;
      colors[i3 + 2] = colorChoice.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    this.particleUniforms = {
      uTime: { value: 0.0 },
      uScrollProgress: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uSize: { value: 2.0 }
    };

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: this._getParticleVertexShader(),
      fragmentShader: this._getParticleFragmentShader(),
      uniforms: this.particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: false
    });

    this.particleSystem = new THREE.Points(geometry, particleMaterial);
    this.particleSystem.position.y = -20;
    this.scene.add(this.particleSystem);
  }

  _initPostProcessing() {
    const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js').catch(() => ({ EffectComposer: null }));
    const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js').catch(() => ({ RenderPass: null }));
    const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js').catch(() => ({ UnrealBloomPass: null }));
    const { ShaderPass } = await import('three/examples/jsm/postprocessing/ShaderPass.js').catch(() => ({ ShaderPass: null }));

    if (!EffectComposer || !RenderPass || !UnrealBloomPass || !ShaderPass) {
      console.warn('Post processing modules not available');
      return;
    }

    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8,
      0.4,
      0.2
    );
    this.composer.addPass(bloomPass);

    const ChromaticAberrationShader = {
      uniforms: {
        tDiffuse: { value: null },
        uOffset: { value: 0.003 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uOffset;
        varying vec2 vUv;

        void main() {
          vec2 direction = vUv - vec2(0.5);
          float dist = length(direction);
          vec2 offset = normalize(direction) * uOffset * dist;

          float r = texture2D(tDiffuse, vUv + offset).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv - offset).b;

          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `
    };

    const chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
    this.composer.addPass(chromaticAberrationPass);
    this.chromaticAberrationPass = chromaticAberrationPass;
  }

  // ════════════════════════════════════════════════════════════════
  // PASS 2: SCROLL ANIMATIONS, RENDER LOOP, LIFECYCLE
  // ════════════════════════════════════════════════════════════════

  _initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // Hero mesh elastic scale-up on load
    if (this.heroMesh) {
      gsap.from(this.heroMesh.scale, {
        x: 0, y: 0, z: 0,
        delay: 0.3,
        duration: 1.4,
        ease: 'elastic.out(1, 0.5)'
      });
    }

    // Camera Y driven by full-page scroll
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        this.scrollProgress = self.progress;
        const prevY = this._prevScrollY || 0;
        this._scrollVelocity = self.progress - prevY;
        this._prevScrollY = self.progress;
        if (this.camera) {
          this.camera.position.y = self.progress * -40;
        }
      }
    });

    // Features: fly-in icosahedrons
    if (this.featuresMeshes && this.featuresMeshes.length >= 3) {
      const offsets = [
        { x: -5, y: 0, z: 0 },
        { x: 0,  y: 3,  z: 0 },
        { x: 5,  y: 0, z: 0 }
      ];
      this.featuresMeshes.forEach((mesh, i) => {
        const from = offsets[i];
        gsap.set(mesh.position, { x: mesh.position.x + from.x, y: mesh.position.y + from.y, z: mesh.position.z + from.z });
        ScrollTrigger.create({
          trigger: '.section-features',
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: 1,
          onEnter: () => {
            gsap.to(mesh.position, {
              x: mesh.position.x - from.x * (1 - (i * 0)),
              y: mesh.position.y - from.y,
              z: mesh.position.z - from.z,
              delay: i * 0.2,
              duration: 1.0,
              ease: 'back.out(1.7)'
            });
          }
        });
      });
    }

    // Showcase: wave amplitude in and out
    ScrollTrigger.create({
      trigger: '.section-showcase',
      start: 'top 80%',
      end: 'bottom 20%',
      scrub: 1,
      onUpdate: (self) => {
        const p = self.progress;
        if (p < 0.5) {
          this.waveAmplitude = gsap.utils.interpolate(0, 0.5, p * 2);
        } else {
          this.waveAmplitude = gsap.utils.interpolate(0.5, 0, (p - 0.5) * 2);
        }
      }
    });

    // Stats: sequential bar scale Y
    if (this.statsBars && this.statsBars.length > 0) {
      const statsTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.section-stats',
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: 1
        }
      });
      this.statsBars.forEach((bar, i) => {
        statsTl.to(this.barHeights, {
          [i]: 1,
          duration: 0.5,
          ease: 'elastic.out(1, 0.5)'
        }, i * 0.15);
      });
    }

    // Contact: sphere scale
    this.contactSphereScale = 1;
    ScrollTrigger.create({
      trigger: '.section-contact',
      start: 'top 80%',
      end: 'bottom 20%',
      scrub: 1,
      onUpdate: (self) => {
        this.contactSphereScale = 1 + self.progress * 1.5;
      }
    });

    // Parallax groups at different rates
    const parallaxRates = [1.0, 0.95, 0.9, 0.85, 0.8];
    if (this.parallaxGroups) {
      this.parallaxGroups.forEach((group, i) => {
        if (!group) return;
        ScrollTrigger.create({
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: (self) => {
            group.position.y = -self.progress * 40 * parallaxRates[i];
          }
        });
      });
    }
  }

  _updateOnScroll() {
    // Update wave plane vertices
    if (this.waveMesh && this.waveMesh.geometry) {
      const pos = this.waveMesh.geometry.attributes.position;
      const count = pos.count;
      for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = Math.sin(x * 0.5 + this.time) * Math.cos(z * 0.5 + this.time * 0.7) * this.waveAmplitude;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      if (this.waveMesh.geometry.computeVertexNormals) {
        this.waveMesh.geometry.computeVertexNormals();
      }
    }

    // Update contact sphere scale
    if (this.contactSphere) {
      const s = this.contactSphereScale || 1;
      this.contactSphere.scale.set(s, s, s);
    }

    // Update stats bars scale Y
    if (this.statsBars && this.barHeights) {
      this.statsBars.forEach((bar, i) => {
        if (bar) {
          const h = this.barHeights[i] || 0;
          bar.scale.y = Math.max(0.001, h);
        }
      });
    }
  }

  _updateParticles(time, delta) {
    if (this.particleSystem) {
      // Slowly rotate the particle system
      this.particleSystem.rotation.y += delta * 0.05;
      this.particleSystem.rotation.x += delta * 0.02;
    }

    if (this.particleShaderMaterial && this.particleShaderMaterial.uniforms) {
      const u = this.particleShaderMaterial.uniforms;
      if (u.uTime) u.uTime.value = time;
      if (u.uScrollProgress) u.uScrollProgress.value = this.scrollProgress || 0;
      if (u.uMouse) {
        u.uMouse.value.x = this.mouse ? this.mouse.x : 0;
        u.uMouse.value.y = this.mouse ? this.mouse.y : 0;
      }
    }
  }

  _updateCamera() {
    if (!this.camera || !this.mouse) return;
    // Subtle camera sway based on mouse X
    this.camera.position.x += (this.mouse.x * 0.5 - this.camera.position.x) * 0.05;
    // Subtle forward/back based on mouse Y
    this.camera.position.z += (10 + this.mouse.y * -0.5 - this.camera.position.z) * 0.05;
  }

  _updateMouseLight() {
    if (!this.mouseLight || !this.mouse) return;
    // Project mouse into 3D space at a fixed Z depth
    const targetX = this.mouse.x * 8;
    const targetY = this.mouse.y * 8;
    const targetZ = 5;
    this.mouseLight.position.x += (targetX - this.mouseLight.position.x) * 0.08;
    this.mouseLight.position.y += (targetY - this.mouseLight.position.y) * 0.08;
    this.mouseLight.position.z += (targetZ - this.mouseLight.position.z) * 0.08;
  }

  _tick() {
    this._animFrameId = requestAnimationFrame(this._tick.bind(this));

    const delta = this.clock.getDelta();
    this.time += delta;
    const t = this.time;

    // Camera sway
    this._updateCamera();

    // Mouse light
    this._updateMouseLight();

    // Rotate hero torus knot
    if (this.heroMesh) {
      this.heroMesh.rotation.x = t * 0.18;
      this.heroMesh.rotation.y = t * 0.12;
    }

    // Rotate features icosahedrons
    if (this.featuresMeshes) {
      this.featuresMeshes.forEach((mesh, i) => {
        if (mesh) {
          mesh.rotation.x += delta * (0.3 + i * 0.07);
          mesh.rotation.y += delta * (0.2 + i * 0.05);
        }
      });
    }

    // Rotate contact sphere
    if (this.contactSphere) {
      this.contactSphere.rotation.y += delta * 0.4;
      this.contactSphere.rotation.x += delta * 0.15;
    }

    // Scroll-driven updates
    this._updateOnScroll();

    // Particle updates
    this._updateParticles(t, delta);

    // Update hero shader uniforms
    if (this.heroShaderMaterial && this.heroShaderMaterial.uniforms) {
      if (this.heroShaderMaterial.uniforms.uTime) {
        this.heroShaderMaterial.uniforms.uTime.value = t;
      }
    }

    // Update wave shader uniforms
    if (this.waveShaderMaterial && this.waveShaderMaterial.uniforms) {
      if (this.waveShaderMaterial.uniforms.uTime) {
        this.waveShaderMaterial.uniforms.uTime.value = t;
      }
      if (this.waveShaderMaterial.uniforms.uAmplitude) {
        this.waveShaderMaterial.uniforms.uAmplitude.value = this.waveAmplitude;
      }
    }

    // Chromatic aberration offset based on scroll velocity
    if (this.chromaticAberrationPass && this.chromaticAberrationPass.uniforms) {
      const vel = Math.abs(this._scrollVelocity || 0);
      if (this.chromaticAberrationPass.uniforms.uOffset) {
        this.chromaticAberrationPass.uniforms.uOffset.value.set(vel * 0.01, vel * 0.01);
      }
    }

    // Render via composer
    if (this.composer) {
      this.composer.render();
    }
  }

  _onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
  }

  destroy() {
    // Cancel render loop
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this._onResize.bind(this));
    window.removeEventListener('mousemove', this._onMouseMove);

    // Kill all ScrollTriggers
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    // Dispose composer
    if (this.composer) {
      this.composer.renderTarget1 && this.composer.renderTarget1.dispose();
      this.composer.renderTarget2 && this.composer.renderTarget2.dispose();
    }

    // Dispose scene objects
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
  }
}