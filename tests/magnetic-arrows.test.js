import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { arrowDisplayScale, collectArrowSpecs } from "../src/experiments/magnetic-field/arrows.js";

test("磁感线箭头按弧长分布，不受不均匀采样影响", () => {
  const points = [0, 0, 0.01, 0.02, 0.03, 4, 12].map(x => new Vector3(x, 0, 0));
  const arrows = collectArrowSpecs([points]);
  assert.deepEqual(arrows.map(a => a.pos.x), [2, 6, 10]);
  assert.ok(arrows.every(a => a.dir.x === 1));
  const reverse = collectArrowSpecs([[...points].reverse()]);
  assert.deepEqual(reverse.map(a => a.pos.x), [10, 6, 2]);
  assert.ok(reverse.every(a => a.dir.x === -1));
});

test("短磁感线也有方向箭头，退化轨迹不产生无效箭头", () => {
  const arrows = collectArrowSpecs([[new Vector3(), new Vector3(0.1, 0, 0)]]);
  assert.equal(arrows.length, 2);
  assert.ok(arrows.every(a => a.scale > 0 && a.scale < 1));
  assert.deepEqual(collectArrowSpecs([[], [new Vector3()], [new Vector3(), new Vector3()]]), []);
});

test("缩放、视口变化和透视深度不改变磁感线箭头的屏幕尺寸", () => {
  const camera = new PerspectiveCamera(48, 1, 0.1, 200);
  const [spec] = collectArrowSpecs([[new Vector3(-2, 0, 0), new Vector3(2, 0, 0)]]);
  for (const distance of [4, 12, 40]) {
    camera.position.z = distance;
    camera.updateMatrixWorld();
    for (const height of [400, 1000]) {
      for (const size of [1, 0.85]) {
        const scale = arrowDisplayScale(spec, camera, height, size);
        const bottom = spec.pos.clone().add(new Vector3(0, -0.09 * size * scale, 0)).project(camera);
        const top = spec.pos.clone().add(new Vector3(0, 0.09 * size * scale, 0)).project(camera);
        assert.ok(Math.abs((top.y - bottom.y) * height / 2 - 10 * size) < 1e-6);
        const offCenter = { ...spec, pos: spec.pos.clone().setX(5) };
        assert.equal(arrowDisplayScale(offCenter, camera, height, size), scale);
      }
    }
  }
});

test("远距离短磁感线的箭头不会互相重叠，镜头后方不生成反向尺寸", () => {
  const camera = new PerspectiveCamera(48, 1, 0.1, 200);
  const [spec] = collectArrowSpecs([[new Vector3(), new Vector3(0.1, 0, 0)]]);
  camera.position.z = 100;
  camera.updateMatrixWorld();
  assert.ok(0.18 * arrowDisplayScale(spec, camera, 400) <= 0.1 / 2 * 0.45);
  camera.position.z = -1;
  camera.updateMatrixWorld();
  assert.equal(arrowDisplayScale(spec, camera, 400), 0);
  assert.equal(arrowDisplayScale(spec, camera, 0), 0);
});
