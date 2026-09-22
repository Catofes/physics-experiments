<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { createBenchScene } from './bench-scene.js';
const props = defineProps({ mode: String, position: Number, voltage: Number, rheostat: Number, load: Number, loadVoltage: Number, loadCurrent: Number, sourceCurrent: Number });
const emit = defineEmits(['position']);
const host = ref(null);
const error = ref('');
const ready = ref(false);
let scene;
const description = computed(() => `${props.mode === 'divider' ? '分压接法，A、B 直接接电源两端，C、B 引出负载支路' : '限流接法，A、C 接入电路，B 悬空'}；滑片从 B 向 A ${Math.round(props.position * 100)}%；负载电压 ${props.loadVoltage.toFixed(2)} V，负载电流 ${props.loadCurrent.toFixed(2)} A`);
onMounted(() => {
  try { scene = createBenchScene(host.value, props, value => emit('position', value)); ready.value = true; }
  catch (e) { error.value = '三维场景未能加载，请使用支持 WebGL 的浏览器；电路图仍可操作。'; console.error(e); }
});
watch(() => ({ ...props }), value => scene?.update(value));
onUnmounted(() => scene?.dispose());
</script>
<template>
  <section class="apparatus-model" :aria-label="description" :data-ready="ready">
    <div class="bench-toolbar">
      <div><h2>桌面实验装置</h2><p>拖动旋转 · 缩放查看 · 拖动黑色滑柄调节</p></div>
      <div class="bench-views"><button type="button" @click="scene?.resetView('detail')">变阻器细节</button><button type="button" @click="scene?.resetView('top')">俯视接线</button><button type="button" @click="scene?.resetView()">恢复视角</button></div>
    </div>
    <div ref="host" class="bench-canvas" />
    <p v-if="error" class="bench-error" role="alert">{{ error }}</p>
    <div class="bench-readings"><span>电流表 <strong>{{ loadCurrent.toFixed(2) }} A</strong></span><span>电压表 <strong>{{ loadVoltage.toFixed(2) }} V</strong></span><span>{{ mode === 'divider' ? 'A、B 直连电源 · C、B 接负载' : 'A、C 串联负载 · B 悬空' }}</span></div>
  </section>
</template>
<style scoped>
.apparatus-model { min-width: 0; container-type: inline-size; overflow: hidden; border-radius: 10px; background: #deded5; color: #273f38; }
.bench-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px 7px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; }
.bench-toolbar p { margin: 5px 0 0; color: #60756a; font-size: 11px; }
.bench-views { display: flex; gap: 7px; }
button { font: inherit; font-size: 12px; border: 1px solid #aebbb0; border-radius: 5px; padding: 7px 9px; color: #3b5548; background: #eff1e9; cursor: pointer; }
button:hover { background: white; }
.bench-canvas { width: 100%; aspect-ratio: 1.5; height: auto; min-height: 280px; max-height: 570px; touch-action: none; }
.bench-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.bench-readings { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; padding: 12px 18px; background: #edf0e6; font-size: 12px; }
.bench-readings strong { margin-left: 6px; color: #205e4a; font-variant-numeric: tabular-nums; }
.bench-error { padding: 15px; color: #8e362a; }
@container(max-width:600px) { .bench-toolbar { padding: 12px; align-items: flex-start; }.bench-views { flex-wrap: wrap; gap: 4px; }button { padding: 5px 7px; }.bench-canvas { min-height: 280px; }.bench-readings { gap: 10px 18px; }.bench-readings span:last-child { width: 100%; text-align: center; } }
</style>
