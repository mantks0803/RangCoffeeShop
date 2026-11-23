const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/**
 * Lop cha User dai dien cho moi tai khoan trong he thong.
 * Ap dung tinh ke thua (Customer extends User, Admin extends User)
 * va da hinh (phuong thuc getPermissions va toPublicJSON duoc lop con ghi de).
 */
class User {
  constructor(row) {
    this.id = row.id;
    this.email = row.email;
    this.passwordHash = row.password_hash;
    this.fullName = row.full_name;
    this.phone = row.phone || null;
    this.role = row.role;
    this.status = row.status;
    this.lastLoginAt = row.last_login_at || null;
    this.createdAt = row.created_at || null;
  }

  // Ham factory: tuy theo cot role trong database ma tra ve dung thuc the Customer hoac Admin
  static async _hydrateByRole(userRow) {
    if (!userRow) return null;
    if (userRow.role === 'admin') {
      const Admin = require('./Admin');
      const [rows] = await pool.query(
        'SELECT admin_level, department FROM admins WHERE user_id = ?',
        [userRow.id]
      );
      return new Admin({ ...userRow, ...(rows[0] || {}) });
    }
    const Customer = require('./Customer');
    const [rows] = await pool.query(
      'SELECT birthday, loyalty_points, newsletter FROM customers WHERE user_id = ?',
      [userRow.id]
    );
    return new Customer({ ...userRow, ...(rows[0] || {}) });
  }

  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    return User._hydrateByRole(rows[0]);
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return User._hydrateByRole(rows[0]);
  }

  // So sanh mat khau nhap vao voi hash bcrypt trong database
  async verifyPassword(plain) {
    return bcrypt.compare(plain, this.passwordHash);
  }

  async updateLastLogin() {
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [this.id]);
  }

  async updatePassword(newPlainPassword) {
    const hash = await bcrypt.hash(newPlainPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, this.id]);
    this.passwordHash = hash;
  }

  // Lop con se ghi de phuong thuc nay de tra ve danh sach quyen tuong ung (da hinh)
  getPermissions() {
    return [];
  }

  // Kiem tra nguoi dung co quyen cu the hay khong
  can(permission) {
    return this.getPermissions().includes(permission);
  }

  // Du lieu cong khai tra ve frontend, tuyet doi khong bao gom password_hash
  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      phone: this.phone,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      permissions: this.getPermissions(),
    };
  }
}

module.exports = User;
