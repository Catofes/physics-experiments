<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { currentDisplay } from './physics.js';
const props = defineProps({ params: Object, reading: Object, samples: Array, fit: Object, corrected: Array, correctedFit: Object, apparent: Object, showCorrection: Boolean, showTruth: Boolean });
const root = ref(null), width = ref(600);
let observer;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(280, entry.contentRect.width); });
  observer.observe(root.value);
});
onUnmounted(() => observer?.disconnect());
const measured = computed(() => props.fit || props.apparent);
const maxI = computed(() => Math.max(props.params.emf / props.params.resistance, measured.value.emf / measured.value.resistance) * 1.1);
const maxU = computed(() => props.params.emf * 1.12);
const currentScale = computed(() => currentDisplay(props.params.emf, props.params.resistance));
const ticks = [0, 1, 2, 3, 4];
const x = value => 55 + value / maxI.value * (width.value - 78);
const y = value => 266 - value / maxU.value * 222;
const point = p => [x(p.i), y(p.u)];
const line = source => {
  const a = point({ i: 0, u: source.emf }), b = point({ i: source.emf / source.resistance, u: 0 });
  return `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
};
const actual = computed(() => ({ i: props.reading.sourceCurrent, u: props.reading.terminalVoltage }));
const errorPath = computed(() => {
  const a = point(props.reading), b = point(actual.value);
  return `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
});
const tickLabel = (n, max) => max >= 10 ? n.toFixed(1) : n.toFixed(2);
</script>

<template>
  <div ref="root" class="plot-root">
    <svg class="emf-plot" :viewBox="`0 0 ${width} 320`" role="img" :aria-label="`横轴电流 I，纵轴电压 U，已记录 ${samples.length} 组，显示两轴截距`">
      <defs><clipPath id="emf-plot-clip"><rect x="55" y="36" :width="width - 78" height="230" /></clipPath></defs>
      <g class="grid"><path v-for="n in ticks" :key="n" :d="`M55 ${y(n / 4 * maxU)} H${width - 23} M${x(n / 4 * maxI)} 44 V266`" /></g>
      <path class="axis" :d="`M55 35 V266 H${width - 17}`" />
      <g class="axis-text">
        <text x="55" y="22">U / V</text>
        <text v-for="n in ticks" :key="`y${n}`" x="46" :y="y(n / 4 * maxU) + 4" text-anchor="end">{{ tickLabel(n / 4 * maxU, maxU) }}</text>
        <text v-for="n in ticks" :key="`x${n}`" :x="x(n / 4 * maxI)" y="288" text-anchor="middle">{{ tickLabel(n / 4 * maxI * currentScale.factor, maxI * currentScale.factor) }}</text>
        <text :x="width / 2 + 15" y="313" text-anchor="middle">I / {{ currentScale.unit }}</text>
      </g>
      <g clip-path="url(#emf-plot-clip)">
        <path v-if="showTruth" class="truth-line" :d="line({ emf: params.emf, resistance: params.resistance })" />
        <path :class="['measured-line', { fitted: fit }]" :d="line(measured)" />
        <path v-if="showCorrection && correctedFit" class="corrected-line" :d="line(correctedFit)" />
        <circle v-for="(p, index) in samples" :key="`s${index}`" class="sample-dot" :cx="point(p)[0]" :cy="point(p)[1]" r="4.5" />
        <g v-if="showCorrection">
          <rect v-for="(p, index) in corrected" :key="`c${index}`" class="corrected-dot" :x="point(p)[0] - 3.5" :y="point(p)[1] - 3.5" width="7" height="7" />
        </g>
        <g>
          <path v-if="showTruth" class="error-vector" :d="errorPath" />
          <circle v-if="showTruth" class="true-point" :cx="point(actual)[0]" :cy="point(actual)[1]" r="5" />
          <circle class="live-point" :cx="point(reading)[0]" :cy="point(reading)[1]" r="7" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.plot-root { min-width: 0; width: 100%; }
svg { display: block; width: 100%; }
.grid { fill: none; stroke: #e6ede8; stroke-width: 1; }.axis { fill: none; stroke: #8b9e92; stroke-width: 1.3; }.axis-text { fill: #657d6e; font-size: 12px; font-variant-numeric: tabular-nums; }
.truth-line { fill: none; stroke: #7e8b91; stroke-width: 2; stroke-dasharray: 7 5; }.measured-line { fill: none; stroke: #c28b2a; stroke-width: 2; stroke-dasharray: 3 4; }.measured-line.fitted { stroke-width: 2.5; stroke-dasharray: none; }
.corrected-line { fill: none; stroke: #21856c; stroke-width: 2.5; }.sample-dot { fill: #c28b2a; stroke: white; stroke-width: 1.5; }.corrected-dot { fill: #21856c; stroke: white; stroke-width: 1; }
.live-point { fill: white; stroke: #c28b2a; stroke-width: 2.5; }.true-point { fill: white; stroke: #7e8b91; stroke-width: 2; }.error-vector { stroke: #b07a28; stroke-width: 2; stroke-dasharray: 3 3; }
</style>
