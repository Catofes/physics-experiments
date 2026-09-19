<script setup>
import { onMounted, onUnmounted, reactive, ref, watch } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import RangeControl from "../../components/RangeControl.vue";
import ChoiceControl from "../../components/ChoiceControl.vue";
import { DEFAULT_STATE } from "./physics.js";
import { ScopeScene } from "./scene.js";
import { createMonitor } from "./monitor.js";
defineProps({ experiment: Object });
const mount = ref(),
  monitorCanvas = ref(),
  running = ref(true),
  error = ref(""),
  view = ref("perspective");
const state = reactive({ ...DEFAULT_STATE }),
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
function pause() {
  running.value = false;
  scene?.setPaused(true);
}
function toggle() {
  running.value = !running.value;
  scene?.setPaused(!running.value);
}
function reset() {
  Object.assign(state, DEFAULT_STATE);
  view.value = "perspective";
  monitor?.clear();
  scene?.reset(DEFAULT_STATE);
  running.value = true;
}
onMounted(() => {
  try {
    monitor = createMonitor(monitorCanvas.value);
    scene = new ScopeScene(mount.value, state, (value) => {
      sample.value = value;
      monitor.push(value);
    });
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
          v-model="state.ySignal"
          :options="signals"
          label="信号类型"
        /><RangeControl
          v-model="state.yDc"
          label="直流电压"
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
          :max="2"
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
          <h2>X 扫描电压</h2>
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
          :max="2"
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
