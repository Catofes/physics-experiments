# 编译与交付说明

适用对象：接收源码、代编译镜像或代打包静态网站的部门。项目是 Vue + Vite 前端，没有后端程序、数据库或运行时密钥。

## 环境与输入

- 推荐 Linux 或 WSL，Node.js 24（见 `.nvmrc`）、npm、Git；打包另需 `tar`。
- 构建镜像需要 Docker；用 `docker compose` 时需 Compose v2。
- 源码应来自明确的 Git 提交或 `vX.Y.Z` 标签。源码压缩包没有 `.git` 时，可由交付方提供 `BUILD_REVISION`。
- npm 依赖由 `package-lock.json` 锁定，使用 `npm ci`。
- 首次构建需要能访问 npm 与 Docker 镜像源；生成的网站只访问自己的服务器。

## 方式一：只用 Docker 编译

在源码根目录执行：

```sh
docker build --build-arg BUILD_REVISION="$(git rev-parse HEAD)" -t physics-experiments:local .
docker run -d --name physics-experiments --restart unless-stopped -p 8080:8080 physics-experiments:local
```

Docker 构建阶段安装依赖、验证版本、运行模型测试并构建前端。最终镜像只有 Caddy 和静态文件，不包含 Node.js、源码或 `share/`。

如果从无 Git 信息的源码压缩包构建，可省略 `BUILD_REVISION`（记录为 `unknown`），或传入交付方提供的真实提交 SHA。不要填入其他版本的 SHA。

## 方式二：生成静态交付包

```sh
npm ci
npm run package
```

当前版本为 `0.1.1`，输出如下（后续版本自动改名）：

```text
dist/                               编译后的网站
dist/version.json                   版本、来源提交与时间信息
release/physics-experiments-0.1.1.tar.gz
release/SHA256SUMS
```

压缩包包含 `dist/`、Caddyfile、封装静态文件的 Dockerfile、固定版本镜像的 Compose 配置和部署文档。接收方可直接使用静态文件，也可无需 npm 地封装 Docker 镜像：

```sh
cd release
sha256sum -c SHA256SUMS
tar -xzf physics-experiments-0.1.1.tar.gz
cd physics-experiments-0.1.1
docker compose build
docker compose up -d --no-build --pull never
```

源码根目录的 Dockerfile 用于从源码编译；交付包中的 Dockerfile 用于封装已编译文件。Fork 仓库本地打包时可设置 `RELEASE_IMAGE=ghcr.io/部门/仓库`，镜像路径使用英文；GitHub 工作流自动采用当前仓库的小写路径。

## 浏览器验收

```sh
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

测试自动启动构建结果预览，覆盖桌面与手机尺寸的导航、暂停、重置、资源释放、直接地址和版本文件。测试已有容器时使用：

```sh
BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

NixOS 等环境可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定本机 Chromium。失败时查看 `playwright-report/` 和 `test-results/`。

## 交付记录

交付时同时提供版本号及 Git 提交、压缩包与 `SHA256SUMS`（或镜像地址与 digest）、构建测试结果、目标服务器架构，以及 [部署说明](DEPLOYMENT.md)。保留旧版本以便回退。

`version.json` 的时间优先采用来源提交的时间，便于关联同一来源；无 Git 信息时使用当前时间，或通过 `SOURCE_DATE_EPOCH` 提供 Unix 秒时间戳。它不代表部署时间。
