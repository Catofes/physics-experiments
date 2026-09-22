import * as THREE from "three";

// Use arc length so adaptive sampling and decimation do not bunch arrows up.
export function collectArrowSpecs(lines, options = {}) {
  const specs = [];
  for (const points of lines) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    }
    const total = lengths.at(-1);
    if (!(total > 1e-8)) continue;
    const count = Math.min(8, Math.max(2, Math.ceil(total / 4)));
    let segment = 1;
    for (let i = 0; i < count; i++) {
      const distance = ((i + 0.5) / count) * total;
      while (segment < lengths.length - 1 && lengths[segment] <= distance) segment++;
      const start = points[segment - 1], end = points[segment];
      const pos = start.clone().lerp(end,
        (distance - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1]));
      const dir = new THREE.Vector3().subVectors(end, start).normalize();
      // Keep arrows proportional on very short visible trajectories.
      const scale = Math.min(1, total / count / 0.36) * (options.scaleAt?.(pos) ?? 1);
      specs.push({ pos, dir, scale, maxLength: total / count * 0.45 });
    }
  }
  return specs;
}

// Match the lines' CSS-pixel sizing. Use view depth, not distance to the
// camera, so arrows near the edge of the viewport have the same size.
export function arrowDisplayScale(spec, camera, viewportHeight, size = 1) {
  const view = camera.matrixWorldInverse.elements;
  const { x, y, z } = spec.pos;
  const depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
  if (depth <= 0 || viewportHeight <= 0) return 0;
  const worldPerPixel = 2 * depth / (viewportHeight * camera.projectionMatrix.elements[5]);
  const length = Math.min(10 * size * spec.scale * worldPerPixel, spec.maxLength);
  return length / (0.18 * size);
}
