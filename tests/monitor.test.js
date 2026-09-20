import test from "node:test";
import assert from "node:assert/strict";
import { createMonitor } from "../src/experiments/cathode-ray/monitor.js";
import { DEFAULT_STATE, sampleVoltages } from "../src/experiments/cathode-ray/physics.js";

function setup(t, width, dpr = 1) {
  let resize;
  let disconnected = false;
  const oldWindow = globalThis.window;
  const oldObserver = globalThis.ResizeObserver;
  globalThis.window = { devicePixelRatio: dpr };
  globalThis.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldObserver === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = oldObserver;
  });
  const lines = [];
  let path;
  const ctx = {
    setTransform() {},
    fillRect() { lines.length = 0; },
    fillText() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push({ x, y }); },
    lineTo(x, y) { path.push({ x, y }); },
    stroke() { lines.push({ color: this.strokeStyle, points: path }); },
  };
  const canvas = { clientWidth: width, clientHeight: 126, getContext: () => ctx };
  const monitor = createMonitor(canvas);
  t.after(() => monitor.dispose());
  return {
    monitor, canvas, resize: () => resize(),
    disconnected: () => disconnected,
    trace: () => lines.filter((line) => line.color === "#69c9d5").map((line) => line.points),
  };
}

test("时间轴在窄屏、宽屏及高像素密度下保持每秒 60 CSS 像素", (t) => {
  const { monitor, canvas, resize, trace } = setup(t, 360, 2);
  monitor.push({ t: 0, ux: -10, uy: 0 });
  monitor.push({ t: 1, ux: 10, uy: 0 });
  for (const width of [360, 1440, 600]) {
    canvas.clientWidth = width;
    resize();
    assert.equal(canvas.width, width * 2);
    assert.deepEqual(trace()[0].map((point) => point.x), [width - 60, width]);
  }
  monitor.push({ t: 1.5, ux: 12, uy: 0 });
  assert.equal(trace()[0][0].x, 510); // Half a second scrolls history by 30 px.
});

test("宽屏保留超过十秒的历史，清空及销毁释放监视器", (t) => {
  const { monitor, trace, disconnected } = setup(t, 1440);
  for (let second = 0; second <= 25; second++) {
    monitor.push({ t: second, ux: second, uy: 0 });
  }
  assert.ok(trace().some((points) => points[0].x === 0));
  assert.equal(trace().at(-1)[1].x, 1440);
  monitor.clear();
  assert.equal(trace().length, 0);
  monitor.dispose();
  assert.equal(disconnected(), true);
});

test("理想锯齿波在准确的周期交界处垂直下降，支持初相及非零回扫", (t) => {
  const { monitor, trace } = setup(t, 600);
  for (const sweepPhase of [0, 90]) {
    monitor.clear();
    const state = { ...DEFAULT_STATE, sweepPhase };
    const resetTime = (1 - sweepPhase / 360) / state.sweepFreq;
    monitor.push(sampleVoltages(state, resetTime - 0.01), state);
    monitor.push(sampleVoltages(state, resetTime + 0.01), state);
    const vertical = trace().find(([a, b]) => a.x === b.x && a.y !== b.y);
    assert.ok(vertical);
    assert.ok(Math.abs(vertical[0].x - 599.4) < 1e-9);
    assert.ok(vertical[0].y < vertical[1].y);
  }
  monitor.clear();
  const state = { ...DEFAULT_STATE, flyback: 0.08 };
  monitor.push(sampleVoltages(state, 1.99), state);
  monitor.push(sampleVoltages(state, 2.01), state);
  assert.equal(trace().length, 1);
  assert.notEqual(trace()[0][0].x, trace()[0][1].x);
});
