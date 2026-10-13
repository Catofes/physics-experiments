<script setup>
import { computed, ref } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import ReadingPractice from '../../components/ReadingPractice.vue';
import Measurement3D from '../../components/Measurement3D.vue';
import { micrometerReading, thimbleTicks } from './physics.js';
import { MICROMETER, micrometerPositions } from './geometry.js';
import '../measurement.css';
defineProps({ experiment: { type: Object, required: true } });
const opening = ref(5.678), mode = ref('explore'), highlight = ref(true), revealed = ref(false), question = ref(0);
const view = ref('diagram');
const objectWidth = 4.728;
const reading = computed(() => micrometerReading(opening.value));
const positions = computed(() => micrometerPositions(reading.value.opening));
const ticks = computed(() => thimbleTicks(reading.value));
const showAnswer = computed(() => mode.value !== 'practice' || revealed.value);
const guides = computed(() => highlight.value && showAnswer.value);
const sleeveStart = computed(() => Math.max(0, reading.value.whole - 3));
const sleeveTicks = computed(() => Array.from({ length: 51 }, (_, i) => i / 2).filter(v => v >= sleeveStart.value && v <= reading.value.opening));
const sleeveX = value => 50 + (value - sleeveStart.value) * 110;
const edgeX = computed(() => sleeveX(reading.value.opening));
let drag;
function setOpening(value) { opening.value = micrometerReading(Math.max(mode.value === 'measure' ? objectWidth : 0, value)).opening; }
function turn(delta) { setOpening(reading.value.opening + delta); }
function nextQuestion() {
  question.value++; revealed.value = false;
  let next;
  do { next = micrometerReading(1 + Math.random() * 21).opening; } while (next === reading.value.opening);
  opening.value = next;
}
function changeMode(value) {
  mode.value = value; revealed.value = false;
  if (value==='practice') nextQuestion();
  if (value==='measure') opening.value = 7.2;
}
function reset() { mode.value = 'explore'; opening.value = 5.678; highlight.value = true; revealed.value = false; }
function pointerY(event) { return new DOMPoint(event.clientX, event.clientY).matrixTransform(event.currentTarget.ownerSVGElement.getScreenCTM().inverse()).y; }
function dragStart(event) {
  if (mode.value==='practice') return;
  drag = { id: event.pointerId, y: pointerY(event), opening: reading.value.opening };
  event.currentTarget.setPointerCapture(event.pointerId);
}
function dragMove(event) {
  if (drag?.id===event.pointerId) setOpening(drag.opening + (drag.y - pointerY(event)) * 0.5 / 140);
}
function dragEnd() { drag = undefined; }
</script>
<template>
  <ExperimentLayout :experiment="experiment" class="measurement-lab" controls-title="测微器操作">
    <template #stage>
      <div class="scene-heading"><strong>螺旋测微器 · 0～25 mm</strong><span>螺距 0.5 mm / 转 · 可动刻度 50 格</span></div>
      <ChoiceControl v-model="view" class="view-choice" label="观察视图" :options="[{value:'diagram',label:'示意图'},{value:'3d',label:'三维模型'}]"/>
      <Measurement3D v-if="view==='3d'" kind="micrometer" :opening="reading.opening" :object-width="objectWidth" :measuring="mode==='measure'" :interactive="mode!=='practice'" @opening="setOpening" @fallback="view='diagram'"/>
      <svg v-else class="instrument" viewBox="70 0 1060 380" role="img" aria-label="螺旋测微器结构：A 测砧、B 固定刻度、C 尺架、D 旋钮、D′ 微调旋钮、E 可动刻度、F 测微螺杆、G 锁紧装置">
        <defs>
          <linearGradient id="micrometer-steel" x2="0" y2="1"><stop stop-color="#b2c1cb"/><stop offset=".4" stop-color="#fafcfd"/><stop offset="1" stop-color="#8b9ca9"/></linearGradient>
          <linearGradient id="micrometer-frame" x2="0" y2="1"><stop stop-color="#458da8"/><stop offset="1" stop-color="#206078"/></linearGradient>
          <pattern id="micrometer-knurl" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-5 5 L5 -5 M0 10 L10 0 M5 15 L15 5 M-5 5 L5 15 M0 0 L10 10 M5 -5 L15 5" stroke="#738591" stroke-width=".7" fill="none"/></pattern>
        </defs>
        <path :d="MICROMETER.frame" fill="url(#micrometer-frame)" stroke="#24596d" stroke-width="2"/>
        <path :d="MICROMETER.grip" fill="#35414b" stroke="#172d39" stroke-width="2"/>
        <rect x="140" y="104" width="40" height="52" rx="3" fill="url(#micrometer-steel)" stroke="#7d969e"/>
        <rect :x="positions.movingFaceX" y="106" :width="MICROMETER.collarLeftX-positions.movingFaceX" height="48" rx="2" fill="url(#micrometer-steel)" stroke="#7d969e"/>
        <line data-anvil-face x1="180" x2="180" y1="104" y2="156" stroke="#536c76" stroke-width="2"/>
        <line data-spindle-face :x1="positions.movingFaceX" :x2="positions.movingFaceX" y1="106" y2="154" stroke="#536c76" stroke-width="2"/>
        <rect v-if="mode==='measure'" x="180" y="102" :width="objectWidth*MICROMETER.pixelsPerMM" height="56" rx="2" fill="#d5a165" stroke="#a77b47"/>
        <rect x="480" y="74" width="60" height="112" rx="7" fill="url(#micrometer-steel)" stroke="#78909a"/>
        <circle cx="510" cy="130" r="12" fill="#34474b" stroke="#203a40"/>
        <path d="M510 130 L524 147" stroke="#23383d" stroke-width="8" stroke-linecap="round"/>
        <rect data-sleeve x="540" y="82" :width="positions.edgeX-540" height="96" fill="url(#micrometer-steel)" stroke="#78909a"/>
        <line x1="540" :x2="positions.edgeX" y1="130" y2="130" stroke="#435c65"/>
        <g v-for="v in Array.from({length:51},(_,i)=>i/2).filter(v=>v<=reading.opening)" :key="v"><line :data-fixed-scale="v" :x1="positions.zeroX+v*8" :x2="positions.zeroX+v*8" :y1="v%1===0 ? 106 : 130" :y2="v%1===0 ? 130 : 154" stroke="#435c65"/><text v-if="v%5===0" :x="positions.zeroX+v*8-(v===0 ? 2 : 0)" y="100" font-size="13" :text-anchor="v===0 ? 'end' : 'middle'">{{ v }}</text></g>
        <g class="drag-part" :role="mode==='practice' ? undefined : 'slider'" :tabindex="mode==='practice' ? -1 : 0" aria-label="转动旋钮" :aria-valuemin="mode==='measure' ? objectWidth : 0" :aria-valuemax="25" :aria-valuenow="mode==='practice' ? undefined : reading.opening" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd" @lostpointercapture="dragEnd" @keydown.up.prevent="mode!=='practice' && turn(.01)" @keydown.down.prevent="mode!=='practice' && turn(-.01)">
          <path :d="`M${positions.edgeX} 81 L${positions.edgeX+48} 60 H${positions.edgeX+232} V200 H${positions.edgeX+48} L${positions.edgeX} 179 Z`" fill="url(#micrometer-steel)" stroke="#78909a"/>
          <line data-thimble-edge :x1="positions.edgeX" :x2="positions.edgeX" y1="81" y2="179" stroke="#536c76"/>
          <g v-for="tick in ticks.filter(t=>Math.abs(t.offset)<5)" :key="tick.index"><line :x1="positions.edgeX+2" :x2="positions.edgeX+(tick.index%5===0 ? 38 : 26)" :y1="130+tick.offset*9" :y2="130+tick.offset*9" stroke="#3d5660"/><text v-if="tick.index%5===0" :x="positions.edgeX+42" :y="134+tick.offset*9" font-size="13">{{ tick.index }}</text></g>
          <rect :x="positions.edgeX+86" y="61" width="146" height="138" fill="url(#micrometer-knurl)"/>
          <rect :x="positions.edgeX+232" y="106" width="32" height="48" fill="url(#micrometer-steel)" stroke="#78909a"/>
          <rect :x="positions.edgeX+264" y="94" width="64" height="72" rx="8" fill="url(#micrometer-steel)" stroke="#78909a"/>
          <rect :x="positions.edgeX+269" y="97" width="54" height="66" rx="6" fill="url(#micrometer-knurl)"/>
        </g>
        <text x="100" y="62" font-size="16" fill="#456859">A 测砧</text><path d="M145 69 L160 100" stroke="#91a79b"/>
        <text x="288" y="64" font-size="16" fill="#456859">F 测微螺杆</text><path d="M346 70 V102" stroke="#91a79b"/>
        <text x="530" y="35" font-size="16" fill="#456859">B 固定刻度</text><path d="M573 42 V79" stroke="#91a79b"/>
        <text :x="positions.edgeX-40" y="230" font-size="16" fill="#456859">E 可动刻度</text><path :d="`M${positions.edgeX+12} 212 L${positions.edgeX+22} 191`" stroke="#91a79b"/>
        <text :x="positions.edgeX+145" y="230" font-size="16" fill="#456859">D 旋钮</text><path :d="`M${positions.edgeX+180} 212 V202`" stroke="#91a79b"/>
        <text :x="positions.edgeX+245" y="65" font-size="16" fill="#456859">D′ 微调旋钮</text><path :d="`M${positions.edgeX+292} 72 V91`" stroke="#91a79b"/>
        <text x="547" y="274" font-size="16" fill="#456859">G 锁紧装置</text><path d="M568 255 L515 153" stroke="#91a79b"/>
        <text x="290" y="375" font-size="18" fill="#456859">C 尺架</text>
        <text v-if="mode==='measure'" x="100" y="202" font-size="15" fill="#976633">{{ reading.opening===objectWidth ? '两测量面已轻触小块' : '小块已放入，转动微调旋钮轻合' }}</text>
      </svg>
      <p v-if="view==='diagram'" class="instruction">{{ mode==='practice' ? '从下方局部放大图读数，注意是否露出半毫米线，并估读可动刻度。' : '上下拖动旋钮（向上张开、向下收拢），或用下方按钮精调。可动刻度随旋钮转动，测微螺杆同步平移。' }}</p>
      <p class="part-key">A 测砧　B 固定刻度　C 尺架　D 旋钮　D′ 微调旋钮　E 可动刻度　F 测微螺杆　G 锁紧装置</p>
      <section class="scale-panel" aria-label="测微器读数局部放大">
        <h2>局部放大 · 固定刻度与可动刻度</h2>
        <svg viewBox="0 0 780 305" role="img" aria-label="固定刻度的整数和半毫米刻度，以及可动刻度圆周刻度的局部放大">
          <defs><linearGradient id="micrometer-zoom" x2="0" y2="1"><stop stop-color="#c0d0d7"/><stop offset=".5" stop-color="#f7fafb"/><stop offset="1" stop-color="#b9cad2"/></linearGradient></defs>
          <rect x="20" y="63" width="710" height="159" rx="4" fill="#f1f5f3" stroke="#aabdb3"/>
          <line x1="20" x2="730" y1="145" y2="145" stroke="#495e54" stroke-width="2"/>
          <g v-for="v in sleeveTicks" :key="v"><line :x1="sleeveX(v)" :x2="sleeveX(v)" :y1="v%1===0 ? 107 : 145" :y2="v%1===0 ? 145 : 180" :stroke="guides && v===reading.sleeve ? '#ad6b2b' : '#455d52'" :stroke-width="guides && v===reading.sleeve ? 3 : 2" :data-sleeve-value="v"/><text v-if="v%1===0" :x="sleeveX(v)" y="95" text-anchor="middle" font-size="22">{{ v }}</text></g>
          <path :d="`M${edgeX} 47 L${edgeX+60} 27 H${edgeX+220} V263 H${edgeX+60} L${edgeX} 243 Z`" fill="url(#micrometer-zoom)" stroke="#8da6b0" stroke-width="2"/>
          <g v-for="tick in ticks" :key="tick.index"><line :x1="edgeX+3" :x2="edgeX+(tick.index%5===0 ? 58 : 37)" :y1="145+tick.offset*12" :y2="145+tick.offset*12" :stroke="guides && Math.abs(tick.offset)<1 ? '#16846d' : '#3f5964'" stroke-width="2" :data-thimble-index="tick.index" :data-offset="tick.offset"/><text v-if="tick.index%5===0" :x="edgeX+67" :y="152+tick.offset*12" font-size="22" fill="#3f5964">{{ tick.index }}</text></g>
          <path :d="`M20 145 H${edgeX+100}`" :stroke="guides ? '#16846d' : '#546b60'" stroke-width="2" stroke-dasharray="6 5"/>
          <text x="24" y="294" font-size="19" fill="#526f5e">上排：1 mm / 格　下排：半毫米线</text>
          <text :x="edgeX+80" y="17" font-size="19" fill="#526f5e">可动刻度</text>
        </svg>
        <p>固定刻度只读可动刻度左边缘已露出的刻度。水平基准线指向可动刻度读数；每格 0.01 mm，线间位置再估读一位。</p>
      </section>
      <section class="scale-panel" aria-label="可动刻度估读放大">
        <h2>再放大 · 看清基准线落在一格的哪里</h2>
        <svg viewBox="0 0 420 190" role="img" aria-label="可动刻度相邻刻度与基准线的精细估读图" style="max-width:600px; margin:auto">
          <rect x="20" y="8" width="380" height="173" rx="6" fill="#f1f5f3"/>
          <rect x="190" y="8" width="210" height="173" rx="6" fill="#dbe6e9"/>
          <g v-for="tick in ticks.filter(t=>Math.abs(t.offset)<3.4)" :key="tick.index"><line x1="192" :x2="tick.index%5===0 ? 262 : 241" :y1="95+tick.offset*24" :y2="95+tick.offset*24" stroke="#425d65" stroke-width="2"/><text x="281" :y="102+tick.offset*24" font-size="20" fill="#425d65">{{ tick.index }}</text></g>
          <path d="M30 95 H350" stroke="#16846d" stroke-dasharray="6 4" stroke-width="2"/>
          <text x="42" y="82" font-size="18" fill="#35725e">基准线</text><text x="32" y="165" font-size="15" fill="#5e7769">每格 0.01 mm</text>
        </svg>
        <p>此图逐条标出线号，帮助数格。基准线若落在两线之间，要估计它占这一格的比例。</p>
      </section>
    </template>
    <template #playback>
      <div class="actions"><button v-if="mode==='practice'" class="lab-button primary" @click="nextQuestion">换一道题</button><button v-if="mode==='measure'" class="lab-button primary" @click="setOpening(objectWidth)">转动微调旋钮轻合</button><button class="lab-button" @click="reset">重置实验</button></div>
    </template>
    <template #observation>
      <ReadingPractice v-if="mode==='practice'" :answer="reading.opening" :digits="3" :tolerance=".002" :question-key="question" @reveal="revealed=true"/>
      <div v-if="showAnswer" data-testid="measurement-answer">
        <div class="readings"><div><span>固定刻度读数</span><strong>{{ reading.sleeve.toFixed(1) }} mm</strong></div><div><span>基准线对应圆周格数</span><strong>{{ reading.thimble.toFixed(1) }} 格</strong></div><div><span>可动刻度读数（含估读）</span><strong>{{ reading.fraction.toFixed(3) }} mm</strong></div></div>
        <p class="read-equation">{{ reading.sleeve.toFixed(1) }} + {{ reading.thimble.toFixed(1) }} × 0.01 = <b>{{ reading.opening.toFixed(3) }} mm</b></p>
        <p class="explanation">{{ reading.half ? `已露出 ${reading.whole}.5 mm 线，固定刻度读数包含 0.5 mm。` : '下一条半毫米线尚未露出，不加 0.5 mm。' }}{{ mode==='measure' && reading.opening!==objectWidth ? '当前是测量面间距，轻合后才是物体厚度。' : '' }}</p>
      </div>
      <p v-else class="explanation">读数记录到 0.001 mm，最后一位为估读。练习允许 ±0.002 mm 的估读差异。</p>
    </template>
    <template #controls>
      <ChoiceControl :model-value="mode" label="学习方式" :options="[{value:'explore',label:'读数演示'},{value:'measure',label:'测量操作'},{value:'practice',label:'读数练习'}]" @update:model-value="changeMode"/>
      <section v-if="mode!=='practice'" class="control-section"><h2>转动与精调</h2>
        <RangeControl :model-value="reading.opening" label="测量面间距" :min="mode==='measure' ? objectWidth : 0" :max="25" :step=".001" :digits="3" unit="mm" @update:model-value="setOpening"/>
        <div class="actions"><button class="lab-button" @click="turn(-.01)">收拢一格</button><button class="lab-button" @click="turn(.01)">张开一格</button><button class="lab-button" @click="turn(-.001)">收拢 0.001</button><button class="lab-button" @click="turn(.001)">张开 0.001</button><button class="lab-button" @click="turn(.5)">张开一整转</button></div>
      </section>
      <section v-if="mode==='explore'" class="control-section"><h2>容易读错的位置</h2><div class="presets"><button class="lab-button" @click="setOpening(0)">检查零位</button><button class="lab-button" @click="setOpening(5.49)">半毫米前</button><button class="lab-button" @click="setOpening(5.51)">半毫米后</button><button class="lab-button" @click="setOpening(5.678)">练习估读</button><button class="lab-button" @click="setOpening(5.998)">整毫米前</button></div></section>
      <label v-if="showAnswer" class="check"><input v-model="highlight" type="checkbox">标出读数位置</label>
      <div class="principle"><b>一整转如何变成小位移？</b><p>螺杆转一圈推进 0.5 mm。可动刻度将一圈分成 50 格，所以每转一格推进 0.5 / 50 = 0.01 mm。</p><p>读数 = 固定刻度已露出刻度 + 可动刻度格数 × 0.01 mm。半毫米进位时可动刻度从 49 过渡到 0。</p></div>
      <p class="control-note">部件名称对应课本图 11.3-4。最小分度 0.01 mm；记录到 0.001 mm 的最后一位为估读。实测时先检查零位，接近物体后改用微调旋钮 D′，避免用力夹紧。</p>
    </template>
  </ExperimentLayout>
</template>
