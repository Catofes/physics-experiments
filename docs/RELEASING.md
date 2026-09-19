# 版本与 GitHub 发布

参考本工作区 Attendance、aiclass 的标签发布方式：检查 → 静态交付包 → 容器和浏览器验证 → 双架构 GHCR 镜像 → GitHub Release。

## 版本约定

- `package.json` 为唯一版本来源，`package-lock.json` 必须同步，不额外维护 VERSION 文件。
- 当前准备的首版为 `0.1.0`。正式 Git 标签必须为 `vX.Y.Z`，例如 `v0.1.0`。
- 当前只接受三段稳定版本，不接受 `v1`、`v1.2` 或预发布后缀。
- 页脚、`dist/version.json`、交付包与镜像版本由这个版本号生成。
- 修复用 patch，兼容的新实验或功能用 minor，破坏兼容的变更用 major。已发布标签不移动，不用相同版本号发布不同代码。

## 发布步骤

首次发布沿用当前版本；以后用以下命令同步更新两个 package 文件，并更新 `CHANGELOG.md`、新增对应的 `docs/releases/vX.Y.Z.md`：

```sh
npm version 0.1.1 --no-git-tag-version
```

检查待发布代码：

```sh
npm ci
npm run package
npx playwright install --with-deps chromium
npm run test:e2e
git diff --check
```

提交完整源码、版本与说明文件，确认工作区干净，推送主分支并等待检查通过，再创建带注释标签：

```sh
git push origin main
version=$(node scripts/version.mjs)
git tag -a "v$version" -m "发布 v$version"
git push origin "v$version"
```

只推送确认的标签，不使用 `git push --tags`。工作流再次检查标签与项目版本是否一致、发布说明是否存在；不一致时在发布前终止。

## 工作流行为

| 触发方式               | 行为                                                        |
| ---------------------- | ----------------------------------------------------------- |
| Pull Request           | 版本与模型测试、编译打包、校验码、容器与桌面/手机浏览器检查 |
| `main` / `master` 更新 | 同上，保留可下载的 `release-assets`                         |
| 手动 Run workflow      | 编译与检查，可下载交付包，不创建正式 Release 或推送镜像     |
| 推送 `vX.Y.Z` 标签     | 检查通过后发布双架构镜像，再创建 GitHub Release             |

成功检查保留交付包 14 天；失败时保留浏览器报告 7 天。GitHub Release 附件用于长期交付，Actions artifact 用于测试和候选包。

编译部门可在 Actions → **Build And Release** → **Run workflow** 选择分支，完成后下载 `release-assets`。先解压 GitHub 下载的外层 ZIP，再在其中执行 `sha256sum -c SHA256SUMS`。

## 正式产物与权限

- Release 附件：`physics-experiments-X.Y.Z.tar.gz` 和 `SHA256SUMS`。
- GHCR 镜像：`ghcr.io/catofes/physics-experiments:X.Y.Z`、`:vX.Y.Z`、`:sha-完整提交SHA` 和 `:latest`。
- 平台：`linux/amd64`、`linux/arm64`。两种镜像封装同一份通过检查的静态文件，不重新编译前端。

检查任务仅有仓库读取权限；标签发布任务申请 `contents: write` 和 `packages: write`。使用 GitHub 自动提供的 `GITHUB_TOKEN`，无需另建个人密钥。首次使用要启用 Actions，并允许引用的 Actions 和 GHCR 写入；组织限制需管理员配置。建议将检查任务设为主分支合并条件。

Actions 使用经核实的提交 SHA 固定版本，Dependabot 每月提出依赖及 Actions 更新。升级应经过检查，不使用未验证的 `@main`。

## 发布完成的判定

1. 标签指向预期提交，Actions 的 `check` 与 `publish` 成功；
2. GitHub Release 页面存在，附件可下载，SHA-256 校验通过；
3. `docker buildx imagetools inspect ghcr.io/catofes/physics-experiments:X.Y.Z` 列出两个架构；
4. 如要求部署，目标机 `/version.json` 对应预期版本与提交，并完成课堂设备验收。

推送标签、发布镜像、创建 Release 与部署是不同状态。流程不自动重启教学服务器。镜像和 Release 不是同一个事务：若镜像成功而 Release 创建失败，修复权限后可重跑同一提交的任务；已完成的 Release 不应通过移动标签重做。补发旧版本也会更新 `latest`，因此正常按递增版本发布，生产环境固定版本或 digest。

官方参考：[发布 GHCR 镜像](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)、[GitHub 构建产物](https://docs.github.com/en/actions/tutorials/store-and-share-data)。
