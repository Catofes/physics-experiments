import test from "node:test";
import assert from "node:assert/strict";
import {
  createElectrostaticModel,
  sceneMeta,
} from "../src/experiments/electrostatic-field/physics.js";
import {
  runPhysicsValidation,
  SCENES,
} from "../src/experiments/magnetic-field/physics.js";
import { computeJob } from "../src/experiments/magnetic-field/compute-job.js";
import { ComputeClient } from "../src/experiments/magnetic-field/compute-client.js";

test("磁场模型的解析关系、叠加与极端参数检查", () => {
  const report = runPhysicsValidation();
  assert.equal(
    report.passed,
    report.total,
    JSON.stringify(report.checks.filter((c) => !c.pass)),
  );
});
test("静电场七种场景可解，导体净电荷与腔内感应电荷约束成立", () => {
  for (const scene of Object.keys(sceneMeta)) {
    for (const sign of [-1, 1]) {
      const m = createElectrostaticModel({ chargeSign: sign });
      m.setScene(scene);
      if (scene === "rod") {
        for (const g of m.getRodBemSolution().groups)
          for (let i = 0; i < g.boundaries.length; i++) {
            const expected = g.boundaries[i].role === "rodPlate" ? 1 : 0;
            assert.ok(
              Math.abs(m.rodBoundaryPotentialAt(g, i) - expected) < 1e-7,
            );
          }
        continue;
      }
      const s = m.getBemSolution();
      assert.ok(s.charges.every(Number.isFinite));
      const total = s.charges.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - s.netCharge) < 1e-7, scene);
      if (scene === "cavity") {
        const inner = s.charges.reduce(
          (a, q, i) => a + (s.boundaries[i].role === "inner" ? q : 0),
          0,
        );
        // Reference 2D discretization gives about 6% error for this cavity.
        assert.ok(Math.abs(inner + sign) < 0.08);
      }
      if (scene === "shield")
        assert.ok(
          s.charges.every(
            (q, i) => s.boundaries[i].role !== "inner" || q === 0,
          ),
        );
    }
  }
});
test("电荷拖动约束与模型实例相互隔离", () => {
  const a = createElectrostaticModel(),
    b = createElectrostaticModel();
  a.state.charge = a.constrainCharge({ x: 0, y: 0 });
  assert.ok(a.normalizedDistance(a.state.charge, { x: 0.56, y: 0.5 }) < 0.087);
  a.setScene("solid");
  assert.equal(b.state.scene, "cavity");
  assert.deepEqual(b.state.charge, { x: 0.5, y: 0.48 });
});
test("磁场后台任务产出场线与热力图", () => {
  const def = SCENES.find((s) => s.id === "straight-wire");
  const result = computeJob({
    sceneId: def.id,
    params: Object.fromEntries(def.params.map((p) => [p.id, p.val])),
    section: def.section,
    size: def.size,
    kinds: ["field", "heat", "section"],
  });
  assert.ok(result.field.lines.length > 0);
  assert.ok(result.section.lines.length > 0);
  assert.ok(result.heat.scaleB > 0);
  assert.ok(result.field.lines.every((line) => line.every(Number.isFinite)));
});
test("磁场任务取消时终止旧线程，旧结果不能覆盖新任务，销毁终止空闲线程", async () => {
  const workers = [];
  const client = new ComputeClient(() => {
    const w = {
      postMessage(message) {
        this.message = message;
      },
      terminate() {
        this.terminated = true;
      },
    };
    workers.push(w);
    return w;
  });
  const first = client.run({ sceneId: "earth" });
  const rejected = assert.rejects(first, { name: "AbortError" });
  const second = client.run({ sceneId: "straight-wire" });
  await rejected;
  assert.equal(workers[0].terminated, true);
  workers[0].onmessage({ data: { id: workers[0].message.id, result: "old" } });
  workers[1].onmessage({ data: { id: workers[1].message.id, result: "new" } });
  assert.equal(await second, "new");
  client.dispose();
  assert.equal(workers[1].terminated, true);
});
