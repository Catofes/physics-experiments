<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import ChoiceControl from "../../components/ChoiceControl.vue";
import RangeControl from "../../components/RangeControl.vue";
import { sceneMeta, createElectrostaticModel } from "./physics.js";
import { createElectrostaticSimulation } from "./simulation.js";
defineProps({ experiment: Object });
const canvas = ref(),
  running = ref(true),
  error = ref(""),
  diagnostics = ref([]);
const defaults = () => ({
  scene: "cavity",
  prediction: false,
  showCharges: true,
  showLines: true,
  showEquipotentials: true,
  showLabels: true,
  showBoundarySamples: false,
  chargeSign: 1,
  chargeMagnitude: 1,
});
const state = reactive(defaults());
const meta = computed(() => sceneMeta[state.scene]);
const options = [
  ["charged", "带电球体"],
  ["shield", "空腔屏蔽"],
  ["tip", "尖端效应"],
  ["dumbbell", "哑铃导体"],
  ["rod", "避雷针"],
  ["solid", "实心导体"],
  ["cavity", "腔内电荷"],
].map(([value, label]) => ({ value, label }));
const checks = computed(() =>
  createElectrostaticModel(state).getStudentChecks(),
);
let simulation;
watch(state, () => simulation?.updateState({ ...state }));
function pause() {
  running.value = false;
  simulation?.setPaused(true);
}
function toggle() {
  running.value = !running.value;
  simulation?.setPaused(!running.value);
}
function reset() {
  Object.assign(state, defaults());
  diagnostics.value = [];
  simulation?.reset({ ...state });
  running.value = true;
}
onMounted(() => {
  try {
    simulation = createElectrostaticSimulation(
      canvas.value,
      { ...state },
      (value) => (diagnostics.value = value),
      () => {
        error.value = "静电场绘制失败，请刷新重试。";
        pause();
      },
    );
  } catch {
    error.value = "无法创建画布，请使用支持 Canvas 的浏览器。";
    running.value = false;
  }
});
onUnmounted(() => simulation?.dispose());
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
    <template #stage>
      <div class="electrostatic-scene">
        <canvas
          ref="canvas"
          width="1120"
          height="700"
          aria-label="静电场与导体表面电荷分布"
        />
      </div>
      <span class="stage-caption">{{
        state.prediction
          ? "预测模式 · 电荷分布和场线已隐藏"
          : "拖动点电荷 · 红色为正，蓝色为负"
      }}</span>
      <p v-if="error" class="stage-error">{{ error }}</p>
    </template>
    <template #observation>
      <h2 class="field-heading">{{ meta.title }}</h2>
      <p class="field-text">
        {{ state.prediction ? meta.question : meta.lead }}
      </p>
      <ul v-if="!state.prediction" class="field-notes">
        <li v-for="item in checks" :key="item">{{ item }}</li>
      </ul>
    </template>
    <template #controls>
      <section class="control-section">
        <h2>场景</h2>
        <ChoiceControl
          v-model="state.scene"
          :options="options"
          label="静电场场景"
        />
      </section>
      <section class="control-section">
        <h2>课堂模式</h2>
        <button
          class="lab-button wide"
          :aria-pressed="state.prediction"
          @click="state.prediction = !state.prediction"
        >
          {{ state.prediction ? "显示模型结果" : "进入预测模式" }}
        </button>
      </section>
      <section class="control-section">
        <h2>显示内容</h2>
        <label
          v-for="[key, label] in [
            ['showCharges', '表面感应电荷'],
            ['showLines', '电场线模型'],
            ['showEquipotentials', '等势线'],
            ['showLabels', '关键物理标注'],
          ]"
          :key="key"
          class="toggle-control field-toggle"
          ><input type="checkbox" v-model="state[key]" />{{ label }}</label
        >
      </section>
      <section class="control-section">
        <h2>{{ state.scene === "rod" ? "电极电压" : "电荷" }}</h2>
        <ChoiceControl
          v-if="state.scene !== 'rod'"
          v-model="state.chargeSign"
          :options="[
            { value: 1, label: '正电荷' },
            { value: -1, label: '负电荷' },
          ]"
          label="电荷正负"
        />
        <RangeControl
          v-model="state.chargeMagnitude"
          :label="
            state.scene === 'rod' ? '电极电压（相对值）' : '电荷量（相对值）'
          "
          :min="0.25"
          :max="2"
          :step="0.05"
          :digits="2"
        />
      </section>
      <details v-if="!state.prediction" class="lab-help">
        <summary>模型诊断</summary>
        <ul class="field-notes">
          <li v-for="item in diagnostics" :key="item">{{ item }}</li>
        </ul>
        <label v-if="state.scene === 'rod'" class="toggle-control"
          ><input
            v-model="state.showBoundarySamples"
            type="checkbox"
          />边界采样点</label
        >
        <p>
          二维边界元教学模型；内外表面约束与显示修正沿用原实验，读数为模型相对值。
        </p>
      </details>
    </template>
  </ExperimentLayout>
</template>
<style scoped>
.electrostatic-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fcfdfe;
}
canvas {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  touch-action: none;
}
</style>
