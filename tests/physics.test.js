import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  createJumpModel,
  PARAMETERS,
} from "../src/experiments/squat-jump/physics.js";
import {
  DEFAULT_STATE,
  GEO,
  computeBeam,
  sampleVoltages,
  screenSpot,
} from "../src/experiments/cathode-ray/physics.js";

test("所有目录项都有独立的 Vue 实验模块，标识唯一", () => {
  const items = JSON.parse(
    readFileSync(new URL("../src/experiments.json", import.meta.url)),
  );
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(
      item.title &&
        item.category &&
        item.description &&
        Array.isArray(item.tags),
    );
    assert.ok(
      existsSync(
        new URL(
          `../src/experiments/${item.id}/Experiment.vue`,
          import.meta.url,
        ),
      ),
    );
  }
});

test("纵跳最高点与参考能量相符，最终回到地面", () => {
  const model = createJumpModel();
  let peak = 0;
  for (let i = 0; i < 5000 && model.ball.active; i++) {
    model.step(0.02);
    peak = Math.max(peak, model.snapshot().height);
  }
  assert.ok(Math.abs(peak - 280) < 0.1);
  assert.equal(model.ball.active, false);
  assert.equal(model.snapshot().height, 0);
});

test("按真实时间推进时，60 Hz 与 120 Hz 的轨迹一致", () => {
  const a = createJumpModel(),
    b = createJumpModel();
  for (let i = 0; i < 120; i++) a.step(0.2);
  for (let i = 0; i < 240; i++) b.step(0.1);
  assert.ok(Math.abs(a.ball.yA - b.ball.yA) < 0.1);
  assert.ok(Math.abs(a.ball.vA - b.ball.vA) < 1e-8);
});

test("双质点锁定后速度一致，重置清除锁定和离地状态", () => {
  const model = createJumpModel();
  model.reset(3);
  for (let i = 0; i < 2000 && !model.ball.locked; i++) model.step(0.02);
  assert.equal(model.ball.locked, true);
  assert.equal(model.ball.vA, model.ball.vB);
  model.reset(2);
  assert.equal(model.ball.locked, false);
  assert.equal(model.ball.lifted, false);
  assert.equal(model.ball.vA, 0);
  assert.ok(Math.abs(model.snapshot().deformation - 3) < 1e-10);
  assert.equal(model.ball.yB, PARAMETERS.H - 70);
});

test("零电压下电子束不偏转，轨迹终点与荧光屏读数一致", () => {
  assert.ok(computeBeam(0, 0).every((point) => point.y === 0 && point.z === 0));
  for (const [uy, ux] of [
    [12, -9],
    [-20, 24],
    [0, 0],
  ]) {
    const end = computeBeam(uy, ux).at(-1),
      spot = screenSpot(uy, ux);
    assert.equal(end.x, GEO.screenX);
    assert.ok(Math.abs(end.y - spot.y) < 1e-10);
    assert.ok(Math.abs(end.z + spot.sx) < 1e-10);
  }
});

test("关闭扫描与直流模式不受交流幅值影响，回扫期间消隐", () => {
  const dc = sampleVoltages(
    { ...DEFAULT_STATE, ySignal: "dc", yDc: 7, sweepOn: false },
    0.5,
  );
  assert.equal(dc.uy, 7);
  assert.equal(dc.ux, 0);
  assert.equal(dc.blank, false);
  assert.equal(sampleVoltages(DEFAULT_STATE, 1.95).blank, true);
});
