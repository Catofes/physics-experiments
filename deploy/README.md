# 物理实验室 · 静态交付包

此包已完成前端编译，`dist/` 是完整网站，不需要安装 Node.js。

如果可访问 GHCR，使用发布镜像：

```sh
docker compose pull
docker compose up -d --no-build
```

如果由本部门自行打包镜像：

```sh
docker compose build
docker compose up -d --no-build --pull never
```

构建只需获取 Caddy 基础镜像，不再下载 npm 依赖。访问 `http://服务器地址:8080`，访问 `/version.json` 查看版本与来源提交，访问 `/healthz` 检查服务状态。修改主机端口可在目录下创建 `.env`，写入 `PORT=8090`。

接收包后应先在解压前执行 `sha256sum -c SHA256SUMS`。完整的内网部署、离线导入、升级、回退及验收方法见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。源码编译方法见 [docs/BUILD.md](docs/BUILD.md)。
