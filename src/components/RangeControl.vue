<script setup>
defineProps({
  modelValue: Number,
  label: String,
  min: Number,
  max: Number,
  step: { type: Number, default: 1 },
  unit: { type: String, default: "" },
  digits: { type: Number, default: 0 },
  disabled: Boolean,
});
defineEmits(["update:modelValue"]);
</script>
<template>
  <label class="range-control" :class="{ disabled }"
    ><span class="range-caption"
      ><span>{{ label }}</span
      ><output>{{ modelValue.toFixed(digits) }}{{ unit }}</output></span
    ><input
      type="range"
      :aria-label="label"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      @input="$emit('update:modelValue', Number($event.target.value))"
  /></label>
</template>
