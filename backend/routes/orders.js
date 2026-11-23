const express = require('express');
const { pool, withTransaction } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');
const { evaluateCoupon, SHIPPING_FEE, FREE_SHIP_THRESHOLD } = require('./cart');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, isValidPhone, normalizePhone, isInEnum } = require('../utils/validate');

const router = express.Router();

// Tao ma don hang duy nhat dang NR-YYYYMMDD-XXXX
async function generateOrderCode(conn) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `NR-${yyyy}${mm}${dd}-`;
  const [rows] = await conn.query(
    'SELECT order_code FROM orders WHERE order_code LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length > 0) {
    const lastPart = parseInt(rows[0].order_code.split('-').pop(), 10);
    if (!Number.isNaN(lastPart)) seq = lastPart + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Lay va kiem tra thong tin dia chi giao hang khi dat don
async function resolveShippingInfo(conn, customerId, body) {
  if (body.addressId) {
    const [rows] = await conn.query(
      'SELECT * FROM addresses WHERE id = ? AND customer_id = ? LIMIT 1',
      [Number(body.addressId), customerId]
    );
    if (rows.length === 0) throw new AppError(404, 'Địa chỉ đã chọn không tồn tại.');
    const a = rows[0];
    return {
      recipientName: a.recipient_name,
      phone: a.phone,
      shippingAddress: `${a.street}, ${a.ward}, ${a.district}, ${a.province}`,
    };
  }

  const recipientName = trimStr(body.recipientName);
  const phone = trimStr(body.phone);
  const province = trimStr(body.province);
  const district = trimStr(body.district);
  const ward = trimStr(body.ward);
  const street = trimStr(body.street);

  const errors = {};
  if (recipientName.length < 2) errors.recipientName = 'Vui lòng nhập họ tên người nhận.';
  if (!isValidPhone(phone)) errors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
  if (!province) errors.province = 'Vui lòng nhập Tỉnh/Thành phố.';
  if (!district) errors.district = 'Vui lòng nhập Quận/Huyện.';
  if (!ward) errors.ward = 'Vui lòng nhập Phường/Xã.';
  if (street.length < 3) errors.street = 'Vui lòng nhập địa chỉ số nhà, tên đường.';
  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Vui lòng kiểm tra lại địa chỉ giao hàng.', errors);
  }

  const cleanPhone = normalizePhone(phone);
  if (body.saveAddress) {
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM addresses WHERE customer_id = ?', [customerId]);
    await conn.query(
      `INSERT INTO addresses (customer_id, recipient_name, phone, province, district, ward, street, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, recipientName, cleanPhone, province, district, ward, street, cnt === 0 ? 1 : 0]
    );
  }

  return {
    recipientName,
    phone: cleanPhone,
    shippingAddress: `${street}, ${ward}, ${district}, ${province}`,
  };
}

// POST /api/orders — dat hang trong 1 transaction voi SELECT ... FOR UPDATE chong am kho
router.post('/', requirePermission('orders:create'), asyncHandler(async (req, res) => {
  const paymentMethod = trimStr(req.body.paymentMethod);
  const note = trimStr(req.body.note).slice(0, 500) || null;
  const couponCode = trimStr(req.body.couponCode);

  if (!isInEnum(paymentMethod, ['cod', 'bank_transfer'])) {
    throw new AppError(400, 'Phương thức thanh toán không hợp lệ.');
  }

  const createdOrder = await withTransaction(async (conn) => {
    // 1. Doc gio hang cua khach
    const [cartRows] = await conn.query(
      'SELECT variant_id, quantity FROM cart_items WHERE customer_id = ? ORDER BY variant_id ASC',
      [req.user.id]
    );
    if (cartRows.length === 0) {
      throw new AppError(400, 'Giỏ hàng trống, không thể đặt đơn.');
    }

    // 2. Khoa cac dong bien the bang SELECT ... FOR UPDATE de tranh tranh chap ton kho
    const variantIds = cartRows.map((c) => c.variant_id);
    const placeholders = variantIds.map(() => '?').join(',');
    const [lockedVars] = await conn.query(`
      SELECT pv.id, pv.label, pv.price, pv.stock, pv.is_active AS v_active,
             p.name AS product_name, p.is_active AS p_active
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      WHERE pv.id IN (${placeholders})
      ORDER BY pv.id ASC
      FOR UPDATE
    `, variantIds);

    const varMap = new Map(lockedVars.map((v) => [Number(v.id), v]));
    const stockIssues = [];
    let subtotal = 0;
    const preparedItems = [];

    for (const c of cartRows) {
      const v = varMap.get(Number(c.variant_id));
      if (!v || !v.v_active || !v.p_active) {
        stockIssues.push('Một sản phẩm trong giỏ đã ngừng kinh doanh.');
        continue;
      }
      if (v.stock < c.quantity) {
        stockIssues.push(`${v.product_name} (${v.label}) chỉ còn ${v.stock} sản phẩm trong kho.`);
        continue;
      }
      const lineTotal = v.price * c.quantity;
      subtotal += lineTotal;
      preparedItems.push({
        variantId: v.id,
        productName: v.product_name,
        variantLabel: v.label,
        unitPrice: v.price,
        quantity: c.quantity,
        lineTotal,
      });
    }

    if (stockIssues.length > 0) {
      throw new AppError(409, stockIssues.join(' '), { stockIssues });
    }

    // 3. Kiem tra dia chi giao hang
    const shipping = await resolveShippingInfo(conn, req.user.id, req.body);

    // 4. Tinh phi ship va ma giam gia o server
    const shippingFee = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FEE;
    let couponId = null;
    let discountAmount = 0;

    if (couponCode) {
      const evaluated = await evaluateCoupon(conn, couponCode, subtotal);
      couponId = evaluated.coupon.id;
      discountAmount = evaluated.discountAmount;
      await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
    }

    const total = Math.max(0, subtotal + shippingFee - discountAmount);
    const orderCode = await generateOrderCode(conn);

    // 5. Tao don hang
    const [orderRes] = await conn.query(
      `INSERT INTO orders (
         order_code, customer_id, status, payment_method, payment_status,
         recipient_name, phone, shipping_address, note,
         subtotal, shipping_fee, discount_amount, total, coupon_id
       ) VALUES (?, ?, 'pending', ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderCode, req.user.id, paymentMethod,
        shipping.recipientName, shipping.phone, shipping.shippingAddress, note,
        subtotal, shippingFee, discountAmount, total, couponId,
      ]
    );
    const orderId = orderRes.insertId;

    // 6. Tao chi tiet don hang va tru ton kho
    for (const item of preparedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, variant_id, product_name, variant_label, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.variantId, item.productName, item.variantLabel, item.unitPrice, item.quantity, item.lineTotal]
      );
      await conn.query('UPDATE product_variants SET stock = stock - ? WHERE id = ?', [item.quantity, item.variantId]);
    }

    // 7. Xoa gio hang va ghi lich su trang thai
    await conn.query('DELETE FROM cart_items WHERE customer_id = ?', [req.user.id]);
    await conn.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES (?, NULL, 'pending', ?, 'Khách đặt đơn hàng mới')`,
      [orderId, req.user.id]
    );

    return {
      id: orderId,
      orderCode,
      status: 'pending',
      paymentMethod,
      paymentStatus: 'unpaid',
      recipientName: shipping.recipientName,
      phone: shipping.phone,
      shippingAddress: shipping.shippingAddress,
      note,
      subtotal,
      shippingFee,
      discountAmount,
      total,
      items: preparedItems,
    };
  });

  res.status(201).json({ ok: true, data: createdOrder });
}));

// GET /api/orders — danh sach don hang cua chinh khach hang
router.get('/', requirePermission('orders:read_own'), asyncHandler(async (req, res) => {
  const status = trimStr(req.query.status);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const data = await req.user.getOrders({
    status: isInEnum(status, ['pending', 'confirmed', 'shipping', 'completed', 'cancelled']) ? status : null,
    page,
    pageSize,
  });
  res.json({ ok: true, data });
}));

// GET /api/orders/:code — chi tiet 1 don cua chinh minh (tra 404 neu khong phai cua minh)
router.get('/:code', requirePermission('orders:read_own'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE order_code = ? AND customer_id = ? LIMIT 1',
    [code, req.user.id]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Không tìm thấy đơn hàng này.');
  }
  const order = rows[0];

  const [items] = await pool.query(`
    SELECT oi.*, pv.product_id, p.slug AS product_slug,
           EXISTS(
             SELECT 1 FROM reviews r
             WHERE r.product_id = pv.product_id AND r.customer_id = ?
           ) AS has_reviewed
    FROM order_items oi
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    LEFT JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = ?
  `, [req.user.id, order.id]);

  const [history] = await pool.query(`
    SELECT h.id, h.from_status, h.to_status, h.note, h.created_at, u.full_name AS actor_name
    FROM order_status_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.order_id = ?
    ORDER BY h.created_at ASC, h.id ASC
  `, [order.id]);

  res.json({ ok: true, data: { ...order, items, history } });
}));

// POST /api/orders/:code/cancel — khach huy don khi dang pending, hoan ton kho
router.post('/:code/cancel', requirePermission('orders:cancel_own'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);

  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT * FROM orders WHERE order_code = ? AND customer_id = ? LIMIT 1 FOR UPDATE',
      [code, req.user.id]
    );
    if (rows.length === 0) throw new AppError(404, 'Không tìm thấy đơn hàng này.');
    const order = rows[0];

    if (order.status !== 'pending') {
      throw new AppError(400, 'Chỉ có thể hủy đơn hàng khi đang ở trạng thái chờ xử lý.');
    }

    // Hoan ton kho
    const [items] = await conn.query('SELECT variant_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (item.variant_id) {
        await conn.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, item.variant_id]);
      }
    }

    if (order.coupon_id) {
      await conn.query('UPDATE coupons SET used_count = GREATEST(0, used_count - 1) WHERE id = ?', [order.coupon_id]);
    }

    const nextPaymentStatus = order.payment_status === 'paid' ? 'refunded' : order.payment_status;
    await conn.query(
      `UPDATE orders SET status = 'cancelled', payment_status = ? WHERE id = ?`,
      [nextPaymentStatus, order.id]
    );
    await conn.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES (?, 'pending', 'cancelled', ?, 'Khách hàng tự hủy đơn')`,
      [order.id, req.user.id]
    );
  });

  res.json({ ok: true, data: { cancelled: true } });
}));

// POST /api/orders/:code/reorder — them lai cac mon con hang tu don cu vao gio
router.post('/:code/reorder', requirePermission('orders:read_own'), asyncHandler(async (req, res) => {
  const code = trimStr(req.params.code);
  const [rows] = await pool.query(
    'SELECT id FROM orders WHERE order_code = ? AND customer_id = ? LIMIT 1',
    [code, req.user.id]
  );
  if (rows.length === 0) throw new AppError(404, 'Không tìm thấy đơn hàng này.');

  const [items] = await pool.query(`
    SELECT oi.variant_id, oi.quantity, pv.stock, pv.is_active AS v_active, p.is_active AS p_active
    FROM order_items oi
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
    LEFT JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = ?
  `, [rows[0].id]);

  let added = 0;
  let skipped = 0;

  await withTransaction(async (conn) => {
    for (const item of items) {
      if (!item.variant_id || !item.v_active || !item.p_active || item.stock <= 0) {
        skipped += 1;
        continue;
      }
      const [ex] = await conn.query(
        'SELECT quantity FROM cart_items WHERE customer_id = ? AND variant_id = ? LIMIT 1',
        [req.user.id, item.variant_id]
      );
      const cur = ex.length > 0 ? ex[0].quantity : 0;
      const nextQty = Math.min(20, item.stock, cur + item.quantity);
      if (nextQty <= 0) {
        skipped += 1;
        continue;
      }
      await conn.query(
        `INSERT INTO cart_items (customer_id, variant_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = ?`,
        [req.user.id, item.variant_id, nextQty, nextQty]
      );
      added += 1;
    }
  });

  res.json({ ok: true, data: { added, skipped } });
}));

module.exports = router;
