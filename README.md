# 物理实验室

面向高中物理课堂的 Vue 静态网站，共十八个站内实验，共用网站导航、演示布局和控件。按教学内容整理如下：

| 分类 | 实验 |
| --- | --- |
| 测量 | 游标卡尺、螺旋测微器 |
| 力学 | 深蹲跳物理模型、竖直圆周运动与分离 |
| 电路 | 测量电源电动势和内阻、电阻 24 点、滑动变阻器：分压与限流、电表改装 |
| 静电场 | 示波管原理、李萨如图形、静电场可视化实验室 |
| 静磁场 | 磁场可视化实验室 |
| 万有引力 | 牛顿大炮、卫星变轨实操、地月卫星变轨、卫星星下点轨迹、地月绕日轨迹、嫦娥六号地心轨迹 |

模型来源与精度说明见 [电磁场实验来源](docs/SOURCES.md) 和 [航天实验来源与模型说明](docs/ORBIT-SOURCES.md)。

交给其他部门时，从 [编译与交付说明](docs/BUILD.md) 开始；部署方参考 [部署与回退](docs/DEPLOYMENT.md)，维护者参考 [版本与 GitHub 发布](docs/RELEASING.md)。文档目录见 [docs/README.md](docs/README.md)。

当前版本为 **0.9.0**，统一读取 `package.json`。首页页脚和 `/version.json` 可查看构建版本；发布包见 [GitHub Releases](https://github.com/Catofes/physics-experiments/releases)。

## 项目组织

- **Vue 负责界面与状态**：目录、分类、搜索、返回、全屏、暂停、重置、参数及读数。
- **实验模块负责模型和画面**：纯 JavaScript 计算，Canvas / Three.js 绘图，不查询页面控件、不注册全局操作函数。
- **公共组件负责一致性**：`ExperimentLayout.vue` 提供演示画布、播放工具栏、观察记录、参数区和操作提示；`RangeControl.vue`、`ChoiceControl.vue` 提供统一滑块和选项。
- **Vue Router 负责导航**：实验地址为 `/experiments/squat-jump`、`/experiments/cathode-ray`、`/experiments/lissajous`、`/experiments/magnetic-field`、`/experiments/electrostatic-field`、`/experiments/resistance-24`、`/experiments/rheostat`、`/experiments/meter-conversion`；浏览器前进、后退和页面返回均在应用内完成，保留目录搜索与分类条件。
- **生命周期由实验组件管理**：进入时创建绘图实例，退出时取消动画、断开尺寸观察、销毁 Three.js 的材质、纹理、几何体和 WebGL 上下文。暂停示波管时仍可旋转观察。
- **构建产物仍为纯静态文件**：Vite 构建，Caddy 提供服务，无后端和数据库；Three.js 随资源打包，不使用运行时外部 CDN。打开网站仍需要能够访问部署服务器，示波管和磁场实验需要 WebGL 2，磁场后台计算需要 Web Worker。

`share/` 仅保存原始参考文件，不参与发布。原先的独立实验 HTML、iframe 入口、Tailwind CDN 及旧页面脚本已移除。物理模型沿用示例，本次重构侧重界面整合和运行生命周期；深蹲跳采用示意单位，时间推进已按实际帧间隔计算。

## 本地开发

Node.js 22.12+，推荐 24：

```sh
npm ci
make dev
```

`npm ci` 只需首次启动或依赖变更后执行。日常运行 `make dev` 即可启动支持热更新的测试用开发服务，按 `Ctrl+C` 停止。

本机打开 `http://localhost:5173`；远端浏览器打开 `http://开发机地址:5173`（开发机需允许访问该端口）。通过 VS Code Remote SSH 开发时，也可在「端口」面板转发 5173，再打开转发后的地址。服务监听 `0.0.0.0`，端口被占用会直接报错；需要换端口时运行 `make dev PORT=5174`。

对已启动的开发服务运行浏览器自动检测：

```sh
# 首次使用安装测试浏览器
npx playwright install --with-deps chromium
BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

从另一台机器执行检测时，将 `BASE_URL` 换成可访问的开发机地址；运行检测的机器需要有本项目代码和测试依赖。

各实验的滑块可直接拖动。单击右侧数值可用键盘输入；双击数值或点击旁边的数字按键板按钮，可在弹出的按键板上输入。键盘输入按回车或离开输入框确认，Esc 取消；超出范围的值会取最近的边界值。

示波管实验支持 0.1–1000 Hz 的信号与扫描频率。使用「低频光点」「高频成线」可对比光点运动和余晖形成的连续轨迹；「高频扫描波形」同时开启同步 X 扫描。频率滑块按倍数调节，高频电压图自动使用毫秒窗口。荧光屏采用帧间轨迹采样和余晖衰减，是教学用的视觉近似；管内电子束表示当前时刻的偏转。

```sh
npm test
npm run build
npm run preview
```

`npm test` 检查目录模块登记、模型轨迹及关键物理关系；`npm run build` 先运行测试，再构建到 `dist/`。预览默认 `http://localhost:4173`。

## 长度测量

游标卡尺入口为 `/experiments/vernier-caliper`。提供示意图与三维模型，可旋转、缩放、切换正面读数和测量面近景，直接拖动游标尺或用参数区调节。游标尺采用前后压板与上下导槽包住尺身，连接块避让固定量爪根部，下部前后压板的前缘与活动外测量爪齐平，正面的主尺刻度窗口完整露出。游标刻度带采用斜面，上缘与主尺刻度面同层，下缘连接前压板；三维正面读数采用正投影，避免厚度造成透视错位。两种视图共用量爪轮廓与测量状态：卡口侧测量边连续，刀口在厚度方向从爪身向测量刃磨薄，内测爪前后错层，活动爪根部接到前压板，不把表面反光画成凹槽或凸起；主尺、游标尺零线保留相同的安装偏移，量爪闭合时零线对齐；内外测量面的间距、游标尺位移和深度杆伸出量一致。部件标注对应课本图 11.3-1 的 A 主尺、B 游标尺、C 外测量爪、D 内测量爪、E 尺身、F 紧固螺钉。下方只保留一张刻度放大图，主尺只在 0、10、20 等整十毫米处标数字。可切换 10、20、50 分度，对应 0.1、0.05、0.02 mm；统一采用课本短游标结构，分别占 9、19、49 mm，20 分度每格 0.95 mm，游标数字直接标线号。支持自动对齐演示、轻合量爪和隐藏答案练习。

螺旋测微器入口为 `/experiments/micrometer`。同样提供示意图和三维模型；旋钮、可动刻度转动角度与螺杆位移按螺距联动。固定刻度零线位于安装座右侧的套筒上，示意图与三维图采用相同零点和位移比例。部件标注对应课本图 11.3-4 的 A 测砧、B 固定刻度、C 尺架、D 旋钮、D′ 微调旋钮、E 可动刻度、F 测微螺杆、G 锁紧装置。局部放大显示整数与半毫米刻度、基准线和圆周刻度，提供半毫米前后、整毫米前和估读预设。螺距 0.5 mm，一圈 50 格，最小分度 0.01 mm；最后一位估读到 0.001 mm，读数练习允许 ±0.002 mm 的估读差异。两种仪器均为无零误差的外尺寸教学模型，不模拟测力、形变或校准误差。三维视图需要 WebGL；加载失败时可切回示意图。

结构与读数依据：用户提供的人教版《物理 必修第三册》第十一章第 3 节，图 11.3-1～11.3-5（PDF 第 67～69 页，书内页码 62～64）；外形参考维基百科的[游标卡尺示意图与照片](https://zh.wikipedia.org/wiki/游标卡尺)、[测微器示意图](https://commons.wikimedia.org/wiki/File:Micrometer.svg)、[Sketchfab 游标卡尺模型](https://sketchfab.com/3d-models/10-3551e0a0834542499b0e4a89e0f6967a)及用户提供的仪器实物照片；几何与操作参考 [Mahesh Kurmi 游标卡尺模型](https://maheshkurmi.github.io/experiments/vernier_calliper.html)。本站使用自绘 SVG 与 Three.js 模型，参考网站的图像与代码未打包引入。游标结构差异及视差参考[三丰技术指南](https://www.mitutoyo.com/webfoo/wp-content/uploads/E11003-Quick-Guide.pdf)和[三丰游标卡尺读数说明](https://www.mitutoyo.com/metrology-insights/mitutoyo-calipers-digital-dial-and-vernier-calipers-precision-measurement-tools-for-manufacturing/)；斜面刻度参考[三丰 2017–2019 产品目录第 180 页](https://rgcengineering.co.za/wp-content/uploads/2020/12/2017-2019-Mitutoyo-catalogue.pdf#page=180)。19 mm 与 39 mm 型均可提供 0.05 mm 分度，本教学模型采用前者。

## 竖直圆周运动与分离

入口为 `/experiments/vertical-circle`。质点从光滑圆轨道内侧最低点出发，比较低速折返、途中分离、临界过顶与完整绕行。参数 q = v₀²/(gr)：q ≤ 2 时先折返；2 < q < 5 时支持力降为零后分离；q ≥ 5 时完整绕行，最高点临界速度为 √(gr)。g 固定为 9.8 m/s²。

初速度直接用 m/s 调节，四种预设标明对应的根式。符号与公式统一用 LaTeX 排版；界面显示重力、指向圆心的支持力和切向速度，并用全程固定刻度的同尺度箭头对照所需向心力、重力径向分量与支持力（指向圆心为正）。向心力不是额外的力，分离时支持力为零而重力仍存在。分离瞬间可自动暂停，支持慢放、时间拖动及直接定位关键时刻。分离后采用只受重力的解析抛体轨迹，再次接触轨道时停止，不模拟碰撞。圆周阶段采用 RK4 积分并定位分离事件；测试覆盖能量守恒、临界折返、分离角、切向连续性及再次接触。

## 测量电源电动势和内阻

入口为 `/experiments/emf-internal-resistance`。自绘电路图展示限流接法（变阻器 A—P 串联、B 悬空），可切换电流表相对被测电源的内、外接位置。页面侧重原理演示，电路始终接通，无开关操作。调节电阻并记录读数，或一键采集六组；固定以电流 I 为横轴、电压 U 为纵轴，显示两轴截距外推，比较斜率、截距及测量点到真实点的偏移。

电源内阻支持 0.2～5000 Ω，使用对数滑块并保留精确输入。水果电池情境采用示例值 E = 1.0 V、r = 500 Ω；负载调节范围随内阻匹配，六组自动采样使用相同范围，卡片、表格、电路与横坐标统一切换 A / mA / μA。内阻计算仍用 SI 单位；横轴以 mA、μA 显示时，明确给出斜率到 Ω 的 1000、10⁶ 倍换算，拟合方程带坐标单位。水果电池内阻依材料和电极条件而变，此处采用固定 E、r 的线性近似；高内阻教学参考 [expEYES 柠檬电池实验](https://expeyes.freeduc.info/Documents/eyesj-a4.pdf)第 2.7 节。

两表可以同时具有内阻。外接时 `I源 = I + U/RV`，所以 `E测 = E·RV/(RV+r)`、`r测 = r·RV/(RV+r)`；内接时 `U端 = U + I·RA`，所以 `E测 = E`、`r测 = r+RA`。用已知表内阻逐点修正后重新拟合，不读取真实 E、r。模型以基尔霍夫定律求解；仅研究系统误差，不叠加随机读数误差与量程过载，拟合使用未舍入数值。放大分流／分压情境有意采用较低 RV／较高 RA。接法与误差分析参照《物理教学》2022 年第 8 期[“电池电动势和内阻的测量”系统误差分析方法评析与创新](https://wljx.ecnu.edu.cn/assets/userfiles/PDF/131787_20220822160121.pdf)，内外接均以电源为参照。

## 航天与轨道实验

`share/网页.rar` 的六个实验已改为站内模块：牛顿大炮（`newton-cannon`）、卫星变轨实操（`satellite-orbit`）、地月卫星变轨（`earth-moon-transfer`）、同步卫星星下点轨迹（`geosynchronous`）、地月绕日轨迹（`earth-moon-sun`）、嫦娥六号地心轨迹（`change6-orbit`）。地址统一为 `/experiments/<id>`。

保留轨道对照、切向脉冲、圆化辅助、参考系叠加与实验档案回放。两个变轨实验使用本站浅色布局，关键读数与轨道画面相邻，主要操作集中在参数卡片上方，次要物理量和模型说明可展开，按“暂停模拟 → 在固定位置精调速度 → 继续模拟”操作，运行中禁止变轨。支持 1–250 m/s 步长、暂停内精调合并记录、变轨前后轨道对照，以及 Space 暂停／继续和方向键调速。嫦娥六号页面是原素材的理想化环月教学模型，不是实际任务轨迹；地月模型中的暂时束缚不等于长期捕获。整合范围、档案兼容与验证见 [航天实验说明](docs/ORBIT-SOURCES.md)。

## 电阻 24 点

入口为 `/experiments/resistance-24`。每题用完给出的 3～4 个电阻，通过串联、并联合并，组成等效电阻为 24 Ω 的电路。选中两个元件或组合后操作，可撤销、重来、切题并查看计算过程、分步提示和参考电路图。

题库包含入门、进阶、挑战各 4 题；所有题目都需要串并联混合，挑战题必须使用嵌套连接。阻值采用精确分数运算。独立完成进度仅保留在当前页面会话，查看过提示或参考解的题目不计入独立完成。题库与计算模型位于 `src/experiments/resistance-24/model.js`，自动测试枚举所有串并联拓扑验证有解及难度约束。

## 电表改装

入口为 `/experiments/meter-conversion`。通过“上一步／下一步”依次完成明确任务、计算电阻、接入电阻、更新刻度、验证读数。默认将 100 Ω、1 mA 表头改装成 0～0.6 A 电流表，逐步推导并联分流电阻 R = 100 / 599 Ω ≈ 0.167 Ω。接入电阻后明确显示分流结果，更新表盘前仍保留 0～1 mA 刻度。电流表展示并联分流，电压表展示串联电流与分压；欧姆表先短接调零，再观察待测电阻与指针的非线性关系。模型采用满偏电流 1 mA、内阻 100 Ω 的表头和理想电源，忽略导线及电池内阻。

单量程验证后可继续扩程：双量程电压表以第一次改造的 3 V 电压表（100 Ω 表头与 2900 Ω 电阻串联）为基础，保留 3 V 抽头，再串联 12 kΩ 电阻并引出 15 V 接点，两挡满偏电流均为 1 mA；电流表采用分段分流电阻与中间抽头：原 100/599 Ω 拆为左段 R₁ = 20/599 Ω、右段 R₂ = 80/599 Ω。黑表笔接左侧公共端 COM，红表笔接右端时为 G ∥ (R₁ + R₂)，量程 0.6 A；红表笔接中间抽头时为 (G + R₂) ∥ R₁，量程 3 A。两段电阻均参与工作，R₂ 在两挡中电流方向相反。新增步骤包含计算、接线、双刻度及换挡验证，切换量程保持输入不变，并提示超量程。欧姆表支持 ×10、×100、×1000 倍率，通过改变电池电压或表头满偏电流演示 R中 = E / Ig，换挡后必须重新短接调零；实际多用表还可切换分流网络来改变等效满偏电流，不要求更换实体表头。

## 滑动变阻器：分压与限流

入口为 `/experiments/rheostat`。同时展示 Three.js 三维桌面实验装置与电路图，宽屏时两图并排、窄屏时上下排列。桌面上有四接线柱滑动变阻器、直流电源、指针电流表与电压表、陶瓷负载电阻和接线；电源置于后方、滑动变阻器置于前方，两只电表集中在右侧负载附近。分压时电源两端直接连接 A、B，另从 C、B 引出负载支路，实物金属杆上的 C、D 连接滑片 P，本图使用 C 接线；限流接法用 A、P 与负载串联，B 悬空；分压接法将 A、B 接到电源两端，负载接 P、B。负载串联电流表、并联电压表。拖动滑片或自动演示时，三维滑片、仪表指针与读数、电路图及顶部负载电压调节曲线同步更新。支持直接拖动三维滑柄、旋转视角、滚轮或双指缩放、变阻器近景、俯视接线和恢复视角；电表采用楔形黑色侧壳、后倾表盘、透明方罩、白色双量程刻度和三接线柱底座；电流表刻度为 0.6/3 A，电压表为 3/15 V，接高量程端。参数超出表盘范围时，仿真显示量程倍率并同步换算指针。负载电压曲线铺满可用宽度，高度为 320 像素。右侧可调电源电压、变阻器总电阻及负载电阻，并列出两种接法的适用情况。

曲线使用含负载的理想直流电路模型。位置从 B 到 A 定义为 0%～100%；限流时接入电阻为 A–P 段，分压时 P–B 段与负载并联。电流表、电压表均为理想电表；计算忽略电源内阻、接触电阻及导线电阻。

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

桌面和手机浏览器测试在两个独立作业中并行运行，使用同一份交付包分别启动容器，每个作业内仍使用一个 worker。默认 CI 和标签发布排除标为 `@3d` 的 Three.js/WebGL 用例，保留全部模型单测、2D/SVG 交互、部署地址刷新、版本和静态资源边界检查。默认浏览器检查全部通过后才发布镜像和 GitHub Release。

复杂三维交互、截图和资源清理测试仍保留：本地 `npm run test:e2e` 运行完整套件，`npm run test:e2e -- --grep-invert @3d` 运行与默认 CI 相同的范围。在 Actions 的 **Run workflow** 中勾选 **Include WebGL / 3D browser tests**（`full_e2e`）可手动运行完整 E2E。默认 CI 通过不代表三维浏览器交互已经验收。

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
    magnetic-field/           七种磁场、Three.js 绘图与后台计算
    electrostatic-field/      七种静电场、边界元模型与 Canvas 绘图
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
