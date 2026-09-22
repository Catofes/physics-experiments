import test from 'node:test';
import assert from 'node:assert/strict';
import { resistor, connect, format, levels, solve, steps } from '../src/experiments/resistance-24/model.js';

test('series and parallel use exact reduced fractions', () => {
  const a = resistor(12, 0), b = resistor(16, 1);
  assert.equal(format(connect(a, b, 'series').value), '28');
  assert.equal(format(connect(a, b, 'parallel').value), '48/7');
  const c = connect(resistor(30, 2), resistor(40, 3), 'parallel');
  assert.equal(format(connect(connect(a, b, 'parallel'), c, 'series').value), '24');
});

// Independent enumeration of every binary series/parallel topology, using floats
// as a cross-check of the production fraction solver and the curated difficulty.
function possibilities(values) {
  if (values.length === 1) return [{ r: values[0], depth: 0, ops: new Set() }];
  const out = [];
  for (let mask = 1; mask < (1 << values.length) - 1; mask += 2) {
    const left = values.filter((_, i) => mask & (1 << i));
    const right = values.filter((_, i) => !(mask & (1 << i)));
    for (const a of possibilities(left)) for (const b of possibilities(right)) {
      for (const op of ['series', 'parallel']) out.push({
        r: op === 'series' ? a.r + b.r : a.r * b.r / (a.r + b.r),
        depth: Math.max(a.depth, b.depth) + 1,
        ops: new Set([...a.ops, ...b.ops, op]),
      });
    }
  }
  return out;
}
for (const level of levels) for (const values of level.puzzles) {
  test(`${level.id}: ${values.join(', ')} has a mixed solution using all resistors`, () => {
    const tree = solve(values.map(resistor));
    assert.ok(tree);
    assert.equal(format(tree.value), '24');
    const leaves = n => n.op === 'resistor' ? [n.id] : [...leaves(n.a), ...leaves(n.b)];
    assert.deepEqual(leaves(tree).sort(), values.map((_, i) => i));
    assert.equal(steps(tree).length, values.length - 1);
    const solutions = possibilities(values).filter(s => Math.abs(s.r - 24) < 1e-9);
    assert.ok(solutions.length);
    assert.ok(solutions.every(s => s.ops.size === 2), 'no all-series or all-parallel shortcut');
    if (level.id === 'challenge') assert.ok(solutions.every(s => s.depth === 3), 'challenge requires nested connections');
  });
}
test('solver recognizes an unsolvable partial circuit', () => {
  assert.equal(solve([connect(resistor(18, 0), resistor(36, 1), 'series'), resistor(12, 2)]), null);
});
