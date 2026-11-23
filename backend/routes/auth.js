const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { requireAuth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, isValidEmail, isValidPhone, normalizePhone, isStrongPassword } = require('../utils/validate');

const router = express.Router();

// Gioi han dang nhap sai: toi da 10 lan / 15 phut moi IP (tu viet bang Map)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) return;
  if (rec.count >= MAX_ATTEMPTS) {
    throw new AppError(429, 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
  }
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

function clearFailedLogin(ip) {
  loginAttempts.delete(ip);
}

// Dat cookie JWT httpOnly (han 7 ngay)
function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// POST /api/auth/register — chi tao Customer, tu dang nhap sau khi tao
router.post('/register', asyncHandler(async (req, res) => {
  const fullName = trimStr(req.body.fullName);
  const email = trimStr(req.body.email).toLowerCase();
  const phone = trimStr(req.body.phone);
  const password = String(req.body.password || '');

  const errors = {};
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
  if (!isValidEmail(email)) errors.email = 'Email không đúng định dạng.';
  if (phone && !isValidPhone(phone)) errors.phone = 'Số điện thoại Việt Nam không hợp lệ (ví dụ 0901234567).';
  if (!isStrongPassword(password)) errors.password = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.';

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Vui lòng kiểm tra lại thông tin đăng ký.', errors);
  }

  const customer = await Customer.register({
    email,
    password,
    fullName,
    phone: phone ? normalizePhone(phone) : null,
  });

  await customer.updateLastLogin();
  setAuthCookie(res, customer);
  res.status(201).json({ ok: true, data: { user: customer.toPublicJSON() } });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const ip = req.ip || 'unknown';
  checkLoginRateLimit(ip);

  const email = trimStr(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    throw new AppError(400, 'Vui lòng nhập đầy đủ email và mật khẩu.');
  }

  const user = await User.findByEmail(email);
  if (!user) {
    recordFailedLogin(ip);
    throw new AppError(401, 'Email hoặc mật khẩu không đúng.');
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    recordFailedLogin(ip);
    throw new AppError(401, 'Email hoặc mật khẩu không đúng.');
  }

  if (user.status === 'blocked') {
    throw new AppError(403, 'Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng.');
  }

  clearFailedLogin(ip);
  await user.updateLastLogin();
  setAuthCookie(res, user);

  res.json({ ok: true, data: { user: user.toPublicJSON() } });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true, data: { loggedOut: true } });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({
    ok: true,
    data: {
      user: req.user ? req.user.toPublicJSON() : null,
      showDemoHint: process.env.NODE_ENV !== 'production',
    },
  });
});

// PUT /api/auth/password
router.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
  if (!isStrongPassword(newPassword)) errors.newPassword = 'Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.';
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Thông tin mật khẩu chưa hợp lệ.', errors);
  }

  const valid = await req.user.verifyPassword(currentPassword);
  if (!valid) {
    throw new AppError(400, 'Mật khẩu hiện tại không chính xác.', { currentPassword: 'Mật khẩu hiện tại không chính xác.' });
  }

  await req.user.updatePassword(newPassword);
  res.json({ ok: true, data: { updated: true } });
}));

module.exports = router;
