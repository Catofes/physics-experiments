import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { CALIPER, caliperSlider, caliperOuterSection, caliperInnerSection, caliperGrindingCuts, caliperScaleSection, caliperLowerGuideSection } from '../vernier-caliper/geometry.js';
import { caliperReading } from '../vernier-caliper/physics.js';
import { MICROMETER, micrometerPositions } from '../micrometer/geometry.js';
import { PITCH } from '../micrometer/physics.js';

// Add vertices at the grind boundary before changing thickness. Otherwise a large
// cap triangle interpolates the tip's thickness across the entire jaw face.
function splitAtPlane(geometry, plane) {
  const source=geometry.getAttribute('position'), vertices=[];
  const distance=p=>p[0]*plane.x+p[1]*plane.y+plane.constant;
  const append=polygon => {
    for (let i=1;i<polygon.length-1;i++) vertices.push(...polygon[0],...polygon[i],...polygon[i+1]);
  };
  for (let i=0;i<source.count;i+=3) {
    const triangle=Array.from({length:3},(_,j)=>[source.getX(i+j),source.getY(i+j),source.getZ(i+j)]);
    if (!triangle.some(p=>distance(p)<-1e-6) || !triangle.some(p=>distance(p)>1e-6)) { append(triangle); continue; }
    for (const side of [-1,1]) {
      const polygon=[];
      for (let j=0;j<3;j++) {
        const a=triangle[(j+2)%3], b=triangle[j];
        const da=distance(a), db=distance(b);
        const insideA=da*side>=0, insideB=db*side>=0;
        if (insideA!==insideB) {
          const t=da/(da-db);
          polygon.push(a.map((v,k)=>v+t*(b[k]-v)));
        }
        if (insideB) polygon.push(b);
      }
      append(polygon);
    }
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry.clearGroups();
}

function instrument(kind, state, renderer) {
  const root = new THREE.Group();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const steel = material('#c4cdd2', .86, .27);
  const face = material('#9daab3', .88, .2);
  const black = material('#293b42', .18, .52);
  const objectMaterial = material('#cf9654', 0, .65);
  function material(color, metalness = 0, roughness = .5) {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    materials.add(m); return m;
  }
  function mesh(geometry, mat, position, parent = root) {
    geometries.add(geometry);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(...position); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function box(size, position, mat = steel, parent = root) {
    return mesh(new THREE.BoxGeometry(...size), mat, position, parent);
  }
  function cylinder(radius, length, position, mat = steel, axis = 'x', parent = root) {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, length, 48), mat, position, parent);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }
  function texture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(map); return map;
  }
  function decal(map, size, position, parent = root) {
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    materials.add(mat);
    const m = mesh(new THREE.PlaneGeometry(...size), mat, position, parent);
    m.castShadow = false; return m;
  }
  function tag(letter, position, parent = root) {
    const map = texture(96, 96, ctx => {
      ctx.fillStyle = '#f4faf6'; ctx.beginPath(); ctx.arc(48, 48, 42, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle = '#578875'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#246954'; ctx.font = 'bold 57px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 48, 50);
    });
    const mat = new THREE.SpriteMaterial({ map, depthTest: false }); materials.add(mat);
    const s = new THREE.Sprite(mat); s.position.set(...position); s.scale.set(7, 7, 1); s.renderOrder = 2; parent.add(s);
  }
  function knurl(radius, length, x, mat, parent) {
    const bump = texture(512,512,ctx => {
      ctx.fillStyle='#808080';ctx.fillRect(0,0,512,512);ctx.lineWidth=4;
      for (let i=-512;i<=1024;i+=32) {
        ctx.strokeStyle='#454545';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+512,512);ctx.stroke();
        ctx.strokeStyle='#b9b9b9';ctx.beginPath();ctx.moveTo(i+5,0);ctx.lineTo(i+517,512);ctx.stroke();
        ctx.strokeStyle='#454545';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-512,512);ctx.stroke();
      }
    });
    bump.colorSpace=THREE.NoColorSpace;bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
    bump.repeat.set(2*Math.PI*radius/16,length/16);
    const knurled=mat.clone();knurled.bumpMap=bump;knurled.bumpScale=.13;knurled.roughness=.4;materials.add(knurled);
    cylinder(radius, length, [x, 0, 0], knurled, 'x', parent);
  }
  const layout = kind==='caliper'
    ? { k: CALIPER.pixelsPerMM, x: CALIPER.jawFaceX, y: CALIPER.referenceY }
    : { k: MICROMETER.pixelsPerMM, x: MICROMETER.anvilFaceX, y: MICROMETER.axisY };
  const worldX = x => (x-layout.x)/layout.k;
  const worldY = y => (layout.y-y)/layout.k;
  function outline(path, depth, parent = root, mat = steel, section, cuts=[]) {
    const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
    for (const shape of SVGLoader.createShapes(parsed.paths[0])) {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth*layout.k, bevelEnabled: false, steps: 1 });
      if (section) {
        cuts.forEach(cut=>splitAtPlane(geometry,cut));
        const positions = geometry.getAttribute('position');
        for (let i=0; i<positions.count; i++) {
          const halfDepth = depth*layout.k/2;
          const profile=section(positions.getX(i),positions.getY(i));
          // Keep the measuring edge in X; only thickness and the carrier attachment change in Z.
          positions.setZ(i, halfDepth+(positions.getZ(i)-halfDepth)*profile.depth/depth+profile.center*layout.k);
        }
        geometry.computeVertexNormals();
      }
      const m = mesh(geometry, mat,
        [-layout.x/layout.k, layout.y/layout.k, -depth/2], parent);
      m.scale.set(1/layout.k, -1/layout.k, 1/layout.k);
    }
  }
  let update, detailTarget, current = state;
  if (kind === 'caliper') {
    const k = CALIPER.pixelsPerMM;
    const zero = worldX(CALIPER.scaleZeroX);
    box([826/k, 64/k, CALIPER.beamDepth], [worldX(517), worldY(154), 0]);
    outline(CALIPER.fixedOuter, CALIPER.jawDepth, root, steel, caliperOuterSection, caliperGrindingCuts(false));
    outline(CALIPER.fixedInner, CALIPER.innerDepth, root, steel, caliperInnerSection, caliperGrindingCuts(true));
    const slider = new THREE.Group(); slider.userData.adjustable = true; root.add(slider);
    outline(CALIPER.movingOuter, CALIPER.jawDepth, slider, steel, caliperOuterSection, caliperGrindingCuts(false,true));
    outline(CALIPER.movingInner, CALIPER.innerDepth, slider, steel, (x,y)=>caliperInnerSection(x,y,true), caliperGrindingCuts(true,true));
    const vernier = caliperReading(state.opening, state.divisions);
    const carrier = caliperSlider(vernier.span), width = carrier.width;
    const front = new THREE.Group(); front.position.z=CALIPER.plateZ; slider.add(front);
    const back = new THREE.Group(); back.position.z=-CALIPER.plateZ; slider.add(back);
    outline(carrier.backFrame, CALIPER.plateDepth, back);
    outline(carrier.topRail, CALIPER.plateDepth, front, face);
    const scaleCuts=[{x:0,y:1,constant:-CALIPER.scaleBottomY}];
    outline(carrier.bottomRail, CALIPER.plateDepth, slider, steel, caliperScaleSection, scaleCuts);
    const guideDepth=CALIPER.beamDepth+2*CALIPER.guideClearance;
    outline(carrier.topGuide, guideDepth, slider);
    outline(carrier.bottomGuide, guideDepth, slider, steel, caliperLowerGuideSection, scaleCuts);
    const plateFace=CALIPER.plateZ+CALIPER.plateDepth/2;
    for (const x of [CALIPER.jawFaceX+14, (CALIPER.jawFaceX+carrier.right)/2, carrier.right-14]) {
      cylinder(.8,.3,[worldX(x),worldY(232),plateFace+.15],black,'z',slider);
      box([1.2,.12,.13],[worldX(x),worldY(232),plateFace+.36],steel,slider).rotation.z=.65;
    }
    for (const x of [168,carrier.right-14]) cylinder(.8,.3,[worldX(x),worldY(114),plateFace+.15],black,'z',slider);
    const lockX = worldX(154+width-40);
    cylinder(1.5, 5, [lockX, worldY(100), 0], face, 'y', slider);
    cylinder(3, 5, [lockX, worldY(83), 0], steel, 'y', slider);
    for (let i=0; i<20; i++) {
      const a = i*Math.PI/10;
      cylinder(.15, 4.5, [lockX+3*Math.cos(a), worldY(83), 3*Math.sin(a)], face, 'y', slider);
    }
    cylinder(5, 5, [worldX(154+width-27), worldY(246), 0], face, 'z', slider);
    const beamMap = texture(3072, 256, (ctx, w, h) => {
      ctx.fillStyle = ctx.strokeStyle = '#24343d'; ctx.lineWidth = 2;
      ctx.font = '43px sans-serif'; ctx.textAlign = 'center';
      for (let i=0; i<=150; i++) {
        const x = (i+1)*w/152;
        ctx.beginPath(); ctx.moveTo(x, h-.5); ctx.lineTo(x, i%10===0 ? 99 : i%5===0 ? 139 : 169); ctx.stroke();
        if (i%10===0) ctx.fillText(String(i), x, 76);
      }
    });
    decal(beamMap, [152, 12], [zero+75, worldY(159), CALIPER.beamDepth/2+.04]);
    const n = state.divisions;
    const vernierMap = texture((vernier.span+2)*26, 196, (ctx, w) => {
      ctx.fillStyle = ctx.strokeStyle = '#24343d'; ctx.lineWidth = 2;
      ctx.font = '48px sans-serif'; ctx.textAlign = 'center';
      for (let i=0; i<=n; i++) {
        const x = (1+i*vernier.spacing)*w/(vernier.span+2);
        ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, i%5===0 ? 104 : 67); ctx.stroke();
        if (i%5===0) ctx.fillText(String(i), x, 181);
      }
    });
    const scaleCenterY=(CALIPER.scaleTopY+CALIPER.scaleBottomY)/2;
    const scale=decal(vernierMap, [vernier.span+2, (CALIPER.scaleBottomY-CALIPER.scaleTopY)/k], [zero+vernier.span/2, worldY(scaleCenterY), 0], slider);
    const scalePositions=scale.geometry.getAttribute('position');
    for (let i=0;i<scalePositions.count;i++) {
      const y=scaleCenterY-scalePositions.getY(i)*k;
      const section=caliperScaleSection(0,y);
      scalePositions.setZ(i,section.center+section.depth/2+.04);
    }
    scalePositions.needsUpdate=true; scale.geometry.computeVertexNormals();
    // The rod's tip is flush when closed and protrudes by exactly the jaw opening.
    const rod = box([184, 1.4, 1.6], [worldX(930)-92, worldY(148), 0], face);
    const object = box([state.objectWidth, 53/k, 10], [state.objectWidth/2, worldY(320.5), 0], objectMaterial);
    cylinder(1.2, .2, [worldX(905), worldY(154), CALIPER.beamDepth/2+.14], black, 'z');
    tag('A', [112, 21, 3]); tag('B', [zero+8, -16, 4], slider);
    tag('C', [-13, -33, 4]); tag('D', [worldX(CALIPER.innerFaceX), 35, 4]);
    tag('E', [-21, 9, 4]); tag('F', [lockX, worldY(83)+8, 4], slider);
    update = next => { slider.position.x = next.opening; rod.position.x = worldX(930)-92+next.opening; object.visible = next.measuring; };
    detailTarget = () => new THREE.Vector3(current.opening/2+12, -4, 0);
  } else {
    const blue = material('#1b81b4', .3, .36);
    outline(MICROMETER.frame,10,root,blue);
    outline(MICROMETER.grip,10.2,root,black);
    cylinder(3.25, 5, [-2.5, 0, 0]); cylinder(3.25, .5, [-.25, 0, 0], face);
    const supportLeft = worldX(MICROMETER.collarLeftX), supportRight = worldX(MICROMETER.collarRightX);
    const zero = worldX(MICROMETER.scaleZeroX);
    const spindle = cylinder(3, supportLeft-state.opening, [(supportLeft+state.opening)/2, 0, 0]);
    cylinder(7, supportRight-supportLeft, [(supportRight+supportLeft)/2, 0, 0]);
    cylinder(MICROMETER.sleeveRadius, zero+25-supportRight, [(zero+25+supportRight)/2, 0, 0]);
    cylinder(2.3, 1, [(supportLeft+supportRight)/2, 0, 7.3], black, 'z');
    const lock = box([1.2, 4.5, 1.3], [(supportLeft+supportRight)/2+1, -1.6, 8], black); lock.rotation.z = -.5;
    const sleeveMap = texture(2160, 640, (ctx, w) => {
      ctx.fillStyle = ctx.strokeStyle = '#24343d'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 320); ctx.lineTo(w, 320); ctx.stroke();
      ctx.font = '108px sans-serif'; ctx.textAlign = 'center';
      for (let i=0; i<=50; i++) {
        const x = (1+i/2)*w/27;
        ctx.beginPath(); ctx.moveTo(x, 320); ctx.lineTo(x, i%2===0 ? 185 : 455); ctx.stroke();
        if (i%10===0) {
          ctx.textAlign=i===0 ? 'right' : 'center';
          ctx.fillText(String(i/2), x-(i===0 ? 8 : 0), 158);
        }
      }
    });
    const sleeveScale = decal(sleeveMap, [27, 8], [zero+12.5, 0, MICROMETER.sleeveRadius+.04]);
    // The rotating sleeve covers the fixed graduations to the right of its edge.
    const sleeveEdge = new THREE.Plane(new THREE.Vector3(-1, 0, 0), zero+state.opening);
    sleeveScale.material.clippingPlanes = [sleeveEdge];
    const thimble = new THREE.Group(); root.add(thimble); thimble.userData.adjustable = true;
    const rotor = new THREE.Group(); thimble.add(rotor);
    const ringMap = texture(2048, 256, (ctx, w) => {
      ctx.fillStyle='#c4cdd2'; ctx.fillRect(0,0,w,256);
      ctx.fillStyle = ctx.strokeStyle = '#24343d'; ctx.lineWidth = 2;
      ctx.font = '48px sans-serif'; ctx.textAlign = 'center';
      for (let i=0; i<=50; i++) {
        const x = i*w/50;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, i%5===0 ? 124 : 77); ctx.stroke();
        if (i%5===0) { ctx.save(); ctx.translate(x, 183); ctx.rotate(Math.PI/2); ctx.fillText(String(i%50), 0, 0); ctx.restore(); }
      }
    });
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#c4cdd2', metalness: .78, roughness: .3, map: ringMap }); materials.add(ringMaterial);
    const cone = mesh(new THREE.CylinderGeometry(6.15, 8.7, 6, 80, 1), ringMaterial, [3, 0, 0], rotor); cone.rotation.z = Math.PI/2;
    knurl(8.7, 23, 17.5, steel, rotor);
    cylinder(4.5, 4, [31, 0, 0], steel, 'x', rotor); knurl(4.6, 8, 37.5, steel, rotor);
    const object = box([state.objectWidth, 10, 10], [state.objectWidth/2, 0, 0], objectMaterial);
    tag('A', [-6, 11, 5]); tag('B', [zero+4, 13, 6]); tag('C', [18, -32, 6]);
    tag('F', [22, 9, 4]); tag('G', [supportLeft+3, -14, 7]);
    tag('E', [2, -14, 6], thimble); tag('D', [20, -17, 6], thimble); tag('D′', [39, 12, 6], thimble);
    update = next => {
      spindle.scale.y = (supportLeft-next.opening)/(supportLeft-state.opening);
      spindle.position.x = (supportLeft+next.opening)/2;
      sleeveEdge.constant = zero+next.opening;
      thimble.position.x = worldX(micrometerPositions(next.opening).edgeX);
      rotor.rotation.x = next.opening/PITCH * Math.PI*2;
      object.visible = next.measuring;
    };
    detailTarget = () => new THREE.Vector3(current.opening/2, -2, 0);
  }
  update(state);
  return { root, update(next) { current=next; update(next); }, detailTarget, dispose() { geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose()); } };
}

export function createMeasurementScene(host, kind, initial, onOpening) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  let controls, room, pmrem, environment, model, observer, pending = 0, disposed = false;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#edf2ef');
  const perspective = new THREE.PerspectiveCamera(36, 1, .1, 2000);
  const frontCamera = new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);
  let camera=perspective, aspect=1;
  let state = { ...initial }, drag;
  const sun = new THREE.DirectionalLight('#fff7ec', 3);
  function requestRender() {
    if (disposed || pending || document.hidden) return;
    pending = requestAnimationFrame(() => { pending=0; renderer.render(scene, camera); });
  }
  function visibility() { if (!document.hidden) requestRender(); }
  function fit(view = 'overview') {
    const bounds = new THREE.Box3().setFromObject(model.root);
    const size = bounds.getSize(new THREE.Vector3()), target = bounds.getCenter(new THREE.Vector3());
    if (view === 'detail') { target.copy(model.detailTarget()); size.set(kind==='caliper' ? 90 : 65, 75, 18); }
    const span=Math.max(size.y,size.x/aspect)*1.25;
    const distance=span/(2*Math.tan(perspective.fov*Math.PI/360));
    camera=view==='front' ? frontCamera : perspective;
    controls.object=camera;
    if (view==='front') {
      // Equal X coordinates project to the same column despite the plates' different depths.
      Object.assign(frontCamera,{left:-span*aspect/2,right:span*aspect/2,top:span/2,bottom:-span/2,zoom:1});
      frontCamera.updateProjectionMatrix();
    }
    controls.target.copy(target);
    camera.position.copy(target).add(view==='front' ? new THREE.Vector3(0, 0, distance) : new THREE.Vector3(-distance*.12, distance*.32, distance));
    controls.update(); requestRender();
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false); aspect=width/height;
    perspective.aspect=aspect; perspective.updateProjectionMatrix(); fit();
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function ray(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer, camera);
  }
  function start(event) {
    if (!state.interactive || event.button!==0 || drag) return;
    ray(event);
    const hit = raycaster.intersectObject(model.root, true).find(h => h.object.isMesh);
    let part = hit?.object;
    while (part && !part.userData.adjustable) part = part.parent;
    if (!part) return;
    const point = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
    if (!point) return;
    drag = { id: event.pointerId, opening: state.opening, x: point.x, y: event.clientY };
    controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
    event.stopImmediatePropagation(); event.preventDefault();
  }
  function move(event) {
    if (drag?.id!==event.pointerId) return;
    ray(event);
    const point = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
    if (point) onOpening(kind==='caliper' ? drag.opening+point.x-drag.x : drag.opening+(drag.y-event.clientY)*PITCH/140);
    event.stopImmediatePropagation();
  }
  function end(event) {
    if (drag?.id!==event.pointerId) return;
    drag=undefined; controls.enabled=true; event.stopImmediatePropagation();
  }
  function dispose() {
    disposed=true; cancelAnimationFrame(pending); observer?.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    for (const [name, handler] of [['pointerdown',start],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]]) renderer.domElement.removeEventListener(name, handler, true);
    controls?.dispose(); model?.dispose(); room?.dispose(); pmrem?.dispose(); environment?.dispose();
    sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  }
  try {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled=true;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('aria-label', kind==='caliper' ? '游标卡尺三维模型' : '螺旋测微器三维模型');
    host.appendChild(renderer.domElement);
    controls=new OrbitControls(camera, renderer.domElement); controls.enableDamping=false; controls.enablePan=false; controls.minDistance=35; controls.maxDistance=700;
    controls.minZoom=.25; controls.maxZoom=8;
    controls.addEventListener('change',requestRender);
    room=new RoomEnvironment(); pmrem=new THREE.PMREMGenerator(renderer); environment=pmrem.fromScene(room,.04);
    scene.environment=environment.texture; scene.environmentIntensity=.8;
    room.dispose(); room=undefined; pmrem.dispose(); pmrem=undefined;
    scene.add(new THREE.HemisphereLight('#ffffff','#899d91',1.6));
    sun.position.set(-50,160,130); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-100,right:250,top:130,bottom:-100,near:1,far:500}); sun.shadow.normalBias=.12; scene.add(sun);
    model=instrument(kind,state,renderer); scene.add(model.root);
    observer=new ResizeObserver(resize); observer.observe(host); resize();
    document.addEventListener('visibilitychange',visibility);
    for (const [name, handler] of [['pointerdown',start],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end]]) renderer.domElement.addEventListener(name,handler,true);
    return {
      resetView: fit,
      update(next) {
        if (disposed) return;
        const rebuild = next.divisions!==state.divisions || next.objectWidth!==state.objectWidth;
        state={...next};
        if (rebuild) { scene.remove(model.root); model.dispose(); model=instrument(kind,state,renderer); scene.add(model.root); }
        else model.update(state);
        requestRender();
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
