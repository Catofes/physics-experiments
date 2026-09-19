# 用已编译的交付包构建镜像，不需要 Node.js 或 npm。
FROM caddy:2-alpine AS caddy-runtime

# 复用官方运行文件，不继承其 80/443/2019 端口声明。
FROM scratch
COPY --from=caddy-runtime / /
ENV XDG_CONFIG_HOME=/config XDG_DATA_HOME=/data
WORKDIR /srv
LABEL org.opencontainers.image.title="物理实验室" \
      org.opencontainers.image.description="高中物理课堂交互实验"
COPY Caddyfile /etc/caddy/Caddyfile
COPY dist /srv
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
