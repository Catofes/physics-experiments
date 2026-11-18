import { expect, test } from "@playwright/test";

async function expectFittingPage(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("振动与波分类、七项演示及返回目录", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "振动与波", exact: true }).click();
  await expect(page.locator(".experiment-card")).toHaveCount(2);
  await page.getByRole("searchbox").fill("单摆");
  await expect(page.locator(".experiment-card")).toHaveCount(1);
  await page.locator(".experiment-card").click();
  await expect(page.locator("#simulation")).toBeVisible();
  for (const name of [
    "弹簧振子",
    "单摆",
    "简谐振动图像",
    "阻尼振动图像",
    "横波",
    "纵波",
    "波的叠加",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "下一帧", exact: true }).click();
    await expect(page.locator("#elapsed")).toHaveText("0.08");
    await page.getByRole("button", { name: "重置", exact: true }).click();
    await expect(page.locator("#elapsed")).toHaveText("0.00");
  }
  await page.getByRole("radio", { name: "驻波演示" }).check();
  await expect(page.getByRole("radio", { name: "驻波演示" })).toBeChecked();
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.locator("#elapsed")).not.toHaveText("0.00");
  await expectFittingPage(page);
  await page.getByRole("link", { name: "← 实验目录" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("单摆");
  await expect(page.getByRole("button", { name: "振动与波" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Space");
  expect(errors).toEqual([]);
});

test("干涉预设、二维沿曲线选点及刷新", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/experiments/wave-interference");
  await expect(
    page.getByRole("heading", { name: "机械波干涉", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#mainCanvas")).toBeVisible();
  await expect(page.locator("#traceCanvas")).toBeVisible();
  await page.getByRole("button", { name: "二维水波", exact: true }).click();
  await expect(page.getByRole("button", { name: "二维水波" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("checkbox", { name: "加强线", exact: true }).check();
  await page.getByLabel("选点方式").selectOption("constructive");
  await expect(page.getByLabel("P 点 x / m")).toBeDisabled();
  await expect(page.getByLabel("选择曲线")).toBeEnabled();
  await page.getByLabel("P 点 y / m").fill("1");
  await page.getByLabel("P 点 y / m").press("Tab");
  await expect(page.locator("#pointSummary")).toContainText("1.00)");
  await page.getByRole("slider", { name: "实验时间", exact: true }).fill("6");
  await expect(page.locator("#pointVerdict")).toHaveText("接近振动加强点");
  await page.getByRole("button", { name: /频率不同/ }).click();
  await expect(page.locator("#beatPeriod")).toHaveText("4.00 s");
  await expect(page.locator("#pointVerdict")).toHaveText("强弱随时间交替");
  await expect(page.getByLabel("选点方式")).toHaveValue("free");
  await expectFittingPage(page);
  await page.getByRole("button", { name: "重置时间", exact: true }).click();
  await expect(page.locator("#timeOut")).toHaveText("0.00 s");
  await page.reload();
  await expect(page.getByRole("button", { name: "一维叠加" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#mainCanvas")).toBeVisible();
  expect(errors).toEqual([]);
});
