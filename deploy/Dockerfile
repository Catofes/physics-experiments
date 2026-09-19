# 用已编译的交付包构建镜像，不需要 Node.js 或 npm。
FROM caddy:2-alpine
LABEL org.opencontainers.image.title="物理实验室" \
      org.opencontainers.image.description="高中物理课堂交互实验"
COPY Caddyfile /etc/caddy/Caddyfile
COPY dist /srv
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
