<script setup>
import { computed } from 'vue';
const props = defineProps({ x: { type: Number, default: 0 }, y: { type: Number, default: 0 }, dx: { type: Number, required: true }, dy: { type: Number, required: true }, color: { type: String, default: 'currentColor' }, dashed: Boolean });
const length = computed(() => Math.hypot(props.dx, props.dy));
const angle = computed(() => Math.atan2(props.dy, props.dx) * 180 / Math.PI);
// End the shaft at the head's base. The triangle tip is the vector endpoint.
const head = computed(() => Math.min(12, length.value * 0.65));
const halfWidth = computed(() => head.value * 0.45);
</script>
<template>
  <g v-if="length > 0.2" :transform="`translate(${x},${y}) rotate(${angle})`" :data-vector-length="length">
    <line :x2="length - head" y2="0" :stroke="color" stroke-width="2.5" stroke-linecap="butt" :stroke-dasharray="dashed ? '5 4' : undefined" />
    <path :d="`M${length} 0 L${length - head} ${halfWidth} L${length - head} ${-halfWidth} Z`" :fill="color" />
  </g>
</template>
