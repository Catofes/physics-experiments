<script setup>
import { computed } from 'vue';
import { MOVEMENT, dialReading } from './model.js';

const props = defineProps({
  mode: { type: String, required: true },
  relabeled: Boolean,
  fullCurrent: { type: Number, default: MOVEMENT.fullCurrent },
  outerRange: { type: Number, default: 0 },
  secondaryRange: { type: Number, default: 0 },
  ohmMultiplier: { type: Number, default: 100 },
  range: { type: Number, required: true },
  meterCurrent: { type: Number, required: true },
});
const fraction = computed(() => props.meterCurrent / props.fullCurrent);
const overloaded = computed(() => fraction.value > 1 + 1e-10);
const limited = computed(() => Math.max(0, Math.min(1, fraction.value)));
function point(fraction, radius) {
  const angle = Math.PI * (1 - fraction);
  return { x: 210 + radius * Math.cos(angle), y: 208 - radius * Math.sin(angle) };
}
const ohmScale = computed(() => props.relabeled && props.mode === 'ohmmeter');
// ×100 档中心刻度 15 对应调零后的总内阻 1500 Ω。
const ohmFraction = value => value === Infinity ? 0 : 15 / (15 + value);
const ohmLabels = [Infinity, 100, 50, 30, 20, 15, 10, 5, 0];
const ohmTicks = [...Array.from({ length: 21 }, (_, i) => i), 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 150, 200, 300, 500, Infinity];
const ticks = computed(() => ohmScale.value ? ohmTicks.map((value, index) => ({
  index, major: ohmLabels.includes(value), outer: point(ohmFraction(value), 160),
  inner: point(ohmFraction(value), ohmLabels.includes(value) ? 144 : 152),
})) : Array.from({ length: 21 }, (_, index) => ({
  index, major: index % 5 === 0, outer: point(index / 20, 160), inner: point(index / 20, index % 5 === 0 ? 144 : 152),
})));
function label(fraction) {
  if (!props.relabeled) return `${Number(fraction.toFixed(2))}`;
  const value = dialReading(props.mode, fraction, props.outerRange || props.range);
  if (value === Infinity) return '∞';
  if (props.mode === 'ammeter') return `${Number(value.toFixed(2))}`;
  if (props.mode === 'voltmeter') return `${Number(value.toFixed(2))}`;
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : `${Math.round(value)}`;
}
const labels = computed(() => ohmScale.value ? ohmLabels.map(value => ({
  fraction: ohmFraction(value), position: point(ohmFraction(value), 122), text: value === Infinity ? '∞' : String(value),
})) : [0, 0.25, 0.5, 0.75, 1].map(fraction => ({
  fraction, position: point(fraction, 122), text: label(fraction),
})));
const needle = computed(() => point(limited.value, 130));
</script>
<template>
  <div class="meter-dial" :class="{ overload: overloaded }">
    <div class="dial-head"><strong>{{ relabeled ? mode === 'ammeter' ? '电流表' : mode === 'voltmeter' ? '电压表' : '欧姆表' : '原表头' }}</strong><span>{{ relabeled ? mode === 'ammeter' ? 'A' : mode === 'voltmeter' ? 'V' : `Ω ×${ohmMultiplier}` : 'mA' }}</span></div>
    <svg viewBox="0 0 420 228" role="img" :aria-label="`指针偏转${(limited * 100).toFixed(0)}%，${relabeled ? '新刻度' : '原表头刻度'}${overloaded ? '，已超量程' : ''}`">
      <path d="M 50 208 A 160 160 0 0 1 370 208" fill="none" stroke="#8fa9a0" stroke-width="3" />
      <line v-for="tick in ticks" class="scale-tick" :key="tick.index" :x1="tick.outer.x" :y1="tick.outer.y" :x2="tick.inner.x" :y2="tick.inner.y" stroke="#acc6ba" :stroke-width="tick.major ? 2.5 : 1.5" />
      <text v-for="mark in labels" class="scale-label" :key="mark.fraction" :x="mark.position.x" :y="mark.position.y + (secondaryRange && (mark.fraction === 0 || mark.fraction === 1) ? -7 : 5)" text-anchor="middle" :fill="secondaryRange && range === secondaryRange ? '#a3bcb0' : '#eff6ed'" font-size="15" font-weight="600">{{ mark.text }}</text>
      <g v-if="relabeled && secondaryRange" class="secondary-scale">
        <text v-for="f in [0, 0.25, 0.5, 0.75, 1]" :key="f" :x="point(f, 94).x" :y="point(f, 94).y + (f === 0 || f === 1 ? -7 : 5)" text-anchor="middle" fill="#f2b277" font-size="13">{{ Number((f * secondaryRange).toFixed(3)) }}</text>
      </g>
      <text v-if="ohmScale" x="210" y="177" text-anchor="middle" fill="#a9c7b3" font-size="14">刻度示数 ×{{ ohmMultiplier }} Ω</text>
      <line x1="210" y1="208" :x2="needle.x" :y2="needle.y" stroke="#f8a96b" stroke-width="3" stroke-linecap="round" />
      <circle cx="210" cy="208" r="7" fill="#f8a96b" />
    </svg>
    <div class="dial-foot"><span>{{ relabeled && mode === 'ohmmeter' ? '∞ Ω' : '0' }}</span><span>{{ overloaded ? '超量程：指针已到机械止挡' : `表头电流 ${(meterCurrent * 1000).toFixed(3)} mA` }}</span><span>{{ relabeled && mode === 'ohmmeter' ? '0 Ω' : '满偏' }}</span></div>
  </div>
</template>
<style scoped>
.meter-dial { min-width: 0; padding: 12px 16px 10px; border: 1px solid #426354; border-radius: 16px; background: radial-gradient(circle at 50% 100%, #214737 0, #142d2c 58%, #102426 100%); box-shadow: inset 0 2px 20px #0003; }
.dial-head, .dial-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: #dcece2; }
.dial-head strong { font-size: 16px; font-weight: 650; }
.dial-head span { color: #a9c7b3; font-size: 13px; }
.meter-dial svg { display: block; width: 100%; max-height: 238px; }
.dial-foot { font-size: 11px; color: #a3bcb0; }
.dial-foot span:nth-child(2) { color: #f3c397; text-align: center; }
.overload .dial-foot span:nth-child(2) { color: #ff8e79; }
</style>
