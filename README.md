# Minecraft Wiki API

一个用于抓取、解析并转换中文 Minecraft Wiki 内容的 REST API，支持 Docker 和 Vercel Serverless 部署。

## 功能特性

- **Web 控制台**：访问根路径 `/` 即可使用可视化的 API 测试控制台
- **MCP 服务器**：支持 Model Context Protocol，可直接接入 Claude Desktop 等 AI 工具
- **API Key 认证**：支持静态 API Key 认证，保护敏感端点
- **分布式速率限制**：支持 Upstash Redis 分布式限流，区分认证/未认证用户配额
- Wiki 搜索：`GET /api/search`
- 页面获取：`GET /api/page/:pageName`
- 页面源代码（Wikitext）：`format=wikitext`
- 批量获取：`POST /api/pages`
- 健康检查：`GET /health`、`GET /health/detailed`
- JSON 美化输出：查询参数 `pretty=true`

## 快速部署到 Vercel

### 方式一：一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rice-awa/minecraft-wiki-fetch-api&env=WIKI_BASE_URL,REQUEST_TIMEOUT,RATE_LIMIT_MAX&envDescription=API%20Configuration&envLink=https://github.com/rice-awa/minecraft-wiki-fetch-api/blob/main/.env.vercel)

### 方式二：CLI 部署

```bash
git clone https://github.com/rice-awa/minecraft-wiki-fetch-api.git
cd minecraft-wiki-fetch-api
npm install
npm install -g vercel
vercel login
npm run deploy
```

## Docker 部署

### 使用 docker compose（推荐）

```bash
git clone https://github.com/rice-awa/minecraft-wiki-fetch-api.git
cd minecraft-wiki-fetch-api
docker compose up -d
```

服务默认监听：
- `http://localhost:3000` — REST API + Web 控制台
- `http://localhost:3001/mcp` — MCP 服务器

```bash
# 自定义端口
PORT=8080 docker compose up -d

# 或创建 .env 文件
echo "PORT=8080" > .env
docker compose up -d
```

### 使用 Docker 命令

```bash
docker build -t minecraft-wiki-api .
docker run -d -p 3000:3000 --name mw-api minecraft-wiki-api
```

### Docker 环境变量

Docker 环境下，部分变量默认值有所调整以适应容器化场景：

| 变量名 | Docker 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 运行环境 |
| `LOG_FILE` | `false` | 容器内建议关闭文件日志，输出到 stdout |
| `RATE_LIMIT_STORE` | `memory` | 单机部署使用内存限流 |
| `AUTO_PORT` | `false` | 容器端口固定，无需自动选择 |

其余变量与下方环境变量表一致，通过 `docker compose` 的 `environment` 或 `docker run -e` 设置。

## 部署后验证

将 `https://your-project.vercel.app` 替换为实际域名（Vercel），或使用 `http://localhost:3000`（Docker 本地）。

**Web 控制台**：直接访问根路径 `/`

**API 测试**：

```bash
# Vercel
curl https://your-project.vercel.app/health
curl "https://your-project.vercel.app/api/search?q=钻石&limit=5&pretty=true"
curl "https://your-project.vercel.app/api/page/钻石?format=markdown&pretty=true"
curl "https://your-project.vercel.app/api/page/工作台?format=wikitext&pretty=true"

# Docker 本地
curl http://localhost:3000/health
curl "http://localhost:3000/api/search?q=钻石&limit=5&pretty=true"
curl "http://localhost:3000/api/page/钻石?format=markdown&pretty=true"
curl "http://localhost:3000/api/page/工作台?format=wikitext&pretty=true"
```

## 环境变量（Vercel）

推荐至少配置以下变量：

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 运行环境 |
| `WIKI_BASE_URL` | `https://zh.minecraft.wiki` | Wiki 源站 |
| `REQUEST_TIMEOUT` | `15000` | 外部请求超时（毫秒） |
| `MAX_RETRIES` | `2` | 外部请求重试次数 |
| `RATE_LIMIT_ANONYMOUS` | `30` | 未认证用户每分钟请求数 |
| `RATE_LIMIT_AUTHENTICATED` | `100` | 认证用户每分钟请求数 |
| `RATE_LIMIT_STORE` | `upstash` | 限流存储方式 |
| `UPSTASH_REDIS_REST_URL` | - | Upstash Redis URL（分布式限流必需） |
| `UPSTASH_REDIS_REST_TOKEN` | - | Upstash Redis Token |
| `API_KEY` | - | API 密钥（支持多个，逗号分隔） |
| `SEARCH_MAX_LIMIT` | `30` | 搜索最大条数 |
| `ALLOWED_ORIGINS` | `*` | CORS 白名单（逗号分隔） |
| `LOG_FILE` | `false` | Serverless 建议关闭文件日志 |

完整示例见：`./.env.vercel`

### API Key 认证

设置 `API_KEY` 环境变量启用认证：

```bash
# Vercel CLI
vercel env add API_KEY --env production

# 或在 Vercel Dashboard 中设置
```

**使用方式**：

```bash
# 方式一：请求头
curl -H "X-API-Key: your-api-key" https://your-api.vercel.app/api/pages

# 方式二：查询参数
curl "https://your-api.vercel.app/api/pages?api_key=your-api-key"
```

**端点保护规则**：

| 端点 | 访问级别 | 说明 |
| --- | --- | --- |
| `/health/*` | 公开 | 无需认证，无限流 |
| `/api/search` | 公开 | 无需认证，低限流 |
| `/api/page/:name` | 公开 | 无需认证，低限流 |
| `/api/pages` (POST) | **需认证** | 批量获取，高限流 |
| `/api/page/:name/cache` (DELETE) | **需认证** | 清除缓存 |

### 速率限制

未配置 Upstash 时自动降级到内存存储（本地开发友好）。

**配置项**：
- `RATE_LIMIT_ANONYMOUS=30` - 未认证用户配额
- `RATE_LIMIT_AUTHENTICATED=100` - 认证用户配额
- `RATE_LIMIT_WINDOW=60000` - 时间窗口（毫秒）

## API 概览

### `GET /api/search`

参数：

- `q`（必填）：关键词
- `limit`（可选）：结果数量，默认 `10`，最大 `50`
- `pretty`（可选）：`true/false`

### `GET /api/page/:pageName`

参数：

- `format`（可选）：`html` / `markdown` / `both` / `wikitext`
- `pretty`（可选）：`true/false`

### `POST /api/pages`

```json
{
  "pages": ["钻石", "铁锭"],
  "format": "markdown",
  "concurrency": 2
}
```

**format 可选值**：`html` / `markdown` / `both` / `wikitext`

### 健康检查

- `GET /health`
- `GET /health/detailed`
- `GET /health/ready`
- `GET /health/live`

## MCP 服务器

MCP（Model Context Protocol）服务器可以让 AI 工具（如 Claude Desktop）直接搜索和获取 Wiki 内容。

### Docker 部署（已包含在 compose 中）

```bash
docker compose up -d
# API: http://localhost:3000
# MCP: http://localhost:3001/mcp
```

### 本地运行

```bash
cd mcp-server
python3 -m venv .venv && source .venv/bin/activate
pip install mcp httpx
python server.py
```

### 接入 AI 工具

MCP 服务器使用 **Streamable HTTP** 传输协议。任何支持 MCP 的客户端通过以下地址接入：

```
http://localhost:3001/mcp
```

示例（Claude Code）：

```bash
# 全局生效，所有项目可用
claude mcp add --scope user --transport http zh-minecraft-wiki http://localhost:3001/mcp

# 仅当前项目生效
claude mcp add --transport http zh-minecraft-wiki http://localhost:3001/mcp
```

### 可用工具

| 工具 | 用途 |
|---|---|
| `search_wiki(q, limit, namespaces)` | 搜索 Wiki 页面，`namespaces` 可限定数字ID |
| `get_page(pageName, format, useCache, includeMetadata)` | 获取页面，`format`：`wikitext`（默认，最完整）、`html` |
| `check_page_exists(pageName)` | 检查页面是否存在 |
| `check_health()` | 检查 API 服务健康状态 |
| `list_namespaces()` | 获取命名空间映射表（数字ID → 名称） |

## 本地开发

```bash
npm install
npm run dev
```

或使用 Docker：

```bash
docker compose up -d
```

本地模拟 Serverless：

```bash
npm run dev:serverless
npm run test:serverless
```

## Vercel 适配说明

项目当前使用 `api/index.js` 作为 serverless 入口，配合 `vercel.json` 路由转发，支持：

- **根路径 `/`**：返回 `frontend/` 下 Vue + Vite 构建出的 Web 控制台
- API 路径 `/api` 与 `/api/*`
- 健康检查 `/health` 与 `/health/*`

前端开发命令：

```bash
npm run frontend:dev
npm run build
```

## 常见问题

### 1. 部署后访问 `/health` 返回 404

确认项目根目录的 `vercel.json` 已随代码部署，并且路由规则包含 `/health` 与 `/health/*`。

### 2. 请求超时

优先检查：

- `REQUEST_TIMEOUT` 是否过大
- 单次批量请求 `pages` 数量是否过多
- 是否触发了上游 Wiki 网络波动

### 3. CORS 报错

请在 Vercel 环境变量中正确设置 `ALLOWED_ORIGINS`，多个域名用逗号分隔。

### 4. 批量获取返回 401 未认证

`POST /api/pages` 端点需要有效的 API Key。请设置 `API_KEY` 环境变量，并在请求中通过 `X-API-Key` 请求头或 `api_key` 查询参数传递。

### 5. 速率限制返回 429

请求过于频繁，请检查响应头中的 `X-RateLimit-Reset` 了解限制重置时间。认证用户享有更高配额。

### 6. Docker 容器无法启动

检查容器日志定位问题：

```bash
docker compose logs
```

常见原因：
- 端口被占用：修改 `PORT` 环境变量
- 文件权限问题：Dockerfile 已内置处理，如仍有问题请提 issue

### 7. Upstash 配置

1. 访问 [Upstash Console](https://console.upstash.io) 创建 Redis 实例
2. 复制 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`
3. 在 Vercel 环境变量中添加这两个值

## 相关文档
- [部署详解](./deploy-vercel.md)
- [API 说明](./docs/API_DOCUMENTATION.md)
- [环境变量](./docs/environment-variables-guide.md)

## 许可证

- 项目代码：`MIT`（见 `./LICENSE`）
- Wiki 内容版权：遵循中文 Minecraft Wiki 所声明的许可条款
