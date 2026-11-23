const express = require('express');
const { pool, withTransaction } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, isNonNegativeInt, isPositiveInt, isInEnum, slugify } = require('../utils/validate');

const router = express.Router();

// Quy tac chuyen trang thai don hang hop le (khong cho phep chuyen nguoc)
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ============================================================================
// 1. TONG QUAN (DASHBOARD)
// ============================================================================
router.get('/stats', requirePermission('dashboard:read'), asyncHandler(async (req, res) => {
  const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;

  // KPI 30 ngay gan nhat va 30 ngay truoc do (doanh thu chi tinh don completed)
  const [[curr30]] = await pool.query(`
    SELECT COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS revenue,
           COUNT(*) AS totalOrders,
           DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS chartDate,
           COALESCE(AVG(CASE WHEN status = 'completed' THEN total ELSE NULL END), 0) AS avgOrderValue
    FROM orders
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  `);

  const [[prev30]] = await pool.query(`
    SELECT COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS revenue
    FROM orders
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
      AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
  `);

  const [[pendingRow]] = await pool.query(`SELECT COUNT(*) AS cnt FROM orders WHERE status = 'pending'`);

  const revCurr = Number(curr30.revenue || 0);
  const revPrev = Number(prev30.revenue || 0);
  const revenueGrowth = revPrev > 0 ? Number((((revCurr - revPrev) / revPrev) * 100).toFixed(1)) : (revCurr > 0 ? 100 : 0);

  // Doanh thu theo ngay trong khoang range ngay (chi don completed)
  const [dailyRows] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
           COALESCE(SUM(total), 0) AS revenue,
           COUNT(*) AS orderCount
    FROM orders
    WHERE status = 'completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    ORDER BY day ASC
  `, [range - 1]);

  const dailyMap = new Map(dailyRows.map((r) => [r.day, { revenue: Number(r.revenue), orderCount: Number(r.orderCount) }]));
  const dailyRevenue = [];
  const today = new Date(`${curr30.chartDate}T00:00:00Z`);
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = dailyMap.get(key) || { revenue: 0, orderCount: 0 };
    dailyRevenue.push({ date: key, revenue: found.revenue, orderCount: found.orderCount });
  }

  // Top 5 san pham ban chay (don completed)
  const [topProducts] = await pool.query(`
    SELECT p.id, p.name, p.slug,
           SUM(oi.quantity) AS totalSold,
           SUM(oi.line_total) AS revenue
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
    INNER JOIN product_variants pv ON pv.id = oi.variant_id
    INNER JOIN products p ON p.id = pv.product_id
    GROUP BY p.id, p.name, p.slug
    ORDER BY totalSold DESC
    LIMIT 5
  `);

  // Ti le don theo trang thai
  const [statusRows] = await pool.query(`SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status`);
  const statusBreakdown = { pending: 0, confirmed: 0, shipping: 0, completed: 0, cancelled: 0 };
  for (const r of statusRows) statusBreakdown[r.status] = Number(r.cnt);

  // Bien the sap het hang (stock <= 5)
  const [lowStock] = await pool.query(`
    SELECT pv.id AS variantId, pv.sku, pv.label, pv.stock, p.id AS productId, p.name AS productName
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE pv.is_active = 1 AND p.is_active = 1 AND pv.stock <= 5
    ORDER BY pv.stock ASC, p.name ASC
    LIMIT 15
  `);

  // Tong hop ton kho cua tat ca bien the dang ban.
  const [[stockRow]] = await pool.query(`
    SELECT COUNT(CASE WHEN pv.stock = 0 THEN 1 END) AS outOfStock,
           COUNT(CASE WHEN pv.stock BETWEEN 1 AND 5 THEN 1 END) AS lowStock,
           COUNT(CASE WHEN pv.stock > 5 THEN 1 END) AS inStock
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE pv.is_active = 1 AND p.is_active = 1
  `);
  const stockBreakdown = {
    outOfStock: Number(stockRow.outOfStock),
    lowStock: Number(stockRow.lowStock),
    inStock: Number(stockRow.inStock),
  };

  // 8 don hang moi nhat
  const [recentOrders] = await pool.query(`
    SELECT o.order_code, o.status, o.payment_method, o.payment_status, o.total, o.created_at,
           u.full_name AS customerName
    FROM orders o
    INNER JOIN users u ON u.id = o.customer_id
    ORDER BY o.created_at DESC
    LIMIT 8
  `);

  res.json({
    ok: true,
    data: {
      kpi: {
        revenue30d: revCurr,
        revenueGrowth,
        orders30d: Number(curr30.totalOrders || 0),
        pendingOrders: Number(pendingRow.cnt || 0),
        avgOrderValue: Math.round(Number(curr30.avgOrderValue || 0)),
      },
      range,
      dailyRevenue,
      topProducts,
      statusBreakdown,
      stockBreakdown,
      lowStock,
      recentOrders,
    },
  });
}));

// ============================================================================
// 2. QUAN LY SAN PHAM & DANH MUC
// ============================================================================
router.get('/products', requirePermission('products:read'), asyncHandler(async (req, res) => {
  const q = trimStr(req.query.q);
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const status = trimStr(req.query.status); // 'active' | 'inactive'
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 15));

  const where = ['1 = 1'];
  const params = [];
  if (q) {
    where.push('(v.name LIKE ? OR v.slug LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (categoryId) {
    where.push('v.category_id = ?');
    params.push(categoryId);
  }
  if (status === 'active') where.push('v.is_active = 1');
  if (status === 'inactive') where.push('v.is_active = 0');

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM v_product_cards v WHERE ${whereSql}`, params);
  const offset = (page - 1) * pageSize;

  const [items] = await pool.query(
    `SELECT * FROM v_product_cards v WHERE ${whereSql} ORDER BY v.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  // Lay danh sach bien the kem theo de sua ton kho nhanh tren bang
  const productIds = items.map((i) => i.id);
  let variantsByProduct = new Map();
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',');
    const [vars] = await pool.query(
      `SELECT id, product_id, sku, label, price, stock FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY price ASC, id ASC`,
      productIds
    );
    for (const v of vars) {
      if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
      variantsByProduct.get(v.product_id).push(v);
    }
  }

  const enriched = items.map((p) => ({
    ...p,
    variants: variantsByProduct.get(p.id) || [],
  }));

  res.json({
    ok: true,
    data: { items: enriched, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}));

router.get('/products/:id', requirePermission('products:read'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');
  const [variants] = await pool.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [id]);
  const [images] = await pool.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC', [id]);
  res.json({ ok: true, data: { ...rows[0], variants, images } });
}));

function validateProductPayload(body) {
  const name = trimStr(body.name);
  const slug = slugify(trimStr(body.slug) || name);
  const categoryId = Number(body.categoryId);
  const shortDescription = trimStr(body.shortDescription);
  const description = trimStr(body.description);
  const origin = trimStr(body.origin) || null;
  const roastLevel = trimStr(body.roastLevel) || null;
  const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1;
  const isFeatured = body.isFeatured ? 1 : 0;
  const variants = Array.isArray(body.variants) ? body.variants : [];
  const images = Array.isArray(body.images) ? body.images : [];

  const errors = {};
  if (name.length < 3 || name.length > 180) errors.name = 'Tên sản phẩm từ 3 đến 180 ký tự.';
  if (!slug) errors.slug = 'Slug không hợp lệ.';
  if (!isPositiveInt(categoryId)) errors.categoryId = 'Vui lòng chọn danh mục.';
  if (shortDescription.length < 5 || shortDescription.length > 255) errors.shortDescription = 'Mô tả ngắn từ 5 đến 255 ký tự.';
  if (description.length < 15) errors.description = 'Mô tả chi tiết tối thiểu 15 ký tự.';
  if (roastLevel && !isInEnum(roastLevel, ['light', 'medium', 'dark'])) errors.roastLevel = 'Mức rang không hợp lệ.';
  if (variants.length === 0) errors.variants = 'Cần có ít nhất 1 biến thể sản phẩm.';

  const skuSet = new Set();
  const cleanVariants = variants.map((v, idx) => {
    const sku = trimStr(v.sku).toUpperCase();
    const label = trimStr(v.label);
    const price = Number(v.price);
    const compareAtPrice = v.compareAtPrice !== null && v.compareAtPrice !== '' && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null;
    const stock = Number(v.stock);
    if (!sku) errors[`variant_${idx}_sku`] = 'SKU không được để trống.';
    if (skuSet.has(sku)) errors[`variant_${idx}_sku`] = 'SKU bị trùng lặp trong danh sách.';
    skuSet.add(sku);
    if (!label) errors[`variant_${idx}_label`] = 'Nhãn biến thể không được để trống.';
    if (!isNonNegativeInt(price)) errors[`variant_${idx}_price`] = 'Giá phải là số nguyên không âm.';
    if (compareAtPrice !== null && !isNonNegativeInt(compareAtPrice)) errors[`variant_${idx}_compare`] = 'Giá gốc phải là số nguyên không âm.';
    if (!isNonNegativeInt(stock)) errors[`variant_${idx}_stock`] = 'Tồn kho phải là số nguyên không âm.';
    return { id: v.id ? Number(v.id) : null, sku, label, price, compareAtPrice, stock };
  });

  const cleanImages = images
    .map((im, idx) => ({
      url: trimStr(im.url),
      altText: trimStr(im.altText) || `${name} - ảnh ${idx + 1}`,
      isPrimary: Boolean(im.isPrimary),
      sortOrder: idx + 1,
    }))
    .filter((im) => im.url.length > 0);

  if (cleanImages.length === 0) errors.images = 'Cần ít nhất 1 đường dẫn ảnh sản phẩm.';
  if (cleanImages.length > 0 && !cleanImages.some((im) => im.isPrimary)) {
    cleanImages[0].isPrimary = true;
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Thông tin sản phẩm chưa hợp lệ.', errors);
  }

  return {
    name, slug, categoryId, shortDescription, description, origin, roastLevel,
    isActive, isFeatured, variants: cleanVariants, images: cleanImages,
  };
}

router.post('/products', requirePermission('products:write'), asyncHandler(async (req, res) => {
  const data = validateProductPayload(req.body);

  const productId = await withTransaction(async (conn) => {
    const [dupSlug] = await conn.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [data.slug]);
    if (dupSlug.length > 0) throw new AppError(409, 'Slug này đã được sử dụng.', { slug: 'Slug đã tồn tại.' });

    for (const v of data.variants) {
      const [dupSku] = await conn.query('SELECT id FROM product_variants WHERE sku = ? LIMIT 1', [v.sku]);
      if (dupSku.length > 0) throw new AppError(409, `Mã SKU ${v.sku} đã tồn tại.`);
    }

    const [pRes] = await conn.query(
      `INSERT INTO products (category_id, name, slug, short_description, description, origin, roast_level, is_active, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.categoryId, data.name, data.slug, data.shortDescription, data.description, data.origin, data.roastLevel, data.isActive, data.isFeatured]
    );
    const pid = pRes.insertId;

    for (const v of data.variants) {
      await conn.query(
        `INSERT INTO product_variants (product_id, sku, label, price, compare_at_price, stock, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [pid, v.sku, v.label, v.price, v.compareAtPrice, v.stock]
      );
    }
    for (const im of data.images) {
      await conn.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
         VALUES (?, ?, ?, ?, ?)`,
        [pid, im.url, im.altText, im.sortOrder, im.isPrimary ? 1 : 0]
      );
    }
    return pid;
  });

  res.status(201).json({ ok: true, data: { id: productId } });
}));

router.put('/products/:id', requirePermission('products:write'), asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const data = validateProductPayload(req.body);

  await withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
    if (existing.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');

    const [dupSlug] = await conn.query('SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1', [data.slug, productId]);
    if (dupSlug.length > 0) throw new AppError(409, 'Slug này đã được dùng cho sản phẩm khác.', { slug: 'Slug đã tồn tại.' });

    await conn.query(
      `UPDATE products
       SET category_id = ?, name = ?, slug = ?, short_description = ?, description = ?,
           origin = ?, roast_level = ?, is_active = ?, is_featured = ?
       WHERE id = ?`,
      [data.categoryId, data.name, data.slug, data.shortDescription, data.description, data.origin, data.roastLevel, data.isActive, data.isFeatured, productId]
    );

    // Cap nhat bien the trong transaction (giu id cu neu trung de khong mat lien ket, xoa bien the khong con)
    const [oldVars] = await conn.query('SELECT id FROM product_variants WHERE product_id = ?', [productId]);
    const oldIds = new Set(oldVars.map((r) => Number(r.id)));
    const keepIds = new Set();

    for (const v of data.variants) {
      const [dupSku] = await conn.query(
        'SELECT id FROM product_variants WHERE sku = ? AND id <> ? LIMIT 1',
        [v.sku, v.id || 0]
      );
      if (dupSku.length > 0) throw new AppError(409, `Mã SKU ${v.sku} đã thuộc về biến thể khác.`);

      if (v.id && oldIds.has(v.id)) {
        keepIds.add(v.id);
        await conn.query(
          `UPDATE product_variants SET sku = ?, label = ?, price = ?, compare_at_price = ?, stock = ?, is_active = 1
           WHERE id = ? AND product_id = ?`,
          [v.sku, v.label, v.price, v.compareAtPrice, v.stock, v.id, productId]
        );
      } else {
        const [ins] = await conn.query(
          `INSERT INTO product_variants (product_id, sku, label, price, compare_at_price, stock, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [productId, v.sku, v.label, v.price, v.compareAtPrice, v.stock]
        );
        keepIds.add(ins.insertId);
      }
    }

    for (const oid of oldIds) {
      if (!keepIds.has(oid)) {
        await conn.query('DELETE FROM product_variants WHERE id = ?', [oid]);
      }
    }

    // Thay toan bo anh trong transaction
    await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    for (const im of data.images) {
      await conn.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
         VALUES (?, ?, ?, ?, ?)`,
        [productId, im.url, im.altText, im.sortOrder, im.isPrimary ? 1 : 0]
      );
    }
  });

  res.json({ ok: true, data: { updated: true } });
}));

// DELETE /api/admin/products/:id — neu da nam trong don hang thi chi an, nguoc lai xoa han
router.delete('/products/:id', requirePermission('products:write'), asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const [rows] = await pool.query('SELECT id, name FROM products WHERE id = ? LIMIT 1', [productId]);
  if (rows.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');

  const [inOrders] = await pool.query(`
    SELECT 1
    FROM order_items oi
    INNER JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE pv.product_id = ?
    LIMIT 1
  `, [productId]);

  if (inOrders.length > 0) {
    await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [productId]);
    return res.json({
      ok: true,
      data: {
        mode: 'hidden',
        message: 'Sản phẩm đã xuất hiện trong lịch sử đơn hàng nên hệ thống chuyển sang trạng thái ẩn thay vì xóa hẳn.',
      },
    });
  }

  await pool.query('DELETE FROM products WHERE id = ?', [productId]);
  res.json({ ok: true, data: { mode: 'deleted', message: 'Đã xóa hẳn sản phẩm khỏi hệ thống.' } });
}));

router.patch('/products/:id/active', requirePermission('products:write'), asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const isActive = req.body.isActive ? 1 : 0;
  await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [isActive, productId]);
  res.json({ ok: true, data: { isActive: Boolean(isActive) } });
}));

router.patch('/variants/:id/stock', requirePermission('products:write'), asyncHandler(async (req, res) => {
  const variantId = Number(req.params.id);
  const stock = Number(req.body.stock);
  if (!isNonNegativeInt(stock)) {
    throw new AppError(400, 'Tồn kho phải là số nguyên không âm.');
  }
  const [resUpd] = await pool.query('UPDATE product_variants SET stock = ? WHERE id = ?', [stock, variantId]);
  if (resUpd.affectedRows === 0) throw new AppError(404, 'Không tìm thấy biến thể.');
  res.json({ ok: true, data: { variantId, stock } });
}));

// Danh muc
router.get('/categories', requirePermission('products:read'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.id ASC
  `);
  res.json({ ok: true, data: rows });
}));

router.post('/categories', requirePermission('categories:write'), asyncHandler(async (req, res) => {
  const name = trimStr(req.body.name);
  const slug = slugify(trimStr(req.body.slug) || name);
  const description = trimStr(req.body.description) || null;
  const sortOrder = Number(req.body.sortOrder || 0);
  if (name.length < 2) throw new AppError(400, 'Tên danh mục tối thiểu 2 ký tự.');
  if (!slug) throw new AppError(400, 'Slug danh mục không hợp lệ.');

  const [dup] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  if (dup.length > 0) throw new AppError(409, 'Slug danh mục đã tồn tại.');

  const [r] = await pool.query(
    'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
    [name, slug, description, Math.max(0, sortOrder)]
  );
  res.status(201).json({ ok: true, data: { id: r.insertId, name, slug, description, sort_order: sortOrder } });
}));

router.put('/categories/:id', requirePermission('categories:write'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const name = trimStr(req.body.name);
  const slug = slugify(trimStr(req.body.slug) || name);
  const description = trimStr(req.body.description) || null;
  const sortOrder = Number(req.body.sortOrder || 0);
  if (name.length < 2) throw new AppError(400, 'Tên danh mục tối thiểu 2 ký tự.');

  const [dup] = await pool.query('SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1', [slug, id]);
  if (dup.length > 0) throw new AppError(409, 'Slug danh mục đã tồn tại.');

  await pool.query(
    'UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?',
    [name, slug, description, Math.max(0, sortOrder), id]
  );
  res.json({ ok: true, data: { updated: true } });
}));

// ============================================================================
// 3. QUAN LY DON HANG
// ============================================================================
router.get('/orders', requirePermission('orders:read_all'), asyncHandler(async (req, res) => {
  const status = trimStr(req.query.status);
  const q = trimStr(req.query.q);
  const dateFrom = trimStr(req.query.dateFrom);
  const dateTo = trimStr(req.query.dateTo);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 15));

  const where = ['1 = 1'];
  const params = [];
  if (isInEnum(status, ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'])) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(o.order_code LIKE ? OR o.recipient_name LIKE ? OR o.phone LIKE ? OR u.full_name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (dateFrom) {
    where.push('DATE(o.created_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('DATE(o.created_at) <= ?');
    params.push(dateTo);
  }

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o INNER JOIN users u ON u.id = o.customer_id WHERE ${whereSql}`,
    params
  );

  const offset = (page - 1) * pageSize;
  const [items] = await pool.query(`
    SELECT o.id, o.order_code, o.status, o.payment_method, o.payment_status,
           o.recipient_name, o.phone, o.total, o.created_at, u.full_name AS customer_name, u.email AS customer_email
    FROM orders o
    INNER JOIN users u ON u.id = o.customer_id
    WHERE ${whereSql}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  // Dem so don theo tung trang thai de hien tren chip loc
  const [counts] = await pool.query('SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status');
  const statusCounts = { all: 0, pending: 0, confirmed: 0, shipping: 0, completed: 0, cancelled: 0 };
  for (const r of counts) {
    statusCounts[r.status] = Number(r.cnt);
    statusCounts.all += Number(r.cnt);
  }

  res.json({
    ok: true,
    data: { items, statusCounts, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}));

router.get('/orders/:code', requirePermission('orders:read_all'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);
  const [rows] = await pool.query(`
    SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, c.code AS coupon_code
    FROM orders o
    INNER JOIN users u ON u.id = o.customer_id
    LEFT JOIN coupons c ON c.id = o.coupon_id
    WHERE o.order_code = ? LIMIT 1
  `, [code]);
  if (rows.length === 0) throw new AppError(404, 'Không tìm thấy đơn hàng.');
  const order = rows[0];

  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const [history] = await pool.query(`
    SELECT h.*, u.full_name AS actor_name
    FROM order_status_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.order_id = ?
    ORDER BY h.created_at ASC, h.id ASC
  `, [order.id]);

  res.json({
    ok: true,
    data: {
      ...order,
      items,
      history,
      allowedNextStatuses: ALLOWED_TRANSITIONS[order.status] || [],
    },
  });
}));

router.patch('/orders/:code/status', requirePermission('orders:update'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);
  const nextStatus = trimStr(req.body.status);
  const note = trimStr(req.body.note).slice(0, 300) || null;

  await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM orders WHERE order_code = ? LIMIT 1 FOR UPDATE', [code]);
    if (rows.length === 0) throw new AppError(404, 'Không tìm thấy đơn hàng.');
    const order = rows[0];

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new AppError(400, `Không thể chuyển đơn hàng từ "${order.status}" sang "${nextStatus}".`);
    }

    let nextPaymentStatus = order.payment_status;

    if (nextStatus === 'cancelled') {
      // Hoan ton kho va giam luot dung coupon
      const [items] = await conn.query('SELECT variant_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
      for (const item of items) {
        if (item.variant_id) {
          await conn.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, item.variant_id]);
        }
      }
      if (order.coupon_id) {
        await conn.query('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE id = ?', [order.coupon_id]);
      }
      if (order.payment_status === 'paid') {
        nextPaymentStatus = 'refunded';
      }
    } else if (nextStatus === 'completed') {
      // Don COD tu dong danh dau da thanh toan; cong diem tich luy 1 diem / 10.000 d
      if (order.payment_method === 'cod') {
        nextPaymentStatus = 'paid';
      }
      const points = Math.floor(Number(order.total) / 10000);
      if (points > 0) {
        await conn.query('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE user_id = ?', [points, order.customer_id]);
      }
    }

    await conn.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      [nextStatus, nextPaymentStatus, order.id]
    );
    await conn.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES (?, ?, ?, ?, ?)`,
      [order.id, order.status, nextStatus, req.user.id, note || `Cập nhật trạng thái sang ${nextStatus}`]
    );
  });

  res.json({ ok: true, data: { updated: true } });
}));

router.patch('/orders/:code/payment', requirePermission('orders:update'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);
  const paymentStatus = trimStr(req.body.paymentStatus);
  if (!isInEnum(paymentStatus, ['unpaid', 'paid', 'refunded'])) {
    throw new AppError(400, 'Trạng thái thanh toán không hợp lệ.');
  }
  const [r] = await pool.query('UPDATE orders SET payment_status = ? WHERE order_code = ?', [paymentStatus, code]);
  if (r.affectedRows === 0) throw new AppError(404, 'Không tìm thấy đơn hàng.');
  res.json({ ok: true, data: { paymentStatus } });
}));

// ============================================================================
// 4. QUAN LY KHACH HANG
// ============================================================================
router.get('/customers', requirePermission('customers:read'), asyncHandler(async (req, res) => {
  const q = trimStr(req.query.q);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 15));

  const where = ["u.role = 'customer'"];
  const params = [];
  if (q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const whereSql = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u WHERE ${whereSql}`, params);
  const offset = (page - 1) * pageSize;

  const [items] = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, c.loyalty_points,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) AS total_spent
    FROM users u
    INNER JOIN customers c ON c.user_id = u.id
    LEFT JOIN orders o ON o.customer_id = u.id
    WHERE ${whereSql}
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  res.json({
    ok: true,
    data: { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}));

router.get('/customers/:id', requirePermission('customers:read'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, c.birthday, c.loyalty_points
    FROM users u
    INNER JOIN customers c ON c.user_id = u.id
    WHERE u.id = ? AND u.role = 'customer' LIMIT 1
  `, [id]);
  if (rows.length === 0) throw new AppError(404, 'Không tìm thấy khách hàng.');

  const [recentOrders] = await pool.query(`
    SELECT order_code, status, payment_status, total, created_at
    FROM orders WHERE customer_id = ?
    ORDER BY created_at DESC LIMIT 5
  `, [id]);

  res.json({ ok: true, data: { ...rows[0], recentOrders } });
}));

router.patch('/customers/:id/status', requirePermission('users:manage'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = trimStr(req.body.status);
  if (!isInEnum(status, ['active', 'blocked'])) {
    throw new AppError(400, 'Trạng thái tài khoản không hợp lệ.');
  }
  const [r] = await pool.query("UPDATE users SET status = ? WHERE id = ? AND role = 'customer'", [status, id]);
  if (r.affectedRows === 0) throw new AppError(404, 'Không tìm thấy khách hàng.');
  res.json({ ok: true, data: { id, status } });
}));

module.exports = router;
