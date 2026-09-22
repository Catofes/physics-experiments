<script setup>
import { computed, ref } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import GlobeView from './GlobeView.vue';
import earthTexture from './assets/earth-surface.jpg';
import { groundPoint, TAU, SIDEREAL_DAY, R, MU } from '../orbits/physics.js';
import { useAnimation } from '../orbits/useAnimation.js';
defineProps({ experiment: Object });
const synchronousAltitude = Math.cbrt(MU * (SIDEREAL_DAY / TAU) ** 2) - R;
const presets = [
  { value: 'sync', label: '同步轨道', altitude: synchronousAltitude, inclination: 30 },
  { value: 'geo', label: '静止轨道', altitude: synchronousAltitude, inclination: 0 },
  { value: 'leo', label: '近地轨道', altitude: 400, inclination: 51.6 },
  { value: 'meo', label: '中轨道', altitude: 20200, inclination: 55 },
  { value: 'high', label: '高轨道', altitude: 50000, inclination: 30 },
  { value: 'polar', label: '极地轨道', altitude: 800, inclination: 90 },
];
const running = ref(true), phase = ref(0), inclination = ref(30), altitude = ref(synchronousAltitude);
const rotating = ref(true), rate = ref(1), turns = ref(1), preset = ref('sync');
const period = computed(() => TAU * Math.sqrt((R + altitude.value) ** 3 / MU));
const elapsed = computed(() => phase.value / 100 * turns.value * period.value);
function at(fraction) { return groundPoint(fraction, inclination.value, period.value, rotating.value); }
const point = computed(() => at(phase.value / 100 * turns.value));
const target = computed(() => at(1 / 6)), second = computed(() => at(1 / 3));
const isSync = computed(() => Math.abs(period.value - SIDEREAL_DAY) < 1);
const time = computed(() => {
  const s = Math.floor(elapsed.value);
  return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
});
const samples = computed(() => Array.from({ length: turns.value * 720 + 1 }, (_, i) => at(i / 720)));
const longitudeSpan = computed(() => isSync.value && rotating.value && inclination.value < 85
  ? Math.min(180, Math.max(5, ...samples.value.map(p => Math.abs(p.lon))) * 1.25) : 180);
function map(p) { return { x: 300 + p.lon / longitudeSpan.value * 245, y: 195 - p.lat / 90 * 145 }; }
const groundTrack = computed(() => samples.value.map((p, i, points) => {
  const q = map(p), split = i === 0 || Math.abs(p.lon - points[i - 1].lon) > 180;
  return `${split ? 'M' : 'L'}${q.x},${q.y}`;
}).join(' '));
const mapped = computed(() => map(point.value)), aPoint = computed(() => map(target.value)), bPoint = computed(() => map(second.value));
function jump(value) { phase.value = value; running.value = false; }
function reset() { jump(0); }
function selectPreset(value) {
  const selected = presets.find(p => p.value === value);
  preset.value = value; altitude.value = selected.altitude; inclination.value = selected.inclination; reset();
}
function changeAltitude(value) { altitude.value = value; preset.value = ''; reset(); }
function changeInclination(value) { inclination.value = value; preset.value = ''; reset(); }
function changeTurns(value) { turns.value = value; reset(); }
useAnimation(dt => { if (running.value) phase.value = (phase.value + dt * rate.value * 100 / (40 * turns.value)) % 100; });
</script>

<template>
  <ExperimentLayout :experiment="experiment" :running="running" @toggle="running = !running" @reset="reset" @hide="running = false" class="geo-lab">
    <template #stage>
      <div class="geo-stage">
        <section class="geo-view">
          <div class="view-heading"><span>三维地球 · 轨道与参考面</span></div>
          <GlobeView :altitude="altitude" :inclination="inclination" :phase="phase / 100 * turns" :elapsed="elapsed" :rotating="rotating" :point="point" :target="target" :track="samples" />
        </section>
        <section class="geo-view">
          <div class="view-heading"><span>星下点轨迹 · 地球固连系</span><span>{{ turns }} 圈轨迹</span></div>
          <div class="map-key"><span>● 当前星下点</span><span>A / B 同纬对照</span></div>
          <svg class="map" viewBox="0 0 600 440" role="img" aria-label="星下点经纬度轨迹">
            <image v-if="longitudeSpan === 180" :href="earthTexture" x="55" y="50" width="490" height="290" preserveAspectRatio="none" opacity=".48" />
            <g stroke="#58788a" stroke-opacity=".6">
              <line v-for="lat in [-90, -45, 0, 45, 90]" :key="lat" x1="55" x2="545" :y1="map({lon: 0, lat}).y" :y2="map({lon: 0, lat}).y" />
              <line v-for="x in [55, 177.5, 300, 422.5, 545]" :key="x" :x1="x" :x2="x" y1="50" y2="340" />
            </g>
            <path :d="groundTrack" stroke="#72dfc0" fill="none" stroke-width="2" />
            <line x1="55" x2="545" :y1="aPoint.y" :y2="aPoint.y" stroke="#ca8492" stroke-dasharray="4 5" />
            <circle :cx="aPoint.x" :cy="aPoint.y" r="5" fill="#f49b9b" /><text :x="aPoint.x + 9" :y="aPoint.y - 10">A</text>
            <template v-if="inclination"><circle :cx="bPoint.x" :cy="bPoint.y" r="5" fill="#93afff" /><text :x="bPoint.x + 9" :y="bPoint.y - 10">B</text></template>
            <circle :cx="mapped.x" :cy="mapped.y" r="5" fill="#ffe08b" />
            <text v-for="lat in [-90, -45, 0, 45, 90]" :key="lat" x="8" :y="map({lon: 0, lat}).y + 4">{{ lat }}°</text>
            <text x="55" y="365" text-anchor="middle">−{{ longitudeSpan.toFixed(1) }}°</text><text x="300" y="365" text-anchor="middle">0°</text><text x="545" y="365" text-anchor="middle">{{ longitudeSpan.toFixed(1) }}°</text>
          </svg>
        </section>
      </div>
    </template>
    <template #observation>
      <p class="formula-note">已过时间 {{ time }} · 经度 {{ point.lon.toFixed(2) }}° · 纬度 {{ point.lat.toFixed(2) }}°</p>
      <p class="formula-note">轨道周期 {{ (period / 3600).toFixed(2) }} h（{{ (period / 60).toFixed(1) }} min） · {{ rotating ? '已考虑地球自转' : '地球自转已关闭' }}</p>
      <p class="formula-note">{{ !rotating ? '地球不自转时，每一圈星下点都沿同一路径运动。' : isSync && inclination === 0 ? '零倾角顺行圆形同步轨道：星下点固定，成为地球静止卫星。' : isSync && inclination < 90 ? '倾斜同步轨道呈“8”字形；同一纬度不等于同一固定地点。' : isSync ? '公转周期虽等于一个恒星日，极地或逆行轨道的星下点仍会绕行地球。' : '地球自转使相邻圈的星下点轨迹发生经度偏移。' }}</p>
    </template>
    <template #controls>
      <ChoiceControl :model-value="preset" label="轨道预设" :options="presets" @update:model-value="selectPreset" />
      <label class="rotation-toggle"><input v-model="rotating" type="checkbox" @change="reset" />考虑地球自转</label>
      <RangeControl :model-value="altitude" label="轨道高度" :min="200" :max="60000" :step="1" unit=" km" logarithmic @update:model-value="changeAltitude" />
      <RangeControl :model-value="inclination" label="轨道倾角" :min="0" :max="180" :step=".1" :digits="1" unit="°" @update:model-value="changeInclination" />
      <RangeControl :model-value="phase" label="时间进度" @pointerdown="running = false" @focusin="running = false" :min="0" :max="100" :step=".1" :digits="1" unit="%" @update:model-value="jump" />
      <ChoiceControl :model-value="turns" label="显示圈数" :options="[1, 3, 6].map(value => ({value, label: value + ' 圈'}))" @update:model-value="changeTurns" />
      <ChoiceControl v-model="rate" label="播放速度" :options="[.25, .5, 1, 2, 4].map(value => ({value, label: value + '×'}))" />
      <div class="buttons">
        <button class="lab-button" @click="jump(100 / 6 / turns)">跳到 A 点</button><button class="lab-button" @click="jump(100 / 3 / turns)">跳到 B 点</button>
        <button class="lab-button" @click="selectPreset(isSync && inclination === 0 ? 'sync' : 'geo')">{{ isSync && inclination === 0 ? '恢复倾斜轨道' : '切换静止卫星' }}</button>
      </div>
      <p class="note">1× 播放用 40 秒表示一圈。调节参数后暂停并回到起点；拖动进度可逐点观察。高度滑块在低轨道区更精细，也可点击数值直接输入。</p>
      <p class="note">圆轨道模型，周期随高度变化；倾角 90° 为极地轨道，大于 90° 为逆行。地球自转周期为一个恒星日（约 23 h 56 min）。</p>
      <p class="note">黄点为卫星及星下点，红点为固定地点 A，B 为第一圈另一处同纬位置。三维地球与轨道按真实比例绘制，地球会遮挡背面的卫星；同步轨迹经度自动放大，其余显示全球经度。</p>
    </template>
  </ExperimentLayout>
</template>

<style scoped>
.geo-lab{height:auto;min-height:100dvh}
.geo-lab :deep(.lab-stage){height:auto;flex:0 0 auto;container-type:inline-size}
.geo-stage{display:grid;grid-template-columns:1fr;gap:20px;padding:16px;background:#081722}
.geo-view{min-width:0}
.view-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:38px;font-size:13px;color:#c3d8e0}
.map{display:block;width:100%;height:auto}
.map-key{height:52px;display:flex;align-items:center;justify-content:space-between;color:#f1d890;font-size:12px}
text{fill:#c1d6e1;font:14px sans-serif}
.note{color:#536b60;font-size:13px;line-height:1.8}
.buttons{display:flex;gap:8px;flex-wrap:wrap}
.rotation-toggle{display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer}
.rotation-toggle input{width:20px;height:20px;accent-color:#27765c}
@container (min-width:720px){.geo-stage{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
</style>
