<script setup>
import { computed, ref, watch } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import ChoiceControl from '../../components/ChoiceControl.vue';
import OrbitCanvas from './OrbitCanvas.vue';
import { systemPosition, ellipsePosition, TAU } from './physics.js';
import { useAnimation } from './useAnimation.js';
const props = defineProps({ experiment: Object, lunar: Boolean });
const running=ref(true), day=ref(0), speed=ref(props.lunar ? .5 : 20), zoom=ref(1), focus=ref('wide');
let trail=[systemPosition(0,props.lunar).child]; const revision=ref(0);
const position=computed(()=>systemPosition(day.value,props.lunar));
const center=computed(()=>focus.value==='wide'?{x:0,y:0}:focus.value==='parent'?position.value.parent:position.value.child);
const extent=computed(()=>props.lunar ? (focus.value==='wide'?470000:focus.value==='parent'?16000:12000) : (focus.value==='wide'?1.16*149597870.7:focus.value==='parent'?730000:470000));
const reference=Array.from({length:721},(_,i)=>props.lunar?ellipsePosition(384400,.0549,27.321661,27.321661*i/720,.12,-.08):ellipsePosition(149597870.7,.0167086,365.256363,365.256363*i/720,.12,-.08));
const paths=computed(()=>{revision.value;const local=Array.from({length:361},(_,i)=>{const p=props.lunar?{x:6142.58*Math.cos(i/360*TAU),y:6142.58*Math.sin(i/360*TAU)}:ellipsePosition(384400,.0549,27.321661,27.321661*i/360,2.25,.48);return{x:position.value.parent.x+p.x,y:position.value.parent.y+p.y};});return[{points:reference,color:'#507a91',dashed:true},{points:local,color:'#526c78',dashed:true},{points:trail,color:props.lunar?'#7ee4bc':'#ffcd78'}];});
const bodies=computed(()=>[{x:0,y:0,radius:props.lunar?6371:696340,color:props.lunar?'#388fc0':'#ffd16d',label:props.lunar?'地球':'太阳',min:7},{...position.value.parent,radius:props.lunar?1737.4:6371,color:props.lunar?'#cad7df':'#55b1ec',label:props.lunar?'月球':'地球',min:5},{...position.value.child,radius:props.lunar?0:1737.4,color:props.lunar?'#83efc5':'#e2e8ed',label:props.lunar?'探测器':'月球',min:4}]);
watch(focus,()=>zoom.value=1);
function clear(){trail=[position.value.child];revision.value++;}
function reset(){day.value=0;running.value=false;clear();}
useAnimation(dt=>{if(!running.value)return;const next=day.value+dt*speed.value, step=props.lunar?.0025:.04;for(let t=(Math.floor(day.value/step)+1)*step;t<=next;t+=step)trail.push(systemPosition(t,props.lunar).child);if(trail.length>60000)trail.splice(0,trail.length-60000);day.value=next;revision.value++;});
</script>
<template>
<ExperimentLayout :experiment="experiment" :running="running" @toggle="running=!running" @reset="reset" @hide="running=false">
<template #stage><OrbitCanvas v-model:zoom="zoom" :center="center" :extent="extent" :bodies="bodies" :paths="paths"/></template>
<template #observation><p class="formula-note" data-testid="orbit-time">模拟时间 {{ day.toFixed(2) }} 天（{{ (day*24).toFixed(1) }} 小时）</p><p class="formula-note">{{ lunar ? '地心参考系 · 绿色为探测器历史轨迹，虚线为月球与环月参考轨道。' : '日心参考系 · 黄色为月球历史轨迹，虚线为地球与月球参考轨道。' }}</p></template>
<template #controls><ChoiceControl v-model="focus" label="观察中心" :options="[{value:'wide',label:lunar?'地心全景':'太阳全景'},{value:'parent',label:lunar?'月球近景':'地月近景'},{value:'local',label:'轨迹局部'}]"/><p>时间倍率（模拟天 / 秒）</p><ChoiceControl v-model="speed" label="时间倍率" :options="(lunar?[.1,.5,2,10]:[1,5,20,60]).map(value=>({value,label:String(value)}))"/><button class="lab-button" @click="clear">清除轨迹</button><div class="model-note"><h2>模型与比例</h2><p v-if="lunar">采用原文件的二维共面顺行模型：月球绕地周期 27.322 天，偏心率 0.0549；探测器以 6142.58 km 半径、12 小时周期绕月运动。用于观察参考系叠加，不是嫦娥六号实际任务轨迹或星历。</p><p v-else>地球绕日半长轴 1.496 亿 km，周期 365.256 天，偏心率 0.0167；月球绕地半长轴 384400 km，周期 27.322 天，偏心率 0.0549。采用二维开普勒轨道叠加，忽略摄动。</p><p>距离按比例绘制，天体标记有最小可见尺寸。缩放或切换观察中心不改变轨迹所属参考系。</p></div></template>
</ExperimentLayout>
</template>
<style scoped>.model-note{font-size:13px;color:#536b60;line-height:1.8}.model-note h2{font-size:15px}</style>
