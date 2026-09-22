<script setup>
import SatelliteExperiment from '../orbits/SatelliteExperiment.vue';
defineProps({ experiment: Object });
</script>
<template><SatelliteExperiment :experiment="experiment"/></template>
