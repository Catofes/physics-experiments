<script setup>
import { computed, ref, watch } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import RangeControl from '../../components/RangeControl.vue';
import MathFormula from '../../components/MathFormula.vue';
import CircuitDiagram from './CircuitDiagram.vue';
import MeasurementPlot from './MeasurementPlot.vue';
import { apparentSource, correctReading, currentDisplay, fitReadings, loadRange, samplingLoads, solveCircuit } from './physics.js';

defineProps({ experiment: { type: Object, required: true } });
const emf = ref(1.5), resistance = ref(1), load = ref(20);
const ra = ref(0.2), rv = ref(3000), ideal = ref(true);
const connection = ref('external');
const loadBounds = computed(() => loadRange(resistance.value));
const currentScale = computed(() => currentDisplay(emf.value, resistance.value));
const samples = ref([]), showCorrection = ref(false), showTruth = ref(true), notice = ref('');
const params = computed(() => ({ emf: emf.value, resistance: resistance.value, load: load.value, ra: ra.value, rv: rv.value, ideal: ideal.value, connection: connection.value }));
const reading = computed(() => solveCircuit(params.value));
const apparent = computed(() => apparentSource(params.value));
const fit = computed(() => fitReadings(samples.value));
const corrected = computed(() => samples.value.map(point => correctReading(point, params.value)));
const correctedFit = computed(() => fitReadings(corrected.value));
const external = computed(() => connection.value === 'external');
const meterMode = computed({ get: () => ideal.value ? 'ideal' : 'real', set: value => { ideal.value = value === 'ideal'; } });
const idealOptions = [{ value: 'ideal', label: '理想电表' }, { value: 'real', label: '非理想电表' }];
const connectionOptions = [
  { value: 'external', label: '电流表外接', description: '相对电源 · V 直接跨接电源' },
  { value: 'internal', label: '电流表内接', description: '相对电源 · A 测电源总电流' },
];
const fmt = (n, digits = 3) => n.toFixed(digits);
const signed = n => { const percent = Math.abs(n) < .00005 ? 0 : n * 100; return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`; };
const currentValue = (value, digits = 3) => fmt(value * currentScale.value.factor, digits);
const fitFormula = computed(() => fit.value ? String.raw`\frac{U}{\mathrm{V}} = ${fmt(fit.value.intercept)} - ${Number((fit.value.resistance / currentScale.value.factor).toPrecision(4))}\,\frac{I}{\mathrm{${currentScale.value.unit === 'μA' ? '\\mu A' : currentScale.value.unit}}}` : '');
const slopeConversion = computed(() => String.raw`\frac{r}{\Omega} = ${currentScale.value.factor === 1e6 ? '10^6' : '1000'}\,|k|`);
const displacement = computed(() => external.value
  ? `向右补上 Iᵥ = U / Rᵥ = ${fmt(reading.value.iv * 1000, 2)} mA`
  : `向上补上 Uₐ = I Rₐ = ${fmt(reading.value.ua)} V`);
function clearSamples() { samples.value = []; notice.value = ''; }
watch(resistance, (next, previous) => {
  const scale = loadRange(next).max / loadRange(previous).max;
  load.value = Number((load.value * scale).toFixed(1));
}, { flush: 'sync' });
// Keep one consistent circuit per data set; slider movement retains data.
watch([emf, resistance, ra, rv, ideal, connection], () => {
  clearSamples();
  notice.value = '参数或接法已改变，已清空上一组数据。';
}, { flush: 'sync' });
function record() {
  if (samples.value.some(p => Math.abs(p.load - load.value) < 1e-8)) {
    notice.value = '这个阻值已经记录，移动滑片后再记录。'; return;
  }
  if (samples.value.length >= 20) { notice.value = '已记录 20 组，可以清空后重新测量。'; return; }
  samples.value.push({ i: reading.value.i, u: reading.value.u, load: load.value });
  notice.value = `已记录第 ${samples.value.length} 组。`;
}
function collect() {
  const loads = samplingLoads(resistance.value);
  samples.value = loads.map(value => {
    const p = solveCircuit({ ...params.value, load: value });
    return { i: p.i, u: p.u, load: value };
  });
  load.value = loads.at(-1);
  notice.value = `已用 ${loads.join('、')} Ω 分别采集 6 组；当前停在 ${load.value} Ω。`;
}
function preset(name) {
  emf.value = 1.5; resistance.value = 1; ra.value = 0.2; rv.value = 3000;
  ideal.value = name === 'ideal'; connection.value = name === 'ammeter' ? 'internal' : 'external';
  if (name === 'voltmeter') rv.value = 10;
  if (name === 'ammeter') ra.value = 1;
  if (name === 'fruit') { emf.value = 1; resistance.value = 500; }
  load.value = loadBounds.value.max; clearSamples();
  showCorrection.value = false;
  notice.value = name === 'fruit' ? '水果电池示例：E = 1.0 V、r = 500 Ω；可切换内外接，比较电压表分流与电流表分压的影响。'
    : name === 'voltmeter' || name === 'ammeter' ? '已放大电表内阻的影响，便于观察系统误差；这不是常规电表的典型参数。' : '移动滑片观察 I、U 的变化，记录读数或一键采集 6 组。';
}
function reset() { preset('ideal'); showTruth.value = true; }
</script>

<template>
  <ExperimentLayout :experiment="experiment" controls-title="实验设置" :show-playback="false" class="emf-lab">
    <template #stage>
      <div class="emf-stage">
        <div class="stage-heading"><div><span class="eyebrow">限流法 · 伏安法</span><h2>从电路读数，到一条直线</h2></div><span class="meter-badge">{{ ideal ? '理想电表' : '非理想电表' }}</span></div>
        <div class="experiment-panels">
          <section class="circuit-panel" aria-label="电路连接">
            <div class="panel-heading"><h3>01　连接与调节</h3><span>{{ external ? 'V 测路端电压' : 'A 测总电流' }}</span></div>
            <CircuitDiagram :connection="connection" :load="load" :load-max="loadBounds.max" :current-scale="currentScale" :reading="reading" :ra="ra" :rv="rv" :ideal="ideal" />
            <div class="wiper-control"><RangeControl v-model="load" label="滑动变阻器接入电阻" :min="loadBounds.min" :max="loadBounds.max" :step="0.1" :digits="1" unit=" Ω" /><div class="range-ends"><span>{{ loadBounds.min }} Ω · 大电流</span><span>{{ loadBounds.max }} Ω · 小电流</span></div></div>
            <div class="measurement-actions"><button class="lab-button primary" :disabled="samples.length >= 20" @click="record">记录当前读数</button></div>
            <p class="wiring-note">变阻器用“一上一下”两个接线柱，A—P 串联限流，B 悬空。负载范围随电源内阻自动匹配。</p>
          </section>
          <section class="graph-panel" aria-label="图像分析">
            <div class="panel-heading"><h3>02　描点与拟合</h3><span>已记录 {{ samples.length }} 组</span></div>
            <MeasurementPlot :params="params" :reading="reading" :samples="samples" :fit="fit" :corrected="corrected" :corrected-fit="correctedFit" :apparent="apparent" :show-correction="showCorrection" :show-truth="showTruth" />
            <div class="graph-legend"><span><i class="raw-key" />{{ fit ? '测量点与拟合线' : '预期读数关系' }}</span><span v-if="showTruth"><i class="truth-key" />真实电源关系</span><span v-if="showCorrection"><i class="corrected-key" />修正后</span><span>空心圆：当前状态</span></div>
            <p class="axis-explanation"><MathFormula tex="U=E-rI" />：纵截距为 <i>E</i>，横截距为 <i>E/r</i>。<template v-if="currentScale.factor === 1">斜率为 −<i>r</i>。</template><template v-else>横轴用 {{ currentScale.unit }} 时，<MathFormula :tex="slopeConversion" />（<i>k</i> 为图像斜率）。</template><br />截距来自直线外推。</p>
          </section>
        </div>
        <div class="live-readings" aria-label="实时电表示数"><div><span>电流表示数 I</span><strong>{{ currentValue(reading.i) }} <small>{{ currentScale.unit }}</small></strong></div><div><span>电压表示数 U</span><strong>{{ fmt(reading.u) }} <small>V</small></strong></div><div><span>电源总电流 I源</span><strong>{{ currentValue(reading.sourceCurrent) }} <small>{{ currentScale.unit }}</small></strong></div><div><span>真实路端电压</span><strong>{{ fmt(reading.terminalVoltage) }} <small>V</small></strong></div></div>
        <p class="state-note" role="status">{{ notice || '移动滑片，观察电路读数与图像上的对应点。' }}</p>
      </div>
    </template>
    <template #observation>
      <div class="result-heading"><h2>测量结果</h2><div class="result-actions"><button class="lab-button" @click="collect">一键采集 6 组</button><button class="lab-button" :disabled="!samples.length" @click="clearSamples">清空数据</button></div></div>
      <div v-if="fit" class="fit-results" aria-label="拟合结果">
        <p class="fit-equation"><MathFormula :tex="fitFormula" /></p>
        <div class="result-values"><div><span>电动势 E测</span><strong>{{ fmt(fit.emf) }} V</strong><small>相对真实值 {{ signed(fit.emf / emf - 1) }}</small></div><div><span>内阻 r测</span><strong>{{ fmt(fit.resistance) }} Ω</strong><small>相对真实值 {{ signed(fit.resistance / resistance - 1) }}</small></div><div v-if="showCorrection && correctedFit" class="corrected-result"><span>用电表内阻修正</span><strong>E = {{ fmt(correctedFit.emf) }} V</strong><small>r = {{ fmt(correctedFit.resistance) }} Ω</small></div></div>
      </div>
      <p v-else class="empty-fit">记录至少两组不同阻值的数据后拟合。建议记录 6 组，让电流分布开一些。</p>
      <details v-if="samples.length" class="data-details"><summary>查看 {{ samples.length }} 组测量数据</summary><div class="table-scroll"><table><thead><tr><th>组次</th><th>R / Ω</th><th>I / {{ currentScale.unit }}</th><th>U / V</th><template v-if="showCorrection"><th>I修正 / {{ currentScale.unit }}</th><th>U修正 / V</th></template><th>操作</th></tr></thead><tbody><tr v-for="(p, n) in samples" :key="n"><td>{{ n + 1 }}</td><td>{{ fmt(p.load, 1) }}</td><td>{{ currentValue(p.i, 4) }}</td><td>{{ fmt(p.u, 4) }}</td><template v-if="showCorrection"><td>{{ currentValue(corrected[n].i, 4) }}</td><td>{{ fmt(corrected[n].u, 4) }}</td></template><td><button class="delete-sample" :aria-label="`删除第 ${n + 1} 组数据`" @click="samples.splice(n, 1)">删除</button></td></tr></tbody></table></div></details>
      <p class="precision-note">先只研究电表内阻造成的系统误差，不叠加随机读数误差；拟合采用未舍入数据，表格显示 4 位小数。</p>
    </template>
    <template #controls-top>
      <h2 class="sidebar-heading">先选一个观察情境</h2>
      <div class="preset-grid"><button class="lab-button" @click="preset('ideal')">理想对照</button><button class="lab-button" @click="preset('real')">常规电表</button><button class="lab-button" @click="preset('voltmeter')">放大分流</button><button class="lab-button" @click="preset('ammeter')">放大分压</button><button class="lab-button fruit-preset" @click="preset('fruit')">水果电池 · 高内阻</button></div>
    </template>
    <template #controls>
      <div class="control-section"><h2>电表与接法</h2><ChoiceControl v-model="meterMode" label="电表理想程度" :options="idealOptions" /><ChoiceControl v-model="connection" label="电流表相对电源的位置" :options="connectionOptions" stacked /><p class="control-note">这里的“内、外”均相对被测电源，直接对照电路中 A 的位置。</p><template v-if="!ideal"><RangeControl v-model="ra" label="电流表内阻 Rₐ" :min="0" :max="2" :step="0.01" :digits="2" unit=" Ω" /><RangeControl v-model="rv" label="电压表内阻 Rᵥ" :min="5" :max="30000" :step="1" :digits="0" unit=" Ω" logarithmic /></template></div>
      <div class="control-section error-explanation"><h2>{{ ideal ? '理想电表：读数直接反映电源' : external ? '外接：少测了电压表电流' : '内接：少测了电流表压降' }}</h2><template v-if="ideal"><p>Rₐ = 0，Rᵥ → ∞。两种接法都满足 U = E − rI，拟合得到的 E、r 与真实值一致。</p></template><template v-else-if="external"><MathFormula tex="I_{\text{源}}=I+\frac{U}{R_V}" /><p>V 的示数就是路端电压，但 A 漏掉了流经 V 的电流。测量点偏向电流较小的一侧。</p><MathFormula tex="E_{\text{测}}=\frac{E R_V}{R_V+r},\quad r_{\text{测}}=\frac{rR_V}{R_V+r}" /><p>E、r 都偏小。Rᵥ 越大，分流越小；Rₐ 会改变工作点，但不进入这个接法的误差公式。</p></template><template v-else><MathFormula tex="U_{\text{端}}=U+IR_A" /><p>A 测到电源总电流，但 V 的示数少了电流表上的电压，测量点偏向电压较小的一侧。</p><MathFormula tex="E_{\text{测}}=E,\quad r_{\text{测}}=r+R_A" /><p>E 不变，r 偏大。Rₐ 越小，分压越小；Rᵥ 会改变工作点，但不进入这个接法的误差公式。</p></template><p v-if="!ideal" class="displacement">图中从测量点到真实点：{{ displacement }}。</p><label class="check"><input v-model="showTruth" type="checkbox" />显示真实电源关系与偏移</label><label class="check"><input v-model="showCorrection" type="checkbox" />用已知电表内阻修正</label><p v-if="showCorrection" class="control-note">{{ external ? '每组电流加 U/Rᵥ，电压不变' : '每组电压加 IRₐ，电流不变' }}，再重新拟合。修正只用电表内阻与读数，不使用真实 E、r。</p></div>
      <div class="control-section"><h2>被测电源（真实值）</h2><RangeControl v-model="emf" label="电动势 E" :min="1" :max="3" :step="0.1" :digits="1" unit=" V" /><RangeControl v-model="resistance" label="电源内阻 r" :min="0.2" :max="5000" :step="0.1" :digits="1" unit=" Ω" logarithmic /><p class="control-note">内阻可调 0.2～5000 Ω，支持干电池和水果电池等高内阻情境；负载范围随内阻自动匹配。修改电源、电表或接法会清空数据。表计自动适配显示，不模拟量程过载。</p></div>
      <button class="lab-button wide" @click="reset">恢复默认</button>
    </template>
  </ExperimentLayout>
</template>

<style scoped>
.emf-lab { height: auto; min-height: 100dvh; }.emf-lab :deep(.lab-layout) { align-items: start; }.emf-lab :deep(.lab-controls) { overflow: visible; max-height: none; }.emf-lab :deep(.lab-stage) { background: #fbfdfb; border-color: #d9e5dc; height: auto; min-height: 0; flex: none; }.emf-lab :deep(.lab-observation) { margin-top: 18px; }.emf-lab :deep(.controls-heading) { display: none; }
.emf-stage { padding: 22px; }.stage-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 22px; }.eyebrow { font-size: 11px; color: #718c7b; }.stage-heading h2 { font-size: 20px; font-weight: 550; margin: 8px 0 0; color: #2f5b49; }.meter-badge { background: #eaf3ec; padding: 7px 11px; border-radius: 20px; font-size: 11px; white-space: nowrap; color: #39745c; }
.experiment-panels { display: grid; grid-template-columns: 1fr; gap: 22px; }.circuit-panel,.graph-panel { min-width: 0; }.panel-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 12px; }.panel-heading h3 { font-size: 13px; font-weight: 600; margin: 0; color: #426652; }.panel-heading > span { font-size: 11px; color: #819587; }
.circuit-panel { padding: 16px; background: #f2f6f1; border-radius: 10px; }.graph-panel { padding: 16px 0 0; }.wiper-control :deep(.range-control) { margin-top: 0; }.range-ends { display: flex; justify-content: space-between; font-size: 10px; color: #8a9b8e; }.measurement-actions { display: flex; gap: 8px; margin-top: 18px; }.measurement-actions button { flex: 1; }.wiring-note { font-size: 11px; line-height: 1.8; margin: 12px 0 0; color: #758b7d; }
.graph-legend { display: flex; flex-wrap: wrap; gap: 7px 12px; font-size: 10px; color: #7d8b81; margin: 5px 0 16px; }.graph-legend span { display: inline-flex; align-items: center; gap: 5px; }.graph-legend i { width: 15px; height: 2px; display: inline-block; }.raw-key { background: #c28b2a; }.truth-key { border-top: 2px dashed #7e8b91; }.corrected-key { background: #21856c; }.axis-explanation { font-size: 11px; line-height: 1.9; color: #728778; margin: 8px 0 0; }.axis-explanation :deep(.katex) { font-size: 1.1em; }
.live-readings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #dfe8df; margin-top: 24px; padding-top: 19px; gap: 12px; }.live-readings span { display: block; font-size: 10px; color: #839587; margin-bottom: 7px; }.live-readings strong { font-size: 22px; font-weight: 500; color: #286a51; font-variant-numeric: tabular-nums; white-space: nowrap; }.live-readings small { font-size: 12px; }.live-readings > div:nth-child(2) strong { color: #a47622; }.live-readings > div:nth-child(n+3) strong { color: #647b6d; }.state-note { font-size: 11px; color: #7b8e80; margin: 17px 0 0; min-height: 20px; line-height: 1.8; }
.sidebar-heading { font-size: 13px; font-weight: 600; margin: 0 0 14px; }.preset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 22px; }.preset-grid button { font-size: 11px; }.fruit-preset { grid-column: 1 / -1; }.error-explanation p { font-size: 12px; line-height: 1.9; color: #728375; }.error-explanation :deep(.math-formula) { display: block; margin-top: 12px; font-size: 12px; }.error-explanation :deep(.katex) { font-size: 1.05em; }.check { display: flex; gap: 7px; align-items: center; margin-top: 14px; font-size: 12px; color: #52775e; }.check input { accent-color: #267568; }.displacement { background: #f9f3e5; border-left: 3px solid #c59b50; padding: 10px; }
.result-heading { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }.result-heading h2 { font-size: 13px; margin: 0; color: #496653; }.result-actions { display: flex; gap: 7px; }.result-actions button { font-size: 11px; padding: 8px 11px; }.empty-fit,.precision-note { font-size: 11px; color: #859285; line-height: 1.8; }.fit-equation { color: #a77821; font-size: 17px; }.result-values { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }.result-values > div { border-left: 2px solid #e6d4ab; padding-left: 12px; }.result-values span,.result-values small { display: block; font-size: 11px; color: #7c8a7d; }.result-values strong { display: block; font-size: 20px; font-weight: 500; margin: 8px 0; color: #967025; }.result-values .corrected-result { border-color: #75b69a; }.corrected-result strong { color: #267568; }.data-details { margin-top: 18px; font-size: 12px; color: #5e7b67; }.table-scroll { overflow-x: auto; }table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }th,td { padding: 9px; border-bottom: 1px solid #e9eee7; font-size: 11px; }th { font-weight: 500; }.delete-sample { background: none; color: #8a795e; padding: 2px; font-size: 11px; }
@media (min-width: 1280px) { .experiment-panels { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }.graph-panel { padding-top: 16px; } }
@media (max-width: 760px) { .emf-stage { padding: 14px; }.stage-heading h2 { font-size: 18px; }.circuit-panel { padding: 12px; }.graph-panel { padding-top: 0; }.live-readings { grid-template-columns: repeat(2, 1fr); gap: 20px; }.live-readings strong { font-size: 21px; }.result-heading { align-items: start; }.result-values { grid-template-columns: repeat(2, minmax(0, 1fr)); }.corrected-result { grid-column: 1 / -1; } }
</style>
