export const PITCH = 0.5;
export const DIVISIONS = 50;
export const RESOLUTION = PITCH / DIVISIONS;

export function micrometerReading(opening) {
  const um = Math.max(0, Math.min(25000, Math.round(opening * 1000)));
  const sleeveUm = Math.floor(um / 500) * 500;
  return { opening: um / 1000, sleeve: sleeveUm / 1000,
    whole: Math.floor(um / 1000), half: sleeveUm % 1000 === 500,
    thimble: (um % 500) / 10, fraction: (um % 500) / 1000,
    turns: um / 500 };
}

// Local, unwrapped scale coordinates preserve continuity across 49 → 0.
export function thimbleTicks(reading, count = 8) {
  const center = Math.floor(reading.thimble);
  return Array.from({ length: count * 2 + 1 }, (_, i) => {
    const unwrapped = center + i - count;
    return { index: ((unwrapped % 50) + 50) % 50, offset: reading.thimble - unwrapped };
  });
}
