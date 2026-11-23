const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/errors');

// Doc cookie JWT (neu co), tai nguoi dung tu DB va kiem tra trang thai blocked ngay lap tuc
async function attachUser(req, res, next) {
  req.user = null;
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || user.status !== 'active') {
      res.clearCookie('token');
      return next();
    }
    req.user = user;
  } catch (err) {
    res.clearCookie('token');
  }
  return next();
}

// Bat buoc da dang nhap (tra 401 neu chua)
function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new AppError(401, 'Vui lòng đăng nhập để tiếp tục.'));
  }
  return next();
}

module.exports = { attachUser, requireAuth };
