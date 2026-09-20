import { ComputeClient, layerKeys } from "./compute-client.js";
import {
  PAL,
  LOOP_WIRE_RADIUS,
  evalWire,
  buildBentWirePath,
  SCENES,
  EARTH_R,
  buildField,
  computeSectionBasis,
} from "./physics.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export function createMagneticScene(container, initial, onStatus, onSample) {
  const _b = new THREE.Vector3(),
    _b1 = new THREE.Vector3(),
    _b2 = new THREE.Vector3(),
    _bt = new THREE.Vector3();

  /* ==================== 箭头（稀疏、精巧） ==================== */
  function collectArrowSpecs(lines, options = {}) {
    const specs = [];
    for (const pts of lines) {
      const n = pts.length;
      if (n < 8) continue;
      const defaults = n > 130 ? [0.24, 0.62] : [0.36];
      const fracs = (options.fractions || defaults).slice(
        0,
        options.maxPerLine || 2,
      );
      for (const f of fracs) {
        const i = Math.floor(n * f);
        const i0 = Math.max(0, i - 1),
          i1 = Math.min(n - 1, i + 1);
        const tan = new THREE.Vector3().subVectors(pts[i1], pts[i0]);
        if (tan.lengthSq() < 1e-10) continue;
        const scale = options.scaleAt ? options.scaleAt(pts[i]) : 1;
        specs.push({ pos: pts[i], dir: tan.normalize(), scale });
      }
    }
    return specs;
  }

  function makeArrowMesh(specs, color, scale = 1) {
    if (!specs.length) return null;
    const geom = new THREE.ConeGeometry(0.06 * scale, 0.18 * scale, 10);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.InstancedMesh(geom, mat, specs.length);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    specs.forEach((s, i) => {
      dummy.position.copy(s.pos);
      dummy.quaternion.setFromUnitVectors(up, s.dir);
      dummy.scale.setScalar(s.scale || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  function fieldArrowOptions(sceneId, params) {
    if (sceneId !== "loop") return {};
    const radius = params.radius;
    return {
      maxPerLine: 1,
      fractions: [0.34],
      scaleAt: (point) => {
        const distance = Math.hypot(
          Math.hypot(point.x, point.z) - radius,
          point.y,
        );
        return (
          0.52 + 0.48 * Math.min(1, distance / Math.max(0.45, radius * 0.42))
        );
      },
    };
  }

  function makeWideLine(points, color = PAL.line, width = 2.3, dashed = false) {
    const positions = [];
    for (const point of points) positions.push(point.x, point.y, point.z);
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const material = new LineMaterial({
      color,
      linewidth: width,
      dashed,
      dashSize: dashed ? 0.16 : 1,
      gapSize: dashed ? 0.11 : 0,
      depthTest: true,
      transparent: true,
      opacity: dashed ? 0.88 : 0.96,
    });
    material.resolution.set(
      container?.clientWidth || 1,
      container?.clientHeight || 1,
    );
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.userData.wideLine = true;
    return line;
  }

  function updateWideLineResolutions() {
    if (!container) return;
    scene?.traverse((object) => {
      if (object.userData?.wideLine && object.material?.resolution) {
        object.material.resolution.set(
          container.clientWidth,
          container.clientHeight,
        );
      }
    });
  }

  /* ==================== 热力图 ==================== */
  function fieldDisplayUnit(valueMicrotesla) {
    const a = Math.abs(valueMicrotesla);
    if (a >= 1e6) return { scale: 1e-6, unit: "T", digits: 3 };
    if (a >= 1000) return { scale: 1e-3, unit: "mT", digits: 2 };
    return { scale: 1, unit: "μT", digits: a >= 100 ? 1 : 2 };
  }

  function formatFieldValue(valueMicrotesla) {
    if (!Number.isFinite(valueMicrotesla)) return "--";
    const d = fieldDisplayUnit(valueMicrotesla);
    return `${(valueMicrotesla * d.scale).toFixed(d.digits)} ${d.unit}`;
  }

  function makeHeatMap(data, sec, size) {
    const canvas = document.createElement("canvas");
    canvas.width = data.resolution;
    canvas.height = data.resolution;
    canvas
      .getContext("2d")
      .putImageData(
        new ImageData(data.pixels, data.resolution, data.resolution),
        0,
        0,
      );
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.54,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.makeBasis(sec.U, sec.V, sec.n).setPosition(sec.center);
    mesh.renderOrder = 1;
    return mesh;
  }

  /* ==================== 场源三维模型 ==================== */
  function makeLabel(parent, text, pos, color, scale = 0.5) {
    const c = document.createElement("canvas");
    const ctx2 = c.getContext("2d");
    const font = 'bold 46px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx2.font = font;
    const w = Math.ceil(ctx2.measureText(text).width) + 26;
    c.width = w;
    c.height = 66;
    const cx = c.getContext("2d");
    cx.font = font;
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.lineWidth = 6;
    cx.strokeStyle = "rgba(255,255,255,0.9)";
    cx.strokeText(text, w / 2, 34);
    cx.fillStyle = "#" + color.toString(16).padStart(6, "0");
    cx.fillText(text, w / 2, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      }),
    );
    sp.position.copy(pos);
    sp.scale.set((w / 66) * scale, scale, 1);
    sp.renderOrder = 10;
    parent.add(sp);
    return sp;
  }

  function addWorldAxisTriad(parent) {
    const origin = new THREE.Vector3(-5.4, -4.52, -4.8);
    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xb9424a, label: "X" },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x2f8f4e, label: "Y" },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x2367a3, label: "Z" },
    ];
    for (const axis of axes) {
      const arrow = new THREE.ArrowHelper(
        axis.dir,
        origin,
        1.0,
        axis.color,
        0.22,
        0.12,
      );
      parent.add(arrow);
      makeLabel(
        parent,
        axis.label,
        origin.clone().addScaledVector(axis.dir, 1.28),
        axis.color,
        0.3,
      );
    }
  }

  function addCurrentCone(group, pos, dir, r = 0.18, h = 0.46, shaft = 0.85) {
    const d = dir.clone().normalize();
    const mat = new THREE.MeshBasicMaterial({ color: PAL.currentArrow });
    // 加粗杆身：从 pos 沿 dir 伸出 shaft 长
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, shaft, 10),
      mat,
    );
    rod.position.copy(pos).addScaledVector(d, shaft / 2);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    group.add(rod);
    // 大锥尖：基座在 pos+shaft，尖端沿 dir 延伸 h —— 尖端清晰可见
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat);
    cone.position.copy(pos).addScaledVector(d, shaft + h / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    group.add(cone);
  }

  function magnetMat(color) {
    return new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.58,
      shininess: 30,
      depthWrite: false,
    });
  }

  function addCylinderSegment(group, a, b, material, radius = 0.06) {
    const direction = b.clone().sub(a);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 12),
      material,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    group.add(mesh);
    return mesh;
  }

  function createSources(sceneId, P) {
    const g = new THREE.Group();
    const iron = new THREE.MeshPhongMaterial({
      color: 0xaeb8c0,
      transparent: true,
      opacity: 0.6,
      shininess: 40,
      depthWrite: false,
    });
    switch (sceneId) {
      case "earth": {
        const Re = EARTH_R,
          t = (P.tilt * Math.PI) / 180;
        const earth = new THREE.Mesh(
          new THREE.SphereGeometry(Re, 48, 32),
          new THREE.MeshPhongMaterial({
            color: PAL.earth,
            transparent: true,
            opacity: 0.42,
            shininess: 18,
            depthWrite: false,
          }),
        );
        earth.renderOrder = 2;
        g.add(earth);
        const mHat = new THREE.Vector3(Math.sin(t), -Math.cos(t), 0);
        // 地理轴（灰）与磁轴（酒红）
        const geo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, Re * 2 + 2.4, 8),
          new THREE.MeshBasicMaterial({ color: PAL.geoAxis }),
        );
        g.add(geo);
        const mag = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, Re * 2 + 1.6, 8),
          new THREE.MeshBasicMaterial({ color: PAL.magAxis }),
        );
        mag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mHat);
        g.add(mag);
        // 极点标记
        const mN = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 16, 12),
          new THREE.MeshBasicMaterial({ color: PAL.N }),
        );
        mN.position.copy(mHat).multiplyScalar(Re);
        g.add(mN);
        const mS = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 16, 12),
          new THREE.MeshBasicMaterial({ color: PAL.S }),
        );
        mS.position.copy(mHat).multiplyScalar(-Re);
        g.add(mS);
        // 清晰的中文标注
        makeLabel(
          g,
          "地理北极",
          new THREE.Vector3(-2.0, Re + 0.88, 0),
          0x66727c,
          0.52,
        );
        makeLabel(
          g,
          "地理南极",
          new THREE.Vector3(-2.0, -Re - 0.88, 0),
          0x66727c,
          0.52,
        );
        makeLabel(
          g,
          "地磁N极",
          mHat
            .clone()
            .multiplyScalar(Re + 0.98)
            .add(new THREE.Vector3(2.05, -0.18, 0)),
          PAL.N,
          0.54,
        );
        makeLabel(
          g,
          "地磁S极",
          mHat
            .clone()
            .multiplyScalar(-Re - 0.98)
            .add(new THREE.Vector3(2.05, 0.18, 0)),
          PAL.S,
          0.54,
        );
        break;
      }
      case "bar-magnet": {
        const L = P.length,
          hw = 0.38;
        const Nh = new THREE.Mesh(
          new THREE.BoxGeometry(hw * 2, L / 2, hw * 2),
          magnetMat(PAL.N),
        );
        Nh.position.y = L / 4;
        Nh.renderOrder = 2;
        g.add(Nh);
        const Sh = new THREE.Mesh(
          new THREE.BoxGeometry(hw * 2, L / 2, hw * 2),
          magnetMat(PAL.S),
        );
        Sh.position.y = -L / 4;
        Sh.renderOrder = 2;
        g.add(Sh);
        makeLabel(g, "N", new THREE.Vector3(0.75, L / 2 + 0.3, 0), PAL.N, 0.55);
        makeLabel(
          g,
          "S",
          new THREE.Vector3(0.75, -L / 2 - 0.3, 0),
          PAL.S,
          0.55,
        );
        break;
      }
      case "bent-wire": {
        const points = buildBentWirePath(P.width, P.height);
        const visibleMat = new THREE.MeshPhongMaterial({
          color: PAL.wire,
          shininess: 62,
        });
        const returnMat = new THREE.MeshPhongMaterial({
          color: 0x7c8992,
          transparent: true,
          opacity: 0.34,
          shininess: 20,
          depthWrite: false,
        });
        for (let i = 0; i < 3; i++)
          addCylinderSegment(g, points[i], points[i + 1], visibleMat, 0.065);
        for (let i = 3; i < points.length - 1; i++)
          addCylinderSegment(g, points[i], points[i + 1], returnMat, 0.042);
        const sign = P.direction === "左侧向下" ? -1 : 1;
        for (const index of [0, 1, 2]) {
          const a = points[index],
            b = points[index + 1];
          const dir = b.clone().sub(a).normalize().multiplyScalar(sign);
          const mid = a.clone().lerp(b, 0.5).addScaledVector(dir, -0.42);
          addCurrentCone(g, mid, dir, 0.13, 0.32, 0.55);
        }
        const returnDir = points[5]
          .clone()
          .sub(points[4])
          .normalize()
          .multiplyScalar(sign);
        addCurrentCone(
          g,
          points[4]
            .clone()
            .lerp(points[5], 0.5)
            .addScaledVector(returnDir, -0.35),
          returnDir,
          0.1,
          0.25,
          0.42,
        );
        makeLabel(
          g,
          "I",
          new THREE.Vector3(-P.width / 2 - 0.42, 0.6, 0),
          PAL.current,
          0.48,
        );
        makeLabel(
          g,
          "远置回流线",
          new THREE.Vector3(0, -P.height / 2 - 0.48, points[4].z),
          0x66727c,
          0.38,
        );
        break;
      }
      case "straight-wire": {
        const currentSign = P.direction.includes("向下") ? -1 : 1;
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 10, 14),
          new THREE.MeshPhongMaterial({ color: PAL.wire, shininess: 60 }),
        );
        g.add(wire);
        for (const yy of [-2.6, 0, 2.6])
          addCurrentCone(
            g,
            new THREE.Vector3(0, yy, 0),
            new THREE.Vector3(0, currentSign, 0),
          );
        makeLabel(g, "I", new THREE.Vector3(0.42, 4.4, 0), PAL.current, 0.5);
        break;
      }
      case "two-wires": {
        const d = P.spacing;
        const showLeft = P.display !== "仅右导线";
        const showRight = P.display !== "仅左导线";
        const dir2 = P.direction === "反向" ? -1 : 1;
        for (let i = 0; i < 2; i++) {
          if (i === 0 && !showLeft) continue;
          if (i === 1 && !showRight) continue;
          const px = ((i === 0 ? -1 : 1) * d) / 2;
          const wire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 8, 14),
            new THREE.MeshPhongMaterial({ color: PAL.wire, shininess: 60 }),
          );
          wire.position.x = px;
          g.add(wire);
          const s = i === 0 ? 1 : dir2;
          const markerLevels = config.vectors ? [0] : [-2.4, 0, 2.4];
          for (const yy of markerLevels) {
            addCurrentCone(
              g,
              new THREE.Vector3(px, yy, 0),
              new THREE.Vector3(0, s, 0),
            );
          }
          makeLabel(
            g,
            i === 0 ? "I₁" : "I₂",
            new THREE.Vector3(px + 0.42, 3.8, 0),
            PAL.current,
            0.5,
          );
        }
        if (showLeft && showRight) {
          const origin = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0x2c3840 }),
          );
          g.add(origin);
          makeLabel(g, "O", new THREE.Vector3(0.28, 0.3, 0), 0x2c3840, 0.34);
        }
        break;
      }
      case "loop": {
        const R = P.radius;
        const currentSign = P.direction === "反向" ? -1 : 1;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(R, LOOP_WIRE_RADIUS, 14, 72),
          new THREE.MeshPhongMaterial({ color: PAL.wire, shininess: 50 }),
        );
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        // 电流方向箭头直接画在导线上（切向），按半径自适应缩放避免重叠
        const sLoop = Math.min(0.65, R / 3);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 8;
          const pos = new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a));
          const tan = new THREE.Vector3(
            -Math.sin(a) * currentSign,
            0,
            Math.cos(a) * currentSign,
          );
          addCurrentCone(g, pos, tan, 0.13 * sLoop, 0.32 * sLoop, 0.55 * sLoop);
        }
        makeLabel(
          g,
          "I",
          new THREE.Vector3(R * 0.72, 0, R * 0.72).add(
            new THREE.Vector3(0.3, 0.3, 0),
          ),
          PAL.current,
          0.5,
        );
        makeLabel(
          g,
          "N",
          new THREE.Vector3(0.48, -currentSign * R * 0.92, 0),
          PAL.N,
          0.5,
        );
        makeLabel(
          g,
          "S",
          new THREE.Vector3(0.48, currentSign * R * 0.92, 0),
          PAL.S,
          0.5,
        );
        break;
      }
      case "solenoid": {
        const R = P.radius,
          L = P.length,
          N = P.nLoops;
        const currentSign = P.direction.startsWith("反向") ? -1 : 1;
        // 按实际匝密度抽样绘制，保证投影可读且不让圆管互相穿透成色块。
        const drawnTurns = Math.min(N, Math.max(24, Math.floor(L / 0.14)));
        const pitch = L / drawnTurns;
        const wireRadius = Math.max(0.007, Math.min(0.022, pitch * 0.26));
        const pts = [];
        const SEG = Math.min(Math.max(Math.round(drawnTurns * 12), 480), 2400);
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG;
          const th = -currentSign * t * drawnTurns * Math.PI * 2;
          pts.push(
            new THREE.Vector3(
              R * Math.cos(th),
              -L / 2 + t * L,
              R * Math.sin(th),
            ),
          );
        }
        const helix = new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pts),
            SEG,
            wireRadius,
            8,
            false,
          ),
          new THREE.MeshPhongMaterial({
            color: PAL.wire,
            shininess: 45,
            transparent: true,
            opacity: 0.52,
            depthWrite: false,
          }),
        );
        helix.renderOrder = 2;
        g.add(helix);
        // 电流方向箭头（沿螺旋切向），按尺寸自适应缩放
        const sSol = Math.min(1, R / 1.5, L / 4);
        for (const tt of [0.18, 0.5, 0.82]) {
          const th = -currentSign * tt * drawnTurns * Math.PI * 2;
          const pos = new THREE.Vector3(
            R * Math.cos(th),
            -L / 2 + tt * L,
            R * Math.sin(th),
          );
          const dth = -currentSign * drawnTurns * Math.PI * 2;
          const tan = new THREE.Vector3(
            -R * Math.sin(th) * dth,
            L,
            R * Math.cos(th) * dth,
          );
          addCurrentCone(g, pos, tan, 0.18 * sSol, 0.46 * sSol, 0.85 * sSol);
        }
        const nY = (currentSign * L) / 2;
        const sY = -nY;
        makeLabel(
          g,
          "N",
          new THREE.Vector3(0.38, nY + currentSign * 0.52, 0),
          PAL.N,
          0.54,
        );
        makeLabel(
          g,
          "S",
          new THREE.Vector3(0.38, sY - currentSign * 0.52, 0),
          PAL.S,
          0.54,
        );
        break;
      }
    }
    return g;
  }

  function clearGroup(grp) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    grp.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
    });
    grp.clear();
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
  }

  function unpack(lines) {
    return lines.map((data) => {
      const points = [];
      for (let i = 0; i < data.length; i += 3)
        points.push(new THREE.Vector3(data[i], data[i + 1], data[i + 2]));
      return points;
    });
  }
  function showPickerArrow(pos, B) {
    clearGroup(pickerGroup);
    const d = B.clone().normalize();
    if (d.lengthSq() < 1e-12) return;
    const mat = new THREE.MeshBasicMaterial({
      color: PAL.picker,
      depthTest: false,
    });
    // 采样点标记球
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat);
    dot.position.copy(pos);
    pickerGroup.add(dot);
    // 杆 + 锥尖（总长约 1.05，轻巧不遮挡磁感线）
    const shaft = 0.62,
      r = 0.13,
      h = 0.33;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, shaft, 10),
      mat,
    );
    rod.position.copy(pos).addScaledVector(d, 0.1 + shaft / 2);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    pickerGroup.add(rod);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat);
    head.position.copy(pos).addScaledVector(d, 0.1 + shaft + h / 2);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    pickerGroup.add(head);
    pickerGroup.traverse((o) => {
      if (o.isMesh) o.renderOrder = 25;
    });
  }

  /* ==================== 双导线矢量合成演示 ==================== */
  const VEC_COLORS = { b1: 0x2367a3, b2: 0x2f9e44, bt: 0xd13d3d };
  function showVectorArrows(p, b1, b2, bt) {
    clearGroup(vecGroup);
    const m1 = b1.length(),
      m2 = b2.length(),
      mt = bt.length();
    if (m1 < 1e-9 || m2 < 1e-9) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0x2c3840, depthTest: false }),
      );
      dot.position.copy(p);
      vecGroup.add(dot);
      vecGroup.traverse((o) => {
        if (o.isMesh || o.isLine) o.renderOrder = 24;
      });
      return;
    }
    // 统一缩放：长度严格正比于 |B|，整体不超过可视范围
    const maxLen = Math.max(m1, m2, mt);
    const scale = Math.min(0.34, 2.6 / maxLen);
    const d1 = b1.clone().multiplyScalar(1 / m1);
    const d2 = b2.clone().multiplyScalar(1 / m2);
    const L1 = m1 * scale,
      L2 = m2 * scale;
    const tip1 = p.clone().addScaledVector(d1, L1); // P+B₁
    const tip2 = p.clone().addScaledVector(d2, L2); // P+B₂
    const tipT = p.clone().addScaledVector(d1, L1).addScaledVector(d2, L2); // P+B₁+B₂
    const makeArrow = (from, dir, len, color, rodR) => {
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(rodR, rodR, len * 0.62, 8),
        mat,
      );
      rod.position.copy(from).addScaledVector(dir, len * 0.31);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      vecGroup.add(rod);
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(rodR * 2.8, len * 0.38, 12),
        mat,
      );
      head.position.copy(from).addScaledVector(dir, len * 0.81);
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      vecGroup.add(head);
    };
    // 两邻边：B₁（蓝）、B₂（绿）实线箭头，均从 P 出发
    makeArrow(p, d1, L1, VEC_COLORS.b1, 0.05);
    makeArrow(p, d2, L2, VEC_COLORS.b2, 0.05);
    // 两条虚线边：P+B₁→P+B₁+B₂（∥B₂）、P+B₂→P+B₁+B₂（∥B₁）→ 平行四边形闭合
    const matD = new THREE.LineBasicMaterial({
      color: 0x8a97a1,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    const seg = (a, b) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      vecGroup.add(new THREE.Line(g, matD));
    };
    seg(tip1, tipT);
    seg(tip2, tipT);
    // 对角线：合成 B（红）；合场为零时保留两条反向分量，不画零长度箭头
    if (mt > 1e-9)
      makeArrow(
        p,
        tipT.clone().sub(p).normalize(),
        mt * scale,
        VEC_COLORS.bt,
        0.06,
      );
    // 三个顶点标记
    const mkDot = (pos, color) => {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 8),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      d.position.copy(pos);
      vecGroup.add(d);
    };
    mkDot(p, 0x2c3840);
    mkDot(tip1, 0x2367a3);
    mkDot(tip2, 0x2f9e44);
    mkDot(tipT, 0xd13d3d);
    vecGroup.traverse((o) => {
      if (o.isMesh || o.isLine) o.renderOrder = 24;
    });
  }

  // Instance-owned rendering state.
  let disposed = false,
    paused = false,
    frame = 0,
    timer = null,
    version = 0;
  let config, currentScene, currentParams, currentField, currentKeys;
  const computation = new ComputeClient();
  const installed = { model: null, field: null, heat: null, section: null };
  const status = { state: "loading", total: 0, closed: 0, maxB: 0 };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const fieldGroup = new THREE.Group(),
    arrowGroup = new THREE.Group(),
    heatGroup = new THREE.Group(),
    sourceGroup = new THREE.Group(),
    helperGroup = new THREE.Group(),
    sectionLineGroup = new THREE.Group(),
    pickerGroup = new THREE.Group(),
    vecGroup = new THREE.Group();
  scene.add(
    fieldGroup,
    arrowGroup,
    heatGroup,
    sourceGroup,
    helperGroup,
    sectionLineGroup,
    pickerGroup,
    vecGroup,
  );
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd8de, 1));
  const light = new THREE.DirectionalLight(0xffffff, 0.75);
  light.position.set(5, 10, 7);
  scene.add(light);
  const grid = new THREE.GridHelper(26, 26, PAL.gridMain, PAL.grid);
  grid.position.y = -4.6;
  helperGroup.add(grid);
  addWorldAxisTriad(helperGroup);
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  const events = new AbortController();
  function emitStatus(state) {
    status.state = state;
    onStatus({ ...status });
  }
  function resize() {
    if (disposed) return;
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    updateWideLineResolutions();
    render();
  }
  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function animate() {
    if (disposed || paused) return;
    controls.update();
    render();
    frame = requestAnimationFrame(animate);
  }
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  function visibility() {
    const show = !config.prediction;
    fieldGroup.visible =
      show &&
      !config.section.only &&
      config.lines &&
      installed.field === currentKeys.field;
    arrowGroup.visible = fieldGroup.visible && config.arrows;
    sectionLineGroup.visible =
      show &&
      config.section.only &&
      config.lines &&
      installed.section === currentKeys.section;
    sectionLineGroup.traverse((object) => {
      if (object.isInstancedMesh) object.visible = config.arrows;
    });
    heatGroup.visible =
      show && config.section.show && installed.heat === currentKeys.heat;
    sourceGroup.visible = config.sources;
    helperGroup.visible = config.grid;
    pickerGroup.visible = vecGroup.visible = show;
    render();
  }
  function install(result, keys, section, size) {
    if (result.field) {
      clearGroup(fieldGroup);
      clearGroup(arrowGroup);
      const gen = result.field,
        lines = unpack(gen.lines);
      lines.forEach((points, i) =>
        fieldGroup.add(
          makeWideLine(
            points,
            PAL.line,
            gen.closedFlags[i] ? 2.25 : 2,
            !gen.closedFlags[i],
          ),
        ),
      );
      const arrows = makeArrowMesh(
        collectArrowSpecs(
          lines,
          fieldArrowOptions(currentScene.id, currentParams),
        ),
        PAL.line,
        1,
      );
      if (arrows) arrowGroup.add(arrows);
      Object.assign(status, {
        total: gen.total,
        closed: gen.closed,
        expectedOpen: gen.expectedOpen,
        quality: gen.quality,
      });
      installed.field = keys.field;
    }
    if (result.heat) {
      clearGroup(heatGroup);
      heatGroup.add(
        makeHeatMap(result.heat, computeSectionBasis(section), size),
      );
      status.maxB = result.heat.scaleB;
      installed.heat = keys.heat;
    }
    if (result.section) {
      clearGroup(sectionLineGroup);
      const lines = unpack(result.section.lines);
      lines.forEach((points) =>
        sectionLineGroup.add(makeWideLine(points, PAL.line, 2.45)),
      );
      const arrows = makeArrowMesh(
        collectArrowSpecs(
          lines,
          fieldArrowOptions(currentScene.id, currentParams),
        ),
        PAL.line,
        0.85,
      );
      if (arrows) sectionLineGroup.add(arrows);
      status.sectionCount = lines.length;
      installed.section = keys.section;
    }
    updateWideLineResolutions();
  }
  async function calculate() {
    if (disposed || paused) return;
    const ticket = ++version;
    const keys = { ...currentKeys },
      section = { ...config.section },
      size = currentScene.size;
    const kinds = [];
    if (config.prediction) {
      emitStatus("hidden");
      visibility();
      return;
    }
    if (config.lines) {
      const kind = section.only ? "section" : "field";
      if (installed[kind] !== keys[kind]) kinds.push(kind);
    }
    if (section.show && installed.heat !== keys.heat) kinds.push("heat");
    try {
      if (kinds.length) {
        emitStatus("loading");
        const result = await computation.run({
          sceneId: currentScene.id,
          params: { ...currentParams },
          section,
          size,
          kinds,
        });
        if (disposed || ticket !== version) return;
        install(result, keys, section, size);
      }
      emitStatus("ready");
      visibility();
    } catch (error) {
      if (disposed || ticket !== version || error.name === "AbortError") return;
      emitStatus("error");
    }
  }
  function resetView() {
    camera.up.set(0, 1, 0);
    camera.position.set(...currentScene.camera.pos);
    controls.target.set(...currentScene.camera.target);
    controls.update();
    render();
  }
  function faceSection() {
    const sec = computeSectionBasis(config.section);
    camera.up.copy(sec.V);
    camera.position
      .copy(sec.center)
      .addScaledVector(sec.n, Math.max(currentScene.size * 1.15, 8));
    controls.target.copy(sec.center);
    controls.update();
    render();
  }
  function updateState(next, immediate = false) {
    if (disposed) return;
    const changed = currentScene?.id !== next.scene;
    const wasVector = config?.vectors;
    config = structuredClone(next);
    currentScene = SCENES.find((item) => item.id === config.scene);
    currentParams = config.params;
    currentKeys = layerKeys(
      config.scene,
      currentParams,
      config.section,
      currentScene.size,
    );
    ++version;
    computation.cancel();
    clearTimeout(timer);
    clearGroup(pickerGroup);
    clearGroup(vecGroup);
    onSample(null);
    if (installed.model !== currentKeys.model) {
      currentField = buildField(config.scene, currentParams);
      clearGroup(sourceGroup);
      sourceGroup.add(createSources(config.scene, currentParams));
      installed.model = currentKeys.model;
      Object.assign(status, { total: 0, closed: 0, maxB: 0, sectionCount: 0 });
    }
    if (changed) resetView();
    if (config.vectors && !wasVector) faceSection();
    if (!config.vectors && wasVector) resetView();
    visibility();
    emitStatus(config.prediction ? "hidden" : paused ? "paused" : "loading");
    if (immediate) calculate();
    else timer = setTimeout(calculate, 150);
  }
  function pick(event) {
    if (paused || config.prediction || status.state !== "ready") return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const sec = computeSectionBasis(config.section),
      point = new THREE.Vector3();
    if (
      !raycaster.ray.intersectPlane(
        new THREE.Plane(sec.n, -sec.n.dot(sec.center)),
        point,
      )
    )
      return;
    if (
      currentField.quantitativeMask?.(point.x, point.y, point.z) ||
      (["loop", "solenoid", "bent-wire"].includes(config.scene) &&
        currentField.heatMask?.(point.x, point.y, point.z))
    ) {
      clearGroup(pickerGroup);
      clearGroup(vecGroup);
      onSample({ message: "此处靠近场源边界，请选择外部位置读取场强。" });
      render();
      return;
    }
    currentField.evalB(point.x, point.y, point.z, _b);
    if (config.vectors && config.scene === "two-wires") {
      const f = currentField;
      evalWire(point.x, point.y, point.z, -f.d / 2, 0, 0, 0, 1, 0, f.I1, _b1);
      evalWire(
        point.x,
        point.y,
        point.z,
        f.d / 2,
        0,
        0,
        0,
        1,
        0,
        f.I2 * f.dir2,
        _b2,
      );
      _bt.copy(_b1).add(_b2);
      showVectorArrows(point, _b1, _b2, _bt);
    } else showPickerArrow(point, _b);
    onSample({
      position: point.toArray(),
      field: _b.toArray(),
      magnitude: formatFieldValue(_b.length()),
      b1: config.vectors ? _b1.toArray() : null,
      b2: config.vectors ? _b2.toArray() : null,
    });
    render();
  }
  renderer.domElement.addEventListener("click", pick, {
    signal: events.signal,
  });
  let lastMove = 0;
  renderer.domElement.addEventListener(
    "pointermove",
    (event) => {
      if (
        config.vectors &&
        !event.buttons &&
        performance.now() - lastMove > 50
      ) {
        lastMove = performance.now();
        pick(event);
      }
    },
    { signal: events.signal },
  );
  function dispose() {
    disposed = true;
    ++version;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    computation.dispose();
    events.abort();
    observer.disconnect();
    controls.removeEventListener("change", render);
    controls.dispose();
    clearGroup(scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  try {
    updateState(initial, true);
    resize();
    animate();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    updateState,
    resetView,
    faceSection,
    dispose,
    setPaused(value) {
      paused = value;
      cancelAnimationFrame(frame);
      ++version;
      computation.cancel();
      clearTimeout(timer);
      if (!paused) {
        calculate();
        animate();
      }
    },
    reset(next) {
      paused = false;
      cancelAnimationFrame(frame);
      updateState(next, true);
      resetView();
      animate();
    },
  };
}
