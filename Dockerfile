# ===== 构建阶段 =====
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷贝依赖描述文件，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并构建
COPY . .
RUN npm run build

# ===== 运行阶段 =====
FROM nginx:1.27-alpine

# Nginx 配置模板（容器启动时通过 envsubst 渲染环境变量）
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 默认后端地址（可被 compose 覆盖）
ENV BACKEND_HOST=192.168.1.100
ENV BACKEND_PORT=8000

EXPOSE 80
