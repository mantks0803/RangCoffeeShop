// Lop loi nghiep vu mang theo ma HTTP va chi tiet loi theo tung truong (neu co)
class AppError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

// Boc route async de tu dong chuyen loi sang middleware xu ly loi cuoi cung
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Middleware xu ly loi tap trung, khong lo chi tiet ky thuat ra phia client
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { ok: false, message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.statusCode).json(body);
  }

  // Bat loi JSON khong hop le tu express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, message: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
  }

  // Bat loi trung khoa UNIQUE trong MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ ok: false, message: 'Dữ liệu đã tồn tại trong hệ thống.' });
  }

  console.error('[SERVER ERROR]', err);
  return res.status(500).json({
    ok: false,
    message: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.',
  });
}

module.exports = { AppError, asyncHandler, errorHandler };
