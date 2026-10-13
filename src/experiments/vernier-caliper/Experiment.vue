<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import ReadingPractice from '../../components/ReadingPractice.vue';
import Measurement3D from '../../components/Measurement3D.vue';
import { caliperReading, vernierPosition } from './physics.js';
import { CALIPER, caliperSlider } from './geometry.js';
import '../measurement.css';
defineProps({ experiment: { type: Object, required: true } });
const divisions = ref(20), opening = ref(12.35), mode = ref('principle');
const highlight = ref(true), revealed = ref(false), question = ref(0), running = ref(false);
const reading = computed(() => caliperReading(opening.value, divisions.value));
const digits = computed(() => divisions.value === 10 ? 1 : 2);
const objectWidth = computed(() => caliperReading(12.35, divisions.value).opening);
const showAnswer = computed(() => mode.value !== 'practice' || revealed.value);
const guides = computed(() => highlight.value && showAnswer.value);
const scaleStart = computed(() => Math.max(0, Math.floor((reading.value.opening - 5) / 10) * 10));
const scaleSpan = computed(() => Math.ceil((reading.value.opening - scaleStart.value + reading.value.span + 2) / 10) * 10);
const mainTicks = computed(() => Array.from({ length: scaleSpan.value + 1 }, (_, i) => scaleStart.value + i));
const overviewX = v => 50 + (v - scaleStart.value) * 840 / scaleSpan.value;
const instrumentScale = CALIPER.pixelsPerMM;
const slider = computed(() => caliperSlider(reading.value.span));
const sliderWidth = computed(() => slider.value.width);
const displacement = computed(() => reading.value.opening * instrumentScale);
// The engraved zero is inset from the jaw face by the same distance on both scales.
const scaleZeroX = CALIPER.scaleZeroX;
const view = ref('diagram');
const closeView = ref(false);
const instrumentViewBox = computed(() => closeView.value
  ? `0 0 ${Math.max(790, displacement.value + sliderWidth.value + 410)} 425`
  : '0 0 1220 425');
let timer, drag;
function pause() { clearInterval(timer); running.value = false; }
function setOpening(value) {
  const minimum = mode.value === 'measure' ? objectWidth.value : 0;
  opening.value = caliperReading(Math.max(minimum, value), divisions.value).opening;
}
function move(delta) { pause(); setOpening(reading.value.opening + delta); }
function toggle() {
  if (running.value) { pause(); return; }
  running.value = true;
  timer = setInterval(() => {
    const r = reading.value;
    setOpening(r.main + ((r.aligned + 1) % divisions.value) / divisions.value);
  }, 550);
}
function nextQuestion() {
  pause(); question.value++; revealed.value = false;
  let next;
  do { next = caliperReading(2 + Math.random() * 43, divisions.value).opening; } while (next === reading.value.opening);
  opening.value = next;
}
function reset() {
  pause(); mode.value = 'principle'; divisions.value = 20; opening.value = 12.35;
  highlight.value = true; revealed.value = false;
  closeView.value = false;
}
watch(divisions, () => { pause(); setOpening(opening.value); revealed.value = false; question.value++; });
watch(mode, value => {
  pause(); revealed.value = false;
  if (value === 'practice') nextQuestion();
  if (value === 'measure') opening.value = 18;
});
function pointerX(event) { return new DOMPoint(event.clientX, event.clientY).matrixTransform(event.currentTarget.ownerSVGElement.getScreenCTM().inverse()).x; }
function dragStart(event) {
  if (mode.value === 'practice') return;
  pause(); drag = { id: event.pointerId, x: pointerX(event), opening: reading.value.opening };
  event.currentTarget.setPointerCapture(event.pointerId);
}
function dragMove(event) {
  if (drag?.id === event.pointerId) setOpening(drag.opening + (pointerX(event) - drag.x) / instrumentScale);
}
function dragEnd() { drag = undefined; }
onUnmounted(pause);
</script>
<template>
  <ExperimentLayout :experiment="experiment" class="measurement-lab" controls-title="卡尺操作" @hide="pause">
    <template #stage>
      <div class="scene-heading"><strong>实物结构 · {{ divisions }} 分度游标尺</strong><div v-if="view==='diagram'" class="actions"><button class="lab-button" :aria-pressed="!closeView" @click="closeView=false">实物全貌</button><button class="lab-button" :aria-pressed="closeView" @click="closeView=true">量爪近景</button></div></div>
      <ChoiceControl v-model="view" class="view-choice" label="观察视图" :options="[{value:'diagram',label:'示意图'},{value:'3d',label:'三维模型'}]"/>
      <Measurement3D v-if="view==='3d'" kind="caliper" :opening="reading.opening" :divisions="divisions" :object-width="objectWidth" :measuring="mode==='measure'" :interactive="mode!=='practice'" @opening="pause(); setOpening($event)" @fallback="view='diagram'"/>
      <svg v-else class="instrument" :viewBox="instrumentViewBox" role="img" aria-label="游标卡尺结构：A 主尺、B 游标尺、C 外测量爪、D 内测量爪、E 尺身、F 紧固螺钉">
        <defs>
          <linearGradient id="caliper-steel" x2="0" y2="1"><stop stop-color="#f6f8f9"/><stop offset=".28" stop-color="#d2d9dd"/><stop offset=".7" stop-color="#e7ecee"/><stop offset="1" stop-color="#adb9c0"/></linearGradient>
          <linearGradient id="caliper-edge" x2="1" y2="0"><stop stop-color="#7d8b94"/><stop offset=".55" stop-color="#d0d8dd"/><stop offset="1" stop-color="#697b85"/></linearGradient>
          <linearGradient id="caliper-knurl" x2="0" y2="1"><stop stop-color="#a7b2b9"/><stop offset=".5" stop-color="#e3e9ec"/><stop offset="1" stop-color="#70818b"/></linearGradient>
        </defs>
        <!-- The depth rod follows the slider and emerges from the end of the beam. -->
        <rect x="918" y="144" :width="displacement+12" height="8" fill="url(#caliper-edge)" stroke="#81909a"/>
        <rect x="104" y="122" width="826" height="64" rx="2" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
        <path d="M107 129 H927 M175 181 H927" fill="none" stroke="#f8fafb" stroke-width="2"/>
        <path :d="CALIPER.fixedInner" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
        <line data-fixed-inner-face :x1="CALIPER.innerFaceX" :x2="CALIPER.innerFaceX" y1="31" y2="96" stroke="#53636d" stroke-width="2"/>
        <path data-fixed-outer-jaw :d="CALIPER.fixedOuter" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
        <line data-fixed-outer-face x1="170" x2="170" :y1="CALIPER.outerFaceTop" :y2="CALIPER.outerFaceBottom" stroke="#53636d" stroke-width="2"/>
        <g v-for="i in 151" :key="i"><line :data-main-tick="i-1" :x1="scaleZeroX+(i-1)*instrumentScale" :x2="scaleZeroX+(i-1)*instrumentScale" :y1="(i-1)%10===0 ? 150 : (i-1)%5===0 ? 157 : 164" y2="181" stroke="#3d4d56"/><text v-if="(i-1)%10===0" :x="scaleZeroX+(i-1)*instrumentScale" y="145" text-anchor="middle" font-size="14" fill="#34464f">{{ i-1 }}</text></g>
        <text x="885" y="174" font-size="13" fill="#34464f">mm</text>
        <rect v-if="mode==='measure'" x="170" y="294" :width="objectWidth*instrumentScale" height="53" rx="2" fill="#d5a165" stroke="#ad773f"/>
        <g :transform="`translate(${displacement} 0)`" class="drag-part" :role="mode==='practice' ? undefined : 'slider'" :tabindex="mode==='practice' ? -1 : 0" aria-label="拖动活动量爪" :aria-valuemin="mode==='measure' ? objectWidth : 0" :aria-valuemax="60" :aria-valuenow="mode==='practice' ? undefined : reading.opening" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd" @lostpointercapture="dragEnd" @keydown.right.prevent="mode!=='practice' && move(reading.resolution)" @keydown.left.prevent="mode!=='practice' && move(-reading.resolution)">
          <path :d="CALIPER.movingInner" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
          <line data-moving-inner-face :x1="CALIPER.innerFaceX" :x2="CALIPER.innerFaceX" y1="31" y2="96" stroke="#53636d" stroke-width="2"/>
          <path data-moving-outer-jaw :d="CALIPER.movingOuter" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
          <line data-moving-outer-face x1="170" x2="170" :y1="CALIPER.outerFaceTop" :y2="CALIPER.outerFaceBottom" stroke="#53636d" stroke-width="2"/>
          <circle :cx="154+sliderWidth-27" cy="246" r="23" fill="url(#caliper-knurl)" stroke="#758791" stroke-width="2"/>
          <path v-for="i in 11" :key="i" :d="`M${154+sliderWidth-47+i*3.5} 257 l1 7`" stroke="#647580"/>
          <!-- The front has separate rails; their connection sits behind the beam. -->
          <path data-slider-frame :data-right="slider.right" :d="slider.frame" fill="url(#caliper-steel)" stroke="#82939d" stroke-width="1.5"/>
          <path :d="slider.topRail" fill="#c5cfd5" stroke="#82939d"/>
          <path :d="slider.bottomRail" fill="url(#caliper-steel)" stroke="#82939d"/>
          <rect :x="CALIPER.jawFaceX+2" :y="CALIPER.scaleTopY" :width="slider.right-CALIPER.jawFaceX-11" :height="CALIPER.scaleBottomY-CALIPER.scaleTopY" rx="1" fill="#e6ecef" stroke="#9eafb8"/>
          <g v-for="i in divisions+1" :key="i"><line :data-vernier-tick="i-1" :x1="scaleZeroX+(i-1)*reading.spacing*instrumentScale" :x2="scaleZeroX+(i-1)*reading.spacing*instrumentScale" :y1="CALIPER.scaleTopY" :y2="(i-1)%5===0 ? 203 : 197" stroke="#34464f"/><text v-if="(i-1)%5===0" :x="scaleZeroX+(i-1)*reading.spacing*instrumentScale" y="215" font-size="12" text-anchor="middle" fill="#34464f">{{ i-1 }}</text></g>
          <g v-for="x in [CALIPER.jawFaceX+14, (CALIPER.jawFaceX+slider.right)/2, slider.right-14]" :key="x"><circle :cx="x" cy="232" r="3.5" fill="#52616b"/><path :d="`M${x-2} 234 l4 -4`" stroke="#c8d1d7"/></g>
          <g v-for="x in [168, slider.right-14]" :key="x"><circle :cx="x" cy="114" r="3.5" fill="#52616b"/><path :d="`M${x-2} 116 l4 -4`" stroke="#c8d1d7"/></g>
          <rect :x="154+sliderWidth-47" y="91" width="14" height="15" fill="#6e808a" stroke="#627680"/>
          <rect :x="154+sliderWidth-53" y="72" width="26" height="23" rx="3" fill="url(#caliper-knurl)" stroke="#687a86"/>
          <line v-for="i in 6" :key="i" :x1="154+sliderWidth-52+i*3.5" :x2="154+sliderWidth-52+i*3.5" y1="75" y2="92" stroke="#697c86"/>
        </g>
        <g fill="#456859" font-size="17" stroke="#8da497" stroke-width="1">
          <path d="M161 56 L190 25 H226" fill="none"/><text x="237" y="31" stroke="none">D 内测量爪</text>
          <path d="M147 325 L93 360 H21" fill="none"/><text x="21" y="389" stroke="none">C 外测量爪</text>
          <path d="M680 151 V96" fill="none"/><text x="649" y="80" stroke="none">A 主尺</text>
          <path :d="`M${154+sliderWidth-40+displacement} 72 V52 H${230+sliderWidth+displacement}`" fill="none"/><text :x="240+sliderWidth+displacement" y="58" stroke="none">F 紧固螺钉</text>
          <path :d="`M${250+displacement} 216 V282 H${320+displacement}`" fill="none"/><text :x="330+displacement" y="288" stroke="none">B 游标尺</text>
          <path d="M110 150 L66 128 H21" fill="none"/><text x="21" y="116" stroke="none">E 尺身</text>
        </g>
        <text v-if="mode==='measure'" x="420" y="345" font-size="17" fill="#976633">被测小块 · {{ reading.opening===objectWidth ? '已轻触两侧' : '量爪尚未合拢' }}</text>
      </svg>
      <p v-if="view==='diagram'" class="instruction">{{ mode==='practice' ? '先读主尺，再找对齐线；用下方刻度放大图检查。' : '拖动游标尺或活动量爪，也可用滑块与精调按钮操作。主尺零线与游标尺零线在量爪并拢时对齐。' }}</p>
      <p class="part-key">A 主尺　B 游标尺　C 外测量爪　D 内测量爪　E 尺身　F 紧固螺钉</p>
      <section class="scale-panel" aria-label="游标刻度放大">
        <h2>刻度放大 · 先看游标零线，再找对齐线</h2>
        <svg viewBox="0 0 960 200" role="img" aria-label="主尺和游标刻度全景">
          <rect x="30" y="26" width="910" height="75" rx="5" fill="#f1f5f3"/>
          <rect :x="overviewX(reading.opening)-12" y="104" :width="overviewX(reading.opening+reading.span)-overviewX(reading.opening)+24" height="66" rx="4" fill="#eaf2ef"/>
          <g v-for="v in mainTicks" :key="v"><line :x1="overviewX(v)" :x2="overviewX(v)" :y1="v%10===0 ? 51 : v%5===0 ? 62 : 73" y2="96" :stroke="guides && v===reading.alignedMain ? '#16846d' : '#4e635b'" :stroke-width="guides && v===reading.alignedMain ? 3 : 1.5" :data-alignment-main="guides && v===reading.alignedMain ? '' : undefined"/><text v-if="v%10===0" data-main-label :x="overviewX(v)" y="45" text-anchor="middle" font-size="24">{{ v }}</text></g>
          <g v-for="i in divisions+1" :key="i"><line :x1="overviewX(vernierPosition(reading,i-1))" :x2="overviewX(vernierPosition(reading,i-1))" y1="106" :y2="(i-1)%5===0 ? 143 : 132" :stroke="guides && i-1===reading.aligned ? '#16846d' : '#4e635b'" :stroke-width="guides && i-1===reading.aligned ? 3 : 1.5" :data-alignment-vernier="guides && i-1===reading.aligned ? '' : undefined"/><text v-if="(i-1)%5===0" :x="overviewX(vernierPosition(reading,i-1))" y="163" text-anchor="middle" font-size="22">{{ i-1 }}</text></g>
          <line v-if="guides" :x1="overviewX(reading.alignedMain)" :x2="overviewX(reading.alignedMain)" y1="52" y2="144" stroke="#16846d" stroke-dasharray="3 4"/>
          <text x="50" y="192" font-size="17" fill="#5f766a">上：主尺 / mm　下：游标线号（从 0 开始数）</text>
        </svg>
        <p v-if="showAnswer">主尺每格 1 mm，游标尺每格 {{ reading.spacing.toFixed(digits) }} mm，比主尺每格短 {{ reading.resolution.toFixed(digits) }} mm。{{ guides ? '绿色线标出本次对齐位置。' : '观察哪一条游标线与上方主尺线共线。' }}</p>
      </section>
    </template>
    <template #playback>
      <div class="actions"><button v-if="mode==='principle'" class="lab-button primary" @click="toggle">{{ running ? '暂停演示' : '自动演示对齐' }}</button><button v-if="mode==='measure'" class="lab-button primary" @click="pause(); setOpening(objectWidth)">轻合量爪</button><button v-if="mode==='practice'" class="lab-button primary" @click="nextQuestion">换一道题</button><button class="lab-button" @click="reset">重置实验</button></div>
    </template>
    <template #observation>
      <ReadingPractice v-if="mode==='practice'" :answer="reading.opening" :digits="digits" :question-key="question" @reveal="revealed=true"/>
      <div v-if="showAnswer" data-testid="measurement-answer">
        <div class="readings"><div><span>零线左侧的主尺读数</span><strong>{{ reading.main }} mm</strong></div><div><span>对齐游标线号</span><strong>第 {{ reading.aligned }} 条</strong></div><div><span>游标小数部分</span><strong>{{ reading.fraction.toFixed(digits) }} mm</strong></div></div>
        <p class="read-equation">{{ reading.main }} + {{ reading.aligned }} × {{ reading.resolution.toFixed(digits) }} = <b>{{ reading.opening.toFixed(digits) }} mm</b></p>
        <p class="explanation">游标零线向右多走 {{ reading.fraction.toFixed(digits) }} mm，第 {{ reading.aligned }} 条线恰好利用每格 {{ reading.resolution.toFixed(digits) }} mm 的差追上主尺线。{{ mode==='measure' && reading.opening!==objectWidth ? '当前读数是量爪开口；轻合量爪后才是物体宽度。' : '' }}</p>
      </div>
      <p v-else class="explanation">只根据刻度读数，填写后检查。游标卡尺按分度值读数，不另加一位估读。</p>
    </template>
    <template #controls>
      <ChoiceControl v-model="mode" label="学习方式" :options="[{value:'principle',label:'原理演示'},{value:'measure',label:'测量操作'},{value:'practice',label:'读数练习'}]"/>
      <section class="control-section"><h2>游标分度</h2><ChoiceControl v-model="divisions" label="游标分度" :options="[{value:10,label:'10 分度',description:'0.1 mm'},{value:20,label:'20 分度',description:'0.05 mm'},{value:50,label:'50 分度',description:'0.02 mm'}]"/></section>
      <section v-if="mode!=='practice'" class="control-section"><h2>移动量爪</h2>
        <RangeControl :model-value="reading.opening" label="量爪开口" :min="mode==='measure' ? objectWidth : 0" :max="60" :step="reading.resolution" :digits="digits" unit="mm" @update:model-value="pause(); setOpening($event)"/>
        <div class="actions"><button class="lab-button" @click="move(-reading.resolution)">收拢一格</button><button class="lab-button" @click="move(reading.resolution)">张开一格</button></div>
        <div v-if="mode==='principle'" class="presets"><button class="lab-button" @click="pause(); setOpening(0)">检查零位</button><button class="lab-button" @click="pause(); setOpening(12)">整毫米</button><button class="lab-button" @click="pause(); setOpening(12.35)">小数读数</button></div>
      </section>
      <label v-if="showAnswer" class="check"><input v-model="highlight" type="checkbox">标出对齐线</label>
      <div class="principle"><b>1 mm 是怎样细分的？</b><p>{{ divisions }} 格游标尺占 {{ reading.span }} mm，每格比主尺短 1 / {{ divisions }} mm。零线移动一份长度差，下一个游标刻度就会与主尺对齐。</p><p>主尺读数 + 对齐线号 × 分度值。</p></div>
      <p class="control-note">部件名称对应课本图 11.3-1。采用课本的短游标结构：10、20、50 分度分别占 9、19、49 mm。线号直接标为 0～{{ divisions }}，读数时应数格数。模型量程 0～60 mm、无零误差，只演示外径测量。</p>
    </template>
  </ExperimentLayout>
</template>
