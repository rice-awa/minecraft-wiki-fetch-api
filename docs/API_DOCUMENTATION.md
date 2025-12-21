# Minecraft Wiki API 接口文档

## 📋 概述

Minecraft Wiki API 是一个功能完善的 RESTful API 服务，专门用于抓取、解析和转换 Minecraft 中文 Wiki 内容。提供智能搜索、页面内容获取、批量处理等功能，支持 HTML 和 Markdown 两种格式输出。

**基础URL**: `http://localhost:3000`  
**API版本**: v1.0.0  
**内容类型**: `application/json; charset=utf-8`  
**字符编码**: UTF-8

### 🌟 核心特性

- 🔍 **智能搜索**: 支持关键词搜索，相关度排序，分页浏览
- 📄 **页面解析**: 完整的页面内容解析，提取标题、正文、图片、表格等
- 🔄 **格式转换**: 支持 HTML 到 Markdown 的高质量转换
- 📝 **源代码获取**: 支持获取页面的原始 Wikitext 源代码
- 📦 **批量处理**: 支持批量获取多个页面内容
- 💾 **智能缓存**: 内存缓存提升响应速度
- 🚦 **访问控制**: 基于 IP 的请求频率限制
- 📊 **健康监控**: 完整的服务状态监控和诊断

## 🚀 快速开始

### 1. 启动服务器
```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev

# 使用 PM2 部署
pm2 start src/index.js --name minecraft-wiki-api
```

### 2. 验证服务状态
```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 查看所有可用端点
curl http://localhost:3000/
```

### 3. 测试基础功能
```bash
# 测试搜索功能
curl "http://localhost:3000/api/search?q=钻石&limit=5"

# 测试页面获取
curl "http://localhost:3000/api/page/钻石?format=markdown"
```

## 📡 API 端点总览

| 端点类型 | 路径 | 方法 | 描述 |
|---------|------|------|------|
| 根端点 | `/` | GET | API 信息和端点列表 |
| 搜索 | `/api/search` | GET | 搜索 Wiki 内容 |
| 搜索统计 | `/api/search/stats` | GET | 搜索服务统计信息 |
| 页面内容 | `/api/page/:pageName` | GET | 获取指定页面内容 |
| 页面存在性 | `/api/page/:pageName/exists` | GET | 检查页面是否存在 |
| 批量页面 | `/api/pages` | POST | 批量获取多个页面 |
| 页面统计 | `/api/pages/stats` | GET | 页面服务统计信息 |
| 清除缓存 | `/api/page/:pageName/cache` | DELETE | 清除页面缓存 |
| 健康检查 | `/health` | GET | 基础健康检查 |
| 详细健康检查 | `/health/detailed` | GET | 详细健康检查 |
| 就绪检查 | `/health/ready` | GET | 服务就绪状态 |
| 存活检查 | `/health/live` | GET | 服务存活状态 |

---

## 🔍 搜索 API

### 1. 基础搜索

#### GET /api/search
搜索 Minecraft Wiki 内容

**查询参数:**
- `q` (必需): 搜索关键词
- `limit` (可选): 结果数量限制，默认10，最大50
- `namespaces` (可选): 命名空间，多个用逗号分隔
- `format` (可选): 响应格式，默认 json
- `pretty` (可选): JSON格式化，支持 true/false/1/0/yes/no，默认 false

**示例请求:**
```
GET /api/search?q=钻石&limit=5
GET /api/search?q=redstone&namespaces=0,14&limit=10
GET /api/search?q=钻石&pretty=true
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "query": "钻石",
    "results": [
      {
        "title": "钻石",
        "url": "https://zh.minecraft.wiki/w/钻石",
        "snippet": "钻石是游戏中最珍贵的材料之一...",
        "namespace": "主要",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "limit": 5,
      "totalHits": 25,
      "hasMore": true
    },
    "metadata": {
      "searchTime": 1234,
      "fromCache": false,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### GET /api/search/stats
获取搜索服务统计信息

**响应示例:**
```json
{
  "success": true,
  "data": {
    "cache": {
      "enabled": true,
      "size": 42,
      "maxSize": 100
    },
    "service": {
      "uptime": 3600,
      "memory": {...},
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

---

## 📄 页面内容 API

### 1. 获取页面内容

#### GET /api/page/:pageName
获取指定页面的完整内容

**路径参数:**
- `pageName` (必需): 页面名称，支持 URL 编码

**查询参数:**
- `format` (可选): 输出格式 - `html`, `markdown`, `both`, `wikitext`，默认 `both`
- `useCache` (可选): 是否使用缓存，默认 `true`
- `includeMetadata` (可选): 是否包含元数据，默认 `true`
- `pretty` (可选): JSON格式化，支持 true/false/1/0/yes/no，默认 false

**示例请求:**
```
GET /api/page/钻石
GET /api/page/%E9%92%BB%E7%9F%B3?format=markdown
GET /api/page/Diamond?format=html&useCache=false
GET /api/page/数据包?format=wikitext
GET /api/page/钻石?pretty=true
```

**响应示例 (HTML/Markdown格式):**
```json
{
  "success": true,
  "data": {
    "page": {
      "pageName": "钻石",
      "url": "https://zh.minecraft.wiki/w/钻石",
      "title": "钻石",
      "subtitle": "来自Minecraft Wiki",
      "categories": [
        {
          "name": "材料",
          "url": "https://zh.minecraft.wiki/wiki/Category:Materials"
        }
      ],
      "content": {
        "html": "...",
        "markdown": "# 钻石\n\n**钻石**是游戏中最珍贵的材料之一。\n\n## 获取\n...",
        "text": "钻石是游戏中最珍贵的材料之一...",
        "components": {
          "sections": [...],
          "images": [...],
          "tables": [...],
          "infoboxes": [...],
          "toc": {...}
        }
      },
      "meta": {
        "wordCount": 1234,
        "imageCount": 5,
        "tableCount": 2,
        "sectionCount": 8,
        "processingTime": 1678901234
      }
    },
    "metadata": {
      "requestTime": 1500,
      "format": "both",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

**响应示例 (Wikitext格式):**
```json
{
  "success": true,
  "data": {
    "page": {
      "pageName": "数据包",
      "url": "https://zh.minecraft.wiki/w/数据包",
      "content": {
        "wikitext": "{{Infobox\n| title = 数据包\n| image = [[File:Data Pack.png|200px]]\n| type = 游戏机制\n| affects = 世界生成、进度、战利品表等\n}}\n\n'''数据包'''（Data Pack）是一种自定义游戏内容的方式...\n\n== 功能 ==\n* 自定义[[进度]]\n* 修改[[战利品表]]\n* 自定义[[世界生成]]\n\n[[Category:游戏机制]]\n[[Category:数据包]]"
      },
      "meta": {
        "wordCount": 256,
        "processingTime": 890
      }
    },
    "metadata": {
      "requestTime": 1200,
      "format": "wikitext",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### POST /api/pages
批量获取多个页面内容

**请求体:**
```json
{
  "pages": ["钻石", "金锭", "铁锭"],
  "format": "markdown",
  "concurrency": 3,
  "useCache": true
}
```

**Wikitext格式请求体:**
```json
{
  "pages": ["数据包", "命令", "进度"],
  "format": "wikitext",
  "concurrency": 2,
  "useCache": true
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "results": {
      "钻石": {
        "success": true,
        "data": {...}
      },
      "金锭": {
        "success": true,
        "data": {...}
      }
    },
    "summary": {
      "totalPages": 3,
      "successCount": 2,
      "errorCount": 1
    },
    "metadata": {
      "requestTime": 3000,
      "format": "markdown",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### GET /api/page/:pageName/exists
检查页面是否存在

**响应示例:**
```json
{
  "success": true,
  "data": {
    "pageName": "钻石",
    "exists": true,
    "pageInfo": {
      "title": "钻石",
      "pageid": 12345
    },
    "redirected": false
  }
}
```

#### DELETE /api/page/:pageName/cache
清除页面缓存

**路径参数:**
- `pageName`: 页面名称或 `all` 清除所有缓存

**响应示例:**
```json
{
  "success": true,
  "message": "页面 \"钻石\" 的缓存已清除"
}
```

#### GET /api/pages/stats
获取页面服务统计信息

---

## 🏥 健康检查 API

### 1. 基础健康检查

#### GET /health
基础健康检查

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": {
    "seconds": 3600,
    "human": "1小时"
  },
  "memory": {
    "used": "45MB",
    "total": "128MB",
    "system": "256MB"
  },
  "service": {
    "name": "minecraft-wiki-api",
    "version": "1.0.0",
    "environment": "development"
  }
}
```

### 2. 详细健康检查

#### GET /health/detailed
获取详细的健康检查信息，包含依赖服务状态

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": {
    "seconds": 3600,
    "human": "1小时"
  },
  "memory": {
    "used": "45MB",
    "total": "128MB",
    "system": "256MB"
  },
  "service": {
    "name": "minecraft-wiki-api",
    "version": "1.0.0",
    "environment": "production"
  },
  "dependencies": {
    "wiki": {
      "status": "healthy",
      "responseTime": 150,
      "lastCheck": "2024-01-01T12:00:00Z"
    },
    "cache": {
      "status": "healthy",
      "size": 42,
      "maxSize": 1000
    }
  }
}
```

### 3. 就绪状态检查

#### GET /health/ready
检查服务是否已准备好接收请求

**响应示例:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-01T12:00:00Z",
  "checks": {
    "server": "ready",
    "dependencies": "ready"
  }
}
```

### 4. 存活状态检查

#### GET /health/live
检查服务是否仍在运行

**响应示例:**
```json
{
  "status": "alive",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600
}
```

---

## ⚠️ 错误处理

### 错误响应格式

所有错误响应都遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细信息或建议（可选）",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### 常见错误码

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|-----------|------|----------|
| `INVALID_PARAMETERS` | 400 | 请求参数无效 | 检查参数格式和必需字段 |
| `PAGE_NOT_FOUND` | 404 | 页面不存在 | 确认页面名称正确或查看建议页面 |
| `METHOD_NOT_ALLOWED` | 405 | HTTP方法不被允许 | 使用正确的HTTP方法 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 | 降低请求频率或稍后重试 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 | 联系管理员或稍后重试 |
| `SEARCH_ERROR` | 500 | 搜索服务错误 | 检查搜索关键词或稍后重试 |
| `PARSE_ERROR` | 500 | 内容解析错误 | 页面格式可能有问题，请报告 |
| `HTML_FETCH_ERROR` | 502 | 页面获取失败 | Wiki服务可能暂时不可用 |
| `SOURCE_FETCH_ERROR` | 502 | 源代码获取失败 | 编辑页面可能暂时不可用 |
| `NETWORK_ERROR` | 503 | 网络连接错误 | 检查网络连接或稍后重试 |
| `TIMEOUT_ERROR` | 504 | 请求超时 | 稍后重试或联系管理员 |

### 错误响应示例

**参数错误 (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "搜索关键词不能为空",
    "details": "参数 'q' 是必需的",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

**页面不存在 (404):**
```json
{
  "success": false,
  "error": {
    "code": "PAGE_NOT_FOUND",
    "message": "页面不存在",
    "details": {
      "pageName": "不存在的页面",
      "suggestions": [
        {
          "title": "相似页面1",
          "url": "https://zh.minecraft.wiki/w/相似页面1"
        }
      ]
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

**限流错误 (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请稍后再试",
    "details": {
      "windowMs": 60000,
      "maxRequests": 100,
      "retryAfter": 30
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## 📊 限制和配额

| 限制类型 | 默认值 | 说明 |
|---------|--------|------|
| 请求频率 | 100次/分钟 | 基于IP的请求频率限制 |
| 搜索结果 | 50个/次 | 单次搜索最大返回结果数 |
| 批量页面 | 20个/次 | 单次批量请求最大页面数 |
| 并发处理 | 5个 | 批量请求最大并发数 |
| 请求体大小 | 10MB | HTTP请求体最大大小 |
| 关键词长度 | 200字符 | 搜索关键词最大长度 |

> 💡 **配置说明**: 所有限制都可以通过环境变量调整，详见 [环境变量配置指南](environment-variables-guide.md)

---

## 🎨 JSON格式化

### 概述

API支持通过 `pretty` 查询参数控制JSON响应的格式化。这对于开发调试和API测试非常有用。

### 使用方法

**查询参数:**
- `pretty`: 控制JSON格式化
  - 支持值: `true`, `false`, `1`, `0`, `yes`, `no`
  - 大小写不敏感
  - 默认值: `false` (压缩格式)

### 示例对比

**压缩格式 (默认):**
```bash
GET /api/search?q=钻石&limit=2
```

响应 (单行压缩):
```json
{"success":true,"data":{"query":"钻石","results":[{"title":"钻石","url":"https://zh.minecraft.wiki/w/钻石","snippet":"钻石是游戏中最珍贵的材料之一..."}]}}
```

**格式化输出:**
```bash
GET /api/search?q=钻石&limit=2&pretty=true
```

响应 (格式化):
```json
{
  "success": true,
  "data": {
    "query": "钻石",
    "results": [
      {
        "title": "钻石",
        "url": "https://zh.minecraft.wiki/w/钻石",
        "snippet": "钻石是游戏中最珍贵的材料之一..."
      }
    ]
  }
}
```

### 响应头信息

格式化的响应会包含额外的HTTP头：

```
X-JSON-Formatted: true
Content-Type: application/json; charset=utf-8
```

### 支持的参数值

| 参数值 | 结果 | 说明 |
|--------|------|------|
| `true`, `TRUE`, `True` | 格式化 | 字符串true（大小写不敏感） |
| `false`, `FALSE`, `False` | 压缩 | 字符串false（大小写不敏感） |
| `1` | 格式化 | 数字1 |
| `0` | 压缩 | 数字0 |
| `yes`, `YES`, `Yes` | 格式化 | 字符串yes（大小写不敏感） |
| `no`, `NO`, `No` | 压缩 | 字符串no（大小写不敏感） |
| 未提供 | 压缩 | 默认行为 |

### 性能考虑

- **格式化输出**: 增加响应大小约20-30%，轻微增加处理时间
- **压缩输出**: 最小响应大小，最快处理速度
- **建议**: 开发调试时使用格式化，生产环境使用压缩格式

### 错误处理

无效的 `pretty` 参数值会返回400错误：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PRETTY_PARAMETER",
    "message": "pretty参数值无效",
    "details": {
      "received": "invalid_value",
      "validValues": ["true", "false", "1", "0", "yes", "no"]
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## 💾 缓存机制

### 缓存控制

**跳过缓存:**
```bash
GET /api/search?q=钻石&useCache=false
GET /api/page/钻石?useCache=false
```

**手动清理缓存:**
```bash
DELETE /api/page/钻石/cache     # 清理特定页面
DELETE /api/page/all/cache      # 清理所有缓存
```

**缓存统计:**
```bash
GET /api/search/stats           # 搜索缓存统计
GET /api/pages/stats            # 页面缓存统计
```

> 💡 **缓存配置**: 缓存TTL、大小等配置请参考 [环境变量配置指南](environment-variables-guide.md)

---

## 💻 使用示例

### JavaScript/Node.js

```javascript
// 搜索功能
const response = await fetch('http://localhost:3000/api/search?q=钻石&limit=5');
const searchData = await response.json();

// 搜索功能（格式化JSON）
const prettyResponse = await fetch('http://localhost:3000/api/search?q=钻石&limit=5&pretty=true');
const prettySearchData = await prettyResponse.json();

// 获取页面内容
const pageResponse = await fetch('http://localhost:3000/api/page/钻石?format=markdown');
const pageData = await pageResponse.json();

// 获取页面内容（格式化JSON）
const prettyPageResponse = await fetch('http://localhost:3000/api/page/钻石?format=markdown&pretty=true');
const prettyPageData = await prettyPageResponse.json();

// 批量获取页面
const batchResponse = await fetch('http://localhost:3000/api/pages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pages: ['钻石', '金锭', '铁锭'],
    format: 'markdown'
  })
});
const batchData = await batchResponse.json();

// 获取页面源代码
const sourceResponse = await fetch('http://localhost:3000/api/page/数据包?format=wikitext');
const sourceData = await sourceResponse.json();

// 批量获取源代码
const batchSourceResponse = await fetch('http://localhost:3000/api/pages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pages: ['数据包', '命令', '进度'],
    format: 'wikitext'
  })
});
const batchSourceData = await batchSourceResponse.json();
```

### cURL

```bash
# 搜索
curl "http://localhost:3000/api/search?q=钻石&limit=5"

# 搜索（格式化JSON）
curl "http://localhost:3000/api/search?q=钻石&limit=5&pretty=true"

# 获取页面内容
curl "http://localhost:3000/api/page/钻石?format=markdown"

# 获取页面内容（格式化JSON）
curl "http://localhost:3000/api/page/钻石?format=markdown&pretty=true"

# 检查健康状态
curl "http://localhost:3000/health"

# 批量获取页面
curl -X POST "http://localhost:3000/api/pages" \
  -H "Content-Type: application/json" \
  -d '{"pages":["钻石","金锭"],"format":"markdown"}'

# 获取页面源代码
curl "http://localhost:3000/api/page/数据包?format=wikitext"

# 批量获取源代码
curl -X POST "http://localhost:3000/api/pages" \
  -H "Content-Type: application/json" \
  -d '{"pages":["数据包","命令"],"format":"wikitext"}'
```

### Python

```python
import requests

# 搜索
response = requests.get('http://localhost:3000/api/search', 
                       params={'q': '钻石', 'limit': 5})
search_data = response.json()

# 搜索（格式化JSON）
pretty_response = requests.get('http://localhost:3000/api/search', 
                              params={'q': '钻石', 'limit': 5, 'pretty': 'true'})
pretty_search_data = pretty_response.json()

# 获取页面内容
page_response = requests.get('http://localhost:3000/api/page/钻石',
                           params={'format': 'markdown'})
page_data = page_response.json()

# 获取页面内容（格式化JSON）
pretty_page_response = requests.get('http://localhost:3000/api/page/钻石',
                                   params={'format': 'markdown', 'pretty': 'true'})
pretty_page_data = pretty_page_response.json()

# 批量获取
batch_response = requests.post('http://localhost:3000/api/pages',
                             json={'pages': ['钻石', '金锭'], 'format': 'markdown'})
batch_data = batch_response.json()

# 获取页面源代码
source_response = requests.get('http://localhost:3000/api/page/数据包',
                             params={'format': 'wikitext'})
source_data = source_response.json()

# 批量获取源代码
batch_source_response = requests.post('http://localhost:3000/api/pages',
                                    json={'pages': ['数据包', '命令'], 'format': 'wikitext'})
batch_source_data = batch_source_response.json()
```

---

## 🚀 部署

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### PM2 部署

```bash
pm2 start src/index.js --name minecraft-wiki-api
pm2 save
pm2 startup
```

> 💡 **环境配置**: 详细的环境变量配置请参考 [环境变量配置指南](environment-variables-guide.md)

---

## ⚖️ 版权声明

### 重要提醒

本 API 获取的所有 Minecraft Wiki 内容均来自 [中文 Minecraft Wiki](https://zh.minecraft.wiki)，遵循以下版权协议：

- **许可协议**: 知识共享 署名-非商业性使用-相同方式共享 3.0 (CC BY-NC-SA 3.0)
- **使用要求**: 
  - ✅ 必须署名来源为中文 Minecraft Wiki
  - ❌ 不得用于商业目的
  - 🔄 修改内容需采用相同许可协议

### 使用建议

```json
// 在您的应用中显示内容时，建议包含版权信息
{
  "content": "钻石是游戏中最珍贵的材料之一...",
  "source": "内容来自中文 Minecraft Wiki",
  "license": "CC BY-NC-SA 3.0",
  "url": "https://zh.minecraft.wiki"
}
```

---

## 🆘 支持和反馈

如遇问题或需要功能建议，请：

1. 检查 API 文档和示例
2. 查看服务健康状态 `/health/detailed`
3. 检查请求格式和参数
4. 联系开发团队

## 更新日志

### v1.1.0 (2024-01-XX)
- ✅ 新增 Wikitext 源代码获取功能
- ✅ 支持通过 `?action=edit` 参数获取页面源代码
- ✅ 修复 UTF-8 编码问题，支持中文字符批量请求
- ✅ 新增 `SOURCE_FETCH_ERROR` 错误处理

### v1.0.0 (2024-01-01)
- ✅ 实现搜索 API
- ✅ 实现页面内容获取 API
- ✅ 支持 HTML/Markdown 格式输出
- ✅ 实现智能缓存系统
- ✅ 完整的健康检查端点
- ✅ 批量页面获取功能