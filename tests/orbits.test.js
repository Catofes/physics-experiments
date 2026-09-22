import test from 'node:test';
import assert from 'node:assert/strict';
import { R,MU,TAU,MOON_MU,MOON_DISTANCE,groundPoint,systemPosition,moonState,acceleration,initialSatellite,elements,advance,burn,relativeState } from '../src/experiments/orbits/physics.js';
import {makeOrbit,impactTime} from '../src/experiments/newton-cannon/physics.js';
import {createArchive,readArchive,replayPoint} from '../src/experiments/orbits/archive.js';
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
test('牛顿大炮：圆轨道、椭圆、抛物线与双曲线均满足初值和能量守恒',()=>{
 const r=R+120,vc=Math.sqrt(MU/r);
 for(const v of [4.5,vc,9.2,Math.sqrt(2)*vc,12]){
  const orbit=makeOrbit(r,v),initial=orbit.stateAt(0);close(initial.x,0);close(initial.y,r);close(initial.vx,v);close(initial.vy,0);
  for(const t of [100,500,2000]){const p=orbit.stateAt(t);close(elements(p).energy,v*v/2-MU/r,1e-8);}
 }
 const circle=makeOrbit(r,vc);close(Math.hypot(circle.stateAt(circle.period).x,circle.stateAt(circle.period).y),r);
 const low=makeOrbit(r,4.5),hit=impactTime(low);assert.ok(hit>0&&Number.isFinite(hit));const p=low.stateAt(hit);close(Math.hypot(p.x,p.y),R);assert.equal(impactTime(low,true),Infinity);
});
test('卫星二体积分：十圈能量与角动量稳定；脉冲改变能量且不改变位置',()=>{
 const first=initialSatellite(),base=elements(first),last=advance(first,base.period*10);
 close(elements(last).energy,base.energy,1e-5);close(last.x*last.vy-last.y*last.vx,first.x*first.vy,1e-5);
 const boosted=burn(first,.25);assert.equal(boosted.x,first.x);assert.equal(boosted.y,first.y);close(elements(boosted).energy-base.energy,base.speed*.25+.25**2/2);assert.ok(elements(boosted).apogee>base.radius);
 const falling=advance(burn(first,-2),base.period);assert.equal(falling.crashed,'地球');assert.deepEqual(advance(falling,100),falling);
});
test('月球脉冲使用月心相对速度；地心方程扣除共同加速度',()=>{
 const t=100,m=moonState(t),p={x:m.x+6000,y:m.y,vx:m.vx,vy:m.vy+1,t};
 assert.equal(relativeState(p,true).nearMoon,true);const q=burn(p,.1,true);close(q.vx,p.vx);close(q.vy,p.vy+.1);
 const a=acceleration(p,t,true),earth=acceleration(p,t,false);close(a.x-earth.x,-MOON_MU/6000**2-MOON_MU*m.x/MOON_DISTANCE**3);close(a.y-earth.y,-MOON_MU*m.y/MOON_DISTANCE**3);
});
test('星下点：零倾角静止，倾斜轨道一恒星日闭合，A/B同纬不同经',()=>{
 for(let i=0;i<10;i++){const p=groundPoint(i/10,0);close(p.lon,0);close(p.lat,0);}
 const a=groundPoint(1/6,30),b=groundPoint(1/3,30);close(a.lat,b.lat);assert.ok(Math.abs(a.lon-b.lon)>5);
 for(const i of [15,30,60]){close(groundPoint(.25,i).lat,i);close(groundPoint(.123,i).lon,groundPoint(1.123,i).lon);}
});
test('轨迹叠加：环月半径固定且半天后相对位置重复；月地距离位于近远地点之间',()=>{
 for(const t of [0,.12,1,100]){const p=systemPosition(t,true),q=systemPosition(t+.5,true);close(Math.hypot(p.child.x-p.parent.x,p.child.y-p.parent.y),6142.58);close(p.child.x-p.parent.x,q.child.x-q.parent.x);close(p.child.y-p.parent.y,q.child.y-q.parent.y);const solar=systemPosition(t),r=Math.hypot(solar.child.x-solar.parent.x,solar.child.y-solar.parent.y);assert.ok(r>=384400*(1-.0549)&&r<=384400*(1+.0549));}
});
test('实验档案：往返保留状态与脉冲，按模拟时间插值并拒绝无效时间轴',()=>{
 const start=initialSatellite(),end=advance(start,100);const data=createArchive(end,[start,end],[],{student:'学生'}),loaded=readArchive(data);assert.deepEqual(loaded.state,end);assert.equal(loaded.meta.student,'学生');const p=replayPoint(loaded.points,25);close(p.x,start.x+(end.x-start.x)*.25);assert.throws(()=>readArchive({...data,trajectory:[end,start]}),/时间/);assert.throws(()=>readArchive({...data,state:{...data.state,simTime:NaN}}),/无效/);
});

test('暂停时轨道对照经过脉冲点，精确圆化只改变速度而保持时刻和位置', async()=>{
 const {orbitPath,circularize}=await import('../src/experiments/orbits/physics.js');
 const initial=initialSatellite(),changed=burn(initial,.25),path=orbitPath(changed);
 const distances=path.map(p=>Math.hypot(p.x,p.y));close(Math.min(...distances),Math.hypot(initial.x,initial.y),.1);
 const p={...changed,vx:.01,t:123},circle=circularize(p);
 assert.equal(circle.x,p.x);assert.equal(circle.y,p.y);assert.equal(circle.t,p.t);close(elements(circle).radial,0);close(elements(circle).eccentricity,0,1e-7);
 const m=moonState(123),lunar={x:m.x+6000,y:m.y,vx:m.vx+.01,vy:m.vy+1,t:123};
 close(elements(relativeState(circularize(lunar,true),true).state,MOON_MU).eccentricity,0,1e-7);
});

test('星下点：不同轨道周期独立于地球自转；关闭自转后每圈重合，极轨到达两极',()=>{
 const day=86164.0905;
 for(const altitude of [400,800,20200,50000]){
  const period=TAU*Math.sqrt((R+altitude)**3/MU);
  const first=groundPoint(0,55,period),next=groundPoint(1,55,period);
  close(next.lon,Math.atan2(-Math.sin(period/day*TAU),Math.cos(period/day*TAU))*180/Math.PI);
  assert.ok(Math.abs(first.lon-next.lon)>1);
  for(const phase of [.123,.4,.78]){
   const a=groundPoint(phase,55,period,false),b=groundPoint(phase+1,55,period,false);
   close(a.lon,b.lon);close(a.lat,b.lat);
   const rotating=groundPoint(phase,55,period,true);close(a.x,rotating.x);close(a.y,rotating.y);close(a.z,rotating.z);
  }
 }
 close(groundPoint(.25,90,6000).lat,90);close(groundPoint(.75,90,6000).lat,-90);
 close(groundPoint(.25,120,6000,false).lat,60);
});

test('卫星相机：位置处于真实轨道，俯视对准星下点，过极点时姿态连续',async()=>{
 const {satelliteFrame,scenePoint,surfacePoint}=await import('../src/experiments/geosynchronous/view-geometry.js');
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 const length=p=>Math.hypot(p.x,p.y,p.z);
 for(const inclination of [0,30,90,120,180])for(const phase of [0,.24999,.25,.25001,.75,1]){
  const frame=satelliteFrame(phase,inclination,1.063);
  close(length(frame.position),1.063);close(length(frame.direction),1);close(length(frame.up),1);close(dot(frame.up,frame.direction),0);
  const p=groundPoint(phase,inclination,6000,true),mapped=scenePoint(p),surface=surfacePoint(p.lat,p.lon,phase*6000/86164.0905*TAU);
  for(const key of ['x','y','z']){close(frame.position[key]/1.063,mapped[key]);close(surface[key],mapped[key]);close(frame.direction[key],-mapped[key]);}
  const tilted=satelliteFrame(phase,inclination,1.063,true);close(dot(tilted.up,tilted.direction),0);assert.ok(dot(tilted.direction,frame.direction)>0);
 }
 const before=satelliteFrame(.24999,90,1.063),after=satelliteFrame(.25001,90,1.063);assert.ok(dot(before.up,after.up)>.999);
});

test('前向地平线：从近地到高轨始终朝向前方地球边缘，不退化为俯视',async()=>{
 const {satelliteFrame}=await import('../src/experiments/geosynchronous/view-geometry.js');
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 for(const altitude of [200,400,800,20200,35793,50000,60000]){
  const radius=(R+altitude)/R,angularRadius=Math.asin(1/radius);
  for(const inclination of [0,30,90,120,180])for(const phase of [0,.25,.75]){
   const nadir=satelliteFrame(phase,inclination,radius),horizon=satelliteFrame(phase,inclination,radius,true);
   assert.deepEqual(horizon.position,nadir.position);
   const tilt=Math.acos(Math.min(1,dot(nadir.direction,horizon.direction)));
   assert.ok(tilt>angularRadius*.75,'高轨也必须与俯视明显区分');
   assert.ok(tilt<angularRadius,'光轴落在地球边缘以内');
   assert.ok(angularRadius-tilt<angularRadius*.2,'地球前缘应靠近画面中心上方');
   assert.ok(dot(horizon.direction,nadir.up)>0,'朝向飞行前方，而非后方地平线');
   close(dot(horizon.direction,horizon.up),0);
  }
 }
});

test('地表轨迹：跨日期变更线连续，历史经纬度随当前地球整体旋转',async()=>{
 const {surfacePoint,scenePoint}=await import('../src/experiments/geosynchronous/view-geometry.js');
 const {Vector3}=await import('three');
 const near=surfacePoint(20,179.9),across=surfacePoint(20,-179.9);
 assert.ok(Math.hypot(near.x-across.x,near.y-across.y,near.z-across.z)<.004);
 const currentSpin=1.2,axis=new Vector3(0,1,0);
 for(const altitude of [400,20200,50000]){
  const period=TAU*Math.sqrt((R+altitude)**3/MU);
  for(const phase of [0,.25,.6,1.2,2.7]){
   const p=groundPoint(phase,55,period),local=surfacePoint(p.lat,p.lon);
   close(Math.hypot(local.x,local.y,local.z),1);
   const rotated=new Vector3(local.x,local.y,local.z).applyAxisAngle(axis,currentSpin);
   const expected=surfacePoint(p.lat,p.lon,currentSpin);
   for(const key of ['x','y','z'])close(rotated[key],expected[key]);
   const atSample=surfacePoint(p.lat,p.lon,phase*period/86164.0905*TAU),orbital=scenePoint(p);
   for(const key of ['x','y','z'])close(atSample[key],orbital[key]);
  }
 }
});
