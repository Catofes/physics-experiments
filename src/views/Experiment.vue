<script setup>
import { computed, defineAsyncComponent, onErrorCaptured, ref } from "vue";
import { useRoute } from "vue-router";
import experiments from "../experiments.json";
import NotFound from "./NotFound.vue";
const route = useRoute();
const modules = import.meta.glob("../experiments/*/Experiment.vue");
const experiment = computed(() =>
  experiments.find((item) => item.id === route.params.id),
);
const loader = modules[`../experiments/${route.params.id}/Experiment.vue`];
const component = loader ? defineAsyncComponent(loader) : null;
const failed = ref(false);
onErrorCaptured((error) => {
  console.error(error);
  failed.value = true;
  return false;
});
</script>
<template>
  <main v-if="failed" class="page empty not-found">
    <h1>实验暂时未能加载</h1>
    <p>请刷新页面重试。</p>
    <RouterLink class="button" to="/">返回实验目录</RouterLink>
  </main>
  <component
    v-else-if="experiment && component"
    :is="component"
    :experiment="experiment"
  />
  <NotFound v-else />
</template>
