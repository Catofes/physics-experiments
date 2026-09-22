import { TAU } from '../orbits/physics.js';

// Physics is Z-north; Three.js uses Y-up. This proper rotation preserves handedness.
export function scenePoint({ x, y, z }) { return { x, y: z, z: -y }; }
export function surfacePoint(lat, lon, spin = 0) {
  const a = lon * Math.PI / 180 + spin, b = lat * Math.PI / 180;
  return scenePoint({ x: Math.cos(b) * Math.cos(a), y: Math.cos(b) * Math.sin(a), z: Math.sin(b) });
}
export function satelliteFrame(phase, inclination, radius, horizon = false) {
  const a = phase * TAU, i = inclination * Math.PI / 180;
  const radial = scenePoint({ x: Math.cos(a), y: Math.sin(a) * Math.cos(i), z: Math.sin(a) * Math.sin(i) });
  const tangent = scenePoint({ x: -Math.sin(a), y: Math.cos(a) * Math.cos(i), z: Math.cos(a) * Math.sin(i) });
  // Keep the forward tangent as camera-up: stable even when crossing either pole.
  // Aim just inside the forward limb. A fixed angular margin would exceed
  // Earth's apparent radius at high altitude and collapse this into nadir.
  const angularRadius = Math.asin(1 / radius);
  const tilt = horizon ? angularRadius - Math.min(.18, angularRadius * .18) : 0;
  const position = {}, direction = {}, up = {};
  for (const key of ['x', 'y', 'z']) {
    position[key] = radial[key] * radius;
    direction[key] = -radial[key] * Math.cos(tilt) + tangent[key] * Math.sin(tilt);
    up[key] = tangent[key] * Math.cos(tilt) + radial[key] * Math.sin(tilt);
  }
  return { position, direction, up };
}
