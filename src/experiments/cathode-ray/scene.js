import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GEO, sampleVoltages, computeBeam, screenSpot } from "./physics.js";

function makeLabelTexture(text, opts = {}) {
  const { color = "#e6edf6", accent = "#38e1ff", sub } = opts;
  const dpr = 2;
  const fontSize = 30;
  const subFontSize = 20;
  const padX = 18;
  const padY = 10;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas 2d context unavailable");
  measure.font = `600 ${fontSize}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  const mainW = measure.measureText(text).width;
  let subW = 0;
  if (sub) {
    measure.font = `500 ${subFontSize}px ui-monospace, Menlo, Consolas, monospace`;
    subW = measure.measureText(sub).width;
  }
  const w = Math.ceil(Math.max(mainW, subW) + padX * 2);
  const h = Math.ceil(fontSize + padY * 2 + (sub ? subFontSize + 4 : 0));
  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(dpr, dpr);
  const radius = 8;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, radius);
  ctx.fillStyle = "rgba(14, 22, 34, 0.78)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(56, 225, 255, 0.35)";
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(0.5, 6, 3, h - 12);
  ctx.fillStyle = color;
  ctx.font = `600 ${fontSize}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, sub ? padY + fontSize / 2 - 2 : h / 2);
  if (sub) {
    ctx.fillStyle = accent;
    ctx.font = `500 ${subFontSize}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillText(sub, padX, padY + fontSize + 4 + subFontSize / 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function makeLabelSprite(text, opts = {}) {
  const tex = makeLabelTexture(text, opts);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  const aspect = tex.image.width / tex.image.height;
  const height = opts.scale ?? 0.42;
  sprite.scale.set(height * aspect, height, 1);
  sprite.renderOrder = 50;
  return sprite;
}

const VIEWS = {
  perspective: {
    pos: new THREE.Vector3(12.6, 6.6, 11.7),
    target: new THREE.Vector3(0.6, 0, 0),
  },
  front: {
    pos: new THREE.Vector3(GEO.screenX + 3.4, 0.15, 0.01),
    target: new THREE.Vector3(GEO.screenX, 0, 0),
  },
  side: {
    pos: new THREE.Vector3(0.4, 1.4, 12.5),
    target: new THREE.Vector3(0.4, 0, 0),
  },
  top: {
    pos: new THREE.Vector3(0.4, 12.5, 0.01),
    target: new THREE.Vector3(0.4, 0, 0),
  },
};
const COLOR = {
  bg: 0x070b12,
  glass: 0x9fc6e8,
  metal: 0xb8c2d0,
  beam: 0xff5d8f,
  beamCore: 0xffd7e0,
  phosphor: 0x7dffa8,
  filament: 0xff8a3d,
  pos: 0xff4d6d,
  neg: 0x38e1ff,
};
const ELECTRON_COUNT = 26;
function makeGlowTexture(inner, outer) {
  const s = 64;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, outer);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export class ScopeScene {
  paused = false;
  disposed = false;
  container;
  renderer;
  scene = new THREE.Scene();
  camera;
  controls;
  clock = new THREE.Clock();
  simTime = 0;
  raf = 0;
  resizeObserver;
  state;
  viewTransition = null;
  yPlates = [];
  xPlates = [];
  yTerminals = [];
  xTerminals = [];
  filament;
  beamLine;
  beamGlow;
  electrons;
  electronPhases = new Float32Array(ELECTRON_COUNT);
  screenCanvas;
  screenCtx;
  screenTexture;
  clearRequested = false;
  onSample = null;
  constructor(container, state, onSample) {
    this.onSample = onSample;
    this.container = container;
    this.state = {
      ...state,
    };
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    try {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      container.appendChild(this.renderer.domElement);
      this.scene.background = new THREE.Color(COLOR.bg);
      this.scene.fog = new THREE.Fog(COLOR.bg, 18, 42);
      this.camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        100,
      );
      this.camera.position.copy(VIEWS.perspective.pos);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.copy(VIEWS.perspective.target);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 3.5;
      this.controls.maxDistance = 32;
      this.controls.addEventListener("start", () => {
        this.viewTransition = null;
      });
      this.buildLights();
      this.buildTube();
      this.buildGun();
      this.buildPlatesAndTerminals();
      this.buildScreen();
      this.buildBeam();
      this.buildLabels();
      this.buildFloor();
      for (let i = 0; i < ELECTRON_COUNT; i++) {
        this.electronPhases[i] = i / ELECTRON_COUNT;
      }
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
      this.handleResize();
      this.animate();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  updateState(patch) {
    Object.assign(this.state, patch);
  }
  setView(name) {
    const v = VIEWS[name];
    this.viewTransition = {
      fromPos: this.camera.position.clone(),
      toPos: v.pos.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: v.target.clone(),
      t: 0,
    };
  }
  clearPhosphor() {
    this.clearRequested = true;
  }
  setPaused(paused) {
    this.paused = paused;
  }
  reset(state) {
    this.state = { ...state };
    this.simTime = 0;
    this.paused = false;
    this.clock.getDelta();
    this.clearRequested = true;
    this.setView("perspective");
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.onSample = null;
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat().filter(Boolean)) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
    });
    for (const resource of [...textures, ...materials, ...geometries])
      resource.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
  buildLights() {
    this.scene.add(new THREE.AmbientLight(0x88aacc, 0.55));
    const key = new THREE.DirectionalLight(0xcfe6ff, 1.1);
    key.position.set(6, 10, 8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x335577, 0.5);
    fill.position.set(-8, -4, -6);
    this.scene.add(fill);
    const warm = new THREE.PointLight(COLOR.filament, 1.4, 6, 2);
    warm.position.set(-4.9, 0, 0);
    this.scene.add(warm);
    const screenGlow = new THREE.PointLight(COLOR.phosphor, 0.9, 8, 2);
    screenGlow.position.set(GEO.screenX - 0.5, 0, 0);
    this.scene.add(screenGlow);
  }
  glassMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: COLOR.glass,
      transparent: true,
      opacity: 0.1,
      roughness: 0.08,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
  }
  buildTube() {
    const glass = this.glassMaterial();
    const neckLen = 2.6 - -5.2;
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, neckLen, 48, 1, true),
      glass,
    );
    neck.rotation.z = -Math.PI / 2;
    neck.position.x = (-5.2 + 2.6) / 2;
    this.scene.add(neck);
    const coneLen = GEO.screenX - 2.6;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(
        GEO.screenR + 0.15,
        1.05,
        coneLen,
        48,
        1,
        true,
      ),
      glass,
    );
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = (2.6 + GEO.screenX) / 2;
    this.scene.add(cone);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6fa8c9,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const ringXs = [
      [-5.2, 1.05],
      [2.6, 1.05],
      [GEO.screenX, GEO.screenR + 0.15],
    ];
    for (const [x, r] of ringXs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.025, 10, 64),
        ringMat,
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      this.scene.add(ring);
    }
  }
  buildGun() {
    const metal = new THREE.MeshStandardMaterial({
      color: COLOR.metal,
      metalness: 0.85,
      roughness: 0.35,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x5a6675,
      metalness: 0.9,
      roughness: 0.4,
    });
    const cathode = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.7, 32),
      darkMetal,
    );
    cathode.rotation.z = -Math.PI / 2;
    cathode.position.set(-4.95, 0, 0);
    this.scene.add(cathode);
    this.filament = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 10, 24),
      new THREE.MeshBasicMaterial({
        color: COLOR.filament,
      }),
    );
    this.filament.rotation.y = Math.PI / 2;
    this.filament.position.set(-5.05, 0, 0);
    this.scene.add(this.filament);
    const discXs = [-4.62, -4.38];
    const discRs = [0.55, 0.72];
    discXs.forEach((x, i) => {
      const disc = new THREE.Mesh(
        new THREE.TorusGeometry(discRs[i], 0.07, 12, 48),
        metal,
      );
      disc.rotation.y = Math.PI / 2;
      disc.position.x = x;
      this.scene.add(disc);
      const cap = new THREE.Mesh(
        new THREE.CircleGeometry(discRs[i], 48),
        new THREE.MeshBasicMaterial({
          color: 0x3a4656,
          transparent: true,
          opacity: 0.28,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      cap.rotation.y = Math.PI / 2;
      cap.position.x = x - 0.01;
      this.scene.add(cap);
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.5, 32),
      darkMetal,
    );
    base.rotation.z = -Math.PI / 2;
    base.position.set(-5.45, 0, 0);
    this.scene.add(base);
  }
  buildPlatesAndTerminals() {
    const plateMat = () =>
      new THREE.MeshStandardMaterial({
        color: COLOR.metal,
        metalness: 0.9,
        roughness: 0.3,
        emissive: 0x000000,
        emissiveIntensity: 0.6,
      });
    const yLen = GEO.yPlate.end - GEO.yPlate.start;
    const yMid = (GEO.yPlate.start + GEO.yPlate.end) / 2;
    const xLen = GEO.xPlate.end - GEO.xPlate.start;
    const xMid = (GEO.xPlate.start + GEO.xPlate.end) / 2;
    const yGeo = new THREE.BoxGeometry(yLen, 0.07, 0.72);
    const yTop = new THREE.Mesh(yGeo, plateMat());
    yTop.position.set(yMid, 0.42, 0);
    const yBottom = new THREE.Mesh(yGeo, plateMat());
    yBottom.position.set(yMid, -0.42, 0);
    this.yPlates.push(yTop, yBottom);
    this.scene.add(yTop, yBottom);
    const xGeo = new THREE.BoxGeometry(xLen, 0.72, 0.07);
    const xFront = new THREE.Mesh(xGeo, plateMat());
    xFront.position.set(xMid, 0, 0.42);
    const xBack = new THREE.Mesh(xGeo, plateMat());
    xBack.position.set(xMid, 0, -0.42);
    this.xPlates.push(xFront, xBack);
    this.scene.add(xFront, xBack);
    const terminalGeo = new THREE.SphereGeometry(0.09, 20, 16);
    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0x8b97a7,
      metalness: 0.8,
      roughness: 0.4,
    });
    const makeTerminal = (pos, stalkFrom) => {
      const dir = new THREE.Vector3().subVectors(pos, stalkFrom);
      const len = dir.length();
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, len, 8),
        stalkMat,
      );
      stalk.position.copy(stalkFrom).addScaledVector(dir, 0.5);
      stalk.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize(),
      );
      this.scene.add(stalk);
      const ball = new THREE.Mesh(
        terminalGeo,
        new THREE.MeshStandardMaterial({
          color: 0x222a36,
          emissive: COLOR.neg,
          emissiveIntensity: 1.2,
          metalness: 0.4,
          roughness: 0.4,
        }),
      );
      ball.position.copy(pos);
      this.scene.add(ball);
      return ball;
    };
    this.yTerminals.push(
      makeTerminal(
        new THREE.Vector3(yMid, 1.62, 0),
        new THREE.Vector3(yMid, 0.46, 0),
      ),
      makeTerminal(
        new THREE.Vector3(yMid, -1.62, 0),
        new THREE.Vector3(yMid, -0.46, 0),
      ),
    );
    this.xTerminals.push(
      makeTerminal(
        new THREE.Vector3(xMid, 0.85, 1.62),
        new THREE.Vector3(xMid, 0.85, 0.46),
      ),
      makeTerminal(
        new THREE.Vector3(xMid, 0.85, -1.62),
        new THREE.Vector3(xMid, 0.85, -0.46),
      ),
    );
  }
  buildScreen() {
    const size = 512;
    this.screenCanvas = document.createElement("canvas");
    this.screenCanvas.width = size;
    this.screenCanvas.height = size;
    const ctx = this.screenCanvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.screenCtx = ctx;
    ctx.fillStyle = "#07120c";
    ctx.fillRect(0, 0, size, size);
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy = 8;
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const screen = new THREE.Mesh(
      new THREE.CircleGeometry(GEO.screenR, 64),
      screenMat,
    );
    screen.rotation.y = Math.PI / 2;
    screen.position.x = GEO.screenX;
    this.scene.add(screen);
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(GEO.screenR + 0.08, 0.07, 14, 72),
      new THREE.MeshStandardMaterial({
        color: COLOR.metal,
        metalness: 0.9,
        roughness: 0.3,
      }),
    );
    bezel.rotation.y = Math.PI / 2;
    bezel.position.x = GEO.screenX - 0.02;
    this.scene.add(bezel);
  }
  buildBeam() {
    const glowMat = new THREE.LineBasicMaterial({
      color: COLOR.beam,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreMat = new THREE.LineBasicMaterial({
      color: COLOR.beamCore,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.beamGlow = new THREE.Line(new THREE.BufferGeometry(), glowMat);
    this.beamLine = new THREE.Line(new THREE.BufferGeometry(), coreMat);
    this.beamGlow.frustumCulled = false;
    this.beamLine.frustumCulled = false;
    this.scene.add(this.beamGlow, this.beamLine);
    const positions = new Float32Array(ELECTRON_COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: makeGlowTexture("rgba(255,255,255,1)", "rgba(255,93,143,0.85)"),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.electrons = new THREE.Points(geo, mat);
    this.electrons.frustumCulled = false;
    this.scene.add(this.electrons);
  }
  buildLabels() {
    const add = (text, pos, opts = {}) => {
      const s = makeLabelSprite(text, opts);
      s.position.set(...pos);
      this.scene.add(s);
    };
    add("电子枪", [-4.9, 1.5, 0.9], {
      accent: "#ff8a3d",
    });
    add("Y 偏转电极", [-2.9, 2.15, 0], {
      accent: "#ff5d8f",
      sub: "Y / Y′",
    });
    add("X 偏转电极", [-1.55, -2.0, 0.75], {
      accent: "#38e1ff",
      sub: "X / X′",
    });
    add("荧光屏", [GEO.screenX, 3.15, 0], {
      accent: "#7dffa8",
    });
    add("Uy", [-2.9, 1.95, 0.55], {
      accent: "#ff5d8f",
      scale: 0.3,
    });
    add("Ux", [-0.75, 1.2, 1.75], {
      accent: "#38e1ff",
      scale: 0.3,
    });
  }
  buildFloor() {
    const grid = new THREE.GridHelper(36, 36, 0x1d3a52, 0x122233);
    grid.position.y = -2.7;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.scene.add(grid);
  }
  handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    // 竖屏时扩大垂直视野，维持水平方向的可见范围，不改变用户旋转的角度。
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(45) / 2) /
            Math.min(1, this.camera.aspect),
        ),
    );
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  setTerminalColor(ball, positive) {
    const mat = ball.material;
    mat.emissive.setHex(positive ? COLOR.pos : COLOR.neg);
    mat.color.setHex(positive ? 0x3a1220 : 0x0e2a33);
  }
  tintPlate(plate, colorHex, strength) {
    const mat = plate.material;
    if (strength < 0.02) {
      mat.emissive.setHex(0x000000);
      return;
    }
    mat.emissive.setHex(colorHex);
    mat.emissiveIntensity = strength;
  }
  updateBeam(points, blank) {
    const v3 = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const setLine = (line) => {
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(v3);
    };
    setLine(this.beamLine);
    setLine(this.beamGlow);
    const coreMat = this.beamLine.material;
    const glowMat = this.beamGlow.material;
    coreMat.opacity = blank ? 0.15 : 0.95;
    glowMat.opacity = blank ? 0.05 : 0.3;
    const cum = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const dz = points[i].z - points[i - 1].z;
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
      cum.push(total);
    }
    const posAttr = this.electrons.geometry.getAttribute("position");
    const speed = 0.55;
    for (let i = 0; i < ELECTRON_COUNT; i++) {
      let p = (this.electronPhases[i] + this.simTime * speed) % 1;
      const dist = p * total;
      let seg = 0;
      while (seg < cum.length - 2 && cum[seg + 1] < dist) seg++;
      const segLen = cum[seg + 1] - cum[seg] || 1;
      const f = (dist - cum[seg]) / segLen;
      const a = points[seg];
      const b = points[seg + 1];
      posAttr.setXYZ(
        i,
        a.x + (b.x - a.x) * f,
        a.y + (b.y - a.y) * f,
        a.z + (b.z - a.z) * f,
      );
    }
    posAttr.needsUpdate = true;
    this.electrons.material.opacity = blank ? 0.2 : 1;
  }
  drawGraticule(ctx, size) {
    const c = size / 2;
    const r = size * 0.43;
    ctx.save();
    ctx.strokeStyle = "rgba(125, 255, 168, 0.05)";
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => {
      ctx.beginPath();
      ctx.arc(c, c, r * k, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(125, 255, 168, 0.09)";
    ctx.beginPath();
    ctx.moveTo(c - r, c);
    ctx.lineTo(c + r, c);
    ctx.moveTo(c, c - r);
    ctx.lineTo(c, c + r);
    ctx.stroke();
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      const t = (r * i) / 4;
      ctx.beginPath();
      ctx.moveTo(c + t, c - 5);
      ctx.lineTo(c + t, c + 5);
      ctx.moveTo(c - 5, c + t);
      ctx.lineTo(c + 5, c + t);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(125, 255, 168, 0.28)";
    ctx.font = '600 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Y", c, c - r - 4);
    ctx.fillText("Y′", c, c + r + 4);
    ctx.fillText("X′", c - r - 16, c);
    ctx.fillText("X", c + r + 16, c);
    ctx.restore();
  }
  updatePhosphor(spotY, spotSx, blank, dt) {
    const ctx = this.screenCtx;
    const size = this.screenCanvas.width;
    if (this.clearRequested) {
      ctx.fillStyle = "#07120c";
      ctx.fillRect(0, 0, size, size);
      this.clearRequested = false;
    }
    const fadeAlpha = 0.32 * Math.pow(1 - this.state.persistence, 1.6) + 0.008;
    ctx.fillStyle = `rgba(7, 18, 12, ${Math.min(fadeAlpha * dt * 60, 1)})`;
    ctx.fillRect(0, 0, size, size);
    this.drawGraticule(ctx, size);
    if (!blank) {
      const c = size / 2;
      const pxPerUnit = size / (2 * GEO.screenR);
      const px = c + spotSx * pxPerUnit;
      const py = c - spotY * pxPerUnit;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 30);
      glow.addColorStop(0, "rgba(125, 255, 168, 0.55)");
      glow.addColorStop(0.35, "rgba(74, 222, 128, 0.22)");
      glow.addColorStop(1, "rgba(74, 222, 128, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.fill();
      const core = ctx.createRadialGradient(px, py, 0, px, py, 7);
      core.addColorStop(0, "rgba(255, 240, 245, 1)");
      core.addColorStop(0.5, "rgba(255, 120, 165, 0.9)");
      core.addColorStop(1, "rgba(255, 93, 143, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    this.screenTexture.needsUpdate = true;
  }
  updateCamera(dt) {
    const tr = this.viewTransition;
    if (!tr) return;
    tr.t = Math.min(tr.t + dt / 0.9, 1);
    const e = 1 - Math.pow(1 - tr.t, 3);
    this.camera.position.lerpVectors(tr.fromPos, tr.toPos, e);
    this.controls.target.lerpVectors(tr.fromTarget, tr.toTarget, e);
    if (tr.t >= 1) this.viewTransition = null;
  }
  animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const elapsed = Math.min(this.clock.getDelta(), 0.05);
    const dt = this.paused ? 0 : elapsed;
    this.simTime += dt;
    const sample = sampleVoltages(this.state, this.simTime);
    const { y: spotY, sx: spotSx } = screenSpot(sample.uy, sample.ux);
    const beam = computeBeam(sample.uy, sample.ux);
    this.updateBeam(beam, sample.blank);
    if (!this.paused || this.clearRequested)
      this.updatePhosphor(spotY, spotSx, sample.blank, dt);
    const fMat = this.filament.material;
    const pulse = 0.75 + 0.25 * Math.sin(this.simTime * 6);
    fMat.color.setRGB(1, 0.54 * pulse + 0.2, 0.24 * pulse + 0.08);
    const yStrength = Math.min(Math.abs(sample.uy) / 40, 1) * 0.5;
    this.tintPlate(
      this.yPlates[0],
      sample.uy >= 0 ? COLOR.pos : COLOR.neg,
      yStrength,
    );
    this.tintPlate(
      this.yPlates[1],
      sample.uy >= 0 ? COLOR.neg : COLOR.pos,
      yStrength,
    );
    const xStrength = Math.min(Math.abs(sample.ux) / 40, 1) * 0.5;
    this.tintPlate(
      this.xPlates[1],
      sample.ux >= 0 ? COLOR.pos : COLOR.neg,
      xStrength,
    );
    this.tintPlate(
      this.xPlates[0],
      sample.ux >= 0 ? COLOR.neg : COLOR.pos,
      xStrength,
    );
    this.setTerminalColor(this.yTerminals[0], sample.uy >= 0);
    this.setTerminalColor(this.yTerminals[1], sample.uy < 0);
    this.setTerminalColor(this.xTerminals[1], sample.ux >= 0);
    this.setTerminalColor(this.xTerminals[0], sample.ux < 0);
    this.updateCamera(elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onSample && !this.paused) {
      this.onSample({
        ...sample,
        spotY,
        spotSx,
      });
    }
  };
}
