const bcrypt = require('bcryptjs');
const User = require('./User');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../utils/errors');

// Lop Customer ke thua tu User, bo sung thuoc tinh va hanh vi rieng cua khach hang
class Customer extends User {
  constructor(row) {
    super(row); // Goi ham khoi tao lop cha User
    this.birthday = row.birthday || null;
    this.loyaltyPoints = Number(row.loyalty_points || 0);
    this.newsletter = Boolean(row.newsletter);
  }

  // Ghi de (override) getPermissions de cap nhom quyen cua khach hang
  getPermissions() {
    return [
      'cart:use',
      'orders:create',
      'orders:read_own',
      'orders:cancel_own',
      'reviews:write',
      'account:edit',
    ];
  }

  // Ghi de toPublicJSON: goi super roi bo sung thong tin rieng cua Customer
  toPublicJSON() {
    return {
      ...super.toPublicJSON(),
      birthday: this.birthday,
      loyaltyPoints: this.loyaltyPoints,
      newsletter: this.newsletter,
    };
  }

  // Dang ky khach hang moi trong 1 transaction (them users roi them customers)
  static async register({ email, password, fullName, phone = null }) {
    const cleanEmail = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);

    const userId = await withTransaction(async (conn) => {
      const [existing] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
      if (existing.length > 0) {
        throw new AppError(409, 'Email này đã được đăng ký.', { email: 'Email này đã được đăng ký.' });
      }
      const [res] = await conn.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role, status)
         VALUES (?, ?, ?, ?, 'customer', 'active')`,
        [cleanEmail, passwordHash, fullName, phone || null]
      );
      await conn.query('INSERT INTO customers (user_id, loyalty_points) VALUES (?, 0)', [res.insertId]);
      return res.insertId;
    });

    return User.findById(userId);
  }

  async getAddresses() {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, id DESC',
      [this.id]
    );
    return rows;
  }

  async getOrders({ status = null, page = 1, pageSize = 10 } = {}) {
    const where = ['customer_id = ?'];
    const params = [this.id];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    const whereSql = where.join(' AND ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders WHERE ${whereSql}`, params);
    const offset = (page - 1) * pageSize;
    const [items] = await pool.query(
      `SELECT id, order_code, status, payment_method, payment_status, subtotal, shipping_fee, discount_amount, total, created_at
       FROM orders WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}

module.exports = Customer;
