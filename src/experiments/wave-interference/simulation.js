export function mountWaveInterference(root) {
  const controller = new AbortController();
  const { signal } = controller;
  let animationFrame = 0;
  let resizeFrame = 0;
  const $ = (id) => root.querySelector("#" + id);
  const TAU = Math.PI * 2;
  const COLORS = {
    wave1: "#ff5d5d",
    wave2: "#147d92",
    sum: "#6f47d8",
    ink: "#17233d",
    muted: "#7f8aa0",
    grid: "#e9edf4",
  };
  const state = {
    mode: "1d",
    t: 0,
    playing: false,
    lastStamp: 0,
    playbackRate: 1,
    v: 2.4,
    f1: 1.2,
    f2: 1.2,
    a1: 0.7,
    a2: 0.7,
    phase: 0,
    distance: 5,
    observerX: 0,
    observerY: 0,
    showSum: true,
    showFront: true,
    showRings: true,
    showNodes: true,
    showAntinodes: true,
    showGrid: true,
    mainWave1: true,
    mainWave2: true,
    showField: false,
    entered2D: false,
    trace1: true,
    trace2: true,
    traceSum: true,
    pointMode: "free",
    curveDelta: null,
    step: 1 / 30,
    maxTime: 20,
    sourceHalf1D: 6,
  };

  const mainCanvas = $("mainCanvas");
  const ctx = mainCanvas.getContext("2d");
  const traceCanvas = $("traceCanvas");
  const tctx = traceCanvas.getContext("2d");
  let dragObserver = false;
  const fieldCanvas = document.createElement("canvas");
  const fieldCtx = fieldCanvas.getContext("2d", { alpha: false });
  let lastFieldRender = -1;

  function dprCanvas(canvas, context) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height, dpr };
  }

  const lambda1 = () => state.v / state.f1;
  const lambda2 = () => state.v / state.f2;
  const sourceX1 = () =>
    state.mode === "1d" ? -state.sourceHalf1D : -state.distance / 2;
  const sourceX2 = () =>
    state.mode === "1d" ? state.sourceHalf1D : state.distance / 2;
  const wave = (A, f, r, t, phase = 0) =>
    A * Math.sin(TAU * f * (t - r / state.v) + phase);
  const wavesAt1D = (x, time) => {
    const r1 = Math.max(0, x - sourceX1());
    const r2 = Math.max(0, sourceX2() - x);
    const in1 = x >= sourceX1() && r1 <= state.v * time;
    const in2 = x <= sourceX2() && r2 <= state.v * time;
    const y1 = in1 ? wave(state.a1, state.f1, r1, time, 0) : 0;
    const y2 = in2 ? wave(state.a2, state.f2, r2, time, state.phase) : 0;
    return { y1, y2, sum: y1 + y2, r1, r2, in1, in2 };
  };
  const wavesAt2D = (x, y, time) => {
    const r1 = Math.hypot(x - sourceX1(), y);
    const r2 = Math.hypot(x - sourceX2(), y);
    const in1 = r1 <= state.v * time,
      in2 = r2 <= state.v * time;
    const y1 = in1 ? wave(state.a1, state.f1, r1, time, 0) : 0;
    const y2 = in2 ? wave(state.a2, state.f2, r2, time, state.phase) : 0;
    return { y1, y2, sum: y1 + y2, r1, r2, in1, in2 };
  };
  const observerAt = (time) =>
    state.mode === "1d"
      ? wavesAt1D(state.observerX, time)
      : wavesAt2D(state.observerX, state.observerY, time);
  const roundPoint = (value) => Math.round(value * 100) / 100;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // r₂ − r₁ = δ. The zero-order locus is the perpendicular bisector;
  // all nondegenerate loci have x²/a² − y²/b² = 1, c = d/2.
  function hyperbolaX(delta, y) {
    if (Math.abs(delta) < 1e-9) return 0;
    const a = Math.abs(delta) / 2,
      c = state.distance / 2,
      b2 = c * c - a * a;
    if (b2 <= 1e-10) return null;
    return -Math.sign(delta) * a * Math.sqrt(1 + (y * y) / b2);
  }

  function loci(kind) {
    if (Math.abs(state.f1 - state.f2) > 0.001) return [];
    const offset = kind === "destructive" ? 0.5 : 0,
      out = [],
      lam = lambda1(),
      p = state.phase / TAU;
    const nmin = Math.ceil(-state.distance / lam - p - offset + 1e-8);
    const nmax = Math.floor(state.distance / lam - p - offset - 1e-8);
    for (let n = nmin; n <= nmax; n++)
      out.push({ n, delta: (n + offset + p) * lam, kind });
    return out;
  }

  function rebuildCurveOptions() {
    const stable = Math.abs(state.f1 - state.f2) < 0.001;
    if (!stable) {
      state.pointMode = "free";
      $("pointMode").value = "free";
    }
    for (const option of $("pointMode").options)
      option.disabled = option.value !== "free" && !stable;
    const curves = loci(state.pointMode),
      select = $("curveSelect"),
      previous = state.curveDelta;
    select.replaceChildren();
    if (state.pointMode === "free") {
      select.disabled = true;
      state.curveDelta = null;
    } else if (!curves.length) {
      state.pointMode = "free";
      $("pointMode").value = "free";
      select.disabled = true;
      state.curveDelta = null;
    } else {
      curves.forEach((curve) => {
        const option = document.createElement("option");
        option.value = curve.delta;
        option.textContent = `n = ${curve.n} · Δr = ${curve.delta.toFixed(2)} m`;
        select.append(option);
      });
      state.curveDelta = curves.reduce((best, c) =>
        Math.abs(c.delta - (previous ?? 0)) <
        Math.abs(best.delta - (previous ?? 0))
          ? c
          : best,
      ).delta;
      select.value = state.curveDelta;
      select.disabled = false;
    }
    $("pointX").disabled = state.mode === "2d" && state.pointMode !== "free";
    $("curveLegend").textContent = stable
      ? `绿色实线：加强线 · 紫色虚线：减弱线。${state.phase === 0 ? "同相时 Δr = nλ 与 (n + ½)λ。" : "已按初相位差平移：Δr / λ − φ₂ / 2π = n 或 n + ½。"}轨迹为理论位置，波到达后形成干涉。`
      : "频率不同：无固定的加强、减弱双曲线。请改为同频以沿曲线选点。";
    constrainObserver();
  }

  function constrainObserver() {
    const rect = mainCanvas.getBoundingClientRect();
    const map = world2D(rect.width, rect.height);
    if (state.mode === "1d") {
      state.observerX = clamp(
        roundPoint(state.observerX),
        sourceX1(),
        sourceX2(),
      );
      state.observerY = 0;
    } else {
      state.observerY = clamp(roundPoint(state.observerY), map.ymin, map.ymax);
      if (state.pointMode !== "free" && state.curveDelta !== null) {
        const a = Math.abs(state.curveDelta) / 2,
          b2 = (state.distance * state.distance) / 4 - a * a;
        const maxY =
          a < 1e-9
            ? map.ymax
            : Math.min(
                map.ymax,
                Math.sqrt(
                  Math.max(0, b2 * ((map.xmax * map.xmax) / (a * a) - 1)),
                ),
              );
        state.observerY = roundPoint(
          clamp(
            state.observerY,
            -Math.floor(maxY * 100) / 100,
            Math.floor(maxY * 100) / 100,
          ),
        );
        state.observerX = hyperbolaX(state.curveDelta, state.observerY) ?? 0;
      } else
        state.observerX = roundPoint(
          clamp(state.observerX, map.xmin, map.xmax),
        );
    }
    $("pointX").value = state.observerX.toFixed(2);
    $("pointY").value = state.observerY.toFixed(2);
    $("pointX").min = state.mode === "1d" ? sourceX1() : map.xmin;
    $("pointX").max = state.mode === "1d" ? sourceX2() : map.xmax;
    $("pointY").min = map.ymin;
    $("pointY").max = map.ymax;
  }

  function setTime(v) {
    state.t = Math.max(0, Math.min(state.maxTime, v));
    $("timeSlider").value = state.t;
    $("timeOut").textContent = state.t.toFixed(2) + " s";
    lastFieldRender = -1;
    renderAll();
  }

  function setPlaying(value) {
    if (value && state.t >= state.maxTime) setTime(0);
    state.playing = value;
    $("playIcon").textContent = value ? "❚❚" : "▶";
    $("playText").textContent = value ? "暂停" : "播放";
    $("playBtn").setAttribute("aria-label", value ? "暂停" : "播放");
    state.lastStamp = performance.now();
    cancelAnimationFrame(animationFrame);
    if (value) animationFrame = requestAnimationFrame(animate);
  }

  function syncControls() {
    state.v = +$("speed").value;
    state.f1 = +$("f1").value;
    state.f2 = +$("f2").value;
    state.a1 = +$("a1").value;
    state.a2 = +$("a2").value;
    state.phase = (+$("phase").value * Math.PI) / 180;
    state.distance = +$("distance").value;
    state.showSum = $("showSum").checked;
    state.showFront = $("showFront").checked;
    state.showRings = $("showRings").checked;
    state.showNodes = $("showNodes").checked;
    state.showAntinodes = $("showAntinodes").checked;
    state.showGrid = $("showGrid").checked;
    state.mainWave1 = $("mainWave1").checked;
    state.mainWave2 = $("mainWave2").checked;
    state.showField = $("showField").checked;
    $("speedOut").textContent = state.v.toFixed(2) + " m/s";
    $("f1Out").textContent = state.f1.toFixed(2) + " Hz";
    $("f2Out").textContent = state.f2.toFixed(2) + " Hz";
    $("a1Out").textContent = state.a1.toFixed(2);
    $("a2Out").textContent = state.a2.toFixed(2);
    $("phaseOut").textContent = Math.round((state.phase * 180) / Math.PI) + "°";
    $("distanceOut").textContent = state.distance.toFixed(1) + " m";
    $("lambda1").textContent = "λ₁ = " + lambda1().toFixed(2) + " m";
    $("lambda2").textContent = "λ₂ = " + lambda2().toFixed(2) + " m";
    $("sumLegend").style.opacity = state.showSum ? "1" : ".32";
    lastFieldRender = -1;
    rebuildCurveOptions();
    updatePedagogy();
    renderAll();
  }

  function updatePedagogy() {
    const df = Math.abs(state.f1 - state.f2);
    const stable = df < 0.001;
    const card = $("conditionCard");
    card.classList.toggle("unstable", !stable);
    $("conditionBadge").textContent = stable ? "可以" : "不能稳定";
    $("conditionExplain").textContent = stable
      ? "f₁ = f₂，相位差不随时间改变。空间中振动始终加强或减弱的位置固定。"
      : "f₁ ≠ f₂：两列波仍遵循叠加原理，但相位差随时间改变，强弱区域不断移动，不能形成稳定干涉图样。";
    $("freqDiff").textContent = df.toFixed(2) + " Hz";
    $("beatPeriod").textContent = df < 0.001 ? "—" : (1 / df).toFixed(2) + " s";
  }

  function world1D(w, h) {
    const margin = w * 0.065,
      xmin = -7,
      xmax = 7;
    return {
      margin,
      xmin,
      xmax,
      xToPx: (x) => margin + ((x - xmin) / (xmax - xmin)) * (w - 2 * margin),
      pxToX: (px) => xmin + ((px - margin) / (w - 2 * margin)) * (xmax - xmin),
    };
  }

  function drawGrid1D(w, h, map, baseline, scale) {
    if (!state.showGrid) return;
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    for (let x = Math.ceil(map.xmin); x <= map.xmax; x++) {
      const px = map.xToPx(x);
      ctx.beginPath();
      ctx.moveTo(px, 34);
      ctx.lineTo(px, h - 25);
      ctx.stroke();
      if (x % 2 === 0) {
        ctx.fillText(x + " m", px, h - 9);
      }
    }
    [baseline - scale, baseline, baseline + scale].forEach((y, i) => {
      ctx.beginPath();
      ctx.moveTo(map.margin, y);
      ctx.lineTo(w - map.margin, y);
      ctx.stroke();
      if (i !== 1) ctx.fillText(i === 0 ? "+1" : "−1", 25, y + 3);
    });
    ctx.restore();
  }

  function pathCurve(
    fn,
    xmin,
    xmax,
    map,
    base,
    scale,
    color,
    width = 2.5,
    dash = [],
  ) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 600; i++) {
      const x = xmin + ((xmax - xmin) * i) / 600,
        y = fn(x);
      if (y === null || !Number.isFinite(y)) {
        started = false;
        continue;
      }
      const px = map.xToPx(x),
        py = base - y * scale;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 8 * Math.cos(a - 0.45), y2 - 8 * Math.sin(a - 0.45));
    ctx.lineTo(x2 - 8 * Math.cos(a + 0.45), y2 - 8 * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw1D(w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, w, h);
    const map = world1D(w, h),
      base = h * 0.52,
      scale = h * 0.17;
    drawGrid1D(w, h, map, base, scale);
    ctx.strokeStyle = "#8c98ad";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(map.margin, base);
    ctx.lineTo(w - map.margin, base);
    ctx.stroke();
    drawArrow(map.xToPx(-5.65), 53, map.xToPx(-4.65), 53, COLORS.wave1);
    drawArrow(map.xToPx(5.65), 53, map.xToPx(4.65), 53, COLORS.wave2);
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.wave1;
    ctx.fillText("向右传播", map.xToPx(-5.15), 41);
    ctx.fillStyle = COLORS.wave2;
    ctx.fillText("向左传播", map.xToPx(5.15), 41);
    const front1 = sourceX1() + state.v * state.t,
      front2 = sourceX2() - state.v * state.t;
    const f1x = Math.min(sourceX2(), front1),
      f2x = Math.max(sourceX1(), front2);
    if (state.mainWave1)
      pathCurve(
        (x) =>
          x >= sourceX1() && x <= f1x
            ? wave(state.a1, state.f1, x - sourceX1(), state.t)
            : null,
        map.xmin,
        map.xmax,
        map,
        base,
        scale,
        COLORS.wave1,
        2.5,
      );
    if (state.mainWave2)
      pathCurve(
        (x) =>
          x <= sourceX2() && x >= f2x
            ? wave(state.a2, state.f2, sourceX2() - x, state.t, state.phase)
            : null,
        map.xmin,
        map.xmax,
        map,
        base,
        scale,
        COLORS.wave2,
        2.5,
      );
    if (state.showSum) {
      pathCurve(
        (x) => {
          const q = wavesAt1D(x, state.t, true);
          return x >= sourceX1() && x <= sourceX2() && (x <= f1x || x >= f2x)
            ? q.sum
            : null;
        },
        map.xmin,
        map.xmax,
        map,
        base,
        scale,
        COLORS.sum,
        4,
      );
    }
    if (state.showFront) {
      [front1, front2].forEach((x, i) => {
        if (x >= map.xmin && x <= map.xmax) {
          const px = map.xToPx(x);
          ctx.save();
          ctx.strokeStyle = i ? COLORS.wave2 : COLORS.wave1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(px, 80);
          ctx.lineTo(px, h - 38);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "10px system-ui";
          ctx.fillText("波前", px, 72);
          ctx.restore();
        }
      });
    }
    [
      [sourceX1(), COLORS.wave1, "S₁"],
      [sourceX2(), COLORS.wave2, "S₂"],
    ].forEach(([x, c, label]) => {
      const px = map.xToPx(x);
      ctx.fillStyle = "white";
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, base, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = "800 12px system-ui";
      ctx.fillText(label, px, base + 26);
    });
    const obs = wavesAt1D(state.observerX, state.t, true),
      opx = map.xToPx(state.observerX),
      opy = base - (state.showSum ? obs.sum : 0) * scale;
    ctx.save();
    ctx.strokeStyle = "#17233d";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(opx, 70);
    ctx.lineTo(opx, h - 28);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#17233d";
    ctx.beginPath();
    ctx.arc(opx, opy, 6, 0, TAU);
    ctx.fill();
    ctx.font = "800 12px system-ui";
    ctx.fillText("P", opx + 13, opy - 10);
    ctx.restore();
  }

  function world2D(w, h) {
    const aspect = w / h,
      yr = 6.5,
      xr = yr * aspect;
    return {
      xmin: -xr,
      xmax: xr,
      ymin: -yr,
      ymax: yr,
      xToPx: (x) => ((x + xr) / (2 * xr)) * w,
      yToPx: (y) => ((yr - y) / (2 * yr)) * h,
      pxToX: (px) => (px / w) * 2 * xr - xr,
      pxToY: (py) => yr - (py / h) * 2 * yr,
    };
  }

  function draw2DField(w, h, map) {
    const fw = Math.max(220, Math.round(w / 3)),
      fh = Math.max(150, Math.round(h / 3));
    if (fieldCanvas.width !== fw || fieldCanvas.height !== fh) {
      fieldCanvas.width = fw;
      fieldCanvas.height = fh;
      lastFieldRender = -1;
    }
    const renderKey =
      state.t +
      "|" +
      [
        state.v,
        state.f1,
        state.f2,
        state.a1,
        state.a2,
        state.phase,
        state.distance,
        w,
        h,
      ].join("|");
    if (lastFieldRender !== renderKey) {
      const image = fieldCtx.createImageData(fw, fh),
        data = image.data;
      const maxA = Math.max(0.2, state.a1 + state.a2);
      for (let py = 0; py < fh; py++)
        for (let px = 0; px < fw; px++) {
          const x = map.xmin + ((px + 0.5) / fw) * (map.xmax - map.xmin),
            y = map.ymax - ((py + 0.5) / fh) * (map.ymax - map.ymin);
          const q = wavesAt2D(x, y, state.t),
            z = Math.max(-1, Math.min(1, q.sum / maxA));
          const amp = Math.abs(z),
            positive = z >= 0;
          const base = 248 - amp * 28;
          const r = positive ? base + amp * 6 : base - amp * 35,
            g = positive ? base - amp * 48 : base - amp * 2,
            b = positive ? base - amp * 40 : base + amp * 7;
          const idx = (py * fw + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      fieldCtx.putImageData(image, 0, 0);
      lastFieldRender = renderKey;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, 0, 0, w, h);
  }

  function drawGrid2D(w, h, map) {
    if (!state.showGrid) return;
    ctx.save();
    ctx.strokeStyle = "rgba(80,100,130,.12)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(50,65,90,.65)";
    ctx.font = "9px system-ui";
    for (let x = Math.ceil(map.xmin); x <= map.xmax; x++) {
      const px = map.xToPx(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      if (x % 2 === 0) ctx.fillText(x + "", px + 3, map.yToPx(0) - 5);
    }
    for (let y = Math.ceil(map.ymin); y <= map.ymax; y++) {
      const py = map.yToPx(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(23,35,61,.35)";
    ctx.beginPath();
    ctx.moveTo(0, map.yToPx(0));
    ctx.lineTo(w, map.yToPx(0));
    ctx.stroke();
    ctx.restore();
  }

  function drawRings(w, h, map) {
    if (!state.showRings) return;
    const maxR = Math.min(
        state.v * state.t,
        Math.hypot(map.xmax - map.xmin, map.ymax - map.ymin),
      ),
      sources = [
        [sourceX1(), COLORS.wave1, lambda1(), 0],
        [sourceX2(), COLORS.wave2, lambda2(), state.phase],
      ];
    sources.forEach(([sx, color, lam, phase], sourceIndex) => {
      if (sourceIndex === 0 ? !state.mainWave1 : !state.mainWave2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.4;
      // sin(ωt − kr + φ) = +1 at a crest, −1 at a trough.
      [0.25, 0.75].forEach((fraction, index) => {
        const shift =
          (((state.v * state.t + (phase / TAU - fraction) * lam) % lam) + lam) %
          lam;
        ctx.setLineDash(index ? [4, 5] : []);
        for (let r = shift; r <= maxR; r += lam) {
          if (r < 0.001) continue;
          const rx = map.xToPx(sx + r) - map.xToPx(sx),
            ry = map.yToPx(0) - map.yToPx(r);
          ctx.beginPath();
          ctx.ellipse(map.xToPx(sx), map.yToPx(0), rx, ry, 0, 0, TAU);
          ctx.stroke();
        }
      });
      if (state.showFront && state.t > 0) {
        ctx.setLineDash([2, 3]);
        ctx.globalAlpha = 0.24;
        ctx.beginPath();
        ctx.arc(
          map.xToPx(sx),
          map.yToPx(0),
          (state.v * state.t * w) / (map.xmax - map.xmin),
          0,
          TAU,
        );
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawNodeContours(w, h, map) {
    if (Math.abs(state.f1 - state.f2) > 0.001) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    for (const kind of ["constructive", "destructive"]) {
      if (kind === "constructive" ? !state.showAntinodes : !state.showNodes)
        continue;
      for (const curve of loci(kind)) {
        const selected =
          state.pointMode === kind &&
          Math.abs(state.curveDelta - curve.delta) < 1e-8;
        ctx.strokeStyle = kind === "constructive" ? "#13896c" : "#7650bc";
        ctx.lineWidth = selected ? 2.5 : 1.2;
        ctx.setLineDash(kind === "destructive" ? [6, 4] : []);
        ctx.beginPath();
        // Analytic continuous paths sampled at subpixel vertical intervals.
        for (let j = 0; j <= Math.ceil(h * 2); j++) {
          const py = (j / Math.ceil(h * 2)) * h,
            y = map.pxToY(py),
            x = hyperbolaX(curve.delta, y);
          const px = map.xToPx(x);
          j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        const labelY = map.ymax * 0.62,
          labelX = hyperbolaX(curve.delta, labelY),
          px = map.xToPx(labelX),
          py = map.yToPx(labelY);
        if (px > 20 && px < w - 35) {
          ctx.setLineDash([]);
          ctx.font = "10px system-ui";
          ctx.fillStyle = "rgba(255,255,255,.88)";
          ctx.fillRect(px + 3, py - 10, 36, 14);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillText(`n=${curve.n}`, px + 5, py);
        }
      }
    }
    ctx.restore();
  }

  function draw2D(w, h) {
    const map = world2D(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, w, h);
    if (state.showField) draw2DField(w, h, map);
    drawGrid2D(w, h, map);
    drawRings(w, h, map);
    drawNodeContours(w, h, map);
    [
      [sourceX1(), COLORS.wave1, "S₁"],
      [sourceX2(), COLORS.wave2, "S₂"],
    ].forEach(([x, c, label]) => {
      const px = map.xToPx(x),
        py = map.yToPx(0);
      ctx.fillStyle = "white";
      ctx.strokeStyle = c;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = "800 12px system-ui";
      ctx.fillText(label, px + 13, py - 12);
    });
    const opx = map.xToPx(state.observerX),
      opy = map.yToPx(state.observerY);
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    [
      [sourceX1(), COLORS.wave1],
      [sourceX2(), COLORS.wave2],
    ].forEach(([x, c]) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(map.xToPx(x), map.yToPx(0));
      ctx.lineTo(opx, opy);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = "#17233d";
    ctx.lineWidth = 2;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(opx, opy, 7, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#17233d";
    ctx.beginPath();
    ctx.arc(opx, opy, 2.5, 0, TAU);
    ctx.fill();
    ctx.font = "800 12px system-ui";
    ctx.fillText("P", opx + 11, opy - 10);
    ctx.restore();
  }

  function drawTrace() {
    const { w, h } = dprCanvas(traceCanvas, tctx);
    tctx.clearRect(0, 0, w, h);
    tctx.fillStyle = "#fbfdff";
    tctx.fillRect(0, 0, w, h);
    const pad = { l: 35, r: 16, t: 16, b: 25 },
      innerW = w - pad.l - pad.r,
      innerH = h - pad.t - pad.b,
      maxA = Math.max(1.2, (state.a1 + state.a2) * 1.12);
    const tx = (t) => pad.l + (t / state.maxTime) * innerW,
      ty = (y) => pad.t + innerH / 2 - (y / maxA) * (innerH * 0.45);
    tctx.strokeStyle = COLORS.grid;
    tctx.lineWidth = 1;
    tctx.fillStyle = COLORS.muted;
    tctx.font = "9px system-ui";
    const tick = w < 450 ? 5 : 2;
    for (let time = 0; time <= state.maxTime; time += tick) {
      const x = tx(time);
      tctx.beginPath();
      tctx.moveTo(x, pad.t);
      tctx.lineTo(x, h - pad.b);
      tctx.stroke();
      tctx.fillText(time + "s", x - 7, h - 7);
    }
    for (const y of [-1, 0, 1]) {
      tctx.beginPath();
      tctx.moveTo(pad.l, ty(y));
      tctx.lineTo(w - pad.r, ty(y));
      tctx.stroke();
      tctx.fillText(y.toFixed(0), 9, ty(y) + 3);
    }
    tctx.beginPath();
    tctx.moveTo(pad.l, ty(0));
    tctx.lineTo(w - pad.r, ty(0));
    tctx.stroke();
    const q = observerAt(state.t),
      arrival1 = q.r1 / state.v,
      arrival2 = q.r2 / state.v;
    const enabled1 = state.a1 > 0,
      enabled2 = state.a2 > 0;
    const firstArrival = Math.min(
      enabled1 ? arrival1 : Infinity,
      enabled2 ? arrival2 : Infinity,
    );
    const curves = [
      {
        key: "y1",
        color: COLORS.wave1,
        lw: 1.7,
        show: state.trace1 && enabled1,
        start: arrival1,
      },
      {
        key: "y2",
        color: COLORS.wave2,
        lw: 1.7,
        show: state.trace2 && enabled2,
        start: arrival2,
      },
      {
        key: "sum",
        color: COLORS.sum,
        lw: 2.7,
        show: state.traceSum,
        start: firstArrival,
      },
    ];
    tctx.save();
    tctx.beginPath();
    tctx.rect(pad.l, pad.t, innerW, innerH);
    tctx.clip();
    for (const curve of curves) {
      if (!curve.show || state.t <= curve.start) continue;
      // Sample only causal history; never draw future oscillations or a
      // pre-arrival zero segment. Split when the second front arrives.
      const breaks = [
        curve.start,
        ...(curve.key === "sum"
          ? [arrival1, arrival2].filter((t) => t > curve.start && t < state.t)
          : []),
        state.t,
      ].sort((a, b) => a - b);
      for (let segment = 1; segment < breaks.length; segment++) {
        const a = breaks[segment - 1],
          b = breaks[segment],
          steps = Math.max(
            2,
            Math.ceil((b - a) * Math.max(state.f1, state.f2) * 90),
          );
        tctx.beginPath();
        tctx.strokeStyle = curve.color;
        tctx.lineWidth = curve.lw;
        for (let i = 0; i <= steps; i++) {
          const tt = a + ((b - a) * i) / steps,
            val = observerAt(
              i === steps && segment < breaks.length - 1 ? tt - 1e-9 : tt,
            )[curve.key];
          i ? tctx.lineTo(tx(tt), ty(val)) : tctx.moveTo(tx(tt), ty(val));
        }
        tctx.stroke();
      }
    }
    tctx.restore();
    [
      [arrival1, COLORS.wave1, "S₁"],
      [arrival2, COLORS.wave2, "S₂"],
    ].forEach(([at, color, label], i) => {
      if (at <= state.maxTime) {
        tctx.strokeStyle = color;
        tctx.globalAlpha = 0.5;
        tctx.setLineDash([2, 4]);
        tctx.beginPath();
        tctx.moveTo(tx(at), pad.t);
        tctx.lineTo(tx(at), h - pad.b);
        tctx.stroke();
        tctx.globalAlpha = 1;
        tctx.setLineDash([]);
        tctx.fillStyle = color;
        tctx.fillText(label, tx(at) + 3, pad.t + 9 + i * 12);
      }
    });
    const nowX = tx(state.t);
    tctx.strokeStyle = COLORS.ink;
    tctx.setLineDash([3, 3]);
    tctx.beginPath();
    tctx.moveTo(nowX, pad.t);
    tctx.lineTo(nowX, h - pad.b);
    tctx.stroke();
    tctx.setLineDash([]);
  }

  function updateAnalysis() {
    const q = observerAt(state.t);
    const position = `P (${state.observerX.toFixed(2)}, ${state.observerY.toFixed(2)}) m`;
    $("pointLabel").textContent = position + " · 从 t = 0 开始记录";
    $("pointSummary").textContent =
      position +
      (state.mode === "2d" && state.pointMode !== "free"
        ? " · 沿曲线用 y 调节，步长 0.01 m；x 由双曲线精确计算，显示两位小数。"
        : " · 坐标精度 0.01 m");
    const arrival = `S₁ 到达：${(q.r1 / state.v).toFixed(2)} s；S₂ 到达：${(q.r2 / state.v).toFixed(2)} s。`;
    const has1 = q.in1 && state.a1 > 0,
      has2 = q.in2 && state.a2 > 0;
    $("arrivalNote").textContent =
      arrival +
      (!has1 && !has2
        ? "波尚未到达，曲线留空。"
        : has1 && has2
          ? "两列波均已到达，合位移按 y₁ + y₂ 记录。"
          : "目前仅一列波到达，P 已起振；此时合位移等于已到达波的位移。");
    const delta = q.r2 - q.r1,
      df = Math.abs(state.f1 - state.f2);
    $("pathDiff").textContent =
      (delta >= 0 ? "+" : "") + delta.toFixed(2) + " m";
    if (!has1 || !has2) {
      $("pointVerdict").textContent =
        has1 || has2 ? "只有一列波到达 P" : "P 尚未起振";
      $("verdictText").textContent =
        arrival +
        (has1 || has2
          ? "单列波已使 P 振动；另一列波到达后，此处才开始发生双波叠加。"
          : "当前只显示坐标轴和到达时刻，不预画尚未发生的振动。");
      return;
    }
    if (df > 0.001) {
      $("pointVerdict").textContent = "强弱随时间交替";
      $("verdictText").textContent =
        `两列波频率不同，P 点的相位差持续变化；振幅包络以 ${df.toFixed(2)} Hz 的拍频起伏。这里仍有叠加，但没有固定的加强或减弱位置。`;
      return;
    }
    const phase = (TAU * state.f1 * (q.r2 - q.r1)) / state.v - state.phase;
    const coherence = Math.cos(phase),
      equalAmp = Math.abs(state.a1 - state.a2) < 0.04;
    if (coherence > 0.7) {
      $("pointVerdict").textContent = "接近振动加强点";
      $("verdictText").textContent =
        `相位差接近 2nπ，两列波在此大多同向振动。${equalAmp ? "同幅时最大合振幅可达 2A。" : "因振幅不同，最大合振幅为 A₁ + A₂。"}`;
    } else if (coherence < -0.7) {
      $("pointVerdict").textContent = "接近振动减弱点";
      $("verdictText").textContent =
        `相位差接近 (2n+1)π，两列波在此大多反向振动。${equalAmp ? "同幅时可完全相消。" : "振幅不等，只能部分相消，最小合振幅为 |A₁ − A₂|。"}`;
    } else {
      $("pointVerdict").textContent = "介于加强与减弱之间";
      $("verdictText").textContent =
        `该处相位差约为 ${(((((phase % TAU) + TAU) % TAU) * 180) / Math.PI).toFixed(0)}°，合振幅介于最大值与最小值之间。改变 P 的位置，观察路程差如何改变相位差。`;
    }
  }

  function renderAll() {
    const { w, h } = dprCanvas(mainCanvas, ctx);
    state.mode === "1d" ? draw1D(w, h) : draw2D(w, h);
    drawTrace();
    updateAnalysis();
  }

  function modeSwitch(mode) {
    if (mode === "2d" && !state.entered2D) {
      state.entered2D = true;
      for (const id of [
        "showNodes",
        "showAntinodes",
        "showGrid",
        "showFront",
        "showField",
      ])
        $(id).checked = false;
      for (const id of ["showRings", "mainWave1", "mainWave2"])
        $(id).checked = true;
    }
    state.mode = mode;
    root.classList.toggle("mode-2d", mode === "2d");
    for (const tab of root.querySelectorAll(".tab")) {
      const selected = tab.dataset.mode === mode;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    }
    $("heroTitle").textContent =
      mode === "1d"
        ? "两列波相遇后，各自去哪了？"
        : "为什么水面上会出现固定的“安静线”？";
    $("heroText").textContent =
      mode === "1d"
        ? "拖动观察点，比较红、青两列波与紫色合成波。波只是暂时叠加；相遇后仍保持各自的频率、振幅与传播方向。"
        : "两个点波源向外发出同心圆波。实线表示波峰、虚线表示波谷；同频时，固定的路程差让加强区与减弱区稳定下来。";
    $("canvasHint").textContent =
      mode === "1d"
        ? "单击或拖动横轴，选择观察点 P"
        : "在平面内自由选点，或选择沿加强 / 减弱双曲线移动";
    $("formulaChip").textContent =
      mode === "1d" ? "y = y₁ + y₂　·　v = λf" : "Δr = r₂ − r₁　·　v = λf";
    state.observerX = 0;
    state.observerY = 0;
    lastFieldRender = -1;
    syncControls();
  }

  function canvasPointer(e) {
    const rect = mainCanvas.getBoundingClientRect(),
      px = e.clientX - rect.left,
      py = e.clientY - rect.top;
    if (state.mode === "1d") {
      const map = world1D(rect.width, rect.height);
      state.observerX = map.pxToX(px);
    } else {
      const map = world2D(rect.width, rect.height);
      state.observerX = map.pxToX(px);
      state.observerY = map.pxToY(py);
      // Close to a visible locus, use its exact equation instead of the
      // imprecise screen pixel. Subsequent dragging follows that locus.
      if (
        state.pointMode === "free" &&
        ["pointerdown", "dblclick"].includes(e.type) &&
        Math.abs(state.f1 - state.f2) < 0.001
      ) {
        let best = null,
          dist = 10;
        for (const curve of [
          ...(state.showAntinodes ? loci("constructive") : []),
          ...(state.showNodes ? loci("destructive") : []),
        ]) {
          const x = hyperbolaX(curve.delta, state.observerY),
            d = Math.abs(map.xToPx(x) - px);
          if (d < dist) {
            best = curve;
            dist = d;
          }
        }
        if (best) {
          state.pointMode = best.kind;
          state.curveDelta = best.delta;
          $("pointMode").value = best.kind;
          rebuildCurveOptions();
        }
      }
    }
    constrainObserver();
    renderAll();
  }

  function redraw() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      lastFieldRender = -1;
      constrainObserver();
      renderAll();
    });
  }

  function setupSplitters() {
    const grid = $("labGrid"),
      right = $("rightColumn");
    function bind(id, vertical, min, max, initial) {
      const bar = $(id);
      let active = false,
        value = initial;
      const apply = (next) => {
        value = clamp(next, min, max);
        grid.style.setProperty(
          vertical ? "--left-share" : "--trace-share",
          value + "%",
        );
        bar.setAttribute("aria-valuenow", Math.round(value));
        redraw();
      };
      bar.addEventListener("pointerdown", (e) => {
        active = true;
        bar.setPointerCapture(e.pointerId);
        root.classList.add("resizing");
      });
      bar.addEventListener("pointermove", (e) => {
        if (!active) return;
        const r = (vertical ? grid : right).getBoundingClientRect();
        apply(
          vertical
            ? ((e.clientX - r.left - 8) / r.width) * 100
            : ((e.clientY - r.top - 8) / r.height) * 100,
        );
      });
      const end = () => {
        active = false;
        root.classList.remove("resizing");
      };
      bar.addEventListener("pointerup", end);
      bar.addEventListener("pointercancel", end);
      bar.addEventListener("lostpointercapture", end);
      bar.addEventListener("keydown", (e) => {
        const sign = ["ArrowLeft", "ArrowUp"].includes(e.code)
          ? -1
          : ["ArrowRight", "ArrowDown"].includes(e.code)
            ? 1
            : 0;
        if (sign) {
          e.preventDefault();
          e.stopPropagation();
          apply(value + sign * 2);
        }
      });
      bar.addEventListener("dblclick", () => apply(initial));
    }
    bind("columnSplitter", true, 30, 72, 59);
    bind("rowSplitter", false, 29, 74, 44);
    const stageBar = $("stageHeightHandle");
    let stageDrag = null;
    stageBar.addEventListener("pointerdown", (e) => {
      stageDrag = {
        y: e.clientY,
        h: mainCanvas.getBoundingClientRect().height,
      };
      stageBar.setPointerCapture(e.pointerId);
      root.classList.add("resizing");
    });
    stageBar.addEventListener("pointermove", (e) => {
      if (!stageDrag) return;
      mainCanvas.style.height =
        clamp(stageDrag.h + e.clientY - stageDrag.y, 240, 1000) + "px";
      redraw();
    });
    const stopStageDrag = () => {
      stageDrag = null;
      root.classList.remove("resizing");
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      stageBar.addEventListener(event, stopStageDrag);
    stageBar.addEventListener("dblclick", () => {
      mainCanvas.style.height = "";
      redraw();
    });
    stageBar.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        mainCanvas.style.height =
          clamp(
            mainCanvas.getBoundingClientRect().height +
              (e.code === "ArrowDown" ? 20 : -20),
            240,
            1000,
          ) + "px";
        redraw();
      }
    });
    const heightBar = $("consoleHeightHandle");
    let heightStart = null;
    const changeConsoleHeight = (height, traceHeight) => {
      grid.style.setProperty("--trace-share", traceHeight + "px");
      right.style.height = clamp(height, traceHeight + 212, 1600) + "px";
      redraw();
    };
    heightBar.addEventListener("pointerdown", (e) => {
      heightStart = {
        y: e.clientY,
        h: right.getBoundingClientRect().height,
        trace: root.querySelector(".trace-panel").getBoundingClientRect()
          .height,
      };
      heightBar.setPointerCapture(e.pointerId);
      root.classList.add("resizing");
    });
    heightBar.addEventListener("pointermove", (e) => {
      if (!heightStart) return;
      changeConsoleHeight(
        heightStart.h + e.clientY - heightStart.y,
        heightStart.trace,
      );
    });
    const stopHeight = () => {
      heightStart = null;
      root.classList.remove("resizing");
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      heightBar.addEventListener(event, stopHeight);
    heightBar.addEventListener("dblclick", () => {
      right.style.height = "";
      grid.style.setProperty("--trace-share", "44%");
      redraw();
    });
    heightBar.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        changeConsoleHeight(
          right.getBoundingClientRect().height +
            (e.code === "ArrowDown" ? 20 : -20),
          root.querySelector(".trace-panel").getBoundingClientRect().height,
        );
      }
    });
  }

  function applyPreset(name) {
    const set = (id, v) => {
      $(id).value = v;
    };
    if (name === "stable") {
      set("f1", 1.2);
      set("f2", 1.2);
      set("a1", 0.7);
      set("a2", 0.7);
      set("phase", 0);
    }
    if (name === "beat") {
      set("f1", 1.1);
      set("f2", 1.35);
      set("a1", 0.7);
      set("a2", 0.7);
      set("phase", 0);
    }
    if (name === "unequal") {
      set("f1", 1.2);
      set("f2", 1.2);
      set("a1", 0.9);
      set("a2", 0.35);
      set("phase", 0);
    }
    if (name === "antiphase") {
      set("f1", 1.2);
      set("f2", 1.2);
      set("a1", 0.7);
      set("a2", 0.7);
      set("phase", 180);
    }
    syncControls();
  }

  root
    .querySelectorAll(".tab")
    .forEach((tab) =>
      tab.addEventListener("click", () => modeSwitch(tab.dataset.mode)),
    );
  [
    "speed",
    "f1",
    "f2",
    "a1",
    "a2",
    "phase",
    "distance",
    "showSum",
    "showFront",
    "showRings",
    "showNodes",
    "showAntinodes",
    "showGrid",
  ].forEach((id) => $(id).addEventListener("input", syncControls));
  ["mainWave1", "mainWave2", "showField"].forEach((id) =>
    $(id).addEventListener("change", syncControls),
  );
  ["trace1", "trace2", "traceSum"].forEach((id) =>
    $(id).addEventListener("change", () => {
      state[id] = $(id).checked;
      drawTrace();
    }),
  );
  ["pointX", "pointY"].forEach((id) =>
    $(id).addEventListener("change", () => {
      if ($(id).value === "" || !Number.isFinite($(id).valueAsNumber)) return;
      state[id === "pointX" ? "observerX" : "observerY"] = $(id).valueAsNumber;
      constrainObserver();
      renderAll();
    }),
  );
  $("pointMode").addEventListener("change", () => {
    state.pointMode = $("pointMode").value;
    state.curveDelta = null;
    rebuildCurveOptions();
    renderAll();
  });
  $("curveSelect").addEventListener("change", () => {
    state.curveDelta = +$("curveSelect").value;
    constrainObserver();
    renderAll();
  });
  root
    .querySelectorAll(".preset")
    .forEach((b) =>
      b.addEventListener("click", () => applyPreset(b.dataset.preset)),
    );
  $("playBtn").addEventListener("click", () => setPlaying(!state.playing));
  $("playbackRate").addEventListener("change", () => {
    state.playbackRate = +$("playbackRate").value;
    state.lastStamp = performance.now();
  });
  $("stepForward").addEventListener("click", () => {
    setPlaying(false);
    setTime(state.t + state.step);
  });
  $("stepBack").addEventListener("click", () => {
    setPlaying(false);
    setTime(state.t - state.step);
  });
  $("resetBtn").addEventListener("click", () => {
    setPlaying(false);
    setTime(0);
  });
  $("timeSlider").addEventListener("input", (e) => {
    setPlaying(false);
    setTime(+e.target.value);
  });
  mainCanvas.addEventListener("pointerdown", (e) => {
    dragObserver = true;
    mainCanvas.setPointerCapture(e.pointerId);
    canvasPointer(e);
  });
  mainCanvas.addEventListener("pointermove", (e) => {
    if (dragObserver) canvasPointer(e);
  });
  mainCanvas.addEventListener("pointerup", () => (dragObserver = false));
  mainCanvas.addEventListener("dblclick", (e) => {
    state.pointMode = "free";
    state.curveDelta = null;
    $("pointMode").value = "free";
    rebuildCurveOptions();
    canvasPointer(e);
  });
  mainCanvas.addEventListener("pointercancel", () => (dragObserver = false));
  mainCanvas.addEventListener(
    "lostpointercapture",
    () => (dragObserver = false),
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          'input, select, textarea, [contenteditable], [role="separator"]',
        )
      )
        return;
      if (event.code === "Space" && !target?.closest("button, a, summary")) {
        event.preventDefault();
        if (!event.repeat) setPlaying(!state.playing);
      }
      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setTime(
          state.t + (event.code === "ArrowRight" ? state.step : -state.step),
        );
      }
    },
    { signal },
  );

  function animate(stamp) {
    const elapsed = Math.min(0.05, (stamp - state.lastStamp) / 1000);
    state.lastStamp = stamp;
    setTime(state.t + elapsed * state.playbackRate);
    if (state.t >= state.maxTime) setPlaying(false);
    else animationFrame = requestAnimationFrame(animate);
  }

  setupSplitters();
  modeSwitch("1d");
  const observer = new ResizeObserver(redraw);
  observer.observe($("rightColumn"));
  observer.observe(mainCanvas);
  observer.observe(traceCanvas);
  window.addEventListener("resize", redraw, { signal });

  return {
    pause: () => setPlaying(false),
    dispose() {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(animationFrame);
    },
  };
}
