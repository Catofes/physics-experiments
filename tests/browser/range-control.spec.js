import { test, expect } from "@playwright/test";

test("滑块数值可直接输入、取消并遵守范围与禁用状态", async ({ page }) => {
  await page.goto("/experiments/cathode-ray");

  await page.getByRole("button", { name: /输入信号频率，当前/ }).click();
  const frequency = page.getByRole("spinbutton", { name: "输入信号频率" });
  await expect(frequency).toBeFocused();
  await frequency.fill("2.37");
  await frequency.press("Enter");
  await expect(page.getByRole("slider", { name: "信号频率" })).toHaveAttribute("aria-valuetext", "2.37 Hz");

  await page.getByRole("button", { name: /输入信号频率，当前/ }).click();
  await frequency.fill("2000");
  await frequency.press("Enter");
  await expect(page.getByRole("slider", { name: "信号频率" })).toHaveAttribute("aria-valuetext", "1000.00 Hz");

  await page.getByRole("button", { name: /输入信号频率，当前/ }).click();
  await frequency.fill("12");
  await frequency.press("Escape");
  await expect(page.getByRole("slider", { name: "信号频率" })).toHaveAttribute("aria-valuetext", "1000.00 Hz");

  await page.getByRole("button", { name: /输入直流偏置，当前/ }).click();
  const offset = page.getByRole("spinbutton", { name: "输入直流偏置" });
  await offset.fill("-12.3");
  await offset.press("Tab");
  await expect(page.getByRole("slider", { name: "直流偏置" })).toHaveAttribute("aria-valuetext", "-12.3 V");
  await page.getByRole("slider", { name: "直流偏置" }).fill("5.5");
  await expect(page.getByRole("button", { name: /输入直流偏置，当前5.5 V/ })).toBeVisible();

  await page.getByRole("button", { name: "直流", exact: true }).click();
  await expect(page.getByRole("button", { name: /输入信号频率，当前/ })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "输入信号频率" })).toHaveCount(0);
});

test("数字按键板可通过按钮或双击打开并输入参数", async ({ page }) => {
  await page.goto("/experiments/cathode-ray");

  await page.getByRole("button", { name: "打开信号频率数字按键板" }).click();
  const keypad = page.getByRole("dialog", { name: "信号频率数字输入" });
  await expect(keypad).toBeVisible();
  for (const key of ["2", ".", "3", "7"]) await keypad.getByRole("button", { name: key, exact: true }).click();
  await keypad.getByRole("button", { name: "确定" }).click();
  await expect(page.getByRole("slider", { name: "信号频率" })).toHaveAttribute("aria-valuetext", "2.37 Hz");

  await page.getByRole("button", { name: /输入信号频率，当前/ }).dblclick();
  await expect(keypad).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "输入信号频率" })).toHaveCount(0);
  await keypad.getByRole("button", { name: "5", exact: true }).click();
  await keypad.getByRole("button", { name: "退格" }).click();
  await keypad.getByRole("button", { name: "1", exact: true }).click();
  await keypad.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("slider", { name: "信号频率" })).toHaveAttribute("aria-valuetext", "2.37 Hz");

  await page.getByRole("button", { name: "打开直流偏置数字按键板" }).click();
  const offsetKeypad = page.getByRole("dialog", { name: "直流偏置数字输入" });
  await offsetKeypad.getByRole("button", { name: "±" }).click();
  await offsetKeypad.getByRole("button", { name: "1", exact: true }).click();
  await offsetKeypad.getByRole("button", { name: "2", exact: true }).click();
  await offsetKeypad.getByRole("button", { name: "确定" }).click();
  await expect(page.getByRole("slider", { name: "直流偏置" })).toHaveAttribute("aria-valuetext", "-12.0 V");

  await page.getByRole("button", { name: "直流", exact: true }).click();
  await expect(page.getByRole("button", { name: "打开信号频率数字按键板" })).toBeDisabled();
});

test.describe("触屏输入", () => {
  test.use({ hasTouch: true });

  test("连续轻触数值打开数字按键板", async ({ page }) => {
    await page.goto("/experiments/cathode-ray");
    const valueButton = page.getByRole("button", { name: /输入信号频率，当前/ });
    await valueButton.scrollIntoViewIfNeeded();
    const bounds = await valueButton.boundingBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await expect(page.getByRole("dialog", { name: "信号频率数字输入" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "输入信号频率" })).toHaveCount(0);
  });
});
