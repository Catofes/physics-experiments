<script setup>
import { computed, nextTick, ref } from 'vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import RangeControl from '../../components/RangeControl.vue';
import MeterDial from './MeterDial.vue';
import RangeCircuit from './RangeCircuit.vue';
import CircuitDiagram from './CircuitDiagram.vue';
import { MOVEMENT, DEFAULTS, calculate, dualRangeDesign, calculateDualRange, ohmmeterRangeDesign, calculateOhmmeter, dialReading } from './model.js';
const props = defineProps({ mode: { type: String, required: true } });
defineEmits(['back']);
const stage = ref(0), heading = ref(null), solution = ref(false), installed = ref(false), labeled = ref(false), high = ref(false);
const design = computed(() => dualRangeDesign(props.mode));
const stimulus = ref(props.mode === 'voltmeter' ? 3 : 0.6);
const readings = computed(() => props.mode === 'ammeter' && !installed.value ? calculate('ammeter', DEFAULTS.ammeter.resistor, stimulus.value) : calculateDualRange(props.mode, high.value && installed.value, stimulus.value));
const introReadings = computed(() => [false, true].map(highRange => calculateDualRange(props.mode, highRange, highRange ? design.value.high : design.value.low)));
const unit = computed(() => props.mode === 'voltmeter' ? 'V' : 'A');
const stages = computed(() => ['从原电表出发', props.mode === 'ammeter' ? '计算分段电阻' : '计算新增电阻', '接线与双刻度', '切换量程验证']);
const rangeOptions = computed(() => [{ value: 0, label: `0～${design.value.low} ${unit.value}` }, { value: 1, label: `0～${design.value.high} ${unit.value}` }]);
const blocked = computed(() => stage.value === 1 && !solution.value || stage.value === 2 && (!installed.value || !labeled.value));
const calculation = ref(null);
const primaryLabel = computed(() => stage.value === 1 && !solution.value ? '查看扩程计算' : stage.value === 2 && !installed.value ? props.mode === 'ammeter' ? '拆分电阻并接入抽头' : '接入新增串联电阻与抽头' : stage.value === 2 && !labeled.value ? '增加第二组刻度' : '下一步');
async function primaryAction() {
  if (stage.value === 1 && !solution.value) {
    solution.value = true;
    await nextTick();
    calculation.value?.focus({ preventScroll: true });
    calculation.value?.scrollIntoView({ block: 'start' });
  } else if (stage.value === 2 && !installed.value) installed.value = true;
  else if (stage.value === 2 && !labeled.value) labeled.value = true;
  else if (!blocked.value) go(stage.value + 1);
}
async function go(value) {
  stage.value = value;
  if (value < 2) { installed.value = false; labeled.value = false; high.value = false; }
  if (value === 2) stimulus.value = design.value.low;
  await nextTick(); heading.value?.focus({ preventScroll: true }); heading.value?.scrollIntoView({ block: 'start' });
}
const multiplier = ref(100), method = ref('battery'), series = ref(1400), calibrated = ref(true), resistance = ref(1500), open = ref(false);
const ohm = computed(() => ohmmeterRangeDesign(multiplier.value, method.value));
const ohmReading = computed(() => calculateOhmmeter(ohm.value, series.value, open.value ? Infinity : resistance.value));
const indicated = computed(() => dialReading('ohmmeter', ohmReading.value.fraction, ohm.value.center));
const ohmText = computed(() => indicated.value === Infinity ? '∞' : Number(indicated.value.toFixed(1)));
function changeOhm(key, value) {
  if (key === 'method') method.value = value; else multiplier.value = value;
  calibrated.value = false; resistance.value = 0; open.value = false;
}
function zero() { series.value = ohm.value.zeroResistance; calibrated.value = true; }
function setResistance(value) { open.value = value === Infinity; if (!open.value) resistance.value = value; }
</script>
<template>
  <section class="range-extension" aria-label="继续改装">
    <button class="lab-button" @click="$emit('back')">返回单量程验证</button>
    <template v-if="mode !== 'ohmmeter'">
      <nav class="step-navigation" aria-label="扩程翻页"><button class="lab-button" :disabled="stage === 0" @click="go(stage - 1)">上一步</button><span class="navigation-copy"><strong>第 {{ stage + 1 }} / 4 步 · {{ stages[stage] }}</strong><span>{{ blocked ? stage === 1 ? '请先查看扩程计算' : !installed ? '请先完成接线' : '请先增加第二组刻度' : stage === 3 ? '已完成全部步骤' : `接下来：${stages[stage + 1]}` }}</span></span><button v-if="stage < 3" class="lab-button primary" @click="primaryAction">{{ primaryLabel }}</button><button v-else class="lab-button" @click="solution = false; go(0)">重新扩程</button></nav>
      <ol class="progress" aria-label="扩程进度"><li v-for="(name, i) in stages" :key="name" :aria-current="stage === i ? 'step' : undefined" :class="{ active: stage === i }">{{ i + 1 }} · {{ name }}</li></ol>
      <h2 ref="heading" tabindex="-1">{{ stages[stage] }}：{{ mode === 'voltmeter' ? '3 V / 15 V 双量程电压表' : '0.6 A / 3 A 双量程电流表' }}</h2>
      <div v-if="stage === 0" class="explanation">
        <p>刚才做好的 {{ design.low }} {{ unit }} 电表就是这次改装的基底，{{ mode === 'ammeter' ? '保留表头，将原来的分流电阻拆成两段并引出抽头。' : '保留原表头和 2900 Ω 串联电阻，新增串联电阻与 15 V 接点。' }}</p>
        <div class="intro-circuits" aria-label="两种量程接法示意">
          <figure v-for="(isHigh, index) in [false, true]" :key="index">
            <figcaption>{{ mode === 'ammeter' ? isHigh ? '0～3 A' : '0～0.6 A' : isHigh ? '0～15 V' : '0～3 V' }}</figcaption>
            <RangeCircuit :mode="mode" :high="isHigh" installed symbolic :readings="introReadings[index]" />
          </figure>
        </div>
        <p class="note">上图为目标接法示意，分别显示两个量程满偏时的状态。先对照接入点观察电流路径，下一步再计算电阻。</p>
        <p v-if="mode === 'voltmeter'">沿用第一次改造的 3 V 电压表：表头 G（100 Ω、1 mA）与 R₁ = 2900 Ω 串联，总内阻为 3000 Ω。保留原电表的 3 V 接点，在其后新增串联电阻 R₂，并从 R₂ 末端引出 15 V 接点。</p>
        <p v-else>按参考图，左段为 R₁，右段为 R₂，表头跨接在两段电阻的总两端。黑表笔固定接左侧 COM，3 A 接点接中间抽头，0.6 A 接点接右端；红表笔选择对应量程接点。R₁ + R₂ 保持为原分流电阻 100/599 Ω。</p>
        <p class="takeaway">{{ mode === 'voltmeter' ? '3 V 挡：G 与 R₁ 串联；15 V 挡：G、R₁、R₂ 串联。3 V 挡时，R₂ 末端悬空，无电流。' : '0.6 A 挡：G ∥ (R₁ + R₂)。3 A 挡：(G + R₂) ∥ R₁。两段电阻始终参与电路；换挡改变的是电流路径。' }}</p>
      </div>
      <div v-if="stage === 1" class="explanation">
        <p>{{ mode === 'voltmeter' ? '以原 3 V 电压表为整体，分别对两个挡位列出串联电压关系，求新增电阻 R₂。' : '分别从公共端 COM 与 0.6 A、3 A 接点两端观察电路，列出两种串并联关系，再联立求 R₁、R₂。' }}</p>
        <p class="known-conditions">已知：Rg = 100 Ω，Ig = 1 mA = 0.001 A。{{ mode === 'ammeter' ? '两个量程分别为 0.6 A、3 A。' : '原串联电阻 R₁ = 2900 Ω；满偏时原电表两端为 3 V，串联电流为 Ig。' }}</p>
        <div class="intro-circuits calculation-circuits" aria-label="接法与方程对照">
          <figure v-for="(isHigh, index) in [false, true]" :key="index">
            <figcaption>{{ mode === 'ammeter' ? isHigh ? '② 3 A 挡' : '① 0.6 A 挡' : isHigh ? '② 15 V 挡' : '① 3 V 挡' }}</figcaption>
            <RangeCircuit :mode="mode" :high="isHigh" installed symbolic :readings="introReadings[index]" />
            <div class="equation-card">
              <template v-if="mode === 'ammeter' && !isHigh">
                <p><strong>G 与 (R₁ + R₂) 并联，两支路电压相等。</strong></p>
                <p>分流电流：I低 − Ig = 0.599 A</p>
                <p class="formula">(I低 − Ig)(R₁ + R₂) = Ig Rg</p>
                <p class="formula">0.599(R₁ + R₂) = 0.1　①</p>
              </template>
              <template v-else-if="mode === 'ammeter'">
                <p><strong>(G + R₂) 与 R₁ 并联，两支路电压相等。</strong></p>
                <p>R₁ 中电流：I高 − Ig = 2.999 A；R₂ 中电流为 Ig。</p>
                <p class="formula">(I高 − Ig)R₁ = Ig(Rg + R₂)</p>
                <p class="formula">2.999R₁ = 0.1 + 0.001R₂　②</p>
              </template>
              <template v-else-if="!isHigh">
                <p><strong>G 与原电阻 R₁ 串联，满偏电压仍为 3 V。</strong></p>
                <p>R₁ 中电流与表头电流相等：Ig = 0.001 A。</p>
                <p class="formula">U低 = Ig(Rg + R₁)</p>
                <p class="formula">3 = 0.001 × (100 + 2900)　①</p>
              </template>
              <template v-else>
                <p><strong>原 3 V 电压表与新增电阻 R₂ 串联。</strong></p>
                <p>G、R₁、R₂ 中电流均为 Ig = 0.001 A。</p>
                <p class="formula">U高 = Ig(Rg + R₁ + R₂)</p>
                <p class="formula">15 = 3 + 0.001R₂　②</p>
              </template>
              <small>代入数值时，电流单位为 A，电压为 V，电阻为 Ω。</small>
            </div>
          </figure>
        </div>
        <div v-if="solution" ref="calculation" tabindex="-1" class="calculation">
          <template v-if="mode === 'voltmeter'"><p>① 原电压表：Rg + R₁ = 100 + 2900 = 3000 Ω，满偏时 U低 = 0.001 × 3000 = 3 V。</p><p>② 新增电阻承担的电压：U₂ = U高 − U低 = 15 − 3 = 12 V。</p><p class="formula">R₂ = (U高 − U低) / Ig = 12 / 0.001</p><p>解得：<strong>R₂ = 12000 Ω = 12 kΩ</strong>。</p><p>15 V 挡总内阻为 15000 Ω。满偏时表头、原电阻、新增电阻分别承担 0.1 V、2.9 V、12 V，串联电流均为 1 mA。</p></template>
          <template v-else><p>① 0.6 A 挡：表头 G 与 R₁ + R₂ 并联。</p><p>(0.6 − 0.001)(R₁ + R₂) = 0.001 × 100，因此 R₁ + R₂ = 100/599 Ω。</p><p>② 3 A 挡：表头 G 与 R₂ 串联，整体再与 R₁ 并联。</p><p>(3 − 0.001)R₁ = 0.001(100 + R₂)。</p><p>③ 由①得 R₂ = 100/599 − R₁，代入②：</p><p class="formula">2.999R₁ = 0.1 + 0.001(100/599 − R₁)</p><p class="formula">3R₁ = 60/599</p><p>解得：<strong>R₁ = 20/599 Ω ≈ 0.03339 Ω</strong>；<strong>R₂ = 80/599 Ω ≈ 0.13356 Ω</strong>。</p><p>0.6 A 挡满偏：R₁、R₂ 均流过 0.599 A；3 A 挡满偏：R₁ 流过 2.999 A，R₂ 与表头均流过 0.001 A，且 R₂ 中电流方向反转。</p></template>
        </div>
      </div>
      <template v-if="stage >= 2">
        <p class="takeaway">{{ mode === 'voltmeter' ? '保留原 2900 Ω 电阻，新增串联 R₂ = 12 kΩ。黑表笔接左侧 COM，红表笔选择 3 V 抽头或 15 V 接点。' : '将原分流电阻拆为 R₁ = 20/599 Ω、R₂ = 80/599 Ω，串联后跨接在表头两端，并从中间引出 3 A 接点、右端引出 0.6 A 接点。' }} 外圈刻度固定对应 {{ design.low }} {{ unit }} 挡，内圈橙色刻度固定对应 {{ design.high }} {{ unit }} 挡；读数先看所选量程。</p>
        <div class="visual-grid"><CircuitDiagram v-if="mode === 'ammeter' && !installed" mode="ammeter" connected :resistor="DEFAULTS.ammeter.resistor" :stimulus="stimulus" :readings="readings" /><RangeCircuit v-else :mode="mode" :high="high" :installed="installed" :readings="readings" /><MeterDial :mode="mode" relabeled :range="readings.range" :outer-range="design.low" :secondary-range="labeled ? design.high : 0" :meter-current="readings.meterCurrent" /></div>
        <div v-if="stage === 2" class="actions"><p v-if="installed && labeled" role="status">双量程电表已完成。下一步切换接入点，验证两个量程。</p></div>
        <div v-else class="measurement">
          <ChoiceControl :model-value="Number(high)" @update:model-value="high = Boolean($event)" label="电表量程" :options="rangeOptions" />
          <RangeControl v-model="stimulus" :label="mode === 'voltmeter' ? '待测电压' : '总电流'" :min="0" :max="design.high" :step="mode === 'voltmeter' ? 0.1 : 0.01" :digits="2" :unit="` ${unit}`" />
          <div class="actions"><button class="lab-button" @click="stimulus = readings.range / 2">当前挡半偏</button><button class="lab-button" @click="stimulus = readings.range">当前挡满偏</button></div>
          <p class="reading" role="status">当前量程：0～{{ readings.range }} {{ unit }}；{{ readings.meterCurrent > MOVEMENT.fullCurrent * (1 + 1e-10) ? '超量程，请切换高量程挡' : `表盘读数：${stimulus.toFixed(2)} ${unit}` }}；表头电流：{{ (readings.meterCurrent * 1000).toFixed(3) }} mA</p>
          <p class="takeaway">切换挡位时，输入值保持不变。相同输入在高量程挡的偏转是低量程挡的 1/5。先用低量程满偏，再切换高量程观察。</p>
        </div>
      </template>

    </template>
    <template v-else>
      <h2>欧姆表换量程：中心阻值为什么会改变？</h2>
      <p class="takeaway">短接调零后 R内 = E / Ig；当 Rₓ = R内 时指针半偏。因此，中心阻值 R中 = E / Ig。固定电池电压和表头满偏电流时，只改变串联调零电阻不能得到一个正确调零的新量程。</p>
      <ChoiceControl :model-value="method" label="换量程方式" :options="[{ value: 'battery', label: '改变电池电压' }, { value: 'movement', label: '改变表头灵敏度' }]" @update:model-value="changeOhm('method', $event)" />
      <ChoiceControl :model-value="multiplier" label="欧姆表倍率" :options="[10, 100, 1000].map(value => ({ value, label: `×${value}` }))" @update:model-value="changeOhm('multiplier', $event)" />
      <div class="visual-grid">
        <div class="explanation ohm-parameters"><h3>串联电池 → 调零电阻 → 表头 → 待测电阻</h3><p>电池 E = <strong>{{ ohm.battery }} V</strong></p><p>表头 Ig = <strong>{{ (ohm.fullCurrent * 1000).toFixed(1) }} mA</strong>，Rg = 100 Ω</p><p>目标中心阻值 = {{ ohm.battery }} / {{ ohm.fullCurrent }} = <strong>{{ ohm.center }} Ω</strong></p><p>所需调零电阻 = {{ ohm.center }} − 100 = <strong>{{ ohm.zeroResistance }} Ω</strong></p><p>当前调零电阻：{{ series }} Ω</p><p>表笔状态：{{ open ? '开路' : resistance === 0 ? '短接' : `接入 ${resistance} Ω` }}</p></div>
        <MeterDial mode="ohmmeter" relabeled :range="ohm.center" :ohm-multiplier="multiplier" :full-current="ohm.fullCurrent" :meter-current="ohmReading.meterCurrent" />
      </div>
      <div v-if="!calibrated" class="actions"><p role="status">倍率或表头、电池已改变。保留原调零电阻，表笔已短接；请重新调零，再测电阻。</p><button class="lab-button primary" @click="zero">重新短接调零：设为 {{ ohm.zeroResistance }} Ω</button></div>
      <div v-else class="measurement"><p role="status">已调零；中心刻度 15 ×{{ multiplier }} = {{ ohm.center }} Ω。</p><div class="actions"><button class="lab-button" @click="setResistance(0)">短接 0 Ω</button><button class="lab-button" @click="setResistance(ohm.center)">半偏 {{ ohm.center }} Ω</button><button class="lab-button" @click="setResistance(Infinity)">开路 ∞ Ω</button></div><RangeControl :model-value="resistance" label="待测电阻" :min="0" :max="60000" :step="10" unit=" Ω" @update:model-value="setResistance" /><p class="reading" role="status">表盘读数：{{ ohmText }} Ω；表头电流：{{ (ohmReading.meterCurrent * 1000).toFixed(3) }} mA</p></div>
      <p class="note">本实验采用理想串联欧姆表模型；改变表头灵敏度时，假定内阻仍为 100 Ω。实际多用表也可用切换分流网络改变等效满偏电流，无需更换实体表头。每次换挡后都应重新短接调零。</p>
    </template>
  </section>
</template>
<style scoped>
.range-extension { margin-top: 20px; }h2 { font-size: 23px; line-height: 1.5; margin: 24px 0; }h2:focus { outline: none; }h3 { font-size: 16px; }
.progress { display: flex; list-style: none; gap: 12px; padding: 20px 0; border-bottom: 1px solid #dce5df; }.progress li { flex: 1; color: #71857a; font-size: 13px; }.progress .active { color: #216c54; font-weight: 700; }
.explanation, .takeaway, .measurement { font-size: 14px; line-height: 1.9; }.takeaway { padding: 14px 18px; border-left: 3px solid #6c9b82; background: #eff5f0; }.calculation, .ohm-parameters { padding: 18px; border: 1px solid #dce5df; border-radius: 12px; background: #f6f8f5; }
.intro-circuits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin: 22px 0 12px; }.intro-circuits figure { min-width: 0; margin: 0; }.intro-circuits figcaption { margin-bottom: 10px; font-size: 16px; font-weight: 650; }
.equation-card { padding: 14px 18px; margin-top: 12px; border: 1px solid #dce5df; border-radius: 12px; background: #f6f8f5; }.equation-card p { margin: 8px 0; }.equation-card small { color: #687e70; }.formula { font-weight: 650; color: #246747; overflow-wrap: anywhere; }.known-conditions { padding: 12px 16px; background: #eff5f0; border-radius: 8px; }
.visual-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 20px; align-items: center; }.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 20px 0; }.actions p { flex-basis: 100%; line-height: 1.8; }.measurement { margin-top: 24px; }.reading { color: #216c54; font-weight: 650; }.note { font-size: 13px; color: #687e70; line-height: 1.8; }
.range-extension :deep(.choice-control) { max-width: 650px; margin: 20px 0; }
@media (max-width: 760px) { .intro-circuits { grid-template-columns: 1fr; }.visual-grid { grid-template-columns: 1fr; }.progress { gap: 6px; }.progress li { font-size: 11px; }h2 { font-size: 20px; } }
</style>
