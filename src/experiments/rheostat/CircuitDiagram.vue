<script setup>
import { computed } from 'vue';
const props = defineProps({ mode: String, position: Number, upper: Number, lower: Number, loadVoltage: Number, loadCurrent: Number, load: Number, voltage: Number });
const wiper = computed(() => 400 - 200 * props.position);
const fmt = value => value.toFixed(2);
</script>
<template>
  <svg class="circuit-diagram" viewBox="0 0 700 340" role="img" :aria-label="`${mode === 'limit' ? `限流接法：A、滑片 P 与负载串联，B 悬空；接入电阻 ${upper.toFixed(1)} 欧` : `分压接法：A、B 接电源两端，滑片 P 与 B 接负载；A 到 P ${upper.toFixed(1)} 欧，P 到 B ${lower.toFixed(1)} 欧`}，负载电压 ${loadVoltage.toFixed(1)} 伏；电流表串联负载，电压表并联负载`">
    <g class="wires">
      <path d="M80 174 V110 H200"/>
      <path class="supply-return" d="M80 196 V290 H520 V236"/>
      <path :d="`M${wiper} 60 H520 V91 M520 129 V174 M520 150 H625 V176 M625 224 V250 H520`"/>
      <path v-if="mode === 'divider'" class="load-return" d="M400 110 H420 V290"/>
    </g>
    <g>

      <rect x="200" y="99" width="200" height="22" class="resistor"/>
      <path :d="`M${wiper} 60 V91`" class="wires"/>
      <path :d="`M${wiper-6} 84 L${wiper} 98 L${wiper+6} 84`" fill="#8ddcc5"/>
      <text :x="wiper-15" y="52" class="terminal">P</text>
      <text x="300" y="150" class="quantity" text-anchor="middle">R</text>
    </g>
    <text x="182" y="110" text-anchor="end" class="terminal">A</text><text :x="mode === 'divider' ? 420 : 407" :y="mode === 'divider' ? 100 : 131" class="terminal">B</text>
    <text v-if="mode === 'limit'" x="430" y="155" class="note">悬空</text>
    <g stroke="#e0eee9" stroke-width="3"><path d="M62 174 H98 M69 196 H91"/></g>
    <text x="45" y="154">+</text><text x="45" y="225">−</text><text x="80" y="247" text-anchor="middle" class="note">直流电源</text>
    <circle cx="520" cy="110" r="19" class="meter"/><text x="520" y="116" text-anchor="middle" class="meter-symbol">A</text>
    <text x="553" y="115" class="reading">{{ fmt(loadCurrent) }} A</text>
    <rect x="508" y="174" width="24" height="62" class="resistor"/>
    <text x="491" y="201" text-anchor="end">负载 <tspan class="quantity">R</tspan><tspan baseline-shift="sub" font-size="10">L</tspan></text>
    <text x="491" y="221" text-anchor="end" class="note">{{ load }} Ω</text>
    <circle cx="625" cy="200" r="24" class="meter"/><text x="625" y="207" text-anchor="middle" class="meter-symbol">V</text>
    <text x="660" y="205" class="reading" text-anchor="middle" transform="translate(-35 62)">{{ fmt(loadVoltage) }} V</text>
    <g fill="#cce9df"><circle cx="520" cy="150" r="3"/><circle cx="520" cy="250" r="3"/><circle v-if="mode === 'divider'" cx="420" cy="290" r="3"/></g>
    <text x="350" y="325" text-anchor="middle" class="note">{{ mode === 'divider' ? 'A、B 直接接电源两端；P、B 引出负载支路' : 'A、P 与负载串联；B 不接线' }}</text>
  </svg>
</template>
<style scoped>
svg { display: block; width: 100%; height: auto; }
text { fill: #d9e9e6; font: 14px sans-serif; }
.wires { fill: none; stroke: #96b8bb; stroke-width: 2.5; stroke-linejoin: round; }
.resistor { fill: #203d49; stroke: #f0c67d; stroke-width: 2.5; }
.meter { fill: #203d49; stroke: #8ddcc5; stroke-width: 2.5; }
.meter-symbol { font-size: 20px; }
.quantity { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-synthesis: style; font-size: 18px; }
.terminal { font-family: Georgia, serif; font-size: 16px; }
.note { fill: #a5bdb7; font-size: 12px; }
.reading { fill: #96e6cc; font-size: 15px; }
</style>
