<script setup>
import ScopeExperiment from "../cathode-ray/Experiment.vue";
defineProps({ experiment: Object });
</script>
<template>
  <ScopeExperiment :experiment="experiment" lissajous />
</template>
