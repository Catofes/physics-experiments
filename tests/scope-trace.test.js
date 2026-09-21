import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, GEO, sampleScreenTrace } from "../src/experiments/cathode-ray/physics.js";

test("高频在 30、60、144 Hz 刷新下仍覆盖整条轨迹，低频保留局部运动", () => {
  for (const refresh of [30, 60, 144]) {
    const state = { ...DEFAULT_STATE, sweepOn: false, yFreq: 1000 };
    const trace = sampleScreenTrace(state, 0, 1 / refresh);
    const extent = GEO.gainY * state.yAmp;
    assert.ok(Math.max(...trace.map(p => p.y)) > extent * 0.999);
    assert.ok(Math.min(...trace.map(p => p.y)) < -extent * 0.999);
    assert.ok(trace.every(p => p.sx === 0));
    const slow = sampleScreenTrace({ ...state, yFreq: 0.5 }, 0, 1 / refresh);
    assert.ok(Math.max(...slow.map(p => p.y)) < extent * 0.11);
  }
});

test("高频扫描不连接回扫和方波跳变，不在消隐区绘线", () => {
  for (const flyback of [0, 0.1, 0.3]) {
    const trace = sampleScreenTrace({ ...DEFAULT_STATE, ySignal: "square",
      yFreq: 1000, sweepFreq: 1000, flyback }, 0, 1 / 60);
    assert.ok(trace.some(p => p.connect));
    for (let i = 1; i < trace.length; i++) {
      if (!trace[i].connect) continue;
      assert.equal(trace[i].blank, false);
      assert.equal(trace[i - 1].blank, false);
      assert.ok(trace[i].sx >= trace[i - 1].sx);
      assert.equal(trace[i].y, trace[i - 1].y);
    }
  }
});
