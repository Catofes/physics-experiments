import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVEMENT, DEFAULTS, calculate, ammeterRange, voltmeterRange, ohmmeterZero, dialReading } from '../src/experiments/meter-conversion/model.js';

test('并联分流使 0.6 A 对应表头满偏，支路电流守恒且电压相同', () => {
  const r = calculate('ammeter', DEFAULTS.ammeter.resistor, 0.6);
  assert.ok(Math.abs(r.meterCurrent - MOVEMENT.fullCurrent) < 1e-12);
  assert.ok(Math.abs(r.totalCurrent - r.meterCurrent - r.resistorCurrent) < 1e-12);
  assert.ok(Math.abs(r.meterCurrent * MOVEMENT.resistance - r.resistorCurrent * DEFAULTS.ammeter.resistor) < 1e-12);
  assert.ok(Math.abs(ammeterRange(DEFAULTS.ammeter.resistor) - 0.6) < 1e-12);
});

test('串联分压使 3 V 对应表头满偏，两处电流相等且电压相加为总电压', () => {
  const r = calculate('voltmeter', DEFAULTS.voltmeter.resistor, 3);
  assert.ok(Math.abs(r.meterCurrent - MOVEMENT.fullCurrent) < 1e-12);
  assert.equal(r.meterCurrent, r.resistorCurrent);
  assert.ok(Math.abs(r.meterVoltage + r.resistorVoltage - 3) < 1e-12);
  assert.equal(voltmeterRange(DEFAULTS.voltmeter.resistor), 3);
});

test('欧姆表短接满偏、内阻处半偏、开路零偏，刻度方向反转', () => {
  assert.equal(ohmmeterZero(DEFAULTS.ohmmeter.resistor), MOVEMENT.fullCurrent);
  const short = calculate('ohmmeter', DEFAULTS.ohmmeter.resistor, 0);
  const middle = calculate('ohmmeter', DEFAULTS.ohmmeter.resistor, 1500);
  const open = calculate('ohmmeter', DEFAULTS.ohmmeter.resistor, Infinity);
  assert.equal(short.meterCurrent, MOVEMENT.fullCurrent);
  assert.equal(middle.meterCurrent, MOVEMENT.fullCurrent / 2);
  assert.equal(open.meterCurrent, 0);
  assert.equal(dialReading('ohmmeter', 1, middle.range), 0);
  assert.equal(dialReading('ohmmeter', 0.5, middle.range), 1500);
  assert.equal(dialReading('ohmmeter', 0, middle.range), Infinity);
});

const { dualRangeDesign, calculateDualRange, ohmmeterRangeDesign, calculateOhmmeter } = await import('../src/experiments/meter-conversion/model.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
test('双量程电压表保留原 3 V 电表，15 V 挡增加 12 kΩ，串联电流和电压守恒', () => {
  const d = dualRangeDesign('voltmeter');
  near(d.firstSeries, DEFAULTS.voltmeter.resistor);
  near(d.baseResistance, 3000); near(d.addedResistance, 12000);
  for (const high of [false, true]) for (const fraction of [0, 0.5, 1, 1.2]) {
    const voltage = (high ? 15 : 3) * fraction;
    const r = calculateDualRange('voltmeter', high, voltage);
    near(r.meterCurrent, 0.001 * fraction);
    near(r.totalCurrent, r.meterCurrent);
    near(r.resistorCurrent, r.meterCurrent);
    near(r.baseCurrent, r.meterCurrent);
    near(r.meterVoltage + r.firstSeriesVoltage + r.addedVoltage, voltage);
    near(r.firstSeriesVoltage, r.meterCurrent * 2900);
    near(r.addedCurrent, high ? r.meterCurrent : 0);
    near(r.addedVoltage, r.addedCurrent * 12000);
    if (!high) {
      const original = calculate('voltmeter', DEFAULTS.voltmeter.resistor, voltage);
      near(r.meterCurrent, original.meterCurrent);
      near(r.baseVoltage, voltage);
    }
  }
  const full = calculateDualRange('voltmeter', true, 15);
  near(full.baseVoltage, 3); near(full.meterVoltage, 0.1);
  near(full.firstSeriesVoltage, 2.9); near(full.addedVoltage, 12);
  near(calculateDualRange('voltmeter', false, 3).meterCurrent / calculateDualRange('voltmeter', true, 3).meterCurrent, 5);
  assert.ok(calculateDualRange('voltmeter', false, 15).meterCurrent > MOVEMENT.fullCurrent);
});
test('参考图抽头电流表：接 2 为 G∥(R1+R2)，接 1 为 (G+R2)∥R1', () => {
  const d = dualRangeDesign('ammeter');
  near(d.r1, 20 / 599); near(d.r2, 80 / 599);
  near(d.r1 + d.r2, DEFAULTS.ammeter.resistor);
  // 从两种接法各自的满偏条件验证分段阻值。
  near((0.6 - 0.001) * (d.r1 + d.r2), 0.001 * 100);
  near((3 - 0.001) * d.r1, 0.001 * (100 + d.r2));
  for (const high of [false, true]) for (const fraction of [0, 0.5, 1, 1.2]) {
    const r = calculateDualRange('ammeter', high, (high ? 3 : 0.6) * fraction);
    near(r.meterCurrent, 0.001 * fraction);
    // 三个节点分别检查电流守恒；R2 取从右向左为正。
    near(r.r1Current + r.meterCurrent, r.totalCurrent);
    near(r.r1Current - r.r2Current, high ? r.totalCurrent : 0);
    near(r.r2Current + r.meterCurrent, high ? 0 : r.totalCurrent);
    near(r.r1Current * d.r1 + r.r2Current * d.r2, r.meterVoltage);
    near(r.terminalVoltage, high ? r.meterCurrent * (100 + d.r2) : r.meterVoltage);
    near(r.r2Current, high ? -r.meterCurrent : r.r1Current);
  }
  const low = calculateDualRange('ammeter', false, 0.6);
  const high = calculateDualRange('ammeter', true, 3);
  near(low.r1Current, 0.599); near(low.r2Current, 0.599);
  near(high.r1Current, 2.999); near(high.r2Current, -0.001);
  near(low.meterCurrent / calculateDualRange('ammeter', true, 0.6).meterCurrent, 5);
});
test('欧姆表两种换挡方式均需调零，各倍率短接满偏、中心半偏、开路零偏', () => {
  for (const method of ['battery', 'movement']) for (const multiplier of [10, 100, 1000]) {
    const d = ohmmeterRangeDesign(multiplier, method);
    near(d.center, multiplier * 15);
    if (multiplier !== 100) assert.notEqual(calculateOhmmeter(d, 1400, 0).fraction, 1);
    for (const [resistance, fraction] of [[0, 1], [d.center, 0.5], [Infinity, 0]]) {
      const r = calculateOhmmeter(d, d.zeroResistance, resistance);
      near(r.fraction, fraction);
      const value = dialReading('ohmmeter', r.fraction, d.center);
      if (resistance === Infinity) assert.equal(value, Infinity); else near(value, resistance);
    }
  }
});
