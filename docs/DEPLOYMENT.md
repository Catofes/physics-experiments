# 部署、升级与回退

容器默认端口为 `8080`，无数据库、持久化业务数据或配置密钥。正式镜像发布成功后支持 Linux amd64 与 arm64，Docker 会自动选择对应架构。

自 v0.1.1 起，镜像仅声明 `8080/tcp`，Caddy 管理接口和自动 HTTPS 均已关闭。更新镜像后需重新创建容器，端口列表才会同步更新；仅重启旧容器不会改变镜像的端口声明。

## 使用正式镜像

先在 [GitHub Releases](https://github.com/Catofes/physics-experiments/releases) 确认目标版本已经发布。以下以 `0.1.1` 为例。

使用源码仓库中的 `compose.production.yaml`，在同目录建立 `.env`：

```dotenv
IMAGE=ghcr.io/catofes/physics-experiments:0.1.1
PORT=8080
```

```sh
docker compose -f compose.production.yaml pull
docker compose -f compose.production.yaml up -d
docker compose -f compose.production.yaml ps
```

首次发布的 GHCR 包如果不是公开可见，需要管理员在 Package 设置中调整可见性，或使用具有 `read:packages` 权限的账户登录。具体权限由组织策略决定。

生产部署使用固定版本或 `镜像@sha256:...`。`latest` 跟随最近一次成功的标签发布，不适合作为回退版本记录。

## 使用静态交付包

把压缩包和校验文件放在同一目录：

```sh
sha256sum -c SHA256SUMS
tar -xzf physics-experiments-0.1.1.tar.gz
cd physics-experiments-0.1.1
docker compose build
docker compose up -d --no-build --pull never
```

这里不再编译前端，也不需要 Node.js；Docker 只把 `dist/` 放入 Caddy。需要基础镜像已缓存或能访问镜像源。

也可将 `dist/` 交给现有静态服务器。必须让 `/experiments/*` 回退到 `index.html`，否则直接打开或刷新实验链接会 404；缺失的 `/assets/*` 应保持 404，不应重写成 HTML。仓库的 Caddyfile 已实现此配置。

## 离线转交镜像

联网构建机上按 [BUILD.md](BUILD.md) 构建本地镜像，然后导出：

```sh
docker save physics-experiments:local | gzip > physics-experiments-image.tar.gz
sha256sum physics-experiments-image.tar.gz > physics-experiments-image.sha256
```

将两个文件交给部署方。目标机必须与镜像架构一致，arm64 机器应交付 arm64 镜像；静态网页包本身与 CPU 架构无关。

```sh
sha256sum -c physics-experiments-image.sha256
gzip -dc physics-experiments-image.tar.gz | docker load
docker run -d --name physics-experiments --restart unless-stopped -p 8080:8080 physics-experiments:local
```

## 验收与版本确认

```sh
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/version.json
```

应返回 `ok` 和包含 `version`、`revision`、`builtAt` 的 JSON。首页页脚也显示版本号。

打开目录与两个实验，检查直接刷新、暂停、重置、返回，以及三维绘制。浏览器自动测试通过后，仍应在课堂电脑或大屏上验收硬件加速与显示效果。

域名与 HTTPS 可由现有反向代理转发到容器 `8080`。当前站点按域名根路径部署，不支持直接放到 `/physics/` 等子路径。

## 升级与回退

先记录当前版本或 digest，修改 `.env` 中的 `IMAGE` 为新固定版本，再执行 `pull` 与 `up -d`。验收失败时改回旧镜像并重新执行相同命令，无数据库迁移。

静态包部署需保留上一版完整目录；回退时恢复原包并重建镜像。不要只覆盖 HTML 而保留不匹配的资源。部署后让课堂浏览器刷新页面。
