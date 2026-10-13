<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ answer: Number, digits: Number, tolerance: { type: Number, default: 0 }, questionKey: Number });
const emit = defineEmits(['reveal']);
const draft = ref(''), feedback = ref('');
watch(() => [props.answer, props.questionKey], () => { draft.value = ''; feedback.value = ''; });
function check() {
  if (!draft.value.trim() || !Number.isFinite(Number(draft.value))) {
    feedback.value = '请输入以毫米为单位的读数。'; return;
  }
  const correct = Math.abs(Number(draft.value) - props.answer) <= props.tolerance + 1e-8;
  feedback.value = correct ? '读数正确。对照解析检查读数步骤。' : '再检查主尺、半毫米刻度或小数部分，也可以查看解析。';
  if (correct) emit('reveal');
}
</script>
<template>
  <form class="reading-practice" @submit.prevent="check">
    <label>你的读数（mm）<input v-model="draft" aria-label="你的读数（mm）" inputmode="decimal" autocomplete="off" :placeholder="digits === 3 ? '例如 5.678' : digits === 1 ? '例如 12.3' : '例如 12.35'"></label>
    <button class="lab-button primary" type="submit">检查读数</button>
    <button class="lab-button" type="button" @click="emit('reveal')">查看解析</button>
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </form>
</template>
<style scoped>
.reading-practice { display: flex; align-items: end; flex-wrap: wrap; gap: 10px; }
label { display: grid; gap: 7px; font-size: 13px; } input { width: 155px; max-width: 100%; padding: 10px; border: 1px solid #b9cfc6; border-radius: 6px; font-size: 16px; } p { flex-basis: 100%; font-size: 13px; line-height: 1.7; margin: 0; }
</style>
