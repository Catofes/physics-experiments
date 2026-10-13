export const DIVISIONS = [10, 20, 50];
// Textbook short verniers: N divisions occupy N-1 millimetres.

// Use integer micrometres so carrying at whole millimetres is exact.
export function caliperReading(opening, divisions = 20) {
  if (!DIVISIONS.includes(divisions)) throw new RangeError('Unsupported vernier');
  const step = 1000 / divisions;
  const um = Math.max(0, Math.min(60000, Math.round(opening * 1000 / step) * step));
  const main = Math.floor(um / 1000);
  const aligned = (um % 1000) / step;
  return { opening: um / 1000, main, aligned, fraction: aligned / divisions,
    resolution: 1 / divisions, alignedMain: main + aligned,
    span: divisions - 1, spacing: 1 - 1 / divisions };
}

export function vernierPosition(reading, index) {
  return reading.opening + index * reading.spacing;
}
