export function mountMechanicalWaves(root) {
  const controller = new AbortController();
  const { signal } = controller;
  const get = (id) => root.querySelector("#" + id);
  const canvas = get("simulation");
  const ctx = canvas.getContext("2d");
  const TAU = 2 * Math.PI;
  const FRAME_STEP = 1 / 12;
  const GRAPH_T0 = 40 / 12;
  const GRAPH_OMEGA = TAU / GRAPH_T0;
  const DAMPING = 0.07 * GRAPH_OMEGA;
  const DAMPED_OMEGA = Math.sqrt(GRAPH_OMEGA ** 2 - DAMPING ** 2);
  const MIX_LENGTH = 12;
  const MIX_SPEED = 3;
  const PULSE_TIME = 1.1;
  const INK = {
    text: "#d9e9ed",
    muted: "#9fb8c1",
    line: "#597985",
    pale: "#a6bdc4",
    mint: "#73e2c6",
    blue: "#91c6ff",
    violet: "#c4b3fc",
    amber: "#ffd18b",
    coral: "#ffa4a5",
  };

  const range = (
    key,
    label,
    symbol,
    min,
    max,
    step,
    initial,
    unit,
    digits = 0,
  ) => ({ key, label, symbol, min, max, step, initial, unit, digits });
  const option = (key, label, initial, color) => ({
    key,
    label,
    initial,
    color,
  });

  const graphAmplitude = range(
    "amplitude",
    "振幅",
    "A",
    0,
    12,
    0.5,
    6,
    "cm",
    1,
  );
  const wavePeriod = range("period", "周期", "T", 2, 6, 0.1, 4, "s", 1);
  const phases = [
    ["in-phase", "同相叠加"],
    ["opposite", "反相叠加"],
    ["standing", "驻波演示"],
    ["mixed", "不同频率"],
  ];

  const demos = {
    spring: {
      title: "弹簧振子",
      description: "观察水平弹簧振子的运动及各物理量的方向。",
      alt: "水平弹簧、振子与平衡位置 O。两侧的 A、B 为最大位移处。",
      params: [
        range("amplitude", "振幅", "A", 0, 18, 0.5, 9, "cm", 1),
        range("stiffness", "劲度系数", "k", 2, 20, 1, 10, "N/m"),
        range("mass", "振子质量", "m", 0.3, 0.5, 0.01, 0.4, "kg", 2),
      ],
      options: [
        option("displacement", "位移", true, INK.mint),
        option("velocity", "速度", false, INK.blue),
        option("acceleration", "加速度", false, INK.violet),
        option("force", "回复力", false, INK.coral),
      ],
      metric: [
        "周期 T",
        (s) => seconds(TAU * Math.sqrt(s.params.mass / s.params.stiffness)),
      ],
      tip: "在无摩擦、弹簧满足胡克定律的模型中，改动质量或劲度系数，比较周期；勾选箭头，观察它们经过平衡位置前后的方向。",
      formula:
        "<var>T</var> = 2π√(<var>m</var>/<var>k</var>)，<var>F</var> = −<var>kx</var>",
    },
    pendulum: {
      title: "单摆",
      description: "调节摆长、初始摆角、摆球质量和重力加速度。",
      alt: "摆线下的摆球沿圆弧振动，虚线标出竖直的平衡位置。",
      params: [
        range("length", "摆长", "L", 0.96, 1.2, 0.01, 1.2, "m", 2),
        range("angle", "初始摆角", "θ₀", 0, 30, 0.5, 15, "°", 1),
        range("mass", "摆球质量", "m", 0.2, 0.5, 0.01, 0.35, "kg", 2),
        range("gravity", "重力加速度", "g", 4, 10, 0.1, 9.8, "m/s²", 1),
      ],
      options: [
        option("velocity", "速度", false, INK.blue),
        option("tension", "拉力", false, INK.mint),
        option("gravity", "重力及分力", false, INK.coral),
      ],
      metric: ["周期 T", (s) => seconds(s.pendulum.period)],
      tip: "理想单摆从静止释放。演示按实际摆角计算，摆角较小时可用近似式。试着改变摆球质量，比较不同设置下的周期。",
      formula: "<var>T</var> ≈ 2π√(<var>L</var>/<var>g</var>)",
    },
    harmonic: {
      title: "简谐振动图像",
      description: "跟随绘图点，观察振子的位移如何随时间变化。",
      alt: "左侧振子上下运动。右侧绘图点随时间向右，描出位移随时间变化的余弦曲线。",
      params: [graphAmplitude],
      options: [option("periodMark", "周期标记", true, INK.amber)],
      metric: ["周期 T", () => seconds(GRAPH_T0)],
      tip: "绘图点匀速向右，纵坐标与振子的即时位移相同。比较相邻两个波峰的时间间隔，再改变振幅。",
      formula:
        "<var>x</var>(<var>t</var>) = <var>A</var> cos(2π<var>t</var>/<var>T</var>)",
    },
    damped: {
      title: "阻尼振动图像",
      description: "观察欠阻尼振动及随时间衰减的振幅。",
      alt: "左侧振子的运动幅度逐渐减小。右侧的振动曲线被两条指数包络线夹在中间。",
      params: [graphAmplitude],
      options: [
        option("periodMark", "周期标记", false, INK.amber),
        option("envelope", "振幅包络", true, INK.blue),
      ],
      metric: ["阻尼周期 T", () => seconds(TAU / DAMPED_OMEGA)],
      tip: "本演示采用指数衰减的欠阻尼模型。虚线包络给出各时刻位移大小的上限。可同时打开周期标记，比较相邻两次振动。",
      formula:
        "<var>x</var>(<var>t</var>) = <var>A</var>e<sup>−<var>βt</var></sup> cos(<var>ω</var><sub>d</sub><var>t</var>)",
    },
    transverse: {
      title: "横波",
      description: "切换波的传播方向，观察质点与波前的运动。",
      alt: "横波从选定的一端向前传播，质点沿垂直于传播方向的直线往复运动。",
      params: [
        range("amplitude", "振幅", "A", 1, 4, 0.1, 1, "cm", 1),
        wavePeriod,
        range("speed", "波速", "v", 1, 5, 0.1, 2, "m/s", 1),
      ],
      metric: ["波长 λ", (s) => metres(s.params.period * s.params.speed)],
      tip: "跟踪高亮质点 P。质点沿竖直方向振动，波前沿水平方向传播。增大周期或波速，比较图中相邻波峰的间距。",
      formula: "<var>λ</var> = <var>vT</var>",
    },
    longitudinal: {
      title: "纵波",
      description: "观察质点沿传播方向振动，以及密部和疏部的移动。",
      alt: "一列质点水平往复振动，形成向右传播的密部与疏部。",
      params: [
        range("amplitude", "振幅", "A", 0.8, 1.2, 0.05, 1, "cm", 2),
        range("period", "周期", "T", 1, 6, 0.1, 4, "s", 1),
        range("speed", "波速", "v", 1, 2, 0.1, 2, "m/s", 1),
      ],
      options: [option("amplitudeGuide", "显示振幅", false, INK.amber)],
      metric: ["波长 λ", (s) => metres(s.params.period * s.params.speed)],
      tip: "相邻的密部之间相距一个波长。质点位移在图中放大显示。打开振幅标记，观察质点 P 在平衡位置两侧往复运动。",
      formula: "<var>λ</var> = <var>vT</var>",
    },
    superposition: {
      title: "波的叠加",
      description: "比较两列波各自的位移与它们叠加后的波形。",
      alt: "三行曲线分别展示向右传播的 A 波、向左传播的 B 波及两列波的合位移。",
      params: [
        range("amplitudeA", "A 波振幅", "Aₐ", 0, 6, 0.1, 3, "cm", 1),
        range("amplitudeB", "B 波振幅", "Aᵦ", 0, 6, 0.1, 3, "cm", 1),
      ],
      formula:
        "<var>y</var> = <var>y</var><sub>A</sub> + <var>y</var><sub>B</sub>",
    },
  };

  const mixTips = {
    "in-phase":
      "两端发出的脉冲都向上偏移。播放到两峰相遇时暂停，比较两列波各自的位移和合位移。",
    opposite:
      "一个脉冲向上偏移，另一个向下偏移。让两列波振幅相等，观察波峰与波谷重合时的合位移。",
    standing:
      "相同频率和振幅的两列波反向传播。观察合成曲线上的波节，它们始终位于平衡位置。",
    mixed:
      "两端持续发出频率不同的波，A 波的频率是 B 波的三倍。观察合成波形随时间的变化。",
  };

  function seconds(value) {
    return value.toFixed(2) + " s";
  }
  function metres(value) {
    return Number(value.toFixed(2)) + " m";
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function freshState(id) {
    const def = demos[id];
    const params = Object.fromEntries(
      def.params.map((p) => [p.key, p.initial]),
    );
    return {
      time: 0,
      params,
      options: Object.fromEntries(
        (def.options || []).map((o) => [o.key, o.initial]),
      ),
      direction: 1,
      mix: "in-phase",
      mixParams:
        id === "superposition"
          ? { pulse: params, mixed: { amplitudeA: 2, amplitudeB: 5 } }
          : null,
      pendulum: null,
    };
  }

  const states = Object.fromEntries(
    Object.keys(demos).map((id) => [id, freshState(id)]),
  );
  let active = "spring";
  let state = states[active];
  let playing = false;
  let lastFrame = 0;
  let animationFrame = 0;
  let width = 0;
  let height = 0;

  function graphPeriod(id) {
    return id === "damped" ? TAU / DAMPED_OMEGA : GRAPH_T0;
  }
  function timeLimit() {
    if (active === "harmonic" || active === "damped")
      return 7 * graphPeriod(active);
    if (
      active === "superposition" &&
      ["in-phase", "opposite"].includes(state.mix)
    ) {
      return MIX_LENGTH / MIX_SPEED + PULSE_TIME;
    }
    return Infinity;
  }

  function pendulumProfile({ length, angle, gravity }) {
    const startAngle = (angle * Math.PI) / 180;
    const acceleration = gravity / length;
    // T uses the complete elliptic integral, computed by the arithmetic–geometric mean.
    let arithmetic = 1;
    let geometric = Math.cos(startAngle / 2);
    while (arithmetic - geometric > 1e-12) {
      [arithmetic, geometric] = [
        (arithmetic + geometric) / 2,
        Math.sqrt(arithmetic * geometric),
      ];
    }
    const period = TAU / (Math.sqrt(acceleration) * arithmetic);
    const samples = 512;
    const step = period / samples;
    const angles = new Float64Array(samples + 1);
    const rates = new Float64Array(samples + 1);
    const derivative = (theta) => -acceleration * Math.sin(theta);
    let theta = startAngle;
    let rate = 0;
    for (let i = 0; i < samples; i++) {
      angles[i] = theta;
      rates[i] = rate;
      const k1 = derivative(theta);
      const r2 = rate + (step * k1) / 2;
      const k2 = derivative(theta + (step * rate) / 2);
      const r3 = rate + (step * k2) / 2;
      const k3 = derivative(theta + (step * r2) / 2);
      const r4 = rate + step * k3;
      const k4 = derivative(theta + step * r3);
      theta += (step * (rate + 2 * r2 + 2 * r3 + r4)) / 6;
      rate += (step * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    }
    angles[samples] = startAngle;
    return { period, step, angles, rates };
  }

  function getPendulumMotion(t) {
    const profile = state.pendulum;
    const position = (t % profile.period) / profile.step;
    const i = Math.min(Math.floor(position), profile.angles.length - 2);
    const part = position - i;
    const lerp = (values) => values[i] + part * (values[i + 1] - values[i]);
    return [lerp(profile.angles), lerp(profile.rates)];
  }

  function currentParams() {
    if (active === "superposition" && state.mix === "standing") {
      return [
        { ...demos.superposition.params[0], label: "两列波振幅", symbol: "A" },
      ];
    }
    return demos[active].params;
  }

  function valueLabel(value, { unit, digits }) {
    return value.toFixed(digits) + (unit === "°" ? "" : " ") + unit;
  }

  function parameterControl(p) {
    const id = "param-" + p.key;
    const value = state.params[p.key];
    return (
      '<div class="control"><div class="control-head"><label for="' +
      id +
      '">' +
      p.label +
      " <var>" +
      p.symbol +
      '</var></label><output id="read-' +
      p.key +
      '" for="' +
      id +
      '">' +
      valueLabel(value, p) +
      '</output></div><input type="range" id="' +
      id +
      '" min="' +
      p.min +
      '" max="' +
      p.max +
      '" step="' +
      p.step +
      '" value="' +
      value +
      '" aria-valuetext="' +
      valueLabel(value, p) +
      '"></div>'
    );
  }

  function selectControl(name, label, choices, current) {
    return (
      "<fieldset><legend>" +
      label +
      '</legend><div class="segments">' +
      choices
        .map(
          ([value, title]) =>
            '<label><input type="radio" name="' +
            name +
            '" value="' +
            value +
            '"' +
            (value === current ? " checked" : "") +
            "><span>" +
            title +
            "</span></label>",
        )
        .join("") +
      "</div></fieldset>"
    );
  }

  function refreshParameters() {
    const params = currentParams();
    get("parameters").innerHTML =
      "<fieldset><legend>物理参量</legend>" +
      params.map(parameterControl).join("") +
      "</fieldset>";
    for (const p of params) {
      get("param-" + p.key).addEventListener("input", (event) => {
        const input = event.currentTarget;
        const value = Number(input.value);
        state.params[p.key] = value;
        const label = valueLabel(value, p);
        get("read-" + p.key).textContent = label;
        input.setAttribute("aria-valuetext", label);
        updateModel();
      });
    }
  }

  function refreshSettings() {
    const selectors = get("selectors");
    if (active === "transverse") {
      selectors.innerHTML = selectControl(
        "direction",
        "传播方向",
        [
          [-1, "向左"],
          [1, "向右"],
        ],
        state.direction,
      );
    } else if (active === "superposition") {
      selectors.innerHTML = selectControl("mix", "叠加方式", phases, state.mix);
    } else {
      selectors.replaceChildren();
    }
    refreshParameters();

    const options = demos[active].options || [];
    get("display-options").innerHTML = options.length
      ? '<fieldset class="checks"><legend>图中显示</legend><div class="check-list">' +
        options
          .map(
            (item) =>
              '<label><input type="checkbox" data-option="' +
              item.key +
              '"' +
              (state.options[item.key] ? " checked" : "") +
              '><span class="swatch" aria-hidden="true" style="background:' +
              item.color +
              '"></span>' +
              item.label +
              "</label>",
          )
          .join("") +
        "</div></fieldset>"
      : "";
  }

  function updateModel() {
    if (active === "pendulum") state.pendulum = pendulumProfile(state.params);
    const metric =
      active === "superposition" && state.mix === "mixed"
        ? ["频率比 fₐ : fᵦ", () => "3 : 1"]
        : demos[active].metric;
    get("metric").hidden = !metric;
    if (metric) {
      get("metric-label").textContent = metric[0];
      get("metric-value").textContent = metric[1](state);
    }
    const def = demos[active];
    get("observation-text").textContent =
      active === "superposition" ? mixTips[state.mix] : def.tip;
    get("formula").innerHTML = def.formula;
    refreshStage();
  }

  function changeDemo(id) {
    if (!Object.hasOwn(demos, id)) return;
    setPlaying(false);
    active = id;
    state = states[id];
    for (const button of root.querySelectorAll(".nav-button")) {
      if (button.dataset.demo === id)
        button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    const def = demos[id];
    get("demo-title").textContent = def.title;
    get("demo-description").textContent = def.description;
    canvas.setAttribute("aria-label", def.alt);
    refreshSettings();
    updateModel();
  }

  function refreshStage() {
    const ended = state.time >= timeLimit();
    const status = ended ? "已结束" : playing ? "播放中" : "已暂停";
    const playText = playing ? "暂停" : ended ? "重播" : "播放";
    const statusNode = get("play-state");
    if (status !== statusNode.textContent) statusNode.textContent = status;
    statusNode.classList.toggle("is-playing", playing);
    if (get("play").lastElementChild.textContent !== playText) {
      get("play").lastElementChild.textContent = playText;
      get("play")
        .querySelector("use")
        .setAttribute("href", playing ? "#i-pause" : "#i-play");
    }
    get("elapsed").textContent = state.time.toFixed(2);
    get("previous").disabled = state.time <= 0;
    get("next").disabled = ended;
    drawScene();
  }

  function setPlaying(value) {
    playing = value;
    lastFrame = 0;
    cancelAnimationFrame(animationFrame);
    if (playing) {
      if (state.time >= timeLimit()) state.time = 0;
      animationFrame = requestAnimationFrame(tick);
    }
    refreshStage();
  }

  function tick(now) {
    if (!playing) return;
    if (lastFrame)
      state.time = Math.min(
        state.time + Math.min((now - lastFrame) / 1000, 0.06),
        timeLimit(),
      );
    lastFrame = now;
    if (state.time >= timeLimit()) {
      setPlaying(false);
      return;
    }
    refreshStage();
    animationFrame = requestAnimationFrame(tick);
  }

  function resetTime() {
    state.time = 0;
    setPlaying(false);
  }

  function stepFrame(direction) {
    state.time = clamp(state.time + direction * FRAME_STEP, 0, timeLimit());
    setPlaying(false);
  }

  function sizeCanvas(target, context) {
    const w = target.clientWidth;
    const h = target.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsW = Math.max(1, Math.round(w * ratio));
    const pixelsH = Math.max(1, Math.round(h * ratio));
    if (target.width !== pixelsW || target.height !== pixelsH) {
      target.width = pixelsW;
      target.height = pixelsH;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return [w, h];
  }

  function stroke(x1, y1, x2, y2, color = INK.line, weight = 1, dashes = []) {
    ctx.beginPath();
    ctx.setLineDash(dashes);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function trace(count, point, color, weight = 1.5, dashes = []) {
    ctx.beginPath();
    ctx.setLineDash(dashes);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    for (let i = 0; i <= count; i++) {
      const [x, y] = point(i / count);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function label(
    text,
    x,
    y,
    { color = INK.text, size = 12, align = "center", weight = 500 } = {},
  ) {
    ctx.font =
      weight +
      " " +
      size +
      'px "Instrument Sans", "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function circle(x, y, radius, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function arrow(x1, y1, x2, y2, color = INK.mint, weight = 2, head = 7) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) {
      circle(x1, y1, 2.5, color);
      return;
    }
    const along = Math.min(head, len * 0.68);
    const backX = x2 - (dx / len) * along;
    const backY = y2 - (dy / len) * along;
    stroke(x1, y1, backX, backY, color, weight);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      backX - (dy / len) * along * 0.55,
      backY + (dx / len) * along * 0.55,
    );
    ctx.lineTo(
      backX + (dy / len) * along * 0.55,
      backY - (dx / len) * along * 0.55,
    );
    ctx.closePath();
    ctx.fill();
  }

  function horizontalBracket(
    left,
    right,
    y,
    text,
    color = INK.amber,
    above = true,
  ) {
    if (right - left < 2) return;
    stroke(left, y - 4, left, y + 4, color, 1.25);
    stroke(right, y - 4, right, y + 4, color, 1.25);
    stroke(left, y, right, y, color, 1.25);
    label(text, (left + right) / 2, y + (above ? -12 : 13), {
      color,
      weight: 650,
    });
  }

  function support(x, y, halfSize, horizontal) {
    const x1 = horizontal ? x - halfSize : x;
    const x2 = horizontal ? x + halfSize : x;
    const y1 = horizontal ? y : y - halfSize;
    const y2 = horizontal ? y : y + halfSize;
    const length = 2 * halfSize;
    for (let i = 3; i < length; i += 7) {
      const hx = horizontal ? x1 + i : x;
      const hy = horizontal ? y : y1 + i;
      stroke(hx, hy, hx - 6, hy - 7, "#63818b", 1);
    }
    stroke(x1, y1, x2, y2, "#b2c8cd", 2.2);
  }

  function coil(x1, y1, x2, y2, turns, amplitude) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length <= 1) return;
    const ex = dx / length;
    const ey = dy / length;
    const pad = Math.min(12, length * 0.16);
    const rad = Math.min(amplitude, length * 0.38);
    stroke(x1, y1, x1 + pad * ex, y1 + pad * ey, "#add6db", 2.2);
    stroke(x2 - pad * ex, y2 - pad * ey, x2, y2, "#add6db", 2.2);
    trace(
      Math.max(96, turns * 14),
      (p) => {
        const angle = TAU * turns * p;
        const axial =
          pad + (length - 2 * pad) * p + rad * 0.22 * (1 - Math.cos(angle));
        const wave = rad * Math.sin(angle);
        return [x1 + axial * ex - wave * ey, y1 + axial * ey + wave * ex];
      },
      "#9cd4d9",
      2.15,
    );
  }

  function ball(x, y, r, accent = INK.mint) {
    const color = ctx.createRadialGradient(
      x - 0.31 * r,
      y - 0.37 * r,
      r * 0.08,
      x,
      y,
      r,
    );
    color.addColorStop(0, "#e4fff7");
    color.addColorStop(0.38, accent);
    color.addColorStop(1, "#2c8f80");
    ctx.save();
    ctx.shadowColor = "rgba(103, 221, 196, .29)";
    ctx.shadowBlur = 16;
    circle(x, y, r, color);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.strokeStyle = "#a9f3df";
    ctx.lineWidth = 1.05;
    ctx.stroke();
  }

  function drawSpring() {
    const p = state.params;
    const w = Math.sqrt(p.stiffness / p.mass);
    const angle = state.time * w;
    const left = width < 420 ? 29 : 51;
    const center = width * 0.54;
    const y = height * 0.58;
    const reach = Math.min(
      (center - left - 22) * 0.75,
      (width - center - 35) * 0.84,
      172,
    );
    const move = (p.amplitude / 18) * reach;
    const displacement = move * Math.cos(angle);
    const x = center + displacement;
    const r = clamp(width * 0.035, 13, 25) * (0.89 + (p.mass - 0.3) * 1.1);
    const axisY = height * 0.81;
    const right = width - 27;

    stroke(left - 6, y + r + 9, right, y + r + 9, "#446771");
    stroke(center, y - 34, center, axisY + 2, "#88a9b1", 1.1, [4, 4]);
    if (move > 13) {
      for (const stop of [center - move, center + move]) {
        stroke(stop, y + 25, stop, axisY, "#54757f", 1, [3, 4]);
      }
    }
    support(left, y, 35, false);
    coil(left, y, x - r, y, width < 420 ? 9 : 13, width < 420 ? 9 : 13);
    ball(x, y, r);

    arrow(left - 4, axisY, right, axisY, INK.pale, 1.15, 6);
    label("x", right - 1, axisY + 14, { color: INK.muted, align: "right" });
    const marks =
      move > 13
        ? [
            [center - move, "A"],
            [center, "O"],
            [center + move, "B"],
          ]
        : [[center, "O"]];
    for (const [position, name] of marks) {
      stroke(
        position,
        axisY - 5,
        position,
        axisY + 5,
        name === "O" ? INK.mint : INK.line,
        1.25,
      );
      label(name, position, axisY + 16, {
        color: name === "O" ? INK.mint : INK.text,
        weight: 650,
      });
    }
    label("平衡位置", center, axisY + 34, { color: INK.muted, size: 11 });

    const vectors = [
      ["displacement", "x", center, displacement, INK.mint],
      ["velocity", "v", x, -move * Math.sin(angle) * 0.72, INK.blue],
      ["acceleration", "a", x, -displacement * 0.68, INK.violet],
      ["force", "F", x, -displacement * 0.72, INK.coral],
    ].filter(([key]) => state.options[key]);
    vectors.forEach(([, name, start, delta, color], index) => {
      const rowY = y - 51 - (vectors.length - 1 - index) * 26;
      const end = clamp(start + delta, left - 3, right);
      arrow(start, rowY, end, rowY, color, 2, 7);
      const tipX = clamp(end + (delta >= 0 ? 9 : -9), 17, width - 15);
      label(name, tipX, rowY, {
        color,
        align: delta >= 0 ? "left" : "right",
        size: 14,
        weight: 700,
      });
    });
  }

  function drawPendulum() {
    const { length, angle, mass, gravity } = state.params;
    const [theta, rate] = getPendulumMotion(state.time);
    const startAngle = (angle * Math.PI) / 180;
    const yTop = height * 0.22;
    const xTop = width * 0.5;
    const radius =
      Math.min(height * 0.54, width * 0.61) *
      (0.82 + (0.18 * (length - 0.96)) / 0.24);
    const x = xTop + radius * Math.sin(theta);
    const y = yTop + radius * Math.cos(theta);
    const r = clamp(width * 0.033, 13, 22) * (0.82 + (mass - 0.2) * 1.1);
    const restY = yTop + radius;

    if (startAngle > 0) {
      trace(
        70,
        (p) => {
          const a = startAngle * (2 * p - 1);
          return [xTop + radius * Math.sin(a), yTop + radius * Math.cos(a)];
        },
        "#6d919c",
        1.3,
        [3, 4],
      );
      for (const side of [-1, 1]) {
        circle(
          xTop + side * radius * Math.sin(startAngle),
          yTop + radius * Math.cos(startAngle),
          3,
          INK.pale,
        );
      }
    }
    stroke(xTop, yTop, xTop, restY + 21, "#7e9da6", 1.2, [4, 4]);
    label("平衡位置", xTop, restY + 32, { color: INK.muted, size: 11 });
    support(xTop, yTop, 44, true);
    stroke(xTop, yTop, x, y, "#b2d6d9", 2.05);
    circle(xTop, yTop, 3.1, INK.mint);
    label(
      "L",
      xTop + (x - xTop) * 0.52 + (theta >= 0 ? 11 : -11),
      yTop + (y - yTop) * 0.52,
      { color: INK.pale, size: 12, align: theta >= 0 ? "left" : "right" },
    );

    if (Math.abs(theta) > 0.04) {
      trace(
        24,
        (p) => [
          xTop + 35 * Math.sin(theta * p),
          yTop + 35 * Math.cos(theta * p),
        ],
        INK.amber,
        1.2,
      );
      const align = theta >= 0 ? "left" : "right";
      label(
        "θ",
        xTop + 37 * Math.sin(theta) + (theta >= 0 ? 8 : -8),
        yTop + 35 * Math.cos(theta),
        { color: INK.amber, align, size: 13 },
      );
    }
    ball(x, y, r);

    const vectorLength = width < 400 ? 38 : 50;
    function drawVector(dx, dy, color, name) {
      const vx = x + dx;
      const vy = y + dy;
      arrow(x, y, vx, vy, color);
      const offset = Math.hypot(dx, dy) < 4 ? r + 10 : 9;
      label(
        name,
        clamp(vx + (dx >= 0 ? offset : -offset), 17, width - 17),
        vy - 2,
        { color, align: dx >= 0 ? "left" : "right", size: 13, weight: 650 },
      );
    }

    if (state.options.gravity) {
      const factor = (mass * gravity) / (0.35 * 9.8);
      const down = factor * vectorLength * 0.91;
      if (Math.abs(theta) > 0.1) {
        const radialX = down * Math.cos(theta) * Math.sin(theta);
        const radialY = down * Math.cos(theta) ** 2;
        const tangentX = -radialX;
        const tangentY = down - radialY;
        const components = "#e0ada7";
        stroke(x + radialX, y + radialY, x, y + down, components, 1, [3, 3]);
        stroke(x + tangentX, y + tangentY, x, y + down, components, 1, [3, 3]);
        arrow(x, y, x + radialX, y + radialY, components, 1.3, 5);
        arrow(x, y, x + tangentX, y + tangentY, components, 1.3, 5);
      }
      drawVector(0, down, INK.coral, "mg");
    }
    if (state.options.tension) {
      const force = mass * (gravity * Math.cos(theta) + length * rate ** 2);
      const drawLength = (vectorLength * 0.74 * force) / (0.35 * 9.8);
      drawVector(
        -drawLength * Math.sin(theta),
        -drawLength * Math.cos(theta),
        INK.mint,
        "Fₜ",
      );
    }
    if (state.options.velocity) {
      const peakRate = Math.sqrt(
        ((2 * gravity) / length) * (1 - Math.cos(startAngle)),
      );
      const speed = peakRate > 0 ? (vectorLength * rate) / peakRate : 0;
      drawVector(
        speed * Math.cos(theta),
        -speed * Math.sin(theta),
        INK.blue,
        "v",
      );
    }
  }

  function drawTimeGraph() {
    const damped = active === "damped";
    const period = graphPeriod(active);
    const duration = timeLimit();
    const amplitude = state.params.amplitude;
    const left = width < 410 ? 73 : Math.min(width * 0.23, 143);
    const right = width - (width < 410 ? 23 : 36);
    const top = height * 0.24;
    const bottom = height - 53;
    const mid = (top + bottom) / 2;
    const scale = (mid - top - 12) / 12;
    const unitX = (right - left) / duration;
    const currentT = Math.min(state.time, duration);
    const sample = (t) =>
      damped
        ? amplitude * Math.exp(-DAMPING * t) * Math.cos(DAMPED_OMEGA * t)
        : amplitude * Math.cos(GRAPH_OMEGA * t);
    const valueY = (value) => mid - value * scale;

    stroke(left, top - 7, left, bottom, INK.pale, 1.05);
    arrow(left, mid, right + 8, mid, INK.pale, 1.05, 6);
    label("x / cm", left, top - 17, { color: INK.muted, size: 11 });
    label("t / s", right, bottom + 31, {
      color: INK.muted,
      size: 11,
      align: "right",
    });

    for (const value of [-12, -6, 0, 6, 12]) {
      const y = valueY(value);
      if (value) stroke(left, y, right, y, "#365762", 0.9);
      stroke(left - 3, y, left + 3, y, INK.line);
      label(String(value), left - 6, y, {
        color: INK.muted,
        size: 10,
        align: "right",
      });
    }
    for (let t = 0; t <= duration; t += width < 410 ? 6 : 4) {
      const x = left + t * unitX;
      stroke(x, mid - 4, x, mid + 4, INK.line);
      label(String(t), x, bottom + 10, { color: INK.muted, size: 10 });
    }

    if (damped && state.options.envelope) {
      for (const sign of [-1, 1]) {
        trace(
          190,
          (p) => [
            left + p * (right - left),
            valueY(sign * amplitude * Math.exp(-DAMPING * duration * p)),
          ],
          "rgba(145,198,255,.66)",
          1.2,
          [4, 4],
        );
      }
    }

    trace(
      300,
      (p) => [left + p * (right - left), valueY(sample(p * duration))],
      "rgba(115,226,198,.34)",
      1.5,
    );
    if (currentT > 0) {
      trace(
        300,
        (p) => [left + p * currentT * unitX, valueY(sample(p * currentT))],
        INK.mint,
        2.2,
      );
    }

    if (state.options.periodMark) {
      const markerY = top + 8;
      const firstPeriod = left + period * unitX;
      horizontalBracket(left, firstPeriod, markerY, "T", INK.amber);
      if (amplitude > 0) {
        stroke(
          firstPeriod,
          markerY + 5,
          firstPeriod,
          valueY(sample(period)),
          "#7b715b",
          1,
          [3, 3],
        );
      }
    }

    const oscillator = width < 410 ? 28 : left * 0.4;
    const y = valueY(sample(currentT));
    const currentX = left + currentT * unitX;
    const r = width < 410 ? 8 : 12;
    support(oscillator, top - 10, width < 410 ? 13 : 23, true);
    coil(oscillator, top - 10, oscillator, y - r, 8, width < 410 ? 6 : 8);
    stroke(oscillator + r, y, currentX, y, "rgba(168,215,213,.52)", 1, [4, 5]);
    ball(oscillator, y, r);
    label("振子", oscillator, bottom + 11, { color: INK.muted, size: 11 });
    circle(currentX, y, 5, "#163f45");
    circle(currentX, y, 3.15, INK.mint);
  }

  function waveGeometry(span) {
    const left = width < 420 ? 28 : 43;
    const right = width - (width < 420 ? 24 : 36);
    const middle = height * 0.53;
    const axis = height * 0.86;
    const { speed, period } = state.params;
    const fromSource = (distance) =>
      state.direction === 1 ? distance : span - distance;
    const toPixel = (distance) => left + (distance / span) * (right - left);
    const travelled = speed * state.time;
    const progress = Math.min(travelled, span);
    const phase = (distance) =>
      (TAU * (state.time - distance / speed)) / period;
    const signal = (position) => {
      const distance = fromSource(position);
      return distance <= travelled ? Math.sin(phase(distance)) : 0;
    };
    return {
      span,
      left,
      right,
      middle,
      axis,
      fromSource,
      toPixel,
      progress,
      signal,
      wavelength: speed * period,
    };
  }

  function drawWaveGuides(g, showLambda) {
    const direction = state.direction;
    const source = g.toPixel(g.fromSource(0));
    const center = (g.left + g.right) / 2;
    const directionY = height * 0.207;
    const arrowHalf = Math.min(width * 0.16, 57);

    label(direction === 1 ? "向右传播" : "向左传播", center, directionY - 13, {
      color: INK.amber,
      size: 12,
    });
    arrow(
      center - direction * arrowHalf,
      directionY,
      center + direction * arrowHalf,
      directionY,
      INK.amber,
      1.7,
    );

    stroke(g.left, g.middle, g.right, g.middle, "#50707a", 1, [4, 4]);
    arrow(g.left, g.axis, g.right + 7, g.axis, INK.pale, 1.05, 6);
    for (let i = 0; i <= 4; i++) {
      const x = g.toPixel((g.span * i) / 4);
      stroke(x, g.axis - 3, x, g.axis + 3, INK.line, 1);
      label(String((g.span * i) / 4), x, g.axis + 12, {
        color: INK.muted,
        size: 10,
      });
    }
    label("x / m", g.right + 7, g.axis + 26, {
      align: "right",
      color: INK.muted,
      size: 11,
    });
    label("波源", source, g.axis - 15, { color: INK.mint, size: 11 });

    const frontX = g.toPixel(g.fromSource(g.progress));
    if (g.progress > (0.9 * g.span) / 30 && g.progress < g.span * 0.985) {
      const frontTop = height * 0.31;
      stroke(frontX, frontTop + 12, frontX, g.axis - 7, "#9f9072", 1, [4, 4]);
      label("波前", clamp(frontX, 24, width - 24), frontTop, {
        color: INK.amber,
        size: 11,
      });
    }

    if (showLambda && g.progress >= g.wavelength) {
      const start = (g.progress - g.wavelength) * 0.35;
      const x1 = g.toPixel(g.fromSource(start));
      const x2 = g.toPixel(g.fromSource(start + g.wavelength));
      horizontalBracket(
        Math.min(x1, x2),
        Math.max(x1, x2),
        g.axis - 24,
        "λ",
        INK.amber,
      );
    }
  }

  function drawTransverse() {
    const g = waveGeometry(32);
    const count = width < 420 ? 32 : 64;
    const yScale = (height * 0.22) / 4;
    const amplitude = yScale * state.params.amplitude;
    const sampleY = (position) => g.middle - amplitude * g.signal(position);
    const focus = g.span * 0.375;
    const focusX = g.toPixel(focus);
    const focusY = sampleY(focus);
    const source = g.fromSource(0);

    drawWaveGuides(g, true);
    arrow(
      g.left,
      g.middle + 4 * yScale + 5,
      g.left,
      g.middle - 4 * yScale - 8,
      INK.pale,
      1.05,
      6,
    );
    label("y / cm", g.left, g.middle - 4 * yScale - 20, {
      color: INK.muted,
      size: 11,
    });
    for (const value of [-4, -2, 0, 2, 4]) {
      const y = g.middle - value * yScale;
      stroke(g.left - 3, y, g.left + 3, y, INK.line);
      label(String(value), g.left - 7, y, {
        align: "right",
        color: INK.muted,
        size: 10,
      });
    }
    stroke(
      focusX,
      g.middle - height * 0.18,
      focusX,
      g.middle + height * 0.18,
      "#658d99",
      1,
      [3, 5],
    );
    if (g.progress > 0) {
      trace(
        200,
        (p) => {
          const position = g.fromSource(p * g.progress);
          return [g.toPixel(position), sampleY(position)];
        },
        INK.mint,
        2,
      );
    }
    for (let i = 0; i <= count; i++) {
      const position = (g.span * i) / count;
      const moving = g.fromSource(position) <= g.progress;
      const color = moving ? INK.mint : "#7896a0";
      circle(
        g.toPixel(position),
        sampleY(position),
        i % 4 === 0 ? 2.9 : 1.55,
        color,
      );
    }
    circle(g.toPixel(source), sampleY(source), 4.45, INK.mint);
    circle(focusX, focusY, 7.1, "#806641");
    circle(focusX, focusY, 3.8, INK.amber);
    const labelY = focusY > g.middle + 14 ? focusY + 14 : focusY - 13;
    label("P", focusX + 9, labelY, {
      color: INK.amber,
      align: "left",
      size: 13,
      weight: 700,
    });
  }

  function drawLongitudinal() {
    const g = waveGeometry(20);
    const count = width < 420 ? 57 : 113;
    const wavePixels = (g.wavelength / g.span) * (g.right - g.left);
    const amplitude =
      (Math.min(18, wavePixels * 0.115) * state.params.amplitude) / 1.2;
    const focus = g.span * 0.4;
    const origin = g.toPixel(focus);
    const actual = origin + g.signal(focus) * amplitude;
    const lineHalf = width < 420 ? 23 : 34;

    drawWaveGuides(g, false);
    for (let i = 0; i <= count; i++) {
      const position = (g.span * i) / count;
      if (Math.abs(position - focus) < g.span / count / 2) continue;
      const moving = position <= g.progress;
      const x = g.toPixel(position) + amplitude * g.signal(position);
      const color = moving ? "rgba(115,226,198,.57)" : "rgba(145,174,181,.41)";
      stroke(
        x,
        g.middle - lineHalf,
        x,
        g.middle + lineHalf,
        color,
        width < 420 ? 1.1 : 1.6,
      );
      circle(
        x,
        g.middle,
        width < 420 ? 1.5 : 2.1,
        moving ? INK.mint : "#91afb7",
      );
    }

    stroke(
      origin,
      g.middle - lineHalf - 8,
      origin,
      g.middle + lineHalf + 14,
      "#7a969e",
      1,
      [3, 4],
    );
    stroke(
      actual,
      g.middle - lineHalf - 2,
      actual,
      g.middle + lineHalf + 2,
      INK.amber,
      2.1,
    );
    circle(actual, g.middle, 4.1, INK.amber);
    label("P", actual, g.middle + lineHalf + 16, {
      color: INK.amber,
      size: 13,
      weight: 650,
    });

    if (state.options.amplitudeGuide) {
      horizontalBracket(
        origin - amplitude,
        origin + amplitude,
        g.middle + lineHalf + 36,
        "2A",
        INK.amber,
        false,
      );
    }

    const { period, speed } = state.params;
    const positions = [];
    for (const [fraction, name, color] of [
      [0, "密部", INK.mint],
      [0.5, "疏部", INK.muted],
    ]) {
      let nearest = null;
      for (let cycle = 0; cycle <= Math.ceil(g.span / g.wavelength); cycle++) {
        const position =
          (state.time / period -
            fraction -
            Math.floor(state.time / period) +
            cycle) *
          speed *
          period;
        if (
          position > 1 &&
          position < g.progress - 0.32 &&
          position < g.span - 1 &&
          (nearest === null ||
            Math.abs(position - g.span / 2) < Math.abs(nearest - g.span / 2))
        ) {
          nearest = position;
        }
      }
      if (nearest !== null) positions.push([g.toPixel(nearest), name, color]);
    }
    positions.forEach(([x, name, color], index) => {
      const close =
        positions.length === 2 &&
        Math.abs(positions[0][0] - positions[1][0]) < 35;
      const y = g.middle - lineHalf - 14 - (close ? index * 14 : 0);
      label(name, x, y, { color, size: 11 });
    });
  }

  function drawSuperposition() {
    const mode = state.mix;
    const { amplitudeA, amplitudeB } = state.params;
    const equalB = mode === "standing" ? amplitudeA : amplitudeB;
    const left = width < 420 ? 55 : 76;
    const right = width - (width < 420 ? 22 : 32);
    const top = 54;
    const band = (height - 94) / 3;
    const scale = (band * 0.4) / Math.max(6, amplitudeA + equalB);
    const px = (position) => left + (position / MIX_LENGTH) * (right - left);
    const t = state.time;
    const travelA = (x) => t - x / MIX_SPEED;
    const travelB = (x) => t - (MIX_LENGTH - x) / MIX_SPEED;
    const pulse = (lag) =>
      lag >= 0 && lag <= PULSE_TIME
        ? Math.sin((Math.PI * lag) / PULSE_TIME)
        : 0;
    const continuous = (lag, period) =>
      lag >= 0 ? Math.sin((TAU * lag) / period) : 0;
    let waveA;
    let waveB;

    if (mode === "standing") {
      const k = TAU / 4;
      const omega = k * MIX_SPEED;
      waveA = (x) => amplitudeA * Math.sin(k * x - omega * t);
      waveB = (x) => equalB * Math.sin(k * x + omega * t);
    } else if (mode === "mixed") {
      waveA = (x) => amplitudeA * continuous(travelA(x), 0.8);
      waveB = (x) => amplitudeB * continuous(travelB(x), 2.4);
    } else {
      const sign = mode === "opposite" ? -1 : 1;
      waveA = (x) => amplitudeA * pulse(travelA(x));
      waveB = (x) => sign * amplitudeB * pulse(travelB(x));
    }

    for (let i = 0; i <= 4; i++) {
      const position = (MIX_LENGTH * i) / 4;
      const x = px(position);
      stroke(x, top, x, height - 39, "#33555f", 0.9, [2, 4]);
      label(String(position), x, height - 24, { color: INK.muted, size: 10 });
    }
    label("x / m", right + 4, height - 11, {
      color: INK.muted,
      size: 11,
      align: "right",
    });

    const rows = [
      { name: "A 波 →", color: INK.mint, sample: waveA },
      { name: "← B 波", color: INK.violet, sample: waveB },
      { name: "合位移", color: INK.amber, sample: (x) => waveA(x) + waveB(x) },
    ];
    rows.forEach(({ name, color, sample }, index) => {
      const y = top + band * (index + 0.5);
      label(name, left - 9, y, {
        align: "right",
        color,
        size: width < 420 ? 11 : 12,
        weight: 650,
      });
      stroke(left, y, right, y, "#4e6d77", 1, [4, 4]);
      if (index > 0)
        stroke(left, y - band / 2, right, y - band / 2, "#31535e", 1);
      trace(
        260,
        (p) => [px(p * MIX_LENGTH), y - scale * sample(p * MIX_LENGTH)],
        color,
        index === 2 ? 2.35 : 1.8,
      );
      if (index === 2 && mode === "standing") {
        for (let position = 0; position <= MIX_LENGTH; position += 2) {
          circle(px(position), y, 3.8, "#153644");
          circle(px(position), y, 2.05, INK.amber);
        }
        const node = px(4);
        const captionY = y + band * 0.49;
        stroke(node, y + 6, node, captionY - 8, "#b69a72", 1, [3, 3]);
        label("波节", node, captionY, { color: INK.amber, size: 10 });
      }
    });
  }

  const scenes = {
    spring: drawSpring,
    pendulum: drawPendulum,
    harmonic: drawTimeGraph,
    damped: drawTimeGraph,
    transverse: drawTransverse,
    longitudinal: drawLongitudinal,
    superposition: drawSuperposition,
  };

  function drawScene() {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    scenes[active]();
  }

  function resize() {
    [width, height] = sizeCanvas(canvas, ctx);
    drawScene();
  }
  for (const button of root.querySelectorAll(".nav-button")) {
    button.addEventListener("click", () => {
      if (button.dataset.demo !== active) changeDemo(button.dataset.demo);
    });
  }

  get("selectors").addEventListener("change", ({ target }) => {
    if (!target.checked) return;
    if (target.name === "direction") {
      state.direction = Number(target.value);
    } else if (target.name === "mix") {
      state.mix = target.value;
      state.params = state.mixParams[state.mix === "mixed" ? "mixed" : "pulse"];
      refreshParameters();
    } else {
      return;
    }
    state.time = 0;
    lastFrame = 0;
    updateModel();
  });

  get("display-options").addEventListener("change", ({ target }) => {
    if (!target.dataset.option) return;
    state.options[target.dataset.option] = target.checked;
    drawScene();
  });

  get("play").addEventListener("click", () => setPlaying(!playing));
  get("reset").addEventListener("click", resetTime);
  get("previous").addEventListener("click", () => stepFrame(-1));
  get("next").addEventListener("click", () => stepFrame(1));
  get("defaults").addEventListener("click", () => {
    states[active] = freshState(active);
    changeDemo(active);
  });

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
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (
        [" ", "Enter"].includes(event.key) &&
        target?.closest("button, summary, a")
      )
        return;
      const commands = {
        " ": () => {
          if (!event.repeat) setPlaying(!playing);
        },
        Enter: () => setPlaying(true),
        End: () => setPlaying(false),
        Home: resetTime,
        ArrowLeft: () => stepFrame(-1),
        ArrowRight: () => stepFrame(1),
      };
      if (!Object.hasOwn(commands, event.key)) return;
      event.preventDefault();
      commands[event.key]();
    },
    { signal },
  );

  const layout = get("demo-layout");
  const menu = get("demo-menu");
  const toggleMenu = get("toggle-menu");
  const lesson = root.querySelector(".lesson");
  const settings = root.querySelector(".settings");
  const splitter = get("splitter");
  let drag = null;

  function adjustSplit(requestedWidth) {
    const available = lesson.clientWidth;
    const parameterWidth = clamp(
      requestedWidth,
      182,
      Math.max(182, available - 332),
    );
    lesson.style.setProperty("--parameter-width", parameterWidth + "px");
    lesson.classList.add("has-split");
    splitter.setAttribute(
      "aria-valuenow",
      String(Math.round(100 * (1 - parameterWidth / available))),
    );
    resize();
  }

  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      width: settings.offsetWidth,
    };
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add("is-dragging");
    root.classList.add("is-resizing");
  });
  splitter.addEventListener("pointermove", (event) => {
    if (drag?.id === event.pointerId)
      adjustSplit(drag.width + drag.x - event.clientX);
  });
  splitter.addEventListener("lostpointercapture", () => {
    drag = null;
    splitter.classList.remove("is-dragging");
    root.classList.remove("is-resizing");
  });
  splitter.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    adjustSplit(settings.offsetWidth + (event.key === "ArrowLeft" ? 16 : -16));
  });
  toggleMenu.addEventListener("click", () => {
    const hidden = layout.classList.toggle("menu-hidden");
    menu.classList.toggle("is-collapsed", hidden);
    for (const group of menu.querySelectorAll(".nav-group"))
      group.hidden = hidden;
    toggleMenu.setAttribute("aria-expanded", String(!hidden));
    toggleMenu.title = hidden ? "显示目录" : "隐藏目录";
    toggleMenu.setAttribute("aria-label", toggleMenu.title);
    toggleMenu.textContent = hidden ? "›" : "‹";
    resize();
  });

  changeDemo(active);
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener("resize", resize, { signal });

  return {
    pause: () => setPlaying(false),
    dispose() {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    },
  };
}
