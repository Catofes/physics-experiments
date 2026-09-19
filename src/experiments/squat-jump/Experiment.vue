<script setup>
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import RangeControl from "../../components/RangeControl.vue";
import ChoiceControl from "../../components/ChoiceControl.vue";
import { createJumpSimulation } from "./simulation.js";
defineProps({ experiment: Object });
const canvas = ref(),
  data = shallowRef({
    running: false,
    vA: 0,
    vB: 0,
    height: 0,
    deformation: 0,
    message: "",
  });
const model = ref(1),
  speed = ref(0.2),
  error = ref("");
let simulation;
const models = [
  { value: 1, label: "基础纵跳", description: "单质点竖直上抛，观察最高点" },
  { value: 2, label: "离地临界", description: "压缩 3x₀，伸长 x₀ 时到达临界" },
  { value: 3, label: "连杆锁定", description: "压缩 10x₀，恢复原长后整体上升" },
];
function selectModel(value) {
  model.value = value;
  simulation?.reset(value);
  simulation?.play();
}
function setSpeed(value) {
  speed.value = value;
  simulation?.setSpeed(value);
}
function toggle() {
  if (data.value.running) simulation?.pause();
  else simulation?.play();
}
function reset() {
  model.value = 1;
  setSpeed(0.2);
  simulation?.reset(1);
}
onMounted(() => {
  try {
    simulation = createJumpSimulation(canvas.value, (value) => {
      data.value = value;
    });
  } catch (cause) {
    error.value = cause.message;
  }
});
onUnmounted(() => simulation?.dispose());
</script>
<template>
  <ExperimentLayout
    :experiment="experiment"
    :running="data.running"
    :disabled="!!error"
    @toggle="toggle"
    @reset="reset"
    @hide="simulation?.pause()"
  >
    <template #stage
      ><div class="jump-scene">
        <canvas ref="canvas" aria-label="弹簧与质点运动演示" />
      </div>
      <p v-if="error" class="stage-error">{{ error }}</p></template
    >
    <template #observation
      ><p class="observation-label">观察记录</p>
      <p class="observation-message">{{ data.message }}</p>
      <div class="readings">
        <div>
          <span>A 速度</span><strong>{{ data.vA.toFixed(2) }}</strong>
        </div>
        <div>
          <span>B 速度</span><strong>{{ data.vB.toFixed(2) }}</strong>
        </div>
        <div>
          <span>A 离地高度</span><strong>{{ data.height.toFixed(1) }}</strong>
        </div>
        <div>
          <span>弹簧形变</span
          ><strong>{{
            model === 1
              ? "—"
              : `${data.deformation >= 0 ? "压" : "拉"} ${Math.abs(data.deformation).toFixed(2)} x₀`
          }}</strong>
        </div>
      </div></template
    >
    <template #controls>
      <section class="control-section">
        <h2>选择模型</h2>
        <ChoiceControl
          :model-value="model"
          :options="models"
          label="选择模型"
          stacked
          @update:model-value="selectModel"
        />
      </section>
      <section class="control-section">
        <h2>演示速度</h2>
        <RangeControl
          :model-value="speed"
          label="慢放倍率"
          :min="0.05"
          :max="0.5"
          :step="0.05"
          :digits="2"
          unit="×"
          @update:model-value="setSpeed"
        />
      </section>
      <section class="control-section">
        <h2>模型关系</h2>
        <dl class="model-facts">
          <div>
            <dt>静压缩量</dt>
            <dd>x₀ = mg / k</dd>
          </div>
          <div>
            <dt>离地临界</dt>
            <dd>k · x₀ = mg</dd>
          </div>
          <div>
            <dt>锁定瞬间</dt>
            <dd>mv = 2mv′</dd>
          </div>
        </dl>
        <p class="control-note">
          示意模型采用相对单位，读数用于比较运动过程；速度以竖直向下为正方向。
        </p>
      </section>
    </template>
  </ExperimentLayout>
</template>
