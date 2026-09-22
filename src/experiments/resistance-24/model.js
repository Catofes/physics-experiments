// Exact fractions keep 24 Ω distinct from a rounded display value.
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
export function fraction(n, d = 1) {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function format(r) { return r.d === 1 ? `${r.n}` : `${r.n}/${r.d}`; }
export function resistor(value, id) {
  return { id, value: fraction(value), label: `R${id + 1}`, op: 'resistor' };
}
export function connect(a, b, op) {
  if (!['series', 'parallel'].includes(op)) throw new Error('Unknown connection');
  const x = a.value, y = b.value;
  const value = op === 'series'
    ? fraction(x.n * y.d + y.n * x.d, x.d * y.d)
    : fraction(x.n * y.n, x.n * y.d + y.n * x.d);
  return { id: `(${a.id}:${op}:${b.id})`, op, a, b, value };
}
export function describe(node) {
  return node.op === 'resistor' ? `${node.label}（${format(node.value)} Ω）`
    : `（${describe(node.a)} ${node.op === 'series' ? '串联' : '并联'} ${describe(node.b)}）`;
}
export function steps(node) {
  if (node.op === 'resistor') return [];
  return [...steps(node.a), ...steps(node.b), {
    text: `${describe(node.a)}与${describe(node.b)}${node.op === 'series' ? '串联' : '并联'}`,
    calculation: node.op === 'series'
      ? `(${format(node.a.value)}) + (${format(node.b.value)}) = ${format(node.value)} Ω`
      : `(${format(node.a.value)}) × (${format(node.b.value)}) ÷ [(${format(node.a.value)}) + (${format(node.b.value)})] = ${format(node.value)} Ω`,
  }];
}
export function solve(nodes) {
  if (nodes.length === 1) return nodes[0].value.n === 24 * nodes[0].value.d ? nodes[0] : null;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const rest = nodes.filter((_, k) => k !== i && k !== j);
    for (const op of ['series', 'parallel']) {
      const result = solve([...rest, connect(nodes[i], nodes[j], op)]);
      if (result) return result;
    }
  }
  return null;
}
export const levels = [
  { id: 'intro', title: '入门', subtitle: '3 个电阻 · 串并联混合', puzzles: [[12, 18, 36], [8, 24, 48], [6, 30, 45], [36, 24, 48]] },
  { id: 'middle', title: '进阶', subtitle: '4 个电阻 · 分组连接', puzzles: [[12, 12, 24, 72], [12, 8, 30, 48], [15, 16, 60, 48], [12, 16, 30, 40]] },
  { id: 'challenge', title: '挑战', subtitle: '4 个电阻 · 嵌套连接', puzzles: [[4, 25, 40, 60], [9, 20, 24, 36], [14, 15, 12, 18], [40, 48, 18, 36]] },
];
