<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import ChoiceControl from "../../components/ChoiceControl.vue";
import RangeControl from "../../components/RangeControl.vue";
import { SCENES } from "./physics.js";
import { createMagneticScene } from "./scene.js";
defineProps({ experiment: Object });
const defaults = () => ({
  scene: "earth",
  params: Object.fromEntries(SCENES[0].params.map((p) => [p.id, p.val])),
  section: { ...SCENES[0].section, show: false, only: false },
  prediction: false,
  lines: true,
  arrows: true,
  sources: true,
  grid: true,
  vectors: false,
});
const state = reactive(defaults()),
  mount = ref(),
  running = ref(true),
  error = ref(""),
  status = ref({ state: "loading" }),
  sample = ref(null);
const definition = computed(() => SCENES.find((s) => s.id === state.scene));
const options = SCENES.map((s) => ({ value: s.id, label: s.name }));
const sectionOptions = [
  { value: "x", label: "YZ 平面" },
  { value: "y", label: "XZ 平面" },
  { value: "z", label: "XY 平面" },
];
const snapshot = () => JSON.parse(JSON.stringify(state));
let scene;
watch(state, () => scene?.updateState(snapshot()));
function selectScene(value) {
  const def = SCENES.find((s) => s.id === value);
  state.scene = value;
  state.params = Object.fromEntries(def.params.map((p) => [p.id, p.val]));
  state.section = { ...def.section, show: false, only: false };
  state.vectors = false;
  sample.value = null;
}
function setParam(id, value) {
  state.params[id] = value;
  if (id === "display" && value !== "合磁场") setVectors(false);
}
function setVectors(value) {
  state.vectors = value;
  if (value) {
    state.section = { n: "y", off: 0, rot: 0, show: false, only: true };
  }
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
  Object.assign(state, defaults());
  sample.value = null;
  scene?.reset(snapshot());
  running.value = true;
}
const vectorText = (v) => v.map((n) => n.toFixed(2)).join(", ");
onMounted(() => {
  try {
    scene = createMagneticScene(
      mount.value,
      snapshot(),
      (value) => (status.value = value),
      (value) => (sample.value = value),
    );
  } catch {
    error.value = "3D 演示加载失败，请确认浏览器支持 WebGL 2 并开启硬件加速。";
    running.value = false;
  }
});
onUnmounted(() => scene?.dispose());
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
      <div
        ref="mount"
        class="magnetic-scene"
        aria-label="磁场三维模型"
        :aria-busy="status.state === 'loading'"
      />
      <span class="stage-caption"
        >拖动旋转 · 滚轮或双指缩放 · 点击截面采样</span
      >
      <div v-if="state.prediction" class="field-overlay">
        预测模式：先判断磁场方向，再揭示模型
      </div>
      <div
        v-else-if="status.state === 'loading'"
        class="field-overlay"
        role="status"
      >
        正在生成磁场…
      </div>
      <div
        v-else-if="status.state === 'error'"
        class="field-overlay"
        role="alert"
      >
        磁场生成失败
        <button
          class="lab-button"
          @click="scene?.updateState(snapshot(), true)"
        >
          重试
        </button>
      </div>
      <p v-if="error" class="stage-error">{{ error }}</p>
    </template>
    <template #observation>
      <h2 class="field-heading">{{ definition.name }}</h2>
      <p v-if="state.prediction" class="field-text">
        先判断磁感线的分布与方向，再点击「揭示磁场分布」。
      </p>
      <template v-else>
        <p class="field-text">{{ definition.valueLine(state.params) }}</p>
        <p v-if="sample?.message" class="field-text">{{ sample.message }}</p>
        <div v-else-if="sample" class="field-sample">
          <strong>|B| = {{ sample.magnitude }}</strong
          ><span>P({{ vectorText(sample.position) }}) · 1 单位 = 10 cm</span
          ><span>B = ({{ vectorText(sample.field) }}) μT</span
          ><template v-if="sample.b1"
            ><span>B₁ = ({{ vectorText(sample.b1) }}) μT</span
            ><span>B₂ = ({{ vectorText(sample.b2) }}) μT</span></template
          >
        </div>
        <p v-else class="field-text">
          点击截面任意位置，读取磁场大小与方向。红色箭头表示电流，磁感线方向由蓝色箭头表示。
        </p>
      </template>
    </template>
    <template #controls>
      <section class="control-section">
        <h2>场景</h2>
        <ChoiceControl
          :model-value="state.scene"
          :options="options"
          label="磁场场景"
          @update:model-value="selectScene"
        />
      </section>
      <section class="control-section">
        <h2>课堂模式</h2>
        <button
          class="lab-button wide"
          :aria-pressed="state.prediction"
          @click="state.prediction = !state.prediction"
        >
          {{ state.prediction ? "揭示磁场分布" : "进入预测模式" }}
        </button>
      </section>
      <section class="control-section">
        <h2>场源参数</h2>
        <template v-for="p in definition.params" :key="p.id">
          <div v-if="p.type === 'select'" class="field-param">
            <p class="control-note">{{ p.label }}</p>
            <ChoiceControl
              :model-value="state.params[p.id]"
              :options="p.options.map((value) => ({ value, label: value }))"
              :label="p.label"
              @update:model-value="setParam(p.id, $event)"
            />
          </div>
          <RangeControl
            v-else
            :model-value="state.params[p.id] * (p.displayScale || 1)"
            :label="p.label"
            :min="p.min * (p.displayScale || 1)"
            :max="p.max * (p.displayScale || 1)"
            :step="p.step * (p.displayScale || 1)"
            :unit="p.unit || ''"
            :digits="Number.isInteger(p.step * (p.displayScale || 1)) ? 0 : 1"
            @update:model-value="setParam(p.id, $event / (p.displayScale || 1))"
          />
        </template>
      </section>
      <section class="control-section">
        <h2>显示内容</h2>
        <label
          v-for="[key, label] in [
            ['lines', '磁感线'],
            ['arrows', '方向箭头'],
            ['sources', '场源物体'],
            ['grid', '参考网格'],
          ]"
          :key="key"
          class="toggle-control field-toggle"
          ><input v-model="state[key]" type="checkbox" />{{ label }}</label
        >
        <label
          v-if="state.scene === 'two-wires'"
          class="toggle-control field-toggle"
          ><input
            :checked="state.vectors"
            :disabled="state.params.display !== '合磁场'"
            type="checkbox"
            @change="setVectors($event.target.checked)"
          />矢量合成（B = B₁ + B₂）</label
        >
      </section>
      <section class="control-section">
        <h2>截面观察</h2>
        <label class="toggle-control field-toggle"
          ><input
            v-model="state.section.show"
            type="checkbox"
          />截面热力图</label
        >
        <ChoiceControl
          v-model="state.section.n"
          :options="sectionOptions"
          label="截面方向"
        />
        <RangeControl
          v-model="state.section.off"
          label="截面位置"
          :min="-Math.round(definition.size / 2 + 1)"
          :max="Math.round(definition.size / 2 + 1)"
          :step="0.2"
          :digits="1"
        />
        <RangeControl
          v-model="state.section.rot"
          label="截面旋转"
          :min="-90"
          :max="90"
          :step="5"
          unit="°"
        />
        <label class="toggle-control field-toggle"
          ><input
            v-model="state.section.only"
            type="checkbox"
          />仅显示截面投影流线</label
        >
        <button class="lab-button" @click="scene?.faceSection()">
          正视截面
        </button>
        <button class="lab-button" @click="scene?.resetView()">重置视角</button>
        <p class="control-note">
          截面流线表示面内磁场分量。热力图由蓝到红表示场强增大，按当前截面 P98
          场强归一化。
        </p>
      </section>
      <details v-if="!state.prediction" class="lab-help">
        <summary>观察要点与模型诊断</summary>
        <p>{{ definition.lead }}</p>
        <ul class="field-notes">
          <li v-for="item in definition.observations" :key="item">
            {{ item }}
          </li>
        </ul>
        <p>{{ definition.ai }}</p>
        <p>{{ definition.formula }}</p>
        <p>
          {{
            state.section.only
              ? "截面流线 " + (status.sectionCount || 0) + " 条"
              : "磁感线 " +
                (status.total || 0) +
                " 条，闭合 " +
                (status.closed || 0) +
                " 条"
          }}<template v-if="state.section.show">
            · 截面 P98 |B| = {{ (status.maxB || 0).toFixed(2) }} μT</template
          >
        </p>
        <ul class="field-notes">
          <li v-for="item in definition.selfCheck" :key="item">{{ item }}</li>
        </ul>
      </details>
    </template>
  </ExperimentLayout>
</template>
<style scoped>
.magnetic-scene {
  position: absolute;
  inset: 0;
  touch-action: none;
}
.field-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  width: fit-content;
  max-width: calc(100% - 32px);
  padding: 10px 14px;
  border-radius: 8px;
  background: #fffffff0;
  color: #476152;
  font-size: 12px;
  pointer-events: auto;
}
</style>
