<script setup>
defineProps({ mode: String, high: Boolean, installed: Boolean, symbolic: Boolean, readings: Object });
</script>
<template>
  <div class="range-circuit">
    <svg viewBox="0 0 600 365" role="img" :aria-label="mode === 'voltmeter' ? `双量程电压表：黑表笔接左侧 COM，红表笔选择量程端；保留原 3 V 电压表的 G 与 2900 Ω 串联电阻 R₁；${high && installed ? '15 V 挡，G、R₁、R₂ 串联' : '3 V 挡，G 与 R₁ 串联，R₂ 无电流'}` : `双量程电流表：黑表笔接左侧 COM，红表笔选择量程端，3 A 接点接中间抽头，0.6 A 接点接右端；${high ? '3 A 挡，G 与 R₂ 串联后与 R₁ 并联' : '0.6 A 挡，G 与 R₁＋R₂ 并联'}`">
      <template v-if="mode === 'voltmeter'">
        <rect x="35" y="35" width="325" height="165" rx="8" class="boundary" />
        <text x="198" y="25">保留原 3 V 电压表</text>
        <path d="M60 320 V110 H105 M165 110 H245 M325 110 H425 M505 110 H550 V215 L520 245 M385 110 V220 L355 245" class="wire" />
        <circle cx="135" cy="110" r="30" /><text x="135" y="116">G</text><text x="94" y="99">−</text><text x="176" y="99">＋</text><text x="135" y="175">100 Ω</text>
        <rect x="245" y="90" width="80" height="40" /><text x="285" y="115">R₁</text>
        <text x="285" y="175">2900 Ω（已有）</text>
        <g :class="{ ghost: !installed }"><rect x="425" y="90" width="80" height="40" /><text x="465" y="115">R₂</text><text x="465" y="75">{{ symbolic ? '待求' : '12 kΩ' }}</text></g>
        <circle cx="385" cy="110" r="4" />
        <circle cx="355" cy="245" r="6" class="terminal-low" :class="{ chosen: !high || !installed }" />
        <circle cx="520" cy="245" r="6" class="terminal-high" :class="{ chosen: high && installed }" />
        <text x="328" y="278">3 V</text><text x="528" y="278">15 V</text>
        <path :d="high && installed ? 'M425 305 L520 245' : 'M425 305 L355 245'" class="active-wire range-switch" />
        <path d="M425 305 V320" class="wire" /><circle cx="425" cy="305" r="5" />
        <text x="75" y="340" class="common-probe">COM · 黑表笔</text><text x="425" y="340" class="red-probe">红表笔</text>
      </template>
      <template v-else>
        <rect x="60" y="15" width="410" height="175" rx="8" class="boundary" />
        <path d="M90 320 V65 H235 M295 65 H445 V205 L515 245 M90 145 H125 M215 145 H310 M400 145 H445 M265 145 V220 L300 245" class="wire" />
        <circle cx="265" cy="65" r="30" /><text x="265" y="71">G</text><text x="223" y="54">−</text><text x="307" y="54">＋</text>
        <text x="368" y="51">Rg = 100 Ω</text>
        <rect x="125" y="125" width="90" height="40" rx="4" /><text x="170" y="150">R₁</text>
        <rect x="310" y="125" width="90" height="40" rx="4" /><text x="355" y="150">R₂</text>
        <text x="170" y="111">{{ symbolic ? '待求' : '20/599 Ω' }}</text><text x="355" y="111">{{ symbolic ? '待求' : '80/599 Ω' }}</text>
        <circle cx="90" cy="145" r="4" /><circle cx="265" cy="145" r="4" /><circle cx="445" cy="145" r="4" />
        <path v-if="readings.r2Current !== 0" :d="readings.r2Current < 0 ? 'M409 145 H435 M428 140 L435 145 L428 150' : 'M435 145 H409 M416 140 L409 145 L416 150'" class="current-arrow" />
        <circle cx="300" cy="245" r="6" class="terminal-one" :class="{ chosen: high }" />
        <circle cx="515" cy="245" r="6" class="terminal-two" :class="{ chosen: !high }" />
        <text x="268" y="278">3 A</text><text x="524" y="278">0.6 A</text>
        <path :d="high ? 'M400 305 L300 245' : 'M400 305 L515 245'" class="active-wire range-switch" />
        <path d="M400 305 V320" class="wire" /><circle cx="400" cy="305" r="5" />
        <text x="90" y="339" class="common-probe">COM · 黑表笔</text><text x="400" y="339" class="red-probe">红表笔</text>
      </template>
    </svg>
    <div v-if="mode === 'voltmeter'" class="branch-readings voltage-readings">
      <strong>{{ high && installed ? '15 V 挡：G + R₁ + R₂' : '3 V 挡：G + R₁；R₂ 无电流' }}</strong>
      <span>表头：{{ readings.meterVoltage.toFixed(3) }} V</span><span>R₁：{{ readings.firstSeriesVoltage.toFixed(3) }} V</span><span>R₂：{{ readings.addedVoltage.toFixed(3) }} V</span>
      <span>原电压表：{{ readings.baseVoltage.toFixed(3) }} V</span><span>串联电流：{{ (readings.meterCurrent * 1000).toFixed(3) }} mA</span>
    </div>
    <div v-else class="branch-readings">
      <strong>{{ high ? '3 A 挡：(G + R₂) ∥ R₁' : '0.6 A 挡：G ∥ (R₁ + R₂)' }}</strong>
      <span>表头：{{ (readings.meterCurrent * 1000).toFixed(3) }} mA</span>
      <span>R₁：{{ readings.r1Current.toFixed(3) }} A（右 → 左）</span>
      <span>R₂：{{ Math.abs(readings.r2Current).toFixed(3) }} A（{{ readings.r2Current < 0 ? '左 → 右' : '右 → 左' }}）</span>
    </div>
  </div>
</template>
<style scoped>
.range-circuit { background: #142b35; border: 1px solid #335160; border-radius: 15px; padding: 14px 8px; min-width: 0; }
svg { width: 100%; display: block; } text { fill: #dcece2; text-anchor: middle; font-size: 14px; font-family: inherit; }
.branch-readings { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 8px; color: #dcece2; font-size: 13px; }.chosen { fill: #72d1c2; stroke: #72d1c2; }.branch-readings strong { flex-basis: 100%; }
.wire { fill: none; stroke: #9db9ae; stroke-width: 3; stroke-linejoin: round; }.active-wire { fill: none; stroke: #72d1c2; stroke-width: 4; }.current-arrow { fill: none; stroke: #f2b277; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }.red-probe { fill: #ef9a91; }
rect, circle { fill: #214b4d; stroke: #72d1c2; stroke-width: 2; }.boundary { fill: none; stroke: #aec7b6; stroke-dasharray: 7 5; }.ghost { opacity: .35; }
</style>
