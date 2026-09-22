// Distances in km, times in seconds, velocities in km/s (ellipsePosition uses days).
export const TAU = 2 * Math.PI;
export const R = 6371, MU = 398600.4418, MOON_MU = 4902.8;
export const MOON_DISTANCE = 384400, MOON_RADIUS = 1737.4;
export const MOON_PERIOD = 27.321661 * 86400;
export const SOI = MOON_DISTANCE * (MOON_MU / MU) ** 0.4;
export const SIDEREAL_DAY = 86164.0905;
export function solveE(mean, e) {
  const m = Math.atan2(Math.sin(mean), Math.cos(mean));
  let a = e > 0.8 ? (m < 0 ? -Math.PI : Math.PI) : m;
  for (let i = 0; i < 40; i++) { const d = (a - e * Math.sin(a) - m) / (1 - e * Math.cos(a)); a -= d; if (Math.abs(d) < 1e-12) break; }
  return a;
}
export function ellipsePosition(a, e, period, day, phase = 0, rotation = 0) {
  const E = solveE(day / period * TAU + phase, e);
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return { x: x * Math.cos(rotation) - y * Math.sin(rotation), y: x * Math.sin(rotation) + y * Math.cos(rotation) };
}
export function systemPosition(day, lunar = false) {
  const parent = lunar ? ellipsePosition(384400, .0549, 27.321661, day, .12, -.08) : ellipsePosition(149597870.7, .0167086, 365.256363, day, .12, -.08);
  const local = lunar ? { x: 6142.58 * Math.cos(day / .5 * TAU + Math.PI), y: 6142.58 * Math.sin(day / .5 * TAU + Math.PI) } : ellipsePosition(384400, .0549, 27.321661, day, 2.25, .48);
  return { parent, child: { x: parent.x + local.x, y: parent.y + local.y } };
}
export function groundPoint(phase, inclination, period = SIDEREAL_DAY, rotating = true) {
  const u = phase * TAU, i = inclination * Math.PI / 180;
  const x = Math.cos(u), y = Math.sin(u) * Math.cos(i), z = Math.sin(u) * Math.sin(i);
  const spin = rotating ? phase * period / SIDEREAL_DAY * TAU : 0;
  return { x, y, z, lat: Math.asin(z) * 180 / Math.PI, lon: Math.atan2(-x * Math.sin(spin) + y * Math.cos(spin), x * Math.cos(spin) + y * Math.sin(spin)) * 180 / Math.PI };
}
export function moonState(t) {
  const a = .9 + TAU * t / MOON_PERIOD, n = TAU / MOON_PERIOD;
  return { x: MOON_DISTANCE * Math.cos(a), y: MOON_DISTANCE * Math.sin(a), vx: -MOON_DISTANCE * n * Math.sin(a), vy: MOON_DISTANCE * n * Math.cos(a) };
}
export function acceleration(p, t, lunar = false) {
  const r = Math.hypot(p.x, p.y), factor = -MU / r ** 3;
  let x = p.x * factor, y = p.y * factor;
  if (lunar) {
    const m = moonState(t), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
    // Geocentric nonrotating frame: subtract the Moon's acceleration of Earth.
    x += MOON_MU * (dx / d ** 3 - m.x / MOON_DISTANCE ** 3);
    y += MOON_MU * (dy / d ** 3 - m.y / MOON_DISTANCE ** 3);
  }
  return { x, y };
}
export function elements(p, mu = MU) {
  const radius = Math.hypot(p.x, p.y), speed = Math.hypot(p.vx, p.vy);
  const energy = speed ** 2 / 2 - mu / radius, h = p.x * p.vy - p.y * p.vx;
  const eccentricity = Math.sqrt(Math.max(0, 1 + 2 * energy * h ** 2 / mu ** 2));
  const a = energy < 0 ? -mu / (2 * energy) : Infinity;
  return { radius, speed, energy, eccentricity, radial: (p.x * p.vx + p.y * p.vy) / radius, circular: Math.sqrt(mu / radius), perigee: h ** 2 / mu / (1 + eccentricity), apogee: a === Infinity ? Infinity : a * (1 + eccentricity), period: energy < 0 ? TAU * Math.sqrt(a ** 3 / mu) : Infinity };
}
export function initialSatellite() { const r = R + 900; return { x: r, y: 0, vx: 0, vy: Math.sqrt(MU / r), t: 0, crashed: '' }; }
export function relativeState(p, lunar) {
  const m = moonState(p.t);
  const nearMoon = lunar && Math.hypot(p.x - m.x, p.y - m.y) < SOI;
  return { nearMoon, state: nearMoon ? { x: p.x - m.x, y: p.y - m.y, vx: p.vx - m.vx, vy: p.vy - m.vy } : p, mu: nearMoon ? MOON_MU : MU };
}
export function burn(p, delta, lunar = false) {
  const { state } = relativeState(p, lunar), speed = Math.hypot(state.vx, state.vy);
  if (!speed || p.crashed) return p;
  return { ...p, vx: p.vx + delta * state.vx / speed, vy: p.vy + delta * state.vy / speed };
}
export function advance(p, duration, lunar = false) {
  let s = { ...p }, remaining = duration;
  while (remaining > 1e-9 && !s.crashed) {
    const m = moonState(s.t), r = Math.hypot(s.x, s.y), d = Math.hypot(s.x - m.x, s.y - m.y);
    const dt = Math.min(remaining, 20, .012 * Math.sqrt(r ** 3 / MU), lunar ? .012 * Math.sqrt(d ** 3 / MOON_MU) : Infinity);
    const a = acceleration(s, s.t, lunar);
    const next = { ...s, x: s.x + s.vx * dt + .5 * a.x * dt ** 2, y: s.y + s.vy * dt + .5 * a.y * dt ** 2, t: s.t + dt };
    const b = acceleration(next, next.t, lunar);
    next.vx += .5 * (a.x + b.x) * dt; next.vy += .5 * (a.y + b.y) * dt;
    if (Math.hypot(next.x, next.y) <= R) next.crashed = '地球';
    const moon = moonState(next.t);
    if (lunar && Math.hypot(next.x - moon.x, next.y - moon.y) <= MOON_RADIUS) next.crashed = '月球';
    s = next; remaining -= dt;
  }
  return s;
}

// Instantaneous osculating conic, not a future three-body trajectory.
export function orbitPath(state, mu = MU, limit = 1e7) {
  const r = Math.hypot(state.x, state.y), v2 = state.vx ** 2 + state.vy ** 2;
  const rv = state.x * state.vx + state.y * state.vy;
  const ex = ((v2 - mu / r) * state.x - rv * state.vx) / mu;
  const ey = ((v2 - mu / r) * state.y - rv * state.vy) / mu;
  const e = Math.hypot(ex, ey), angle = Math.atan2(ey, ex);
  const h = state.x * state.vy - state.y * state.vx, p = h * h / mu;
  if (p < 1e-8) return [];
  const end = e < 1 ? Math.PI : Math.acos(-1 / e) - .005;
  return Array.from({ length: 721 }, (_, i) => {
    const theta = -end + i / 720 * 2 * end;
    const distance = Math.min(limit, p / (1 + e * Math.cos(theta)));
    return { x: distance * Math.cos(theta + angle), y: distance * Math.sin(theta + angle) };
  });
}
export function circularize(state, lunar = false) {
  const local = relativeState(state, lunar), p = local.state, r = Math.hypot(p.x, p.y);
  const sign = p.x * p.vy - p.y * p.vx >= 0 ? 1 : -1, speed = Math.sqrt(local.mu / r);
  return { ...state, vx: state.vx - p.vx - sign * p.y / r * speed, vy: state.vy - p.vy + sign * p.x / r * speed };
}
