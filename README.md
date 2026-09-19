# 物理实验室

面向高中物理课堂的 Vue 静态网站。现有「深蹲跳物理模型」和「示波管原理」已拆为项目内的实验模块，共用网站导航、演示布局和控件。

交给其他部门时，从 [编译与交付说明](docs/BUILD.md) 开始；部署方参考 [部署与回退](docs/DEPLOYMENT.md)，维护者参考 [版本与 GitHub 发布](docs/RELEASING.md)。文档目录见 [docs/README.md](docs/README.md)。

当前版本为 **0.1.2**，统一读取 `package.json`。首页页脚和 `/version.json` 可查看构建版本；发布包见 [GitHub Releases](https://github.com/Catofes/physics-experiments/releases)。

## 项目组织

- **Vue 负责界面与状态**：目录、分类、搜索、返回、全屏、暂停、重置、参数及读数。
- **实验模块负责模型和画面**：纯 JavaScript 计算，Canvas / Three.js 绘图，不查询页面控件、不注册全局操作函数。
- **公共组件负责一致性**：`ExperimentLayout.vue` 提供演示画布、播放工具栏、观察记录、参数区和操作提示；`RangeControl.vue`、`ChoiceControl.vue` 提供统一滑块和选项。
- **Vue Router 负责导航**：实验地址为 `/experiments/squat-jump`、`/experiments/cathode-ray`；浏览器前进、后退和页面返回均在应用内完成，保留目录搜索与分类条件。
- **生命周期由实验组件管理**：进入时创建绘图实例，退出时取消动画、断开尺寸观察、销毁 Three.js 的材质、纹理、几何体和 WebGL 上下文。暂停示波管时仍可旋转观察。
- **构建产物仍为纯静态文件**：Vite 构建，Caddy 提供服务，无后端和数据库；Three.js 随资源打包，不使用运行时外部 CDN。打开网站仍需要能够访问部署服务器，示波管需要 WebGL 2。

`share/` 仅保存原始参考文件，不参与发布。原先的独立实验 HTML、iframe 入口、Tailwind CDN 及旧页面脚本已移除。物理模型沿用示例，本次重构侧重界面整合和运行生命周期；深蹲跳采用示意单位，时间推进已按实际帧间隔计算。

## 本地开发

Node.js 22.12+，推荐 24：

```sh
npm ci
npm run dev
```

打开终端显示的地址，默认 `http://localhost:5173`。

```sh
npm test
npm run build
npm run preview
```

`npm test` 检查目录模块登记、模型轨迹及关键物理关系；`npm run build` 先运行测试，再构建到 `dist/`。预览默认 `http://localhost:4173`。

## Docker 部署与更新

```sh
docker compose up -d --build
```

访问 `http://服务器地址:8080`。容器内 Caddy 监听 `8080`，健康检查为 `/healthz`。如需修改主机端口：

```sh
PORT=8090 docker compose up -d --build
```

修改代码或内容后重新执行上述构建命令即可。也可直接构建运行：

```sh
docker build -t physics-experiments:local .
docker run -d --name physics-experiments --restart unless-stopped -p 8080:8080 physics-experiments:local
```

如只更新静态内容，可在开发机执行 `npm ci && npm run build`，将完整 `dist/` 上传服务器，配合仓库中的 Caddyfile 挂载：

```sh
docker run -d --name physics-experiments-static --restart unless-stopped \
  -p 8080:8080 \
  -v "$PWD/dist:/srv:ro" \
  -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine
```

部署方式二选一。更新时整体替换构建产物，并刷新课堂浏览器。Caddy 已为 `/experiments/*` 配置入口回退，直接打开或刷新实验链接均可用；缺失的 `/assets/*` 资源保持 404。

## 自动编译与发布

运行 `npm run package` 生成带部署配置和 SHA-256 校验码的交付包，输出到 `release/`。先执行 `npx playwright install --with-deps chromium`，再执行 `npm run test:e2e`，即可检查桌面和手机交互。

Pull Request、主分支更新和手动运行 Actions 会编译并验证可下载的静态交付包。推送与项目版本一致的 `vX.Y.Z` 标签时，还会发布 GHCR 双架构镜像，再创建包含交付包和校验码的 GitHub Release。发布不会自动部署到服务器。

工作流见 [.github/workflows/build-release.yml](.github/workflows/build-release.yml)。首次使用需提交并推送项目到 GitHub、启用 Actions；详细步骤见 [版本与 GitHub 发布](docs/RELEASING.md)。

## 新增实验

1. 新建 `src/experiments/英文标识/Experiment.vue`，使用公共 `ExperimentLayout`、`RangeControl`、`ChoiceControl` 组件。参考现有深蹲跳模块。
2. 将物理计算放入 `physics.js`，绘图与动画放入本实验的 `simulation.js` 或 `scene.js`。绘图实例通过参数接收 DOM 元素，通过回调传出读数。
3. 在组件 `onMounted` 中创建实例，`onUnmounted` 中调用 `dispose()`。接好布局的 `toggle`、`reset`、`hide` 事件，分别处理播放切换、恢复初始状态和页面切到后台时暂停。
4. 在 `src/experiments.json` 中登记标题、分类和知识点。例如：

```json
{
  "id": "pendulum",
  "title": "单摆周期",
  "category": "力学",
  "description": "改变摆长，观察周期的变化。",
  "tags": ["单摆", "周期"],
  "hint": "拖动摆球后释放，比较不同摆长下的振动。"
}
```

5. 可选：添加 `src/covers/pendulum.svg` 作为目录图，没有时使用通用插画。
6. 构建并检查：手机布局、暂停与恢复、重置、返回目录、浏览器后退，以及反复进入后的资源清理。

英文标识使用小写英文、数字和连字符，且不重复。组件会根据文件夹自动发现并按需加载，不必修改路由或手动注册。给 `share/` 添加参考 HTML 后，需要将其中的模型与绘图拆入上述模块，而不是直接挂载原网页。

## 目录

```text
src/
  App.vue                     应用入口
  main.js                     Vue 与路由
  Catalog.vue                 实验目录、搜索、分类
  experiments.json            实验元信息
  components/
    ExperimentLayout.vue      全站统一演示布局与导航
    RangeControl.vue          公共滑块
    ChoiceControl.vue         公共选项按钮
  experiments/
    squat-jump/
      Experiment.vue          状态、控件与生命周期
      physics.js              纯物理计算
      simulation.js           Canvas 绘制与动画
    cathode-ray/
      Experiment.vue          状态、控件与生命周期
      physics.js              电压与轨迹计算
      scene.js                Three.js 场景与动画
      monitor.js              电压波形绘图
  views/                      实验加载、无效链接页面
  site.css                    首页与公共视觉
  lab.css                     统一实验布局及控件样式
  covers/                     目录插画
share/                        原始参考，不发布
public/                       图标等静态资源
tests/physics.test.js         模型与目录检查
Dockerfile / Caddyfile         静态镜像与服务配置
compose.yaml                  容器启动配置
```

技术依据：[Vue 生命周期](https://vuejs.org/api/composition-api-lifecycle)、[Vue Router HTML5 路由](https://router.vuejs.org/guide/essentials/history-mode)。
