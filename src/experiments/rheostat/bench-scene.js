import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// All terminals below are actual world-space endpoints of the visible leads.
// Divider: supply leads terminate directly at A/B; C/B feed the load branch.
const rheostatOffset = new THREE.Vector3(-2.2, 0, 3.6);
const rheostatTerminals = {
  A: [-2.45, .46, -1.22], B: [2.45, .46, -1.22],
  C: [2.65, 1.97, -2.05], D: [-2.65, 1.97, -2.05],
};
const nodes = {
  positive: [-4.85, .60, -1.0], negative: [-3.70, .60, -1.0],
  ...Object.fromEntries(Object.entries(rheostatTerminals).map(([name, point]) => [name, new THREE.Vector3(...point).add(rheostatOffset).toArray()])),
  ammeterIn: [1.30, .38, .45], ammeterOut: [2.70, .38, .45],
  loadIn: [3.45, .32, 2.74], loadOut: [5.35, .32, 2.74],
  voltmeterIn: [3.80, .38, -1.19], voltmeterOut: [5.20, .38, -1.19],
};
const v = xyz => new THREE.Vector3(...xyz);

export function createBenchScene(host, initial, onPosition) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#deded5');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.domElement.setAttribute('aria-label', '可旋转的三维实验桌：滑动变阻器、电源、电流表、电压表和负载');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 28;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.target.set(0, .55, -.1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#f6f4e7', '#737c75', 1.15));
  const sun = new THREE.DirectionalLight('#fff4db', 2.5);
  sun.position.set(-5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 25 });
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .025;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#dae8ff', .8);
  fill.position.set(7, 6, -6);
  scene.add(fill);

  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  function material(color, metalness = 0, roughness = .55) {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    materials.add(m);
    return m;
  }
  const metal = material('#aeb9ba', .86, .24);
  const brass = material('#bd9650', .75, .28);
  const winding = material('#a59078', .8, .36);
  const dark = material('#263c3b', .15, .35);
  const rubber = material('#22282b', .0, .84);
  const porcelain = material('#eae4d2', .0, .26);
  const red = material('#ad392c', .1, .4);
  const black = material('#323a3b', .05, .6);
  const green = material('#557970', .18, .34);
  const pale = material('#d4d7cb', .25, .4);
  let modelParent = scene;
  function mesh(geometry, mat, xyz, parent = modelParent) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...xyz);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(size, xyz, mat, radius = .04, parent = modelParent) {
    return mesh(new RoundedBoxGeometry(...size, 2, radius), mat, xyz, parent);
  }
  function cylinder(radius, length, xyz, mat, axis = 'y', parent = modelParent) {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, length, 32), mat, xyz, parent);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }
  function tube(points, radius, mat, parent = modelParent, segments = 64) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)), segments, radius, 8, false), mat, [0, 0, 0], parent);
  }
  function texture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    draw(ctx, width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(map);
    return { map, ctx, canvas };
  }
  function panel(map, width, height, xyz, parent = modelParent, horizontal = false) {
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide });
    materials.add(mat);
    const object = mesh(new THREE.PlaneGeometry(width, height), mat, xyz, parent);
    object.castShadow = false;
    if (horizontal) object.rotation.x = -Math.PI / 2;
    return object;
  }
  function label(text, width, xyz, { horizontal = false, color = '#253c38', background = '#e9e8dc', parent = modelParent, height = .25 } = {}) {
    const { map } = texture(768, 128, ctx => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 128);
      ctx.fillStyle = color; ctx.font = '500 58px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 384, 68);
    });
    return panel(map, width, height, xyz, parent, horizontal);
  }
  function screw(xyz, parent = modelParent, axis = 'y') {
    cylinder(.044, .025, xyz, metal, axis, parent);
    const slot = box([.055, .008, .009], [xyz[0], xyz[1] + .016, xyz[2]], dark, .001, parent);
    if (axis === 'z') { slot.position.set(xyz[0], xyz[1], xyz[2] + .017); slot.rotation.x = Math.PI / 2; }
  }
  function terminal(xyz, color, name, horizontalLabel = true) {
    const [x, y, z] = xyz;
    cylinder(.14, .045, [x, y - .12, z], rubber);
    cylinder(.065, .22, [x, y - .025, z], brass);
    cylinder(.108, .12, [x, y + .015, z], color);
    cylinder(.042, .013, [x, y + .083, z], brass);
    // Fine knurling on the insulating cap.
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      cylinder(.007, .095, [x + .108 * Math.cos(angle), y + .015, z + .108 * Math.sin(angle)], color);
    }
    if (name) label(name, .31, [x, y - .13, z + .24], { horizontal: horizontalLabel, height: .18 });
  }

  // A real tabletop with a thin green laboratory mat, edge band and visible legs.
  const wood = texture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ac8054'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const y = (i * 73.37) % h;
      ctx.strokeStyle = `rgba(${i % 3 ? '76,44,23' : '235,203,146'},${.025 + (i % 5) * .014})`;
      ctx.lineWidth = .5 + (i % 4) * .3; ctx.beginPath();
      ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + Math.sin(i) * 15, w * .7, y - 8, w, y + 4); ctx.stroke();
    }
  });
  const woodMaterial = material('#ffffff', 0, .58); woodMaterial.map = wood.map;
  box([14.5, .40, 9.2], [0, -.28, 0], woodMaterial, .15);
  box([14.25, .065, 8.95], [0, -.065, 0], material('#c6b18c'), .08);
  box([13.4, .045, 7.85], [0, -.018, -.05], material('#647e73', 0, .94), .13);
  for (const x of [-6.2, 6.2]) for (const z of [-3.5, 3.5]) box([.42, 3, .42], [x, -1.95, z], dark);
  label('直流电路实验  /  DC CIRCUITS', 3.4, [-4.4, .014, 3.42], { horizontal: true, color: '#d8e1d5', background: '#647e73', height: .2 });

  // Rheostat: ceramic former, continuous helical winding, end collars,
  // insulated feet, conductive rail, four posts and moving spring contact.
  const rheostatGroup = new THREE.Group();
  rheostatGroup.position.copy(rheostatOffset); scene.add(rheostatGroup);
  modelParent = rheostatGroup;
  box([5.9, .23, 1.65], [0, .17, -2.05], dark, .12);
  for (const x of [-2.4, 2.4]) for (const z of [-2.62, -1.48]) cylinder(.16, .12, [x, .065, z], rubber);
  for (const x of [-2.62, 2.62]) {
    box([.24, 1.47, .75], [x, 1.01, -2.05], green, .06);
    box([.50, .1, 1.05], [x, .33, -2.05], green);
    cylinder(.50, .16, [x * .875, 1.16, -2.05], porcelain, 'x');
    cylinder(.08, .39, [x, 1.16, -2.05], brass, 'x');
    for (const z of [-2.4, -1.7]) screw([x, .4, z]);
  }
  cylinder(.405, 4.65, [0, 1.16, -2.05], porcelain, 'x');
  const coil = [];
  for (let i = 0; i <= 7200; i++) {
    const phase = i / 7200 * Math.PI * 2 * 112;
    coil.push([-2.22 + i / 7200 * 4.44, 1.16 + .428 * Math.cos(phase), -2.05 + .428 * Math.sin(phase)]);
  }
  tube(coil, .014, winding, rheostatGroup, 7200);
  for (const x of [-2.24, 2.24]) cylinder(.443, .085, [x, 1.16, -2.05], brass, 'x');
  cylinder(.061, 5.45, [0, 1.97, -2.05], metal, 'x');
  for (const [name, color] of [['A', red], ['B', black], ['C', red], ['D', black]]) terminal(rheostatTerminals[name], color, name);
  tube([rheostatTerminals.A, [-2.45, .60, -1.4], [-2.24, 1.16, -1.61]], .027, brass);
  tube([rheostatTerminals.B, [2.45, .60, -1.4], [2.24, 1.16, -1.61]], .027, brass);
  const slider = new THREE.Group(); rheostatGroup.add(slider);
  box([.33, .22, .30], [0, 1.97, -2.05], brass, .035, slider);
  box([.43, .14, .43], [0, 2.15, -2.05], rubber, .06, slider);
  for (let i = -2; i <= 2; i++) box([.32, .017, .015], [0, 2.222, -2.05 + i * .065], dark, .003, slider);
  box([.14, .32, .044], [0, 1.77, -2.05], brass, .008, slider);
  box([.19, .035, .17], [0, 1.60, -2.05], metal, .012, slider);
  label('P', .19, [0, 2.235, -2.05], { horizontal: true, parent: slider, height: .16, color: '#eee7d1', background: '#22282b' });
  const rheostatPlate = texture(768, 100, () => {});
  panel(rheostatPlate.map, 2.2, .25, [0, .297, -1.51], rheostatGroup, true);
  modelParent = scene;

  // Bench supply: folded metal enclosure, ventilation, rubber feet, switch,
  // two concentric knobs and a live digital display.
  const sx = -4.65, sz = -2.40;
  for (const x of [-.87, .87]) for (const z of [-.6, .6]) cylinder(.14, .16, [sx + x, .10, sz + z], rubber);
  box([2.65, 1.75, 2.0], [sx, 1.03, sz], pale, .14);
  box([2.48, 1.57, .08], [sx, 1.03, sz + 1.015], dark, .08);
  for (let i = 0; i < 11; i++) {
    box([.035, .44, .07], [sx + 1.328, 1.3, sz - .65 + i * .105], rubber, .009);
    box([1.20, .015, .035], [sx, 1.912, sz - .7 + i * .09], rubber, .008);
  }
  label('直流稳压电源', 1.50, [sx - .29, 1.64, sz + 1.061], { height: .18, color: '#d9e6da', background: '#263c3b' });
  const display = texture(512, 256, () => {});
  panel(display.map, 1.45, .72, [sx - .31, 1.12, sz + 1.063]);
  for (const y of [.89, 1.44]) {
    cylinder(.20, .12, [sx + .83, y, sz + 1.10], metal, 'z');
    cylinder(.16, .12, [sx + .83, y, sz + 1.18], rubber, 'z');
    box([.019, .075, .014], [sx + .83, y + .085, sz + 1.245], pale, .003);
  }
  box([.20, .30, .075], [sx - .90, .44, sz + 1.10], rubber, .02);
  box([.055, .025, .012], [sx - .90, .51, sz + 1.145], material('#b4db93'), .003);
  box([1.66, .18, .50], [-4.28, .38, -1.12], dark, .04);
  terminal(nodes.positive, red, '+'); terminal(nodes.negative, black, '−');
  for (const x of [-1.12, 1.12]) for (const y of [.39, 1.68]) screw([sx + x, y, sz + 1.061], scene, 'z');

  function meter(cx, cz, unit, title) {
    const root = new THREE.Group(); root.position.set(cx, .20, cz); scene.add(root);
    const housing = material('#121a20', .12, .28);
    const rim = material('#bccaca', .65, .22);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#e3f1f1', transparent: true, opacity: .12, roughness: .12, metalness: .05, depthWrite: false });
    materials.add(glass);
    // The sloping face sits on a solid wedge, not a freestanding upright panel.
    box([2.28, .30, 1.72], [0, .025, .04], housing, .045, root);
    const tilt = THREE.MathUtils.degToRad(35);
    const faceY = 1.18, faceZ = -.10, halfHeight = .95;
    const bottomY = faceY - halfHeight * Math.cos(tilt);
    const bottomZ = faceZ + halfHeight * Math.sin(tilt);
    const topY = faceY + halfHeight * Math.cos(tilt);
    const topZ = faceZ - halfHeight * Math.sin(tilt);
    // Extrude the side profile across the meter width (profile x becomes −z).
    const side = new THREE.Shape();
    side.moveTo(-.53, .18);
    side.lineTo(.78, .18);
    side.lineTo(.78, topY - .04);
    side.quadraticCurveTo(.78, topY, -topZ, topY);
    side.lineTo(-bottomZ, bottomY);
    side.quadraticCurveTo(-.47, .25, -.53, .18);
    side.closePath();
    const shellGeometry = new THREE.ExtrudeGeometry(side, { depth: 2.06, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 3, steps: 1 });
    shellGeometry.rotateY(Math.PI / 2);
    // Recess the shell below the face so the bevel cannot cover the dial.
    mesh(shellGeometry, housing, [-1.03, -.05, -.08], root);
    const face = new THREE.Group();
    face.position.set(0, faceY, faceZ); face.rotation.x = -tilt; root.add(face);
    box([2.07, 1.83, .08], [0, 0, -.035], porcelain, .025, face);
    const maximum = unit === 'A' ? 3 : 15;
    const dial = texture(960, 800, ctx => {
      ctx.fillStyle = '#f4f5ed'; ctx.fillRect(0, 0, 960, 800);
      ctx.strokeStyle = '#263437'; ctx.fillStyle = '#263437';
      const x = 480, y = 645, r = 510;
      for (let i = 0; i <= 60; i++) {
        const angle = Math.PI * (1.18 + .64 * i / 60), major = i % 20 === 0;
        ctx.lineWidth = major ? 3 : 1.6; ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
        ctx.lineTo(x + Math.cos(angle) * (r - (major ? 36 : i % 5 === 0 ? 26 : 17)), y + Math.sin(angle) * (r - (major ? 36 : i % 5 === 0 ? 26 : 17))); ctx.stroke();
        if (major) {
          ctx.textAlign = 'center'; ctx.font = '36px sans-serif';
          ctx.fillText(String(maximum * i / 60), x + Math.cos(angle) * (r + 38), y + Math.sin(angle) * (r + 38) + 12);
          ctx.font = '29px sans-serif';
          ctx.fillText(Number((maximum / 5 * i / 60).toFixed(1)).toString(), x + Math.cos(angle) * (r - 78), y + Math.sin(angle) * (r - 78) + 10);
        }
      }
      ctx.textAlign = 'center'; ctx.font = 'bold 96px Georgia'; ctx.fillText(unit, 480, 395);
      ctx.fillRect(450, 412, 60, 4);
      ctx.font = '27px sans-serif'; ctx.fillText(title + '  ⎓', 480, 480);
      ctx.font = '23px sans-serif'; ctx.fillText('双量程刻度', 480, 545);
      ctx.fillStyle = '#bac4c1'; ctx.fillRect(0, 620, 960, 180);
      // Molded prismatic band in the lower half of the transparent cover.
      for (let x = 5; x < 960; x += 12) for (let y = 624; y < 800; y += 12) {
        ctx.fillStyle = '#edf3ef'; ctx.fillRect(x, y, 5, 5);
        ctx.fillStyle = '#899996'; ctx.fillRect(x + 5, y + 5, 4, 4);
      }
    });
    panel(dial.map, 1.98, 1.65, [0, 0, .012], face);
    const pivot = new THREE.Group(); pivot.position.set(0, -.505, .041); face.add(pivot);
    box([.009, 1.06, .009], [0, .50, 0], black, .002, pivot);
    cylinder(.045, .024, [0, 0, .014], brass, 'z', pivot);
    const cover = box([2.16, 1.90, .11], [0, 0, .072], glass, .045, face); cover.castShadow = false;
    for (const x of [-1.06, 1.06]) box([.024, 1.84, .038], [x, 0, .131], rim, .006, face);
    for (const y of [-.92, .92]) box([2.12, .024, .038], [0, y, .131], rim, .006, face);
    for (const x of [-.88, .88]) screw([x, -.61, .14], face, 'z');
    cylinder(.072, .035, [0, -.78, .151], rubber, 'z', face);
    box([2.06, .022, .55], [0, .195, .67], material('#1d234c', .05, .3), .012, root);
    const reading = texture(512, 100, () => {});
    panel(reading.map, 1.50, .19, [0, -.03, .908], root);
    // Mirror the post order to preserve the established left-to-right bench wiring:
    // high range (red), low range (red, unused), common (black).
    const z = cz + .85;
    terminal([cx - .7, .38, z], red, maximum + unit);
    terminal([cx, .38, z], red, maximum / 5 + unit);
    terminal([cx + .7, .38, z], black, '−');
    return { pivot, reading, maximum };
  }
  const ammeter = meter(2.0, -.40, 'A', '电流表');
  const voltmeter = meter(4.50, -2.04, 'V', '电压表');

  // Load: ceramic wirewound resistor on a small insulated board with metal clips.
  box([2.50, .19, 1.48], [4.4, .15, 1.94], dark, .08);
  for (const x of [3.7, 5.1]) {
    box([.22, .37, .65], [x, .43, 1.92], metal);
    screw([x, .27, 1.43]);
  }
  cylinder(.245, 1.55, [4.4, .65, 1.92], porcelain, 'x');
  for (let i = 0; i < 18; i++) {
    const ring = mesh(new THREE.TorusGeometry(.247, .009, 6, 32), winding, [3.72 + i * .08, .65, 1.92]);
    ring.rotation.y = Math.PI / 2;
  }
  for (const x of [3.58, 5.22]) cylinder(.26, .14, [x, .65, 1.92], brass, 'x');
  terminal(nodes.loadIn, red, '+'); terminal(nodes.loadOut, black, '−');
  tube([nodes.loadIn, [3.45, .38, 2.16], [3.58, .65, 1.92]], .025, metal);
  tube([nodes.loadOut, [5.35, .38, 2.16], [5.22, .65, 1.92]], .025, metal);
  const loadPlate = texture(512, 96, () => {});
  panel(loadPlate.map, 1.65, .22, [4.4, .254, 2.48], scene, true);

  const leads = new THREE.Group(); scene.add(leads);
  let state = {};
  let frame = 0, disposed = false, visible = true;
  function render() { if (!disposed && visible) renderer.render(scene, camera); }
  function requestRender() {
    if (!frame && !disposed && visible) frame = requestAnimationFrame(() => { frame = 0; render(); });
  }
  controls.addEventListener('change', requestRender);
  function clearLeads() {
    for (const child of [...leads.children]) {
      child.geometry.dispose(); geometries.delete(child.geometry); leads.remove(child);
    }
  }
  function lead(from, to, bends, mat) {
    const a = nodes[from], b = nodes[to];
    tube([a, [a[0], a[1] + .13, a[2] + .16], ...bends, [b[0], b[1] + .13, b[2] + .16], b], .037, mat, leads);
    for (const p of [a, b]) cylinder(.062, .18, [p[0], p[1] + .18, p[2]], mat, 'y', leads);
  }
  function connect(mode) {
    clearLeads();
    lead('positive', 'A', [[-5.55, .12, -.55], [-5.75, .12, 1.20], [-5.35, .12, 2.72]], red);
    // Two distinct sets of leads: supply → A/B, and C/B → instruments/load.
    lead('C', 'ammeterIn', [[.75, 1.15, 1.45], [1.05, .12, 1.10]], red);
    lead('ammeterOut', 'loadIn', [[2.45, .12, 1.05], [2.55, .12, 2.90], [3.0, .12, 3.05]], red);
    lead('loadIn', 'voltmeterIn', [[3.03, .12, 2.55], [3.03, .12, .90], [3.22, .12, -.60]], red);
    lead('loadOut', 'voltmeterOut', [[5.80, .12, 3.0], [6.02, .12, 2.4], [6.02, .12, .6], [5.8, .12, -.6]], black);
    if (mode === 'divider') {
      // B itself is the junction, matching the physical terminal in the diagram.
      lead('negative', 'B', [[-3.0, .12, -.60], [-.35, .12, -.55], [.78, .12, .35], [.78, .12, 2.65]], black);
      lead('B', 'loadOut', [[.75, .12, 3.15], [2.40, .12, 3.60], [5.65, .12, 3.60], [5.75, .12, 3.15]], black);
    } else {
      // In series mode B is unused; the branch returns directly to supply −.
      lead('negative', 'loadOut', [[-3.0, .12, -.60], [-2.8, .12, -3.5], [6.40, .12, -3.5], [6.42, .12, 3.45], [5.75, .12, 3.45]], black);
    }
  }
  function drawReading(target, text, sub = '') {
    const { ctx, canvas, map } = target;
    ctx.fillStyle = '#172d2b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#bce7c9'; ctx.font = `${sub ? 72 : 52}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, sub ? 105 : 68);
    if (sub) { ctx.fillStyle = '#86b3a4'; ctx.font = '40px monospace'; ctx.fillText(sub, canvas.width / 2, 190); }
    map.needsUpdate = true;
  }
  function update(next) {
    if (next.mode !== state.mode) connect(next.mode);
    slider.position.x = 2.22 - 4.44 * next.position;
    drawReading(display, `${next.voltage.toFixed(2)} V`, `${next.sourceCurrent.toFixed(3)} A`);
    for (const [item, value, unit] of [[ammeter, next.loadCurrent, 'A'], [voltmeter, next.loadVoltage, 'V']]) {
      const maximum = unit === 'A' ? next.voltage / next.load : next.voltage;
      const multiplier = maximum > item.maximum ? 10 ** Math.ceil(Math.log10(maximum / item.maximum)) : 1;
      item.pivot.rotation.z = (1 - 2 * value / (item.maximum * multiplier)) * Math.PI * .32;
      drawReading(item.reading, '量程 ×' + multiplier);

    }
    const { ctx, map } = loadPlate;
    ctx.fillStyle = '#e9e8dc'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#263c3b'; ctx.textAlign = 'center'; ctx.font = '44px sans-serif'; ctx.fillText(`负载  ${next.load} Ω`, 256, 64); map.needsUpdate = true;
    if (next.rheostat !== state.rheostat) {
      const plate = rheostatPlate;
      plate.ctx.fillStyle = '#e9e8dc'; plate.ctx.fillRect(0, 0, 768, 100);
      plate.ctx.fillStyle = '#253c38'; plate.ctx.font = '44px sans-serif'; plate.ctx.textAlign = 'center';
      plate.ctx.fillText('滑动变阻器  ' + next.rheostat + ' Ω', 384, 66); plate.map.needsUpdate = true;
    }
    state = { ...next };
    requestRender();
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.15);
  const hit = new THREE.Vector3();
  let dragging = false;
  function pointerRay(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function pointerDown(event) {
    if (event.button !== 0) return;
    pointerRay(event);
    if (!raycaster.intersectObject(slider, true).length) return;
    dragging = true; controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    event.stopImmediatePropagation();
    renderer.domElement.style.cursor = 'grabbing';
  }
  function pointerMove(event) {
    pointerRay(event);
    if (dragging) {
      if (raycaster.ray.intersectPlane(dragPlane, hit)) onPosition?.(THREE.MathUtils.clamp((2.22 - (hit.x - rheostatOffset.x)) / 4.44, 0, 1));
      event.stopImmediatePropagation();
    } else renderer.domElement.style.cursor = raycaster.intersectObject(slider, true).length ? 'grab' : 'default';
  }
  function pointerUp(event) {
    if (!dragging) return;
    dragging = false; controls.enabled = true;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'default';
    event.stopImmediatePropagation();
  }
  const pointerEvents = [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerUp], ['lostpointercapture', pointerUp]];
  pointerEvents.forEach(([name, handler]) => renderer.domElement.addEventListener(name, handler, true));
  let width = 0, height = 0;
  function resetView(view = 'desk') {
    const top = view === 'top';
    const distance = Math.max(17, 22 / camera.aspect);
    if (view === 'detail') {
      controls.target.set(rheostatOffset.x, 1.25, -2.05 + rheostatOffset.z);
      camera.position.set(rheostatOffset.x + 1.8, 5.7, rheostatOffset.z + (width < 550 ? 10.5 : 6.5));
    } else {
      camera.position.set(top ? 0 : 2.5, top ? distance : distance * .65, top ? .01 : distance * .75);
      controls.target.set(0, -.65, -.1);
    }
    controls.update(); requestRender();
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const first = !width;
    width = rect.width; height = rect.height;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    if (first) resetView();
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; if (visible) requestRender();
  });
  intersectionObserver.observe(host);
  function visibilityChange() { if (!document.hidden) requestRender(); }
  document.addEventListener('visibilitychange', visibilityChange);
  update(initial); resize();
  return {
    update,
    resetView,
    dispose() {
      disposed = true; cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      pointerEvents.forEach(([name, handler]) => renderer.domElement.removeEventListener(name, handler, true));
      controls.removeEventListener('change', requestRender); controls.dispose();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      sun.shadow.dispose(); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
