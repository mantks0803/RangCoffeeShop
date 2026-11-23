const fs = require('fs');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ROOT_DIR = path.resolve(__dirname, '../..');
const SCHEMA_PATH = path.join(ROOT_DIR, 'database', 'schema.sql');
const SEED_PATH = path.join(ROOT_DIR, 'database', 'seed.sql');

async function cloudSeed(sql) {
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('DEMO_ADMIN_PASSWORD must be at least 16 characters and at most 72 bytes.');
  }

  const inaccessible = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const admin = await bcrypt.hash(password, 10);

  // All bundled user hashes are replaced before the seed reaches MySQL.
  const sanitized = sql.replace(/'\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}'/g, "'" + inaccessible + "'");
  if (sanitized === sql || !/COMMIT;\s*$/i.test(sanitized)) {
    throw new Error('Unexpected seed format. Verify the user hashes and final COMMIT.');
  }

  const setDemoAdmin = mysql.format(
    'UPDATE users SET password_hash = ? WHERE email = ? AND role = ?',
    [admin, 'admin@nharang.vn', 'admin']
  );
  return sanitized.replace(/COMMIT;\s*$/i, () => setDemoAdmin + ';\nCOMMIT;\n');
}

async function main() {
  console.log('=== KHOI TAO CO SO DU LIEU NHA RANG ===');

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error('Khong tim thay file database/schema.sql.');
    process.exit(1);
  }

  // Kiem tra file seed.sql truoc khi ket noi
  if (!fs.existsSync(SEED_PATH)) {
    console.error('\n[THIEU DU LIEU MAU] Chua tim thay file database/seed.sql!');
    console.error('Vui long sinh file du lieu mau bang 2 lenh sau roi chay lai npm run db:setup:');
    console.error('  1. pip install bcrypt');
    console.error('  2. python database/generate_seed.py\n');
    process.exit(1);
  }

  let conn;
  try {
    console.log(`1. Dang ket noi MySQL tai ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}...`);
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      charset: 'utf8mb4',
      multipleStatements: true,
    });

    const [[existing]] = await conn.execute(
      'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      ['nha_rang']
    );
    if (existing.count > 0) {
      console.error('Database nha_rang da co bang hoac view. Dung khoi tao de giu du lieu hien co.');
      console.error('Neu database da duoc khoi tao day du, hay chay npm start.');
      process.exitCode = 1;
      return;
    }

    console.log('2. Dang tao schema (database/schema.sql)...');
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const seedSql = fs.readFileSync(SEED_PATH, 'utf8');
    const dataSql = process.env.NODE_ENV === 'production' ? await cloudSeed(seedSql) : seedSql;
    await conn.query(schemaSql);

    console.log('3. Dang nap du lieu mau (database/seed.sql)...');
    await conn.query(dataSql);

    console.log('4. Thong ke so dong trong database nha_rang:');
    const tables = [
      'users', 'admins', 'customers', 'addresses', 'categories',
      'products', 'product_variants', 'product_images', 'coupons',
      'orders', 'order_items', 'order_status_history', 'reviews', 'cart_items',
    ];
    for (const tbl of tables) {
      const [[row]] = await conn.query(`SELECT COUNT(*) AS cnt FROM nha_rang.${tbl}`);
      console.log(`   - ${tbl.padEnd(22)}: ${row.cnt}`);
    }

    console.log('\nHoan tat! Bay gio ban co the chay: npm start');
  } catch (err) {
    console.error('\n[LOI KET NOI HOAC NAP DATABASE]');
    if (err.code === 'ECONNREFUSED') {
      console.error('Khong ket noi duoc toi MySQL. Hay kiem tra dich vu MySQL (hoac XAMPP) da bat chua, va kiem tra DB_HOST, DB_PORT trong file .env.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Sai tai khoan hoac mat khau MySQL. Hay kiem tra DB_USER va DB_PASSWORD trong file .env.');
    } else {
      console.error('Chi tiet loi:', err.message);
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
