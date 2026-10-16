import test from 'node:test';
import assert from 'node:assert/strict';
import { apparentSource, correctReading, currentDisplay, fitReadings, loadRange, samplingLoads, solveCircuit } from '../src/experiments/emf-internal-resistance/physics.js';

const base = { emf: 1.5, resistance: 1, ra: .2, rv: 3000, ideal: false };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const readings = params => samplingLoads(params.resistance).map(load => solveCircuit({ ...params, load }));

test('电源测量：两种接法均满足节点电流守恒和回路电压守恒（两表同时非理想）', () => {
  for (const connection of ['external', 'internal']) for (const ra of [0, .2, 2]) for (const rv of [5, 3000, Infinity]) for (const load of [2, 8, 20]) {
    const p = { ...base, connection, ra, rv, load }, s = solveCircuit(p);
    close(base.emf, s.terminalVoltage + s.sourceCurrent * base.resistance);
    close(s.u / rv, s.iv);
    if (connection === 'external') {
      close(s.sourceCurrent, s.i + s.iv);
      close(s.terminalVoltage, s.u);
      close(s.u, s.i * (load + ra));
    } else {
      close(s.sourceCurrent, s.i);
      close(s.i, s.loadCurrent + s.iv);
      close(s.terminalVoltage, s.u + s.i * ra);
      close(s.u, s.loadCurrent * load);
    }
  }
});

test('电源测量：理想两表两种接法均恢复真实电动势和内阻', () => {
  for (const connection of ['external', 'internal']) {
    const params = { ...base, connection, ideal: true }, fit = fitReadings(readings(params));
    close(fit.emf, 1.5); close(fit.resistance, 1);
    for (const s of readings(params)) { close(s.iv, 0); close(s.ua, 0); close(s.u, 1.5 - s.i); }
  }
});

test('电源测量：外接 E、r 偏小且不受 RA 影响；内接 E 不变、r 加 RA 且不受 RV 影响', () => {
  for (const connection of ['external', 'internal']) for (const ra of [.2, 1]) for (const rv of [10, 3000]) {
    const params = { ...base, connection, ra, rv }, fit = fitReadings(readings(params)), theory = apparentSource(params);
    const factor = rv / (rv + 1);
    close(fit.emf, connection === 'external' ? 1.5 * factor : 1.5);
    close(fit.resistance, connection === 'external' ? factor : 1 + ra);
    close(theory.emf, fit.emf); close(theory.resistance, fit.resistance);
  }
});

test('电源测量：按表内阻修正每组读数，不依赖真实 E、r，恢复真实值', () => {
  for (const connection of ['external', 'internal']) {
    const params = { ...base, connection, ra: 1, rv: 10 };
    const corrected = readings(params).map(point => correctReading(point, { connection, ra: 1, rv: 10, ideal: false }));
    const fit = fitReadings(corrected);
    close(fit.emf, 1.5); close(fit.resistance, 1);
    for (const point of corrected) close(point.u + point.i, 1.5);
  }
});

test('电源测量：U-I 图像斜率为负内阻，纵截距为 E，横截距为 E/r', () => {
  const params = { ...base, emf: 3, resistance: 2, connection: 'internal', ideal: true };
  const ui = fitReadings(readings(params));
  close(ui.slope, -2); close(ui.intercept, 3);
  close(-ui.intercept / ui.slope, 1.5);
});

test('电源测量：重复点或数据不足不能拟合', () => {
  assert.equal(fitReadings([]), null);
  assert.equal(fitReadings([{ i: .1, u: 1.4 }]), null);
  assert.equal(fitReadings([{ i: .1, u: 1.4 }, { i: .1, u: 1.4 }]), null);
});

test('电源测量：百欧至千欧电源的负载覆盖有效工作区，非理想表拟合和修正仍准确', () => {
  for (const resistance of [100, 500, 2000, 5000]) for (const connection of ['external', 'internal']) {
    const params = { ...base, emf: 1, resistance, connection };
    const loads = samplingLoads(resistance), bounds = loadRange(resistance);
    assert.equal(new Set(loads).size, 6);
    assert.ok(loads.every(load => load >= bounds.min && load <= bounds.max));
    const points = readings(params), fit = fitReadings(points), expected = apparentSource(params);
    close(fit.emf, expected.emf); close(fit.resistance, expected.resistance);
    assert.ok(Math.max(...points.map(p => p.u)) - Math.min(...points.map(p => p.u)) > .05);
    const corrected = fitReadings(points.map(point => correctReading(point, params)));
    close(corrected.emf, 1); close(corrected.resistance, resistance);
    const { factor } = currentDisplay(1, resistance);
    const displayedSlope = (points.at(-1).u - points[0].u) / ((points.at(-1).i - points[0].i) * factor);
    close(-displayedSlope * factor, expected.resistance);
  }
});

test('电源测量：电流显示选择 A、mA、μA，水果电池读数不舍入为零', () => {
  assert.deepEqual(currentDisplay(1.5, 1), { factor: 1, unit: 'A' });
  assert.deepEqual(currentDisplay(1, 500), { factor: 1000, unit: 'mA' });
  assert.deepEqual(currentDisplay(1, 5000), { factor: 1e6, unit: 'μA' });
  for (const resistance of [500, 5000]) {
    const { factor } = currentDisplay(1, resistance);
    for (const point of readings({ ...base, emf: 1, resistance, connection: 'external' })) {
      assert.ok(Number((point.i * factor).toFixed(3)) > 0);
    }
  }
});
