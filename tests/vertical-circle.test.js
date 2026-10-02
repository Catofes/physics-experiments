import test from 'node:test';
import assert from 'node:assert/strict';
import { G, simulate } from '../src/experiments/vertical-circle/physics.js';
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);
test('圆轨道能量守恒，分离后机械能及水平速度守恒', () => {
  for (const q of [0.5, 1.5, 2, 2.01, 3, 4.5, 4.99, 5, 6.5]) {
    for (const radius of [0.5, 2, 5]) {
      const model = simulate(q, radius);
      for (const s of model.samples) {
        near(s.speed ** 2 / 2 + G * (s.y + radius), q * G * radius / 2);
        if (s.phase === 'circle') near(Math.hypot(s.x, s.y), radius);
        if (s.phase === 'flight') { near(s.vx, model.release.vx); near(s.normal, 0); }
      }
    }
  }
});
test('分离角、切向速度及再次接触均满足解析条件', () => {
  for (const q of [2.01, 3, 4.5, 4.99]) {
    const { release, samples } = simulate(q, 2);
    near(Math.cos(release.theta), (2-q)/3);
    near(release.speed ** 2, G * release.y);
    near(release.x * release.vx + release.y * release.vy, 0);
    const flight = samples.filter(s => s.phase === 'flight');
    for (const s of flight.slice(0,-1)) assert.ok(Math.hypot(s.x,s.y) < 2 + 1e-10);
    near(Math.hypot(samples.at(-1).x,samples.at(-1).y), 2);
  }
});
test('低速与水平临界会折返，不错误进入抛体；过顶临界完整绕行', () => {
  for (const q of [0.5, 1.5, 2]) {
    const model = simulate(q);
    assert.equal(model.release,null);
    assert.equal(model.kind,'return');
    near(model.samples.at(-1).theta,0);
    assert.ok(model.samples.at(-1).vx < 0);
    assert.ok(model.samples[model.keyIndex].y <= 1e-8);
  }
  for (const q of [5,6]) {
    const model=simulate(q);
    assert.equal(model.release,null);
    near(model.samples.at(-1).theta,2*Math.PI);
    near(model.samples[model.keyIndex].speed ** 2, (q-4)*G*2, 0.001);
  }
});
