<script setup>
defineProps({
  modelValue: [String, Number],
  label: String,
  options: Array,
  stacked: Boolean,
});
defineEmits(["update:modelValue"]);
</script>
<template>
  <div
    class="choice-control"
    :class="{ stacked }"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      class="choice-button"
      :aria-pressed="modelValue === option.value"
      @click="$emit('update:modelValue', option.value)"
    >
      <span>{{ option.label }}</span
      ><small v-if="option.description">{{ option.description }}</small>
    </button>
  </div>
</template>
