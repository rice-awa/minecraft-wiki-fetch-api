/**
 * Vercel Serverless Function Entry Point
 * 适配Vercel的无服务器函数入口
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import our custom modules
const config = require('../src/config');
const { logger, requestLoggingMiddleware } = require('../src/utils/logger');
const { 
  asyncHandler, 
  notFoundHandler, 
  errorHandler, 
  validateRequest, 
  sanitizeParams, 
  requestIdHandler,
  corsErrorHandler 
} = require('../src/middleware/errorHandler');
const { jsonFormatterMiddleware } = require('../src/middleware/jsonFormatter');
const { apiRoutes, healthRoutes } = require('../src/routes');

// 创建Express应用
const app = express();

// Trust proxy (Vercel handles this)
app.set('trust proxy', 1);

// Request ID middleware (must be first)
app.use(requestIdHandler);

// Security middleware - 针对serverless环境优化
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS with error handling
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.security.allowedOrigins;
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const error = new Error(`Origin ${origin} not allowed by CORS policy`);
    error.statusCode = 403;
    callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Forwarded-For']
}));
app.use(corsErrorHandler);

// Rate limiting - 针对serverless环境调整
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试',
        details: {
          windowMs: config.rateLimit.windowMs,
          maxRequests: config.rateLimit.max
        },
        timestamp: new Date().toISOString()
      }
    });
  },
  skip: (req) => {
    return req.path.startsWith('/health');
  }
});
app.use(limiter);

// Request validation and sanitization
app.use(validateRequest({
  maxBodySize: '10mb',
  allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
  requireContentType: false
}));
app.use(sanitizeParams);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000,
  type: 'application/x-www-form-urlencoded'
}));

// Request logging middleware
app.use(requestLoggingMiddleware());

// JSON格式化中间件
app.use(jsonFormatterMiddleware());

// Mount routes
app.use('/health', healthRoutes);
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', asyncHandler(async (req, res) => {
  const healthInfo = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    environment: 'serverless',
    platform: 'vercel'
  };

  res.json({
    name: 'Minecraft Wiki API',
    version: '1.0.0',
    description: 'API service for scraping Minecraft Chinese Wiki content (Serverless)',
    status: healthInfo,
    endpoints: {
      search: 'GET /api/search?q={keyword}&limit={number}&pretty={true|false}',
      page: 'GET /api/page/{pageName}?format={html|markdown|both|wikitext}&pretty={true|false}',
      batchPages: 'POST /api/pages',
      pageExists: 'GET /api/page/{pageName}/exists',
      health: 'GET /health',
      healthDetailed: 'GET /health/detailed',
      ready: 'GET /health/ready',
      live: 'GET /health/live'
    },
    documentation: 'https://github.com/rice-awa/minecraft-wiki-fetch-api/tree/main/docs',
    contact: {
      support: 'https://github.com/rice-awa/minecraft-wiki-fetch-api/issues'
    }
  });
}));

// 404 handler
app.use('*', notFoundHandler);

// Global error handler
app.use(errorHandler);

// Export for Vercel
module.exports = app;
