-- ============================================================================
-- SCHEMA CO SO DU LIEU: NHA RANG (E-COMMERCE CA PHE DAC SAN & DUNG CU)
-- Tuong thich MySQL 8.0+ va MariaDB 10.4+ (InnoDB, utf8mb4_unicode_ci)
--
-- Giai thich mo hinh ke thua (Class Table Inheritance):
-- Bang `users` luu cac thuoc tinh dung chung cua moi tai khoan (email, mat khau,
-- ho ten, vai tro, trang thai). Bang `customers` va `admins` co khoa chinh
-- `user_id` dong thoi la khoa ngoai toi `users.id` (ON DELETE CASCADE).
-- Cach nay tranh viec gom chung thanh 1 bang duy nhat co nhieu cot NULL
-- (vi du admin khong co loyalty_points, customer khong co department),
-- dong thoi giup rang buoc khoa ngoai chat che (don hang chi thuoc customer,
-- khong the tro nham sang admin).
-- ============================================================================

CREATE DATABASE IF NOT EXISTS nha_rang
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nha_rang;

SET NAMES utf8mb4;
-- 1. Bang nguoi dung chung (lop cha)
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bang khach hang (ke thua tu users)
CREATE TABLE customers (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  birthday DATE NULL,
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  newsletter TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bang quan tri vien (ke thua tu users)
CREATE TABLE admins (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  admin_level ENUM('staff', 'manager', 'owner') NOT NULL DEFAULT 'staff',
  department VARCHAR(100) NOT NULL DEFAULT 'Van hanh',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admins_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. So dia chi giao hang cua khach
CREATE TABLE addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  recipient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  ward VARCHAR(100) NOT NULL,
  street VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_addresses_customer (customer_id),
  CONSTRAINT fk_addresses_customer FOREIGN KEY (customer_id)
    REFERENCES customers(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Danh muc san pham (6 danh muc phang)
CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. San pham
CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  short_description VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  origin VARCHAR(120) NULL,
  roast_level ENUM('light', 'medium', 'dark') NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category_id),
  KEY idx_products_name (name),
  KEY idx_products_active_featured (is_active, is_featured),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bien the san pham (khoi luong, mau sac, do xay...)
CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(64) NOT NULL,
  label VARCHAR(100) NOT NULL,
  price INT UNSIGNED NOT NULL,
  compare_at_price INT UNSIGNED NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_variants_sku (sku),
  KEY idx_variants_product (product_id),
  KEY idx_variants_stock (stock),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Hinh anh san pham
CREATE TABLE product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(200) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_images_product (product_id),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Gio hang (chi luu cho khach da dang nhap)
CREATE TABLE cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_customer_variant (customer_id, variant_id),
  CONSTRAINT fk_cart_customer FOREIGN KEY (customer_id)
    REFERENCES customers(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Ma giam gia
CREATE TABLE coupons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL,
  discount_type ENUM('percent', 'fixed') NOT NULL,
  discount_value INT UNSIGNED NOT NULL,
  min_order_value INT UNSIGNED NOT NULL DEFAULT 0,
  max_uses INT UNSIGNED NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Don hang (luu ban chup thong tin nguoi nhan tai thoi diem dat)
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(32) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_method ENUM('cod', 'bank_transfer') NOT NULL DEFAULT 'cod',
  payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
  recipient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  shipping_address VARCHAR(400) NOT NULL,
  note VARCHAR(500) NULL,
  subtotal INT UNSIGNED NOT NULL,
  shipping_fee INT UNSIGNED NOT NULL DEFAULT 0,
  discount_amount INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL,
  coupon_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_code (order_code),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_status_created (status, created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id)
    REFERENCES coupons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Chi tiet don hang (ban chup ten va gia luc mua)
CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(180) NOT NULL,
  variant_label VARCHAR(100) NOT NULL,
  unit_price INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_variant (variant_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Lich su chuyen trang thai don hang
CREATE TABLE order_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NULL,
  to_status ENUM('pending', 'confirmed', 'shipping', 'completed', 'cancelled') NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  note VARCHAR(300) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_history_order (order_id),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Danh gia san pham (chi khach da nhan hang moi duoc danh gia)
CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reviews_product_customer (product_id, customer_id),
  KEY idx_reviews_product (product_id),
  CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id)
    REFERENCES customers(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VIEW tong hop thong tin the san pham cho trang danh sach & trang chu
CREATE VIEW v_product_cards AS
SELECT
  p.id,
  p.category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  p.name,
  p.slug,
  p.short_description,
  p.origin,
  p.roast_level,
  p.is_active,
  p.is_featured,
  p.created_at,
  (
    SELECT MIN(pv.price)
    FROM product_variants pv
    WHERE pv.product_id = p.id AND pv.is_active = 1
  ) AS min_price,
  (
    SELECT pv2.compare_at_price
    FROM product_variants pv2
    WHERE pv2.product_id = p.id AND pv2.is_active = 1
    ORDER BY pv2.price ASC, pv2.id ASC
    LIMIT 1
  ) AS min_compare_at_price,
  (
    SELECT COUNT(*)
    FROM product_variants pv3
    WHERE pv3.product_id = p.id AND pv3.is_active = 1
  ) AS variant_count,
  (
    SELECT COALESCE(SUM(pv4.stock), 0)
    FROM product_variants pv4
    WHERE pv4.product_id = p.id AND pv4.is_active = 1
  ) AS total_stock,
  (
    SELECT pv5.id
    FROM product_variants pv5
    WHERE pv5.product_id = p.id AND pv5.is_active = 1 AND pv5.stock > 0
    ORDER BY pv5.price ASC, pv5.id ASC
    LIMIT 1
  ) AS default_variant_id,
  (
    SELECT pi.url
    FROM product_images pi
    WHERE pi.product_id = p.id
    ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
    LIMIT 1
  ) AS primary_image,
  (
    SELECT COALESCE(ROUND(AVG(r.rating), 1), 0)
    FROM reviews r
    WHERE r.product_id = p.id
  ) AS avg_rating,
  (
    SELECT COUNT(*)
    FROM reviews r2
    WHERE r2.product_id = p.id
  ) AS review_count,
  (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
    INNER JOIN product_variants pv6 ON pv6.id = oi.variant_id
    WHERE pv6.product_id = p.id
  ) AS sold_count
FROM products p
INNER JOIN categories c ON c.id = p.category_id;

/* ============================================================================
   5 CAU TRUY VAN MAU DE THU TRONG MYSQL WORKBENCH
   ============================================================================

-- 1. Top 5 san pham ban chay nhat (chi tinh don completed)
SELECT p.id, p.name, SUM(oi.quantity) AS total_sold, SUM(oi.line_total) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN product_variants pv ON pv.id = oi.variant_id
JOIN products p ON p.id = pv.product_id
WHERE o.status = 'completed'
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 5;

-- 2. Doanh thu theo ngay trong 30 ngay gan nhat
SELECT DATE(created_at) AS order_date, COUNT(*) AS order_count, SUM(total) AS daily_revenue
FROM orders
WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY order_date ASC;

-- 3. Cac bien the san pham sap het hang (ton kho <= 5)
SELECT p.name AS product_name, pv.label, pv.sku, pv.stock
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.is_active = 1 AND pv.stock <= 5
ORDER BY pv.stock ASC, p.name ASC;

-- 4. Thong ke so luong don hang theo trang thai
SELECT status, COUNT(*) AS total_orders, SUM(total) AS total_value
FROM orders
GROUP BY status;

-- 5. Top 5 khach hang chi tieu nhieu nhat
SELECT u.id, u.full_name, u.email, COUNT(o.id) AS completed_orders, SUM(o.total) AS total_spent
FROM users u
JOIN orders o ON o.customer_id = u.id
WHERE o.status = 'completed'
GROUP BY u.id, u.full_name, u.email
ORDER BY total_spent DESC
LIMIT 5;
============================================================================ */
