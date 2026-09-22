import { test, expect } from '@playwright/test';

const next = page => page.getByRole('button', { name: '下一步', exact: true }).click();
async function calculateAndConnect(page, name) {
  await next(page);
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '查看计算过程' }).click();
  await next(page);
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name, exact: true }).click();
}

test('0.6 A 电流表按页计算、接线、换刻度和验证，可返回修改', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.experiment-card').filter({ hasText: '电表改装' });
  const cover = await card.locator('img').evaluate(async img => (await fetch(img.src)).text());
  expect(cover).toContain('A · V · Ω');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await card.screenshot({ path: test.info().outputPath('catalog-meter.png') });
  await card.click();
  await expect(page.locator('.lab-controls')).toHaveCount(0);
  await expect(page.locator('.diagram-wrap')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上一步', exact: true })).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('task.png'), fullPage: true });
  await next(page);
  await expect(page.getByRole('heading', { name: '应该并联多大的电阻？如何计算？' })).toBeVisible();
  await page.getByRole('button', { name: '查看计算过程' }).click();
  await expect(page.getByText('100 / 599 Ω ≈ 0.167 Ω', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('calculation.png'), fullPage: true });
  await next(page);
  await page.getByRole('button', { name: '接入并联电阻', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('0.599 A 分流电流');
  const dial = page.locator('.meter-dial');
  await expect(dial.getByText('原表头')).toBeVisible();
  await expect(dial.locator('.dial-foot')).toContainText('1.000 mA');
  await page.screenshot({ path: test.info().outputPath('connected.png'), fullPage: true });
  const needle = await dial.locator('svg > line').last().getAttribute('x2');
  await next(page);
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '更新表盘刻度', exact: true }).click();
  await expect(dial.locator('.dial-head')).toHaveText('电流表A');
  await expect(dial.locator('svg text').last()).toHaveText('0.6');
  expect(await dial.locator('svg > line').last().getAttribute('x2')).toBe(needle);
  await next(page);
  await page.getByRole('slider', { name: '总电流', exact: true }).fill('0.3');
  await expect(page.locator('.result')).toContainText('0.30 A');
  await expect(dial.locator('.dial-foot')).toContainText('0.500 mA');
  await expect(dial.getByRole('img')).toHaveAttribute('aria-label', '指针偏转50%，新刻度');
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await expect(dial.getByText('原表头')).toBeVisible();
  await expect(dial.locator('.dial-foot')).toContainText('1.000 mA');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('电压表和欧姆表沿分步流程完成，欧姆表调零后才能换刻度', async ({ page }) => {
  await page.goto('/experiments/meter-conversion');
  await page.getByRole('button', { name: '电压表', exact: true }).click();
  await calculateAndConnect(page, '接入串联电阻');
  await expect(page.getByRole('status')).toContainText('串联电阻承担 2.9 V');
  await next(page);
  await page.getByRole('button', { name: '更新表盘刻度', exact: true }).click();
  await next(page);
  await page.getByRole('slider', { name: '待测电压', exact: true }).fill('1.5');
  await expect(page.locator('.meter-dial .dial-foot')).toContainText('0.500 mA');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.getByRole('button', { name: '欧姆表', exact: true }).click();
  await calculateAndConnect(page, '接入电池与调零电阻');
  await expect(page.locator('.ohm-terminals circle')).toHaveCount(2);
  await expect(page.locator('.shorted-probes')).toBeVisible();
  await expect(page.locator('.measured-resistor')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('ohmmeter-zero.png'), fullPage: true });
  await page.getByRole('slider', { name: '调零电阻', exact: true }).fill('1500');
  await expect(page.getByRole('button', { name: '下一步', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '短接调零：设为 1400 Ω' }).click();
  await next(page);
  await page.getByRole('button', { name: '更新表盘刻度', exact: true }).click();
  await next(page);
  await expect(page.locator('.measured-resistor')).toBeVisible();
  await expect(page.locator('.result')).toContainText('1500 Ω');
  await expect(page.locator('.ohm-terminals')).toContainText('A');
  await expect(page.locator('.ohm-terminals')).toContainText('B');
  await expect(page.locator('.meter-dial .dial-head')).toHaveText('欧姆表Ω ×100');
  const marks = page.locator('.meter-dial .scale-label');
  await expect(marks).toHaveText(['∞', '100', '50', '30', '20', '15', '10', '5', '0']);
  await expect(marks.filter({ hasText: /^15$/ })).toHaveAttribute('x', '210');
  // 等差电阻刻度 0、5、10 必须具有不同的角间距。
  const angles = await marks.evaluateAll(nodes => ['0', '5', '10'].map(label => {
    const node = nodes.find(n => n.textContent === label);
    return Math.atan2(208 - (Number(node.getAttribute('y')) - 5), Number(node.getAttribute('x')) - 210);
  }));
  expect(Math.abs((angles[1] - angles[0]) - (angles[2] - angles[1]))).toBeGreaterThan(0.1);
  for (const [name, current] of [['半偏 1.5 kΩ', '0.500'], ['开路 ∞ Ω', '0.000'], ['短接 0 Ω', '1.000']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.meter-dial .dial-foot')).toContainText(`${current} mA`);
    const state = name.startsWith('半偏') ? '.measured-resistor' : name.startsWith('开路') ? '.open-probes' : '.shorted-probes';
    await expect(page.locator(state)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`ohmmeter-${current}.png`), fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function finishBase(page, mode) {
  await page.goto('/experiments/meter-conversion');
  await page.getByRole('button', { name: mode, exact: true }).click();
  await calculateAndConnect(page, mode === '电压表' ? '接入串联电阻' : mode === '电流表' ? '接入并联电阻' : '接入电池与调零电阻');
  await next(page);
  await page.getByRole('button', { name: '更新表盘刻度', exact: true }).click();
  await next(page);
}
for (const [mode, low, high, stimulusLabel] of [['电压表', 3, 15, '待测电压'], ['电流表', 0.6, 3, '总电流']]) {
  test(`${mode}在单量程基底上接入量程开关、双刻度，切换量程保持输入并提示过载`, async ({ page }) => {
    await finishBase(page, mode);
    await page.getByRole('button', { name: '继续改装成双量程电表' }).click();
    await expect(page.locator('.lab-playback')).toHaveCount(0);
    if (mode === '电压表') {
      const diagrams = page.locator('.intro-circuits .range-circuit');
      await expect(diagrams).toHaveCount(2);
      await expect(diagrams.first()).toContainText('保留原 3 V 电压表');
      await expect(diagrams.first()).toContainText('2900 Ω（已有）');
      await expect(diagrams.first()).toContainText('待求');
      await expect(diagrams.first()).not.toContainText('12 kΩ');
      await expect(diagrams.first()).not.toContainText('核心');
    }
    await next(page);
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '查看扩程计算' }).click();
    await next(page);
    await expect(page.getByRole('button', { name: '下一步', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: mode === '电流表' ? '拆分电阻并接入抽头' : '接入新增串联电阻与抽头' }).click();
    await page.getByRole('button', { name: '增加第二组刻度' }).click();
    await expect(page.locator('.secondary-scale text').last()).toHaveText(String(high));
    if (mode === '电流表') {
      await expect(page.locator('.range-circuit').getByRole('img')).toHaveAttribute('aria-label', /0.6 A 挡，G 与 R₁＋R₂ 并联/);
      await expect(page.locator('.branch-readings')).toContainText('R₁：0.599 A');
      await expect(page.locator('.branch-readings')).toContainText('R₂：0.599 A（右 → 左）');
      await expect(page.locator('.terminal-two')).toHaveClass(/chosen/);
    } else {
      await expect(page.locator('.terminal-low')).toHaveClass(/chosen/);
      await expect(page.locator('.voltage-readings')).toContainText('R₂ 无电流');
      await expect(page.locator('.voltage-readings')).toContainText('R₁：2.900 V');
      await expect(page.locator('.voltage-readings')).toContainText('串联电流：1.000 mA');
    }
    await next(page);
    const group = page.getByRole('group', { name: '电表量程' });
    await group.getByRole('button').last().click();
    await expect(page.locator('.secondary-scale text').last()).toHaveText(String(high));
    await expect(page.locator('.scale-label').last()).toHaveText(String(low));
    await expect(page.getByRole('slider', { name: stimulusLabel, exact: true })).toHaveValue(String(low));
    await expect(page.locator('.meter-dial .dial-foot')).toContainText('0.200 mA');
    await page.getByRole('button', { name: '当前挡满偏' }).click();
    await expect(page.locator('.meter-dial .dial-foot')).toContainText('1.000 mA');
    await expect(page.locator('.meter-dial')).not.toHaveClass(/overload/);
    if (mode === '电流表') {
      await expect(page.locator('.range-circuit').getByRole('img')).toHaveAttribute('aria-label', /3 A 挡，G 与 R₂ 串联后与 R₁ 并联/);
      await expect(page.locator('.branch-readings')).toContainText('R₁：2.999 A');
      await expect(page.locator('.branch-readings')).toContainText('R₂：0.001 A（左 → 右）');
      await expect(page.locator('.terminal-one')).toHaveClass(/chosen/);
      await expect(page.locator('.terminal-two')).not.toHaveClass(/chosen/);
    } else {
      await expect(page.locator('.terminal-high')).toHaveClass(/chosen/);
      await expect(page.locator('.terminal-low')).not.toHaveClass(/chosen/);
      await expect(page.locator('.voltage-readings')).toContainText('表头：0.100 V');
      await expect(page.locator('.voltage-readings')).toContainText('R₁：2.900 V');
      await expect(page.locator('.voltage-readings')).toContainText('R₂：12.000 V');
    }
    await group.getByRole('button').first().click();
    await expect(page.locator('.reading')).toContainText('超量程');
    await expect(page.locator('.meter-dial')).toHaveClass(/overload/);
    await group.getByRole('button').last().click();
    await page.screenshot({ path: test.info().outputPath(`${mode}-dual.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '返回单量程验证' }).click();
    await expect(page.locator('.result')).toBeVisible();
  });
}

test('欧姆表换倍率后需重新调零，两种方式读数与中心阻值一致', async ({ page }) => {
  await finishBase(page, '欧姆表');
  await page.getByRole('button', { name: '继续探索欧姆表换量程' }).click();
  for (const method of ['改变电池电压', '改变表头灵敏度']) {
    await page.getByRole('button', { name: method, exact: true }).click();
    for (const multiplier of [10, 1000]) {
      await page.getByRole('button', { name: `×${multiplier}`, exact: true }).click();
      await expect(page.getByRole('slider', { name: '待测电阻', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: `重新短接调零：设为 ${15 * multiplier - 100} Ω` }).click();
      await expect(page.locator('.meter-dial').getByRole('img')).toHaveAttribute('aria-label', '指针偏转100%，新刻度');
      await page.getByRole('button', { name: `半偏 ${15 * multiplier} Ω`, exact: true }).click();
      await expect(page.locator('.reading')).toContainText(`表盘读数：${15 * multiplier} Ω`);
      await expect(page.locator('.meter-dial').getByRole('img')).toHaveAttribute('aria-label', '指针偏转50%，新刻度');
      await page.getByRole('button', { name: '开路 ∞ Ω', exact: true }).click();
      await expect(page.locator('.reading')).toContainText('表盘读数：∞ Ω');
    }
  }
  await page.screenshot({ path: test.info().outputPath('ohm-ranges.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
