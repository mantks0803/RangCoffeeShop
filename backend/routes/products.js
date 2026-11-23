const express = require('express');
const { pool } = require('../config/db');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr } = require('../utils/validate');

const router = express.Router();

// Danh sach truong sap xep cho phep (whitelist chong SQL injection)
const SORT_MAP = {
  newest: 'created_at DESC, id DESC',
  price_asc: 'min_price ASC, id ASC',
  price_desc: 'min_price DESC, id DESC',
  bestseller: 'sold_count DESC, review_count DESC, id DESC',
  rating: 'avg_rating DESC, review_count DESC, id DESC',
};

// GET /api/categories — danh sach danh muc kem so luong san pham dang ban
router.get('/categories', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.id, c.name, c.slug, c.description, c.sort_order,
           COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.id ASC
  `);
  res.json({ ok: true, data: rows });
}));

// GET /api/products/meta — danh sach vung trong va khoang gia de dung bo loc
router.get('/products/meta', asyncHandler(async (req, res) => {
  const [originRows] = await pool.query(`
    SELECT DISTINCT origin
    FROM products
    WHERE is_active = 1 AND origin IS NOT NULL AND origin <> ''
    ORDER BY origin ASC
  `);
  const [[priceRange]] = await pool.query(`
    SELECT COALESCE(MIN(pv.price), 0) AS minPrice, COALESCE(MAX(pv.price), 0) AS maxPrice
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE p.is_active = 1 AND pv.is_active = 1
  `);
  res.json({
    ok: true,
    data: {
      origins: originRows.map((r) => r.origin),
      minPrice: Number(priceRange.minPrice || 0),
      maxPrice: Number(priceRange.maxPrice || 0),
    },
  });
}));

// GET /api/products/featured — 8 san pham noi bat cho trang chu
router.get('/products/featured', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT * FROM v_product_cards
    WHERE is_active = 1 AND is_featured = 1
    ORDER BY sold_count DESC, id ASC
    LIMIT 8
  `);
  res.json({ ok: true, data: rows });
}));

// GET /api/products — danh sach san pham co loc, tim kiem, sap xep, phan trang
router.get('/products', asyncHandler(async (req, res) => {
  const q = trimStr(req.query.q);
  const category = trimStr(req.query.category);
  const roast = trimStr(req.query.roast);
  const origin = trimStr(req.query.origin);
  const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null;
  const inStock = req.query.inStock === '1' || req.query.inStock === 'true';
  const sortKey = SORT_MAP[req.query.sort] ? req.query.sort : 'newest';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(24, Math.max(1, parseInt(req.query.pageSize, 10) || 12));

  const where = ['v.is_active = 1'];
  const params = [];

  if (q) {
    where.push('(v.name LIKE ? OR v.short_description LIKE ? OR EXISTS (SELECT 1 FROM products p2 WHERE p2.id = v.id AND p2.description LIKE ?))');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('v.category_slug = ?');
    params.push(category);
  }
  if (['light', 'medium', 'dark'].includes(roast)) {
    where.push('v.roast_level = ?');
    params.push(roast);
  }
  if (origin) {
    where.push('v.origin = ?');
    params.push(origin);
  }
  if (minPrice !== null && !Number.isNaN(minPrice)) {
    where.push('v.min_price >= ?');
    params.push(minPrice);
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    where.push('v.min_price <= ?');
    params.push(maxPrice);
  }
  if (inStock) {
    where.push('v.total_stock > 0');
  }

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM v_product_cards v WHERE ${whereSql}`, params);

  const offset = (page - 1) * pageSize;
  const [items] = await pool.query(
    `SELECT * FROM v_product_cards v WHERE ${whereSql} ORDER BY ${SORT_MAP[sortKey]} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({
    ok: true,
    data: {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}));

// GET /api/products/:slug — chi tiet san pham kem bien the, anh, thong ke danh gia va canReview
router.get('/products/:slug', asyncHandler(async (req, res) => {
  const slug = trimStr(req.params.slug);
  const [rows] = await pool.query(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ? AND p.is_active = 1
    LIMIT 1
  `, [slug]);

  if (rows.length === 0) {
    throw new AppError(404, 'Không tìm thấy sản phẩm này.');
  }
  const product = rows[0];

  const [variants] = await pool.query(
    `SELECT id, sku, label, price, compare_at_price, stock
     FROM product_variants
     WHERE product_id = ? AND is_active = 1
     ORDER BY price ASC, id ASC`,
    [product.id]
  );

  const [images] = await pool.query(
    `SELECT id, url, alt_text, sort_order, is_primary
     FROM product_images
     WHERE product_id = ?
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    [product.id]
  );

  // Thong ke phan bo sao tu 1 den 5
  const [ratingRows] = await pool.query(
    `SELECT rating, COUNT(*) AS cnt FROM reviews WHERE product_id = ? GROUP BY rating`,
    [product.id]
  );
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalReviews = 0;
  let sumRating = 0;
  for (const r of ratingRows) {
    breakdown[r.rating] = Number(r.cnt);
    totalReviews += Number(r.cnt);
    sumRating += r.rating * Number(r.cnt);
  }
  const avgRating = totalReviews > 0 ? Number((sumRating / totalReviews).toFixed(1)) : 0;

  // Kiem tra khach hien tai co duoc viet danh gia khong
  let canReview = false;
  let hasReviewed = false;
  if (req.user && req.user.role === 'customer') {
    const [existing] = await pool.query(
      'SELECT id FROM reviews WHERE product_id = ? AND customer_id = ? LIMIT 1',
      [product.id, req.user.id]
    );
    hasReviewed = existing.length > 0;
    if (!hasReviewed) {
      const [bought] = await pool.query(`
        SELECT 1
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE o.customer_id = ? AND o.status = 'completed' AND pv.product_id = ?
        LIMIT 1
      `, [req.user.id, product.id]);
      canReview = bought.length > 0;
    }
  }

  res.json({
    ok: true,
    data: {
      ...product,
      variants,
      images,
      reviewSummary: { avgRating, totalReviews, breakdown },
      canReview,
      hasReviewed,
    },
  });
}));

// GET /api/products/:slug/related — 4 san pham cung danh muc
router.get('/products/:slug/related', asyncHandler(async (req, res) => {
  const slug = trimStr(req.params.slug);
  const [found] = await pool.query('SELECT id, category_id FROM products WHERE slug = ? LIMIT 1', [slug]);
  if (found.length === 0) {
    return res.json({ ok: true, data: [] });
  }
  const [rows] = await pool.query(`
    SELECT * FROM v_product_cards
    WHERE is_active = 1 AND category_id = ? AND id <> ?
    ORDER BY sold_count DESC, id ASC
    LIMIT 4
  `, [found[0].category_id, found[0].id]);
  res.json({ ok: true, data: rows });
}));

module.exports = router;
