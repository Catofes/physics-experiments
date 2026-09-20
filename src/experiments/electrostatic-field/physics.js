// Adapted from jaccihan/electrostatic-field-ai-demo; see docs/SOURCES.md.
export const DEFAULT_STATE = {
  scene: "cavity",
  prediction: false,
  showCharges: true,
  showLines: true,
  showEquipotentials: true,
  showLabels: true,
  showBoundarySamples: false,
  chargeSign: 1,
  chargeMagnitude: 1,
  charge: { x: 0.5, y: 0.48 },
  dragging: false,
};
const lightningLayout = {
  ballPlate: { x: 0.18, y: 0.15, w: 0.32, h: 0.035 },
  needlePlate: { x: 0.56, y: 0.15, w: 0.32, h: 0.035 },
  ball: { cx: 0.34, cy: 0.55, r: 0.105 },
  needle: {
    tip: { x: 0.72, y: 0.38 },
    leftBase: { x: 0.695, y: 0.76 },
    rightBase: { x: 0.745, y: 0.76 },
    stemLeft: 0.708,
    stemRight: 0.732,
  },
};

const validScenes = [
  "solid",
  "charged",
  "shield",
  "cavity",
  "tip",
  "rod",
  "dumbbell",
];

export const sceneMeta = {
  solid: {
    title: "实心导体靠近外部电荷",
    lead: "拖动点电荷，观察导体表面电荷重新分布与内部电场为零。",
    question:
      "如果外部正电荷靠近导体左侧，导体左、右两侧分别会出现什么电荷？导体内部还有电场吗？",
  },
  charged: {
    title: "带电球形导体：无外电场",
    lead: "观察孤立带电球形导体的高对称情形：电荷均匀分布在外表面，球内电场为零。",
    question:
      "没有外部电场时，为什么球形导体表面电荷可以均匀分布？球内部为什么没有电场？",
  },
  shield: {
    title: "带空腔导体：外部电荷靠近",
    lead: "观察外部电荷靠近金属壳时，空腔内部是否受到外部静电场影响。",
    question:
      "外部电荷靠近时，空腔内表面一定会带电吗？空腔内部和导体材料内部有什么区别？",
  },
  cavity: {
    title: "带空腔导体：电荷放入空腔",
    lead: "拖动腔内电荷，观察内表面电荷分布如何随位置变化。",
    question:
      "点电荷放在空腔内部时，金属壳还能让空腔内没有电场吗？内表面电荷会均匀分布吗？",
  },
  tip: {
    title: "尖端效应：电荷密度与电场强弱",
    lead: "通过边界元求解尖端导体表面电荷，观察尖端附近电荷密度和电场强度的增强。",
    question: "为什么避雷针和尖端放电都和“尖端附近电场更强”有关？",
  },
  rod: {
    title: "避雷针演示器：金属球与尖端对比",
    lead: "对照实物装置：两组独立带电板分别作用于金属球和尖端针，只比较两者附近电场线的疏密差异。",
    question: "同样靠近带电板，为什么尖端针附近更容易出现放电？",
  },
  dumbbell: {
    title: "哑铃形导体：两个相连球形导体",
    lead: "观察两个并排相连的圆钝导体，比较外侧凸起和连接区域的表面电荷密度。",
    question:
      "两个球形导体连成同一个等势体后，表面电荷会更集中在哪些外轮廓位置？",
  },
};

export function createElectrostaticModel(
  initial = {},
  width = 1120,
  height = 700,
) {
  const size = { width, height };
  const state = {
    ...DEFAULT_STATE,
    ...initial,
    charge: { ...(initial.charge || { x: 0.5, y: 0.48 }) },
  };
  const bemCache = {
    key: "",
    solution: null,
  };

  const rodBemCache = {
    key: "",
    solution: null,
  };

  function sx(x) {
    return x * size.width;
  }

  function sy(y) {
    return y * size.height;
  }

  function nxToNyRadius(r) {
    return (r * size.width) / size.height;
  }

  function circlePoint(cx, cy, r, angle, offset = 0) {
    const pixelRadius = sx(r + offset);
    return {
      x: (sx(cx) + Math.cos(angle) * pixelRadius) / size.width,
      y: (sy(cy) + Math.sin(angle) * pixelRadius) / size.height,
    };
  }

  function circleNormal(angle) {
    return {
      x: Math.cos(angle),
      y: (Math.sin(angle) * size.width) / size.height,
    };
  }

  function normalizedDistance(a, b) {
    const dx = sx(a.x) - sx(b.x);
    const dy = sy(a.y) - sy(b.y);
    return Math.hypot(dx, dy) / size.width;
  }

  function pixelAngle(cx, cy, point) {
    return Math.atan2(sy(point.y) - sy(cy), sx(point.x) - sx(cx));
  }

  function pointFromPixelVector(origin, angle, pixelDistance) {
    return {
      x: (sx(origin.x) + Math.cos(angle) * pixelDistance) / size.width,
      y: (sy(origin.y) + Math.sin(angle) * pixelDistance) / size.height,
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function signedCharge() {
    return state.chargeSign * state.chargeMagnitude;
  }

  function toPhys(point) {
    return { x: point.x, y: (point.y * size.height) / size.width };
  }

  function fromPhys(point) {
    return { x: point.x, y: (point.y * size.width) / size.height };
  }

  function physDistance(a, b) {
    const pa = toPhys(a);
    const pb = toPhys(b);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y);
  }

  function makeBoundaryCircle(cx, cy, r, count, role) {
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const normalSign = role === "inner" ? -1 : 1;
      points.push({
        ...circlePoint(cx, cy, r, angle),
        cx,
        cy,
        r,
        angle,
        role,
        nx: Math.cos(angle) * normalSign,
        ny: Math.sin(angle) * normalSign,
        order: i,
        segment: (Math.PI * 2 * r) / count,
      });
    }
    return points;
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x:
        u ** 3 * p0.x +
        3 * u ** 2 * t * p1.x +
        3 * u * t ** 2 * p2.x +
        t ** 3 * p3.x,
      y:
        u ** 3 * p0.y +
        3 * u ** 2 * t * p1.y +
        3 * u * t ** 2 * p2.y +
        t ** 3 * p3.y,
    };
  }

  function makePolygonBoundary(points, role = "outer") {
    const centroid = points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
      }),
      { x: 0, y: 0 },
    );
    return points.map((point, index) => {
      const prev = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const pp = toPhys(prev);
      const np = toPhys(next);
      const cp = toPhys(point);
      const tangent = { x: np.x - pp.x, y: np.y - pp.y };
      const candidates = [
        { x: -tangent.y, y: tangent.x },
        { x: tangent.y, y: -tangent.x },
      ];
      const away = {
        x: cp.x - toPhys(centroid).x,
        y: cp.y - toPhys(centroid).y,
      };
      const selected =
        candidates[0].x * away.x + candidates[0].y * away.y >
        candidates[1].x * away.x + candidates[1].y * away.y
          ? candidates[0]
          : candidates[1];
      const len = Math.hypot(selected.x, selected.y) || 1;
      return {
        ...point,
        role,
        nx: selected.x / len,
        ny: selected.y / len,
        order: index,
        segment: (physDistance(point, prev) + physDistance(point, next)) / 2,
      };
    });
  }

  function makeTipBoundary() {
    const center = { x: 0.395, y: 0.5 };
    const radius = 0.22;
    const apex = { x: 0.85, y: 0.5 };
    const distance = apex.x - center.x;
    const tangentX = (radius * radius) / distance;
    const tangentY = radius * Math.sqrt(1 - (radius / distance) ** 2);
    const topJoin = {
      x: center.x + tangentX,
      y: center.y - tangentY,
    };
    const bottomJoin = {
      x: center.x + tangentX,
      y: center.y + tangentY,
    };
    const pointBeforeApex = (from) => {
      const dx = apex.x - from.x;
      const dy = apex.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const inset = 0.008;
      return {
        x: apex.x - (dx / len) * inset,
        y: apex.y - (dy / len) * inset,
      };
    };
    const tipTop = pointBeforeApex(topJoin);
    const tipBottom = pointBeforeApex(bottomJoin);
    const tipCap = [{ x: 0.852, y: 0.497 }, { x: 0.852, y: 0.503 }, tipBottom];
    const points = [];
    const appendLine = (from, to, count) => {
      for (let i = 0; i < count; i += 1) {
        const t = i / count;
        points.push({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
      }
    };
    const appendCurve = (curve, count) => {
      for (let i = 0; i < count; i += 1) {
        points.push(
          cubicPoint(curve[0], curve[1], curve[2], curve[3], i / count),
        );
      }
    };
    const appendBodyArc = (count) => {
      const start = Math.atan2(
        bottomJoin.y - center.y,
        bottomJoin.x - center.x,
      );
      const end =
        Math.PI * 2 + Math.atan2(topJoin.y - center.y, topJoin.x - center.x);
      for (let i = 0; i < count; i += 1) {
        const t = i / count;
        const angle = start + (end - start) * t;
        points.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
      }
    };
    appendLine(topJoin, tipTop, 28);
    appendCurve([tipTop, ...tipCap], 8);
    appendLine(tipBottom, bottomJoin, 28);
    appendBodyArc(72);
    return makePolygonBoundary(points, "outer");
  }

  function makeDumbbellBoundary() {
    const left = { x: 0.45, y: 0.5, r: 0.17 };
    const right = { x: 0.65, y: 0.5, r: 0.17 };
    const joinAngle = Math.acos((right.x - left.x) / (2 * left.r));
    const points = [];
    const perArc = 56;
    for (let i = 0; i < perArc; i += 1) {
      const t = i / perArc;
      const angle = joinAngle + (Math.PI * 2 - joinAngle * 2) * t;
      points.push(circlePoint(left.x, left.y, left.r, angle));
    }
    for (let i = 0; i < perArc; i += 1) {
      const t = i / perArc;
      const angle = Math.PI + joinAngle + (Math.PI * 2 - joinAngle * 2) * t;
      points.push(circlePoint(right.x, right.y, right.r, angle));
    }
    return makePolygonBoundary(points, "outer");
  }

  function makeRectangleBoundary(rect, countX, countY, role) {
    const points = [];
    for (let i = 0; i < countX; i += 1) {
      const t = i / countX;
      points.push({ x: rect.x + rect.w * t, y: rect.y });
    }
    for (let i = 0; i < countY; i += 1) {
      const t = i / countY;
      points.push({ x: rect.x + rect.w, y: rect.y + rect.h * t });
    }
    for (let i = 0; i < countX; i += 1) {
      const t = i / countX;
      points.push({ x: rect.x + rect.w * (1 - t), y: rect.y + rect.h });
    }
    for (let i = 0; i < countY; i += 1) {
      const t = i / countY;
      points.push({ x: rect.x, y: rect.y + rect.h * (1 - t) });
    }
    return makePolygonBoundary(points, role);
  }

  function rectPolygon(rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
  }

  function makeNeedleElectrodeBoundary() {
    const { needle } = lightningLayout;
    const points = [];
    const appendLine = (from, to, count) => {
      for (let i = 0; i < count; i += 1) {
        const t = i / count;
        points.push({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
      }
    };
    appendLine(needle.tip, needle.rightBase, 28);
    appendLine(needle.rightBase, needle.leftBase, 8);
    appendLine(needle.leftBase, needle.tip, 28);
    return makePolygonBoundary(points, "rodConductor");
  }

  function makeBemGeometry() {
    if (state.scene === "solid") {
      return {
        boundaries: makeBoundaryCircle(0.56, 0.5, 0.2, 56, "outer"),
        conductors: [
          { cx: 0.56, cy: 0.5, inner: 0, outer: 0.2, type: "solid" },
        ],
        netCharge: 0,
      };
    }
    if (state.scene === "charged") {
      return {
        boundaries: makeBoundaryCircle(0.56, 0.5, 0.2, 72, "outer"),
        conductors: [
          { cx: 0.56, cy: 0.5, inner: 0, outer: 0.2, type: "solid" },
        ],
        netCharge: signedCharge(),
      };
    }
    if (state.scene === "shield" || state.scene === "cavity") {
      return {
        boundaries: [
          ...makeBoundaryCircle(0.56, 0.5, 0.24, 60, "outer"),
          ...makeBoundaryCircle(0.56, 0.5, 0.112, 40, "inner"),
        ],
        conductors: [
          { cx: 0.56, cy: 0.5, inner: 0.112, outer: 0.24, type: "shell" },
        ],
        netCharge: 0,
      };
    }
    if (state.scene === "tip") {
      const boundaries = makeTipBoundary();
      return {
        boundaries,
        conductors: [
          {
            type: "polygon",
            polygon: boundaries.map(({ x, y }) => ({ x, y })),
          },
        ],
        netCharge: signedCharge(),
      };
    }
    if (state.scene === "dumbbell") {
      const boundaries = makeDumbbellBoundary();
      return {
        boundaries,
        conductors: [
          {
            type: "polygon",
            polygon: boundaries.map(({ x, y }) => ({ x, y })),
          },
        ],
        netCharge: signedCharge(),
      };
    }
    throw new Error(`Unknown scene: ${state.scene}`);
  }

  function sourceCharges() {
    if (["charged", "tip", "dumbbell"].includes(state.scene)) return [];
    return [{ x: state.charge.x, y: state.charge.y, q: signedCharge() }];
  }

  function green(a, b, selfSegment = 0) {
    if (selfSegment) return -Math.log(Math.max(0.002, selfSegment * 0.45));
    const d = Math.max(0.003, physDistance(a, b));
    return -Math.log(d);
  }

  function sourcePotential(point, sources) {
    return sources.reduce(
      (sum, source) => sum + source.q * green(point, source),
      0,
    );
  }

  function solveLinearSystem(matrix, vector) {
    const n = vector.length;
    const a = matrix.map((row, i) => [...row, vector[i]]);
    for (let col = 0; col < n; col += 1) {
      let pivot = col;
      for (let row = col + 1; row < n; row += 1) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      }
      if (Math.abs(a[pivot][col]) < 1e-10)
        throw new Error("BEM matrix is singular");
      [a[col], a[pivot]] = [a[pivot], a[col]];
      const scale = a[col][col];
      for (let k = col; k <= n; k += 1) a[col][k] /= scale;
      for (let row = 0; row < n; row += 1) {
        if (row === col) continue;
        const factor = a[row][col];
        for (let k = col; k <= n; k += 1) a[row][k] -= factor * a[col][k];
      }
    }
    return a.map((row) => row[n]);
  }

  function getBemSolution() {
    const key = [
      state.scene,
      state.chargeSign,
      state.chargeMagnitude.toFixed(2),
      state.charge.x.toFixed(3),
      state.charge.y.toFixed(3),
      size.width,
      size.height,
    ].join("|");
    if (bemCache.key === key) return bemCache.solution;

    const geometry = makeBemGeometry();
    const boundaries = geometry.boundaries;
    const sources = sourceCharges();
    const n = boundaries.length;
    const matrix = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0));
    const vector = Array(n + 1).fill(0);

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        matrix[i][j] = green(
          boundaries[i],
          boundaries[j],
          i === j ? boundaries[j].segment : 0,
        );
      }
      matrix[i][n] = -1;
      vector[i] = -sourcePotential(boundaries[i], sources);
    }
    for (let j = 0; j < n; j += 1) matrix[n][j] = 1;
    vector[n] = geometry.netCharge;

    const solved = solveLinearSystem(matrix, vector);
    const charges = applyPhysicalChargeCorrections(
      boundaries,
      solved.slice(0, n),
    );
    const conductorPotential = solved[n];
    const solution = {
      boundaries,
      charges,
      conductorPotential,
      sources,
      geometry,
      netCharge: geometry.netCharge,
    };
    bemCache.key = key;
    bemCache.solution = solution;
    return solution;
  }

  function applyPhysicalChargeCorrections(boundaries, charges) {
    const corrected = [...charges];
    if (state.scene === "shield") {
      boundaries.forEach((boundary, index) => {
        if (boundary.role === "inner") corrected[index] = 0;
      });
    }
    if (state.scene === "cavity") {
      const outerIndices = boundaries
        .map((boundary, index) => (boundary.role === "outer" ? index : -1))
        .filter((index) => index >= 0);
      const outerMean =
        outerIndices.reduce((sum, index) => sum + corrected[index], 0) /
        outerIndices.length;
      outerIndices.forEach((index) => {
        corrected[index] = outerMean;
      });
    }
    return corrected;
  }

  function getRodBemSolution() {
    const key = [
      size.width,
      size.height,
      state.chargeMagnitude.toFixed(2),
    ].join("|");
    if (rodBemCache.key === key) return rodBemCache.solution;

    const potentialScale = state.chargeMagnitude;
    const { ballPlate, needlePlate, ball } = lightningLayout;
    const groups = [
      {
        kind: "ball",
        plate: ballPlate,
        boundaries: [
          ...makeRectangleBoundary(ballPlate, 18, 3, "rodPlate"),
          ...makeBoundaryCircle(ball.cx, ball.cy, ball.r, 56, "rodConductor"),
        ],
        conductors: [
          { type: "polygon", polygon: rectPolygon(ballPlate) },
          { type: "solid", cx: ball.cx, cy: ball.cy, outer: ball.r },
        ],
        seeds: [0.26, 0.38, 0.5, 0.62, 0.74],
      },
      {
        kind: "needle",
        plate: needlePlate,
        boundaries: [
          ...makeRectangleBoundary(needlePlate, 18, 3, "rodPlate"),
          ...makeNeedleElectrodeBoundary(),
        ],
        conductors: [
          { type: "polygon", polygon: rectPolygon(needlePlate) },
          {
            type: "polygon",
            polygon: [
              lightningLayout.needle.tip,
              lightningLayout.needle.rightBase,
              lightningLayout.needle.leftBase,
            ],
          },
        ],
        seeds: [0.26, 0.34, 0.4, 0.44, 0.47, 0.5, 0.53, 0.56, 0.6, 0.66, 0.74],
      },
    ].map((group) => solveRodBemGroup(group, potentialScale));

    const solution = { groups };
    rodBemCache.key = key;
    rodBemCache.solution = solution;
    return solution;
  }

  function solveRodBemGroup(group, potentialScale) {
    const n = group.boundaries.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const vector = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        matrix[i][j] = green(
          group.boundaries[i],
          group.boundaries[j],
          i === j ? group.boundaries[j].segment : 0,
        );
      }
      vector[i] = group.boundaries[i].role === "rodPlate" ? potentialScale : 0;
    }
    return {
      ...group,
      charges: solveLinearSystem(matrix, vector),
    };
  }

  function rodPotentialAt(point, group) {
    return group.boundaries.reduce(
      (sum, boundary, index) =>
        sum + group.charges[index] * green(point, boundary),
      0,
    );
  }

  function rodBoundaryPotentialAt(group, boundaryIndex) {
    const point = group.boundaries[boundaryIndex];
    return group.boundaries.reduce(
      (sum, boundary, index) =>
        sum +
        group.charges[index] *
          green(
            point,
            boundary,
            index === boundaryIndex ? boundary.segment : 0,
          ),
      0,
    );
  }

  function rodFieldAt(point, group) {
    const p = toPhys(point);
    let ex = 0;
    let ey = 0;
    group.boundaries.forEach((boundary, index) => {
      const q = group.charges[index];
      const bp = toPhys(boundary);
      const dx = p.x - bp.x;
      const dy = p.y - bp.y;
      const r2 = Math.max(0.00002, dx * dx + dy * dy);
      ex += (q * dx) / r2;
      ey += (q * dy) / r2;
    });
    return { x: ex, y: ey };
  }

  function isInRodGroupConductor(point, group) {
    return group.conductors.some((conductor) => {
      if (conductor.type === "polygon")
        return pointInPolygon(point, conductor.polygon);
      return physDistance(point, conductor) < conductor.outer;
    });
  }

  function fieldAt(point, solution) {
    const p = toPhys(point);
    let ex = 0;
    let ey = 0;
    const addCharge = (chargePoint, q) => {
      const cp = toPhys(chargePoint);
      const dx = p.x - cp.x;
      const dy = p.y - cp.y;
      const r2 = Math.max(0.00002, dx * dx + dy * dy);
      ex += (q * dx) / r2;
      ey += (q * dy) / r2;
    };
    solution.sources.forEach((source) => addCharge(source, source.q));
    solution.boundaries.forEach((boundary, i) =>
      addCharge(boundary, solution.charges[i]),
    );
    return { x: ex, y: ey };
  }

  function potentialAt(point, solution) {
    let value = sourcePotential(point, solution.sources);
    solution.boundaries.forEach((boundary, index) => {
      value += solution.charges[index] * green(point, boundary);
    });
    return value;
  }

  function isDrawablePotentialPoint(point, solution) {
    if (isInConductor(point, solution)) return false;
    if (isInShieldedCavityInterior(point, solution)) return false;
    return !solution.sources.some(
      (source) => physDistance(point, source) < 0.03,
    );
  }

  function isInShieldedCavityInterior(point, solution) {
    if (state.scene !== "shield") return false;
    const conductor = solution.geometry.conductors[0];
    if (conductor.type !== "shell") return false;
    const center = { x: conductor.cx, y: conductor.cy };
    return physDistance(point, center) < conductor.inner;
  }

  function isInConductor(point, solution) {
    const conductor = solution.geometry.conductors[0];
    if (conductor.type === "polygon")
      return pointInPolygon(point, conductor.polygon);
    const center = { x: conductor.cx, y: conductor.cy };
    const d = physDistance(point, center);
    if (conductor.type === "solid") return d < conductor.outer;
    return d > conductor.inner && d < conductor.outer;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const pi = polygon[i];
      const pj = polygon[j];
      const intersects =
        pi.y > point.y !== pj.y > point.y &&
        point.x <
          ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y || 1e-9) + pi.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function getStudentChecks() {
    if (state.prediction) {
      return [
        "先判断近侧/远侧感应电荷符号。",
        "先判断导体材料内部电场是否为零。",
        "再显示模型结果进行对照。",
      ];
    }
    if (state.scene === "cavity") {
      return [
        "空腔内部可以有电场。",
        "导体材料内部保持 E=0。",
        "内表面异号电荷在靠近处更密。",
      ];
    }
    if (state.scene === "charged") {
      return [
        "球面对称使表面电荷均匀分布。",
        "导体内部保持 E=0。",
        "外部电场线沿半径方向分布。",
      ];
    }
    if (state.scene === "shield") {
      return [
        "外部电荷只改变外表面分布。",
        "空腔内部不出现外部电场线。",
        "导体材料内部保持 E=0。",
      ];
    }
    if (state.scene === "tip") {
      return [
        "电场线已加粗，便于投屏观察。",
        "尖端附近线条更密，表示场强更大。",
        "导体边界满足等势条件。",
      ];
    }
    if (state.scene === "rod") {
      return [
        "两组装置互不连线，只做并列比较。",
        "金属球附近场线较疏，分布更均匀。",
        "尖端附近场线明显收束，表示局部场强更大。",
      ];
    }
    if (state.scene === "dumbbell") {
      return [
        "外侧凸起处电荷较密。",
        "两球连接附近电荷较少。",
        "整体仍是同一个等势导体。",
      ];
    }
    return [
      "近侧出现异号感应电荷。",
      "远侧出现同号感应电荷。",
      "导体内部保持 E=0。",
    ];
  }

  function hasPointCharge() {
    return (
      state.scene === "solid" ||
      state.scene === "shield" ||
      state.scene === "cavity"
    );
  }
  function constrainCharge(point) {
    if (state.scene === "charged") {
      return { x: 0.56, y: 0.5 };
    }
    if (state.scene === "cavity") {
      const cx = 0.56;
      const cy = 0.5;
      const rx = 0.086;
      const ry = nxToNyRadius(rx);
      const dx = point.x - cx;
      const dy = point.y - cy;
      const ratio = Math.hypot(dx / rx, dy / ry);
      if (ratio <= 1) return { x: point.x, y: point.y };
      return {
        x: cx + dx / ratio,
        y: cy + dy / ratio,
      };
    }
    if (state.scene === "solid" || state.scene === "shield") {
      const cx = 0.56;
      const cy = 0.5;
      const outer = state.scene === "solid" ? 0.2 : 0.24;
      const margin = 0.055;
      const pp = toPhys(point);
      const cp = toPhys({ x: cx, y: cy });
      const dx = pp.x - cp.x;
      const dy = pp.y - cp.y;
      const dist = Math.hypot(dx, dy);
      const minDist = outer + margin;
      if (dist < minDist) {
        const angle = Math.atan2(dy, dx || -1);
        return fromPhys({
          x: cp.x + Math.cos(angle) * minDist,
          y: cp.y + Math.sin(angle) * minDist,
        });
      }
    }
    return {
      x: clamp(point.x, 0.04, 0.96),
      y: clamp(point.y, 0.08, 0.92),
    };
  }

  function setScene(scene) {
    if (!validScenes.includes(scene)) throw new Error("未知静电场场景");
    state.scene = scene;
    state.dragging = false;
    state.charge =
      scene === "cavity"
        ? { x: 0.5, y: 0.48 }
        : scene === "charged"
          ? { x: 0.56, y: 0.5 }
          : { x: 0.23, y: 0.5 };
  }
  return {
    state,
    sx,
    sy,
    nxToNyRadius,
    circlePoint,
    pixelAngle,
    pointFromPixelVector,
    clamp,
    toPhys,
    fromPhys,
    physDistance,
    cubicPoint,
    green,
    sourcePotential,
    getBemSolution,
    getRodBemSolution,
    rodPotentialAt,
    rodBoundaryPotentialAt,
    rodFieldAt,
    isInRodGroupConductor,
    fieldAt,
    potentialAt,
    isDrawablePotentialPoint,
    isInConductor,
    constrainCharge,
    setScene,
    getStudentChecks,
    normalizedDistance,
  };
}
