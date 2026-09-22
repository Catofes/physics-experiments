<script setup>
import SystemExperiment from '../orbits/SystemExperiment.vue';
defineProps({ experiment: Object });
</script>
<template><SystemExperiment :experiment="experiment" lunar/></template>
