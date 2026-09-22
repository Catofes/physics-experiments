<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { R, SIDEREAL_DAY, TAU } from '../orbits/physics.js';
import { useAnimation } from '../orbits/useAnimation.js';
import { scenePoint, surfacePoint, satelliteFrame } from './view-geometry.js';
import earthTexture from './assets/earth-surface-hd.jpg';
const props = defineProps({ altitude: Number, inclination: Number, phase: Number, elapsed: Number, rotating: Boolean, point: Object, target: Object, track: Array });
const host = ref(null), mode = ref('overview'), equatorial = ref(true), orbital = ref(true), ecliptic = ref(false), grid = ref(true);
const showTrack = ref(true);
const error = ref(''), textureState = ref('loading');
const radius = computed(() => (R + props.altitude) / R);
let renderer, scene, camera, controls, observer, earth, globe, atmosphere, geometryGroup, satellite, groundDot, targetDot, tether, gridGroup, surfaceTrack;
let disposed = false, lastRadius, previousMode = 'overview', overviewPosition;
const origin = new THREE.Vector3();
const trackedTextures = new Set();
function vector(p) { return new THREE.Vector3(p.x, p.y, p.z); }
function material(color, opacity = 1) { return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }); }
function line(points, color, opacity = 1) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(vector)), material(color, opacity));
}
function release(root) {
  root.traverse(object => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const m of materials) m?.dispose();
  });
}
function label(text, color) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const context = canvas.getContext('2d');
  context.font = '500 30px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.strokeStyle = '#030b16'; context.lineWidth = 5; context.strokeText(text, 128, 32);
  context.fillStyle = color; context.fillText(text, 128, 32);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; trackedTextures.add(texture);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
  sprite.userData.label = true;
  return sprite;
}
function ringPlane(angle, extent, color, text) {
  const group = new THREE.Group(); group.rotation.x = angle - Math.PI / 2;
  const plane = new THREE.Mesh(new THREE.RingGeometry(1.012, extent, 128), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false }));
  group.add(plane);
  group.add(line(Array.from({length: 181}, (_, index) => {const a=index/180*TAU;return {x: extent*Math.cos(a), y: extent*Math.sin(a), z:0};}), color, .65));
  const caption = label(text, color);
  const placement = text === '赤道面' ? -.35 : text === '黄道面' ? 2.8 : 1.65;
  caption.position.set(extent * Math.cos(placement), extent * Math.sin(placement), 0); group.add(caption);
  return group;
}
function rebuild() {
  if (!scene) return;
  if (geometryGroup) {
    geometryGroup.traverse(object => { const map = object.material?.map; if (map) { map.dispose(); trackedTextures.delete(map); } });
    release(geometryGroup); scene.remove(geometryGroup);
  }
  geometryGroup = new THREE.Group(); scene.add(geometryGroup);
  const rho = radius.value, extent = Math.max(1.45, rho * 1.12), i = props.inclination * Math.PI / 180;
  const planes = [ringPlane(0, extent, '#6dbfff', '赤道面'), ringPlane(i, rho * 1.06, '#6ff0bd', '卫星轨道面'), ringPlane(-23.44 * Math.PI / 180, extent * 1.08, '#e7b0ff', '黄道面')];
  planes.forEach((plane,index) => { plane.userData.plane = index; geometryGroup.add(plane); });
  const orbit = line(Array.from({length:361}, (_,index) => {const a=index/360*TAU;return scenePoint({x:rho*Math.cos(a),y:rho*Math.sin(a)*Math.cos(i),z:rho*Math.sin(a)*Math.sin(i)});}), '#6ff0bd');
  geometryGroup.add(orbit);
  const axis = line([{x:0,y:-1.4,z:0},{x:0,y:1.6,z:0}], '#f2f6ff'); geometryGroup.add(axis);
  for (const [name,y] of [['北极 N',1.65],['南极 S',-1.5]]) { const caption=label(name,'#e6f2ff');caption.position.y=y;geometryGroup.add(caption); }
  // Inclination measured from the equator toward the orbit in the YZ section.
  if (props.inclination > .1) {
    const arcRadius = Math.max(1.2,rho*.65);
    geometryGroup.add(line(Array.from({length:91},(_,k)=>({x:0,y:arcRadius*Math.sin(i*k/90),z:-arcRadius*Math.cos(i*k/90)})), '#ffe198'));
    const caption=label(`i = ${props.inclination.toFixed(1)}°`,'#ffe198');caption.position.set(0,arcRadius*1.25*Math.sin(i*.65)+rho*.1,-arcRadius*1.25*Math.cos(i*.65));geometryGroup.add(caption);
  }
  if (lastRadius !== rho) { lastRadius = rho; restore(); }
}
function rebuildTrack() {
  if (!globe) return;
  if (surfaceTrack) { release(surfaceTrack); globe.remove(surfaceTrack); }
  surfaceTrack = new THREE.Group();
  // These are Earth-fixed longitudes, shared with the 2D map. Parenting to
  // globe applies the CURRENT Earth rotation once to the whole surface path.
  // Convert to Cartesian points before joining, so the date line has no seam.
  const positions = (props.track || []).flatMap(p => {
    const q = surfacePoint(p.lat, p.lon);
    return [q.x * 1.0003, q.y * 1.0003, q.z * 1.0003];
  });
  if (positions.length >= 6) {
    for (const [color, width, order] of [['#042a26', 5, 1], ['#72efbe', 2.5, 2]]) {
      const geometry = new LineGeometry(); geometry.setPositions(positions);
      const material = new LineMaterial({ color, linewidth: width, depthTest: true, depthWrite: false });
      const path = new Line2(geometry, material); path.renderOrder = order;
      surfaceTrack.add(path);
    }
  }
  globe.add(surfaceTrack);
}
function restore() {
  if (!camera) return;
  const distance = Math.max(3.8, radius.value * 3.15);
  overviewPosition = new THREE.Vector3(1.3,.85,1.6).normalize().multiplyScalar(distance);
  if (mode.value === 'overview') { camera.position.copy(overviewPosition); camera.up.set(0,1,0); controls.target.set(0,0,0); controls.update(); }
}
function draw() {
  if (!renderer || error.value || disposed) return;
  const rho = radius.value, spin = props.rotating ? props.elapsed / SIDEREAL_DAY * TAU : 0;
  globe.rotation.y = spin;
  const p = vector(scenePoint(props.point));
  satellite.position.copy(p).multiplyScalar(rho);
  groundDot.position.copy(p).multiplyScalar(1.006);
  targetDot.position.copy(vector(surfacePoint(props.target.lat, props.target.lon, spin))).multiplyScalar(1.008);
  const positions = tether.geometry.attributes.position;
  positions.setXYZ(0, ...groundDot.position.toArray()); positions.setXYZ(1, ...satellite.position.toArray()); positions.needsUpdate=true; tether.geometry.computeBoundingSphere();
  const overview = mode.value === 'overview';
  if (previousMode !== mode.value) {
    if (!overview) { if (previousMode === 'overview') overviewPosition = camera.position.clone(); }
    else { camera.position.copy(overviewPosition); camera.up.set(0,1,0); controls.target.copy(origin); }
    previousMode = mode.value;
  }
  controls.enabled = overview;
  if (overview) { camera.fov = 43; controls.minDistance = 1.12; controls.maxDistance = Math.max(12,rho*7); controls.update(); }
  else {
    const frame = satelliteFrame(props.phase, props.inclination, rho, mode.value === 'horizon');
    camera.position.copy(vector(frame.position)); camera.up.copy(vector(frame.up)); camera.lookAt(vector(frame.position).add(vector(frame.direction)));
    camera.fov = Math.min(65,Math.max(12,Math.asin(1/rho)*180/Math.PI*2.7));
  }
  camera.updateProjectionMatrix();
  geometryGroup.visible = overview; satellite.visible = overview; tether.visible = overview; targetDot.visible = overview;
  gridGroup.visible = grid.value && overview;
  surfaceTrack.visible = showTrack.value;
  groundDot.visible = overview;
  for (const object of geometryGroup.children) if (object.userData.plane !== undefined) object.visible = [equatorial.value,orbital.value,ecliptic.value][object.userData.plane];
  // Keep educational markers legible without enlarging the physical Earth.
  geometryGroup.traverse(object => { if(object.userData.label) { const distance=camera.position.distanceTo(object.getWorldPosition(new THREE.Vector3()));const height=distance*2*Math.tan(camera.fov*Math.PI/360)*28/Math.max(1,host.value.clientHeight);object.scale.set(height*4,height,1); } });
  satellite.scale.setScalar(Math.max(.016,rho*.012)); groundDot.scale.setScalar(.014); targetDot.scale.setScalar(.012);
  atmosphere.visible = true;
  renderer.render(scene,camera);
}
onMounted(() => {
  try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:false}); }
  catch { error.value='浏览器暂时无法显示三维地球，请开启硬件加速后重试；右侧星下点图仍可使用。'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2)); renderer.setClearColor('#030b16'); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','三维地球与卫星视角'); renderer.domElement.setAttribute('role','img'); host.value.prepend(renderer.domElement);
  scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(43,1,.001,2000);
  controls=new OrbitControls(camera,renderer.domElement); controls.enablePan=false; controls.enableDamping=true; controls.dampingFactor=.12;
  scene.add(new THREE.AmbientLight('#c2defa',2.2)); const sunlight=new THREE.DirectionalLight('#fff5e4',2.5);sunlight.position.set(4,3,5);scene.add(sunlight);
  globe=new THREE.Group();scene.add(globe);
  const texture = new THREE.TextureLoader().load(earthTexture, () => { if(disposed){texture.dispose();return;} textureState.value='ready'; }, undefined, () => {if(!disposed)textureState.value='error';});
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());trackedTextures.add(texture);
  earth=new THREE.Mesh(new THREE.SphereGeometry(1,128,64),new THREE.MeshPhongMaterial({map:texture,color:'#ffffff',shininess:12,specular:'#1b2a38'}));globe.add(earth);
  // A thin limb glow, not an opaque enlarged sphere; ground altitude stays physical.
  atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.009,96,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.0-max(0.0,dot(normalize(n),normalize(v))),4.0);gl_FragColor=vec4(0.16,0.53,1.0,rim*0.65);}'
  }));scene.add(atmosphere);
  gridGroup=new THREE.Group();globe.add(gridGroup);
  for(const lat of [-60,-30,0,30,60])gridGroup.add(line(Array.from({length:181},(_,k)=>{const p=surfacePoint(lat,k*2-180);return{x:p.x*1.002,y:p.y*1.002,z:p.z*1.002};}),lat===0?'#72c9ff':'#a6d3e7',lat===0?.95:.23));
  for(let lon=-180;lon<180;lon+=30)gridGroup.add(line(Array.from({length:91},(_,k)=>{const p=surfacePoint(k*2-90,lon);return{x:p.x*1.002,y:p.y*1.002,z:p.z*1.002};}),'#a6d3e7',.23));
  satellite=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:'#ffe392'}));scene.add(satellite);
  groundDot=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:'#ffe392'}));scene.add(groundDot);
  targetDot=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:'#ff8e9b'}));scene.add(targetDot);
  tether=line([{x:0,y:0,z:0},{x:1,y:0,z:0}],'#ffe392',.7);scene.add(tether);
  const stars=[];for(let k=0;k<450;k++){const z=1-2*(k+.5)/450,a=k*2.399963,r=Math.sqrt(1-z*z);stars.push(r*Math.cos(a)*500,z*500,r*Math.sin(a)*500);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#abc8e5',size:.7,sizeAttenuation:false})));
  rebuild();
  rebuildTrack();
  observer=new ResizeObserver(()=>{const {width,height}=host.value.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);draw();});observer.observe(host.value);
});
watch(()=>[props.altitude,props.inclination],rebuild);
watch(()=>props.track,rebuildTrack);
useAnimation(draw);
onUnmounted(()=>{disposed=true;observer?.disconnect();controls?.dispose();if(scene)release(scene);for(const texture of trackedTextures)texture.dispose();renderer?.dispose();renderer?.forceContextLoss();});
</script>

<template>
  <div class="globe-panel">
    <div class="camera-modes" role="group" aria-label="观察视角">
      <button v-for="option in [{value:'overview',label:'轨道全景'},{value:'nadir',label:'卫星俯视'},{value:'horizon',label:'前向地平线'}]" :key="option.value" :aria-pressed="mode===option.value" @click="mode=option.value">{{ option.label }}</button>
    </div>
    <div ref="host" class="space" :data-mode="mode" :data-texture="textureState">
      <p v-if="error" class="view-error" role="status">{{ error }}</p>
      <template v-else>
        <div class="camera-hud"><span>{{ mode==='overview'?'地心惯性系':mode==='nadir'?'镜头位于卫星 · 朝向地心':'镜头位于卫星 · 朝前方地球边缘' }}</span><strong>{{ altitude.toFixed(0) }} <small>km</small></strong></div>
        <div v-if="mode==='nadir'" class="crosshair" aria-hidden="true"><span>星下点</span></div>
        <div class="camera-footer"><span>{{ mode==='overview'?'拖动旋转 · 滚轮 / 双指缩放':mode==='nadir'?'画面上方为飞行方向':'朝飞行前方的地球边缘观察' }}</span><button v-if="mode==='overview'" @click="restore">恢复视角</button></div>
        <p v-if="textureState==='error'" class="texture-error" role="status">地表贴图加载失败，请刷新重试。</p>
      </template>
    </div>
    <div v-if="mode==='overview'" class="plane-toggles" role="group" aria-label="空间参考面">
      <label class="equator"><input v-model="equatorial" type="checkbox" />赤道面</label>
      <label class="orbit"><input v-model="orbital" type="checkbox" />卫星轨道面</label>
      <label class="ecliptic"><input v-model="ecliptic" type="checkbox" />黄道面</label>
      <label><input v-model="grid" type="checkbox" />经纬网</label>
    </div>
    <label class="track-toggle"><input v-model="showTrack" type="checkbox" />地表星下点轨迹<span>与右图相同的完整轨迹</span></label>
    <p class="view-explainer">{{ mode==='overview'?'倾角 i 从赤道面量起；黄道面是地球绕太阳公转的平面，与赤道面约成 23.4°。':mode==='horizon'?'镜头朝飞行前方的地球边缘，并随高度调整取景；不是严格沿速度方向平视。':'相机随卫星移动，地表随自转开关转动；低轨看到局部地表，高轨可见地球全貌。' }}</p>
    <p class="view-credit">地表：NASA Blue Marble · 光照为示意，非实时昼夜</p>
  </div>
</template>

<style scoped>
.globe-panel{min-width:0}.camera-modes{display:flex;gap:4px;padding:8px 0;height:52px;box-sizing:border-box}.camera-modes button{flex:1;border:1px solid #294450;background:#102331;color:#b3c9d6;border-radius:6px;padding:9px 3px;font:inherit;font-size:12px;cursor:pointer}.camera-modes button[aria-pressed=true]{color:#edfff8;background:#1e5549;border-color:#62b89e}
.space{position:relative;width:100%;aspect-ratio:600/440;overflow:hidden;border-radius:10px;background:#030b16}.space :deep(canvas){display:block;width:100%;height:100%;touch-action:none}.camera-hud,.camera-footer{position:absolute;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;color:#cee4ec;font-size:11px;pointer-events:none;text-shadow:0 1px 4px #000}.camera-hud{top:12px}.camera-hud strong{font-size:18px;font-weight:500}.camera-hud small{font-size:11px}.camera-footer{bottom:12px}.camera-footer button{pointer-events:auto;border:1px solid #64848d;background:#091921cc;color:#d3e7ee;padding:5px 8px;border-radius:5px;cursor:pointer}.plane-toggles{display:flex;flex-wrap:wrap;gap:12px;padding:12px 0 3px;font-size:12px;color:#c4d7e1}.plane-toggles label{display:flex;align-items:center;gap:4px;cursor:pointer}.equator{color:#6dbfff}.orbit{color:#6ff0bd}.ecliptic{color:#e7b0ff}.plane-toggles input{accent-color:currentColor}.track-toggle{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:#72efbe;font-size:12px;margin-top:12px;cursor:pointer}.track-toggle input{accent-color:#72efbe}.track-toggle span{color:#a3bbc7;font-size:11px;margin-left:4px}.view-explainer{font-size:12px;line-height:1.7;color:#b4c9d5;margin:8px 0}.view-credit{font-size:10px;color:#839cab;margin:6px 0}.crosshair{position:absolute;top:50%;left:50%;width:22px;height:22px;transform:translate(-50%,-50%);border:1px solid #ffdf86;border-radius:50%;pointer-events:none;box-shadow:0 0 0 1px #0005}.crosshair:before,.crosshair:after{content:'';position:absolute;background:#ffdf86}.crosshair:before{left:10px;top:-6px;width:1px;height:32px}.crosshair:after{top:10px;left:-6px;width:32px;height:1px}.crosshair span{position:absolute;left:30px;top:3px;white-space:nowrap;font-size:11px;color:#ffe8a5;text-shadow:0 1px 3px #000}.view-error,.texture-error{position:absolute;inset:40px 18px auto;color:#ffcfad;font-size:13px;line-height:1.8}
</style>
