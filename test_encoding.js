const express = require('express');
const app = express();

app.use(express.json({
  limit: '10mb',
  type: 'application/json',
  charset: 'utf-8'
}));

app.post('/test', (req, res) => {
  console.log('原始请求体:', JSON.stringify(req.body));
  console.log('页面数组:', req.body.pages);
  console.log('第一个页面名称:', req.body.pages[0]);
  console.log('第一个页面名称类型:', typeof req.body.pages[0]);
  console.log('第一个页面名称长度:', req.body.pages[0].length);
  console.log('第一个页面名称字符代码:', req.body.pages[0].split('').map(c => c.charCodeAt(0)));

  res.json({
    received: req.body.pages,
    firstPage: req.body.pages[0],
    firstPageBytes: Buffer.from(req.body.pages[0]).toString('hex')
  });
});

app.listen(3002, () => {
  console.log('测试服务器运行在端口 3002');
});