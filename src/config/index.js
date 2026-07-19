/**
 * 配置管理系统
 * 处理环境变量并提供默认值
 */

require('dotenv').config();

/**
 * 解析布尔值环境变量
 * @param {string} value - 环境变量值
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 解析数组环境变量（逗号分隔）
 * @param {string} value - 环境变量值
 * @param {Array} defaultValue - 默认值
 * @returns {Array}
 */
function parseArray(value, defaultValue = []) {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

const config = {
  // 服务器基础配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    autoPort: parseBoolean(process.env.AUTO_PORT, true),
    maxPortAttempts: parseInt(process.env.MAX_PORT_ATTEMPTS) || 100,
  },

  // Wiki数据源配置
  wiki: {
    baseUrl: process.env.WIKI_BASE_URL || 'https://zh.minecraft.wiki',
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 60000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    userAgent: process.env.USER_AGENT || 'MinecraftWikiAPI/1.0.0 (https://github.com/rice-awa/minecraft-wiki-fetch-api)',
  },

  // 缓存系统配置
  cache: {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.CACHE_TTL) || 1800, // 30分钟
    memoryCache: {
      maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE) || 1000,
      searchTtl: parseInt(process.env.SEARCH_CACHE_TTL) || 300, // 5分钟
      pageTtl: parseInt(process.env.PAGE_CACHE_TTL) || 1800, // 30分钟
    },
  },

  // 访问限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 默认最大请求数（向后兼容）
    anonymous: parseInt(process.env.RATE_LIMIT_ANONYMOUS) || parseInt(process.env.RATE_LIMIT_MAX) || 50, // 未认证用户配额
    authenticated: parseInt(process.env.RATE_LIMIT_AUTHENTICATED) || 200, // 认证用户配额
    byIp: parseBoolean(process.env.RATE_LIMIT_BY_IP, true),
    store: process.env.RATE_LIMIT_STORE || 'memory', // memory, redis, upstash
    skipHealthCheck: parseBoolean(process.env.RATE_LIMIT_SKIP_HEALTH, true), // 健康检查跳过限流
  },

  // Upstash Redis 配置（用于分布式限流）
  upstash: {
    redisRestUrl: process.env.UPSTASH_REDIS_REST_URL || null,
    redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || null,
  },

  // 日志系统配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
    console: parseBoolean(process.env.LOG_CONSOLE, process.env.NODE_ENV !== 'production'),
    file: parseBoolean(process.env.LOG_FILE, true),
    maxSize: parseInt(process.env.LOG_MAX_SIZE) || 50, // MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 30,
  },

  // 搜索功能配置
  search: {
    defaultLimit: parseInt(process.env.SEARCH_DEFAULT_LIMIT) || 10,
    maxLimit: parseInt(process.env.SEARCH_MAX_LIMIT) || 50,
    maxKeywordLength: parseInt(process.env.SEARCH_MAX_KEYWORD_LENGTH) || 200,
  },

  // 安全配置
  security: {
    allowedOrigins: parseArray(process.env.ALLOWED_ORIGINS, ['*']),
    forceHttps: parseBoolean(process.env.FORCE_HTTPS, false),
    securityHeaders: parseBoolean(process.env.SECURITY_HEADERS, true),
    apiKey: process.env.API_KEY || null,
    apiKeys: parseArray(process.env.API_KEY, []), // 支持多个 API Key（逗号分隔）
    jwtSecret: process.env.JWT_SECRET || null,
    // 端点保护配置
    endpointProtection: {
      enabled: parseBoolean(process.env.ENDPOINT_PROTECTION_ENABLED, true),
      requireAuthForBatch: parseBoolean(process.env.REQUIRE_AUTH_FOR_BATCH, true),
      requireAuthForCacheClear: parseBoolean(process.env.REQUIRE_AUTH_FOR_CACHE_CLEAR, true),
    },
  },

  // 数据库配置（可选）
  database: {
    url: process.env.DATABASE_URL || null,
    poolMax: parseInt(process.env.DATABASE_POOL_MAX) || 20,
    poolMin: parseInt(process.env.DATABASE_POOL_MIN) || 2,
  },

  // 监控和健康检查配置
  monitoring: {
    healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
    detailedHealthCheck: parseBoolean(process.env.HEALTH_CHECK_DETAILED, true),
    metricsPath: process.env.METRICS_PATH || null,
  },

  // 性能优化配置
  performance: {
    compression: parseBoolean(process.env.ENABLE_COMPRESSION, true),
    staticCacheTime: parseInt(process.env.STATIC_CACHE_TIME) || 86400, // 1天
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    memoryLimit: parseInt(process.env.NODE_MEMORY_LIMIT) || 0, // 0表示不限制
  },

  // 第三方服务配置
  thirdParty: {
    imageStorageUrl: process.env.IMAGE_STORAGE_URL || null,
    analyticsApiKey: process.env.ANALYTICS_API_KEY || null,
    smtp: {
      host: process.env.SMTP_HOST || null,
      port: parseInt(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
    },
  },

  // 开发和调试配置
  development: {
    debug: parseBoolean(process.env.DEBUG, false),
    apiDocs: parseBoolean(process.env.ENABLE_API_DOCS, true),
    profiling: parseBoolean(process.env.ENABLE_PROFILING, false),
  },
};

/**
 * 验证必需的配置值
 * @throws {Error} 如果缺少必需的配置
 */
function validateConfig() {
  const required = [
    { key: 'wiki.baseUrl', value: config.wiki.baseUrl },
  ];

  for (const { key, value } of required) {
    if (!value) {
      throw new Error(`缺少必需的配置项: ${key}`);
    }
  }

  // 验证数值范围
  if (config.wiki.requestTimeout < 1000) {
    throw new Error('REQUEST_TIMEOUT 必须至少为 1000 毫秒');
  }

  if (config.wiki.maxRetries < 0 || config.wiki.maxRetries > 10) {
    throw new Error('MAX_RETRIES 必须在 0 到 10 之间');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('PORT 必须在 1 到 65535 之间');
  }

  if (config.server.maxPortAttempts < 1 || config.server.maxPortAttempts > 1000) {
    throw new Error('MAX_PORT_ATTEMPTS 必须在 1 到 1000 之间');
  }

  if (config.rateLimit.windowMs < 1000) {
    throw new Error('RATE_LIMIT_WINDOW 必须至少为 1000 毫秒');
  }

  if (config.rateLimit.max < 1) {
    throw new Error('RATE_LIMIT_MAX 必须大于 0');
  }

  if (config.cache.memoryCache.maxSize < 1) {
    throw new Error('MEMORY_CACHE_MAX_SIZE 必须大于 0');
  }

  if (config.search.maxLimit < config.search.defaultLimit) {
    throw new Error('SEARCH_MAX_LIMIT 必须大于等于 SEARCH_DEFAULT_LIMIT');
  }

  if (config.search.maxKeywordLength < 10) {
    throw new Error('SEARCH_MAX_KEYWORD_LENGTH 必须至少为 10');
  }

  // 验证日志级别
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logging.level)) {
    throw new Error(`LOG_LEVEL 必须是以下值之一: ${validLogLevels.join(', ')}`);
  }

  // 验证限流存储方式
  const validRateLimitStores = ['memory', 'redis', 'upstash'];
  if (!validRateLimitStores.includes(config.rateLimit.store)) {
    throw new Error(`RATE_LIMIT_STORE 必须是以下值之一: ${validRateLimitStores.join(', ')}`);
  }

  // 验证使用 Upstash 时必须提供配置
  if (config.rateLimit.store === 'upstash') {
    if (!config.upstash.redisRestUrl || !config.upstash.redisRestToken) {
      throw new Error('使用 Upstash 限流时必须提供 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN');
    }
  }

  // 验证限流配额
  if (config.rateLimit.anonymous < 1) {
    throw new Error('RATE_LIMIT_ANONYMOUS 必须大于 0');
  }

  if (config.rateLimit.authenticated < 1) {
    throw new Error('RATE_LIMIT_AUTHENTICATED 必须大于 0');
  }

  // 验证环境模式
  const validNodeEnvs = ['development', 'production', 'test'];
  if (!validNodeEnvs.includes(config.server.nodeEnv)) {
    throw new Error(`NODE_ENV 必须是以下值之一: ${validNodeEnvs.join(', ')}`);
  }
}

/**
 * 通过点符号路径获取配置值
 * @param {string} path - 点符号路径（例如：'wiki.baseUrl'）
 * @param {*} defaultValue - 如果路径不存在时的默认值
 * @returns {*} 配置值
 */
function get(path, defaultValue = undefined) {
  const keys = path.split('.');
  let current = config;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current;
}

/**
 * 检查应用是否运行在开发模式
 * @returns {boolean}
 */
function isDevelopment() {
  return config.server.nodeEnv === 'development';
}

/**
 * 检查应用是否运行在生产模式
 * @returns {boolean}
 */
function isProduction() {
  return config.server.nodeEnv === 'production';
}

/**
 * 检查应用是否运行在测试模式
 * @returns {boolean}
 */
function isTest() {
  return config.server.nodeEnv === 'test';
}

/**
 * 获取配置摘要信息（用于日志和调试）
 * @returns {Object} 配置摘要
 */
function getConfigSummary() {
  return {
    environment: config.server.nodeEnv,
    host: config.server.host,
    port: config.server.port,
    autoPort: config.server.autoPort,
    wikiBaseUrl: config.wiki.baseUrl,
    rateLimitMax: config.rateLimit.max,
    rateLimitWindow: config.rateLimit.windowMs,
    logLevel: config.logging.level,
    cacheEnabled: !!config.cache.redisUrl,
    debugMode: config.development.debug,
  };
}

// 在模块加载时验证配置
try {
  validateConfig();
} catch (error) {
  console.error('配置验证失败:', error.message);
  console.error('请检查环境变量设置并参考 .env.example 文件');
  process.exit(1);
}

module.exports = {
  ...config,
  get,
  isDevelopment,
  isProduction,
  isTest,
  validateConfig,
  getConfigSummary,
  parseBoolean,
  parseArray,
};