<script setup>
import { computed } from 'vue';
import MathFormula from '../../components/MathFormula.vue';
import VectorArrow from './VectorArrow.vue';
import { G } from './physics.js';
const props = defineProps({ state: { type: Object, required: true }, radius: { type: Number, required: true } });
const free = computed(() => props.state.phase === 'flight');
const required = computed(() => props.state.speed ** 2 / (props.radius * G));
const gravity = computed(() => -Math.cos(props.state.theta));
const support = computed(() => props.state.normal / G);
// Fixed across time and presets: the supported initial-speed range gives N <= 7.5 mg.
const scale = 30;
const origin = 60;
const ticks = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const rows = computed(() => [
  { title: '维持圆周运动所需', tex: String.raw`F_{\text{需}}=\frac{mv^2}{r}`, value: required.value, color: '#8161ac' },
  { title: '重力沿半径的分量', tex: String.raw`F_{g,r}=-mg\cos\theta`, value: gravity.value, color: '#be6736' },
  { title: '轨道提供的支持力', tex: 'N', value: support.value, color: '#337fc0' },
]);
const amount = value => String.raw`${Math.abs(value) < 0.005 ? '0' : value.toFixed(2)}\,mg`;
</script>
<template>
  <section class="radial-panel" aria-label="向心力对照">
    <h2>沿半径看：需要多少，提供多少？</h2>
    <template v-if="!free">
      <p class="direction">下面统一用向右表示“指向圆心”<br />固定刻度：每格 <MathFormula tex="mg" />，全程保持不变</p>
      <div v-for="row in rows" :key="row.title" class="force-row" :style="{ color: row.color }">
        <div class="force-title"><span>{{ row.title }}</span><MathFormula :tex="amount(row.value)" /></div>
        <MathFormula :tex="row.tex" />
        <svg viewBox="0 0 340 64" role="img" :aria-label="`${row.title}：${row.value.toFixed(2)} 倍重力，${row.value >= 0 ? '指向圆心' : '背离圆心'}`">
          <path d="M30 22H300" stroke="#dce5df" />
          <g v-for="tick in ticks" :key="tick">
            <line :x1="origin + tick * scale" :x2="origin + tick * scale" y1="6" y2="36" :stroke="tick === 0 ? '#8ca698' : '#e6ece8'" />
            <text :x="origin + tick * scale" y="53" text-anchor="middle" fill="#6b7c72">{{ tick }}</text>
          </g>
          <circle :cx="origin" cy="22" r="3" fill="#71877b" />
          <VectorArrow :x="origin" :y="22" :dx="row.value * scale" :dy="0" :color="row.color" :dashed="row.title.startsWith('重力')" />
        </svg>
      </div>
      <div class="balance">
        <MathFormula tex="\underbrace{N+F_{g,r}}_{\text{实际提供}}=\underbrace{\frac{mv^2}{r}}_{\text{圆周运动所需}}" />
        <p v-if="state.phase === 'release'" data-testid="radial-release">分离瞬间：<MathFormula tex="N=0" />，重力的径向分量恰好满足需要。<strong>重力 <MathFormula tex="mg\ne0" />。</strong></p>
        <p v-else-if="gravity < -0.005">重力分量背离圆心，支持力还需抵消这部分，再提供所需向心力。</p>
        <p v-else>重力分量与支持力共同提供所需向心力。</p>
      </div>
      <p class="footnote">紫色表示“需要的合力”，橙色虚线是重力的分量，二者都不是额外作用在小球上的力。</p>
    </template>
    <div v-else class="free-flight" data-testid="radial-flight">
      <MathFormula tex="N=0,\qquad \vec a=\vec g" />
      <p>已经离开圆轨道，<strong>不再使用原圆的半径计算所需向心力。</strong></p>
      <p>此时只有重力，继续观察水平速度与竖直速度的变化。</p>
    </div>
  </section>
</template>
<style scoped>
.radial-panel { padding: 18px; background: #fff; border-left: 1px solid #dce5de; }
h2 { font-size: 14px; line-height: 1.7; margin: 0 0 8px; color: #304e40; }
.direction, .footnote { font-size: 12px; color: #6b7c72; line-height: 1.7; margin: 0 0 12px; }
.force-row { margin: 12px 0; }.force-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 3px; font-size: 12px; }.force-row > .math-formula { font-size: 13px; }
svg { width: 100%; height: auto; display: block; }
svg text { font-size: 13px; font-family: inherit; }
.balance { padding: 12px 9px; background: #f1f6f2; border-radius: 7px; font-size: 12px; }.balance > .math-formula { font-size: 11px; }.balance p { margin: 10px 0 0; line-height: 1.8; }.balance strong { display: block; }.footnote { margin: 12px 0 0; }.free-flight { line-height: 1.9; font-size: 14px; padding-top: 14px; }
@media (max-width: 1150px) { .radial-panel { border-left: 0; border-top: 1px solid #dce5de; } }
</style>
