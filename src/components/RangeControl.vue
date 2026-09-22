<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

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
const editing = ref(false);
const draft = ref("");
const numberInput = ref(null);
const keypadDialog = ref(null);
const replaceOnDigit = ref(false);
const validDraft = computed(() => String(draft.value).trim() !== "" && Number.isFinite(Number(draft.value)));
let clickTimer;

function clearClickTimer() {
  if (clickTimer !== undefined) clearTimeout(clickTimer);
  clickTimer = undefined;
}

function valueClick(event) {
  if (event.detail === 0) {
    startEditing();
  } else if (clickTimer !== undefined) {
    clearClickTimer();
    openKeypad();
  } else {
    clickTimer = setTimeout(() => {
      clickTimer = undefined;
      startEditing();
    }, 300);
  }
}

async function startEditing() {
  if (props.disabled) return;
  draft.value = props.modelValue.toFixed(props.digits);
  editing.value = true;
  await nextTick();
  numberInput.value?.focus();
  numberInput.value?.select();
}

function finishEditing() {
  if (!editing.value) return;
  editing.value = false;
  commitDraft();
}

function commitDraft() {
  const value = Number(draft.value);
  if (!validDraft.value) return;
  const clamped = Math.min(props.max, Math.max(props.min, value));
  const rounded = Number(clamped.toFixed(props.digits));
  emit("update:modelValue", rounded);
}

function cancelEditing() {
  editing.value = false;
}

function openKeypad() {
  clearClickTimer();
  if (props.disabled) return;
  cancelEditing();
  draft.value = props.modelValue.toFixed(props.digits);
  replaceOnDigit.value = true;
  keypadDialog.value?.showModal();
  keypadDialog.value?.focus();
}

function closeKeypad() {
  if (keypadDialog.value?.open) keypadDialog.value.close();
}

function confirmKeypad() {
  if (!validDraft.value) return;
  closeKeypad();
  commitDraft();
}

function appendDigit(digit) {
  if (replaceOnDigit.value) {
    draft.value = String(draft.value).startsWith("-") ? `-${digit}` : digit;
    replaceOnDigit.value = false;
  } else if (String(draft.value).length < 14) {
    draft.value = draft.value === "0" ? digit
      : draft.value === "-0" ? `-${digit}`
      : `${draft.value}${digit}`;
  }
}

function appendDecimal() {
  if (props.digits === 0) return;
  if (replaceOnDigit.value) {
    draft.value = String(draft.value).startsWith("-") ? "-0." : "0.";
    replaceOnDigit.value = false;
  } else if (!String(draft.value).includes(".")) {
    draft.value = `${draft.value || "0"}.`;
  }
}

function toggleSign() {
  if (props.min >= 0) return;
  draft.value = String(draft.value).startsWith("-")
    ? String(draft.value).slice(1)
    : `-${draft.value || "0"}`;
}

function backspace() {
  draft.value = String(draft.value).slice(0, -1);
  replaceOnDigit.value = false;
}

function keypadKeydown(event) {
  if (/^[0-9]$/.test(event.key)) appendDigit(event.key);
  else if (event.key === ".") appendDecimal();
  else if (event.key === "Backspace") backspace();
  else if (event.key === "-" && props.min < 0) toggleSign();
  else if (event.key === "Enter" && event.target === keypadDialog.value) confirmKeypad();
  else return;
  event.preventDefault();
}

watch(() => [props.modelValue, props.disabled], () => {
  clearClickTimer();
  cancelEditing();
  closeKeypad();
});
onUnmounted(clearClickTimer);

function input(event) {
  const value = Number(event.target.value);
  emit("update:modelValue", props.logarithmic
    ? Number((props.min * (props.max / props.min) ** (value / 1000)).toPrecision(3))
    : value);
}
</script>
<template>
  <div class="range-control" :class="{ disabled }">
    <div class="range-caption">
      <span>{{ label }}</span>
      <span class="range-value">
        <template v-if="editing">
          <input
            ref="numberInput"
            v-model="draft"
            class="range-value-input"
            type="number"
            :aria-label="`输入${label}`"
            :min="min"
            :max="max"
            :step="10 ** -digits"
            @keydown.enter.prevent="finishEditing"
            @keydown.esc.prevent="cancelEditing"
            @blur="finishEditing"
          />{{ unit }}
        </template>
        <button
          v-else
          class="range-value-button"
          type="button"
          :aria-label="`输入${label}，当前${modelValue.toFixed(digits)}${unit}`"
          title="点击输入具体数值"
          :disabled="disabled"
          @click="valueClick"
        >{{ modelValue.toFixed(digits) }}{{ unit }}<span aria-hidden="true">✎</span></button>
        <button
          v-if="!editing"
          class="range-keypad-trigger"
          type="button"
          :aria-label="`打开${label}数字按键板`"
          title="打开数字按键板"
          :disabled="disabled"
          @click="openKeypad"
        >▦</button>
      </span>
    </div>
    <input
      type="range"
      :aria-label="label"
      :min="logarithmic ? 0 : min"
      :max="logarithmic ? 1000 : max"
      :step="logarithmic ? 1 : step"
      :value="logarithmic ? 1000 * Math.log(modelValue / min) / Math.log(max / min) : modelValue"
      :aria-valuetext="`${modelValue.toFixed(digits)}${unit}`"
      :disabled="disabled"
      @input="input"
    />
    <dialog
      ref="keypadDialog"
      class="range-keypad"
      :aria-label="`${label}数字输入`"
      tabindex="-1"
      @keydown="keypadKeydown"
    >
      <div class="range-keypad-heading">
        <strong>{{ label }}</strong>
        <button type="button" aria-label="关闭数字按键板" @click="closeKeypad">×</button>
      </div>
      <div class="range-keypad-display" aria-live="polite">{{ draft || "0" }}{{ unit }}</div>
      <p>范围 {{ min }}–{{ max }}{{ unit }}</p>
      <div class="range-keypad-grid">
        <button v-for="digit in ['7', '8', '9']" :key="digit" type="button" @click="appendDigit(digit)">{{ digit }}</button>
        <button type="button" aria-label="退格" @click="backspace">⌫</button>
        <button v-for="digit in ['4', '5', '6']" :key="digit" type="button" @click="appendDigit(digit)">{{ digit }}</button>
        <button type="button" @click="draft = ''; replaceOnDigit = false">清空</button>
        <button v-for="digit in ['1', '2', '3']" :key="digit" type="button" @click="appendDigit(digit)">{{ digit }}</button>
        <button type="button" :disabled="min >= 0" @click="toggleSign">±</button>
        <button type="button" :disabled="digits === 0" @click="appendDecimal">.</button>
        <button type="button" @click="appendDigit('0')">0</button>
        <button type="button" @click="closeKeypad">取消</button>
        <button type="button" class="range-keypad-confirm" :disabled="!validDraft" @click="confirmKeypad">确定</button>
      </div>
    </dialog>
  </div>
</template>
