import { test, expect } from "@playwright/test";

test("站内电磁场：场景、预测、参数、暂停、重置与资源清理", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith(baseURL)) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.__fields = {
      workers: new Set(),
      raf: new Set(),
      observers: new Set(),
      contexts: [],
    };
    const WorkerBase = window.Worker;
    window.Worker = class extends WorkerBase {
      constructor(...args) {
        super(...args);
        window.__fields.workers.add(this);
      }
      terminate() {
        window.__fields.workers.delete(this);
        super.terminate();
      }
    };
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        window.__fields.raf.delete(id);
        callback(time);
      });
      window.__fields.raf.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      window.__fields.raf.delete(id);
      cancel(id);
    };
    const Observer = window.ResizeObserver;
    window.ResizeObserver = class extends Observer {
      observe(...args) {
        window.__fields.observers.add(this);
        super.observe(...args);
      }
      disconnect() {
        window.__fields.observers.delete(this);
        super.disconnect();
      }
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const result = getContext.call(this, type, ...args);
      if (result && type.startsWith("webgl"))
        window.__fields.contexts.push(result);
      return result;
    };
  });
  await page.goto("/");
  await expect(page.locator(".experiment-card")).toHaveCount(4);
  await page.screenshot({
    path: `/tmp/fields-catalog-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("searchbox").fill("静电屏蔽");
  await page.locator(".experiment-card").click();
  await expect(page.locator(".electrostatic-scene canvas")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "带空腔导体：电荷放入空腔" }),
  ).toBeVisible();
  await expect(page.locator(".stage-error")).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/fields-electrostatic-${test.info().project.name}.png`,
    fullPage: true,
  });
  const canvas = page.locator(".electrostatic-scene canvas");
  const before = await canvas.evaluate((c) => c.toDataURL());
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.51, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(() => canvas.evaluate((c) => c.toDataURL()))
    .not.toBe(before);
  await page.getByRole("button", { name: "进入预测模式", exact: true }).click();
  await expect(page.locator(".lab-observation")).toContainText(
    "点电荷放在空腔内部",
  );
  await expect(page.getByText("模型诊断", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "显示模型结果", exact: true }).click();
  for (const label of [
    "带电球体",
    "空腔屏蔽",
    "尖端效应",
    "哑铃导体",
    "避雷针",
    "实心导体",
    "腔内电荷",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(150);
    await expect(page.locator(".stage-error")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "负电荷", exact: true }).click();
  await page
    .getByRole("slider", { name: "电荷量（相对值）", exact: true })
    .fill("1.5");
  await page.getByRole("button", { name: "暂停演示", exact: true }).click();
  const frozen = await canvas.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(150);
  expect(await canvas.evaluate((c) => c.toDataURL())).toBe(frozen);
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "电荷量（相对值）", exact: true }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "腔内电荷", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "← 实验目录", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("静电屏蔽");
  await page.getByRole("searchbox").fill("磁感线");
  await page.locator(".experiment-card").click();
  await expect(page.locator(".magnetic-scene canvas")).toBeVisible();
  await expect(page.locator(".magnetic-scene")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 40000 },
  );
  await page.screenshot({
    path: `/tmp/fields-magnetic-${test.info().project.name}.png`,
    fullPage: true,
  });
  for (const label of [
    "地磁场",
    "条形磁铁",
    "弯折导线",
    "通电直导线",
    "双导线",
    "环形电流",
    "通电螺线管",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".magnetic-scene")).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: 40000 },
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".stage-error")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "双导线", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "矢量合成（B = B₁ + B₂）", exact: true })
    .check();
  await expect(page.locator(".magnetic-scene")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 40000 },
  );
  await page
    .locator(".magnetic-scene canvas")
    .click({ position: { x: 100, y: 150 } });
  await expect(page.locator(".field-sample")).toContainText("B₁");
  await page.getByRole("button", { name: "进入预测模式", exact: true }).click();
  await expect(page.locator(".field-sample")).toHaveCount(0);
  await page.getByRole("button", { name: "揭示磁场分布", exact: true }).click();
  await page.getByRole("checkbox", { name: "截面热力图", exact: true }).check();
  await expect(page.locator(".magnetic-scene")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 40000 },
  );
  await page.getByRole("button", { name: "暂停演示", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__fields.raf.size))
    .toBe(0);
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "地磁场", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Leave while a computation is pending, then enter again to detect stale callbacks.
  await page.getByRole("button", { name: "通电螺线管", exact: true }).click();
  await page.getByRole("link", { name: "← 实验目录", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        workers: window.__fields.workers.size,
        raf: window.__fields.raf.size,
        observers: window.__fields.observers.size,
        contexts: window.__fields.contexts.filter((gl) => !gl.isContextLost())
          .length,
      })),
    )
    .toEqual({ workers: 0, raf: 0, observers: 0, contexts: 0 });
  await page.locator(".experiment-card").click();
  await expect(page.locator(".magnetic-scene canvas")).toBeVisible();
  await page.getByRole("link", { name: "← 实验目录", exact: true }).click();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
});
