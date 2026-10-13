// Pixel coordinates of the diagram also define the millimetre geometry of the 3D model.
export const MICROMETER = {
  pixelsPerMM: 8,
  anvilFaceX: 180,
  axisY: 130,
  collarLeftX: 480,
  collarRightX: 540,
  scaleZeroX: 570,
  sleeveRadius: 6,
  frame: 'M132 105 H165 V166 C165 246 220 289 328 289 C420 289 482 235 482 166 V98 H540 V188 C540 290 443 351 326 351 C203 351 112 280 112 180 V137 Q112 110 132 105Z',
  grip: 'M144 243 C174 307 235 335 326 335 C412 335 465 310 507 263 L493 244 C452 294 404 316 326 316 C247 316 192 292 159 234Z',
};

export function micrometerPositions(opening) {
  return {
    zeroX: MICROMETER.scaleZeroX,
    edgeX: MICROMETER.scaleZeroX + opening * MICROMETER.pixelsPerMM,
    movingFaceX: MICROMETER.anvilFaceX + opening * MICROMETER.pixelsPerMM,
  };
}
