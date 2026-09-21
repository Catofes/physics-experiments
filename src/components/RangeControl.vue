<script setup>
const props = defineProps({
  modelValue: Number,
  label: String,
  min: Number,
  max: Number,
  step: { type: Number, default: 1 },
  unit: { type: String, default: "" },
  digits: { type: Number, default: 0 },
  disabled: Boolean,
  logarithmic: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
function input(event) {
  const value = Number(event.target.value);
  emit("update:modelValue", props.logarithmic
    ? Number((props.min * (props.max / props.min) ** (value / 1000)).toPrecision(3))
    : value);
}
</script>
<template>
  <label class="range-control" :class="{ disabled }"
    ><span class="range-caption"
      ><span>{{ label }}</span
      ><output>{{ modelValue.toFixed(digits) }}{{ unit }}</output></span
    ><input
      type="range"
      :aria-label="label"
      :min="logarithmic ? 0 : min"
      :max="logarithmic ? 1000 : max"
      :step="logarithmic ? 1 : step"
      :value="logarithmic ? 1000 * Math.log(modelValue / min) / Math.log(max / min) : modelValue"
      :aria-valuetext="`${modelValue.toFixed(digits)}${unit}`"
      :disabled="disabled"
      @input="input"
  /></label>
</template>
