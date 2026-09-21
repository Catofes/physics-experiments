const GEO = {
  gunExit: -4.35,
  yPlate: {
    start: -3.45,
    end: -2.35,
  },
  xPlate: {
    start: -1.95,
    end: -0.85,
  },
  screenX: 5.6,
  screenR: 2.35,
  v0: 6,
  gainY: 0.044,
  gainX: 0.052,
};
const TWO_PI = Math.PI * 2;
function sawtooth(t, freq, amp, flyback, phaseDeg = 0) {
  if (freq <= 0 || amp <= 0)
    return {
      v: 0,
      blank: false,
    };
  const period = 1 / freq;
  const phase = ((t % period) / period + phaseDeg / 360) % 1;
  const traceFrac = 1 - flyback;
  if (phase < traceFrac) {
    const k = phase / traceFrac;
    return {
      v: -amp + 2 * amp * k,
      blank: false,
    };
  }
  const k = (phase - traceFrac) / Math.max(flyback, 1e-4);
  return {
    v: amp - 2 * amp * Math.min(k, 1),
    blank: true,
  };
}
function signalWave(type, phase) {
  switch (type) {
    case "sine":
      return Math.sin(phase);
    case "square":
      return Math.sin(phase) >= 0 ? 1 : -1;
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "dc":
    default:
      return 0;
  }
}
function sampleVoltages(state, t) {
  const yPhaseRad = (state.yPhase * Math.PI) / 180;
  const ac =
    state.ySignal === "dc"
      ? 0
      : signalWave(state.ySignal, TWO_PI * state.yFreq * t + yPhaseRad) *
        state.yAmp;
  const uy = state.yDc + ac;
  const sweep = state.sweepOn
    ? state.xSignal === "sine"
      ? { v: state.sweepAmp * Math.sin(TWO_PI * state.sweepFreq * t + state.sweepPhase * Math.PI / 180), blank: false }
      : sawtooth(
        t,
        state.sweepFreq,
        state.sweepAmp,
        state.flyback,
        state.sweepPhase,
      )
    : {
        v: 0,
        blank: false,
      };
  return {
    t,
    uy,
    ux: sweep.v,
    blank: state.sweepOn ? sweep.blank : false,
  };
}
function computeBeam(uy, ux) {
  const { gunExit, yPlate, xPlate, screenX, v0, gainY, gainX } = GEO;
  const ay =
    (uy * gainY * v0 * v0) /
    ((yPlate.end - yPlate.start) * (screenX - (yPlate.start + yPlate.end) / 2));
  const az =
    -(ux * gainX * v0 * v0) /
    ((xPlate.end - xPlate.start) * (screenX - (xPlate.start + xPlate.end) / 2));
  const pts = [];
  const push = (x, y, z) =>
    pts.push({
      x,
      y,
      z,
    });
  push(gunExit, 0, 0);
  let x = gunExit;
  let y = 0;
  let z = 0;
  let vy = 0;
  let vz = 0;
  {
    const x0 = yPlate.start;
    const x1 = yPlate.end;
    const dt = (x1 - x0) / v0;
    push(x0, y, z);
    const STEPS = 8;
    for (let i = 1; i < STEPS; i++) {
      const tt = (dt * i) / STEPS;
      push(x0 + v0 * tt, y + vy * tt + 0.5 * ay * tt * tt, z);
    }
    y = y + vy * dt + 0.5 * ay * dt * dt;
    vy = vy + ay * dt;
    x = x1;
    push(x, y, z);
  }
  {
    const x1 = xPlate.start;
    const dt = (x1 - x) / v0;
    y = y + vy * dt;
    z = z + vz * dt;
    x = x1;
    push(x, y, z);
  }
  {
    const x1 = xPlate.end;
    const dt = (x1 - x) / v0;
    const STEPS = 8;
    for (let i = 1; i <= STEPS; i++) {
      const tt = (dt * i) / STEPS;
      push(x + v0 * tt, y + vy * tt, z + vz * tt + 0.5 * az * tt * tt);
    }
    y = y + vy * dt;
    z = z + vz * dt + 0.5 * az * dt * dt;
    vz = vz + az * dt;
    x = x1;
  }
  {
    const dt = (screenX - x) / v0;
    y = y + vy * dt;
    z = z + vz * dt;
    push(screenX, y, z);
  }
  return pts;
}
function screenSpot(uy, ux) {
  return {
    y: GEO.gainY * uy,
    sx: GEO.gainX * ux,
  };
}
const DEFAULT_STATE = {
  ySignal: "sine",
  yDc: 0,
  yAmp: 22,
  yFreq: 0.5,
  yPhase: 0,
  sweepOn: true,
  xSignal: "sawtooth",
  sweepAmp: 24,
  sweepFreq: 0.5,
  sweepPhase: 0,
  flyback: 0,
  persistence: 0.82,
};

// Integrate the illuminated path between display frames, including frequencies
// above the display refresh rate. Never connect across a sweep reset or blanking.
function sampleScreenTrace(state, start, end) {
  const frequency = Math.max(state.ySignal === "dc" ? 0 : state.yFreq,
    state.sweepOn ? state.sweepFreq : 0);
  const count = Math.max(1, Math.ceil((end - start) * Math.max(240, frequency * 256)));
  const points = [];
  let previous;
  for (let i = 0; i <= count; i++) {
    const t = start + (end - start) * i / count;
    const sample = sampleVoltages(state, t);
    const cycle = Math.floor(t * state.sweepFreq + state.sweepPhase / 360);
    const squareHalf = Math.floor(t * state.yFreq * 2 + state.yPhase / 180);
    const connect = !!previous && !previous.blank && !sample.blank
      && (!state.sweepOn || state.xSignal === "sine" || cycle === previous.cycle)
      && (state.ySignal !== "square" || squareHalf === previous.squareHalf);
    points.push({ ...screenSpot(sample.uy, sample.ux), blank: sample.blank, connect });
    previous = { ...sample, cycle, squareHalf };
  }
  return points;
}

export { GEO, DEFAULT_STATE, sampleVoltages, computeBeam, screenSpot, sampleScreenTrace };
