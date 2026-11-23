const express = require('express');
const { pool, withTransaction } = require('../config/db');
const requirePermission = require('../middleware/requirePermission');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../utils/errors');
const { trimStr, isValidPhone, normalizePhone } = require('../utils/validate');

const router = express.Router();

// GET /api/account/profile
router.get('/profile', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  res.json({ ok: true, data: req.user.toPublicJSON() });
}));

// PUT /api/account/profile
router.put('/profile', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const fullName = trimStr(req.body.fullName);
  const phone = trimStr(req.body.phone);
  const birthday = trimStr(req.body.birthday) || null;

  const errors = {};
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = 'Họ tên phải từ 2 đến 120 ký tự.';
  if (phone && !isValidPhone(phone)) errors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) errors.birthday = 'Ngày sinh không hợp lệ.';

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Vui lòng kiểm tra lại thông tin hồ sơ.', errors);
  }

  await withTransaction(async (conn) => {
    await conn.query(
      'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
      [fullName, phone ? normalizePhone(phone) : null, req.user.id]
    );
    await conn.query(
      'UPDATE customers SET birthday = ? WHERE user_id = ?',
      [birthday, req.user.id]
    );
  });

  const refreshed = await User.findById(req.user.id);
  res.json({ ok: true, data: refreshed.toPublicJSON() });
}));

// GET /api/account/addresses
router.get('/addresses', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const list = await req.user.getAddresses();
  res.json({ ok: true, data: list });
}));

function validateAddressBody(body) {
  const recipientName = trimStr(body.recipientName);
  const phone = trimStr(body.phone);
  const province = trimStr(body.province);
  const district = trimStr(body.district);
  const ward = trimStr(body.ward);
  const street = trimStr(body.street);
  const isDefault = Boolean(body.isDefault);

  const errors = {};
  if (recipientName.length < 2) errors.recipientName = 'Vui lòng nhập họ tên người nhận.';
  if (!isValidPhone(phone)) errors.phone = 'Số điện thoại Việt Nam không hợp lệ.';
  if (!province) errors.province = 'Vui lòng nhập Tỉnh/Thành phố.';
  if (!district) errors.district = 'Vui lòng nhập Quận/Huyện.';
  if (!ward) errors.ward = 'Vui lòng nhập Phường/Xã.';
  if (street.length < 3) errors.street = 'Vui lòng nhập số nhà, tên đường.';

  if (Object.keys(errors).length > 0) {
    throw new AppError(400, 'Thông tin địa chỉ chưa đầy đủ.', errors);
  }
  return { recipientName, phone: normalizePhone(phone), province, district, ward, street, isDefault };
}

// POST /api/account/addresses
router.post('/addresses', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const data = validateAddressBody(req.body);
  const insertedId = await withTransaction(async (conn) => {
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) AS cnt FROM addresses WHERE customer_id = ?', [req.user.id]);
    const makeDefault = data.isDefault || cnt === 0;
    if (makeDefault) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [req.user.id]);
    }
    const [r] = await conn.query(
      `INSERT INTO addresses (customer_id, recipient_name, phone, province, district, ward, street, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, data.recipientName, data.phone, data.province, data.district, data.ward, data.street, makeDefault ? 1 : 0]
    );
    return r.insertId;
  });

  const [rows] = await pool.query('SELECT * FROM addresses WHERE id = ?', [insertedId]);
  res.status(201).json({ ok: true, data: rows[0] });
}));

// PUT /api/account/addresses/:id
router.put('/addresses/:id', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const addrId = Number(req.params.id);
  const data = validateAddressBody(req.body);

  await withTransaction(async (conn) => {
    const [existing] = await conn.query(
      'SELECT id FROM addresses WHERE id = ? AND customer_id = ? LIMIT 1',
      [addrId, req.user.id]
    );
    if (existing.length === 0) throw new AppError(404, 'Không tìm thấy địa chỉ.');

    if (data.isDefault) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [req.user.id]);
    }
    await conn.query(
      `UPDATE addresses
       SET recipient_name = ?, phone = ?, province = ?, district = ?, ward = ?, street = ?, is_default = IF(?, 1, is_default)
       WHERE id = ? AND customer_id = ?`,
      [data.recipientName, data.phone, data.province, data.district, data.ward, data.street, data.isDefault ? 1 : 0, addrId, req.user.id]
    );
  });

  const [rows] = await pool.query('SELECT * FROM addresses WHERE id = ?', [addrId]);
  res.json({ ok: true, data: rows[0] });
}));

// DELETE /api/account/addresses/:id
router.delete('/addresses/:id', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const addrId = Number(req.params.id);
  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, is_default FROM addresses WHERE id = ? AND customer_id = ? LIMIT 1',
      [addrId, req.user.id]
    );
    if (rows.length === 0) throw new AppError(404, 'Không tìm thấy địa chỉ.');

    await conn.query('DELETE FROM addresses WHERE id = ? AND customer_id = ?', [addrId, req.user.id]);
    if (rows[0].is_default) {
      await conn.query(
        'UPDATE addresses SET is_default = 1 WHERE customer_id = ? ORDER BY id DESC LIMIT 1',
        [req.user.id]
      );
    }
  });
  res.json({ ok: true, data: { deleted: true } });
}));

// PUT /api/account/addresses/:id/default
router.put('/addresses/:id/default', requirePermission('account:edit'), asyncHandler(async (req, res) => {
  const addrId = Number(req.params.id);
  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id FROM addresses WHERE id = ? AND customer_id = ? LIMIT 1',
      [addrId, req.user.id]
    );
    if (rows.length === 0) throw new AppError(404, 'Không tìm thấy địa chỉ.');
    await conn.query('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [req.user.id]);
    await conn.query('UPDATE addresses SET is_default = 1 WHERE id = ? AND customer_id = ?', [addrId, req.user.id]);
  });
  res.json({ ok: true, data: { updated: true } });
}));

module.exports = router;
