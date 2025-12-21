const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import our custom modules
const config = require('./config');
const { logger, requestLoggingMiddleware } = require('./utils/logger');
const { getAvailablePort, startServerSafely } = require('./utils/portManager');
const { 
  asyncHandler, 
  notFoundHandler, 
  errorHandler, 
  validateRequest, 
  sanitizeParams, 
  requestIdHandler,
  corsErrorHandler 
} = require('./middleware/errorHandler');
const { jsonFormatterMiddleware } = require('./middleware/jsonFormatter');
const { apiRoutes, healthRoutes } = require('./routes');

const app = express();

// Trust proxy (for proper IP detection behind reverse proxies)
app.set('trust proxy', 1);

// Request ID middleware (must be first)
app.use(requestIdHandler);

// Security middleware
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

// Rate limiting with enhanced error handling
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
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
    // Skip rate limiting for health checks
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

// Body parsing middleware with error handling
app.use(express.json({
  limit: '10mb',
  type: 'application/json',
  charset: 'utf-8'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000,
  type: 'application/x-www-form-urlencoded',
  charset: 'utf-8'
}));

// Request logging middleware
app.use(requestLoggingMiddleware());

// JSON格式化中间件
app.use(jsonFormatterMiddleware());

// Mount routes
app.use('/health', healthRoutes);
app.use('/api', apiRoutes);

// Root endpoint with enhanced information
app.get('/', asyncHandler(async (req, res) => {
  const healthInfo = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    environment: config.server.nodeEnv
  };

  res.json({
    name: 'Minecraft Wiki API',
    version: '1.0.0',
    description: 'API service for scraping Minecraft Chinese Wiki content',
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

// 404 handler - using the new middleware
app.use('*', notFoundHandler);

// Global error handler - using the new middleware
app.use(errorHandler);

// Start server only if this file is run directly (not required)
if (require.main === module) {
  startServer();
}

/**
 * Gracefully starts the server with automatic port selection
 */
async function startServer() {
  try {
    let server, serverPort;

    // Check if auto port selection is enabled
    if (config.server.autoPort) {
      // Use the safe server startup method
      const result = await startServerSafely(app, config.server.port, config.server.host, {
        maxAttempts: config.server.maxPortAttempts,
        logAttempts: true
      });
      
      server = result.server;
      serverPort = result.port;
    } else {
      // If auto port is disabled, just validate the configured port and start normally
      const { validatePort } = require('./utils/portManager');
      validatePort(config.server.port);
      
      logger.info('Auto port selection is disabled, using configured port', {
        port: config.server.port
      });
      
      serverPort = config.server.port;
      
      // Start the server on the configured port
      server = await new Promise((resolve, reject) => {
        const serverInstance = app.listen(serverPort, config.server.host, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(serverInstance);
        });
        
        serverInstance.on('error', (error) => {
          reject(error);
        });
      });
    }

    // Server started successfully
    const serverInfo = {
      host: config.server.host,
      port: serverPort,
      nodeEnv: config.server.nodeEnv,
      wikiBaseUrl: config.wiki.baseUrl,
      originalPort: config.server.port,
      portChanged: serverPort !== config.server.port,
      autoPortEnabled: config.server.autoPort
    };

    logger.info(`Server started successfully`, serverInfo);
    
    // Console output
    if (config.server.autoPort && serverPort !== config.server.port) {
      console.log(`⚠️  Port ${config.server.port} was occupied, server started on port ${serverPort}`);
    }
    
    const hostDisplay = config.server.host === '0.0.0.0' ? 'localhost' : config.server.host;
    console.log(`🚀 Minecraft Wiki API server started on http://${hostDisplay}:${serverPort}`);
    console.log(`📋 API endpoints:`);
    console.log(`   - GET /api/search?q=钻石`);
    console.log(`   - GET /api/search?q=钻石&limit=20&pretty=true`);
    console.log(`   - GET /api/page/钻石?format=markdown&pretty=true`);
    console.log(`   - GET /api/page/钻石?format=wikitext&pretty=true`);
    console.log(`   - GET /api/page/钻石`);
    console.log(`   - POST /api/pages`);
    console.log(`   - GET /health`);
    
    if (config.server.autoPort && serverPort !== config.server.port) {
      console.log(`\n💡 Tip: Update your PORT environment variable to ${serverPort} to avoid port conflicts`);
      console.log(`   Or set AUTO_PORT=false to disable automatic port selection`);
    }

    // Handle server errors (though they should be less likely now)
    server.on('error', (error) => {
      logger.error('Unexpected server error after startup', {
        error: error.message,
        code: error.code,
        port: serverPort
      });
      console.error(`❌ Unexpected server error: ${error.message}`);
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown', { error: err.message });
          console.error('❌ Error during shutdown:', err.message);
          process.exit(1);
        } else {
          logger.info('Server closed successfully');
          console.log('✅ Server closed successfully');
          process.exit(0);
        }
      });
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      configuredPort: config.server.port,
      autoPortEnabled: config.server.autoPort
    });
    console.error(`❌ Failed to start server: ${error.message}`);
    
    if (config.server.autoPort) {
      console.error('   Please check if all ports in the range are available or increase MAX_PORT_ATTEMPTS.');
    } else {
      console.error('   Please choose a different port or enable AUTO_PORT=true for automatic port selection.');
    }
    
    process.exit(1);
  }
}

module.exports = app;