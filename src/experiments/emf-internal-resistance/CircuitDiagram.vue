<script setup>
import { computed } from 'vue';
const props = defineProps({ connection: String, load: Number, loadMax: Number, currentScale: Object, reading: Object, ra: Number, rv: Number, ideal: Boolean });
const ay = computed(() => props.connection === 'external' ? 292 : 160);
const px = computed(() => 280 + props.load / props.loadMax * 220);
const fmt = (v, digits = 3) => v.toFixed(digits);
</script>

<template>
  <svg class="emf-circuit" viewBox="0 0 700 430" role="img" :aria-label="`${connection === 'external' ? '电流表相对电源外接：电压表跨接电源，电流表只测负载支路' : '电流表相对电源内接：电流表测总电流，电压表不包含电流表压降'}。滑动变阻器限流接法，接 A、P，B 悬空。`">
    <rect x="223" y="38" width="278" height="99" rx="12" class="source-box" />
    <text x="360" y="62" text-anchor="middle" class="note">被测电源</text>
    <g class="wire">
      <path d="M100 100 H260 M275 100 H365 M435 100 H600 V316" />
      <path :d="`M100 100 V${ay - 24} M100 ${ay + 24} V360 H280`" />
      <path d="M100 220 H325 M375 220 H600" class="voltage-wire" />
      <path :d="`M${px} 345 V316 H600`" />
      <path d="M500 360 H525" class="unused-wire" />
    </g>
    <g class="battery">
      <path d="M260 78 V122 M275 88 V112" />
      <text x="244" y="86" class="polarity">+</text><text x="284" y="89" class="polarity">−</text>
    </g>
    <text x="267" y="154" text-anchor="middle" class="symbol">E</text>
    <rect x="365" y="89" width="70" height="22" class="resistor" />
    <text x="400" y="154" text-anchor="middle" class="symbol">r</text>
    <circle cx="100" :cy="ay" r="24" class="ammeter" /><text x="100" :y="ay + 7" text-anchor="middle" class="meter-symbol">A</text>
    <text x="139" :y="ay - 2" class="current-label">{{ fmt(reading.i * currentScale.factor) }} {{ currentScale.unit }}</text>
    <text x="139" :y="ay + 18" class="note">R<tspan baseline-shift="sub" font-size="10">A</tspan> = {{ ideal ? '0' : ra }} Ω</text>
    <circle cx="350" cy="220" r="25" class="voltmeter" /><text x="350" y="227" text-anchor="middle" class="meter-symbol">V</text>
    <text x="350" y="268" text-anchor="middle" class="voltage-label">{{ fmt(reading.u) }} V</text>
    <text x="350" y="288" text-anchor="middle" class="note">R<tspan baseline-shift="sub" font-size="10">V</tspan> = {{ ideal ? '∞' : rv }} Ω</text>
    <text x="435" y="206" class="voltage-label">I<tspan baseline-shift="sub" font-size="10">V</tspan> = {{ fmt(reading.iv * 1000, 2) }} mA</text>
    <g class="flow">
      <path d="M74 123 V147 M68 140 L74 148 L80 140" />
      <path d="M428 235 H461 M454 229 L462 235 L454 241" class="v-flow" />
    </g>
    <text x="51" y="183" class="note" text-anchor="middle">I<tspan baseline-shift="sub" font-size="10">源</tspan></text>
    <circle v-for="x in [100, 600]" :key="x" :cx="x" cy="220" r="4" class="junction" />
    <rect x="280" y="349" width="220" height="22" class="rheostat" />
    <rect x="281" y="350" :width="Math.max(0, px - 281)" height="20" class="used-resistance" />
    <path :d="`M${px - 6} 337 L${px} 347 L${px + 6} 337`" class="wiper" />
    <circle cx="280" cy="360" r="4" class="junction" /><circle cx="525" cy="360" r="4" class="unused-terminal" />
    <text x="265" y="390" class="terminal">A</text><text x="525" y="390" class="terminal">B</text><text :x="px" y="307" text-anchor="middle" class="terminal">P</text>
    <text x="390" y="411" text-anchor="middle" class="note">接入 A—P：{{ load.toFixed(1) }} Ω · B 不接线</text>
  </svg>
</template>

<style scoped>
svg { display: block; width: 100%; height: auto; font-family: inherit; }
text { fill: #385d50; font-size: 15px; }
.wire,.battery { fill: none; stroke: #526f65; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.wire .voltage-wire { stroke: #ba8838; }.wire .unused-wire { stroke: #aebbb5; }
.source-box { fill: #eef4ef; stroke: #b9cbbf; stroke-dasharray: 5 4; }
.battery { stroke-width: 3.5; }.resistor { fill: white; stroke: #526f65; stroke-width: 2; }
.symbol { font: italic 20px Georgia, serif; }.note { fill: #708278; font-size: 13px; }.polarity { font-size: 16px; }
.ammeter { fill: #edf7f2; stroke: #23876d; stroke-width: 2.5; }.voltmeter { fill: #fff8e8; stroke: #bd8a30; stroke-width: 2.5; }
.meter-symbol { font-size: 22px; }.current-label { fill: #227961; font-size: 17px; }.voltage-label { fill: #946719; font-size: 16px; }
.flow { fill: none; stroke: #23876d; stroke-width: 2; }.v-flow { stroke: #bd8a30; }
.junction { fill: #526f65; }.rheostat { fill: #edf0eb; stroke: #708278; stroke-width: 2; }.used-resistance { fill: #c2e1d1; }.wiper { fill: none; stroke: #227961; stroke-width: 2; }
.unused-terminal { fill: white; stroke: #aebbb5; stroke-width: 2; }.terminal { font: italic 16px Georgia, serif; }
</style>
