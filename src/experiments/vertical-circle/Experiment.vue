<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import MathFormula from '../../components/MathFormula.vue';
import VectorArrow from './VectorArrow.vue';
import SvgFormula from './SvgFormula.vue';
import RadialForces from './RadialForces.vue';
import { G, simulate } from './physics.js';
defineProps({ experiment: { type: Object, required: true } });
const q = ref(4.5), radius = ref(2), slow = ref(0.35), index = ref(0), running = ref(false);
const showVelocity = ref(true), showForces = ref(true), autoPause = ref(true);
const model = computed(() => simulate(q.value, radius.value));
const state = computed(() => model.value.samples[index.value]);
const last = computed(() => model.value.samples.length - 1);
const labels = { circle: '沿圆弧运动', release: '分离瞬间', flight: '抛体运动 · 只受重力' };
const initialSpeed = computed({ get: () => Math.sqrt(q.value * G * radius.value), set: value => { q.value = value ** 2 / (G * radius.value); } });
const initialFormula = computed(() => String.raw`v_0\approx\sqrt{${Number(q.value.toFixed(2))}gr}\approx${fmt(initialSpeed.value)}\,\mathrm{m/s}`);
const thresholdFormula = computed(() => String.raw`v_0=\sqrt{5gr}\approx${fmt(Math.sqrt(5 * G * radius.value))}\,\mathrm{m/s}`);
const presetSelected = value => Math.abs(q.value - value) < 1e-10;
const presets = [{ q: 1.5, name: '低速折返', tex: String.raw`v_0=\sqrt{1.5gr}` }, { q: 4.5, name: '途中分离', tex: String.raw`v_0=\sqrt{4.5gr}` }, { q: 5, name: '临界过顶', tex: String.raw`v_0=\sqrt{5gr}` }, { q: 6, name: '完整绕行', tex: String.raw`v_0=\sqrt{6gr}` }];
const px = x => 350 + x / radius.value * 165;
const py = y => 245 - y / radius.value * 165;
const path = samples => samples.map((s, i) => `${i ? 'L' : 'M'}${px(s.x).toFixed(2)},${py(s.y).toFixed(2)}`).join(' ');
const traveled = computed(() => path(model.value.samples.slice(0, index.value + 1)));
const flightPath = computed(() => model.value.release ? path(model.value.samples.slice(model.value.keyIndex)) : '');
const forceScale = 42 / G;
const velocityScale = computed(() => 55 / Math.sqrt(G * radius.value));
const nx = computed(() => -Math.sin(state.value.theta) * state.value.normal * forceScale);
const ny = computed(() => -Math.cos(state.value.theta) * state.value.normal * forceScale);
let frame = 0, previous = 0, clock = 0;
function stop() { running.value = false; cancelAnimationFrame(frame); previous = 0; }
function reset() { stop(); index.value = 0; }
watch([q, radius], reset, { flush: 'sync' });
function seek(value) { stop(); index.value = Number(value); }
function keyMoment() { seek(model.value.keyIndex); }
function tick(now) {
  if (!running.value) return;
  if (previous) clock += Math.min((now - previous) / 1000, 0.05) * slow.value;
  previous = now;
  while (index.value < last.value && model.value.samples[index.value + 1].time <= clock) {
    index.value++;
    if (autoPause.value && model.value.release && index.value === model.value.keyIndex) { stop(); return; }
  }
  if (index.value === last.value) { stop(); return; }
  frame = requestAnimationFrame(tick);
}
function toggle() {
  if (running.value) return stop();
  if (index.value === last.value) index.value = 0;
  clock = state.value.time; previous = 0; running.value = true; frame = requestAnimationFrame(tick);
}
onUnmounted(stop);
const fmt = n => n.toFixed(2);
</script>

<template>
  <ExperimentLayout :experiment="experiment" class="vertical-circle" :running="running" @toggle="toggle" @reset="reset" @hide="stop">
    <template #stage>
      <div class="scene-heading"><span>竖直平面 · 光滑圆轨道内侧</span><strong data-testid="motion-phase">{{ labels[state.phase] }}<template v-if="state.phase === 'release'"> · <MathFormula tex="N=0" /></template></strong></div>
      <div class="visuals"><div class="motion-view"><svg class="circle-scene" viewBox="80 0 540 490" role="img" aria-label="竖直圆周运动：轨迹、切向速度与受力示意">
        <path d="M350 60V430 M165 245H535" stroke="#dde5e0" stroke-dasharray="4 6" />
        <circle cx="350" cy="245" r="165" fill="none" stroke="#c5d3cb" stroke-width="6" />
        <SvgFormula :x="180" :y="20" :width="340" tex="\text{最高点临界速度 }v_{\text{顶}}=\sqrt{gr}" center />
        <text x="350" y="481" text-anchor="middle">最低点 · 从这里向右出发</text>
        <circle cx="350" cy="245" r="3" fill="#84998c" /><SvgFormula :x="327" :y="249" tex="O" />
        <path v-if="flightPath" :d="flightPath" fill="none" stroke="#d79975" stroke-width="2" stroke-dasharray="6 6" opacity="0.6" />
        <path :d="traveled" fill="none" stroke="#28836d" stroke-width="3" />
        <g v-if="model.release">
          <circle :cx="px(model.release.x)" :cy="py(model.release.y)" r="9" fill="white" stroke="#cc7040" stroke-width="2" />
          <text :x="px(model.release.x) + 14" :y="py(model.release.y) - 14" fill="#aa542b">分离点</text>
        </g>
        <g :transform="`translate(${px(state.x)},${py(state.y)})`">
          <g v-if="showForces">
            <VectorArrow :dx="0" :dy="42" color="#cc7040" /><SvgFormula :x="12" :y="30" tex="mg" style="color: #aa542b" />
            <g v-if="state.normal > 0.002 && state.phase === 'circle'" data-testid="normal-force">
              <VectorArrow :dx="nx" :dy="ny" color="#337fc0" /><SvgFormula :x="nx + 12" :y="ny - 26" tex="N" style="color: #337fc0" />
            </g>
          </g>
          <g v-if="showVelocity">
            <VectorArrow :dx="state.vx * velocityScale" :dy="-state.vy * velocityScale" color="#22836b" />
            <SvgFormula :x="state.vx * velocityScale + 12" :y="-state.vy * velocityScale - 29" tex="\vec v" style="color: #22836b" />
          </g>
          <circle r="7" fill="#253f36" stroke="white" stroke-width="2" />
        </g>
      </svg>
      <div class="legend"><span class="gravity">重力 <MathFormula tex="mg" /></span><span class="normal">支持力 <MathFormula tex="N" /></span><span class="velocity">速度 <MathFormula tex="\vec v" />（不是力）</span><span>虚线：分离后预测轨迹</span></div></div><RadialForces :state="state" :radius="radius" /></div>
    </template>
    <template #playback>
      <div class="transport">
        <div class="actions"><button class="lab-button primary" @click="toggle">{{ running ? '暂停演示' : '开始 / 继续' }}</button><button class="lab-button" @click="reset">回到起点</button><button class="lab-button" @click="keyMoment">{{ model.release ? '查看分离瞬间' : '查看最高位置' }}</button></div>
        <label class="timeline">时间 {{ fmt(state.time) }} s<input aria-label="演示时间" type="range" min="0" :max="last" step="1" :value="index" @input="seek($event.target.value)" /></label>
      </div>
    </template>
    <template #observation>
      <div class="readings"><span>速度 <b>{{ fmt(state.speed) }} m/s</b></span><span>支持力 / 重力 <b>{{ fmt(state.normal / G) }}</b></span><span>离底高度 <b>{{ fmt(state.y + radius) }} m</b></span></div>
      <p v-if="index === last && model.release" class="explanation">小球再次到达轨道，演示在接触前停止；不模拟碰撞。</p>
      <p v-else-if="state.phase === 'release'" class="explanation">支持力刚好降为零。此时重力的径向分量提供所需向心力；下一瞬间离开圆轨道，沿此刻切线方向抛出。</p>
      <p v-else-if="state.phase === 'flight'" class="explanation">分离后只有重力：水平速度不变，竖直速度随时间减小。圆心不再决定运动，速度也不再与原圆相切。</p>
      <p v-else class="explanation">重力始终竖直向下，支持力指向圆心。“向心力”是合力的径向分量，不是额外的一支力。</p>
    </template>
    <template #controls>
      <div class="presets"><button v-for="preset in presets" :key="preset.q" class="lab-button" :aria-label="preset.name" :aria-pressed="presetSelected(preset.q)" @click="q = preset.q; reset()"><span>{{ preset.name }}</span><MathFormula :tex="preset.tex" /></button></div>
      <RangeControl v-model="initialSpeed" label="最低点初速度" :min="Math.ceil(Math.sqrt(0.5 * G * radius) * 100) / 100" :max="Math.floor(Math.sqrt(6.5 * G * radius) * 100) / 100" :step="0.01" :digits="2" unit="m/s" />
      <p class="speed-formula"><MathFormula :tex="initialFormula" /></p>
      <p class="small">从最低点给小球多大的速度？数值越大，越容易越过最高点。</p>
      <p class="threshold">完成整圈至少需要<br /><MathFormula :tex="thresholdFormula" /></p>
      <RangeControl v-model="radius" label="轨道半径" :min="0.5" :max="5" :step="0.1" :digits="1" unit="m" />
      <p class="small">改变半径时保持所选运动情形，初速度同步调整。</p>
      <RangeControl v-model="slow" label="播放倍率" :min="0.1" :max="1" :step="0.05" :digits="2" unit="×" />
      <label class="check"><input v-model="autoPause" type="checkbox" />到分离瞬间自动暂停</label>
      <label class="check"><input v-model="showForces" type="checkbox" />显示重力与支持力</label>
      <label class="check"><input v-model="showVelocity" type="checkbox" />显示速度方向</label>
      <div class="condition">
        <strong>{{ model.kind === 'separation' ? '途中分离' : model.kind === 'return' ? '先停下，再沿圆弧折返' : presetSelected(5) ? '恰好完成圆周运动' : '可以完成圆周运动' }}</strong>
        <p v-if="model.release">分离位置 <MathFormula :tex="String.raw`\theta\approx${(model.release.theta * 180 / Math.PI).toFixed(1)}^\circ`" /><br />分离速度 <MathFormula :tex="String.raw`v\approx${fmt(model.release.speed)}\,\mathrm{m/s}`" /></p>
        <p v-else-if="q >= 5">最高点速度 {{ fmt(Math.sqrt((q - 4) * G * radius)) }} m/s<br />临界速度 <MathFormula :tex="String.raw`\sqrt{gr}\approx${fmt(Math.sqrt(G * radius))}\,\mathrm{m/s}`" /></p>
        <p v-else>小球没有进入上半圆，不会进入斜抛阶段。</p>
      </div>
      <details class="derivation">
        <summary>为什么会分离？</summary>
        <p><MathFormula tex="\theta" /> 从最低点向右量起；<MathFormula tex="N" /> 是轨道对小球的支持力，<MathFormula tex="mg" /> 是重力。沿圆周运动时：</p>
        <MathFormula tex="v^2=v_0^2-2gr(1-\cos\theta)" />
        <MathFormula tex="N-mg\cos\theta=mv^2/r" />
        <p>轨道只能推，不能拉。<MathFormula tex="N" /> 降为零后，若维持圆周运动需要 <MathFormula tex="N&lt;0" />，小球就会分离。</p>
        <MathFormula tex="\cos\theta_{\rm 分离}=\frac{2-v_0^2/(gr)}{3}" />
        <p>当 <MathFormula tex="\sqrt{2gr}&lt;v_0&lt;\sqrt{5gr}" /> 时途中分离；<MathFormula tex="v_0=\sqrt{2gr}" /> 时在水平位置瞬时停下，随后折返。</p>
        <MathFormula tex="v_{\rm 顶}\ge\sqrt{gr}\;\Longleftrightarrow\;v_0\ge\sqrt{5gr}" />
        <p>“最高点速度小于 <MathFormula tex="\sqrt{gr}" />”是假设仍沿圆到顶的推算；实际已提前分离，不能把它当成真正的到顶速度。</p>
      </details>
      <p class="small">模型：质点、光滑圆轨道内侧，<MathFormula tex="g=9.8\,\mathrm{m/s^2}" />。接触时有重力和支持力，分离后只受重力；忽略摩擦、空气阻力，不施加其他驱动力。力箭头与速度箭头使用各自比例尺。</p>
    </template>
  </ExperimentLayout>
</template>

<style scoped>
.vertical-circle { height: auto; min-height: 100dvh; }
.vertical-circle :deep(.lab-layout) { align-items: start; }
.visuals { display: grid; grid-template-columns: minmax(0, 1fr) 295px; }
.motion-view { min-width: 0; display: flex; flex-direction: column; justify-content: center; padding: 12px 0; }
.presets .lab-button { flex-direction: column; gap: 8px; padding: 12px 6px; }
.presets .math-formula { font-size: 12px; }
.speed-formula { font-size: 14px; margin: 0; }.threshold { font-size: 13px; line-height: 2; margin: 0; color: #527463; }
.gravity { color: #be6736; }.normal { color: #337fc0; }.velocity { color: #22836b; }
@media (max-width: 1150px) { .visuals { grid-template-columns: 1fr; } }

.vertical-circle :deep(.lab-stage) { background: #f9fcf9; border-color: #d7e2d9; display: flex; flex-direction: column; min-height: 370px; height: auto; }
.vertical-circle :deep(.lab-layout) { overflow: auto; }
.scene-heading { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 18px 20px 0; font-size: 13px; color: #567065; }
.scene-heading strong { color: #237560; }
.circle-scene { width: 100%; flex: 1; min-height: 0; max-height: 590px; }
.circle-scene text { font-size: 15px; font-family: inherit; }
.legend { display: flex; gap: 8px 18px; flex-wrap: wrap; justify-content: center; padding: 8px 14px 16px; color: #62776b; font-size: 12px; }
.transport { width: 100%; }.actions { display: flex; gap: 8px; flex-wrap: wrap; }.timeline { display: flex; gap: 15px; align-items: center; margin-top: 12px; font-size: 13px; }.timeline input { flex: 1; min-width: 0; accent-color: #22836b; }
.readings { display: flex; flex-wrap: wrap; gap: 12px 25px; font-size: 13px; }.readings b { display: block; margin-top: 5px; font-size: 18px; font-variant-numeric: tabular-nums; }.explanation { font-size: 14px; line-height: 1.7; margin: 12px 0 0; }
.presets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.presets [aria-pressed=true] { background: #e0efe7; border-color: #32856d; }
.small { font-size: 12px; color: #65766b; line-height: 1.7; margin: 0; }.check { display: flex; align-items: center; gap: 8px; font-size: 13px; min-height: 28px; }.check input { accent-color: #22836b; }
.condition { background: #edf4ef; padding: 15px; border-radius: 8px; font-size: 14px; }.condition p { margin-bottom: 0; line-height: 1.7; }.derivation { font-size: 13px; line-height: 1.8; }.derivation > .math-formula { display: block; font-size: 12px; margin: 10px 0; }
@media(max-width: 760px) { .vertical-circle :deep(.lab-stage) { min-height: 350px; }.circle-scene { min-height: 310px; }.circle-scene text { font-size: 19px; }.scene-heading { padding: 12px 12px 0; }.actions .lab-button { padding: 11px 10px; }.readings { gap: 12px; }.readings b { font-size: 16px; } }
</style>
