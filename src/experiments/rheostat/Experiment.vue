<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import CircuitDiagram from './CircuitDiagram.vue';
import BenchScene from './BenchScene.vue';
import { curve, solveCircuit } from './physics.js';

defineProps({ experiment: { type: Object, required: true } });
const mode = ref('divider');
const position = ref(50);
const voltage = ref(6);
const rheostat = ref(20);
const load = ref(10);
const running = ref(false);
let frame = 0;
let lastFrame = 0;
let direction = 1;
const params = computed(() => [voltage.value, rheostat.value, load.value]);
const current = computed(() => solveCircuit(mode.value, ...params.value, position.value / 100));
const both = computed(() => ({
  divider: solveCircuit('divider', ...params.value, position.value / 100),
  limit: solveCircuit('limit', ...params.value, position.value / 100),
}));
const voltageCurves = computed(() => ({
  divider: curve('divider', ...params.value, 'loadVoltage'),
  limit: curve('limit', ...params.value, 'loadVoltage'),
}));
const charts = computed(() => [
  { id: 'voltage', title: '负载电压调节曲线', unit: 'V', max: voltage.value, series: [
    { id: 'divider', label: '分压', value: both.value.divider.loadVoltage, data: voltageCurves.value.divider },
    { id: 'limit', label: '限流', value: both.value.limit.loadVoltage, data: voltageCurves.value.limit },
  ] },
]);
const chartContainer = ref(null);
const chartWidth = ref(800);
let chartObserver;
onMounted(() => {
  chartObserver = new ResizeObserver(([entry]) => { chartWidth.value = Math.max(260, entry.contentRect.width - 22); });
  chartObserver.observe(chartContainer.value);
});
function chartX(x) { return 54 + x / 100 * (chartWidth.value - 80); }
function chartY(value, max) { return 260 - value / max * 222; }
function path(values, max) { return values.map((v, i) => `${i ? 'L' : 'M'}${chartX(i).toFixed(1)} ${chartY(v, max).toFixed(1)}`).join(' '); }
function fmt(value, digits = 2) { return value.toFixed(digits); }
function stop() { running.value = false; cancelAnimationFrame(frame); frame = 0; lastFrame = 0; }
function tick(now) {
  if (!running.value) return;
  if (lastFrame) {
    let next = position.value + direction * Math.min((now - lastFrame) * 0.022, 4);
    if (next >= 100) { next = 100; direction = -1; }
    if (next <= 0) { next = 0; direction = 1; }
    position.value = next;
  }
  lastFrame = now;
  frame = requestAnimationFrame(tick);
}
function toggleSweep() {
  if (running.value) return stop();
  direction = position.value >= 100 ? -1 : 1;
  running.value = true;
  frame = requestAnimationFrame(tick);
}
function reset() { stop(); mode.value = 'divider'; position.value = 50; voltage.value = 6; rheostat.value = 20; load.value = 10; }
function manualPosition(event) { stop(); position.value = Number(event.target.value); }
onUnmounted(() => { stop(); chartObserver?.disconnect(); });
</script>

<template>
  <ExperimentLayout :experiment="experiment" controls-title="电路参数" :show-playback="false" class="rheostat-lab" @hide="stop">
    <template #stage>
      <div class="circuit-stage">
        <div class="stage-top"><span>同一电路 · 实物与符号对照</span><strong>{{ mode === 'divider' ? '分压接法' : '限流接法' }}</strong></div>
        <div class="circuit-views">
          <BenchScene @position="stop(); position = $event * 100" :mode="mode" :position="position / 100" :voltage="voltage" :rheostat="rheostat" :load="load" :load-voltage="current.loadVoltage" :load-current="current.loadCurrent" :source-current="current.sourceCurrent" />
          <figure>
            <figcaption>电路图 · 电流表串联，电压表并联</figcaption>
            <CircuitDiagram :mode="mode" :position="position / 100" :upper="current.upper" :lower="current.lower" :load-voltage="current.loadVoltage" :load-current="current.loadCurrent" :load="load" :voltage="voltage" />
          </figure>
        </div>
        <div class="wiper-control">
          <label for="wiper-position">滑片 P 位置 <strong>{{ fmt(position, 0) }}%</strong></label>
          <input id="wiper-position" type="range" dir="rtl" min="0" max="100" step="1" :value="position" :aria-valuetext="`从 B 向 A 移动 ${fmt(position, 0)}%`" @input="manualPosition" />
          <div class="ends"><span>靠 A · 100%</span><span>靠 B · 0%</span></div>
        </div>
      </div>
    </template>
    <template #controls-top>
      <div class="circuit-actions">
      <div class="mode-buttons" role="group" aria-label="选择接法">
        <button class="lab-button" :aria-pressed="mode === 'divider'" @click="mode = 'divider'">分压接法</button>
        <button class="lab-button" :aria-pressed="mode === 'limit'" @click="mode = 'limit'">限流接法</button>
      </div>
      <div class="demo-buttons">
        <button class="lab-button primary" @click="toggleSweep">{{ running ? '暂停滑片演示' : '自动移动滑片' }}</button>
        <button class="lab-button" @click="reset">恢复默认</button>
      </div>
      </div>
    </template>
    <template #observation>
      <div class="chart-legend"><span><i class="divider-key" />分压接法</span><span><i class="limit-key" />限流接法</span><span>实心圆：当前滑片位置 · 加粗：当前接法</span></div>
      <div ref="chartContainer" class="chart-grid">
        <div v-for="chart in charts" :key="chart.id" class="chart-card">
          <div class="chart-heading"><h2>{{ chart.title }}</h2><span class="chart-value"><i>U</i><sub>L</sub> = {{ fmt(current.loadVoltage) }} V</span></div>
          <svg :viewBox="`0 0 ${chartWidth} 320`" role="img" :aria-label="`${chart.title}：${chart.series.map(item => `${item.label}当前 ${fmt(item.value)} ${chart.unit}`).join('，')}`">
            <g class="grid-lines"><path v-for="tick in [0, .25, .5, .75, 1]" :key="tick" :d="`M54 ${chartY(tick * chart.max, chart.max)} H${chartWidth - 26}`" /></g>
            <g class="axes"><path :d="`M54 30 V260 H${chartWidth - 20}`" /></g>
            <g class="axis-labels">
              <text x="54" y="20">负载电压 / V</text>
              <text v-for="tick in [0, .25, .5, .75, 1]" :key="tick" x="44" :y="chartY(tick * chart.max, chart.max) + 4" text-anchor="end">{{ fmt(tick * chart.max, 1) }}</text>
              <text v-for="tick in [0, 25, 50, 75, 100]" :key="tick" :x="chartX(tick)" y="284" text-anchor="middle">{{ tick }}%</text>
              <text :x="chartWidth / 2" y="311" text-anchor="middle">滑片位置：从 B 向 A</text>
            </g>
            <path v-for="item in chart.series" :key="item.id" :class="['curve', `${item.id}-curve`, { selected: item.id === mode }]" :d="path(item.data, chart.max)" />
            <path class="position-line" :d="`M${chartX(position)} 30 V260`" />
            <circle v-for="item in chart.series" :key="item.id" :class="['chart-dot', item.id]" :cx="chartX(position)" :cy="chartY(item.value, chart.max)" :r="item.id === mode ? 5 : 4" />
          </svg>
          <p>{{ chart.series.map(item => `${item.label} ${fmt(item.value)} ${chart.unit}`).join('　·　') }}</p>
        </div>
      </div>
      <p class="chart-note">纵轴：负载电压 <i>U</i><sub>L</sub> / V。相同参数下比较两种接法，曲线已计入负载影响；电源、电流表、电压表均视为理想元件。</p>
    </template>
    <template #controls>
      <div class="control-section"><h2>调节参数</h2><RangeControl v-model="voltage" label="电源电压" :min="1" :max="12" :step="0.1" :digits="1" unit=" V" /><RangeControl v-model="rheostat" label="变阻器总电阻" :min="2" :max="100" :step="1" unit=" Ω" /><RangeControl v-model="load" label="负载电阻" :min="2" :max="100" :step="1" unit=" Ω" /></div>
      <div class="control-section comparison"><h2>两种接法怎么选</h2><div><strong>分压</strong><p>负载电压可以从 0 调到电源电压；适合需要从零开始、调节范围大的实验。电源始终接在整条电阻丝上，会持续耗电。</p></div><div><strong>限流</strong><p>接线简单，变阻器与负载串联；适合只需限制电流的实验。负载电压最低仍大于 0，调节范围受负载电阻影响。</p></div></div>
      <div class="control-section formula"><h2>接线提示</h2><p>限流接 A、P；分压接 A、P、B。B 端在分压时接电源负极，负载接 P、B。</p><p>滑片从 B 向 A 移动时，<i>R</i><sub>AP</sub> 减小，<i>R</i><sub>PB</sub> 增大；两种接法的负载电压都随之升高。</p><p>实物上 C、D 通过金属杆连接滑片 P，本图使用 C 接线柱。</p></div>
    </template>
  </ExperimentLayout>
</template>

<style scoped>
.rheostat-lab i { font-style: italic; font-synthesis: style; font-family: Georgia, "Times New Roman", serif; }
.rheostat-lab :deep(.lab-observation) { order: -1; }
.circuit-views { display: grid; grid-template-columns: 1fr; gap: 16px; margin: 18px 0; }
.circuit-views figure { margin: 0; min-width: 0; border: 1px solid #39535d; border-radius: 8px; padding: 10px 4px; }
.circuit-views figcaption { font-size: 12px; color: #b8d4ca; padding: 0 8px; }
.chart-value { font-size: 18px; color: #226c59; }
@media(min-width:1280px) {
  .circuit-views { grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); align-items: stretch; }
  .circuit-views figure { display: flex; flex-direction: column; }
  .circuit-views figure :deep(.circuit-diagram) { flex: 1; max-height: none; min-height: 0; }
}

.rheostat-lab { height: auto; min-height: 100dvh; }
.rheostat-lab :deep(.lab-stage) { height: auto; min-height: 0; flex: none; }
.rheostat-lab :deep(.lab-controls) { max-height: none; }
.circuit-actions { display: grid; gap: 10px; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid #e0eae2; }
.circuit-actions .lab-button { flex: 1; }
.circuit-stage { padding: 17px 22px 19px; color: #d9e9e6; }
.stage-top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; font-size: 12px; color: #9bb4b1; }
.stage-top strong { color: #90ddc8; font-weight: 600; }
.circuit-stage :deep(.circuit-diagram) { max-height: 355px; }
.wiper-control { max-width: 560px; margin: 0 auto; }
.wiper-control label { display: flex; justify-content: space-between; font-size: 13px; }
.wiper-control strong { color: #91e1ca; font-variant-numeric: tabular-nums; }
.wiper-control input { display: block; width: 100%; margin: 8px 0 2px; accent-color: #81d8bd; cursor: pointer; }
.ends { display: flex; justify-content: space-between; color: #8fa7a6; font-size: 11px; }
.mode-buttons,.demo-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.mode-buttons [aria-pressed="true"] { color: #146052; border-color: #399479; background: #e3f4eb; }
.chart-legend { display: flex; gap: 18px; flex-wrap: wrap; margin: 22px 0 8px; font-size: 11px; color: #677c70; }
.chart-legend span { display: inline-flex; gap: 5px; align-items: center; }
.chart-legend i { width: 17px; height: 3px; display: inline-block; border-radius: 2px; }
.divider-key { background: #218c74; }.limit-key { background: #d49435; }
.chart-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.chart-card { border: 1px solid #e1eae3; border-radius: 8px; padding: 10px; min-width: 0; }
.chart-card h2 { font-size: 13px; font-weight: 600; color: #39584b; margin: 0 0 4px; }
.chart-heading { display: flex; justify-content: space-between; gap: 7px; align-items: center; flex-wrap: wrap; }
.chart-card svg { display: block; width: 100%; height: 320px; }
.chart-card p { font-size: 11px; color: #607c69; margin: 3px 0 0; text-align: center; font-variant-numeric: tabular-nums; }
.grid-lines { fill: none; stroke: #e6eee8; stroke-width: 1; }.axes { fill: none; stroke: #96aa9a; stroke-width: 1.2; }
.axis-labels { fill: #607667; font-size: 12px; }
.curve { fill: none; stroke-width: 2; opacity: .55; }.curve.selected { stroke-width: 3; opacity: 1; }
.divider-curve { stroke: #218c74; }.limit-curve { stroke: #d49435; }
.position-line { fill: none; stroke: #879b8e; stroke-width: 1; stroke-dasharray: 4 3; }
.chart-dot { stroke: white; stroke-width: 2; }.chart-dot.divider { fill: #218c74; }.chart-dot.limit { fill: #d49435; }
.chart-note { margin: 11px 0 0; color: #708677; font-size: 11px; line-height: 1.6; }
.comparison > div { border-left: 3px solid #76baa2; padding-left: 10px; margin: 14px 0; }
.comparison > div:nth-of-type(2) { border-color: #dba85d; }
.comparison strong { font-size: 12px; color: #3e6a56; }
.comparison p,.formula p { margin: 5px 0; font-size: 12px; line-height: 1.7; color: #6b7e70; }
@media(max-width:760px) { .rheostat-lab :deep(.lab-stage) { min-height: 0; height: auto; }.circuit-stage { padding: 14px; }.chart-grid { grid-template-columns: 1fr; }.stage-top { font-size: 11px; }.mode-buttons,.demo-buttons { width: 100%; }.mode-buttons .lab-button,.demo-buttons .lab-button { flex: 1; }.chart-card svg { max-height: none; } }
</style>
