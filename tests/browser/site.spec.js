import { test, expect } from "@playwright/test";

test("目录、历史导航、暂停及重置", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("动量");
  await expect(page.locator(".experiment-card")).toHaveCount(1);
  await page.locator(".experiment-card").click();
  await expect(page.locator(".jump-scene canvas")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "开始 / 继续", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "暂停演示", exact: true }).click();
  const frozen = await page.locator(".readings").innerText();
  await page.waitForTimeout(150);
  await expect(page.locator(".readings")).toHaveText(frozen, {
    useInnerText: true,
  });
  await page.getByRole("button", { name: /连杆锁定/ }).click();
  await page.getByRole("slider", { name: "慢放倍率" }).fill("0.1");
  await page.getByRole("button", { name: "重置实验", exact: true }).click();
  await expect(page.getByRole("slider", { name: "慢放倍率" })).toHaveValue(
    "0.2",
  );
  await expect(page.locator(".choice-button[aria-pressed=true]")).toContainText(
    "基础纵跳",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "全屏演示", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.getByRole("button", { name: "退出全屏", exact: true }).click();
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("动量");
  await page.goForward();
  await expect(page.locator(".jump-scene canvas")).toBeVisible();
  await page.getByRole("link", { name: "← 实验目录", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("动量");
  await page.getByRole("button", { name: "电磁学", exact: true }).click();
  await page.getByRole("button", { name: "查看全部实验", exact: true }).click();
  await expect(page.locator(".experiment-card")).toHaveCount(4);
});

test("三维实验交互、退出清理及本地依赖", async ({ page, baseURL }) => {
  const external = [],
    errors = [];
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith(baseURL)) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__resources = { raf: new Set(), observers: new Set(), contexts: [] };
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        window.__resources.raf.delete(id);
        callback(time);
      });
      window.__resources.raf.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      window.__resources.raf.delete(id);
      cancel(id);
    };
    const Observer = window.ResizeObserver;
    window.ResizeObserver = class extends Observer {
      observe(element, options) {
        window.__resources.observers.add(this);
        super.observe(element, options);
      }
      disconnect() {
        window.__resources.observers.delete(this);
        super.disconnect();
      }
    };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const result = original.call(this, type, ...args);
      if (result && type.startsWith("webgl"))
        window.__resources.contexts.push(result);
      return result;
    };
  });
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await page
      .locator(".experiment-card")
      .filter({ hasText: "示波管" })
      .click();
    await expect(page.locator(".scope-scene canvas")).toBeVisible();
    await page.getByRole("button", { name: "暂停演示", exact: true }).click();
    const frozen = await page.locator(".voltage-readings").innerText();
    await page.waitForTimeout(150);
    await expect(page.locator(".voltage-readings")).toHaveText(frozen, {
      useInnerText: true,
    });
    await page.getByRole("button", { name: "直流", exact: true }).click();
    await expect(
      page.getByRole("slider", { name: "交流幅值", exact: true }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: "开启扫描" }).uncheck();
    await expect(
      page.getByRole("slider", { name: "扫描幅值", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "侧视", exact: true }).click();
    await page.getByRole("button", { name: "清除余晖", exact: true }).click();
    await page.getByRole("button", { name: "重置实验", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "开启扫描" }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "正弦波", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "← 实验目录", exact: true }).click();
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          raf: window.__resources.raf.size,
          observers: window.__resources.observers.size,
          contexts: window.__resources.contexts.filter(
            (gl) => !gl.isContextLost(),
          ).length,
        })),
      )
      .toEqual({ raf: 0, observers: 0, contexts: 0 });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("部署地址直接访问、刷新、版本及无效实验", async ({ page, request }) => {
  for (const [id, canvas] of [
    ["cathode-ray", ".scope-scene canvas"],
    ["magnetic-field", ".magnetic-scene canvas"],
    ["electrostatic-field", ".electrostatic-scene canvas"],
  ]) {
    await page.goto(`/experiments/${id}`);
    await expect(page.locator(canvas)).toBeVisible();
    await page.reload();
    await expect(page.locator(canvas)).toBeVisible();
    await expect(page.locator(".stage-error")).toHaveCount(0);
  }
  await page.goto("/experiments/unknown");
  await expect(
    page.getByRole("heading", { name: "这个实验暂时不在目录中" }),
  ).toBeVisible();
  const response = await request.get("/version.json");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
    revision: expect.any(String),
    builtAt: expect.any(String),
  });
  expect((await request.get("/assets/missing.js")).status()).toBe(404);
});
