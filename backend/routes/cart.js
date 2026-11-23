const express = require('express');
const { pool, withTransaction } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, isPositiveInt } = require('../utils/validate');

const router = express.Router();

const SHIPPING_FEE = 30000;
const FREE_SHIP_THRESHOLD = 500000;

// Ham dung chung: nap thong tin gio hang tu danh sach [{ variantId, quantity }]
// Khong bao gio tin gia tu trinh duyet, luon lay gia va ton kho moi nhat tu DB
async function buildCartSummary(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      items: [],
      subtotal: 0,
      shippingFee: 0,
      freeShipThreshold: FREE_SHIP_THRESHOLD,
      freeShipRemaining: FREE_SHIP_THRESHOLD,
      hasUnavailable: false,
    };
  }

  const variantIds = [...new Set(rawItems.map((i) => Number(i.variantId)).filter((id) => Number.isInteger(id) && id > 0))];
  if (variantIds.length === 0) {
    return {
      items: [], subtotal: 0, shippingFee: 0,
      freeShipThreshold: FREE_SHIP_THRESHOLD, freeShipRemaining: FREE_SHIP_THRESHOLD, hasUnavailable: false,
    };
  }

  const placeholders = variantIds.map(() => '?').join(',');
  const [rows] = await pool.query(`
    SELECT pv.id AS variant_id, pv.sku, pv.label AS variant_label, pv.price, pv.compare_at_price,
           pv.stock, pv.is_active AS variant_active,
           p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.is_active AS product_active,
           (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) AS image
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE pv.id IN (${placeholders})
  `, variantIds);

  const mapById = new Map(rows.map((r) => [Number(r.variant_id), r]));
  let subtotal = 0;
  let hasUnavailable = false;
  const items = [];

  for (const raw of rawItems) {
    const vid = Number(raw.variantId);
    const qty = Math.max(1, Math.min(20, parseInt(raw.quantity, 10) || 1));
    const v = mapById.get(vid);
    if (!v) {
      hasUnavailable = true;
      items.push({
        variantId: vid,
        productName: 'Sản phẩm không còn tồn tại',
        variantLabel: '',
        price: 0,
        quantity: qty,
        lineTotal: 0,
        stock: 0,
        image: null,
        available: false,
        warning: 'Sản phẩm này đã bị xóa khỏi cửa hàng, vui lòng gỡ khỏi giỏ.',
      });
      continue;
    }

    const isActive = Boolean(v.product_active) && Boolean(v.variant_active);
    let warning = null;
    let available = true;

    if (!isActive) {
      available = false;
      warning = 'Sản phẩm này hiện đã ngừng kinh doanh, vui lòng xóa khỏi giỏ.';
    } else if (v.stock === 0) {
      available = false;
      warning = 'Sản phẩm hiện đã hết hàng, vui lòng xóa khỏi giỏ.';
    } else if (qty > v.stock) {
      available = false;
      warning = `Chỉ còn ${v.stock} sản phẩm trong kho, vui lòng giảm số lượng.`;
    }

    if (!available) hasUnavailable = true;
    const lineTotal = v.price * qty;
    if (available) subtotal += lineTotal;

    items.push({
      variantId: v.variant_id,
      productId: v.product_id,
      productName: v.product_name,
      productSlug: v.product_slug,
      variantLabel: v.variant_label,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      quantity: qty,
      lineTotal,
      stock: v.stock,
      image: v.image,
      available,
      warning,
    });
  }

  const shippingFee = subtotal > 0 && subtotal < FREE_SHIP_THRESHOLD ? SHIPPING_FEE : 0;
  const freeShipRemaining = Math.max(0, FREE_SHIP_THRESHOLD - subtotal);

  return {
    items,
    subtotal,
    shippingFee,
    freeShipThreshold: FREE_SHIP_THRESHOLD,
    freeShipRemaining,
    hasUnavailable,
  };
}

// Ham tinh va kiem tra ma giam gia (dung chung cho validate va dat hang)
async function evaluateCoupon(conn, rawCode, subtotal) {
  const code = trimStr(rawCode).toUpperCase();
  if (!code) throw new AppError(400, 'Vui lòng nhập mã giảm giá.');

  const [rows] = await conn.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [code]);
  if (rows.length === 0) {
    throw new AppError(404, 'Mã giảm giá không tồn tại.');
  }
  const coupon = rows[0];
  const now = new Date();

  if (!coupon.is_active) {
    throw new AppError(400, 'Mã giảm giá này hiện đang tạm khóa.');
  }
  if (now < new Date(coupon.starts_at)) {
    throw new AppError(400, 'Mã giảm giá chưa đến thời gian áp dụng.');
  }
  if (now > new Date(coupon.expires_at)) {
    throw new AppError(400, 'Mã giảm giá đã hết hạn sử dụng.');
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    throw new AppError(400, 'Mã giảm giá đã hết lượt sử dụng.');
  }
  if (subtotal < coupon.min_order_value) {
    const minStr = new Intl.NumberFormat('vi-VN').format(coupon.min_order_value);
    throw new AppError(400, `Mã ${coupon.code} chỉ áp dụng cho đơn từ ${minStr} ₫.`);
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percent') {
    discountAmount = Math.floor((subtotal * coupon.discount_value) / 100);
  } else {
    discountAmount = Math.min(coupon.discount_value, subtotal);
  }

  return { coupon, discountAmount };
}

// POST /api/cart/preview — cho khach vang lai xem gio localStorage voi gia that tu DB
router.post('/cart/preview', asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const summary = await buildCartSummary(items);
  res.json({ ok: true, data: summary });
}));

// GET /api/cart — gio hang cua khach da dang nhap
router.get('/cart', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  const summary = await buildCartSummary(rows);
  res.json({ ok: true, data: summary });
}));

// POST /api/cart/items — them san pham vao gio DB
router.post('/cart/items', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const variantId = Number(req.body.variantId);
  const quantity = Number(req.body.quantity || 1);

  if (!isPositiveInt(variantId) || !isPositiveInt(quantity) || quantity > 20) {
    throw new AppError(400, 'Số lượng phải từ 1 đến 20.');
  }

  const [vars] = await pool.query(`
    SELECT pv.id, pv.stock, pv.is_active AS v_active, p.is_active AS p_active
    FROM product_variants pv
    INNER JOIN products p ON p.id = pv.product_id
    WHERE pv.id = ? LIMIT 1
  `, [variantId]);

  if (vars.length === 0 || !vars[0].v_active || !vars[0].p_active) {
    throw new AppError(404, 'Biến thể sản phẩm không tồn tại hoặc đã ngừng bán.');
  }
  if (vars[0].stock <= 0) {
    throw new AppError(409, 'Sản phẩm này hiện đã hết hàng.');
  }

  const [existing] = await pool.query(
    'SELECT quantity FROM cart_items WHERE customer_id = ? AND variant_id = ? LIMIT 1',
    [req.user.id, variantId]
  );
  const currentQty = existing.length > 0 ? existing[0].quantity : 0;
  const nextQty = Math.min(20, currentQty + quantity);
  if (nextQty > vars[0].stock) {
    throw new AppError(409, `Kho chỉ còn ${vars[0].stock} sản phẩm cho lựa chọn này.`);
  }

  await pool.query(
    `INSERT INTO cart_items (customer_id, variant_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = ?`,
    [req.user.id, variantId, nextQty, nextQty]
  );

  const [rows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.status(201).json({ ok: true, data: await buildCartSummary(rows) });
}));

// PUT /api/cart/items/:variantId — cap nhat so luong trong gio
router.put('/cart/items/:variantId', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const variantId = Number(req.params.variantId);
  const quantity = Number(req.body.quantity);

  if (!isPositiveInt(variantId) || !isPositiveInt(quantity) || quantity > 20) {
    throw new AppError(400, 'Số lượng phải từ 1 đến 20.');
  }

  const [vars] = await pool.query('SELECT stock FROM product_variants WHERE id = ? LIMIT 1', [variantId]);
  if (vars.length === 0) throw new AppError(404, 'Không tìm thấy sản phẩm.');
  if (quantity > vars[0].stock) {
    throw new AppError(409, `Chỉ còn ${vars[0].stock} sản phẩm trong kho.`);
  }

  await pool.query(
    'UPDATE cart_items SET quantity = ? WHERE customer_id = ? AND variant_id = ?',
    [quantity, req.user.id, variantId]
  );

  const [rows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ ok: true, data: await buildCartSummary(rows) });
}));

// DELETE /api/cart/items/:variantId — xoa 1 dong khoi gio
router.delete('/cart/items/:variantId', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const variantId = Number(req.params.variantId);
  await pool.query('DELETE FROM cart_items WHERE customer_id = ? AND variant_id = ?', [req.user.id, variantId]);
  const [rows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ ok: true, data: await buildCartSummary(rows) });
}));

// POST /api/cart/merge — gop gio hang localStorage vao DB sau khi dang nhap
router.post('/cart/merge', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (guestItems.length > 0) {
    await withTransaction(async (conn) => {
      for (const item of guestItems) {
        const variantId = Number(item.variantId);
        const addQty = Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1));
        if (!isPositiveInt(variantId)) continue;

        const [vars] = await conn.query(
          `SELECT pv.stock, pv.is_active AS v_active, p.is_active AS p_active
           FROM product_variants pv INNER JOIN products p ON p.id = pv.product_id
           WHERE pv.id = ? LIMIT 1`,
          [variantId]
        );
        if (vars.length === 0 || !vars[0].v_active || !vars[0].p_active || vars[0].stock <= 0) continue;

        const [existing] = await conn.query(
          'SELECT quantity FROM cart_items WHERE customer_id = ? AND variant_id = ? LIMIT 1',
          [req.user.id, variantId]
        );
        const currentQty = existing.length > 0 ? existing[0].quantity : 0;
        const mergedQty = Math.min(20, vars[0].stock, currentQty + addQty);
        if (mergedQty <= 0) continue;

        await conn.query(
          `INSERT INTO cart_items (customer_id, variant_id, quantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = ?`,
          [req.user.id, variantId, mergedQty, mergedQty]
        );
      }
    });
  }

  const [rows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ ok: true, data: await buildCartSummary(rows) });
}));

// POST /api/coupons/validate — kiem tra ma giam gia (cho phep ca khach chua dang nhap hoac da dang nhap)
router.post('/coupons/validate', requirePermission('cart:use'), asyncHandler(async (req, res) => {
  const code = trimStr(req.body.code);
  const [cartRows] = await pool.query(
    'SELECT variant_id AS variantId, quantity FROM cart_items WHERE customer_id = ?',
    [req.user.id]
  );
  const summary = await buildCartSummary(cartRows);
  if (summary.subtotal <= 0) {
    throw new AppError(400, 'Giỏ hàng trống, chưa thể áp dụng mã giảm giá.');
  }

  const { coupon, discountAmount } = await evaluateCoupon(pool, code, summary.subtotal);
  res.json({
    ok: true,
    data: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount,
    },
  });
}));

router.evaluateCoupon = evaluateCoupon;
router.SHIPPING_FEE = SHIPPING_FEE;
router.FREE_SHIP_THRESHOLD = FREE_SHIP_THRESHOLD;

module.exports = router;
