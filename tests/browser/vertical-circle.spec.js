import { test, expect } from '@playwright/test';
test('圆周运动：目录、分离暂停、回放、预设与移动端布局', async ({ page }) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?category=力学');
  await page.getByRole('link').filter({hasText:'竖直圆周运动与分离'}).click();
  await expect(page.getByRole('heading',{name:'竖直圆周运动与分离'})).toBeVisible();
  await page.getByRole('button',{name:'查看分离瞬间'}).click();
  await expect(page.getByTestId('motion-phase')).toContainText('分离瞬间');
  await expect(page.getByTestId('normal-force')).toHaveCount(0);
  await expect(page.getByTestId('radial-release')).toBeVisible();
  const panelBox = await page.getByRole('region', {name:'向心力对照'}).boundingBox();
  const stageBox = await page.locator('.lab-stage').boundingBox();
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(stageBox.y + stageBox.height + 1);
  await expect(page.getByRole('img', {name: /维持圆周运动所需：0.83/})).toBeVisible();
  await expect(page.getByRole('img', {name: /重力沿半径的分量：0.83/})).toBeVisible();
  await expect(page.locator('.katex-error')).toHaveCount(0);
  await page.screenshot({path: `/tmp/vertical-circle-release-${test.info().project.name}.png`, fullPage:true});
  const timeline=page.getByRole('slider',{name:'演示时间'});
  await timeline.press('ArrowRight');
  await expect(page.getByTestId('motion-phase')).toHaveText('抛体运动 · 只受重力');
  await expect(page.getByTestId('radial-flight')).toBeVisible();
  await timeline.fill(await timeline.getAttribute('max'));
  await expect(page.getByText('小球再次到达轨道，演示在接触前停止；不模拟碰撞。')).toBeVisible();
  await page.getByRole('button',{name:'低速折返',exact:true}).click();
  await page.getByRole('button',{name:'查看最高位置'}).click();
  await expect(page.getByTestId('motion-phase')).toHaveText('沿圆弧运动');
  await page.getByRole('button',{name:'临界过顶',exact:true}).click();
  await expect(page.getByText('恰好完成圆周运动', {exact:true})).toBeVisible();
  await page.getByRole('button',{name:'查看最高位置'}).click();
  await page.screenshot({path: `/tmp/vertical-circle-critical-${test.info().project.name}.png`, fullPage:true});
  await page.getByRole('slider', {name:'最低点初速度',exact:true}).fill('9');
  await expect(page.getByRole('slider', {name:'最低点初速度',exact:true})).toHaveAttribute('aria-valuetext','9.00m/s');
  await page.getByRole('button',{name:'途中分离',exact:true}).click();
  await page.getByRole('slider',{name:'播放倍率'}).fill('1');
  await page.getByRole('button',{name:'开始 / 继续',exact:true}).click();
  await expect(page.getByTestId('motion-phase')).toContainText('分离瞬间',{timeout:10000});
  await expect(page.getByRole('button',{name:'开始 / 继续',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'开始 / 继续',exact:true}).click();
  await expect(page.getByTestId('motion-phase')).toHaveText('抛体运动 · 只受重力');
  await page.getByRole('button',{name:'回到起点',exact:true}).click();
  await expect(timeline).toHaveValue('0');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/vertical-circle-${test.info().project.name}.png`,fullPage:true});
  expect(errors).toEqual([]);
});

test('向心力箭头使用固定刻度，随数值同比缩短，切换预设也不缩放', async ({ page }) => {
  await page.goto('/experiments/vertical-circle');
  const timeline = page.getByRole('slider', { name: '演示时间' });
  async function readForce(name) {
    const diagram = page.getByRole('img', { name: new RegExp(`^${name}：`) });
    const label = await diagram.getAttribute('aria-label');
    const value = Number(label.match(/：(-?[\d.]+) 倍重力/)[1]);
    // Measure origin to the rendered triangle tip, excluding stroke thickness.
    const length = await diagram.locator('[data-vector-length]').evaluate(arrow => {
      const origin = new DOMPoint(0, 0).matrixTransform(arrow.getScreenCTM());
      const head = arrow.querySelector('path');
      const tip = head.getPointAtLength(0).matrixTransform(head.getScreenCTM());
      return Math.hypot(tip.x - origin.x, tip.y - origin.y);
    });
    return { value, length };
  }
  const initial = await readForce('轨道提供的支持力');
  expect(initial.value).toBe(5.5);
  await timeline.fill('50');
  const later = await readForce('轨道提供的支持力');
  expect(later.value).toBeLessThan(5);
  expect(later.value).toBeGreaterThan(4);
  expect(later.length).toBeLessThan(initial.length);
  expect(later.length / initial.length).toBeCloseTo(later.value / initial.value, 2);
  for (const name of ['维持圆周运动所需', '重力沿半径的分量']) {
    const force = await readForce(name);
    expect(force.length / initial.length).toBeCloseTo(Math.abs(force.value) / initial.value, 2);
  }
  await page.getByRole('button', { name: '完整绕行', exact: true }).click();
  const complete = await readForce('轨道提供的支持力');
  expect(complete.value).toBe(7);
  expect(complete.length / initial.length).toBeCloseTo(complete.value / initial.value, 2);
  await page.getByRole('button', { name: '途中分离', exact: true }).click();
  await page.getByRole('button', { name: '查看分离瞬间' }).click();
  const required = await readForce('维持圆周运动所需');
  const gravity = await readForce('重力沿半径的分量');
  expect(required.length / initial.length).toBeCloseTo(required.value / initial.value, 2);
  expect(required.length).toBeCloseTo(gravity.length, 4);
  await page.screenshot({ path: `/tmp/vertical-circle-fixed-scale-${test.info().project.name}.png`, fullPage: true });
});
