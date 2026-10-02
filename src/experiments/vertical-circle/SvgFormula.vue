<script setup>
import MathFormula from '../../components/MathFormula.vue';
defineProps({ x: { type: Number, default: 0 }, y: { type: Number, default: 0 }, width: { type: Number, default: 90 }, tex: { type: String, required: true }, center: Boolean });
</script>
<template>
  <foreignObject :x="x" :y="y" :width="width" height="40" class="svg-formula">
    <div xmlns="http://www.w3.org/1999/xhtml" :class="{ centered: center }"><MathFormula :tex="tex" /></div>
  </foreignObject>
</template>
<style scoped>
.svg-formula { overflow: visible; font-size: 17px; pointer-events: none; }
.svg-formula div { white-space: nowrap; line-height: 1.6; }
.centered { text-align: center; }
</style>
