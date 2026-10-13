import test from 'node:test';
import { MICROMETER, micrometerPositions } from '../src/experiments/micrometer/geometry.js';
import assert from 'node:assert/strict';
import { caliperReading, vernierPosition } from '../src/experiments/vernier-caliper/physics.js';
import { micrometerReading, thimbleTicks } from '../src/experiments/micrometer/physics.js';
import { CALIPER, caliperOuterSection, caliperInnerSection, caliperScaleSection, caliperLowerGuideSection } from '../src/experiments/vernier-caliper/geometry.js';

test('每种游标在一个毫米内的每个分度，只有指定的内部刻度对齐', () => {
  for (const n of [10, 20, 50]) {
    for (const base of [0, 12, 59]) {
      for (let k = 0; k < n; k++) {
        const r = caliperReading(base + k / n, n);
        assert.equal(r.main, base);
        assert.equal(r.aligned, k);
        assert.ok(Math.abs(vernierPosition(r, k) - (base + k)) < 1e-10);
        for (let j = 0; j < n; j++) {
          const x = vernierPosition(r, j);
          assert.equal(Math.abs(x - Math.round(x)) < 1e-10, j === k);
        }
        assert.ok(Math.abs(r.main + r.aligned * r.resolution - r.opening) < 1e-10);
      }
    }
    assert.equal(vernierPosition(caliperReading(0,n),n),n-1);
    assert.equal(caliperReading(60, n).aligned, 0);
    assert.equal(caliperReading(60, n).main, 60);
  }
});

test('游标进位及范围限制按实际分度处理', () => {
  assert.equal(caliperReading(12.999, 50).opening, 13);
  assert.equal(caliperReading(-1, 20).opening, 0);
  assert.equal(caliperReading(100, 10).opening, 60);
  assert.throws(() => caliperReading(12, 30), RangeError);
});

test('测微器读数包含半毫米，圆周刻度和估读连续越过零线', () => {
  for (const [value, sleeve, thimble] of [[0,0,0], [5.49,5,49], [5.499,5,49.9], [5.5,5.5,0], [5.51,5.5,1], [5.678,5.5,17.8], [5.999,5.5,49.9], [6,6,0], [25,25,0]]) {
    const r = micrometerReading(value);
    assert.equal(r.sleeve, sleeve);
    assert.equal(r.thimble, thimble);
    assert.ok(Math.abs(r.sleeve + r.thimble * .01 - value) < 1e-10);
    const ticks = thimbleTicks(r);
    assert.equal(new Set(ticks.map(t => t.index)).size, ticks.length);
    assert.ok(ticks.every(t => t.index >= 0 && t.index < 50));
  }
  assert.equal(micrometerReading(5.678+.5).thimble, micrometerReading(5.678).thimble);
  const before = thimbleTicks(micrometerReading(5.499)).find(t=>t.index===0);
  const after = thimbleTicks(micrometerReading(5.5)).find(t=>t.index===0);
  assert.ok(Math.abs(before.offset + .1) < 1e-10);
  assert.equal(after.offset, 0);
});

test('测微器固定刻度零点离开安装座，旋钮边缘与测量面使用同一位移', () => {
  assert.ok(MICROMETER.scaleZeroX > MICROMETER.collarRightX);
  for (const opening of [0, .5, 5.678, 25]) {
    const p = micrometerPositions(opening);
    assert.equal(p.zeroX, MICROMETER.scaleZeroX);
    assert.ok(Math.abs((p.edgeX-p.zeroX)/MICROMETER.pixelsPerMM-opening)<1e-10);
    assert.ok(Math.abs((p.movingFaceX-MICROMETER.anvilFaceX)/MICROMETER.pixelsPerMM-opening)<1e-10);
  }
});

test('游标尺前后压板避让闭合量爪和尺身，内测爪根部接到前压板', () => {
  const frontInside=CALIPER.plateZ-CALIPER.plateDepth/2;
  assert.ok(frontInside>CALIPER.beamDepth/2);
  for (const y of [190,210,230,245]) {
    const fixed=caliperOuterSection(160,y);
    assert.ok(frontInside>fixed.center+fixed.depth/2);
    assert.ok(-frontInside<fixed.center-fixed.depth/2);
  }
  for (const y of [106,114,122]) {
    const root=caliperInnerSection(CALIPER.innerFaceX,y,true);
    assert.equal(root.center,CALIPER.plateZ);
    assert.equal(root.depth,CALIPER.plateDepth);
    assert.ok(root.center-root.depth/2>CALIPER.jawDepth/2);
  }
});

test('刀口磨薄且内测爪错层，张开时爪身可以彼此通过', () => {
  for (const y of [246,320,330,350,370]) {
    const section=caliperOuterSection(CALIPER.jawFaceX,y);
    assert.equal(section.center,0);
    assert.ok(section.depth>=CALIPER.tipDepth && section.depth<=CALIPER.jawDepth);
  }
  assert.equal(caliperOuterSection(CALIPER.jawFaceX,350).depth,CALIPER.tipDepth);
  assert.equal(caliperOuterSection(CALIPER.jawFaceX-20,350).depth,CALIPER.jawDepth);
  assert.equal(caliperOuterSection(CALIPER.jawFaceX+20,350).depth,CALIPER.jawDepth);
  for (const y of [31,55,85,96]) {
    const fixed=caliperInnerSection(CALIPER.innerFaceX,y);
    const moving=caliperInnerSection(CALIPER.innerFaceX,y,true);
    assert.ok(Math.abs(fixed.depth-CALIPER.innerEdgeDepth)<1e-10);
    assert.ok(Math.abs(moving.depth-CALIPER.innerEdgeDepth)<1e-10);
    assert.ok(moving.center-moving.depth/2>fixed.center+fixed.depth/2);
  }
  for (const opening of [.05,.5,1,3.5]) {
    for (const y of [55,85,96,100,106,114]) {
      const fixed=caliperInnerSection(154+opening*CALIPER.pixelsPerMM/2,y);
      const moving=caliperInnerSection(154-opening*CALIPER.pixelsPerMM/2,y,true);
      assert.ok(moving.center-moving.depth/2>fixed.center+fixed.depth/2);
    }
  }
});

test('斜面刻度上缘与主尺同层，下缘连接压板，导槽不穿出刻度面', () => {
  const top=caliperScaleSection(200,CALIPER.scaleTopY);
  const bottom=caliperScaleSection(200,CALIPER.scaleBottomY);
  assert.ok(Math.abs(top.center+top.depth/2-CALIPER.beamDepth/2)<1e-10);
  assert.ok(Math.abs(bottom.center-CALIPER.plateZ)<1e-10);
  for (const y of [CALIPER.scaleTopY,195,205,220,246]) {
    const plate=caliperScaleSection(200,y),guide=caliperLowerGuideSection(200,y);
    assert.ok(Math.abs((guide.center+guide.depth/2)-(plate.center-plate.depth/2))<1e-10);
  }
});
