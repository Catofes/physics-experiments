import { test, expect } from '@playwright/test';

test('游标卡尺：对齐几何、分度切换、实物测量、自动演示与练习', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?category=测量');
  await expect(page.locator('.experiment-card')).toHaveCount(2);
  await page.getByRole('link').filter({ hasText: '游标卡尺' }).click();
  const answer = page.getByTestId('measurement-answer');
  await expect(answer).toContainText('12.35 mm');
  const jawEdges = await page.locator('.instrument').evaluate(svg => {
    const fixed=svg.querySelector('[data-fixed-outer-jaw]');
    const moving=svg.querySelector('[data-moving-outer-jaw]');
    // Probe the actual filled outlines, so a drawn guide cannot hide a recessed jaw.
    return [250, 280, 330, 360].map(y => ({
      fixedInside:fixed.isPointInFill(new DOMPoint(169.9,y)),
      fixedOutside:fixed.isPointInFill(new DOMPoint(170.1,y)),
      movingInside:moving.isPointInFill(new DOMPoint(170.1,y)),
      movingOutside:moving.isPointInFill(new DOMPoint(169.9,y)),
    }));
  });
  expect(jawEdges).toEqual(Array.from({length:4},()=>({fixedInside:true,fixedOutside:false,movingInside:true,movingOutside:false})));
  await expect(page.locator('[data-main-label]')).toHaveText(['0', '10', '20', '30', '40']);
  await expect(page.locator('.scale-panel')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /局部细看/ })).toHaveCount(0);
  const labels = page.locator('.part-key');
  await expect(labels).toContainText('B 游标尺');
  await expect(labels).toContainText('E 尺身');
  await expect(labels).toContainText('F 紧固螺钉');
  for (const [name, value] of [['10 分度', '12.4'], ['50 分度', '12.40'], ['20 分度', '12.40']]) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(answer).toContainText(`${value} mm`);
    const main = await page.locator('[data-alignment-main]').getAttribute('x1');
    const vernier = await page.locator('[data-alignment-vernier]').getAttribute('x1');
    expect(Number(main)).toBeCloseTo(Number(vernier), 8);
    expect((await page.locator('[data-main-label]').allTextContents()).every(v => Number(v) % 10 === 0)).toBe(true);
    const windowClear = await page.locator('[data-slider-frame]').evaluate(frame => {
      const right=Number(frame.getAttribute('data-right'));
      return [130,160,180].every(y=>!frame.isPointInFill(new DOMPoint(right-1,y)))
        && !frame.isPointInFill(new DOMPoint(169.9,230))
        && frame.isPointInFill(new DOMPoint(170.1,230));
    });
    expect(windowClear).toBe(true);
  }
  const jaw = page.getByRole('slider', { name: '拖动活动量爪' });
  await jaw.focus();
  await jaw.press('ArrowRight');
  await expect(answer).toContainText('12.45 mm');
  await page.getByRole('button', { name: '自动演示对齐' }).click();
  await expect(answer).toContainText('12.50 mm');
  await page.getByRole('button', { name: '暂停演示' }).click();
  const frozen = await answer.innerText();
  await page.waitForTimeout(700);
  await expect(answer).toHaveText(frozen, { useInnerText: true });
  await page.getByRole('button', { name: '测量操作', exact: true }).click();
  await page.getByRole('button', { name: '轻合量爪', exact: true }).click();
  await expect(answer).toContainText('12.35 mm');
  await page.getByRole('button', { name: '收拢一格', exact: true }).click();
  await expect(answer).toContainText('12.35 mm');
  await page.screenshot({ path: `/tmp/caliper-measure-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '读数练习', exact: true }).click();
  await expect(answer).toHaveCount(0);
  await expect(page.getByRole('slider', { name: '量爪开口', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-alignment-vernier]')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: '放大位置（游标线号）' })).toHaveCount(0);
  await page.getByRole('textbox', { name: '你的读数（mm）' }).fill('');
  await page.getByRole('button', { name: '检查读数' }).click();
  await expect(page.getByText('请输入以毫米为单位的读数。')).toBeVisible();
  await page.getByRole('button', { name: '查看解析' }).click();
  await expect(answer).toBeVisible();
  await page.getByRole('button', { name: '换一道题' }).click();
  await expect(answer).toHaveCount(0);
  await page.getByRole('button', { name: '重置实验' }).click();
  await expect(answer).toContainText('12.35 mm');
  await page.getByRole('button', { name: '检查零位', exact: true }).click();
  const geometry = await page.locator('.instrument').evaluate(svg => {
    const x = selector => { const e=svg.querySelector(selector); return new DOMPoint(Number(e.getAttribute('x1')),0).matrixTransform(e.getCTM()).x; };
    return { outer: x('[data-moving-outer-face]')-x('[data-fixed-outer-face]'), inner: x('[data-moving-inner-face]')-x('[data-fixed-inner-face]'), zero: x('[data-vernier-tick="0"]')-x('[data-main-tick="0"]') };
  });
  for (const gap of Object.values(geometry)) expect(gap).toBeCloseTo(0, 8);
  await page.getByRole('button', { name: '量爪近景', exact: true }).click();
  await page.locator('.instrument').screenshot({ path: `/tmp/caliper-zero-${test.info().project.name}.png` });
  await page.getByRole('button', { name: '小数读数', exact: true }).click();
  const alignment = await page.locator('.instrument').evaluate(svg => {
    const x = selector => { const e=svg.querySelector(selector); return new DOMPoint(Number(e.getAttribute('x1')),0).matrixTransform(e.getCTM()).x; };
    const unit=x('[data-main-tick="1"]')-x('[data-main-tick="0"]');
    return { gap: (x('[data-moving-outer-face]')-x('[data-fixed-outer-face]'))/unit, inner: (x('[data-moving-inner-face]')-x('[data-fixed-inner-face]'))/unit, zero: (x('[data-vernier-tick="0"]')-x('[data-main-tick="0"]'))/unit, aligned: x('[data-vernier-tick="7"]')-x('[data-main-tick="19"]') };
  });
  // SVG transforms use browser float precision; tolerance is well below one micrometre.
  expect(alignment.gap).toBeCloseTo(12.35, 5); expect(alignment.inner).toBeCloseTo(12.35, 5); expect(alignment.zero).toBeCloseTo(12.35, 5); expect(alignment.aligned).toBeCloseTo(0, 5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/caliper-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: '← 实验目录' }).click();
  await expect(page.locator('.experiment-card')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('测微器：半毫米边界、估读、完整一转、轻合和隐藏答案', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/experiments/micrometer');
  const answer = page.getByTestId('measurement-answer');
  await expect(answer).toContainText('5.678 mm');
  await expect(answer).toContainText('17.8 格');
  await expect(page.locator('.part-key')).toContainText('D′ 微调旋钮');
  await expect(page.locator('.part-key')).toContainText('G 锁紧装置');
  for (const value of ['0', '0.5', '5.678', '25']) {
    await page.getByRole('slider', { name: '测量面间距', exact: true }).fill(value);
    const geometry = await page.locator('.instrument').evaluate(svg => {
      const x = selector => Number(svg.querySelector(selector).getAttribute('x1'));
      return { zero: x('[data-fixed-scale="0"]'), collar: Number(svg.querySelector('[data-sleeve]').getAttribute('x')), gap: (x('[data-spindle-face]')-x('[data-anvil-face]'))/8, exposed: (x('[data-thimble-edge]')-x('[data-fixed-scale="0"]'))/8 };
    });
    expect(geometry.zero).toBe(570);
    expect(geometry.zero).toBeGreaterThan(geometry.collar);
    expect(geometry.gap).toBeCloseTo(Number(value), 8);
    expect(geometry.exposed).toBeCloseTo(Number(value), 8);
  }
  await page.getByRole('button', { name: '练习估读', exact: true }).click();
  await page.screenshot({ path: `/tmp/micrometer-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '半毫米前', exact: true }).click();
  await expect(page.locator('[data-sleeve-value="5.5"]')).toHaveCount(0);
  await expect(answer).toContainText('5.490 mm');
  await page.getByRole('button', { name: '张开一格', exact: true }).click();
  await expect(page.locator('[data-sleeve-value="5.5"]')).toHaveCount(1);
  await expect(answer).toContainText('5.500 mm');
  await expect(page.locator('[data-thimble-index="0"]')).toHaveAttribute('data-offset', '0');
  await page.getByRole('button', { name: '练习估读', exact: true }).click();
  await page.getByRole('button', { name: '张开一整转', exact: true }).click();
  await expect(answer).toContainText('6.178 mm');
  await expect(answer).toContainText('17.8 格');
  await page.getByRole('button', { name: '整毫米前', exact: true }).click();
  await page.getByRole('button', { name: '张开 0.001', exact: true }).click();
  await expect(answer).toContainText('5.999 mm');
  await page.getByRole('button', { name: '张开 0.001', exact: true }).click();
  await expect(answer).toContainText('6.000 mm');
  const thimble = page.getByRole('slider', { name: '转动旋钮', exact: true });
  await thimble.focus();
  await thimble.press('ArrowUp');
  await expect(answer).toContainText('6.010 mm');
  await page.getByRole('button', { name: '测量操作', exact: true }).click();
  await page.getByRole('button', { name: '转动微调旋钮轻合', exact: true }).click();
  await expect(answer).toContainText('4.728 mm');
  await page.getByRole('button', { name: '收拢一格', exact: true }).click();
  await expect(answer).toContainText('4.728 mm');
  await page.getByRole('button', { name: '读数练习', exact: true }).click();
  await expect(answer).toHaveCount(0);
  await expect(page.getByRole('slider', { name: '测量面间距', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '你的读数（mm）' }).fill('99');
  await page.getByRole('button', { name: '检查读数' }).click();
  await expect(answer).toHaveCount(0);
  await page.getByRole('button', { name: '查看解析' }).click();
  await expect(answer).toBeVisible();
  const value = (await answer.locator('b').innerText()).replace(' mm', '');
  await page.getByRole('textbox', { name: '你的读数（mm）' }).fill(value);
  await page.getByRole('button', { name: '检查读数' }).click();
  await expect(page.getByText('读数正确。对照解析检查读数步骤。')).toBeVisible();
  await page.getByRole('button', { name: '换一道题' }).click();
  await expect(answer).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '你的读数（mm）' })).toHaveValue('');
  await page.getByRole('button', { name: '重置实验' }).click();
  await expect(answer).toContainText('5.678 mm');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('两个仪器均支持直接拖动，移动端布局没有横向溢出', async ({ page }) => {
  for (const [id, name, dx, dy] of [['vernier-caliper', '拖动活动量爪', 35, 0], ['micrometer', '转动旋钮', 0, -30]]) {
    await page.goto(`/experiments/${id}`);
    const control = page.getByRole('slider', { name, exact: true });
    const before = Number(await control.getAttribute('aria-valuenow'));
    // The group's bounding box includes empty space between the two jaws.
    const handle = id === 'vernier-caliper' ? control.locator('rect').first() : control.locator('path').first();
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
    expect(Number(await control.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('三维与示意图共用测量状态，支持旋转、近景及退出清理', async ({ page }) => {
  test.setTimeout(90_000);
  const errors=[];
  await page.addInitScript(() => {
    window.__measurementObservers=new Set();
    const Native=window.ResizeObserver;
    window.ResizeObserver=class extends Native {
      observe(...args) { window.__measurementObservers.add(this); return super.observe(...args); }
      disconnect() { window.__measurementObservers.delete(this); return super.disconnect(); }
    };
  });
  page.on('pageerror',e=>errors.push(e.message));
  for (const [id, title, slider, value] of [['vernier-caliper','游标卡尺','量爪开口','24.35'], ['micrometer','螺旋测微器','测量面间距','6.178']]) {
    await page.goto(`/experiments/${id}`);
    await page.getByRole('button', { name:'三维模型',exact:true }).click();
    await expect(page.locator('.measurement-3d')).toHaveAttribute('data-ready','true');
    const canvas=page.getByRole('img',{name:`${title}三维模型`,exact:true});
    await expect(canvas).toBeVisible();
    await page.getByRole('button',{name:'正面读数',exact:true}).click();
    await canvas.scrollIntoViewIfNeeded();
    const initialBox=await canvas.boundingBox();
    const initial=Number(await page.getByRole('slider',{name:slider,exact:true}).inputValue());
    // Pick the visible slider / knurled knob in the front view, then drag it.
    const measureX=id==='vernier-caliper' ? .29 : .73;
    const measureY=id==='vernier-caliper' ? .527 : .5-.103*initialBox.width/initialBox.height;
    const mx=initialBox.x+initialBox.width*measureX, my=initialBox.y+initialBox.height*measureY;
    await page.mouse.move(mx,my); await page.mouse.down();
    await page.mouse.move(mx+(id==='vernier-caliper' ? 30 : 0),my+(id==='micrometer' ? -30 : 0),{steps:5}); await page.mouse.up();
    expect(Number(await page.getByRole('slider',{name:slider,exact:true}).inputValue())).toBeGreaterThan(initial);
    const before=await canvas.screenshot();
    await page.getByRole('slider',{name:slider,exact:true}).fill(value);
    await expect(page.getByTestId('measurement-answer')).toContainText(`${value} mm`);
    const after=await canvas.screenshot();
    expect(before.equals(after)).toBe(false);
    await canvas.scrollIntoViewIfNeeded();
    const b=await canvas.boundingBox();
    // Rotate in the background so this gesture cannot drag a measurement part.
    await page.mouse.move(b.x+b.width*.8,b.y+b.height*.8); await page.mouse.down();
    await page.mouse.move(b.x+b.width*.85,b.y+b.height*.7,{steps:5}); await page.mouse.up();
    expect(after.equals(await canvas.screenshot())).toBe(false);
    await page.getByRole('button',{name:'测量面近景',exact:true}).click();
    await page.screenshot({path:`/tmp/${id}-3d-detail-${test.info().project.name}.png`,fullPage:true});
    await page.getByRole('button',{name:'恢复视角',exact:true}).click();
    await page.screenshot({path:`/tmp/${id}-3d-${test.info().project.name}.png`,fullPage:true});
    await page.getByRole('slider',{name:slider,exact:true}).fill('0');
    await page.getByRole('button',{name:'正面读数',exact:true}).click();
    await canvas.screenshot({path:`/tmp/${id}-3d-zero-${test.info().project.name}.png`});
    if (id==='vernier-caliper') {
      await page.getByRole('button',{name:'测量面近景',exact:true}).click();
      const c=await canvas.boundingBox();
      await page.mouse.move(c.x+c.width*.75,c.y+c.height*.9); await page.mouse.down();
      await page.mouse.move(c.x+c.width*.75+c.height*.13,c.y+c.height*.9,{steps:8}); await page.mouse.up();
      await page.mouse.wheel(0,-1000);
      await canvas.screenshot({path:`/tmp/caliper-closed-side-${test.info().project.name}.png`});
      await page.getByRole('slider',{name:slider,exact:true}).fill('0.05');
      await canvas.screenshot({path:`/tmp/caliper-nearly-closed-side-${test.info().project.name}.png`});
      await page.getByRole('button',{name:'恢复视角',exact:true}).click();
    }
    await page.getByRole('slider',{name:slider,exact:true}).fill(value);
    await page.getByRole('button',{name:'示意图',exact:true}).click();
    await expect(page.locator('.measurement-3d canvas')).toHaveCount(0);
    expect(await page.evaluate(()=>window.__measurementObservers.size)).toBe(0);
    await expect(page.getByTestId('measurement-answer')).toContainText(`${value} mm`);
    await page.getByRole('button',{name:'三维模型',exact:true}).click();
    await expect(page.locator('.measurement-3d')).toHaveAttribute('data-ready','true');
    await page.getByRole('button',{name:'示意图',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
