const express = require('express');
const { pool } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, shortenCustomerName } = require('../utils/validate');

const router = express.Router();

// GET /api/reviews/latest — 3 danh gia 5 sao moi nhat cho trang chu
router.get('/reviews/latest', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT r.id, r.rating, r.title, r.content, r.created_at,
           u.full_name, p.name AS product_name, p.slug AS product_slug
    FROM reviews r
    INNER JOIN users u ON u.id = r.customer_id
    INNER JOIN products p ON p.id = r.product_id
    WHERE r.rating = 5 AND p.is_active = 1
    ORDER BY r.created_at DESC
    LIMIT 3
  `);
  const items = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    authorName: shortenCustomerName(r.full_name),
    productName: r.product_name,
    productSlug: r.product_slug,
  }));
  res.json({ ok: true, data: items });
}));

// GET /api/products/:slug/reviews — danh sach danh gia phan trang
router.get('/products/:slug/reviews', asyncHandler(async (req, res) => {
  const slug = trimStr(req.params.slug);
  const [prod] = await pool.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
  if (prod.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 5));
  const offset = (page - 1) * pageSize;

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM reviews WHERE product_id = ?', [prod[0].id]);
  const [rows] = await pool.query(`
    SELECT r.id, r.rating, r.title, r.content, r.created_at, u.full_name
    FROM reviews r
    INNER JOIN users u ON u.id = r.customer_id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `, [prod[0].id, pageSize, offset]);

  const items = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
    authorName: shortenCustomerName(r.full_name),
  }));

  res.json({
    ok: true,
    data: { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}));

// POST /api/products/:slug/reviews — chi khach da mua va nhan hang (completed) moi duoc viet
router.post('/products/:slug/reviews', requirePermission('reviews:write'), asyncHandler(async (req, res) => {
  const slug = trimStr(req.params.slug);
  const [prod] = await pool.query('SELECT id FROM products WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
  if (prod.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');
  const productId = prod[0].id;

  const rating = Number(req.body.rating);
  const title = trimStr(req.body.title);
  const content = trimStr(req.body.content);

  const errors = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Vui lòng chọn từ 1 đến 5 sao.';
  if (title.length < 3 || title.length > 150) errors.title = 'Tiêu đề đánh giá từ 3 đến 150 ký tự.';
  if (content.length < 10 || content.length > 1500) errors.content = 'Nội dung đánh giá từ 10 đến 1500 ký tự.';
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Thông tin đánh giá chưa hợp lệ.', errors);
  }

  // Kiem tra da mua va nhan hang
  const [bought] = await pool.query(`
    SELECT 1
    FROM orders o
    INNER JOIN order_items oi ON oi.order_id = o.id
    INNER JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE o.customer_id = ? AND o.status = 'completed' AND pv.product_id = ?
    LIMIT 1
  `, [req.user.id, productId]);

  if (bought.length === 0) {
    throw new AppError(403, 'Chỉ khách hàng đã mua và nhận sản phẩm này mới có thể đánh giá.');
  }

  const [existing] = await pool.query(
    'SELECT id FROM reviews WHERE product_id = ? AND customer_id = ? LIMIT 1',
    [productId, req.user.id]
  );
  if (existing.length > 0) {
    throw new AppError(409, 'Bạn đã đánh giá sản phẩm này trước đó.');
  }

  const [result] = await pool.query(
    `INSERT INTO reviews (product_id, customer_id, rating, title, content) VALUES (?, ?, ?, ?, ?)`,
    [productId, req.user.id, rating, title, content]
  );

  res.status(201).json({
    ok: true,
    data: {
      id: result.insertId,
      rating,
      title,
      content,
      authorName: shortenCustomerName(req.user.fullName),
      createdAt: new Date(),
    },
  });
}));

module.exports = router;
