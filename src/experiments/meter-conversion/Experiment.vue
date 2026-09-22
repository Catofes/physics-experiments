<script setup>
import { computed, nextTick, ref } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import RangeControl from '../../components/RangeControl.vue';
import CircuitDiagram from './CircuitDiagram.vue';
import MeterDial from './MeterDial.vue';
import RangeExtension from './RangeExtension.vue';
import { MOVEMENT, DEFAULTS, calculate, ohmmeterZero } from './model.js';

defineProps({ experiment: { type: Object, required: true } });
const extending = ref(false);
const modes = [{ value: 'ammeter', label: '电流表' }, { value: 'voltmeter', label: '电压表' }, { value: 'ohmmeter', label: '欧姆表' }];
const steps = ['明确任务', '计算电阻', '接入电阻', '更新刻度', '验证读数'];
const mode = ref('ammeter'), step = ref(0), solution = ref(false), connected = ref(false), relabeled = ref(false);
const resistor = ref(DEFAULTS.ammeter.resistor), stimulus = ref(0.6), openCircuit = ref(false), heading = ref(null);
const actualStimulus = computed(() => openCircuit.value ? Infinity : stimulus.value);
const readings = computed(() => calculate(mode.value, resistor.value, actualStimulus.value, connected.value));
const zeroReady = computed(() => Math.abs(ohmmeterZero(resistor.value) - MOVEMENT.fullCurrent) < 1e-9);
const target = computed(() => mode.value === 'ammeter' ? '把表头改装成 0～0.6 A 的电流表' : mode.value === 'voltmeter' ? '把表头改装成 0～3 V 的电压表' : '把表头改装成可以测电阻的欧姆表');
const connectionName = computed(() => mode.value === 'ammeter' ? '并联分流电阻' : mode.value === 'voltmeter' ? '串联分压电阻' : '串联电池与调零电阻');
const question = computed(() => mode.value === 'ammeter' ? '应该并联多大的电阻？如何计算？' : mode.value === 'voltmeter' ? '应该串联多大的电阻？如何计算？' : '表笔短接时，调零电阻应该是多少？');
const nextDisabled = computed(() => step.value === 1 ? !solution.value : step.value === 2 ? !connected.value || (mode.value === 'ohmmeter' && !zeroReady.value) : step.value === 3 ? !relabeled.value : false);
const pendingAction = computed(() => step.value === 1 ? '请先查看计算过程' : step.value === 2 ? !connected.value ? `请先${connectionName.value}` : '请先短接调零至满偏' : '请先更新表盘刻度');
const calculation = ref(null);
const primaryLabel = computed(() => step.value === 1 && !solution.value ? '查看计算过程' : step.value === 2 && !connected.value ? `接入${mode.value === 'ammeter' ? '并联电阻' : mode.value === 'voltmeter' ? '串联电阻' : '电池与调零电阻'}` : step.value === 3 && !relabeled.value ? '更新表盘刻度' : '下一步');
async function primaryAction() {
  if (step.value === 1 && !solution.value) {
    solution.value = true;
    await nextTick();
    calculation.value?.focus({ preventScroll: true });
    calculation.value?.scrollIntoView({ block: 'start' });
  } else if (step.value === 2 && !connected.value) connected.value = true;
  else if (step.value === 3 && !relabeled.value) relabeled.value = true;
  else if (!nextDisabled.value) go(step.value + 1);
}
const ma = value => `${(value * 1000).toFixed(3)} mA`;
async function go(value) {
  if (mode.value === 'ohmmeter' && value >= 3) {
    setOhms(value === 4 ? DEFAULTS.ohmmeter.stimulus : 0);
  }
  step.value = value;
  if (value < 3) relabeled.value = false;
  if (value < 2) connected.value = false;
  if (value === 2) { stimulus.value = mode.value === 'ammeter' ? 0.6 : mode.value === 'voltmeter' ? 3 : 0; openCircuit.value = false; }
  await nextTick();
  heading.value?.focus({ preventScroll: true });
  heading.value?.scrollIntoView({ block: 'start' });
}
function reset(value = mode.value) {
  extending.value = false;
  mode.value = value; solution.value = false; connected.value = false; relabeled.value = false;
  resistor.value = DEFAULTS[value].resistor; stimulus.value = value === 'ammeter' ? 0.6 : value === 'voltmeter' ? 3 : 0; openCircuit.value = false;
  go(0);
}
function setOhms(value) { openCircuit.value = value === Infinity; if (!openCircuit.value) stimulus.value = value; }
</script>
<template>
  <ExperimentLayout :experiment="experiment" :show-controls="false" :show-playback="false" class="meter-lab">
    <template #stage>
      <div class="lesson">
        <div class="lesson-top"><span>改装任务</span><strong>{{ extending ? mode === 'ohmmeter' ? '欧姆表换量程与重新调零' : mode === 'voltmeter' ? '从 3 V 电压表继续改成双量程' : '从 0.6 A 电流表继续改成双量程' : target }}</strong><button class="lab-button" @click="reset()">重新开始</button></div>
        <RangeExtension v-if="extending" :mode="mode" @back="extending = false" />
        <template v-else>
        <nav v-if="!extending" class="step-navigation" aria-label="步骤翻页"><button class="lab-button" :disabled="step === 0" @click="go(step - 1)">上一步</button><span class="navigation-copy"><strong>第 {{ step + 1 }} / 5 步 · {{ steps[step] }}</strong><span>{{ nextDisabled ? pendingAction : step === 4 ? '已完成全部步骤' : `接下来：${steps[step + 1]}` }}</span></span><button v-if="step < 4" class="lab-button primary" :disabled="primaryLabel === '下一步' && nextDisabled" @click="primaryAction">{{ primaryLabel }}</button><button v-else class="lab-button" @click="reset()">再做一次</button></nav>
        <ol class="step-track" aria-label="改装进度"><li v-for="(label, index) in steps" :key="label" :aria-current="step === index ? 'step' : undefined" :class="{ active: step === index, done: step > index }"><span>{{ index + 1 }}</span>{{ label }}</li></ol>
        <section :key="step" class="step-page" :aria-label="steps[step]">
          <p class="step-number">第 {{ step + 1 }} 步 / 5</p>
          <h2 ref="heading" tabindex="-1">{{ step === 0 ? '先看表头，再明确改装目标' : step === 1 ? question : step === 2 ? `操作一：${connectionName}` : step === 3 ? '操作二：给表盘标上新刻度' : '改装完成，试着读一读' }}</h2>
          <template v-if="step === 0">
            <ChoiceControl :model-value="mode" :options="modes" label="电表类型" @update:model-value="reset" />
            <div class="intro-grid">
              <MeterDial :mode="mode" :relabeled="false" :range="0" :meter-current="0" />
              <div class="explanation"><h3>手中这只表头</h3><dl><div><dt>内阻 Rg</dt><dd>100 Ω</dd></div><div><dt>满偏电流 Ig</dt><dd>1 mA = 0.001 A</dd></div><div><dt>原刻度</dt><dd>0～1 mA</dd></div></dl><p>流过表头的电流达到 1 mA 时，指针就已满偏。</p><p v-if="mode === 'ammeter'" class="takeaway">目标电流 0.6 A 是满偏电流的 600 倍。需要让多余的电流绕过表头。</p><p v-else-if="mode === 'voltmeter'" class="takeaway">表头满偏时两端只有 0.1 V。要测到 3 V，需要另一个电阻承担多余电压。</p><p v-else class="takeaway">用内置电池提供电流，通过指针偏转反推待测电阻。先让短接时的指针满偏。</p></div>
            </div>
          </template>
          <template v-else-if="step === 1">
            <p class="lead">{{ mode === 'ammeter' ? '总电流达到 0.6 A 时，表头只允许流过 0.001 A。其余电流该走哪条路？' : mode === 'voltmeter' ? '总电压达到 3 V 时，表头只承担 0.1 V。其余电压由串联电阻承担。' : '内置电池为 1.5 V，表笔短接（待测电阻为 0 Ω）时，需要让电流恰好达到 1 mA。' }}</p>
            <figure v-if="mode === 'ammeter'" class="shunt-principle">
              <figcaption><strong>满偏时，电流应该怎样分流？</strong><span>并联两端电压相等：Ug = UR = 0.1 V</span></figcaption>
              <svg viewBox="0 0 560 270" role="img" aria-label="并联分流原理：总电流 0.6 A 分为表头支路 0.001 A（1 mA）和分流电阻支路 0.599 A，表头内阻 100 Ω，分流电阻 R 待求。">
                <rect x="122" y="29" width="382" height="207" rx="12" class="principle-boundary" />
                <path d="M20 140 H140 M140 140 V70 H260 M340 70 H470 V140 H540 M140 140 V210 H260 M340 210 H470 V140" class="principle-wire" />
                <path d="M140 140 V70 H260 M340 70 H470 V140" class="principle-meter" />
                <path d="M140 140 V210 H260 M340 210 H470 V140" class="principle-shunt" />
                <circle cx="300" cy="70" r="38" class="principle-movement" />
                <text x="300" y="66" class="principle-part">表头 G</text><text x="300" y="86" class="principle-detail">100 Ω</text>
                <rect x="260" y="191" width="80" height="38" rx="5" class="principle-resistor" />
                <text x="300" y="216" class="principle-part">R 待求</text>
                <text x="73" y="101" class="principle-label">总电流</text><text x="73" y="125" class="principle-label">0.6 A</text>
                <text x="330" y="18" class="principle-meter-label">表头只需 0.001 A = 1 mA（满偏）</text>
                <text x="330" y="175" class="principle-shunt-label">其余 0.599 A 从分流电阻走</text>
                <text x="300" y="258" class="principle-detail">虚线框内：表头＋分流电阻，整体作为电流表</text>
                <path d="M95 133 l9 7 -9 7" class="principle-wire" />
                <path d="M197 63 l9 7 -9 7" class="principle-meter" /><path d="M197 203 l9 7 -9 7" class="principle-shunt" />
                <circle cx="140" cy="140" r="5" fill="#d6e9dd" /><circle cx="470" cy="140" r="5" fill="#d6e9dd" />
              </svg>
              <p>需要分流：表头满偏只需 1 mA，不能让 0.6 A 全部流过表头。并联电阻为其余 0.599 A 提供另一条通路。</p>
            </figure>
            <figure v-if="mode === 'voltmeter'" class="shunt-principle">
              <figcaption><strong>满偏时，3 V 电压应该怎样分配？</strong><span>串联电流相等：Ig = IR = 1 mA</span></figcaption>
              <svg viewBox="0 0 560 320" role="img" aria-label="串联分压原理：输入电压源 3 V 加在改装后的电压表两端。虚线框内为串联的分压电阻和表头，电阻承担 2.9 V，表头承担 0.1 V，两处电流均为 1 mA。表头内阻 100 Ω，串联电阻 R 待求。">
                <rect x="115" y="40" width="330" height="150" rx="12" class="principle-boundary" />
                <text x="280" y="22" class="principle-detail">虚线框内：表头＋串联电阻，整体作为电压表</text>
                <path d="M60 95 H160 M240 95 H325 M395 95 H500 V260 H304 M256 260 H60 V95" class="principle-wire" />
                <rect x="160" y="75" width="80" height="40" rx="5" class="principle-resistor" />
                <text x="200" y="100" class="principle-part">R 待求</text>
                <circle cx="360" cy="95" r="35" class="principle-movement" />
                <text x="360" y="91" class="principle-part">表头 G</text><text x="360" y="111" class="principle-detail">100 Ω</text>
                <path d="M274 88 l9 7 -9 7" class="principle-meter" />
                <text x="280" y="66" class="principle-meter-label">1 mA</text>
                <text x="200" y="157" class="principle-shunt-label">UR = 2.9 V</text>
                <text x="360" y="157" class="principle-meter-label">Ug = 0.1 V</text>
                <text x="280" y="221" class="principle-label">U = UR + Ug = 2.9 + 0.1 = 3 V</text>
                <circle cx="280" cy="260" r="24" class="principle-source" />
                <text x="270" y="266" class="principle-part">＋</text><text x="290" y="266" class="principle-part">−</text>
                <text x="280" y="309" class="principle-label">输入电压源 U = 3 V</text>
              </svg>
              <p>需要分压：表头满偏时只能承担 0.1 V，不能把 3 V 直接加在表头两端。串联电阻承担其余 2.9 V，让表头电流恰好为 1 mA。</p>
            </figure>
            <div v-if="solution" ref="calculation" tabindex="-1" class="calculation">
              <template v-if="mode === 'ammeter'"><div><small>01 · 求表头两端电压</small><p>Ug = Ig × Rg = 0.001 × 100 = <strong>0.1 V</strong></p></div><div><small>02 · 求分流支路电流</small><p>IR = I − Ig = 0.6 − 0.001 = <strong>0.599 A</strong></p></div><div><small>03 · 并联两端电压相等</small><p>R = Ug / IR = 0.1 / 0.599 = <strong>100 / 599 Ω ≈ 0.167 Ω</strong></p></div><p class="takeaway">并联一个很小的电阻，让 599 mA 从分流支路通过，表头只流过 1 mA。后续演示使用精确值 100 / 599 Ω。</p></template>
              <template v-else-if="mode === 'voltmeter'"><div><small>01 · 表头满偏电压</small><p>Ug = Ig × Rg = 0.001 × 100 = <strong>0.1 V</strong></p></div><div><small>02 · 串联电阻承担的电压</small><p>UR = U − Ug = 3 − 0.1 = <strong>2.9 V</strong></p></div><div><small>03 · 串联电流相等</small><p>R = UR / Ig = 2.9 / 0.001 = <strong>2900 Ω</strong></p></div></template>
              <template v-else><div><small>01 · 短接时所需总内阻</small><p>R内 = E / Ig = 1.5 / 0.001 = <strong>1500 Ω</strong></p></div><div><small>02 · 减去表头内阻</small><p>R调零 = R内 − Rg = 1500 − 100 = <strong>1400 Ω</strong></p></div><p class="takeaway">下一步接入电池与调零电阻，短接表笔，检查表头是否满偏。</p></template>
            </div>
          </template>
          <template v-else>
            <p class="lead" v-if="step === 2">{{ mode === 'ammeter' ? '把计算出的约 0.167 Ω 电阻并联在表头两端，再通入 0.6 A 总电流。' : mode === 'voltmeter' ? '把 2900 Ω 电阻与表头串联，再在整体两端施加 3 V 电压。' : '串联 1.5 V 电池、1400 Ω 调零电阻与表头，并短接表笔。' }} 此时仍保留原来的 mA 刻度。</p>
            <p class="lead" v-else-if="step === 3">{{ mode === 'ammeter' ? '表头流过 1 mA 时，整体电流已经是 0.6 A。原来的满偏刻度“1”，现在应该标成“0.6”，单位改为 A。' : mode === 'voltmeter' ? '表头流过 1 mA 时，整体两端电压是 3 V。将满偏刻度改为 3，单位改为 V。' : '换成非均匀的欧姆刻度，使用 ×100 倍率。右端为 0，左端为 ∞，中心刻度 15 对应 15 ×100 = 1500 Ω。' }}</p>
            <p class="lead" v-else>改变{{ mode === 'ammeter' ? '总电流' : mode === 'voltmeter' ? '待测电压' : '待测电阻' }}，对照新表盘读数和表头电流。</p>
            <div class="visual-grid"><CircuitDiagram :mode="mode" :connected="connected" :resistor="resistor" :stimulus="actualStimulus" :readings="readings" /><MeterDial :mode="mode" :relabeled="relabeled" :range="readings.range" :meter-current="readings.meterCurrent" /></div>
            <div v-if="step === 2" class="action-area">
              <div v-if="connected" class="success" role="status"><strong>✓ {{ mode === 'ammeter' ? '并联电阻已接入' : '电路已接通' }}</strong><p v-if="mode === 'ammeter'">0.600 A 总电流 = 0.001 A 表头电流 + 0.599 A 分流电流。表头恰好满偏，但表盘仍是 0～1 mA。</p><p v-else-if="mode === 'voltmeter'">表头承担 0.1 V，串联电阻承担 2.9 V；两处电流都是 1 mA。表盘仍是 0～1 mA。</p><p v-else>{{ zeroReady ? '短接时表头电流为 1 mA，已满偏，可以进入下一步。' : '短接时尚未满偏，请把调零电阻调至 1400 Ω 后继续。' }}</p></div>
              <div v-if="mode === 'ohmmeter' && connected" class="measurement"><RangeControl v-model="resistor" label="调零电阻" :min="500" :max="3000" :step="10" unit=" Ω" /><button class="lab-button" @click="resistor = 1400">短接调零：设为 1400 Ω</button></div>
            </div>
            <div v-if="step === 3" class="action-area"><div v-if="relabeled" class="success" role="status"><strong>✓ 表盘已更新{{ mode === 'ammeter' ? '为 0～0.6 A' : mode === 'voltmeter' ? '为 0～3 V' : '为非均匀 Ω 刻度（×100）' }}</strong><p>指针位置没有改变，改变的是刻度表示的物理量。下一步试着测量。</p></div></div>
            <div v-if="step === 4" class="measurement">
              <RangeControl v-if="mode === 'ammeter'" v-model="stimulus" label="总电流" :min="0" :max="0.6" :step="0.01" :digits="2" unit=" A" />
              <RangeControl v-else-if="mode === 'voltmeter'" v-model="stimulus" label="待测电压" :min="0" :max="3" :step="0.1" :digits="1" unit=" V" />
              <template v-else><div class="presets"><button class="lab-button" @click="setOhms(0)">短接 0 Ω</button><button class="lab-button" @click="setOhms(1500)">半偏 1.5 kΩ</button><button class="lab-button" @click="setOhms(Infinity)">开路 ∞ Ω</button></div><RangeControl :model-value="stimulus" label="待测电阻" :min="0" :max="6000" :step="50" unit=" Ω" @update:model-value="setOhms" /></template>
              <div class="result" role="status"><strong>新表盘读数：{{ mode === 'ammeter' ? `${stimulus.toFixed(2)} A` : mode === 'voltmeter' ? `${stimulus.toFixed(1)} V` : openCircuit ? '∞ Ω' : `${stimulus} Ω` }}</strong><span>表头电流：{{ ma(readings.meterCurrent) }}</span></div>
              <p class="takeaway">{{ mode === 'ammeter' ? '例如：总电流 0.30 A 时，表头电流为 0.5 mA，指针半偏，新刻度读作 0.30 A。' : mode === 'voltmeter' ? '例如：电压 1.5 V 时，表头电流为 0.5 mA，指针半偏。' : '待测电阻越大，电流越小。欧姆表自带电池，只测未接外部电源的电阻。' }}</p>
            </div>
          </template>
        </section>
        <div v-if="step === 4" class="extension-entry"><h3>在这只电表上继续改装</h3><p>{{ mode === 'ohmmeter' ? '保留非均匀刻度，探索 ×10、×100、×1000 倍率与重新调零。' : mode === 'voltmeter' ? '保留刚做好的 0～3 V 电压表，再增加 0～15 V 挡。' : '保留刚做好的 0～0.6 A 电流表，再增加 0～3 A 挡。' }}</p><button class="lab-button primary" @click="extending = true">{{ mode === 'ohmmeter' ? '继续探索欧姆表换量程' : '继续改装成双量程电表' }}</button></div>
        </template>
      </div>
    </template>

  </ExperimentLayout>
</template>
<style scoped>
.meter-lab { height: auto; min-height: 100dvh; }
.meter-lab :deep(.lab-layout) { max-width: 1240px; margin: 0 auto; }
.meter-lab :deep(.lab-stage) { background: #fff; border-color: #dce5df; overflow: visible; height: auto; }
.meter-lab :deep(.lab-observation) { display: none; }
.lesson { padding: 26px 32px; color: #294c40; }
.lesson-top { display: flex; align-items: center; gap: 14px; }.lesson-top > span { font-size: 12px; color: #6a8175; }.lesson-top strong { flex: 1; font-size: 16px; }
.step-track { display: flex; list-style: none; padding: 20px 0; margin: 18px 0 0; border-top: 1px solid #e1e9e3; gap: 12px; }.step-track li { flex: 1; display: flex; gap: 9px; align-items: center; color: #7d8d84; font-size: 13px; }.step-track li > span { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; background: #edf1ed; }.step-track .active { color: #216c54; font-weight: 700; }.step-track .active > span { background: #246d56; color: white; }.step-track .done > span { background: #d9ede2; color: #286c53; }
.extension-entry { margin-top: 28px; padding: 22px; border: 1px solid #b8cebf; border-radius: 12px; background: #eff5f0; }.extension-entry p { line-height: 1.8; }
.step-page { min-height: 425px; }.step-number { color: #739082; font-size: 12px; margin: 12px 0 8px; }h2 { font-size: 24px; line-height: 1.5; margin: 0 0 20px; }h2:focus { outline: none; }h3 { margin-top: 0; font-size: 17px; }.lead { line-height: 1.85; font-size: 15px; max-width: 850px; }
.lesson :deep(.choice-control) { max-width: 400px; grid-template-columns: repeat(3, 1fr); margin-bottom: 24px; }
.intro-grid, .visual-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 24px; align-items: center; }.explanation { font-size: 14px; line-height: 1.7; }dl { margin: 0; }dl > div { display: flex; justify-content: space-between; border-bottom: 1px solid #e3eae5; padding: 9px 0; }dt { color: #71857a; }dd { margin: 0; font-weight: 600; }
.takeaway { padding: 14px 18px; border-left: 3px solid #6c9b82; background: #eff5f0; line-height: 1.8; font-size: 14px; }
.shunt-principle { max-width: 850px; margin: 20px 0; padding: 20px; border-radius: 12px; background: #142b35; color: #e5f1eb; }
.shunt-principle figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 14px; }.shunt-principle figcaption span { font-size: 12px; color: #b1c8bc; }
.shunt-principle svg { display: block; width: 100%; max-height: 300px; margin-top: 20px; }.shunt-principle svg text { text-anchor: middle; font-family: inherit; }
.principle-wire, .principle-meter, .principle-shunt { fill: none; stroke-width: 3; stroke-linejoin: round; }.principle-wire { stroke: #b0c5bb; }.principle-meter { stroke: #f2b277; }.principle-shunt { stroke: #72d1c2; }
.principle-boundary { fill: none; stroke: #aec7b6; stroke-width: 2; stroke-dasharray: 7 5; }.principle-source { fill: #23383a; stroke: #edcd86; stroke-width: 3; }
.principle-movement { fill: #1d3a3e; stroke: #f2b277; stroke-width: 3; }.principle-resistor { fill: #214b4d; stroke: #72d1c2; stroke-width: 3; }
.principle-part, .principle-label { fill: #f4f6e9; font-size: 17px; }.principle-detail { fill: #b4c6bc; font-size: 15px; }.principle-meter-label { fill: #f2b277; font-size: 18px; }.principle-shunt-label { fill: #72d1c2; font-size: 18px; }
.shunt-principle p { margin: 12px 0 0; padding-top: 14px; border-top: 1px solid #3a555b; color: #d6e9dd; line-height: 1.8; font-size: 14px; }
.calculation { max-width: 850px; }.calculation > div { padding: 14px 20px; margin-bottom: 12px; background: #f6f8f5; border: 1px solid #e0e8df; border-radius: 10px; }.calculation small { color: #658270; }.calculation p { margin: 8px 0 0; line-height: 1.8; }.calculation strong { color: #19694f; }
.action-area { margin-top: 22px; }.success { padding: 18px 22px; border: 2px solid #6aa98a; background: #eaf6ed; border-radius: 10px; }.success strong { font-size: 18px; color: #246747; }.success p { margin: 8px 0 0; font-size: 14px; line-height: 1.8; }.measurement { max-width: 760px; margin: 24px auto 0; }.presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }.result { display: flex; flex-wrap: wrap; gap: 12px 30px; margin-top: 20px; line-height: 1.8; }.result span { color: #687e70; }

@media (max-width: 760px) { .lesson { padding: 18px 16px; }.lesson-top { flex-wrap: wrap; gap: 8px; }.lesson-top > span { display: none; }.lesson-top strong { font-size: 14px; }.lesson-top .lab-button { padding: 8px; font-size: 11px; }.step-track { gap: 4px; padding: 16px 0; }.step-track li { flex-direction: column; gap: 6px; font-size: 10px; white-space: nowrap; }h2 { font-size: 20px; }.intro-grid, .visual-grid { grid-template-columns: 1fr; gap: 18px; }.step-page { min-height: 380px; }.calculation > div { padding: 12px; }.calculation p { font-size: 14px; }.success { padding: 14px; }.success strong { font-size: 16px; } }
/* Keep the same reachable controls in both conversion flows. */
.meter-lab :deep(.lab-button) { min-height: 48px; padding: 12px 20px; font-size: 16px; touch-action: manipulation; }
.meter-lab :deep(.lab-button:focus-visible) { outline: 3px solid #247b60; outline-offset: 3px; }
.meter-lab :deep(.step-navigation) { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr) minmax(200px, 1fr); align-items: center; gap: 16px; margin: 18px 0 0; padding: 12px; border: 1px solid #cbded1; border-radius: 12px; background: #f4faf6; box-shadow: 0 4px 12px #163d2612; }
.meter-lab :deep(.step-navigation .lab-button) { min-width: 0; min-height: 56px; white-space: normal; font-size: 18px; font-weight: 650; }
.meter-lab :deep(.navigation-copy) { display: grid; gap: 5px; text-align: center; font-size: 13px; color: #61796b; overflow-wrap: anywhere; }
.meter-lab :deep(.navigation-copy strong) { color: #294c40; font-size: 15px; }
.meter-lab :deep(h2[tabindex]), .meter-lab :deep(.calculation) { scroll-margin-top: 120px; }
@media (max-width: 760px) {
  .meter-lab :deep(.step-navigation) { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 8px; padding: 10px 8px; margin-inline: -8px; }
  .meter-lab :deep(.step-navigation .lab-button) { min-width: 88px; padding: 12px; font-size: 16px; }
  .meter-lab :deep(.navigation-copy) { grid-column: 1 / -1; grid-row: 1; font-size: 12px; gap: 3px; }
  .meter-lab :deep(h2[tabindex]), .meter-lab :deep(.calculation) { scroll-margin-top: 160px; }
  .meter-lab :deep(.navigation-copy strong) { font-size: 13px; }
}
</style>
