# ---- Stage 1: 构建前端 ----
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY frontend/ ./frontend/
RUN npm run build

# ---- Stage 2: 生产运行环境 ----
FROM node:20-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# 只复制生产依赖所需的文件
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 复制后端源码和已构建的前端产物
COPY src/ ./src/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 复制空的 public 目录以兼容 express.static
COPY public/ ./public/

# 创建日志目录并赋予权限（以备启用文件日志时使用）
RUN mkdir -p logs && chown appuser:appgroup logs

# Docker 环境默认输出日志到 stdout/stderr
ENV LOG_FILE=false

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/index.js"]
