const User = require('./User');

// Quyen phan cap theo tung cap bac Admin (ke thua dan tu staff -> manager -> owner)
const STAFF_PERMISSIONS = [
  'dashboard:read',
  'orders:read_all',
  'orders:update',
  'products:read',
  'customers:read',
];
const MANAGER_PERMISSIONS = [
  ...STAFF_PERMISSIONS,
  'products:write',
  'categories:write',
];
const OWNER_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  'users:manage',
];

// Lop Admin ke thua tu User, bo sung cap bac va phong ban
class Admin extends User {
  constructor(row) {
    super(row); // Goi constructor lop cha User
    this.adminLevel = row.admin_level || 'staff';
    this.department = row.department || 'Vận hành';
  }

  // Ghi de (override) getPermissions theo cap bac adminLevel
  getPermissions() {
    if (this.adminLevel === 'owner') return OWNER_PERMISSIONS;
    if (this.adminLevel === 'manager') return MANAGER_PERMISSIONS;
    return STAFF_PERMISSIONS;
  }

  // Ghi de toPublicJSON de tra them thong tin cap bac Admin
  toPublicJSON() {
    return {
      ...super.toPublicJSON(),
      adminLevel: this.adminLevel,
      department: this.department,
    };
  }
}

module.exports = Admin;
