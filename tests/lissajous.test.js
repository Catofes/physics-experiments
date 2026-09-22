import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, GEO, sampleVoltages, sampleScreenTrace } from "../src/experiments/cathode-ray/physics.js";

const base = { ...DEFAULT_STATE, xSignal: "sine", sweepFreq: 1, yFreq: 1, sweepAmp: 24, yAmp: 24 * GEO.gainX / GEO.gainY };
test("双正弦同相成直线，正交且等偏转幅值成圆", () => {
  for (const p of sampleScreenTrace(base, 0, 1)) assert.ok(Math.abs(p.y - p.sx) < 1e-10);
  const radius = base.sweepAmp * GEO.gainX;
  for (const p of sampleScreenTrace({ ...base, yPhase: 90 }, 0, 1)) {
    assert.ok(Math.abs(p.sx ** 2 + p.y ** 2 - radius ** 2) < 1e-10);
  }
});
test("正弦 X 跨周期连续且无回扫消隐", () => {
  const state = { ...base, flyback: 0.3, sweepPhase: 30 };
  const trace = sampleScreenTrace(state, 0, 3);
  assert.ok(trace.every(p => !p.blank));
  assert.ok(trace.slice(1).every(p => p.connect));
  assert.ok(Math.abs(sampleVoltages(state, 0).ux - 12) < 1e-10);
});
test("1:2 图形一个公共周期闭合并两次穿过中心", () => {
  const state = { ...base, yFreq: 2 };
  for (const t of [0, 0.5, 1]) {
    const p = sampleVoltages(state, t);
    assert.ok(Math.abs(p.ux) < 1e-10 && Math.abs(p.uy) < 1e-10);
  }
  const trace = sampleScreenTrace(state, 0, 1);
  assert.ok(trace.some(p => p.sx > 0 && p.y > 0));
  assert.ok(trace.some(p => p.sx > 0 && p.y < 0));
});
