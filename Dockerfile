FROM --platform=$BUILDPLATFORM node:24-alpine AS build
ARG BUILD_REVISION=unknown
ARG SOURCE_DATE_EPOCH
ENV BUILD_REVISION=$BUILD_REVISION SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
LABEL org.opencontainers.image.title="物理实验室" \
      org.opencontainers.image.description="高中物理课堂交互实验"
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
