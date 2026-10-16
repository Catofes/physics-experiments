// A position is named relative to the source (E, r), not to the load.
export function loadRange(resistance) {
  // Match the load to the source while keeping the six sample loads exact.
  const max = Math.max(20, Math.ceil(resistance / 2) * 20);
  return { min: max / 10, max };
}

export function samplingLoads(resistance) {
  const { max } = loadRange(resistance);
  return [1, .6, .4, .25, .15, .1].map(fraction => max * fraction);
}

export function currentDisplay(emf, resistance) {
  const fullScale = emf / resistance;
  if (fullScale < .001) return { factor: 1e6, unit: 'μA' };
  if (fullScale < .01) return { factor: 1000, unit: 'mA' };
  return { factor: 1, unit: 'A' };
}

export function meterResistances({ ideal, ra, rv }) {
  return { ra: ideal ? 0 : ra, rv: ideal ? Infinity : rv };
}

export function solveCircuit({ emf, resistance, load, connection, ideal, ra, rv }) {
  if (!['external', 'internal'].includes(connection)) throw new Error('Unknown connection');
  ({ ra, rv } = meterResistances({ ideal, ra, rv }));
  let i, u, sourceCurrent, loadCurrent;
  if (connection === 'external') {
    // V spans the source. A measures the load branch, excluding I_V.
    const conductance = 1 / (load + ra) + 1 / rv;
    u = emf / (1 + resistance * conductance);
    i = u / (load + ra);
    sourceCurrent = i + u / rv;
    loadCurrent = i;
  } else {
    // A is in the common source branch. V excludes A's voltage drop.
    const parallel = 1 / (1 / load + 1 / rv);
    i = emf / (resistance + ra + parallel);
    sourceCurrent = i;
    u = i * parallel;
    loadCurrent = u / load;
  }
  return { i, u, sourceCurrent, terminalVoltage: emf - resistance * sourceCurrent, iv: u / rv, ua: i * ra, loadCurrent };
}

export function apparentSource({ emf, resistance, connection, ideal, ra, rv }) {
  ({ ra, rv } = meterResistances({ ideal, ra, rv }));
  const factor = connection === 'external' ? 1 / (1 + resistance / rv) : 1;
  return { emf: emf * factor, resistance: connection === 'external' ? resistance * factor : resistance + ra };
}

// Correct each measured point before fitting. No true E or r is used here.
export function correctReading({ i, u }, params) {
  const { ra, rv } = meterResistances(params);
  return params.connection === 'external' ? { i: i + u / rv, u } : { i, u: u + i * ra };
}

// Fit U = intercept + slope*I in physical units.
export function fitReadings(readings) {
  if (readings.length < 2) return null;
  const points = readings.map(({ i, u }) => [i, u]);
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const variance = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  if (variance < 1e-20) return null;
  const slope = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / variance;
  if (slope >= -1e-12) return null;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, emf: intercept, resistance: -slope };
}
