const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { testConnection, pool } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const reviewRoutes = require('./routes/reviews');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
let demoPasswordReset = null;

// Tat header x-powered-by va bo sung cac header bao mat co ban
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Ghi log gon 1 dong cho moi yeu cau (khong log mat khau hay token)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Chong CSRF co ban: cookie dung SameSite=Lax va cac API ghi (POST/PUT/PATCH/DELETE)
// chi chap nhan Content-Type: application/json (trinh duyet khong the gui JSON tu form cross-site)
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const hasBody = req.headers['content-length'] && Number(req.headers['content-length']) > 0;
    const ct = req.headers['content-type'] || '';
    if (hasBody && !ct.includes('application/json')) {
      return res.status(415).json({ ok: false, message: 'Yêu cầu phải sử dụng Content-Type: application/json.' });
    }
  }
  return next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(attachUser);

// Kiem tra tinh trang server
app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, data: { status: 'ok', time: new Date().toISOString(), demoReset: demoPasswordReset } });
  } catch (err) {
    res.status(503).json({ ok: false, message: 'Không kết nối được cơ sở dữ liệu.' });
  }
});

// Gan cac nhom route API
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', reviewRoutes);
app.use('/api', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);

// 404 JSON cho moi duong dan /api/* khong ton tai
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Đường dẫn API không tồn tại.' });
});

// Phuc vu file tinh cua frontend cung origin (khong bi CORS, cookie hoat dong on dinh)
app.use(express.static(FRONTEND_DIR));

// Trang 404 don gian cho duong dan HTML khong ton tai
app.use((req, res) => {
  res.status(404).send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Không tìm thấy trang — Nhà Rang</title>
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
</head>
<body>
  <main class="container" style="padding: 96px 16px; text-align: center;">
    <p class="mono-label">LỖI 404</p>
    <h1 style="margin: 12px 0;">Không tìm thấy trang bạn yêu cầu</h1>
    <p style="color: var(--ink-soft); margin-bottom: 24px;">Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
    <a class="btn btn-primary" href="/index.html">Về trang chủ Nhà Rang</a>
  </main>
</body>
</html>`);
});

// Middleware xu ly loi cuoi cung
app.use(errorHandler);

async function startServer() {
  if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET || '').length < 32) {
    console.error('JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.warn('[CANH BAO] Bien JWT_SECRET trong .env chua dat hoac qua ngan. Hay tao file .env tu .env.example.');
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-nha-rang-change-me-32chars';
  }

  try {
    await testConnection();
    console.log('Ket noi MySQL thanh cong.');
  } catch (err) {
    console.error('\n[KHONG KET NOI DUOC MYSQL]');
    console.error('Hay kiem tra:');
    console.error('  1. Dich vu MySQL / MariaDB (hoac XAMPP) da duoc bat chua?');
    console.error('  2. Cac bien DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME trong file .env da dung chua?');
    console.error('  3. Ban da chay lenh "npm run db:setup" de tao database nha_rang chua?');
    console.error('Chi tiet loi:', err.message, '\n');
    process.exit(1);
  }

  // TEMP: đặt lại toàn bộ mật khẩu demo về Abc@123, gỡ ngay sau khi xác nhận
  try {
    const hash = await bcrypt.hash('Abc@123', 10);
    const [result] = await pool.query('UPDATE users SET password_hash = ?', [hash]);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    demoPasswordReset = { users: total, updated: result.affectedRows, at: new Date().toISOString() };
    console.log(`[demo-reset] updated ${result.affectedRows}/${total} users`);
  } catch (err) {
    demoPasswordReset = { error: err.message };
    console.error('[demo-reset] failed:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server Nha Rang dang chay tai: http://localhost:${PORT}`);
  });
}

startServer();
