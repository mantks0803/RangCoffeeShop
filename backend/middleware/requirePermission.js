const { AppError } = require('../utils/errors');

// Middleware kiem tra quyen dua tren phuong thuc da hinh user.can(permission)
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Vui lòng đăng nhập để tiếp tục.'));
    }
    if (!req.user.can(permission)) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này.'));
    }
    return next();
  };
}

module.exports = requirePermission;
