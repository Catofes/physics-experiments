<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import RangeControl from "../../components/RangeControl.vue";
import ChoiceControl from "../../components/ChoiceControl.vue";
import { DEFAULT_STATE, GEO } from "./physics.js";
import { ScopeScene } from "./scene.js";
import { createMonitor } from "./monitor.js";
const props = defineProps({ experiment: Object, lissajous: Boolean });
const initialState = props.lissajous
  ? { ...DEFAULT_STATE, xSignal: "sine", sweepAmp: 24, yAmp: 24 * GEO.gainX / GEO.gainY, yPhase: 90, yFreq: 1, sweepFreq: 1, persistence: 0.95 }
  : { ...DEFAULT_STATE };
const mount = ref(),
  monitorCanvas = ref(),
  running = ref(true),
  error = ref(""),
  view = ref("perspective");
const state = reactive({ ...initialState }),
  sample = ref({ ux: 0, uy: 0 });
let scene, monitor;
const views = [
  { value: "perspective", label: "立体" },
  { value: "front", label: "正视荧光屏" },
  { value: "side", label: "侧视" },
  { value: "top", label: "俯视" },
];
const signals = [
  { value: "dc", label: "直流" },
  { value: "sine", label: "正弦波" },
  { value: "square", label: "方波" },
  { value: "triangle", label: "三角波" },
];
watch(state, (value) => scene?.updateState({ ...value }), { flush: "sync" });
function setView(value) {
  view.value = value;
  scene?.setView(value);
}
function demonstrate(frequency, sweepOn = false) {
  Object.assign(state, DEFAULT_STATE, {
    yFreq: frequency, sweepFreq: frequency, sweepOn, persistence: 0.45,
  });
  scene?.reset({ ...state });
  monitor?.clear();
  running.value = true;
  setView("front");
}
function pause() {
  running.value = false;
  scene?.setPaused(true);
}
function figure(x, y, phase, fast = false) {
  Object.assign(state, initialState, { sweepFreq: x * (fast ? 50 : 1), yFreq: y * (fast ? 50 : 1), yPhase: phase });
  scene?.reset({ ...state });
  monitor?.clear();
  running.value = true;
  setView("front");
}
function toggle() {
  running.value = !running.value;
  scene?.setPaused(!running.value);
}
function reset() {
  Object.assign(state, initialState);
  view.value = "perspective";
  monitor?.clear();
  scene?.reset({ ...initialState });
  if (props.lissajous) setView("front");
  running.value = true;
}
onMounted(() => {
  try {
    monitor = createMonitor(monitorCanvas.value);
    scene = new ScopeScene(mount.value, state, (value) => {
      sample.value = value;
      monitor.push(value, state);
    });
    if (props.lissajous) setView("front");
  } catch {
    error.value = "3D 演示加载失败，请确认浏览器支持 WebGL 2 并开启硬件加速。";
    running.value = false;
  }
});
onUnmounted(() => {
  scene?.dispose();
  monitor?.dispose();
});
</script>
<template>
  <ExperimentLayout
    :experiment="experiment"
    :running="running"
    :disabled="!!error"
    @toggle="toggle"
    @reset="reset"
    @hide="pause"
  >
    <template #stage
      ><div ref="mount" class="scope-scene" aria-label="示波管三维模型"></div>
      <span class="stage-caption">拖动旋转 · 滚轮或双指缩放</span>
      <p v-if="error" class="stage-error">{{ error }}</p></template
    >
    <template #observation
      ><div class="observation-heading">
        <p class="observation-label">电压波形</p>
        <div class="voltage-readings">
          <span
            >Ux <strong>{{ sample.ux.toFixed(1) }} V</strong></span
          ><span
            >Uy <strong>{{ sample.uy.toFixed(1) }} V</strong></span
          >
        </div>
      </div>
      <canvas
        ref="monitorCanvas"
        class="waveform"
        aria-label="扫描电压与偏转电压随时间变化"
    /></template>
    <template #controls>
      <section v-if="lissajous" class="control-section">
        <h2>李萨如图形 · 双正弦电压</h2>
        <button class="lab-button wide" @click="figure(1, 1, 0)">直线 · 1:1 · 同相</button>
        <button class="lab-button wide" @click="figure(1, 1, 90)">圆 · 1:1 · 相差 90°</button>
        <button class="lab-button wide" @click="figure(1, 1, 45)">椭圆 · 1:1 · 相差 45°</button>
        <button class="lab-button wide" @click="figure(1, 2, 0)">8 字形 · X:Y = 1:2</button>
        <button class="lab-button wide" @click="figure(2, 3, 0)">多瓣曲线 · X:Y = 2:3</button>
        <button class="lab-button wide" @click="figure(2, 3, 0, true)">高频成线 · 100:150 Hz</button>
        <p class="control-note">X、Y 均为正弦电压。低频观察光点描线，高频观察稳定图形。频率比决定形状；同频时，相位差决定直线或椭圆。圆形预设已按两方向偏转灵敏度校正幅值。</p>
        <p class="control-note" aria-live="polite">频率比 X:Y = {{ state.sweepFreq.toFixed(2) }}:{{ state.yFreq.toFixed(2) }}；初相差 Y−X = {{ ((state.yPhase - state.sweepPhase + 360) % 360) }}°</p>
      </section>
      <section v-else class="control-section">
        <h2>从光点到亮线</h2>
        <button class="lab-button wide" @click="demonstrate(0.5)">低频光点 · 0.5 Hz</button>
        <button class="lab-button wide" @click="demonstrate(100)">高频成线 · 100 Hz</button>
        <button class="lab-button wide" @click="demonstrate(100, true)">高频扫描波形 · 100 Hz</button>
        <p class="control-note">先观察低频光点上下移动，再逐渐提高信号频率。快速重复运动与荧光屏余晖让轨迹看起来成为连续亮线；开启 X 扫描可展开波形。频率滑块按倍数变化，范围为 0.1–1000 Hz。</p>
      </section>
      <section class="control-section">
        <h2>观察视角</h2>
        <ChoiceControl
          :model-value="view"
          :options="views"
          label="观察视角"
          @update:model-value="setView"
        />
      </section>
      <section class="control-section">
        <h2>Y 偏转电压</h2>
        <ChoiceControl
          v-if="!lissajous"
          v-model="state.ySignal"
          :options="signals"
          label="信号类型"
        /><RangeControl
          v-model="state.yDc"
          label="直流偏置"
          :min="-40"
          :max="40"
          :step="0.5"
          :digits="1"
          unit=" V"
        /><RangeControl
          v-model="state.yAmp"
          label="交流幅值"
          :min="0"
          :max="40"
          :step="0.5"
          :digits="1"
          unit=" V"
          :disabled="state.ySignal === 'dc'"
        /><RangeControl
          v-model="state.yFreq"
          label="信号频率"
          :min="0.1"
          :max="1000"
          logarithmic
          :step="0.05"
          :digits="2"
          unit=" Hz"
          :disabled="state.ySignal === 'dc'"
        /><RangeControl
          v-model="state.yPhase"
          label="Y 初相"
          :min="0"
          :max="360"
          :step="5"
          unit="°"
          :disabled="state.ySignal === 'dc'"
        />
      </section>
      <section class="control-section">
        <div class="control-heading">
          <h2>{{ lissajous ? 'X 正弦电压' : 'X 扫描电压' }}</h2>
          <label class="toggle-control"
            ><input v-model="state.sweepOn" type="checkbox" />开启扫描</label
          >
        </div>
        <RangeControl
          v-model="state.sweepAmp"
          label="扫描幅值"
          :min="5"
          :max="45"
          unit=" V"
          :disabled="!state.sweepOn"
        /><RangeControl
          v-model="state.sweepFreq"
          label="扫描频率"
          :min="0.1"
          :max="1000"
          logarithmic
          :step="0.05"
          :digits="2"
          unit=" Hz"
          :disabled="!state.sweepOn"
        /><RangeControl
          v-model="state.sweepPhase"
          label="X 初相"
          :min="0"
          :max="360"
          :step="5"
          unit="°"
          :disabled="!state.sweepOn"
        /><RangeControl
          v-if="!lissajous"
          :model-value="state.flyback * 100"
          label="回扫消隐占比"
          :min="0"
          :max="30"
          unit="%"
          :disabled="!state.sweepOn"
          @update:model-value="state.flyback = $event / 100"
        />
      </section>
      <section class="control-section">
        <h2>荧光屏</h2>
        <RangeControl
          :model-value="state.persistence * 100"
          label="余晖强度"
          :min="0"
          :max="97"
          unit="%"
          @update:model-value="state.persistence = $event / 100"
        /><button class="lab-button wide" @click="scene?.clearPhosphor()">
          清除余晖
        </button>
        <p class="control-note">
          红色表示高电位，青色表示低电位。电子带负电，受力指向正极板。
        </p>
      </section>
    </template>
  </ExperimentLayout>
</template>
