<script setup>
import { computed } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';
const props = defineProps({ tex: { type: String, required: true } });
const markup = computed(() => katex.renderToString(props.tex, { throwOnError: false, trust: false }));
</script>
<template><span class="math-formula" v-html="markup" /></template>
