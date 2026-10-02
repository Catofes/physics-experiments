// Smooth, unilateral inner circular track. Coordinates: x right, y up;
// theta measured from bottom toward the right. q = v_bottom² / (g r).
export const G = 9.8;
function advance(theta, omega, dt, k) {
  const a = -k * Math.sin(theta);
  const b = -k * Math.sin(theta + omega * dt / 2);
  const c = -k * Math.sin(theta + (omega + a * dt / 2) * dt / 2);
  const d = -k * Math.sin(theta + (omega + b * dt / 2) * dt);
  return [theta + dt * (omega + 2 * (omega + a * dt / 2) + 2 * (omega + b * dt / 2) + omega + c * dt) / 6,
    omega + dt * (a + 2 * b + 2 * c + d) / 6];
}
export function circleState(theta, omega, time, radius, g = G) {
  const x = radius * Math.sin(theta), y = -radius * Math.cos(theta);
  const vx = radius * omega * Math.cos(theta), vy = radius * omega * Math.sin(theta);
  return { time, theta, x, y, vx, vy, speed: Math.hypot(vx, vy), normal: Math.max(0, radius * omega ** 2 + g * Math.cos(theta)), phase: 'circle' };
}
export function flightState(release, elapsed, g = G) {
  const vx = release.vx, vy = release.vy - g * elapsed;
  return { ...release, time: release.time + elapsed, x: release.x + vx * elapsed,
    y: release.y + release.vy * elapsed - g * elapsed ** 2 / 2,
    vx, vy, speed: Math.hypot(vx, vy), normal: 0, phase: 'flight' };
}
export function simulate(q = 4.5, radius = 2, g = G) {
  if (!(q > 0 && radius > 0 && g > 0) || ![q, radius, g].every(Number.isFinite)) throw new RangeError('Positive finite parameters required');
  const separates = q > 2 && q < 5;
  const releaseAngle = separates ? Math.acos((2 - q) / 3) : null;
  const dt = Math.sqrt(radius / g) / 500;
  let theta = 0, omega = Math.sqrt(q * g / radius), time = 0;
  const samples = [circleState(theta, omega, time, radius, g)];
  let release = null, keyIndex = 0;
  const target = separates ? releaseAngle : q >= 5 ? 2 * Math.PI : 0;
  for (let i = 0; i < 20000; i++) {
    const next = advance(theta, omega, dt, g / radius);
    const crossed = separates || q >= 5 ? next[0] >= target : omega < 0 && next[0] <= 0;
    let step = dt;
    if (crossed) {
      let lo = 0, hi = dt;
      for (let j = 0; j < 40; j++) {
        const mid = (lo + hi) / 2, angle = advance(theta, omega, mid, g / radius)[0];
        if (q <= 2 ? angle > target : angle < target) lo = mid; else hi = mid;
      }
      step = (lo + hi) / 2;
    }
    [theta, omega] = advance(theta, omega, step, g / radius);
    time += step;
    const state = circleState(theta, omega, time, radius, g);
    if (i % 5 === 0 || crossed) samples.push(state);
    if (crossed) {
      if (separates) {
        release = { ...state, normal: 0, phase: 'release' };
        samples[samples.length - 1] = release;
        keyIndex = samples.length - 1;
        // First recontact: |r(t)|²-r² = g t³ (g t/4-v_y).
        // Stop before modelling any impact or renewed constraint.
        const duration = 4 * release.vy / g;
        const count = Math.max(2, Math.ceil(duration / (5 * dt)));
        for (let j = 1; j <= count; j++) samples.push(flightState(release, duration * j / count, g));
      }
      break;
    }
  }
  if (!release) {
    keyIndex = samples.reduce((best, s, i) => s.y > samples[best].y ? i : best, 0);
  }
  return { samples, release, keyIndex, kind: separates ? 'separation' : q >= 5 ? 'complete' : 'return', radius, q };
}
