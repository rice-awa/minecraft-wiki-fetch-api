# Minecraft Wiki API

一个用于抓取、解析并转换中文 Minecraft Wiki 内容的 REST API，已适配 Vercel Serverless 部署。

## 功能特性

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

## 部署后验证

将 `https://your-project.vercel.app` 替换为你的实际域名。

```bash
curl https://your-project.vercel.app/
curl https://your-project.vercel.app/health
curl "https://your-project.vercel.app/api/search?q=钻石&limit=5&pretty=true"
curl "https://your-project.vercel.app/api/page/钻石?format=markdown&pretty=true"
```

## 环境变量（Vercel）

推荐至少配置以下变量：

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 运行环境 |
| `WIKI_BASE_URL` | `https://zh.minecraft.wiki` | Wiki 源站 |
| `REQUEST_TIMEOUT` | `15000` | 外部请求超时（毫秒） |
| `MAX_RETRIES` | `2` | 外部请求重试次数 |
| `RATE_LIMIT_MAX` | `50` | 每窗口最大请求数 |
| `RATE_LIMIT_WINDOW` | `60000` | 限流窗口（毫秒） |
| `SEARCH_MAX_LIMIT` | `30` | 搜索最大条数 |
| `ALLOWED_ORIGINS` | `*` | CORS 白名单（逗号分隔） |
| `LOG_FILE` | `false` | Serverless 建议关闭文件日志 |

完整示例见：`./.env.vercel`

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

### 健康检查

- `GET /health`
- `GET /health/detailed`
- `GET /health/ready`
- `GET /health/live`

## 本地开发

```bash
npm install
npm run dev
```

本地模拟 Serverless：

```bash
npm run dev:serverless
npm run test:serverless
```

## Vercel 适配说明

项目当前使用 `api/index.js` 作为 serverless 入口，配合 `vercel.json` 路由转发，支持：

- 根路径 `/`
- API 路径 `/api` 与 `/api/*`
- 健康检查 `/health` 与 `/health/*`

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

## 相关文档

- 部署详解：`./deploy-vercel.md`
- API 说明：`./docs/API_DOCUMENTATION.md`
- 环境变量：`./docs/environment-variables-guide.md`

## 许可证

- 项目代码：`MIT`（见 `./LICENSE`）
- Wiki 内容版权：遵循中文 Minecraft Wiki 所声明的许可条款
