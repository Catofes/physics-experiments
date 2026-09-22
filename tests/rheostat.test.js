import test from 'node:test';
import assert from 'node:assert/strict';
import { curve, solveCircuit } from '../src/experiments/rheostat/physics.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('限流：A-P 串联，B 端不参与，滑片到 A 后负载取得全电压', () => {
  const b = solveCircuit('limit', 6, 20, 10, 0);
  close(b.upper, 20); close(b.equivalent, 30); close(b.loadVoltage, 2); close(b.loadCurrent, 0.2);
  const a = solveCircuit('limit', 6, 20, 10, 1);
  close(a.upper, 0); close(a.equivalent, 10); close(a.loadVoltage, 6);
});

test('分压：P-B 与负载并联，端点电压覆盖 0 到电源电压', () => {
  const b = solveCircuit('divider', 6, 20, 10, 0);
  close(b.loadVoltage, 0); close(b.equivalent, 20); close(b.sourceCurrent, 0.3);
  const middle = solveCircuit('divider', 6, 20, 10, 0.5);
  close(middle.parallel, 5); close(middle.equivalent, 15);
  close(middle.loadVoltage, 2); close(middle.loadCurrent, 0.2);
  close(middle.sourceCurrent, 0.4);
  const a = solveCircuit('divider', 6, 20, 10, 1);
  close(a.loadVoltage, 6); close(a.equivalent, 20 / 3); close(a.sourceCurrent, 0.9);
});

test('调节曲线包含两端和当前位置，限流最低电压始终大于零', () => {
  for (const mode of ['divider', 'limit']) {
    const values = curve(mode, 6, 20, 10, 'loadVoltage');
    assert.equal(values.length, 101);
    close(values[0], solveCircuit(mode, 6, 20, 10, 0).loadVoltage);
    close(values[50], solveCircuit(mode, 6, 20, 10, 0.5).loadVoltage);
    close(values[100], 6);
    assert.ok(values.every((value, i) => i === 0 || value >= values[i - 1]));
  }
  assert.ok(curve('limit', 6, 20, 10, 'loadVoltage')[0] > 0);
});
