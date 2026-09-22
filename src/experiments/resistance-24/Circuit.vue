<script setup>
import { computed } from 'vue';
import { format, describe } from './model.js';
const props = defineProps({ node: { type: Object, required: true } });
function size(n) {
  if (n.op === 'resistor') return { w: 130, h: 74 };
  const a = size(n.a), b = size(n.b);
  return n.op === 'series' ? { w: a.w + b.w, h: Math.max(a.h, b.h) }
    : { w: Math.max(a.w, b.w) + 40, h: a.h + b.h };
}
const drawing = computed(() => {
  const wires = [], parts = [], dots = [];
  function wire(x1, y1, x2, y2) { wires.push({ x1, y1, x2, y2 }); }
  function walk(n, x, y, w) {
    const s = size(n);
    if (n.op === 'resistor') {
      wire(x, y, x + w / 2 - 28, y); wire(x + w / 2 + 28, y, x + w, y);
      parts.push({ x: x + w / 2, y, label: n.label, value: format(n.value) });
    } else if (n.op === 'series') {
      const aw = w * size(n.a).w / s.w;
      walk(n.a, x, y, aw); walk(n.b, x + aw, y, w - aw);
    } else {
      const ay = y - size(n.b).h / 2, by = y + size(n.a).h / 2;
      wire(x, y, x + 20, y); wire(x + w - 20, y, x + w, y);
      for (const xx of [x + 20, x + w - 20]) {
        wire(xx, ay, xx, by); dots.push({ x: xx, y });
      }
      walk(n.a, x + 20, ay, w - 40); walk(n.b, x + 20, by, w - 40);
    }
  }
  const s = size(props.node);
  walk(props.node, 20, s.h / 2 + 10, s.w);
  return { ...s, wires, parts, dots };
});
</script>
<template>
  <svg class="circuit" :viewBox="`0 0 ${drawing.w + 40} ${drawing.h + 20}`" role="img" :aria-label="describe(node)">
    <g stroke="currentColor" stroke-width="2" fill="none">
      <line v-for="(w, i) in drawing.wires" :key="i" v-bind="w" />
      <rect v-for="(p, i) in drawing.parts" :key="`r${i}`" :x="p.x - 28" :y="p.y - 10" width="56" height="20" rx="2" fill="#142936" />
    </g>
    <circle v-for="(d, i) in drawing.dots" :key="i" :cx="d.x" :cy="d.y" r="3" fill="currentColor" />
    <g v-for="(p, i) in drawing.parts" :key="`t${i}`" text-anchor="middle" fill="currentColor" font-size="13">
      <text :x="p.x" :y="p.y - 18">{{ p.label }}</text>
      <text :x="p.x" :y="p.y + 29">{{ p.value }} Ω</text>
    </g>
    <circle cx="20" :cy="drawing.h / 2 + 10" r="4" fill="currentColor" />
    <circle :cx="drawing.w + 20" :cy="drawing.h / 2 + 10" r="4" fill="currentColor" />
  </svg>
</template>
<style scoped>.circuit { display: block; width: 100%; max-height: 270px; color: #a9e5d0; }</style>
