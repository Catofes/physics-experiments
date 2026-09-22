const FORMAT = 'satellite-orbit-classic-experiment';
export function createArchive(state, trajectory, events, meta = {}) {
  return { format: FORMAT, schemaVersion: 2, modelVersion: 'earth-two-body-verlet-v1', meta, state: { position: {x:state.x,y:state.y}, velocity:{x:state.vx,y:state.vy}, simTime:state.t, crashed:!!state.crashed }, trajectory: [...trajectory], events: [...events] };
}
export function readArchive(data) {
  if (data?.format !== FORMAT || ![1,2].includes(data.schemaVersion)) throw new Error('档案格式或版本不兼容');
  const s=data.state, points=data.trajectory;
  const finitePoint=p=>p && [p.x,p.y].every(Number.isFinite) && Math.hypot(p.x,p.y)<=1e9;
  if(!s || !finitePoint(s.position) || !finitePoint(s.velocity) || Math.hypot(s.velocity.x,s.velocity.y)>1000 || !Number.isFinite(s.simTime) || s.simTime<0 || Math.hypot(s.position.x,s.position.y)<1)throw new Error('卫星状态无效');
  if(!Array.isArray(points)||!points.length||points.length>100000)throw new Error('轨迹点数量无效');
  let last=-1;
  for(const p of points){if(!finitePoint(p)||!Number.isFinite(p.t)||p.t<last||p.t<0||p.t>s.simTime)throw new Error('轨迹坐标或时间无效');last=p.t;}
  if(!Array.isArray(data.events)||data.events.length>100000)throw new Error('变轨记录无效');
  for(const e of data.events)if(!e||!Number.isFinite(e.simTime)||e.simTime<0||e.simTime>s.simTime||!Number.isFinite(e.deltaVMps)||!finitePoint(e.position)||!finitePoint(e.afterVelocity))throw new Error('变轨记录无效');
  return { state:{x:s.position.x,y:s.position.y,vx:s.velocity.x,vy:s.velocity.y,t:s.simTime,crashed:s.crashed?'地球':''}, points:points.map(p=>({x:p.x,y:p.y,t:p.t,...(Number.isFinite(p.vx)&&Number.isFinite(p.vy)?{vx:p.vx,vy:p.vy}:{})})), events:data.events.map(e=>({...e})), meta:{student:String(data.meta?.student||'').slice(0,40),group:String(data.meta?.group||'').slice(0,40),note:String(data.meta?.note||'').slice(0,300)} };
}
export function replayPoint(points, time) {
  let lo=0,hi=points.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].t<=time)lo=mid;else hi=mid-1;}
  const a=points[lo],b=points[Math.min(lo+1,points.length-1)],f=b.t>a.t?Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t))):0;
  const dt=b.t-a.t;
  const vx=Number.isFinite(a.vx)&&Number.isFinite(b.vx)?a.vx+(b.vx-a.vx)*f:dt>0?(b.x-a.x)/dt:0;
  const vy=Number.isFinite(a.vy)&&Number.isFinite(b.vy)?a.vy+(b.vy-a.vy)*f:dt>0?(b.y-a.y)/dt:0;
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,vx,vy,index:lo};
}
