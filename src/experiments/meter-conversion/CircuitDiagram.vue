<script setup>
import { computed } from 'vue';
const props = defineProps({
  mode: { type: String, required: true },
  connected: Boolean,
  resistor: { type: Number, required: true },
  stimulus: { type: Number, required: true },
  readings: { type: Object, required: true },
});
const probeState = computed(() => props.stimulus === Infinity ? '表笔开路' : props.stimulus === 0 ? '两表笔短接 · 欧姆调零' : '两表笔接入待测电阻');
const mA = value => `${(value * 1000).toFixed(value * 1000 >= 10 ? 1 : 3)} mA`;
const ohms = value => value >= 1000 ? `${Number((value / 1000).toFixed(2))} kΩ` : `${Number(value.toFixed(3))} Ω`;
const inputLabel = computed(() => props.mode === 'ammeter' ? `总电流 ${props.stimulus.toFixed(2)} A`
  : props.mode === 'voltmeter' ? `待测电压 ${props.stimulus.toFixed(2)} V` : `内置电池 1.5 V`);
</script>
<template>
  <div class="diagram-wrap">
    <div class="diagram-heading"><strong>改装电路</strong><span>{{ !connected ? '虚线电阻尚未接入' : mode === 'ohmmeter' ? probeState : '电路已接通' }}</span></div>
    <svg :viewBox="mode === 'ohmmeter' ? '0 0 600 360' : '0 0 600 290'" role="img" :aria-label="`${mode === 'ammeter' ? '表头与分流电阻并联' : mode === 'voltmeter' ? `输入电压源 ${stimulus.toFixed(2)} V 加在串联的分压电阻与表头两端`  : `电池、调零电阻与表头串联；底部有两个接线柱和表笔；${probeState}`}；${connected && stimulus !== Infinity ? '电路已接通' : '尚未接通'}${connected && mode !== 'ohmmeter' ? '；虚线框内的表头与电阻共同组成改装后的电表' : ''}`">
      <g v-if="mode === 'ammeter'">
        <g v-if="connected" class="converted-meter">
          <rect x="145" y="40" width="380" height="235" rx="12" class="meter-boundary" />
          <text x="335" y="25" class="boundary-label">改装后的电流表 · 0～0.6 A</text>
        </g>
        <path d="M45 150 H170 M170 150 V90 H255 M335 90 H435 V150 H550 M170 150 V216 H255 M335 216 H435 V150" class="wire" :class="{ live: connected }" />
        <path d="M170 90 H255 M335 90 H435" class="branch-meter" :class="{ live: connected }" />
        <path d="M170 216 H255 M335 216 H435" class="branch-resistor" :class="{ live: connected }" />
        <circle cx="295" cy="90" r="38" class="movement" />
        <text x="295" y="85" class="part-main">表头 G</text><text x="295" y="104" class="part-sub">100 Ω</text>
        <rect x="255" y="195" width="80" height="42" rx="6" class="resistor" :class="{ ghost: !connected }" />
        <text x="295" y="220" class="part-main">R 并联</text>
        <text x="295" y="263" class="value-text">{{ ohms(resistor) }}</text>
        <text x="70" y="133" class="value-text">{{ inputLabel }}</text>
        <text x="443" y="73" class="meter-text">I表 {{ connected ? mA(readings.meterCurrent) : '—' }}</text>
        <text x="443" y="231" class="shunt-text">I分流 {{ connected ? mA(readings.resistorCurrent) : '—' }}</text>
        <path v-if="connected" d="M195 81 l10 9 -10 9 M195 207 l10 9 -10 9" class="arrow" />
        <circle cx="170" cy="150" r="5" class="junction" /><circle cx="435" cy="150" r="5" class="junction" />
      </g>
      <g v-else-if="mode === 'voltmeter'">
        <g v-if="connected" class="converted-meter">
          <rect x="135" y="40" width="330" height="170" rx="12" class="meter-boundary" />
          <text x="300" y="25" class="boundary-label">改装后的电压表 · 0～3 V</text>
        </g>
        <path d="M85 90 H165 M245 90 H345 M425 90 H510 V230 H323 M277 230 H85 V90" class="wire" :class="{ live: connected }" />
        <rect x="165" y="69" width="80" height="42" rx="6" class="resistor" :class="{ ghost: !connected }" />
        <text x="205" y="95" class="part-main">R 串联</text>
        <circle cx="385" cy="90" r="40" class="movement" />
        <text x="385" y="85" class="part-main">表头 G</text><text x="385" y="104" class="part-sub">100 Ω</text>
        <text v-if="!connected" x="295" y="25" class="value-text">串联电阻与表头组成电压表</text>
        <text x="205" y="144" class="value-text">{{ ohms(resistor) }}</text>
        <text x="385" y="152" class="meter-text">I表 {{ connected ? mA(readings.meterCurrent) : '—' }}</text>
        <text x="205" y="179" class="shunt-text">I电阻 {{ connected ? mA(readings.resistorCurrent) : '—' }}</text>
        <text x="205" y="200" class="value-text">U电阻 {{ connected ? `${readings.resistorVoltage.toFixed(3)} V` : '—' }}</text>
        <text x="385" y="179" class="value-text">U表头 {{ connected ? `${readings.meterVoltage.toFixed(3)} V` : '—' }}</text>
        <path v-if="connected" d="M282 81 l10 9 -10 9" class="arrow" />
        <g class="voltage-source">
          <circle cx="300" cy="230" r="23" class="source-symbol" />
          <text x="290" y="235" class="part-main">＋</text><text x="310" y="235" class="part-main">−</text>
          <text x="300" y="278" class="source-label">输入电压源 U = {{ stimulus.toFixed(2) }} V</text>
        </g>
      </g>
      <g v-else class="ohmmeter-circuit">
        <path d="M90 148 V62 H260 M340 62 H505 V128 M505 192 V252 H395 M205 252 H90 V170" class="wire" :class="{ live: connected && stimulus !== Infinity }" />
        <circle cx="300" cy="62" r="40" class="movement" />
        <text x="300" y="68" class="part-main">G</text>
        <text x="300" y="124" class="value-text">Rg = 100 Ω</text>
        <text x="300" y="155" class="meter-text">I表 {{ connected ? mA(readings.meterCurrent) : '—' }}</text>
        <line x1="65" y1="148" x2="115" y2="148" class="battery" /><line x1="75" y1="170" x2="105" y2="170" class="battery" />
        <text x="133" y="150" class="value-text">＋</text><text x="133" y="175" class="value-text">－</text>
        <text x="153" y="205" class="value-text">E = 1.5 V</text>
        <rect x="491" y="128" width="28" height="64" class="resistor" :class="{ ghost: !connected }" />
        <text x="437" y="153" class="part-main">R₀ 调零</text>
        <text x="437" y="178" class="value-text">{{ ohms(resistor) }}</text>
        <g class="ohm-terminals">
          <circle cx="205" cy="252" r="7" class="terminal red" /><circle cx="395" cy="252" r="7" class="terminal black" />
          <text x="205" y="226" class="part-main">A</text><text x="395" y="226" class="part-main">B</text>
          <text x="155" y="279" class="value-text">红接线柱</text><text x="447" y="279" class="value-text">黑接线柱</text>
          <path d="M205 259 V310 H260" class="probe-lead red" /><path d="M395 259 V310 H340" class="probe-lead black" />
        </g>
        <g v-if="stimulus === 0" class="shorted-probes">
          <path d="M260 310 H340" class="probe-contact" />
          <circle cx="300" cy="310" r="4" class="junction" />
          <text x="300" y="348" class="value-text">两表笔短接 · 0 Ω · 欧姆调零</text>
        </g>
        <g v-else-if="stimulus === Infinity" class="open-probes">
          <path d="M260 310 H275 M325 310 H340" class="probe-contact" />
          <text x="300" y="348" class="value-text">两表笔分开 · 开路 ∞ Ω</text>
        </g>
        <g v-else class="measured-resistor">
          <rect x="260" y="299" width="80" height="22" class="resistor" />
          <text x="300" y="286" class="part-main">Rₓ 待测</text>
          <text x="300" y="348" class="value-text">{{ ohms(stimulus) }}</text>
        </g>
        <path v-if="connected && readings.meterCurrent > 0" d="M385 53 l10 9 -10 9" class="arrow" />
      </g>
    </svg>
  </div>
</template>
<style scoped>
.diagram-wrap { min-width: 0; padding: 15px 18px 8px; border: 1px solid #335160; border-radius: 15px; background: #142b35; }
.diagram-heading { display: flex; justify-content: space-between; gap: 8px; color: #e5f1eb; font-size: 13px; }
.diagram-heading span { color: #98b6ae; font-size: 11px; }
svg { display: block; width: 100%; max-height: 260px; }
.wire { fill: none; stroke: #57747c; stroke-width: 3; stroke-linejoin: round; }
.wire.live { stroke: #9db9ae; }
.branch-meter, .branch-resistor { fill: none; stroke-width: 4; opacity: .55; }
.branch-meter { stroke: #f2b277; }.branch-resistor { stroke: #72d1c2; }
.branch-meter.live, .branch-resistor.live { opacity: 1; }
.movement { fill: #1d3a3e; stroke: #f2b277; stroke-width: 3; }
.resistor { fill: #214b4d; stroke: #72d1c2; stroke-width: 3; }
.resistor.ghost { fill: #26363e; stroke: #678087; stroke-dasharray: 6 5; }
.part-main, .part-sub, .value-text, .meter-text, .shunt-text, .loop-note { text-anchor: middle; font-family: inherit; }
.part-main { fill: #f4f6e9; font-size: 14px; font-weight: 650; }.part-sub { fill: #b4c6bc; font-size: 12px; }
.value-text { fill: #a9c8b5; font-size: 12px; }.meter-text { fill: #f2b277; font-size: 13px; }.shunt-text { fill: #72d1c2; font-size: 13px; }.loop-note { fill: #a9c8b5; font-size: 13px; }
.meter-boundary { fill: none; stroke: #aec7b6; stroke-width: 2; stroke-dasharray: 7 5; }.boundary-label { fill: #d6e9dd; text-anchor: middle; font-family: inherit; font-size: 15px; }
.source-symbol { fill: #23383a; stroke: #edcd86; stroke-width: 3; }.source-label { fill: #edcd86; text-anchor: middle; font-family: inherit; font-size: 15px; }
.terminal { fill: #142b35; stroke-width: 3; }.terminal.black { stroke: #c6d0cd; }.terminal.red { stroke: #ef8c7f; }
.probe-lead, .probe-contact { fill: none; stroke-width: 3; stroke-linejoin: round; }.probe-lead.black { stroke: #c6d0cd; }.probe-lead.red { stroke: #ef8c7f; }.probe-contact { stroke: #d6e9dd; }
.junction { fill: #d6e9dd; }.arrow { fill: none; stroke: #f2b277; stroke-width: 2.5; stroke-linejoin: round; }.battery { stroke: #edcd86; stroke-width: 3; }
</style>
