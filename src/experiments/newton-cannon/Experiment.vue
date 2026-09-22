<script setup>
import { computed, ref, shallowRef, watch } from 'vue';
import MathFormula from '../../components/MathFormula.vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import OrbitCanvas from '../orbits/OrbitCanvas.vue';
import { R, MU } from '../orbits/physics.js';
import { makeOrbit, impactTime } from './physics.js';
import { useAnimation } from '../orbits/useAnimation.js';
defineProps({experiment:Object});
const height=ref(120),speed=ref(7.91),rate=ref(500),point=ref(false),vectors=ref(true),running=ref(false),time=ref(0),zoom=ref(1),crashed=ref(false);
const orbit=shallowRef(makeOrbit(R+height.value,speed.value));
let trail=[orbit.value.stateAt(0)]; const revision=ref(0);
const position=computed(()=>orbit.value.stateAt(time.value));
const collision=computed(()=>impactTime(orbit.value,point.value));
const vc=computed(()=>Math.sqrt(MU/(R+height.value))),ve=computed(()=>vc.value*Math.sqrt(2));
const kind=computed(()=>crashed.value?'撞击地表':({circle:'圆轨道',ellipse:'椭圆轨道',parabola:'抛物线逃逸轨道',hyperbola:'双曲线逃逸轨道'})[orbit.value.kind]);
const bodies=computed(()=>[{x:0,y:0,radius:R,label:point.value?'质点地球（虚线为原地表）':'地球',color:'#247fa7',outline:point.value},{...position.value,color:crashed.value?'#ff827b':'#ffdb75',min:5,label:'炮弹'}]);
const paths=computed(()=>{revision.value;return[{points:trail,color:'#6be0cf'}]});
const arrows=computed(()=>{if(!vectors.value||crashed.value)return[];const p=position.value,r=Math.hypot(p.x,p.y);return[{...p,dx:p.vx*7,dy:p.vy*7,label:'v',color:'#ffe080'},{...p,dx:-p.x/r*48,dy:-p.y/r*48,label:'F引',color:'#ff918b'}]});
function reset(){running.value=false;time.value=0;crashed.value=false;orbit.value=makeOrbit(R+height.value,speed.value);trail=[orbit.value.stateAt(0)];revision.value++;}
function launch(v=speed.value){speed.value=v;reset();running.value=true;}
watch([height,speed,point],reset,{flush:'sync'});
useAnimation(dt=>{if(!running.value)return;const next=Math.min(time.value+dt*rate.value,collision.value),step=Math.max(.5,orbit.value.sample);for(let t=(Math.floor(time.value/step)+1)*step;t<=next;t+=step)trail.push(orbit.value.stateAt(t));if(trail.length>6000)trail.splice(0,trail.length-6000);time.value=next;revision.value++;if(next>=collision.value){crashed.value=true;running.value=false;}if(Math.hypot(position.value.x,position.value.y)>R*50&&['parabola','hyperbola'].includes(orbit.value.kind))running.value=false;});
</script>
<template><ExperimentLayout class="cannon-lab" :experiment="experiment" :running="running" @toggle="crashed?launch():running=!running" @reset="reset" @hide="running=false">
<template #stage><OrbitCanvas v-model:zoom="zoom" :extent="R*1.8" :bodies="bodies" :paths="paths" :vectors="arrows">
<div class="orbit-readings" aria-label="轨道参数">
<div class="flight-readings"><strong role="status">{{ kind }}</strong><span>飞行 {{ time.toFixed(1) }} s</span><span>高度 {{ (Math.hypot(position.x,position.y)-R).toFixed(1) }} km</span></div>
<div class="speed-readings"><div><span>圆轨道速度</span><MathFormula tex="v_1 = \sqrt{\frac{\mu}{r}}"/><b>{{ vc.toFixed(3) }} <small>km/s</small></b></div><div><span>逃逸速度</span><MathFormula tex="v_2 = \sqrt{\frac{2\mu}{r}}"/><b>{{ ve.toFixed(3) }} <small>km/s</small></b></div></div>
</div></OrbitCanvas></template>
<template #playback><div class="cannon-actions" role="group" aria-label="演示操作"><button class="lab-button primary" @click="crashed?launch():running=!running">{{ running?'暂停演示':'开始 / 继续' }}</button><button class="lab-button" @click="launch()">重新发射</button><button class="lab-button" @click="reset">重置实验</button></div></template>
<template #controls><RangeControl v-model="height" label="发射高度" :min="0" :max="2000" :step="10" unit=" km"/><RangeControl v-model="speed" label="水平速度" :min=".1" :max="15" :step=".01" :digits="3" unit=" km/s"/><div><h2>预设发射</h2><div class="presets" role="group" aria-label="预设发射"><button v-for="p in [{label:'低速落地',v:4.5},{label:'精确圆轨道',v:vc},{label:'椭圆轨道',v:9.2},{label:'精确逃逸速度',v:ve}]" :key="p.label" class="lab-button" @click="launch(p.v)">{{ p.label }}</button></div></div><div><h2>时间倍率</h2><ChoiceControl v-model="rate" label="时间倍率" :options="[1,20,100,500,2000].map(value=>({value,label:value+'×'}))"/></div><label><input v-model="point" type="checkbox">质点地球（允许穿入原地表）</label><label><input v-model="vectors" type="checkbox">显示速度与引力矢量</label><p class="note">球形地球、无大气、忽略自转；使用解析开普勒轨道。真实地球模式在首次触地时停止；质点模式将全部质量集中于地心。临界速度随发射高度计算，改变参数后重新计时。</p></template>
</ExperimentLayout></template>
<style scoped>
.cannon-lab :deep(.lab-fields) { display: grid; gap: 16px; }
.cannon-lab :deep(.lab-observation) { display: none; }
.cannon-lab :deep(.zoom-tools) { top: auto; bottom: 12px; left: auto; right: 12px; }
.orbit-readings { position: absolute; top: 12px; left: 12px; right: 12px; padding: 12px 16px; border: 1px solid #7899ab40; border-radius: 10px; background: #071724d9; color: #d8e8ef; pointer-events: none; font-size: 13px; }
.flight-readings { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; font-variant-numeric: tabular-nums; }
.flight-readings strong { color: #6be0cf; }
.speed-readings { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 12px; }
.speed-readings > div { display: flex; align-items: center; gap: 10px; }
.speed-readings > div > span:first-child { color: #a9c2d1; font-size: 12px; }
.speed-readings b { font-weight: 500; font-variant-numeric: tabular-nums; }
.speed-readings small { font-size: 11px; }
.cannon-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%; }
.presets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.presets .lab-button { padding: 11px 6px; }
h2 { margin: 0 0 10px; font-size: 13px; font-weight: 600; }
label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
.note { margin: 0; font-size: 13px; line-height: 1.8; color: #536b60; }
@media(max-width:720px) {
.orbit-readings { top: 8px; left: 8px; right: 8px; padding: 10px; font-size: 12px; }
.flight-readings { gap: 6px 12px; }
.speed-readings { display: grid; gap: 8px; margin-top: 10px; }
.speed-readings > div { justify-content: space-between; }
.cannon-actions .lab-button { padding: 10px 4px; font-size: 12px; }
}
</style>
