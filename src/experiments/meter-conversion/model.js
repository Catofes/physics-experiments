export const MOVEMENT = Object.freeze({ fullCurrent: 0.001, resistance: 100, battery: 1.5 });

export const DEFAULTS = Object.freeze({
  ammeter: { resistor: 100 / 599, stimulus: 0.6 },
  voltmeter: { resistor: 2900, stimulus: 1.8 },
  ohmmeter: { resistor: 1400, stimulus: 1500 },
});

export function ammeterRange(shunt) {
  return MOVEMENT.fullCurrent * (MOVEMENT.resistance + shunt) / shunt;
}

export function voltmeterRange(series) {
  return MOVEMENT.fullCurrent * (MOVEMENT.resistance + series);
}

export function ohmmeterZero(series) {
  return MOVEMENT.battery / (MOVEMENT.resistance + series);
}

export function calculate(mode, resistor, stimulus, connected = true) {
  if (!connected) return { meterCurrent: 0, totalCurrent: 0, resistorCurrent: 0, meterVoltage: 0, resistorVoltage: 0, range: 0 };
  if (mode === 'ammeter') {
    const meterCurrent = stimulus * resistor / (MOVEMENT.resistance + resistor);
    return {
      meterCurrent, totalCurrent: stimulus, resistorCurrent: stimulus - meterCurrent,
      meterVoltage: meterCurrent * MOVEMENT.resistance,
      resistorVoltage: meterCurrent * MOVEMENT.resistance,
      range: ammeterRange(resistor),
    };
  }
  if (mode === 'voltmeter') {
    const meterCurrent = stimulus / (MOVEMENT.resistance + resistor);
    return {
      meterCurrent, totalCurrent: meterCurrent, resistorCurrent: meterCurrent,
      meterVoltage: meterCurrent * MOVEMENT.resistance,
      resistorVoltage: meterCurrent * resistor,
      range: voltmeterRange(resistor),
    };
  }
  if (mode === 'ohmmeter') {
    const meterCurrent = stimulus === Infinity ? 0 : MOVEMENT.battery / (MOVEMENT.resistance + resistor + stimulus);
    return {
      meterCurrent, totalCurrent: meterCurrent, resistorCurrent: meterCurrent,
      meterVoltage: meterCurrent * MOVEMENT.resistance,
      resistorVoltage: meterCurrent * resistor,
      range: MOVEMENT.resistance + resistor,
    };
  }
  throw new Error(`Unknown meter mode: ${mode}`);
}

export function dialReading(mode, fraction, range) {
  if (mode === 'ohmmeter') return fraction <= 0 ? Infinity : range * (1 / fraction - 1);
  return fraction * range;
}

// 电压表增加串联电阻；电流表将原分流电阻分段并引出抽头。
export function dualRangeDesign(mode) {
  if (mode === 'voltmeter') {
    const firstSeries = DEFAULTS.voltmeter.resistor;
    return { low: 3, high: 15, firstSeries,
      baseResistance: MOVEMENT.resistance + firstSeries,
      addedResistance: (15 - 3) / MOVEMENT.fullCurrent };
  }
  const totalShunt = DEFAULTS.ammeter.resistor;
  const r1 = totalShunt * 0.6 / 3;
  return { low: 0.6, high: 3, r1, r2: totalShunt - r1 };
}

export function calculateDualRange(mode, high, stimulus) {
  const design = dualRangeDesign(mode);
  if (mode === 'ammeter') {
    // 黑表笔接左侧 COM，红表笔接右端或中间抽头。
    // 低挡：G ∥ (R1 + R2)；高挡：(G + R2) ∥ R1。
    const meterBranchResistance = MOVEMENT.resistance + (high ? design.r2 : 0);
    const shuntResistance = design.r1 + (high ? 0 : design.r2);
    const meterCurrent = stimulus * shuntResistance / (meterBranchResistance + shuntResistance);
    const shuntCurrent = stimulus - meterCurrent;
    return { meterCurrent, totalCurrent: stimulus, range: high ? design.high : design.low,
      meterVoltage: meterCurrent * MOVEMENT.resistance,
      terminalVoltage: shuntCurrent * shuntResistance,
      r1Current: shuntCurrent,
      // 电阻电流以图中从右向左（流向 COM）为正；高挡时 R2 电流反向。
      r2Current: high ? -meterCurrent : shuntCurrent };
  }
  const baseCurrent = stimulus / (design.baseResistance + (high ? design.addedResistance : 0));
  const base = calculate('voltmeter', design.firstSeries, baseCurrent * design.baseResistance);
  return { ...base, range: high ? design.high : design.low, baseCurrent,
    firstSeriesVoltage: baseCurrent * design.firstSeries,
    addedCurrent: high ? baseCurrent : 0,
    baseVoltage: baseCurrent * design.baseResistance,
    addedVoltage: high ? baseCurrent * design.addedResistance : 0 };
}

export function ohmmeterRangeDesign(multiplier, method) {
  const center = 15 * multiplier;
  const battery = method === 'battery' ? center * MOVEMENT.fullCurrent : MOVEMENT.battery;
  const fullCurrent = method === 'movement' ? battery / center : MOVEMENT.fullCurrent;
  return { center, battery, fullCurrent, resistance: MOVEMENT.resistance, zeroResistance: center - MOVEMENT.resistance };
}

export function calculateOhmmeter(design, series, resistance) {
  const meterCurrent = resistance === Infinity ? 0 : design.battery / (design.resistance + series + resistance);
  return { meterCurrent, fraction: meterCurrent / design.fullCurrent };
}
