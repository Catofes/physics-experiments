// x is the fraction of travel from terminal B towards terminal A.
// The source is ideal, wires and the wiper contact have zero resistance.
export function solveCircuit(mode, voltage, rheostat, load, x) {
  const upper = (1 - x) * rheostat; // A to wiper P
  const lower = x * rheostat; // P to B
  if (mode === 'limit') {
    const equivalent = upper + load;
    const sourceCurrent = voltage / equivalent;
    return { upper, lower, equivalent, sourceCurrent, loadVoltage: sourceCurrent * load, loadCurrent: sourceCurrent };
  }
  if (mode !== 'divider') throw new Error('Unknown connection');
  const parallel = lower === 0 ? 0 : lower * load / (lower + load);
  const equivalent = upper + parallel;
  const sourceCurrent = voltage / equivalent;
  const loadVoltage = sourceCurrent * parallel;
  return { upper, lower, parallel, equivalent, sourceCurrent, loadVoltage, loadCurrent: loadVoltage / load };
}

export function curve(mode, voltage, rheostat, load, key) {
  return Array.from({ length: 101 }, (_, i) => solveCircuit(mode, voltage, rheostat, load, i / 100)[key]);
}
