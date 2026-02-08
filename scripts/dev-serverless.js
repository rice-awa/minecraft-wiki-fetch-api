#!/usr/bin/env node

/**
 * 本地开发服务器 - Serverless 模式
 * 模拟 Vercel 环境进行本地测试
 */

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// 设置 serverless 环境变量
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const app = require('../api/index.js');

console.log('🚀 启动 Serverless 开发服务器...\n');

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ 服务器已启动`);
  console.log(`📍 地址: http://${HOST}:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV}`);
  console.log(`⚡ 模式: Serverless (模拟)`);
  console.log('');
  console.log('📋 可用端点:');
  console.log(`   GET  http://${HOST}:${PORT}/`);
  console.log(`   GET  http://${HOST}:${PORT}/health`);
  console.log(`   GET  http://${HOST}:${PORT}/api/search?q=钻石`);
  console.log(`   GET  http://${HOST}:${PORT}/api/page/钻石`);
  console.log(`   POST http://${HOST}:${PORT}/api/pages`);
  console.log('');
  console.log('🧪 运行测试:');
  console.log(`   npm run test:serverless`);
  console.log('');
  console.log('⏹️  停止服务器: Ctrl+C');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

// 错误处理
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用`);
    console.error('💡 请尝试使用其他端口:');
    console.error(`   PORT=3001 node scripts/dev-serverless.js`);
  } else {
    console.error('❌ 服务器启动失败:', error.message);
  }
  process.exit(1);
});
