<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { createMeasurementScene } from '../experiments/measurement/scene.js';
const props = defineProps({ kind: String, opening: Number, divisions: Number, objectWidth: Number, measuring: Boolean, interactive: Boolean });
const emit = defineEmits(['opening', 'fallback']);
const host = ref(null), ready = ref(false), error = ref('');
let scene;
onMounted(() => {
  try { scene=createMeasurementScene(host.value, props.kind, {...props}, value=>emit('opening',value)); ready.value=true; }
  catch { error.value='三维视图暂时无法显示，可以继续使用示意图测量。'; }
});
watch(() => ({...props}), value=>scene?.update(value));
onUnmounted(() => scene?.dispose());
</script>
<template>
  <section class="measurement-3d" :data-ready="ready" :aria-label="kind==='caliper' ? '游标卡尺三维演示' : '螺旋测微器三维演示'">
    <div class="three-toolbar"><span>拖动旋转 · 滚轮或双指缩放<span v-if="interactive"> · 拖动{{ kind==='caliper' ? '游标尺测量' : '旋钮测量' }}</span></span><div class="actions"><button class="lab-button" @click="scene?.resetView('front')">正面读数</button><button class="lab-button" @click="scene?.resetView('detail')">测量面近景</button><button class="lab-button" @click="scene?.resetView()">恢复视角</button></div></div>
    <div ref="host" class="three-host" />
    <div v-if="error" class="three-error" role="status"><p>{{ error }}</p><button class="lab-button" @click="emit('fallback')">使用示意图</button></div>
  </section>
</template>
<style scoped>
.measurement-3d { position: relative; background: #edf2ef; margin: 12px 18px; border: 1px solid #dae4dd; border-radius: 10px; overflow: hidden; }
.three-toolbar { padding: 12px; font-size: 12px; color: #547363; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }.three-toolbar .lab-button { padding: 8px 10px; font-size: 12px; }
.three-host { height: clamp(320px, 37vw, 510px); width: 100%; touch-action: none; }.three-host :deep(canvas) { display: block; width: 100%; height: 100%; }
.three-error { position: absolute; inset: 75px 0 0; display: grid; place-content: center; padding: 20px; font-size: 13px; text-align: center; background: #edf2ef; }
@media(max-width:760px) { .measurement-3d { margin: 10px; }.three-host { height: 340px; } }
</style>
