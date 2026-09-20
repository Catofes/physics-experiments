// Canvas rendering adapted from the reference experiment.
import { createElectrostaticModel } from "./physics.js";
export function createElectrostaticSimulation(
  canvas,
  initial,
  onDiagnostics,
  onError,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 Canvas");
  const model = createElectrostaticModel(initial, canvas.width, canvas.height);
  const {
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
    isInCavityExterior,
    isDrawablePotentialPoint,
    isInConductor,
    constrainCharge,
  } = model;
  let frame = 0,
    paused = false,
    disposed = false;
  const events = new AbortController();
  const visualState = {
    scene: "",
    charges: [],
    fieldLineAlpha: 1,
    maxChargeDelta: 0,
  };

  const fieldLineConfig = {
    maxLines: 38,
    maxLinesDragging: 26,
    minSourceLines: 8,
    maxSourceLines: 14,
    maxBoundaryLines: 48,
  };

  const surfaceChargeScales = {
    solid: 0.065,
    charged: 0.025,
    shield: 0.07,
    cavity: 0.095,
    tip: 0.055,
    rod: 0.055,
    dumbbell: 0.025,
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

  function clearCanvas(showGrid = true) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fcfdfe";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!showGrid) return;
    ctx.strokeStyle = "rgba(117, 132, 143, 0.075)";
    ctx.lineWidth = 1;
    for (let x = 80; x < canvas.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 70; y < canvas.height; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function draw() {
    const startedAt = performance.now();
    try {
      if (state.scene === "rod") {
        drawLightningRodScene(startedAt);
        return;
      }
      const solution = getBemSolution();
      advanceVisualState(solution);
      clearCanvas();
      if (!state.prediction && state.showEquipotentials)
        drawEquipotentialLines();
      if (!state.prediction && state.showLines) drawFieldLines();
      drawConductor();
      if (!state.prediction && state.showCharges) drawSurfaceCharges();
      if (hasPointCharge()) drawPointCharge();
      if (state.showLabels) drawLabels();
      updatePhysicsDiagnostics(performance.now() - startedAt);

      if (needsVisualAnimation()) requestDraw();
    } catch (error) {
      onError(error);
      ctx.save();
      ctx.fillStyle = "#7f1d1d";
      ctx.font = "700 24px sans-serif";
      ctx.fillText(`绘制错误：${error.message}`, 48, 76);
      ctx.restore();
    }
  }

  function advanceVisualState(solution) {
    if (
      visualState.scene !== state.scene ||
      visualState.charges.length !== solution.charges.length
    ) {
      visualState.scene = state.scene;
      visualState.charges = [...solution.charges];
      visualState.fieldLineAlpha = 1;
      visualState.maxChargeDelta = 0;
      return;
    }

    const chargeEase = state.dragging ? 0.42 : 0.24;
    let maxDelta = 0;
    visualState.charges = visualState.charges.map((displayed, index) => {
      const target = solution.charges[index];
      const next = displayed + (target - displayed) * chargeEase;
      maxDelta = Math.max(maxDelta, Math.abs(target - next));
      return next;
    });
    visualState.maxChargeDelta = maxDelta;

    const targetAlpha = state.dragging ? 0.58 : 1;
    const alphaEase = state.dragging ? 0.45 : 0.18;
    visualState.fieldLineAlpha +=
      (targetAlpha - visualState.fieldLineAlpha) * alphaEase;
  }

  function needsVisualAnimation() {
    if (visualState.maxChargeDelta > 0.00035) return true;
    const targetAlpha = state.dragging ? 0.58 : 1;
    return Math.abs(visualState.fieldLineAlpha - targetAlpha) > 0.012;
  }

  function requestDraw() {
    if (disposed || paused || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  function updatePhysicsDiagnostics(elapsedMs = 0) {
    const solution = getBemSolution();
    const potentials = solution.boundaries.map((boundary) => {
      let value = sourcePotential(boundary, solution.sources);
      solution.boundaries.forEach((other, index) => {
        value +=
          solution.charges[index] *
          green(boundary, other, boundary === other ? other.segment : 0);
      });
      return value;
    });
    const mean =
      potentials.reduce((sum, value) => sum + value, 0) / potentials.length;
    const maxError = Math.max(
      ...potentials.map((value) => Math.abs(value - mean)),
    );
    const total = solution.charges.reduce((sum, value) => sum + value, 0);
    const outer = solution.charges.reduce(
      (sum, value, index) =>
        sum + (solution.boundaries[index].role === "outer" ? value : 0),
      0,
    );
    const inner = solution.charges.reduce(
      (sum, value, index) =>
        sum + (solution.boundaries[index].role === "inner" ? value : 0),
      0,
    );
    const items = [];
    if (state.scene === "solid") {
      items.push(`边界等势最大误差：${maxError.toExponential(2)}`);
      items.push(`导体净电荷约束：${total.toExponential(2)}`);
    } else if (state.scene === "shield") {
      const innerMax = Math.max(
        ...solution.charges.map((value, index) =>
          solution.boundaries[index].role === "inner" ? Math.abs(value) : 0,
        ),
      );
      items.push(`屏蔽约束：内表面最大电荷 ${innerMax.toExponential(2)}`);
      items.push(`导体净电荷约束：${total.toExponential(2)}`);
    } else if (state.scene === "cavity") {
      const outerCharges = solution.charges.filter(
        (value, index) => solution.boundaries[index].role === "outer",
      );
      const outerMean =
        outerCharges.reduce((sum, value) => sum + value, 0) /
        outerCharges.length;
      const outerDeviation = Math.max(
        ...outerCharges.map((value) => Math.abs(value - outerMean)),
      );
      items.push(`外表面均匀偏差：${outerDeviation.toExponential(2)}`);
      items.push(`导体净电荷约束：${total.toExponential(2)}`);
    } else {
      items.push(`边界等势最大误差：${maxError.toExponential(2)}`);
      items.push(`导体净电荷：${total.toFixed(3)}`);
    }
    items.push(`求解与绘制耗时：${elapsedMs.toFixed(1)} ms`);
    if (state.scene === "shield" || state.scene === "cavity") {
      items.push(`外表面总电荷：${outer.toFixed(3)}`);
      items.push(`内表面总电荷：${inner.toFixed(3)}`);
    }
    onDiagnostics(state.prediction ? [] : items);
  }

  function updateLightningDiagnostics(elapsedMs = 0) {
    const solution = getRodBemSolution();
    const errors = solution.groups.map((group) => {
      const maxError = Math.max(
        ...group.boundaries.map((boundary, boundaryIndex) => {
          const target =
            boundary.role === "rodPlate" ? state.chargeMagnitude : 0;
          return Math.abs(
            rodBoundaryPotentialAt(group, boundaryIndex) - target,
          );
        }),
      );
      return `${group.kind === "ball" ? "球组" : "尖端组"} ${maxError.toExponential(2)}`;
    });
    onDiagnostics(
      state.prediction
        ? []
        : [
            "左右两组独立电极互不连通，避免互相影响。",
            `Dirichlet BEM 边界误差：${errors.join(" / ")}`,
            "场线不穿过金属，导体内部保持 E = 0。",
            `数值求解与绘制耗时：${elapsedMs.toFixed(1)} ms`,
          ],
    );
  }

  function drawConductor() {
    if (state.scene === "solid" || state.scene === "charged") {
      drawDisk(0.56, 0.5, 0.2);
    } else if (state.scene === "shield" || state.scene === "cavity") {
      drawShell();
    } else if (state.scene === "dumbbell") {
      drawDumbbellConductor();
    } else {
      drawPolygonConductor(getBemSolution().geometry.conductors[0].polygon);
    }
  }

  function drawLightningRodScene(startedAt) {
    clearCanvas(false);
    if (!state.prediction && state.showLines) drawLightningFocusGlow();
    if (!state.prediction && state.showEquipotentials)
      drawLightningPotentialGuides();
    if (!state.prediction && state.showLines)
      drawLightningIllustrationFieldLines();
    drawLightningApparatus();
    if (!state.prediction && state.showBoundarySamples)
      drawRodBoundarySamples();
    if (!state.prediction && state.showCharges) drawLightningSurfaceCharges();
    if (state.showLabels) drawLabels();
    updateLightningDiagnostics(performance.now() - startedAt);
  }

  function drawDisk(cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx(cx), sy(cy), sx(r), 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      sx(cx - 0.08),
      sy(cy - 0.1),
      sx(0.02),
      sx(cx),
      sy(cy),
      sx(r),
    );
    grad.addColorStop(0, "#f2f6f8");
    grad.addColorStop(0.62, "#d9e1e6");
    grad.addColorStop(1, "#c7d1d8");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#7f8e99";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawShell() {
    ctx.save();
    const cx = sx(0.56);
    const cy = sy(0.5);
    const outer = sx(0.24);
    const inner = sx(0.112);
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
    const grad = ctx.createRadialGradient(
      sx(0.47),
      sy(0.35),
      sx(0.04),
      cx,
      cy,
      outer,
    );
    grad.addColorStop(0, "#f4f7f9");
    grad.addColorStop(0.58, "#d9e1e6");
    grad.addColorStop(1, "#c7d1d8");
    ctx.fillStyle = grad;
    ctx.fill("evenodd");
    ctx.strokeStyle = "#7f8e99";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawDumbbellConductor() {
    drawPolygonConductor(getBemSolution().geometry.conductors[0].polygon);
  }

  function drawPolygonConductor(points) {
    ctx.save();
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const grad = ctx.createLinearGradient(
      sx(Math.min(...xs)),
      sy(Math.min(...ys)),
      sx(Math.max(...xs)),
      sy(Math.max(...ys)),
    );
    grad.addColorStop(0, "#f2f6f8");
    grad.addColorStop(0.62, "#d9e1e6");
    grad.addColorStop(1, "#c4ced6");
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(sx(point.x), sy(point.y));
      else ctx.lineTo(sx(point.x), sy(point.y));
    });
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#7f8e99";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPointCharge() {
    const x = sx(state.charge.x);
    const y = sy(state.charge.y);
    const color = state.chargeSign > 0 ? "#c2413f" : "#2563a9";
    const radius = 18 + Math.sqrt(state.chargeMagnitude) * 4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "700 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.chargeSign > 0 ? "+" : "-", x, y - 1);
    ctx.restore();
  }

  function drawSurfaceCharges() {
    drawBemSurfaceCharges();
  }

  function drawBemSurfaceCharges() {
    const solution = getBemSolution();
    const charges =
      visualState.charges.length === solution.charges.length
        ? visualState.charges
        : solution.charges;
    const scale =
      surfaceChargeScales[state.scene] ||
      Math.max(...solution.charges.map((charge) => Math.abs(charge)), 1e-6);
    solution.boundaries.forEach((boundary, index) => {
      const q = displaySurfaceCharge(charges[index]);
      const strength = clamp(Math.abs(q) / scale, 0, 1.15);
      if (strength < 0.055) return;
      const point = offsetBoundaryPoint(boundary, 0.009);
      drawSurfaceDot(point.x, point.y, q > 0 ? 1 : -1, 2.4 + strength * 6.2);
    });
  }

  function displaySurfaceCharge(q) {
    if (["charged", "tip", "dumbbell"].includes(state.scene)) {
      return Math.abs(q) * (state.chargeSign > 0 ? 1 : -1);
    }
    return q;
  }

  function drawSurfaceDot(x, y, sign, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), radius, 0, Math.PI * 2);
    ctx.fillStyle = sign > 0 ? "#c2413f" : "#2563a9";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawLightningApparatus() {
    const { ballPlate, needlePlate, ball, needle } = lightningLayout;
    ctx.save();

    drawLightningPlate(ballPlate);
    drawLightningPlate(needlePlate);

    drawDisk(ball.cx, ball.cy, ball.r);
    ctx.fillStyle = "#b9c4cc";
    ctx.fillRect(
      sx(ball.cx - 0.009),
      sy(ball.cy + nxToNyRadius(ball.r) * 0.86),
      sx(0.018),
      sy(0.17),
    );
    ctx.strokeStyle = "#7f8e99";
    ctx.strokeRect(
      sx(ball.cx - 0.009),
      sy(ball.cy + nxToNyRadius(ball.r) * 0.86),
      sx(0.018),
      sy(0.17),
    );

    const needleGrad = ctx.createLinearGradient(
      sx(needle.leftBase.x),
      sy(needle.leftBase.y),
      sx(needle.tip.x),
      sy(needle.tip.y),
    );
    needleGrad.addColorStop(0, "#cbd6dd");
    needleGrad.addColorStop(1, "#f8fbfc");
    ctx.beginPath();
    ctx.moveTo(sx(needle.tip.x), sy(needle.tip.y));
    ctx.lineTo(sx(needle.rightBase.x), sy(needle.rightBase.y));
    ctx.lineTo(sx(needle.leftBase.x), sy(needle.leftBase.y));
    ctx.closePath();
    ctx.fillStyle = needleGrad;
    ctx.fill();
    ctx.strokeStyle = "#6f7e89";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx(needle.tip.x), sy(needle.tip.y));
    ctx.lineTo(sx(needle.tip.x), sy(needle.leftBase.y + 0.02));
    ctx.strokeStyle = "rgba(85, 99, 109, 0.38)";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = "#b9c4cc";
    ctx.fillRect(
      sx(needle.stemLeft),
      sy(0.76),
      sx(needle.stemRight - needle.stemLeft),
      sy(0.15),
    );
    ctx.strokeStyle = "#7f8e99";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      sx(needle.stemLeft),
      sy(0.76),
      sx(needle.stemRight - needle.stemLeft),
      sy(0.15),
    );

    ctx.restore();
  }

  function drawLightningPlate(plate) {
    ctx.fillStyle = "#dbe3e8";
    ctx.strokeStyle = "#7a8993";
    ctx.lineWidth = 2.2;
    ctx.fillRect(sx(plate.x), sy(plate.y), sx(plate.w), sy(plate.h));
    ctx.strokeRect(sx(plate.x), sy(plate.y), sx(plate.w), sy(plate.h));
  }

  function drawLightningSurfaceCharges() {
    getRodBemSolution().groups.forEach((group) => {
      const conductorMaxAbs = Math.max(
        ...group.charges
          .filter((_, index) => group.boundaries[index].role === "rodConductor")
          .map((charge) => Math.abs(charge)),
        1e-6,
      );
      group.boundaries.forEach((boundary, index) => {
        const q = group.charges[index] * state.chargeSign;
        if (boundary.role === "rodPlate") {
          const bottomY = group.plate.y + group.plate.h;
          const isFacingSurface = Math.abs(boundary.y - bottomY) < 0.003;
          const isInterior =
            boundary.x > group.plate.x + 0.025 &&
            boundary.x < group.plate.x + group.plate.w - 0.025;
          if (!isFacingSurface || !isInterior || index % 2 !== 0) return;
          const p = offsetBoundaryPoint(boundary, 0.008);
          drawChargeMark(p.x, p.y, state.chargeSign, 8.5);
          return;
        }
        const strength = Math.abs(q) / conductorMaxAbs;
        if (strength < 0.08) return;
        if (
          group.kind === "ball" &&
          boundary.y > lightningLayout.ball.cy + 0.025
        )
          return;
        if (
          group.kind === "needle" &&
          boundary.y > lightningLayout.needle.tip.y + 0.16
        )
          return;
        if (index % (group.kind === "needle" ? 1 : 2) !== 0) return;
        const p = offsetBoundaryPoint(boundary, 0.009);
        const radiusBoost = group.kind === "needle" ? 1.15 : 1;
        drawSurfaceDot(
          p.x,
          p.y,
          q > 0 ? 1 : -1,
          (1.8 + Math.min(1.05, strength) * 4.4) * radiusBoost,
        );
      });
    });
  }

  function drawRodBoundarySamples() {
    ctx.save();
    getRodBemSolution().groups.forEach((group) => {
      group.boundaries.forEach((boundary, index) => {
        if (index % 2 !== 0) return;
        ctx.beginPath();
        ctx.arc(
          sx(boundary.x),
          sy(boundary.y),
          boundary.role === "rodPlate" ? 2.1 : 1.8,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle =
          boundary.role === "rodPlate"
            ? "rgba(34, 197, 94, 0.88)"
            : "rgba(20, 184, 166, 0.82)";
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawChargeMark(x, y, sign, size) {
    ctx.save();
    ctx.strokeStyle = sign > 0 ? "#b9424a" : "#2367a3";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx(x) - size * 0.45, sy(y));
    ctx.lineTo(sx(x) + size * 0.45, sy(y));
    ctx.stroke();
    if (sign > 0) {
      ctx.beginPath();
      ctx.moveTo(sx(x), sy(y) - size * 0.45);
      ctx.lineTo(sx(x), sy(y) + size * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEquipotentialLines() {
    const solution = getBemSolution();
    // Choose levels independently: moving the source changes cavity values,
    // but must not shift the exterior contours' selected potentials.
    const regions = state.scene === "cavity" ? ["inner", "outer"] : [null];
    ctx.save();
    ctx.strokeStyle = "rgba(92, 112, 126, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 6]);
    regions.forEach((region) => {
      const grid = makePotentialGrid(solution, 104, 68, region);
      makeEquipotentialLevels(grid.values).forEach((level) =>
        drawPotentialContour(grid, level),
      );
    });
    ctx.restore();
  }

  function drawLightningPotentialGuides() {
    ctx.save();
    ctx.strokeStyle = "rgba(99, 118, 132, 0.16)";
    ctx.lineWidth = 1.05;
    ctx.setLineDash([6, 8]);
    getRodBemSolution().groups.forEach((group) => {
      const grid = makeRodPotentialGrid(group, 58, 46);
      [0.18, 0.34, 0.5, 0.66, 0.82]
        .map((level) => level * state.chargeMagnitude)
        .forEach((level) => drawRodPotentialContour(grid, level));
    });
    ctx.restore();
  }

  function makePotentialGrid(solution, cols, rows, region) {
    const cells = [];
    const values = [];
    for (let row = 0; row <= rows; row += 1) {
      const line = [];
      const y = row / rows;
      for (let col = 0; col <= cols; col += 1) {
        const x = col / cols;
        const point = { x, y };
        if (
          !isDrawablePotentialPoint(point, solution) ||
          (region && isInCavityExterior(point, solution) !== (region === "outer"))
        ) {
          line.push({ x, y, value: NaN, drawable: false });
          continue;
        }
        const value = potentialAt(point, solution);
        const drawable = Number.isFinite(value);
        if (drawable) values.push(value);
        line.push({ x, y, value, drawable });
      }
      cells.push(line);
    }
    return { cols, rows, cells, values };
  }

  function makeEquipotentialLevels(values) {
    if (values.length < 20) return [];
    const sorted = values
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (sorted.length < 20) return [];
    const low = sorted[Math.floor(sorted.length * 0.06)];
    const high = sorted[Math.floor(sorted.length * 0.94)];
    if (
      !Number.isFinite(low) ||
      !Number.isFinite(high) ||
      Math.abs(high - low) < 1e-6
    )
      return [];
    const count = Math.round(7 + state.chargeMagnitude * 3);
    return Array.from(
      { length: count },
      (_, index) => low + ((index + 1) / (count + 1)) * (high - low),
    );
  }

  function drawPotentialContour(grid, level) {
    for (let row = 0; row < grid.rows; row += 1) {
      for (let col = 0; col < grid.cols; col += 1) {
        const p00 = grid.cells[row][col];
        const p10 = grid.cells[row][col + 1];
        const p11 = grid.cells[row + 1][col + 1];
        const p01 = grid.cells[row + 1][col];
        if (!p00.drawable || !p10.drawable || !p11.drawable || !p01.drawable)
          continue;
        const intersections = [
          contourEdgePoint(p00, p10, level),
          contourEdgePoint(p10, p11, level),
          contourEdgePoint(p11, p01, level),
          contourEdgePoint(p01, p00, level),
        ].filter(Boolean);
        if (intersections.length === 2) {
          drawContourSegment(intersections[0], intersections[1]);
        } else if (intersections.length === 4) {
          drawContourSegment(intersections[0], intersections[1]);
          drawContourSegment(intersections[2], intersections[3]);
        }
      }
    }
  }

  function makeRodPotentialGrid(group, cols, rows) {
    const padX = 0.06;
    const minX = group.plate.x - padX;
    const maxX = group.plate.x + group.plate.w + padX;
    const minY = 0.12;
    const maxY = 0.86;
    const cells = [];
    for (let row = 0; row <= rows; row += 1) {
      const line = [];
      const y = minY + (row / rows) * (maxY - minY);
      for (let col = 0; col <= cols; col += 1) {
        const x = minX + (col / cols) * (maxX - minX);
        const point = { x, y };
        const drawable = !isInRodGroupConductor(point, group);
        line.push({
          x,
          y,
          value: drawable ? rodPotentialAt(point, group) : NaN,
          drawable,
        });
      }
      cells.push(line);
    }
    return { cols, rows, cells };
  }

  function drawRodPotentialContour(grid, level) {
    for (let row = 0; row < grid.rows; row += 1) {
      for (let col = 0; col < grid.cols; col += 1) {
        const p00 = grid.cells[row][col];
        const p10 = grid.cells[row][col + 1];
        const p11 = grid.cells[row + 1][col + 1];
        const p01 = grid.cells[row + 1][col];
        if (!p00.drawable || !p10.drawable || !p11.drawable || !p01.drawable)
          continue;
        const intersections = [
          contourEdgePoint(p00, p10, level),
          contourEdgePoint(p10, p11, level),
          contourEdgePoint(p11, p01, level),
          contourEdgePoint(p01, p00, level),
        ].filter(Boolean);
        if (intersections.length === 2) {
          drawContourSegment(intersections[0], intersections[1]);
        } else if (intersections.length === 4) {
          drawContourSegment(intersections[0], intersections[1]);
          drawContourSegment(intersections[2], intersections[3]);
        }
      }
    }
  }

  function contourEdgePoint(a, b, level) {
    const av = a.value;
    const bv = b.value;
    if (!Number.isFinite(av) || !Number.isFinite(bv)) return null;
    if (
      (level < av && level < bv) ||
      (level > av && level > bv) ||
      Math.abs(av - bv) < 1e-9
    )
      return null;
    const t = clamp((level - av) / (bv - av), 0, 1);
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  }

  function drawContourSegment(a, b) {
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.stroke();
  }

  function drawFieldLines() {
    ctx.save();
    const lineAlpha =
      state.scene === "tip"
        ? 0.54 + visualState.fieldLineAlpha * 0.36
        : 0.34 + visualState.fieldLineAlpha * 0.42;
    ctx.globalAlpha = lineAlpha;
    ctx.strokeStyle = "rgba(31, 97, 125, 0.55)";
    ctx.lineWidth = state.scene === "tip" ? 2.45 : 1.65;
    ctx.lineCap = "round";
    drawBemFieldLines();
    ctx.restore();
  }

  function drawLightningFocusGlow() {
    ctx.save();
    const tip = lightningLayout.needle.tip;
    const grad = ctx.createRadialGradient(
      sx(tip.x),
      sy(tip.y),
      4,
      sx(tip.x),
      sy(tip.y),
      sx(0.16),
    );
    grad.addColorStop(0, "rgba(185, 66, 74, 0.22)");
    grad.addColorStop(0.45, "rgba(185, 66, 74, 0.09)");
    grad.addColorStop(1, "rgba(185, 66, 74, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx(tip.x), sy(tip.y), sx(0.16), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLightningIllustrationFieldLines() {
    const reverseArrows = state.chargeSign < 0;
    ctx.save();
    ctx.lineCap = "round";
    getRodBemSolution().groups.forEach((group) => {
      ctx.globalAlpha = group.kind === "needle" ? 0.96 : 0.84;
      ctx.strokeStyle =
        group.kind === "needle"
          ? "rgba(31, 97, 125, 0.72)"
          : "rgba(31, 97, 125, 0.54)";
      ctx.lineWidth = group.kind === "needle" ? 2.35 : 1.9;
      makeRodFieldSeeds(group).forEach((seed) => {
        drawSmoothFieldPath(traceRodFieldPath(seed, group), reverseArrows);
      });
    });
    ctx.restore();
  }

  function makeRodFieldSeeds(group) {
    return group.seeds.map((t) => ({
      x: group.plate.x + group.plate.w * t,
      plateY: group.plate.y + group.plate.h,
      y: group.plate.y + group.plate.h + 0.016,
    }));
  }

  function traceRodFieldPath(seed, group) {
    let point = { ...seed };
    const path = [
      { x: seed.x, y: seed.plateY + 0.002 },
      { x: seed.x, y: seed.y },
    ];
    const minX = group.plate.x - 0.075;
    const maxX = group.plate.x + group.plate.w + 0.075;
    for (let step = 0; step < 280; step += 1) {
      const field = rodFieldAt(point, group);
      const mag = Math.hypot(field.x, field.y);
      if (!Number.isFinite(mag) || mag < 1e-6) break;
      const phys = toPhys(point);
      const next = fromPhys({
        x: phys.x + (field.x / mag) * 0.0038,
        y: phys.y + (field.y / mag) * 0.0038,
      });
      if (next.x < minX || next.x > maxX || next.y < 0.08 || next.y > 0.94)
        break;
      if (isInRodGroupConductor(next, group)) break;
      path.push(next);
      point = next;
    }
    return path;
  }

  function drawSmoothFieldPath(path, reverseArrow = false) {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(sx(path[0].x), sy(path[0].y));
    for (let i = 1; i < path.length - 1; i += 1) {
      const mid = {
        x: (path[i].x + path[i + 1].x) / 2,
        y: (path[i].y + path[i + 1].y) / 2,
      };
      ctx.quadraticCurveTo(sx(path[i].x), sy(path[i].y), sx(mid.x), sy(mid.y));
    }
    const last = path[path.length - 1];
    ctx.lineTo(sx(last.x), sy(last.y));
    ctx.stroke();
    const arrowIndex = Math.min(28, path.length - 1);
    if (arrowIndex < 1) return;
    const arrowPoint = path[arrowIndex];
    const before = path[arrowIndex - 1];
    const arrowAngle = Math.atan2(
      sy(arrowPoint.y) - sy(before.y),
      sx(arrowPoint.x) - sx(before.x),
    );
    drawArrowhead(
      arrowPoint.x,
      arrowPoint.y,
      arrowAngle + (reverseArrow ? Math.PI : 0),
    );
  }

  function drawBemFieldLines() {
    const solution = getBemSolution();
    const lineSolution = makeLineSolution(solution);
    const reverseArrows = fieldDirectionSign(solution) < 0;
    if (state.scene === "charged") {
      drawUniformCircularExteriorFieldLines(0.56, 0.5, 0.2, reverseArrows);
      return;
    }
    if (state.scene === "cavity") {
      drawCavityInteriorFieldLines(lineSolution, reverseArrows);
      drawUniformCircularExteriorFieldLines(0.56, 0.5, 0.24, reverseArrows);
      return;
    }
    const seeds = makeFieldSeeds(lineSolution);
    if (hasAxisymmetricBoundarySeeds() && solution.sources.length) {
      drawSymmetricFieldPaths(seeds, lineSolution, reverseArrows);
    } else {
      seeds.forEach((seed) =>
        traceFieldLine(seed.point, lineSolution, seed.direction, reverseArrows),
      );
    }
  }

  function drawUniformCircularExteriorFieldLines(cx, cy, r, reverseArrows) {
    const count = Math.round(
      30 * clamp(0.75 + state.chargeMagnitude * 0.25, 0.8, 1.25),
    );
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      drawFieldPath(makeRadialExteriorPath(cx, cy, r, angle), reverseArrows);
    }
  }

  function makeRadialExteriorPath(cx, cy, r, angle) {
    const path = [];
    const originX = sx(cx);
    const originY = sy(cy);
    const startRadius = sx(r) + 24;
    const maxRadius = Math.max(canvas.width, canvas.height) * 0.9;
    for (
      let pixelRadius = startRadius;
      pixelRadius <= maxRadius;
      pixelRadius += 15
    ) {
      const point = {
        x: (originX + Math.cos(angle) * pixelRadius) / canvas.width,
        y: (originY + Math.sin(angle) * pixelRadius) / canvas.height,
      };
      if (point.x < 0.01 || point.x > 0.99 || point.y < 0.02 || point.y > 0.98)
        break;
      path.push(point);
    }
    return path;
  }

  function drawCavityInteriorFieldLines(solution, reverseArrows) {
    const source = solution.sources[0];
    if (!source) return;
    const count = Math.round(
      12 * clamp(0.75 + state.chargeMagnitude * 0.25, 0.8, 1.25),
    );
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const seed = pointFromPixelVector(source, angle, 20);
      traceFieldLine(seed, solution, 1, reverseArrows);
    }
  }

  function drawSymmetricFieldPaths(seeds, solution, reverseArrows) {
    const axis = pixelAngle(0.56, 0.5, state.charge);
    const epsilon = 0.0008;
    seeds.forEach((seed) => {
      const side = sideOfAxis(seed.point, axis);
      if (side < -epsilon) return;
      const path = traceFieldPath(seed.point, solution, seed.direction);
      if (side <= epsilon) {
        drawFieldPath(
          path.map((point) => projectOntoAxis(point, axis)),
          reverseArrows,
        );
      } else {
        drawFieldPath(path, reverseArrows);
        drawFieldPath(
          path.map((point) => reflectAcrossAxis(point, axis)),
          reverseArrows,
        );
      }
    });
  }

  function makeLineSolution(solution) {
    const sign = fieldDirectionSign(solution);
    if (sign > 0) return solution;
    return {
      ...solution,
      sources: solution.sources.map((source) => ({
        ...source,
        q: source.q * sign,
      })),
      charges: solution.charges.map((charge) => charge * sign),
    };
  }

  function fieldDirectionSign(solution) {
    if (solution.sources.length) return solution.sources[0].q < 0 ? -1 : 1;
    return solution.netCharge < 0 ? -1 : 1;
  }

  function makeFieldSeeds(solution) {
    const seeds = [];
    const source = solution.sources[0] || { q: 0 };
    const positiveBoundaryFlux = solution.charges.reduce(
      (sum, charge) => sum + Math.max(0, charge),
      0,
    );
    const sourceFlux = Math.max(0, source.q);
    const fluxTotal = sourceFlux + positiveBoundaryFlux;
    const baseLineBudget = state.dragging
      ? fieldLineConfig.maxLinesDragging
      : fieldLineConfig.maxLines;
    const sceneBoost = state.scene === "tip" ? 1.55 : 1;
    const lineBudget = Math.round(
      baseLineBudget *
        sceneBoost *
        clamp(0.65 + state.chargeMagnitude * 0.35, 0.7, 1.35),
    );
    const sourceSeedCount =
      sourceFlux > 0
        ? clamp(
            Math.round(
              (sourceFlux / Math.max(fluxTotal, sourceFlux)) * lineBudget,
            ),
            fieldLineConfig.minSourceLines,
            fieldLineConfig.maxSourceLines,
          )
        : 0;
    if (source.q > 0) {
      for (let i = 0; i < sourceSeedCount; i += 1) {
        const angle = (Math.PI * 2 * i) / sourceSeedCount;
        seeds.push({
          point: pointFromPixelVector(source, angle, 28),
          direction: 1,
        });
      }
    }

    const boundaryBudget = Math.min(
      fieldLineConfig.maxBoundaryLines,
      Math.max(0, lineBudget - seeds.length),
    );
    seeds.push(...makeBoundaryFluxSeeds(solution, boundaryBudget));

    return seeds.slice(0, lineBudget);
  }

  function makeBoundaryFluxSeeds(solution, budget) {
    if (budget <= 0) return [];
    if (hasAxisymmetricBoundarySeeds())
      return makeSymmetricBoundaryFluxSeeds(solution, budget);
    const entries = solution.boundaries
      .map((boundary, index) => ({
        boundary,
        flux: Math.max(0, solution.charges[index]),
      }))
      .filter((entry) => entry.flux > 0)
      .sort((a, b) => a.boundary.order - b.boundary.order);
    const totalFlux = entries.reduce((sum, entry) => sum + entry.flux, 0);
    if (totalFlux <= 0 || !entries.length) return [];
    const seeds = [];
    let cursor = 0;
    let accumulated = entries[0].flux;
    for (let i = 0; i < budget; i += 1) {
      const target = ((i + 0.5) / budget) * totalFlux;
      while (cursor < entries.length - 1 && accumulated < target) {
        cursor += 1;
        accumulated += entries[cursor].flux;
      }
      seeds.push({
        point: offsetBoundaryPoint(entries[cursor].boundary, 0.022),
        direction: 1,
      });
    }
    return seeds;
  }

  function hasAxisymmetricBoundarySeeds() {
    return ["solid", "shield", "cavity"].includes(state.scene);
  }

  function makeSymmetricBoundaryFluxSeeds(solution, budget) {
    const center = { x: 0.56, y: 0.5 };
    const axisAngle = pixelAngle(center.x, center.y, state.charge);
    const roles = ["outer", "inner"]
      .map((role) => makeSymmetricRoleSeedPlan(solution, role, axisAngle))
      .filter((plan) => plan && plan.flux > 0)
      .sort((a, b) => b.flux - a.flux);
    if (!roles.length) return [];
    const seeds = [];
    let remaining = budget;
    const totalFlux = roles.reduce((sum, role) => sum + role.flux, 0);
    roles.forEach((role, index) => {
      const target =
        index === roles.length - 1
          ? remaining
          : Math.max(0, Math.round((role.flux / totalFlux) * budget));
      const count = Math.min(remaining, target);
      seeds.push(...makeSymmetricRoleSeeds(role, count));
      remaining = budget - seeds.length;
    });
    return seeds
      .sort(
        (a, b) =>
          angularDistance(pixelAngle(0.56, 0.5, a.point), axisAngle) -
          angularDistance(pixelAngle(0.56, 0.5, b.point), axisAngle),
      )
      .slice(0, budget);
  }

  function makeSymmetricRoleSeedPlan(solution, role, axisAngle) {
    const entries = solution.boundaries
      .map((boundary, index) => ({
        boundary,
        index,
        flux: Math.max(0, solution.charges[index]),
      }))
      .filter((entry) => entry.boundary.role === role && entry.flux > 0);
    if (!entries.length) return null;
    const flux = entries.reduce((sum, entry) => sum + entry.flux, 0);
    const strongest = entries.reduce(
      (best, entry) => (entry.flux > best.flux ? entry : best),
      entries[0],
    );
    const oppositeAxis = normalizeAngle(axisAngle + Math.PI);
    const centerAngle =
      angularDistance(strongest.boundary.angle, axisAngle) <=
      angularDistance(strongest.boundary.angle, oppositeAxis)
        ? axisAngle
        : oppositeAxis;
    return {
      role,
      flux,
      centerAngle,
      template: entries[0].boundary,
    };
  }

  function makeSymmetricRoleSeeds(plan, requestedCount) {
    if (requestedCount <= 0) return [];
    const seeds = [makeBoundarySeedAtAngle(plan.template, plan.centerAngle)];
    const pairCount = Math.floor((requestedCount - 1) / 2);
    const spread = Math.PI * 0.62;
    for (let i = 1; i <= pairCount; i += 1) {
      const delta = (spread * i) / (pairCount + 0.5);
      seeds.push(
        makeBoundarySeedAtAngle(plan.template, plan.centerAngle + delta),
      );
      seeds.push(
        makeBoundarySeedAtAngle(plan.template, plan.centerAngle - delta),
      );
    }
    return seeds;
  }

  function makeBoundarySeedAtAngle(boundary, angle) {
    const outward = boundary.role === "outer" ? 1 : -1;
    const offset = boundary.role === "outer" ? 0.02 : -0.014;
    return {
      point: circlePoint(boundary.cx, boundary.cy, boundary.r, angle, offset),
      direction: outward,
    };
  }

  function offsetBoundaryPoint(boundary, offset) {
    if (
      boundary.cx !== undefined &&
      boundary.r !== undefined &&
      boundary.angle !== undefined
    ) {
      const signedOffset = boundary.role === "inner" ? -offset : offset;
      return circlePoint(
        boundary.cx,
        boundary.cy,
        boundary.r,
        boundary.angle,
        signedOffset,
      );
    }
    const p = toPhys(boundary);
    return fromPhys({
      x: p.x + boundary.nx * offset,
      y: p.y + boundary.ny * offset,
    });
  }

  function normalizeAngle(angle) {
    const full = Math.PI * 2;
    return ((angle % full) + full) % full;
  }

  function angularDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(diff, Math.PI * 2 - diff);
  }

  function traceFieldLine(seed, solution, direction, reverseArrow = false) {
    drawFieldPath(traceFieldPath(seed, solution, direction), reverseArrow);
  }

  function traceFieldPath(seed, solution, direction) {
    let point = { ...seed };
    const path = [point];
    let last = point;
    for (let step = 0; step < 260; step += 1) {
      const field = fieldAt(point, solution);
      const mag = Math.hypot(field.x, field.y);
      if (!Number.isFinite(mag) || mag < 1e-5) break;
      const ux = (field.x / mag) * direction;
      const uy = (field.y / mag) * direction;
      const phys = toPhys(point);
      const nextPhys = { x: phys.x + ux * 0.0048, y: phys.y + uy * 0.0048 };
      const next = fromPhys(nextPhys);
      if (next.x < 0.01 || next.x > 0.99 || next.y < 0.02 || next.y > 0.98)
        break;
      if (isInConductor(next, solution)) break;
      path.push(next);
      last = next;
      point = next;
      if (
        solution.sources.some((source) => physDistance(point, source) < 0.018)
      )
        break;
    }
    return path;
  }

  function drawFieldPath(path, reverseArrow = false) {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(sx(path[0].x), sy(path[0].y));
    for (let i = 1; i < path.length; i += 1) {
      ctx.lineTo(sx(path[i].x), sy(path[i].y));
    }
    ctx.stroke();
    const arrowIndex = Math.min(28, path.length - 1);
    if (arrowIndex < 1) return;
    const arrowPoint = path[arrowIndex];
    const before = path[arrowIndex - 1];
    const arrowAngle = Math.atan2(
      sy(arrowPoint.y) - sy(before.y),
      sx(arrowPoint.x) - sx(before.x),
    );
    drawArrowhead(
      arrowPoint.x,
      arrowPoint.y,
      arrowAngle + (reverseArrow ? Math.PI : 0),
    );
  }

  function sideOfAxis(point, axisAngle) {
    const origin = { x: sx(0.56), y: sy(0.5) };
    const px = sx(point.x) - origin.x;
    const py = sy(point.y) - origin.y;
    return Math.cos(axisAngle) * py - Math.sin(axisAngle) * px;
  }

  function reflectAcrossAxis(point, axisAngle) {
    const origin = { x: sx(0.56), y: sy(0.5) };
    const px = sx(point.x) - origin.x;
    const py = sy(point.y) - origin.y;
    const ux = Math.cos(axisAngle);
    const uy = Math.sin(axisAngle);
    const projection = px * ux + py * uy;
    const rx = 2 * projection * ux - px;
    const ry = 2 * projection * uy - py;
    return {
      x: (origin.x + rx) / canvas.width,
      y: (origin.y + ry) / canvas.height,
    };
  }

  function projectOntoAxis(point, axisAngle) {
    const origin = { x: sx(0.56), y: sy(0.5) };
    const px = sx(point.x) - origin.x;
    const py = sy(point.y) - origin.y;
    const ux = Math.cos(axisAngle);
    const uy = Math.sin(axisAngle);
    const projection = px * ux + py * uy;
    return {
      x: (origin.x + projection * ux) / canvas.width,
      y: (origin.y + projection * uy) / canvas.height,
    };
  }

  function drawArrowhead(x, y, angle) {
    const size = 9;
    ctx.save();
    ctx.translate(sx(x), sy(y));
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.55, -size * 0.55);
    ctx.lineTo(-size * 0.55, size * 0.55);
    ctx.closePath();
    ctx.fillStyle = "rgba(33, 101, 126, 0.52)";
    ctx.fill();
    ctx.restore();
  }

  function drawLabels() {
    if (state.prediction) {
      drawBadge(0.5, 0.1, "预测：先判断电荷分布与 E=0 区域", "#7a4b00");
      return;
    }
    if (state.scene === "solid") {
      drawBadge(0.56, 0.5, "导体内部 E = 0", "#334155");
    } else if (state.scene === "charged") {
      drawBadge(0.56, 0.5, "球内 E = 0", "#334155");
      drawBadge(0.56, 0.25, "表面电荷均匀分布", "#334155");
    } else if (state.scene === "shield") {
      drawBadge(0.56, 0.5, "空腔内不受外部静电场影响", "#334155");
      drawBadge(0.56, 0.29, "外表面重新分布", "#334155");
    } else if (state.scene === "cavity") {
      drawBadge(0.56, 0.28, "导体材料内部 E = 0", "#334155");
      drawBadge(0.56, 0.69, "内表面：异号感应电荷", "#334155");
    } else if (state.scene === "tip") {
      drawBadge(0.76, 0.42, "尖端附近电场更强", "#334155");
      drawBadge(0.5, 0.68, "同一导体表面电荷不均匀", "#334155");
    } else if (state.scene === "rod") {
      drawSmallBadge(0.34, 0.35, "金属球", "#334155");
      drawSmallBadge(0.775, 0.35, "尖端", "#334155");
      drawSmallBadge(0.34, 0.22, "独立板", "#334155");
      drawSmallBadge(0.72, 0.22, "独立板", "#334155");
    } else if (state.scene === "dumbbell") {
      drawBadge(0.31, 0.42, "左侧外凸面", "#334155");
      drawBadge(0.74, 0.42, "右侧外凸面", "#334155");
      drawBadge(0.55, 0.66, "相连等势整体", "#334155");
    }
  }

  function drawBadge(x, y, text, color) {
    ctx.save();
    ctx.font = "700 24px sans-serif";
    const paddingX = 14;
    const metrics = ctx.measureText(text);
    const w = metrics.width + paddingX * 2;
    const h = 42;
    const px = sx(x) - w / 2;
    const py = sy(y) - h / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.strokeStyle = "rgba(139, 152, 162, 0.42)";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, w, h);
    ctx.strokeRect(px, py, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, sx(x), sy(y) + 1);
    ctx.restore();
  }

  function drawSmallBadge(x, y, text, color) {
    ctx.save();
    ctx.font = "700 18px sans-serif";
    const paddingX = 10;
    const metrics = ctx.measureText(text);
    const w = metrics.width + paddingX * 2;
    const h = 32;
    const px = sx(x) - w / 2;
    const py = sy(y) - h / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.strokeStyle = "rgba(139, 152, 162, 0.32)";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, w, h);
    ctx.strokeRect(px, py, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, sx(x), sy(y) + 1);
    ctx.restore();
  }

  function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function isNearCharge(point) {
    if (!hasPointCharge()) return false;
    const dx = point.x - state.charge.x;
    const dy = point.y - state.charge.y;
    return Math.hypot(dx, dy) < 0.055;
  }

  function hasPointCharge() {
    return (
      state.scene === "solid" ||
      state.scene === "shield" ||
      state.scene === "cavity"
    );
  }

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (paused || !isNearCharge(pointerToCanvas(event))) return;
      state.dragging = true;
      canvas.setPointerCapture(event.pointerId);
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!state.dragging || paused) return;
      state.charge = constrainCharge(pointerToCanvas(event));
      requestDraw();
    },
    { signal: events.signal },
  );
  const stopDrag = () => {
    state.dragging = false;
    requestDraw();
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(type, stopDrag, { signal: events.signal });
  draw();
  return {
    updateState(next) {
      if (next.scene !== state.scene) model.setScene(next.scene);
      Object.assign(state, next);
      if (paused) draw();
      else requestDraw();
    },
    reset(next) {
      model.setScene(next.scene);
      Object.assign(state, next);
      visualState.scene = "";
      paused = false;
      requestDraw();
    },
    setPaused(value) {
      paused = value;
      state.dragging = false;
      if (paused) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else requestDraw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      events.abort();
    },
  };
}
