import { test, expect } from '@playwright/test';

test('滑动变阻器：接线、滑片、曲线与参数联动', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/experiments/rheostat');
  await expect(page.getByRole('heading', { name: '滑动变阻器：分压与限流' })).toBeVisible();
  const diagram = page.locator('.circuit-diagram');
  const wiper = page.getByRole('slider', { name: '滑片 P 位置' });
  await expect(diagram).toHaveAttribute('aria-label', /分压接法.*P 到 B/);
  await wiper.fill('50');
  await wiper.focus();
  await wiper.press('ArrowLeft');
  await expect(wiper).toHaveValue('51');
  await wiper.press('ArrowRight');
  await expect(wiper).toHaveValue('50');
  const sliderBox = await wiper.boundingBox();
  await page.mouse.click(sliderBox.x + 2, sliderBox.y + sliderBox.height / 2);
  await expect(wiper).toHaveValue('100');
  await expect(diagram).toHaveAttribute('aria-label', /负载电压 6.0 伏/);
  await page.mouse.click(sliderBox.x + sliderBox.width - 2, sliderBox.y + sliderBox.height / 2);
  await expect(wiper).toHaveValue('0');
  await wiper.fill('0');
  await expect(diagram).toHaveAttribute('aria-label', /负载电压 0.0 伏/);
  await wiper.fill('100');
  await expect(diagram).toHaveAttribute('aria-label', /负载电压 6.0 伏/);
  await page.getByRole('button', { name: '限流接法' }).click();
  await expect(diagram).toHaveAttribute('aria-label', /B 悬空/);
  await wiper.fill('0');
  await expect(diagram).toHaveAttribute('aria-label', /接入电阻 20.0 欧，负载电压 2.0 伏/);
  await expect(page.locator('.apparatus-model')).toBeVisible();
  await expect(page.locator('.apparatus-model')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.bench-canvas canvas')).toBeVisible();
  await expect(page.locator('.chart-card')).toHaveCount(1);
  await expect(page.locator('.chart-dot')).toHaveCount(2);
  await expect(diagram).toContainText('0.20 A');
  const voltageCurve = page.locator('.divider-curve');
  const beforeLoadChange = await voltageCurve.getAttribute('d');
  await page.getByRole('slider', { name: '负载电阻' }).fill('40');
  await expect(voltageCurve).not.toHaveAttribute('d', beforeLoadChange);
  await expect(diagram).toContainText('4.00 V');
  await expect(page.locator('.apparatus-model')).toContainText('4.00 V');
  const chartBox = await page.locator('.chart-card').boundingBox();
  const modelBox = await page.locator('.apparatus-model').boundingBox();
  expect(chartBox.y).toBeLessThan(modelBox.y);
  const circuitBox = await page.locator('.circuit-views figure').boundingBox();
  if (page.viewportSize().width >= 1280) {
    expect(Math.abs(circuitBox.y - modelBox.y)).toBeLessThan(2);
    expect(circuitBox.x).toBeGreaterThanOrEqual(modelBox.x + modelBox.width);
  } else expect(circuitBox.y).toBeGreaterThanOrEqual(modelBox.y + modelBox.height);
  await page.getByRole('button', { name: '自动移动滑片' }).click();
  await expect(page.getByRole('button', { name: '暂停滑片演示' })).toBeVisible();
  await page.getByRole('button', { name: '恢复默认' }).click();
  await expect(wiper).toHaveValue('50');
  await expect(page.getByRole('button', { name: '分压接法' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '变阻器细节' }).click();
  await page.locator('.bench-canvas').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const handle = await page.locator('.bench-canvas canvas').evaluate(canvas => {
    const r = canvas.getBoundingClientRect();
    for (let y = r.top + r.height * .2; y < r.top + r.height * .7; y += 6) {
      for (let x = r.left + r.width * .3; x < r.left + r.width * .7; x += 6) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
        if (canvas.style.cursor === 'grab') return { x, y };
      }
    }
    return null;
  });
  expect(handle).not.toBeNull();
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x - 40, handle.y, { steps: 4 });
  await page.mouse.up();
  await expect(wiper).not.toHaveValue('50');
  await page.getByRole('button', { name: '恢复默认' }).click();
  await page.getByRole('button', { name: '俯视接线' }).click();
  await page.getByRole('button', { name: '恢复视角' }).click();
  await page.locator('.apparatus-model').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: '← 实验目录' }).click();
  await expect(page.locator('.bench-canvas canvas')).toHaveCount(0);
  await page.goto('/experiments/rheostat');
  await expect(page.locator('.apparatus-model')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);
});
