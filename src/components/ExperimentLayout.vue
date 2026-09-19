<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
defineProps({
  experiment: { type: Object, required: true },
  running: Boolean,
  disabled: Boolean,
});
const emit = defineEmits(["toggle", "reset", "hide"]);
const route = useRoute();
const isFullscreen = ref(false),
  canFullscreen = ref(false),
  notice = ref("");
function syncFullscreen() {
  isFullscreen.value = !!document.fullscreenElement;
}
function visibilityChange() {
  if (document.hidden) emit("hide");
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    notice.value = "";
  } catch {
    notice.value = "浏览器未能进入全屏，可使用浏览器菜单中的全屏功能。";
  }
}
onMounted(() => {
  canFullscreen.value = document.fullscreenEnabled;
  syncFullscreen();
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("visibilitychange", visibilityChange);
});
onUnmounted(() => {
  document.removeEventListener("fullscreenchange", syncFullscreen);
  document.removeEventListener("visibilitychange", visibilityChange);
});
</script>
<template>
  <div class="workbench">
    <header class="lab-header">
      <RouterLink :to="{ name: 'catalog', query: route.query }" class="lab-back"
        >← 实验目录</RouterLink
      >
      <div class="lab-title">
        <span class="lab-category">{{ experiment.category }}</span>
        <h1>{{ experiment.title }}</h1>
      </div>
      <button v-if="canFullscreen" class="lab-button" @click="toggleFullscreen">
        {{ isFullscreen ? "退出全屏" : "全屏演示" }}
      </button>
    </header>
    <main class="lab-layout">
      <section class="lab-demonstration" aria-label="实验演示">
        <div class="lab-stage"><slot name="stage" /></div>
        <div class="lab-playback">
          <div class="playback-buttons">
            <button
              class="lab-button primary"
              :disabled="disabled"
              @click="emit('toggle')"
            >
              {{ running ? "暂停演示" : "开始 / 继续" }}</button
            ><button
              class="lab-button"
              :disabled="disabled"
              @click="emit('reset')"
            >
              重置实验
            </button>
          </div>
          <span class="playback-state" role="status">{{
            disabled ? "无法加载" : running ? "正在演示" : "已暂停"
          }}</span>
        </div>
        <div class="lab-observation"><slot name="observation" /></div>
      </section>
      <aside class="lab-controls" aria-label="实验参数">
        <div class="controls-heading">
          <p class="eyebrow">实验参数</p>
          <p>{{ experiment.description }}</p>
        </div>
        <fieldset class="lab-fields" :disabled="disabled">
          <slot name="controls" />
        </fieldset>
        <details class="lab-help">
          <summary>操作与观察提示</summary>
          <p>{{ experiment.hint }}</p>
        </details>
      </aside>
    </main>
    <p v-if="notice" class="lab-notice" role="status">{{ notice }}</p>
  </div>
</template>
