import { R, MU, TAU, solveE } from '../orbits/physics.js';
function solveH(M,e){let H=Math.asinh(M/e);for(let i=0;i<18;i++){const q=(e*Math.sinh(H)-H-M)/(e*Math.cosh(H)-1);H-=q;if(Math.abs(q)<1e-12)break}return H}
function solveD(q){let D=Math.cbrt(3*q);for(let i=0;i<15;i++){const z=(D+D*D*D/3-q)/(1+D*D);D-=z;if(Math.abs(z)<1e-12)break}return D}
export function makeOrbit(r0,v){
 const vc=Math.sqrt(MU/r0),energy=v*v/2-MU/r0,h=r0*v;
 if(Math.abs(v-vc)<1e-10){const n=Math.sqrt(MU/r0**3),period=TAU/n;return{kind:"circle",r0,v,vc,period,sample:period/2400,stateAt(t){const a=n*t;return{x:r0*Math.sin(a),y:r0*Math.cos(a),vx:r0*n*Math.cos(a),vy:-r0*n*Math.sin(a)}}}}
 if(Math.abs(energy)<1e-7){const k=Math.sqrt(2*r0**3/MU);return{kind:"parabola",r0,v,vc,sample:1,stateAt(t){const D=solveD(t/k),dD=1/(k*(1+D*D)),xp=r0*(1-D*D),yp=2*r0*D;return{x:yp,y:xp,vx:2*r0*dD,vy:-2*r0*D*dD}}}}
 if(energy<0){const a=-MU/(2*energy),e=Math.sqrt(Math.max(0,1+2*energy*h*h/MU**2)),n=Math.sqrt(MU/a**3),period=TAU/n,sign=v>vc?1:-1,M0=sign>0?0:Math.PI,sq=Math.sqrt(Math.max(0,1-e*e));return{kind:"ellipse",r0,v,vc,a,e,period,sample:period/5000,stateAt(t){const E=solveE(M0+n*t,e),dE=n/(1-e*Math.cos(E)),xp=a*(Math.cos(E)-e),yp=a*sq*Math.sin(E),vxp=-a*Math.sin(E)*dE,vyp=a*sq*Math.cos(E)*dE;return{x:sign*yp,y:sign*xp,vx:sign*vyp,vy:sign*vxp}}}}
 const a=MU/(2*energy),e=Math.sqrt(1+2*energy*h*h/MU**2),n=Math.sqrt(MU/a**3),sq=Math.sqrt(e*e-1);return{kind:"hyperbola",r0,v,vc,a,e,sample:1,stateAt(t){const H=solveH(n*t,e),dH=n/(e*Math.cosh(H)-1),xp=a*(e-Math.cosh(H)),yp=a*sq*Math.sinh(H),vxp=-a*Math.sinh(H)*dH,vyp=a*sq*Math.cosh(H)*dH;return{x:yp,y:xp,vx:vyp,vy:vxp}}}
}

export function impactTime(o, pointMode = false) {
 if(pointMode || o.kind !== 'ellipse' || o.v >= o.vc) return Infinity;
 const periapsis = o.stateAt(o.period / 2);
 if(Math.hypot(periapsis.x, periapsis.y) >= R) return Infinity;
 let lo = 0, hi = o.period / 2;
 for(let i=0;i<60;i++){const mid=(lo+hi)/2, p=o.stateAt(mid); if(Math.hypot(p.x,p.y)>R)lo=mid;else hi=mid;}
 return hi;
}
