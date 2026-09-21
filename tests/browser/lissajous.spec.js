import { test, expect } from "@playwright/test";

test("李萨如预设、相位调节、暂停与重置", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/experiments/lissajous");
  await expect(page.locator(".scope-scene canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "X 正弦电压" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "回扫消隐占比" })).toHaveCount(0);
  await page.getByRole("button", { name: /8 字形/ }).click();
  await expect(page.getByRole("slider", { name: "信号频率", exact: true })).toHaveAttribute("aria-valuetext", "2.00 Hz");
  await page.getByRole("slider", { name: "Y 初相" }).fill("45");
  await expect(page.locator("[aria-live=polite]").filter({ hasText: "初相差" })).toContainText("45°");
  await page.getByRole("button", { name: "暂停演示", exact: true }).click();
  const readings = await page.locator(".voltage-readings").innerText();
  await page.waitForTimeout(150);
  await expect(page.locator(".voltage-readings")).toHaveText(readings, { useInnerText: true });
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Y 初相" })).toHaveValue("90");
  await page.getByRole("button", { name: /高频成线/ }).click();
  await expect(page.getByRole("slider", { name: "信号频率", exact: true })).toHaveAttribute("aria-valuetext", "150.00 Hz");
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/lissajous-${test.info().project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
