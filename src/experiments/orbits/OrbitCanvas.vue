<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAnimation } from './useAnimation.js';
import earthImageUrl from './assets/earth-illustration.png';
const props = defineProps({ bodies: Array, paths: Array, vectors: Array, center: { type: Object, default: () => ({ x: 0, y: 0 }) }, extent: Number, zoom: Number });
const emit = defineEmits(['update:zoom']);
const canvas = ref(null); let observer, ctx, earthImage, width = 1, height = 1;
const pointers = new Map(); let pinch;
function adjustZoom(factor) { emit('update:zoom', Math.max(.01, Math.min(900, props.zoom * factor))); }
function pointer(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) { const [a,b] = [...pointers.values()], d = Math.hypot(a.x-b.x,a.y-b.y); if (pinch) adjustZoom(d/pinch); pinch = d; }
}
function down(e) { canvas.value.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x:e.clientX,y:e.clientY}); pinch = null; }
function up(e) { pointers.delete(e.pointerId); pinch = null; }
function draw() {
  if (!ctx) return;
  const scale = Math.min(width, height) / (2 * props.extent) * props.zoom;
  const map = p => ({ x: width / 2 + (p.x - props.center.x) * scale, y: height / 2 - (p.y - props.center.y) * scale });
  const background=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,Math.max(width,height)*.7);background.addColorStop(0,'#102b3d');background.addColorStop(.45,'#071724');background.addColorStop(1,'#040e18');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  ctx.fillStyle = '#6a889b'; for(let i=0;i<70;i++) ctx.fillRect((i*73.7%100)/100*width,((i*41.3+13)%100)/100*height,1,1);
  for (const path of props.paths || []) {
    ctx.beginPath(); let started = false;
    for (const p of path.points) { const q=map(p); if(!Number.isFinite(q.x+q.y) || Math.abs(q.x)>width*5 || Math.abs(q.y)>height*5){started=false;continue;} if(started)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);started=true; }
    ctx.setLineDash(path.dashed ? [5,6] : []);ctx.strokeStyle=path.color;ctx.lineWidth=path.width || 1.6;ctx.stroke();
  }
  ctx.setLineDash([]);
  for(const body of props.bodies || []) {
    const q=map(body), radius=Math.max(body.min || 4, (body.radius || 0)*scale);
    if(q.x+radius<0||q.x-radius>width||q.y+radius<0||q.y-radius>height){
      if(body.kind==='moon'){const dx=q.x-width/2,dy=q.y-height/2,f=Math.min((width/2-30)/Math.abs(dx),(height/2-95)/Math.abs(dy)),x=width/2+dx*f,y=height/2+dy*f,a=Math.atan2(dy,dx);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#cdc0ea';ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-7,-5);ctx.lineTo(-7,5);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#cdc0ea';ctx.font='10px sans-serif';ctx.fillText('月球方向',Math.max(10,Math.min(width-65,x-25)),y+20);}
      continue;
    }
    if(body.kind==='satellite'){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(-(body.angle||0));
      ctx.shadowBlur=10;ctx.shadowColor='#61d8f0';ctx.fillStyle='#51bdda';ctx.fillRect(-5,-18,10,12);ctx.fillRect(-5,6,10,12);ctx.shadowBlur=0;
      ctx.strokeStyle='#9be2ef';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(0,17);ctx.stroke();
      ctx.fillStyle='#e6f4f6';ctx.fillRect(-6,-5,12,10);ctx.beginPath();ctx.moveTo(6,-4);ctx.lineTo(11,0);ctx.lineTo(6,4);ctx.closePath();ctx.fill();ctx.restore();
    }else if(body.kind==='earth'||body.kind==='moon'){
      if(radius>10){const glow=ctx.createRadialGradient(q.x,q.y,radius*.85,q.x,q.y,radius*1.18);glow.addColorStop(0,body.kind==='earth'?'#2b94c044':'#a8b5be22');glow.addColorStop(1,'#12344800');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(q.x,q.y,radius*1.18,0,Math.PI*2);ctx.fill();}
      const surface=ctx.createRadialGradient(q.x-radius*.35,q.y-radius*.4,radius*.02,q.x+radius*.1,q.y+radius*.1,radius*1.2);
      surface.addColorStop(0,body.kind==='earth'?'#43b9ca':'#e0e4e7');surface.addColorStop(.3,body.kind==='earth'?'#197798':'#9aaab7');surface.addColorStop(1,body.kind==='earth'?'#021322':'#354551');
      ctx.fillStyle=surface;ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fill();
      if(body.kind==='earth' && earthImage?.complete && earthImage.naturalWidth){
        ctx.save();ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.clip();
        // Trim the sprite's transparent margin while keeping the physical disk fixed.
        const size=earthImage.naturalWidth,margin=size*.035;
        ctx.drawImage(earthImage,margin,margin,size-2*margin,size-2*margin,q.x-radius,q.y-radius,2*radius,2*radius);
        ctx.restore();
      }
    }else{
      ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.fillStyle=body.color;
      if(body.outline){ctx.setLineDash([6,6]);ctx.strokeStyle=body.color;ctx.stroke();ctx.setLineDash([]);}else ctx.fill();
    }
    ctx.fillStyle='#c5dbe5';ctx.font='11px sans-serif';if(body.kind!=='earth'||radius<25)ctx.fillText(body.label || '',q.x+(body.kind==='satellite'?20:Math.min(radius,35))+8,q.y-10);
  }
  for(const v of props.vectors || []) {const a=map(v), b={x:a.x+v.dx,y:a.y-v.dy}, angle=Math.atan2(b.y-a.y,b.x-a.x);ctx.strokeStyle=ctx.fillStyle=v.color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-8*Math.cos(angle-.45),b.y-8*Math.sin(angle-.45));ctx.lineTo(b.x-8*Math.cos(angle+.45),b.y-8*Math.sin(angle+.45));ctx.fill();ctx.fillText(v.label,b.x+5+(v.labelDx||0),b.y+(v.labelDy||0));}
  const target = width * .22 / scale, power=10**Math.floor(Math.log10(target)), length = Math.floor(target/power)*power;
  ctx.strokeStyle='#a0b7c9';ctx.beginPath();ctx.moveTo(20,height-25);ctx.lineTo(20+length*scale,height-25);ctx.stroke();ctx.fillStyle='#a0b7c9';ctx.font='12px sans-serif';ctx.fillText(`${length.toLocaleString()} km`,20,height-34);
}
onMounted(()=>{earthImage=new Image();earthImage.src=earthImageUrl;ctx=canvas.value.getContext('2d'); observer=new ResizeObserver(()=>{const r=canvas.value.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.value.width=Math.round(width*d);canvas.value.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);draw();});observer.observe(canvas.value);});
onUnmounted(()=>{observer?.disconnect();earthImage=null;});
useAnimation(draw);
</script>
<template><div class="orbit-canvas"><canvas ref="canvas" aria-label="轨道演示画布" @wheel.prevent="adjustZoom($event.deltaY < 0 ? 1.15 : 1/1.15)" @pointerdown="down" @pointermove="pointer" @pointerup="up" @pointercancel="up"/><div class="zoom-tools"><button class="lab-button" aria-label="放大视图" @click="adjustZoom(1.4)">＋</button><button class="lab-button" aria-label="缩小视图" @click="adjustZoom(1/1.4)">−</button><button class="lab-button" @click="emit('update:zoom',1)">恢复视野</button><span>{{ zoom.toFixed(1) }}×</span></div><slot/></div></template>
<style scoped>
.orbit-canvas{position:relative;height:100%;min-height:440px}canvas{display:block;width:100%;height:100%;min-height:440px;touch-action:none}.zoom-tools{position:absolute;top:12px;left:12px;display:flex;gap:6px;align-items:center;font-size:12px;color:#c7dbe6}.zoom-tools .lab-button{padding:7px 10px}@media(max-width:720px){.orbit-canvas,canvas{min-height:380px}}
</style>
