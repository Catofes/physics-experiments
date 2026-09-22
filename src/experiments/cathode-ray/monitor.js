import { sampleVoltages } from "./physics.js";
// Low-frequency history uses real seconds; high frequencies use a short window.
const PIXELS_PER_SECOND = 60;

export function createMonitor(canvas) {
  const ctx = canvas.getContext("2d");
  const samples = [];
  let sweepKey = "";
  let currentState;
  let highFrequency = 0;
  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#101c28";
    ctx.fillRect(0, 0, width, height);
    const end = samples.at(-1)?.t || 0;
    const pixelsPerSecond = highFrequency ? width * highFrequency / 4 : PIXELS_PER_SECOND;
    const timeX = (t) => width + (t - end) * pixelsPerSecond;
    let visible = samples;
    if (highFrequency && samples.length) {
      const start = Math.max(0, end - width / pixelsPerSecond);
      const count = Math.max(1024, Math.ceil(width * 2));
      visible = Array.from({ length: count + 1 }, (_, i) =>
        sampleVoltages(currentState, start + (end - start) * i / count));
    }
    ctx.font = "10px system-ui";
    ctx.lineWidth = 1;
    const tick = highFrequency ? 1 / highFrequency : 1;
    for (
      let t = Math.max(0, Math.ceil((end - width / pixelsPerSecond) / tick) * tick);
      t <= end;
      t += tick
    ) {
      const x = timeX(t);
      ctx.strokeStyle = "#243540";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 16);
      ctx.stroke();
      ctx.fillStyle = "#9aacb8";
      if (x < width - 30) ctx.fillText(highFrequency ? `${((t - end) * 1000).toFixed(1)} ms` : `${t} s`, x + 3, height - 4);
    }
    for (const [index, key, label, color] of [
      [0, "ux", "Ux 扫描电压", "#69c9d5"],
      [1, "uy", "Uy 偏转电压", "#f492b1"],
    ]) {
      const center = (height * (index + 0.5)) / 2;
      ctx.strokeStyle = "#30414c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(width, center);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "11px system-ui";
      ctx.fillText(label, 12, (index * height) / 2 + 18);
      for (let i = 1; i < visible.length; i++) {
        const a = visible[i - 1],
          b = visible[i];
        if (timeX(b.t) < 0) continue;
        ctx.strokeStyle = key === "ux" && b.blank ? "#687984" : color;
        ctx.beginPath();
        ctx.moveTo(
          timeX(a.t),
          center - (a[key] / 45) * (height / 4 - 20),
        );
        ctx.lineTo(
          timeX(b.t),
          center - (b[key] / 45) * (height / 4 - 20),
        );
        ctx.stroke();
      }
    }
  }
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  return {
    push(sample, state) {
      currentState = state ? { ...state } : undefined;
      const frequency = state ? Math.max(state.ySignal === "dc" ? 0 : state.yFreq,
        state.sweepOn ? state.sweepFreq : 0) : 0;
      const nextHighFrequency = frequency > 2 ? frequency : 0;
      if (nextHighFrequency !== highFrequency) samples.length = 0;
      highFrequency = nextHighFrequency;
      const previous = samples.at(-1);
      const nextSweepKey = state
        ? [
            state.sweepOn,
            state.xSignal,
            state.sweepFreq,
            state.sweepAmp,
            state.sweepPhase,
            state.flyback,
          ].join("|")
        : "";
      if (
        previous &&
        !highFrequency &&
        state?.sweepOn &&
        state.xSignal !== "sine" &&
        state.flyback === 0 &&
        state.sweepFreq > 0 &&
        sweepKey === nextSweepKey
      ) {
        // Insert both limits at the exact reset time. Connecting adjacent
        // animation frames would give an ideal sawtooth a sloping return edge.
        const phase = state.sweepPhase / 360;
        const firstCycle = Math.floor(previous.t * state.sweepFreq + phase) + 1;
        const lastCycle = Math.floor(sample.t * state.sweepFreq + phase);
        for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
          const t = (cycle - phase) / state.sweepFreq;
          const fraction = (t - previous.t) / (sample.t - previous.t);
          const uy = previous.uy + (sample.uy - previous.uy) * fraction;
          samples.push(
            { t, ux: state.sweepAmp, uy, blank: false },
            { t, ux: -state.sweepAmp, uy, blank: false },
          );
        }
      }
      sweepKey = nextSweepKey;
      samples.push(sample);
      if (highFrequency && samples.length > 2) samples.splice(0, samples.length - 2);
      // Keep extra history for window expansion, plus a point before the edge.
      const history = Math.max(60, canvas.clientWidth / PIXELS_PER_SECOND);
      while (samples.length > 2 && samples[1].t < sample.t - history)
        samples.shift();
      draw();
    },
    clear() {
      samples.length = 0;
      sweepKey = "";
      draw();
    },
    dispose() {
      observer.disconnect();
      samples.length = 0;
    },
  };
}
