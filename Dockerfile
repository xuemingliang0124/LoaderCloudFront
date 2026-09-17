# ===== 构建阶段 =====
# 基础镜像用 DaoCloud 公共镜像源（免登录、国内速度快、与 Docker Hub 官方镜像同步）
# 切换镜像源时直接改这两行：
#   - ACR 私有：registry.cn-beijing.aliyuncs.com/xml066/node:20-alpine
#   - Docker Hub：node:20-alpine（需在 daemon.json 配镜像加速）
FROM docker.m.daocloud.io/library/node:20-alpine AS builder
WORKDIR /app

# 先拷贝依赖描述文件，利用 Docker 层缓存
COPY package.json package-lock.json ./
# --no-audit / --no-fund 跳过安全审计与资金提示，减少日志噪音、略微提速
RUN npm ci --no-audit --no-fund

# 拷贝源码并构建
COPY . .
RUN npm run build

# ===== 运行阶段 =====
FROM docker.m.daocloud.io/library/nginx:1.27-alpine

# Nginx 配置模板（容器启动时通过 envsubst 渲染环境变量）
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 默认后端地址（可被 compose 覆盖）
ENV BACKEND_HOST=192.168.1.100
ENV BACKEND_PORT=8000

EXPOSE 80
