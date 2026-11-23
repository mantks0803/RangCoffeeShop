# Nhà Rang — Website Thương Mại Điện Tử Cà Phê Đặc Sản & Dụng Cụ Pha Chế

## 1. Giới thiệu

**Nhà Rang** là website bán cà phê đặc sản Việt Nam rang nhỏ mẻ (Cầu Đất, Buôn Ma Thuột, Khe Sanh, Sơn La, Lâm Đồng) và dụng cụ pha chế tại nhà. Dự án được xây dựng thuần **HTML5 / CSS3 / JavaScript (ES Modules)** ở frontend, **Node.js + Express** ở backend, và **MySQL 8.0 / MariaDB 10.4+** ở tầng cơ sở dữ liệu.

**Ba vai trò người dùng:**
- **Khách vãng lai:** Xem sản phẩm, lọc/tìm kiếm/phân trang, dùng giỏ hàng tạm trong trình duyệt (`localStorage`).
- **Customer (Khách hàng):** Kế thừa từ `User`. Gộp giỏ hàng khi đăng nhập, áp mã giảm giá, đặt hàng (COD / Chuyển khoản), quản lý hồ sơ & sổ địa chỉ, theo dõi & hủy đơn `pending`, mua lại, viết đánh giá cho món đã nhận (`completed`).
- **Admin (`staff`, `manager`, `owner`):** Kế thừa từ `User`. Xem thống kê dashboard, xử lý đơn hàng, quản lý sản phẩm/danh mục (`manager`+), khóa/mở khóa tài khoản khách (`owner`).

**Danh sách 10 trang:**
1. `index.html` — Trang chủ
2. `products.html` — Cửa hàng (lọc, tìm kiếm, sắp xếp, phân trang giữ trạng thái trên URL)
3. `product.html` — Chi tiết sản phẩm (chọn biến thể, tồn kho, đánh giá, sản phẩm liên quan)
4. `cart.html` — Giỏ hàng & áp mã giảm giá
5. `checkout.html` — Thanh toán & xác nhận đơn hàng
6. `auth.html` — Đăng nhập & đăng ký
7. `account.html` — Tài khoản khách hàng (4 tab: Hồ sơ, Đơn hàng, Sổ địa chỉ, Đổi mật khẩu)
8. `admin/dashboard.html` — Quản trị: Tổng quan & biểu đồ SVG doanh thu
9. `admin/products.html` — Quản trị: Sản phẩm, biến thể, tồn kho & danh mục
10. `admin/orders.html` — Quản trị: Đơn hàng (kèm in phiếu) & Khách hàng

---

## 2. Chuẩn bị trên máy của từng thành viên

Mở **VS Code → File → Open Folder**, chọn thư mục `nha-rang` có `package.json`, `backend`, `frontend` và `database`. Chọn **Terminal → New Terminal → PowerShell**. Chạy các lệnh bên dưới từ thư mục này.

- Cài Node.js và npm. Bản đã kiểm tra trên máy demo là Node.js 24.
- Bật MySQL Server. MySQL Workbench là ứng dụng để xem bảng và chạy SQL. Dịch vụ MySQL Server mới là phần web kết nối tới.
- Dự án có sẵn `database/seed.sql`. Python chỉ cần khi muốn sinh lại bộ dữ liệu mẫu.
- Khi gửi source cho đồng đội, gửi cả `.env.example`, `package-lock.json`, `database` và `demo-dataprep`. Loại `.env` và `node_modules` khỏi gói bàn giao. Mỗi người điền thông tin MySQL của máy mình.

## 3. Chạy lần đầu trong VS Code

**Bước 1. Kiểm tra đúng thư mục và công cụ**

```powershell
Test-Path .\package.json
Test-Path .\database\seed.sql
node --version
npm.cmd --version
Get-Service -Name '*mysql*'
```

Hai lệnh đầu cần trả `True`. Nếu dùng MySQL cài dạng Windows service, tìm dòng có trạng thái `Running`. Nếu dùng XAMPP, mở Control Panel và bật MySQL ở đó.

**Bước 2. Cài thư viện và tạo cấu hình cho máy mình**

```powershell
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Mở `.env` ở cạnh `package.json`. Điền `DB_HOST=127.0.0.1`, cổng MySQL của máy (thường là `DB_PORT=3306`), `DB_USER` và `DB_PASSWORD` dùng đăng nhập MySQL. Giữ `DB_NAME=nha_rang` vì script khởi tạo dùng tên này. Để `PORT=3000` và `NODE_ENV=development` khi chạy local. Tạo khóa ký đăng nhập bằng lệnh sau rồi dán kết quả vào `JWT_SECRET` trong `.env` của mình.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Bước 3. Nạp dữ liệu mẫu một lần**

Dùng MySQL local dành cho demo và tài khoản có quyền tạo database, bảng và view. Nếu đã chạy Nhà Rang thành công trên máy này, đi thẳng tới bước 4.

```powershell
npm.cmd run db:setup
```

Kết quả mong đợi là danh sách số dòng của 14 bảng rồi đến `Hoan tat!`. Nếu script báo `da co bang hoac view`, nó đã dừng để giữ dữ liệu. Với bộ Nhà Rang đã nạp đủ, tiếp tục bước 4. Nếu lần nạp trước bị gián đoạn và web báo thiếu bảng, kiểm tra bảng đang có và lỗi nạp đầu tiên trước khi xử lý.

**Bước 4. Bật web và kiểm tra**

```powershell
npm.cmd start
```

Khi terminal hiện `Ket noi MySQL thanh cong.` và địa chỉ web, giữ terminal này mở. Express phục vụ cả giao diện và API. Mở web qua địa chỉ của Express để giỏ hàng và đăng nhập dùng đúng API.

| Mở ở trình duyệt | Kết quả mong đợi |
| --- | --- |
| [Kiểm tra kết nối](http://localhost:3000/api/health) | JSON có `ok: true` và `data.status` bằng `ok`. Endpoint này có truy vấn MySQL. |
| [Cửa hàng](http://localhost:3000/products.html) | Có thẻ sản phẩm, giá và nút chuyển trang. Đây là bước kiểm tra dữ liệu mẫu đã đọc được. |
| [Đăng nhập](http://localhost:3000/auth.html) → [Dashboard](http://localhost:3000/admin/dashboard.html) | Dùng tài khoản quản trị ở mục 4. Chuyển giữa Bán hàng, Đơn hàng và Kho & sản phẩm để xem từng báo cáo. |

**Các lần sau** chỉ cần bật MySQL, mở terminal ở thư mục `nha-rang` rồi chạy `npm.cmd start`. Dừng web bằng `Ctrl+C`. Dữ liệu đã lưu trong MySQL vẫn còn cho lần mở sau.

### 3.1. Database của Nhà Rang lưu gì?

Database `nha_rang` có 14 bảng. Có thể đọc theo bốn nhóm nghiệp vụ.

| Nhóm | Bảng | Ví dụ khi dùng web |
| --- | --- | --- |
| Người dùng | `users`, `customers`, `admins`, `addresses` | Email đăng nhập nằm ở `users`. Quyền quản trị nằm ở `admins`. Một khách có thể lưu nhiều địa chỉ giao hàng. |
| Danh mục và hàng hóa | `categories`, `products`, `product_variants`, `product_images` | Một mẫu cà phê có thể bán dưới nhiều quy cách. Mỗi quy cách có SKU, giá và tồn kho riêng trong `product_variants`. |
| Giỏ và đơn hàng | `cart_items`, `coupons`, `orders`, `order_items`, `order_status_history` | Một giỏ có hai món có thể tạo một đơn với hai dòng chi tiết. Giá trên từng dòng được lưu tại thời điểm mua. |
| Đánh giá | `reviews` | Liên kết khách và sản phẩm để hiện nhận xét, số sao ở trang chi tiết. |

Ngoài ra còn có view `v_product_cards` để đọc thông tin thẻ sản phẩm. Muốn xem một ví dụ trong MySQL Workbench, mở kết nối MySQL local và chạy đoạn SQL chỉ đọc sau.

```sql
SELECT p.name, v.sku, v.price, v.stock
FROM nha_rang.products AS p
JOIN nha_rang.product_variants AS v ON v.product_id = p.id
WHERE v.sku IN ('NR-0101-01', 'NR-0102-01');
```

Với dữ liệu mẫu, kết quả có hai SKU. Đây là cách giải thích vì sao khi nhận hàng từ nhà cung cấp, nhóm có thể dùng SKU để biết chính xác dòng nào thuộc sản phẩm nào. Cấu trúc đầy đủ nằm trong [schema](database/schema.sql).

### 3.2. Demo khi danh mục trên web đã sạch

Giữ danh mục chuẩn để đối chiếu. Phần có lỗi đến từ **lô hàng mới của nhà cung cấp**. Nhóm có thể thử ngay với [lô nhập 6 dòng](demo-dataprep/hang_nhap_thu.csv) và [danh mục đối chiếu 4 SKU](demo-dataprep/danh_muc_tham_chieu.csv). Cột `dong` đánh số bản ghi từ 1.

1. Mở một chat mới, đính kèm hai CSV. Chỉ định file danh mục là nguồn tham chiếu của cửa hàng.
2. Dùng prompt **“Bên giao hàng vừa gửi lô này. Đối chiếu giúp mình với danh mục cửa hàng. Chỗ nào chắc thì sửa luôn, chỗ nào cần hỏi nhà cung cấp thì để riêng. Gửi mình file dùng được và ghi rõ đã sửa gì.”**
3. Tải kết quả, đối chiếu theo cột `dong` trong bảng dưới. Với các dòng được sửa, kiểm tra cả giá trị trước/sau và SKU hoặc quy ước làm căn cứ. Nếu nền tảng xử lý bằng SQL trong chat, ghi đúng cách thực hiện trong báo cáo demo.

| Dòng | Vấn đề | Kết quả cần kiểm tra |
| --- | --- | --- |
| 1 | Có SKU, thiếu xuất xứ | Từ `NR-0101-01` điền đúng `Cầu Đất, Đà Lạt · 1.550m`. |
| 2 | Giá và mức rang viết theo kiểu nhà cung cấp | Theo cách ghi VND của lô, `195.000 ₫` thành `195000`. Đối chiếu SKU để chuẩn hóa `Rang vừa` thành `medium`. |
| 3 | Thiếu SKU, có mô tả sơ chế mật ong tại Xuân Trường và quy cách 250g nguyên hạt | Đối chiếu các chi tiết với danh mục. Chấp nhận `NR-0102-01` khi chỉ một biến thể khớp. |
| 4 | Chỉ biết Arabica Cầu Đất 250g | Cả Washed và Honey đều có thể phù hợp. Để rà soát và ghi thiếu thông tin sơ chế. |
| 5 | Tồn kho bằng `-4` | Để rà soát và yêu cầu đối chiếu phiếu nhập. Giữ số gốc làm bằng chứng. |
| 6 | Giá, SKU, mức rang và lượng nhập hợp lệ | Giữ nguyên các giá trị này. |

**Mốc demo hiện tại** là đối chiếu hai CSV. Website đang đọc MySQL cho các nghiệp vụ bán hàng. Bảng nhận lô nhập, kết nối MCP ghi kết quả và bộ xử lý tự chạy khi có dòng mới là phần tiếp theo. Khi thử bước đó, thêm hai dòng vào bảng nhập thử trong lúc chat đã đóng. Một dòng có SKU rõ phải tự nhận kết quả, dòng mơ hồ phải vào hàng chờ. Mở lại dashboard nhập hàng để xem trạng thái và lý do. Có thể dùng tra cứu SQL cho SKU chính xác, rồi thử RAG cho mô tả tự do như dòng 3.

### 3.3. Chọn database và môi trường demo

**Demo trên một máy:** dùng MySQL local cùng web hiện tại. **Demo qua URL cho cả nhóm:** giữ MySQL và triển khai Express cùng một dịch vụ MySQL riêng trên cloud. Ví dụ, có thể đặt cả hai trong một project Railway, dùng kết nối nội bộ và ánh xạ thông tin MySQL sang các biến `DB_*` của ứng dụng. Chuẩn bị database tên `nha_rang` phù hợp với script và chỉ seed một lần vào môi trường demo. Đặt `JWT_SECRET` riêng, dùng HTTPS, đổi mật khẩu tài khoản demo có quyền ghi trước khi chia sẻ URL. [MySQL trên Railway](https://docs.railway.com/databases/mysql)

Nếu nhóm muốn dùng **Vercel**, có thể giữ MySQL cloud. Cần chuẩn bị entry point Express mà Vercel nhận diện và xuất nội dung tĩnh từ `frontend/` sang `public/` trong bản deploy. Bản local hiện khởi động qua `backend/server.js` và phục vụ file bằng `express.static()`. Khi thử bản cloud, kiểm tra cùng một URL gốc cho trang chủ, file CSS, `/api/health` và đăng nhập bằng cookie. [Hướng dẫn Express trên Vercel](https://vercel.com/docs/frameworks/backend/express)

**Neon dùng PostgreSQL.** Chuyển toàn bộ web sang Neon sẽ cần đổi driver `mysql2`, chuyển schema, seed, các truy vấn riêng của MySQL và thử lại luồng đặt đơn/trừ kho. Nếu team muốn thử tìm theo ngữ nghĩa, có thể giữ MySQL cho cửa hàng và chỉ thử PostgreSQL riêng cho bộ danh mục tham chiếu ở giai đoạn sau. [Tài liệu Neon](https://neon.com/docs)

---

### Railway

Dùng Express và MySQL trong cùng một project. Cấu hình DB_HOST, DB_PORT, DB_USER, DB_PASSWORD và DB_NAME=nha_rang trong Variables của dịch vụ web. Đặt NODE_ENV=production và JWT_SECRET dài ít nhất 32 ký tự.

Khi database demo còn trống, cấu hình DEMO_ADMIN_PASSWORD bằng một mật khẩu riêng dài ít nhất 16 ký tự và tối đa 72 byte, rồi chạy npm run db:setup làm Pre-deploy Command cho lần đầu. Tài khoản quản trị demo là admin@nharang.vn. Các tài khoản mẫu khác nhận mật khẩu ngẫu nhiên. Tài khoản khách mới có thể đăng ký trên web.

Sau lần khởi tạo, bỏ Pre-deploy Command. Dùng npm start để chạy web, /api/health để kiểm tra kết nối và Generate Domain để tạo URL HTTPS.

## 4. Bảng tài khoản dùng thử trên local

| Vai trò | Email | Mật khẩu | Ghi chú |
| --- | --- | --- | --- |
| Admin (owner) | `admin@nharang.vn` | `Admin@123` | Toàn quyền, kể cả khóa/mở khóa khách |
| Admin (manager) | `quanly@nharang.vn` | `Admin@123` | Xem/sửa sản phẩm, danh mục, xử lý đơn |
| Admin (staff) | `nhanvien@nharang.vn` | `Admin@123` | Xử lý đơn, trang sản phẩm ở chế độ chỉ xem |
| Khách demo | `khach@nharang.vn` | `Khach@123` | Có sẵn 2 món trong giỏ và 8 đơn nhiều trạng thái |
| Khách bị khóa | `biloc@nharang.vn` | `Khach@123` | Dùng để kiểm tra chặn đăng nhập |
| 58 khách còn lại | `ten.ho<id>@example.com` | `Khach@123` | Ví dụ xem trong bảng `users` |

**Mã giảm giá có sẵn để thử:**
- `WELCOME10`: Giảm 10% cho đơn từ 200.000 ₫
- `FREESHIP`: Giảm 30.000 ₫ cho đơn từ 300.000 ₫
- `NHARANG50K`: Giảm 50.000 ₫ cho đơn từ 500.000 ₫
- `HETHAN`: Mã đã hết hạn (để thử thông báo lỗi)
- `VIP20`: Mã đang tạm khóa (để thử thông báo lỗi)

---

## 5. Lỗi thường gặp và cách sửa

| Triệu chứng | Nguyên nhân thường gặp | Cách sửa |
| --- | --- | --- |
| `ECONNREFUSED` khi chạy `db:setup` hoặc `start` | MySQL chưa chạy hoặc sai cổng | Bật dịch vụ MySQL (hoặc bấm Start MySQL trong XAMPP), kiểm tra `DB_PORT` trong `.env` |
| `ER_ACCESS_DENIED_ERROR` | Sai tài khoản hoặc mật khẩu MySQL | Sửa lại `DB_USER`, `DB_PASSWORD` trong `.env` |
| `EADDRINUSE` | Cổng 3000 đang có chương trình khác dùng | Đổi `PORT=3001` trong `.env` rồi mở `http://localhost:3001` |
| `ModuleNotFoundError: No module named 'bcrypt'` | Chưa cài gói `bcrypt` của Python | Chạy `pip install bcrypt` (hoặc `py -m pip install bcrypt`) |
| Tiếng Việt bị lỗi font trong database | Tạo database thủ công sai charset | Kiểm tra charset của schema và kết nối. Bản tạo mới dùng `utf8mb4_unicode_ci`. |
| Đăng nhập xong vẫn như chưa đăng nhập | Mở file HTML trực tiếp bằng `file://` | Luôn truy cập qua `http://localhost:3000` |

---

## 6. Sơ đồ 3 luồng chính

### Luồng 1: Đặt hàng (Transaction & chống âm kho)
```text
[Giỏ hàng DB] -> POST /api/orders -> BEGIN TRANSACTION
  -> SELECT product_variants ... FOR UPDATE (khóa dòng biến thể)
  -> Kiểm tra tồn kho từng dòng (thiếu -> ROLLBACK + trả 409)
  -> Tính lại subtotal, phí ship (30k / miễn phí >= 500k), mã giảm giá ở server
  -> INSERT orders + order_items (bản chụp tên & giá)
  -> UPDATE product_variants SET stock = stock - qty
  -> UPDATE coupons SET used_count = used_count + 1 (nếu có)
  -> DELETE cart_items + INSERT order_status_history ('pending')
-> COMMIT -> Trả mã đơn NR-YYYYMMDD-XXXX
```

### Luồng 2: Đăng nhập & Phân quyền
```text
POST /api/auth/login -> Kiểm tra rate-limit IP (10 lần/15p)
  -> User.findByEmail() -> verifyPassword (bcrypt) -> Kiểm tra status !== 'blocked'
  -> Ký JWT { id, role } (7 ngày) -> Gắn cookie token (httpOnly, SameSite=Lax)
Mọi request sau:
  -> attachUser middleware đọc cookie -> User.findById() (kiểm tra status trong DB)
  -> requirePermission('...') gọi req.user.can(permission) -> 401 hoặc 403 nếu không đạt
```

### Luồng 3: Kế thừa User -> Customer / Admin
```text
Database (Class Table Inheritance):
  users (id, email, password_hash, role, status...)
    ├── customers (user_id PK/FK -> users.id, birthday, loyalty_points)
    └── admins    (user_id PK/FK -> users.id, admin_level, department)

Code (backend/models/):
  class User (lớp cha, factory _hydrateByRole, getPermissions(), can(), toPublicJSON())
    ├── class Customer extends User (ghi đè getPermissions(), toPublicJSON(), thêm register/getOrders)
    └── class Admin    extends User (ghi đè getPermissions() theo staff/manager/owner, toPublicJSON())
```

---

## 7. Gợi ý trả lời khi bảo vệ đồ án (8 câu hỏi thường gặp)

1. **Vì sao tách `users`, `customers`, `admins` thành 3 bảng thay vì gộp chung 1 bảng?**
   Áp dụng mô hình *Class Table Inheritance*: tránh tạo nhiều cột `NULL` dư thừa (Admin không có điểm tích lũy, Customer không có phòng ban) và cho phép khóa ngoại trỏ chính xác (ví dụ `orders.customer_id` chỉ tham chiếu `customers.user_id`, không thể gán nhầm đơn cho Admin).

2. **Vì sao `order_items` và `orders` phải lưu bản chụp tên sản phẩm, giá bán, địa chỉ lúc đặt?**
   Vì sau này cửa hàng có thể tăng/giảm giá, đổi tên sản phẩm hoặc khách sửa/xóa địa chỉ trong sổ địa chỉ. Lưu bản chụp giúp hóa đơn lịch sử luôn chính xác như thời điểm mua.

3. **Transaction đặt hàng bảo vệ điều gì?**
   Đảm bảo tính nguyên tử (*Atomicity*): hoặc toàn bộ các bước (tạo đơn, trừ kho, tăng lượt dùng mã giảm giá, xóa giỏ) cùng thành công, hoặc nếu có lỗi ở bất kỳ bước nào thì `ROLLBACK` sạch sẽ, không bao giờ xảy ra tình trạng đã trừ kho mà không có đơn.

4. **Câu lệnh `SELECT ... FOR UPDATE` giải quyết vấn đề gì?**
   Khi hai người cùng bấm mua món chỉ còn 1 sản phẩm ở cùng một thời điểm, `FOR UPDATE` khóa dòng biến thể đó cho transaction đầu tiên xử lý xong; transaction thứ hai chờ mở khóa, thấy `stock = 0` và báo hết hàng, ngăn tuyệt đối tình trạng tồn kho âm (*race condition*).

5. **Vì sao đặt JWT trong cookie `httpOnly` thay vì lưu ở `localStorage`?**
   JavaScript trên trang không thể đọc cookie `httpOnly`, nên ngay cả khi có lỗ hổng XSS, kẻ xấu cũng không thể đánh cắp token phiên đăng nhập. Kết hợp `SameSite=Lax` và kiểm tra `Content-Type: application/json` giúp chống CSRF cơ bản.

6. **Vì sao giá, phí giao hàng và tiền giảm giá phải tính lại ở server?**
   Dữ liệu từ trình duyệt (kể cả giỏ hàng `localStorage` hay payload gửi lên) đều có thể bị chỉnh sửa bằng DevTools. Server luôn truy vấn giá mới nhất từ database và tự tính lại mọi khoản tiền trước khi tạo đơn.

7. **Làm sao phân quyền Admin theo 3 cấp bậc (`staff`, `manager`, `owner`)?**
   Lớp `Admin` kế thừa `User` và ghi đè `getPermissions()` để trả mảng quyền tăng dần theo `adminLevel`. Mọi route nhạy cảm đều gắn middleware `requirePermission('...')` ở backend; việc ẩn nút trên giao diện chỉ để gọn UI, không thay thế kiểm tra ở server.

8. **Tính kế thừa và đa hình thể hiện ở đâu trong code?**
   `Customer` và `Admin` đều `extends User` và gọi `super(row)`. Tính đa hình thể hiện khi `User.findById()` trả về đúng thể hiện lớp con, rồi middleware `requirePermission` chỉ cần gọi `req.user.can(permission)` — bên dưới sẽ tự chạy `getPermissions()` tương ứng của `Customer` hoặc `Admin`.
