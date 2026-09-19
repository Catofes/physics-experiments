<script setup>
import { watch } from "vue";
import { useRoute } from "vue-router";
import experiments from "./experiments.json";
const route = useRoute();
watch(
  () => route.path,
  () => {
    const experiment = experiments.find((item) => item.id === route.params.id);
    document.title = experiment
      ? `${experiment.title} · 物理实验室`
      : "物理实验室 · 课堂交互演示";
  },
  { immediate: true },
);
</script>
<template>
  <RouterView v-slot="{ Component, route }"
    ><component :is="Component" :key="route.path"
  /></RouterView>
</template>
