<script setup>
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import RangeControl from '../../components/RangeControl.vue';
import OrbitCanvas from './OrbitCanvas.vue';
import { R, MU, SOI, MOON_RADIUS, MOON_DISTANCE, TAU, initialSatellite, advance, burn, elements, moonState, relativeState, acceleration, orbitPath, circularize } from './physics.js';
import { createArchive, readArchive, replayPoint } from './archive.js';
import { useAnimation } from './useAnimation.js';
const props=defineProps({experiment:Object,lunar:Boolean});
const state=shallowRef(initialSatellite()),running=ref(true),rate=ref(90),dv=ref(10),zoom=ref(1),focus=ref('earth'),vectors=ref(true),mass=ref(1000),revision=ref(0),notice=ref(''),student=ref(''),group=ref(''),note=ref('');
let trail=[{...state.value}],events=[],objectURL,sessionId=0;
const frozen=shallowRef(null),archiveOpen=ref(false),archiveDialog=ref(null);
const hasBurn=computed(()=>!!frozen.value&&(state.value.vx!==frozen.value.vx||state.value.vy!==frozen.value.vy));
const sessionDelta=computed(()=>{if(!frozen.value)return 0;const a=relativeState(frozen.value,props.lunar).state,b=relativeState(state.value,props.lunar).state;return (Math.hypot(b.vx,b.vy)-Math.hypot(a.vx,a.vy))*1000;});
function pause(){if(running.value){running.value=false;frozen.value={...state.value};sessionId++;}}
function toggle(){if(replay.value){replayRunning.value=!replayRunning.value;return;}if(state.value.crashed)return;if(running.value)pause();else{running.value=true;frozen.value=null;notice.value='正在沿调整后的速度继续运动，变轨前的历史轨迹保留。';}}

const replay=shallowRef(null),replayTime=ref(0),replayRunning=ref(false);
const telemetryState=computed(()=>replay.value?{...replayPoint(replay.value.points,replayTime.value),t:replayTime.value,crashed:replayTime.value>=replay.value.state.t?replay.value.state.crashed:''}:state.value);
const relative=computed(()=>relativeState(telemetryState.value,props.lunar));
const earthStats=computed(()=>elements(telemetryState.value));
const force=computed(()=>acceleration(telemetryState.value,telemetryState.value.t,props.lunar));
const clock=computed(()=>{const t=Math.floor(replay.value?replayTime.value:state.value.t);return [Math.floor(t/3600),Math.floor(t%3600/60),t%60].map(v=>String(v).padStart(2,'0')).join(':');});
const stats=computed(()=>elements(relative.value.state,relative.value.mu));
const moon=computed(()=>moonState(telemetryState.value.t));
const distance=computed(()=>Math.hypot(telemetryState.value.x-moon.value.x,telemetryState.value.y-moon.value.y));
const total=computed(()=>{revision.value;return events.reduce((sum,e)=>sum+(e.absoluteDeltaVMps??Math.abs(e.deltaVMps)),0)});
const visibleEvents=computed(()=>{revision.value;return (replay.value?replay.value.events.filter(e=>e.simTime<=replayTime.value):events).slice(-20);});
const status=computed(()=>telemetryState.value.crashed?`撞击${telemetryState.value.crashed}表面`:relative.value.nearMoon?(stats.value.energy<0?'月球附近负能轨道（暂时束缚）':'月球近遇'):stats.value.energy>=0?'逃逸轨道':stats.value.eccentricity<.001?'圆轨道':'椭圆轨道');
const displayed=computed(()=>replay.value?replayPoint(replay.value.points,replayTime.value):state.value);
const center=computed(()=>['moon','capture'].includes(focus.value)?moon.value:focus.value==='craft'?displayed.value:{x:0,y:0});
const extent=computed(()=>focus.value==='wide'?MOON_DISTANCE*1.18:focus.value==='moon'?18000:focus.value==='capture'?SOI*1.3:focus.value==='craft'?16000:R*1.9);
const bodies=computed(()=>[{x:0,y:0,radius:R,label:'地球',color:'#267ead',kind:'earth'},...(props.lunar?[{...moon.value,radius:MOON_RADIUS,label:'月球',color:'#d6dfe6',kind:'moon'}]:[]),{...displayed.value,min:5,label:'卫星',color:'#ffe089',kind:'satellite',angle:Math.atan2(telemetryState.value.vy,telemetryState.value.vx)}]);
const reference=Array.from({length:361},(_,i)=>({x:(R+900)*Math.cos(i/360*TAU),y:(R+900)*Math.sin(i/360*TAU)}));
const lunarOrbit=Array.from({length:361},(_,i)=>({x:MOON_DISTANCE*Math.cos(i/360*TAU),y:MOON_DISTANCE*Math.sin(i/360*TAU)}));
function prediction(p){const local=relativeState(p,props.lunar),origin=local.nearMoon?moonState(p.t):{x:0,y:0};return orbitPath(local.state,local.mu).map(q=>({x:q.x+origin.x,y:q.y+origin.y}));}
const paths=computed(()=>{revision.value;return [{points:reference,color:'#315d75',dashed:true},...(props.lunar?[{points:lunarOrbit,color:'#64808d',dashed:true}]:[]),...(!running.value&&!replay.value&&!state.value.crashed?[...(hasBurn.value?[{points:prediction(frozen.value),color:'#6e94b1',dashed:true}]:[]),{points:prediction(state.value),color:hasBurn.value?'#ffc575':'#73dacf',dashed:true}]:[]),{points:replay.value?replay.value.points.slice(0,displayed.value.index+1):trail,color:'#66e6c1',width:2}];});
const arrows=computed(()=>{if(!vectors.value||replay.value)return[];const s=state.value,a=acceleration(s,s.t,props.lunar),norm=Math.hypot(a.x,a.y);return[...(hasBurn.value?[{...s,dx:frozen.value.vx*10,dy:frozen.value.vy*10,color:'#93b4ce',label:'v前',labelDx:-18,labelDy:-14}]:[]),{...s,dx:s.vx*10,dy:s.vy*10,color:'#ffde75',label:hasBurn.value?'v后':'v地'},{...s,dx:a.x/norm*45,dy:a.y/norm*45,color:'#ff9789',label:props.lunar?'a合':'F引'},...(props.lunar?[{...s,dx:(moon.value.x-s.x)/distance.value*40,dy:(moon.value.y-s.y)/distance.value*40,color:'#b5a0ef',label:'F月方向'}]:[])]});
const circularReady=computed(()=>Math.abs(stats.value.radial)<.015&&!running.value&&!state.value.crashed&&!replay.value);
function addPoint(){trail.push({...state.value});if(trail.length>50000)trail=trail.filter((_,i)=>i%2===0||i===trail.length-1);revision.value++;}
function maneuver(delta,mode='manual'){
 if(running.value||state.value.crashed||replay.value)return;
 if(mode==='circularize'&&!circularReady.value)return;
 if(!frozen.value){frozen.value={...state.value};sessionId++;}
 const before=state.value;
 state.value=mode==='circularize'?circularize(before,props.lunar):burn(before,delta/1000,props.lunar);
 const adjustment={kind:mode,deltaVMps:delta,beforeVelocity:{x:before.vx,y:before.vy},afterVelocity:{x:state.value.vx,y:state.value.vy}};
 const absolute=Math.hypot(state.value.vx-before.vx,state.value.vy-before.vy)*1000;
 const last=events.at(-1);
 if(last&&last.sessionId===sessionId){last.deltaVMps+=delta;last.absoluteDeltaVMps+=absolute;last.afterVelocity=adjustment.afterVelocity;last.adjustments.push(adjustment);if(last.mode!==mode)last.mode='mixed';}
 else events.push({sessionId,simTime:before.t,deltaVMps:delta,absoluteDeltaVMps:absolute,mode,position:{x:before.x,y:before.y},beforeVelocity:adjustment.beforeVelocity,afterVelocity:adjustment.afterVelocity,adjustments:[adjustment]});
 addPoint();notice.value=mode==='circularize'?'已圆化。时间与位置保持不变，继续模拟后沿新轨道运动。':'速度已改变，时间与位置保持不变。可继续精调，或继续模拟。';
}
function reset(){state.value=initialSatellite();running.value=false;frozen.value={...state.value};sessionId++;trail=[{...state.value}];events=[];revision.value++;replay.value=null;replayRunning.value=false;notice.value='';}
function changeFocus(value){focus.value=value;zoom.value=1;}
function fit(){focus.value='earth';const apo=elements(state.value).apogee;zoom.value=Math.max(.025,Math.min(2,R*1.9/(Number.isFinite(apo)?apo*1.15:Math.hypot(state.value.x,state.value.y)*1.5)));}
function save(){
 const data=createArchive(state.value,[...trail,{...state.value}],events,{student:student.value,group:group.value,note:note.value});
 if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=objectURL;a.download='卫星变轨实验.json';a.click();notice.value='实验档案已导出';
}
async function load(event){const file=event.target.files[0];if(!file)return;pause();try{if(file.size>25*1024*1024)throw new Error('文件不能超过 25 MB');const data=readArchive(JSON.parse(await file.text()));state.value=data.state;frozen.value=null;sessionId=data.events.reduce((max,e)=>Math.max(max,Number.isFinite(e.sessionId)?e.sessionId:0),0)+1;trail=data.points;events=data.events;student.value=data.meta.student;group.value=data.meta.group;note.value=data.meta.note;replay.value=data;replayTime.value=0;replayRunning.value=false;revision.value++;notice.value='已读取档案，回放停在起点';}catch(error){notice.value=`读取失败：${error.message}`;}event.target.value='';}
function exitReplay(){replay.value=null;replayRunning.value=false;running.value=false;frozen.value={...state.value};sessionId++;}
function keyboard(event){if(event.target.closest('input,textarea,select,button,summary,[contenteditable=true]')||event.ctrlKey||event.metaKey||event.altKey)return;if(event.code==='Space'){event.preventDefault();toggle();}else if(['ArrowUp','ArrowDown'].includes(event.key)&&!running.value&&!replay.value){event.preventDefault();maneuver((event.key==='ArrowUp'?1:-1)*(event.shiftKey?1:dv.value));}}
watch(archiveOpen,open=>{if(open){pause();replayRunning.value=false;archiveDialog.value?.showModal();}else archiveDialog.value?.close();});
onMounted(()=>window.addEventListener('keydown',keyboard));
onUnmounted(()=>window.removeEventListener('keydown',keyboard));
onUnmounted(()=>{if(objectURL)URL.revokeObjectURL(objectURL)});
useAnimation(dt=>{
 if(replay.value){if(replayRunning.value){replayTime.value=Math.min(replay.value.state.t,replayTime.value+dt*Math.max(1,replay.value.state.t/30));if(replayTime.value>=replay.value.state.t)replayRunning.value=false;}return;}
 if(!running.value||state.value.crashed)return;let remaining=dt*rate.value;while(remaining>0&&!state.value.crashed){const step=Math.min(remaining,60);state.value=advance(state.value,step,props.lunar);remaining-=step;addPoint();}if(state.value.crashed)running.value=false;
});
</script>
<template>
  <ExperimentLayout :experiment="experiment" :show-controls="false" :show-playback="false" class="mission-lab" @hide="pause();replayRunning=false">
    <template #stage>
      <div class="mission-workspace">
        <section class="orbital-view" aria-label="轨道与变轨对照">
          <div class="view-toolbar"><div><small>地心参考系</small><h2>{{ lunar?'地月轨道视图':'卫星轨道视图' }}</h2></div><button v-if="!lunar" class="lab-button mission-button" @click="archiveOpen=true">实验档案</button></div>
          <div class="live-readings"><div><span>{{ relative.nearMoon?'月心速度':'地心速度' }}</span><strong data-testid="satellite-speed">{{ stats.speed.toFixed(3) }} <small>km/s</small></strong></div><div><span>距地高度</span><strong>{{ (earthStats.radius-R).toFixed(0) }} <small>km</small></strong></div><div><span>{{ lunar?'距月心':'轨道周期' }}</span><strong>{{ lunar?distance.toFixed(0):Number.isFinite(stats.period)?(stats.period/60).toFixed(1):'—' }} <small>{{ lunar?'km':'min' }}</small></strong></div></div><div class="time-toolbar"><span>时间倍率</span><div role="group" aria-label="时间倍率"><button v-for="value in (lunar?[30,90,360,1440,5760,11520]:[30,90,180,360,720,1440,2880])" :key="value" :aria-pressed="rate===value" @click="rate=value">{{ value }}×</button></div><label><input v-model="vectors" type="checkbox">矢量</label></div>
          <div class="canvas-panel">
            <OrbitCanvas v-model:zoom="zoom" :center="center" :extent="extent" :bodies="bodies" :paths="paths" :vectors="arrows">
              <div class="track-legend"><span><i class="history"/>历史轨迹</span><span v-if="hasBurn"><i class="before"/>变轨前</span><span v-if="!running&&!replay"><i :class="hasBurn?'after':'history'"/>{{ hasBurn?'变轨后':'当前' }}{{ lunar?'瞬时轨道':'轨道' }}</span></div>
              <div v-if="!running&&!replay&&!state.crashed" class="freeze-banner"><i/>时间已暂停 · 变速时位置不动</div>
              <div class="mission-message" role="status">{{ notice || (state.crashed?`卫星已撞击${state.crashed}表面`:running?'先暂停模拟，在固定位置改变速度，再继续观察轨道。':'可精调速度；虚线显示当前速度对应的轨道。') }}</div>
            </OrbitCanvas>
          </div>
          <div class="camera-toolbar" role="group" aria-label="观察中心"><button v-for="option in [{value:'earth',label:'地球近景'},...(lunar?[{value:'wide',label:'月地全景'},{value:'capture',label:'月球作用球'},{value:'moon',label:'月球近景'}]:[]),{value:'craft',label:'跟随卫星'}]" :key="option.value" :aria-pressed="focus===option.value" @click="changeFocus(option.value)">{{ option.label }}</button><button @click="fit">适配轨道</button></div>
          <div v-if="replay" class="replay-controls"><strong>只读回放 · {{ clock }}</strong><RangeControl v-model="replayTime" label="回放时间" :min="0" :max="replay.state.t" :step=".1" :digits="1" unit=" s"/><div><button class="lab-button mission-button" @click="toggle">{{ replayRunning?'暂停回放':'播放回放' }}</button><button class="lab-button mission-button" @click="replayTime=0;replayRunning=false">回到起点</button><button class="lab-button mission-button" @click="exitReplay">退出回放，继续实验</button></div></div>
        </section>

        <aside class="flight-controls" aria-label="变轨控制台">
          <h2 class="control-title">变轨操作</h2>
          <div class="mission-status"><div><span class="status-dot" :class="{live:running}"/>{{ replay?'只读回放':state.crashed?'任务终止':running?'模拟运行中':'模拟已暂停' }}</div><time data-testid="mission-time">{{ clock }}</time></div>
          <div class="orbit-status"><strong>{{ status }}</strong><small>{{ relative.nearMoon?'月心':'地心' }}参考</small></div>
          <button :aria-label="running?'暂停模拟':'继续模拟'" class="lab-button primary freeze-button" :class="{resume:!running}" :disabled="!!state.crashed||!!replay" @click="toggle"><div><strong>{{ running?'暂停模拟':'继续模拟' }}</strong><small>{{ running?'冻结时刻，再调整速度':'沿调整后的轨道运动' }}</small></div></button>
          <div class="burn-controls" :class="{locked:running||replay||state.crashed}">
            <div class="burn-heading"><h3>调节速度</h3><span>{{ dv }} m/s / 次</span></div>
            <div class="step-selector" role="group" aria-label="加减速步长"><button v-for="step in [1,5,10,25,50,100,250]" :key="step" :aria-pressed="dv===step" @click="dv=step">{{ step }}</button></div>
            <div class="step-hint">1 / 5 / 10 m/s 精调 · 250 m/s 快速变轨</div>
            <div class="burn-pair"><button class="lab-button burn-button prograde" :disabled="running||!!replay||!!state.crashed" aria-label="顺轨加速" @click="maneuver(dv)"><b>＋</b><strong>顺轨加速</strong><span>+{{ dv }} <small>m/s</small></span></button>
            <button class="lab-button burn-button retrograde" :disabled="running||!!replay||!!state.crashed" aria-label="逆轨减速" @click="maneuver(-dv)"><b>−</b><strong>逆轨减速</strong><span>−{{ dv }} <small>m/s</small></span></button>
            </div><p class="burn-instruction">{{ running?'请先暂停模拟，再执行瞬时变速。':relative.nearMoon?'沿月心相对速度改变速度，时间与位置不变。':'沿当前速度改变速度，时间与位置不变。' }}</p>
            <div class="delta-readings"><div><span>本次暂停 Δv</span><strong>{{ sessionDelta>=0?'+':'' }}{{ sessionDelta.toFixed(1) }}<small> m/s</small></strong></div><div><span>累计 |Δv|</span><strong>{{ total.toFixed(1) }}<small> m/s</small></strong></div></div>
          </div>
          <div class="circular-panel" :class="{ready:circularReady}"><div><h3>圆化辅助</h3><span>{{ Math.abs(stats.radial)<.015?'近 / 远地点窗口':'等待近 / 远地点' }}</span></div><dl><div><dt>当地圆轨道速度</dt><dd>{{ stats.circular.toFixed(3) }} km/s</dd></div><div><dt>径向速度 |vᵣ|</dt><dd>{{ (Math.abs(stats.radial)*1000).toFixed(1) }} m/s</dd></div><div><dt>推荐切向 Δv</dt><dd>{{ ((stats.circular-Math.sqrt(Math.max(0,stats.speed**2-stats.radial**2)))*1000).toFixed(1) }} m/s</dd></div></dl><button :disabled="!circularReady" @click="maneuver((stats.circular-Math.sqrt(Math.max(0,stats.speed**2-stats.radial**2)))*1000,'circularize')">按推荐值精确圆化</button><small>{{ running?'在近 / 远地点暂停后，可以圆化。':'窗口内圆化同时消除微小径向速度。' }}</small></div>
          <div class="footer-actions"><button class="lab-button mission-button" @click="reset">重置实验</button><details><summary>变轨记录</summary><p v-if="!visibleEvents.length">尚未变轨</p><ol><li v-for="(event,index) in visibleEvents" :key="index">{{ event.simTime.toFixed(1) }} s · Δv {{ event.deltaVMps.toFixed(1) }} m/s · {{ event.adjustments?.length||1 }} 次精调</li></ol></details></div>
          <p class="keyboard-note">空格暂停 / 继续 · ↑ ↓ 调速 · Shift + ↑ ↓ 精调</p>        <details class="model-details"><summary>更多物理量与模型说明</summary><div class="model-content">
          <div class="data-grid">
            <div><span>距地高度</span><strong>{{ (earthStats.radius-R).toFixed(0) }}</strong><small>km</small></div>
            <div><span>{{ lunar?'合加速度':'引力加速度' }}</span><strong>{{ (Math.hypot(force.x,force.y)*1000).toFixed(3) }}</strong><small>m/s²</small></div>
            <div v-if="lunar"><span>距月心</span><strong>{{ distance.toFixed(0) }}</strong><small>km</small></div>
            <div v-if="lunar"><span>月心相对速度</span><strong>{{ Math.hypot(telemetryState.vx-moon.vx,telemetryState.vy-moon.vy).toFixed(3) }}</strong><small>km/s</small></div>
            <template v-else><div><span>卫星质量</span><strong>{{ mass }}</strong><small>kg</small></div><div><span>万有引力</span><strong>{{ (MU/earthStats.radius**2*mass).toFixed(2) }}</strong><small>kN</small></div></template>
          </div>
          <div class="physics-card"><span>{{ lunar?'地心系受限三体模型':'万有引力提供向心力' }}</span><p v-if="lunar" class="lunar-formula">a = a<sub>地</sub> + a<sub>月</sub> − a<sub>地受月</sub></p><p v-else>F = GMm / r²</p><p v-if="!lunar">a = v² / r</p><dl v-else class="gravity-data"><div><dt>地球引力加速度</dt><dd>{{ (MU/earthStats.radius**2*1000).toFixed(4) }} m/s²</dd></div><div><dt>月球引力加速度</dt><dd>{{ (4902.8/distance**2*1000).toExponential(2) }} m/s²</dd></div></dl><small>{{ lunar?'扣除月球对地球的共同加速度。月球力箭头仅示意方向。':'质量改变引力大小，不改变轨道' }}</small></div>
          <dl class="orbit-data"><div><dt>比机械能 ε</dt><dd>{{ stats.energy.toFixed(3) }} km²/s²</dd></div><div><dt>偏心率 e</dt><dd>{{ stats.eccentricity.toFixed(4) }}</dd></div><div><dt>近地点高度</dt><dd>{{ (stats.perigee-(relative.nearMoon?MOON_RADIUS:R)).toFixed(0) }} km</dd></div><div><dt>远地点高度</dt><dd>{{ Number.isFinite(stats.apogee)?(stats.apogee-(relative.nearMoon?MOON_RADIUS:R)).toFixed(0)+' km':'开放轨道' }}</dd></div><div><dt>轨道周期</dt><dd>{{ Number.isFinite(stats.period)?(stats.period/60).toFixed(1)+' min':'—' }}</dd></div></dl>
          <p class="model-caption">{{ lunar?'轨道元素是瞬时二体估计。作用球内负月心能表示暂时束缚，不保证长期捕获。':'球形地球二体模型，忽略空气阻力和地球自转。' }}</p>
        </div></details>


        </aside>
      </div>
      <dialog ref="archiveDialog" class="archive-dialog" aria-label="实验档案与回放" @close="archiveOpen=false"><header><div><small>保存、分享与复盘</small><h2>实验档案与回放</h2></div><button class="lab-button mission-button" aria-label="关闭实验档案" @click="archiveOpen=false">×</button></header><label>学生<input v-model="student" maxlength="40"></label><label>小组<input v-model="group" maxlength="40"></label><label>实验备注<textarea v-model="note" maxlength="300"/></label><button class="lab-button mission-button" :disabled="!!replay" @click="save">导出实验档案</button><label class="file-picker">读取实验档案<input type="file" accept=".json,application/json" @change="load($event);archiveOpen=false"></label><p>保存完整实验时序与每次暂停的精调记录。读取后停在起点，按模拟时间回放。</p></dialog>
    </template>
  </ExperimentLayout>
</template>

<style scoped>
.mission-lab { height: auto; min-height: 100dvh; }
.mission-lab :deep(.lab-layout) { display: block; padding: 24px; }
.mission-lab :deep(.lab-stage) { border: 0; border-radius: 0; overflow: visible; background: transparent; }
.mission-lab :deep(.lab-observation) { display: none; }
.mission-workspace { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 24px; align-items: start; }
h2,h3,p { margin: 0; }
.orbital-view { min-width: 0; }
.view-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.view-toolbar small { color: var(--muted); font-size: 12px; }
.view-toolbar h2 { font-size: 17px; font-weight: 550; margin-top: 4px; }
.live-readings { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border: 1px solid var(--border); border-radius: 10px; background: white; padding: 14px 4px; margin-bottom: 14px; }
.live-readings>div { padding: 0 18px; border-right: 1px solid var(--border); }
.live-readings>div:last-child { border: 0; }
.live-readings span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
.live-readings strong { font-size: 23px; font-weight: 550; font-variant-numeric: tabular-nums; }
.live-readings small { font-size: 12px; font-weight: 400; color: #65786b; }
.time-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #63756b; margin-bottom: 12px; }
.time-toolbar>div { display: flex; gap: 4px; flex-wrap: wrap; }
.time-toolbar button,.camera-toolbar button,.step-selector button { background: white; color: #556e60; border: 1px solid #d7e1d9; border-radius: 5px; font-size: 12px; padding: 7px 9px; }
.time-toolbar button[aria-pressed=true],.camera-toolbar button[aria-pressed=true],.step-selector button[aria-pressed=true] { background: #e9f3ed; border-color: #76ab94; color: #216c5d; }
.time-toolbar label { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.canvas-panel { position: relative; height: clamp(380px,calc(100dvh - 340px),720px); border-radius: 12px; overflow: hidden; background: #081722; }
.canvas-panel :deep(.orbit-canvas) { position: absolute; inset: 0; min-height: 0; }
.canvas-panel :deep(canvas) { min-height: 0; }
.canvas-panel :deep(.zoom-tools) { left: auto; right: 14px; top: 14px; }
.canvas-panel :deep(.zoom-tools span) { display: none; }
.canvas-panel :deep(.zoom-tools .lab-button) { padding: 7px 9px; font-size: 11px; }
.track-legend { position: absolute; left: 16px; top: 58px; display: flex; gap: 12px; font-size: 11px; color: #b3cdd7; }
.track-legend span { display: flex; align-items: center; gap: 5px; }
.track-legend i { display: inline-block; width: 18px; border-top: 2px solid #66e6c1; }
.track-legend .before { border-color: #8eafc9; border-top-style: dashed; }
.track-legend .after { border-color: #ffc575; border-top-style: dashed; }
.freeze-banner { position: absolute; left: 16px; top: 19px; font-size: 12px; color: #edd2a6; }
.mission-message { position: absolute; bottom: 16px; left: auto; right: 16px; width: fit-content; max-width: calc(100% - 250px); padding: 9px 12px; background: #081722dd; border: 1px solid #3b535e; border-radius: 6px; color: #bfd4de; font-size: 12px; line-height: 1.7; }
.camera-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.flight-controls { background: white; border: 1px solid var(--border); border-radius: 12px; padding: 20px; min-width: 0; }
.control-title { font-size: 16px; font-weight: 550; margin-bottom: 18px; }
.mission-status { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
.mission-status>div { display: flex; align-items: center; gap: 6px; }
.status-dot { display: inline-block; width: 6px; height: 6px; background: #b38542; border-radius: 50%; }
.status-dot.live { background: #389e78; }
time { font-variant-numeric: tabular-nums; color: #38564a; }
.orbit-status { display: flex; justify-content: space-between; align-items: center; margin: 12px 0 16px; }
.orbit-status strong { font-size: 16px; font-weight: 550; }
.orbit-status small { color: var(--muted); font-size: 11px; }
.freeze-button { width: 100%; padding: 13px; text-align: center; }
.freeze-button strong { font-size: 16px; font-weight: 550; }
.freeze-button small { display: none; }
.burn-controls { margin-top: 20px; }
.burn-heading { display: flex; align-items: center; justify-content: space-between; }
.burn-heading h3,.circular-panel h3 { font-size: 13px; font-weight: 550; }
.burn-heading span { font-size: 11px; color: var(--muted); }
.step-selector { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; margin: 10px 0 7px; }
.step-selector button { padding: 8px 0; }
.step-hint { font-size: 11px; color: var(--muted); margin-bottom: 12px; }
.burn-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.burn-button { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 12px 7px; }
.burn-button b { font-size: 20px; font-weight: 400; }
.burn-button strong { font-size: 13px; font-weight: 550; }
.burn-button>span { flex-basis: 100%; font-size: 13px; font-variant-numeric: tabular-nums; }
.burn-button small { font-size: 11px; }
.prograde { border-color: #7cb49b; background: #eef7f1; color: #256d56; }
.retrograde { border-color: #d7c7ad; background: #fbf7f0; color: #806038; }
.burn-instruction { color: #65766b; font-size: 12px; line-height: 1.7; margin: 10px 0; min-height: 40px; }
.delta-readings { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 0 16px; border-bottom: 1px solid var(--border); }
.delta-readings span { display: block; font-size: 11px; color: var(--muted); }
.delta-readings strong { display: block; font-size: 19px; font-weight: 550; margin-top: 5px; font-variant-numeric: tabular-nums; }
.delta-readings small { font-size: 11px; color: var(--muted); font-weight: 400; }
.circular-panel { margin-top: 16px; padding: 13px; border: 1px solid var(--border); border-radius: 8px; background: #f8faf7; }
.circular-panel.ready { border-color: #8ab7a0; }
.circular-panel>div { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.circular-panel>div>span { font-size: 10px; color: #687f70; }
.circular-panel dl { margin: 10px 0; }
.circular-panel dl>div { display: flex; justify-content: space-between; font-size: 11px; line-height: 2; }
.circular-panel dt { color: #687a6f; }
.circular-panel dd { margin: 0; font-variant-numeric: tabular-nums; }
.circular-panel button { width: 100%; padding: 9px; border: 1px solid #a8c9b8; border-radius: 5px; background: white; color: #32715b; font-size: 12px; }
.circular-panel>small { display: block; font-size: 10px; color: var(--muted); margin-top: 8px; line-height: 1.6; }
button:disabled { opacity: .45; cursor: not-allowed; }
.footer-actions { display: flex; align-items: start; gap: 14px; margin-top: 16px; }
.footer-actions details { font-size: 12px; padding: 10px 0; color: #536c5e; }
.footer-actions ol { padding-left: 15px; line-height: 1.8; }
.keyboard-note { font-size: 10px; line-height: 1.8; color: var(--muted); margin-top: 12px; }
.model-details { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 12px; color: #536b60; }
.model-details summary { padding: 5px 0; }
.model-content { padding-top: 12px; }
.data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.data-grid span,.data-grid small { font-size: 11px; color: var(--muted); }
.data-grid span { display: block; margin-bottom: 4px; }
.data-grid strong { font-weight: 500; margin-right: 4px; }
.physics-card { padding: 14px; margin-top: 14px; border-radius: 7px; background: #f1f5ef; }
.physics-card p { text-align: center; margin: 14px 0; font-family: serif; font-size: 18px; }
.physics-card small { font-size: 11px; line-height: 1.8; }
.orbit-data>div,.gravity-data>div { display: flex; justify-content: space-between; gap: 8px; margin: 10px 0; font-size: 11px; }
.orbit-data dd,.gravity-data dd { margin: 0; }
.model-caption { font-size: 11px; line-height: 1.8; }
.replay-controls { background: white; border: 1px solid var(--border); border-radius: 8px; margin-top: 14px; padding: 15px; }
.replay-controls>strong { display: block; margin-bottom: 10px; font-size: 14px; }
.replay-controls>div { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.archive-dialog::backdrop { background: #122d2666; }
.archive-dialog { width: min(480px,calc(100% - 32px)); max-height: 85dvh; overflow: auto; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 24px; box-shadow: 0 20px 80px #122d2633; }
.archive-dialog header { display: flex; align-items: center; justify-content: space-between; }
.archive-dialog h2 { font-size: 19px; margin: 6px 0 16px; }
.archive-dialog small,.archive-dialog p { color: var(--muted); font-size: 12px; line-height: 1.8; }
.archive-dialog label { display: block; font-size: 13px; margin: 15px 0; }
.archive-dialog input:not([type=file]),.archive-dialog textarea { display: block; box-sizing: border-box; width: 100%; margin-top: 7px; border: 1px solid var(--border); border-radius: 5px; background: #f9fbf8; color: #223934; padding: 10px; }
.file-picker input { display: block; max-width: 100%; margin-top: 8px; }
@media(min-width:1100px) { .orbital-view { position: sticky; top: 18px; } }
@media(max-width:1000px) { .mission-workspace { grid-template-columns: minmax(0,1fr) 300px; gap: 16px; } .flight-controls { padding: 16px; } .mission-lab :deep(.lab-layout) { padding: 16px; } .freeze-banner { top: 53px; } .track-legend { top: 82px; } .live-readings>div { padding: 0 10px; } .live-readings strong { font-size: 19px; } }
@media(max-width:720px) {
  .mission-lab :deep(.lab-layout) { padding: 12px; }
  .mission-workspace { display: flex; flex-direction: column; gap: 12px; }
  .orbital-view,.flight-controls { width: 100%; }
  .view-toolbar { margin-bottom: 9px; }
  .view-toolbar>div { display: none; }
  .view-toolbar:has(>button) { justify-content: flex-end; }
  .view-toolbar:empty { display: none; }
  .view-toolbar .lab-button { padding: 6px 10px; font-size: 11px; }
  .live-readings { padding: 10px 0; margin-bottom: 9px; }
  .live-readings span { font-size: 10px; margin-bottom: 4px; }
  .live-readings strong { font-size: 17px; }
  .live-readings small { font-size: 10px; }
  .time-toolbar { gap: 6px; margin-bottom: 9px; }
  .time-toolbar>span { display: none; }
  .time-toolbar button { padding: 5px; font-size: 10px; }
  .time-toolbar label { font-size: 10px; }
  .canvas-panel { height: 250px; }
  .canvas-panel :deep(.zoom-tools) { top: 10px; right: 10px; }
  .canvas-panel :deep(.zoom-tools .lab-button) { padding: 5px 7px; font-size: 10px; }
  .freeze-banner { top: 17px; left: 10px; font-size: 10px; max-width: 45%; }
  .track-legend { top: 48px; left: 10px; font-size: 9px; gap: 8px; }
  .mission-message { display: none; }
  .camera-toolbar { gap: 4px; margin-top: 8px; }
  .camera-toolbar button { padding: 6px; font-size: 10px; }
  .flight-controls { padding: 14px; }
  .control-title { display: none; }
  .mission-status { font-size: 11px; }
  .orbit-status { margin: 8px 0 10px; }
  .orbit-status strong { font-size: 14px; }
  .freeze-button { padding: 10px; }
  .freeze-button strong { font-size: 15px; }
  .burn-controls { margin-top: 12px; }
  .step-selector { margin: 8px 0; }
  .step-selector button { padding: 7px 0; }
  .step-hint { display: none; }
  .burn-button { padding: 8px 5px; }
  .burn-button>span { flex-basis: auto; font-size: 11px; }
  .burn-button small { display: none; }
  .burn-instruction { min-height: 0; margin: 8px 0; font-size: 11px; }
}
</style>
