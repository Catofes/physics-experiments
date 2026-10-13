// Both views share the measuring edges. Depth sections describe the guide and ground edges.
const pixelsPerMM = 4.5, beamDepth = 6, plateDepth = 1.2, guideClearance = .15;
export const CALIPER = {
  pixelsPerMM,
  jawFaceX: 170,
  scaleZeroX: 190,
  innerFaceX: 154,
  referenceY: 185,
  outerFaceTop: 246,
  outerFaceBottom: 372,
  innerFaceTop: 31,
  innerFaceBottom: 96,
  outerTaperStart: 320,
  outerTaperEnd: 340,
  outerGrindingWidth: 4,
  jawDepth: 6,
  tipDepth: 1.5,
  innerDepth: 2.6,
  innerEdgeDepth: .8,
  innerGrindingWidth: 3,
  beamDepth, plateDepth, guideClearance,
  plateZ: (beamDepth+plateDepth)/2+guideClearance,
  scaleTopY: 186+guideClearance*pixelsPerMM,
  scaleBottomY: 220,
  fixedInner: 'M154 31 Q178 54 178 96 V122 H154Z',
  movingInner: 'M154 31 Q130 51 125 86 L124 104 V122 H154Z',
  // The inside edge stays straight. Dark tip facets in photographs are not cutouts.
  fixedOuter: 'M104 106 H170 V320 V372 Q151 368 140 351 L104 218Z',
  movingOuter: 'M170 227 H250 L246 246 H234 Q228 246 225 257 L193 354 Q183 368 170 372 V320Z',
};

export function caliperSlider(span) {
  const width = Math.max(144, span * CALIPER.pixelsPerMM + 52);
  const right = 154 + width;
  const topRail = `M154 104 H${right} V123 H154Z`;
  const bottomRail = `M${CALIPER.jawFaceX} ${CALIPER.scaleTopY} H${right} V246 H${CALIPER.jawFaceX}Z`;
  const clearance = CALIPER.guideClearance*CALIPER.pixelsPerMM;
  return {
    width, right,
    // The connection is behind the beam. No front crossbar may cover its graduations.
    frame: `${topRail} ${bottomRail}`,
    backFrame: `M154 104 H${right} V246 H${CALIPER.jawFaceX} V184 H154Z`,
    // The inner bridge clears the beam vertically and the closed fixed jaws horizontally.
    topGuide: `M180 104 H${right} V${122-clearance} H180Z`,
    bottomGuide: `M${CALIPER.jawFaceX+clearance} ${186+clearance} H${right} V246 H${CALIPER.jawFaceX+clearance}Z`,
    topRail, bottomRail,
  };
}

const clamp = value => Math.max(0,Math.min(1,value));

// The scale's upper edge reaches the main-scale plane; its lower end joins the front plate.
export function caliperScaleSection(x,y) {
  const t=clamp((y-CALIPER.scaleTopY)/(CALIPER.scaleBottomY-CALIPER.scaleTopY));
  const front=CALIPER.beamDepth/2+(CALIPER.plateZ+CALIPER.plateDepth/2-CALIPER.beamDepth/2)*t;
  return {depth:CALIPER.plateDepth,center:front-CALIPER.plateDepth/2};
}

export function caliperLowerGuideSection(x,y) {
  const plate=caliperScaleSection(x,y);
  const front=plate.center-plate.depth/2;
  const back=-CALIPER.beamDepth/2-CALIPER.guideClearance;
  return {depth:front-back,center:(front+back)/2};
}

export function caliperOuterSection(x,y) {
  const progress=clamp(Math.min(
    (y-CALIPER.outerTaperStart)/(CALIPER.outerTaperEnd-CALIPER.outerTaperStart),
    1-Math.abs(x-CALIPER.jawFaceX)/(CALIPER.outerGrindingWidth*CALIPER.pixelsPerMM),
  ));
  return { depth:CALIPER.jawDepth-(CALIPER.jawDepth-CALIPER.tipDepth)*progress, center:0 };
}

export function caliperInnerSection(x,y,moving=false) {
  const progress=clamp(Math.min((106-y)/10,
    1-Math.abs(x-CALIPER.innerFaceX)/(CALIPER.innerGrindingWidth*CALIPER.pixelsPerMM)));
  const bladeDepth=CALIPER.innerDepth-(CALIPER.innerDepth-CALIPER.innerEdgeDepth)*progress;
  let depth=bladeDepth;
  // Opposite half-layers let the inward-facing bodies pass each other at small openings.
  let center=-(bladeDepth/2+CALIPER.guideClearance/2);
  if (moving) {
    // Finish the attachment before the fixed head begins at y=106.
    const mount=clamp((y-CALIPER.innerFaceBottom)/(106-CALIPER.innerFaceBottom));
    center=(bladeDepth/2+CALIPER.guideClearance/2)*(1-mount)+CALIPER.plateZ*mount;
    depth=bladeDepth*(1-mount)+CALIPER.plateDepth*mount;
  }
  return { depth,center };
}

export function caliperGrindingCuts(inner,moving=false) {
  const face=inner ? CALIPER.innerFaceX : CALIPER.jawFaceX;
  const width=(inner ? CALIPER.innerGrindingWidth : CALIPER.outerGrindingWidth)*CALIPER.pixelsPerMM;
  const side=inner ? (moving ? -1 : 1) : (moving ? 1 : -1);
  const start=inner ? 106 : CALIPER.outerTaperStart;
  const length=inner ? -10 : CALIPER.outerTaperEnd-start;
  const cuts=[
    { x:0,y:1,constant:-start },
    { x:1,y:0,constant:-(face+side*width) },
    { x:side/width,y:1/length,constant:-start/length-1-side*face/width },
  ];
  if (inner && moving) cuts.push({x:0,y:1,constant:-CALIPER.innerFaceBottom});
  return cuts;
}
