#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script sinh du lieu gia cho website thuong mai dien tu Nha Rang.
Chay: python database/generate_seed.py
Ket qua: ghi ra file database/seed.sql voi du lieu nhat quan (da kiem tra bang assert).
"""

import os
import random
from datetime import datetime, timedelta
import bcrypt

random.seed(20261123)

NOW = datetime(2026, 11, 23, 10, 0, 0)
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql")


def sql_str(val):
    """Escape chuoi an toan cho SQL."""
    if val is None:
        return "NULL"
    s = str(val).replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    return f"'{s}'"


def sql_dt(dt):
    if dt is None:
        return "NULL"
    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"


def sql_date(dt):
    if dt is None:
        return "NULL"
    return f"'{dt.strftime('%Y-%m-%d')}'"


def remove_accents(text):
    """Bo dau tieng Viet de tao email tu ten."""
    mapping = {
        "à": "a", "á": "a", "ả": "a", "ã": "a", "ạ": "a",
        "ă": "a", "ằ": "a", "ắ": "a", "ẳ": "a", "ẵ": "a", "ặ": "a",
        "â": "a", "ầ": "a", "ấ": "a", "ẩ": "a", "ẫ": "a", "ậ": "a",
        "è": "e", "é": "e", "ẻ": "e", "ẽ": "e", "ẹ": "e",
        "ê": "e", "ề": "e", "ế": "e", "ể": "e", "ễ": "e", "ệ": "e",
        "ì": "i", "í": "i", "ỉ": "i", "ĩ": "i", "ị": "i",
        "ò": "o", "ó": "o", "ỏ": "o", "õ": "o", "ọ": "o",
        "ô": "o", "ồ": "o", "ố": "o", "ổ": "o", "ỗ": "o", "ộ": "o",
        "ơ": "o", "ờ": "o", "ớ": "o", "ở": "o", "ỡ": "o", "ợ": "o",
        "ù": "u", "ú": "u", "ủ": "u", "ũ": "u", "ụ": "u",
        "ư": "u", "ừ": "u", "ứ": "u", "ử": "u", "ữ": "u", "ự": "u",
        "ỳ": "y", "ý": "y", "ỷ": "y", "ỹ": "y", "ỵ": "y",
        "đ": "d",
    }
    res = []
    for ch in text.lower():
        res.append(mapping.get(ch, ch))
    return "".join(res)


def hash_password(plain):
    """Bam mat khau bcrypt cost 10, dam bao tien to $2b$ cho bcryptjs."""
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")
    assert hashed.startswith("$2b$"), "Hash bcrypt phai bat dau bang $2b$"
    return hashed


def random_vn_phone():
    prefixes = ["090", "091", "093", "094", "096", "097", "098", "086", "083", "084", "085", "032", "033", "034", "035", "036", "037", "038", "039", "070", "076", "077", "078", "079"]
    return random.choice(prefixes) + "".join(str(random.randint(0, 9)) for _ in range(7))


# ============================================================================
# 1. NGUOI DUNG (3 Admin + 60 Customer = 63 users)
# ============================================================================
ADMIN_HASH = hash_password("Admin@123")
CUSTOMER_HASH = hash_password("Khach@123")

LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
MIDDLE_NAMES = ["Thị", "Minh", "Hoàng", "Thu", "Quốc", "Gia", "Thanh", "Ngọc", "Văn", "Anh", "Hữu", "Khánh", "Phương", "Đức"]
FIRST_NAMES = ["Lan Anh", "Khoa", "Phúc", "Hà", "Tâm", "Huy", "Thảo", "Duy", "Trang", "Kiên", "Linh", "Nam", "Vy", "Tuấn", "Ngân", "Bảo", "My", "Sơn", "Châu", "Hải", "Quỳnh", "Đạt", "Yến", "Tùng", "Nhi", "Long", "Hằng", "Vinh", "Mai", "Cường"]

users = []
admins = []
customers = []

# 3 Admin
admin_defs = [
    (1, "admin@nharang.vn", "Nguyễn Minh Quân", "0901234567", "owner", "Ban điều hành"),
    (2, "quanly@nharang.vn", "Trần Thảo Nguyên", "0902345678", "manager", "Quản lý sản phẩm"),
    (3, "nhanvien@nharang.vn", "Lê Hoàng Nam", "0903456789", "staff", "Vận hành đơn hàng"),
]
for uid, email, full_name, phone, level, dept in admin_defs:
    created = NOW - timedelta(days=200 - uid * 5)
    users.append({
        "id": uid, "email": email, "password_hash": ADMIN_HASH, "full_name": full_name,
        "phone": phone, "role": "admin", "status": "active",
        "last_login_at": NOW - timedelta(hours=random.randint(1, 36)),
        "created_at": created,
    })
    admins.append({
        "user_id": uid, "admin_level": level, "department": dept, "created_at": created,
    })

# 60 Customer (id 4..63)
# id 4: khach demo, id 5: khach bi khoa, id 6..63: 58 khach con lai (them 2 khach bi khoa o id 60, 61)
used_emails = {"admin@nharang.vn", "quanly@nharang.vn", "nhanvien@nharang.vn", "khach@nharang.vn", "biloc@nharang.vn"}

for i in range(60):
    uid = 4 + i
    if uid == 4:
        full_name = "Nguyễn Thị Lan Anh"
        email = "khach@nharang.vn"
        status = "active"
        created = NOW - timedelta(days=150)
    elif uid == 5:
        full_name = "Phạm Văn Lộc"
        email = "biloc@nharang.vn"
        status = "blocked"
        created = NOW - timedelta(days=140)
    else:
        ln = LAST_NAMES[i % len(LAST_NAMES)]
        mn = MIDDLE_NAMES[(i * 3) % len(MIDDLE_NAMES)]
        fn = FIRST_NAMES[(i * 5) % len(FIRST_NAMES)]
        full_name = f"{ln} {mn} {fn}"
        base_fn = remove_accents(fn.split()[-1])
        base_ln = remove_accents(ln)
        email = f"{base_fn}.{base_ln}{uid}@example.com"
        while email in used_emails:
            email = f"{base_fn}.{base_ln}{uid}{random.randint(1,9)}@example.com"
        used_emails.add(email)
        status = "blocked" if uid in (60, 61) else "active"
        created = NOW - timedelta(days=random.randint(95, 180))

    users.append({
        "id": uid, "email": email, "password_hash": CUSTOMER_HASH, "full_name": full_name,
        "phone": random_vn_phone(), "role": "customer", "status": status,
        "last_login_at": NOW - timedelta(days=random.randint(0, 20)) if status == "active" else None,
        "created_at": created,
    })
    bday = datetime(random.randint(1985, 2004), random.randint(1, 12), random.randint(1, 28))
    customers.append({
        "user_id": uid, "birthday": bday, "loyalty_points": 0,
        "newsletter": 1 if random.random() < 0.6 else 0,
        "created_at": created,
    })

# ============================================================================
# 2. DIA CHI GIAO HANG (~90 dia chi)
# ============================================================================
LOCATIONS = [
    ("TP. Hồ Chí Minh", "Quận 1", "Phường Bến Nghé", ["Lê Lợi", "Nguyễn Huệ", "Đồng Khởi", "Hai Bà Trưng"]),
    ("TP. Hồ Chí Minh", "Quận 3", "Phường Võ Thị Sáu", ["Nam Kỳ Khởi Nghĩa", "Pasteur", "Điện Biên Phủ", "Võ Văn Tần"]),
    ("TP. Hồ Chí Minh", "Quận Phú Nhuận", "Phường 9", ["Phan Xích Long", "Nguyễn Văn Trỗi", "Huỳnh Văn Bánh"]),
    ("TP. Hồ Chí Minh", "TP. Thủ Đức", "Phường Thảo Điền", ["Xuân Thủy", "Quốc Hương", "Nguyễn Văn Hưởng"]),
    ("Hà Nội", "Quận Hoàn Kiếm", "Phường Tràng Tiền", ["Hàng Bài", "Lý Thường Kiệt", "Trần Hưng Đạo"]),
    ("Hà Nội", "Quận Cầu Giấy", "Phường Dịch Vọng", ["Xuân Thủy", "Trần Thái Tông", "Trung Kính"]),
    ("Hà Nội", "Quận Đống Đa", "Phường Láng Hạ", ["Thái Hà", "Chùa Bộc", "Huỳnh Thúc Kháng"]),
    ("Đà Nẵng", "Quận Hải Châu", "Phường Hải Châu 1", ["Bạch Đằng", "Trần Phú", "Nguyễn Văn Linh"]),
    ("Đà Lạt", "TP. Đà Lạt", "Phường 1", ["Nguyễn Chí Thanh", "Phan Đình Phùng", "Trần Phú"]),
    ("Cần Thơ", "Quận Ninh Kiều", "Phường Tân An", ["30 Tháng 4", "Nguyễn Trãi", "Hai Bà Trưng"]),
    ("Huế", "TP. Huế", "Phường Phú Hội", ["Lê Lợi", "Hùng Vương", "Nguyễn Huệ"]),
    ("Hải Phòng", "Quận Ngô Quyền", "Phường Máy Tơ", ["Lạch Tray", "Điện Biên Phủ", "Lê Hồng Phong"]),
]

addresses = []
addr_id = 1
customer_addresses_map = {}

for c in customers:
    u = next(x for x in users if x["id"] == c["user_id"])
    count = 2 if (c["user_id"] == 4 or random.random() < 0.5) else 1
    customer_addresses_map[c["user_id"]] = []
    for idx in range(count):
        prov, dist, ward, streets = random.choice(LOCATIONS)
        street_no = random.randint(12, 458)
        street = f"{street_no} {random.choice(streets)}"
        addr = {
            "id": addr_id,
            "customer_id": c["user_id"],
            "recipient_name": u["full_name"],
            "phone": u["phone"],
            "province": prov,
            "district": dist,
            "ward": ward,
            "street": street,
            "is_default": 1 if idx == 0 else 0,
            "created_at": c["created_at"],
        }
        addresses.append(addr)
        customer_addresses_map[c["user_id"]].append(addr)
        addr_id += 1

# ============================================================================
# 3. DANH MUC (6 danh muc)
# ============================================================================
categories = [
    (1, "Cà phê rang", "ca-phe-rang", "Hạt cà phê đặc sản Việt Nam rang nhỏ mẻ mỗi tuần theo từng vùng trồng.", 1),
    (2, "Drip bag và hòa tan", "drip-bag-hoa-tan", "Cà phê túi lọc pha rót và hòa tan sấy lạnh giữ nguyên hương hạt rang mộc.", 2),
    (3, "Dụng cụ pha chế", "dung-cu-pha-che", "Phễu lọc, bình pha, ấm rót và cân điện tử cho quầy pha cà phê tại nhà.", 3),
    (4, "Ly và cốc gốm", "ly-coc-gom", "Cốc gốm thủ công và ly thủy tinh giữ nhiệt, tối ưu cảm nhận hương vị.", 4),
    (5, "Phụ kiện", "phu-kien", "Giấy lọc, máy xay tay, hộp kín khí và dụng cụ vệ sinh thiết yếu.", 5),
    (6, "Quà tặng và combo", "qua-tang-combo", "Hộp thử vị và bộ pha khởi đầu đóng gói chỉn chu để biếu tặng.", 6),
]

# ============================================================================
# 4. SAN PHAM (50 san pham viet tay: 14 + 6 + 12 + 8 + 6 + 4)
# ============================================================================
# Moi muc: (cat_id, name, slug, short_desc, desc, origin, roast_level, is_featured, variants)
# variants: list of (label, price, compare_at_price)
PRODUCT_CATALOG = [
    # --- 1. CA PHE RANG (14) ---
    (1, "Arabica Cầu Đất Washed", "arabica-cau-dat-washed",
     "Hương hoa trắng, cam vàng và hậu ngọt mật mía từ độ cao 1.550m Đà Lạt.",
     "Thu hoạch chín mọng 100% tại vùng Cầu Đất (1.550m), sơ chế ướt lên men 18 giờ và phơi giàn nắng tự nhiên. Rang sáng vừa giúp giữ trọn độ chua thanh của cam vàng, thoảng hương hoa nhài và hậu vị ngọt kéo dài.\n\nGợi ý pha pour-over V60 tỉ lệ 1:15 (16g cà phê với 240ml nước 92°C), thời gian chiết xuất 2 phút 30 giây. Hợp uống nóng hoặc rót qua đá viên lớn.",
     "Cầu Đất, Đà Lạt · 1.550m", "light", 1,
     [("250g · Nguyên hạt", 189000, 210000), ("500g · Nguyên hạt", 359000, 395000), ("1kg · Nguyên hạt", 680000, None)]),

    (1, "Arabica Cầu Đất Honey", "arabica-cau-dat-honey",
     "Chua dịu kiểu mơ chín, vị ngọt caramel dày và hương trà đào rõ nét.",
     "Giữ lại lớp thịt quả khi phơi trên giàn lưới trong 14 ngày tại Xuân Trường, Đà Lạt. Mức rang vừa mở ra cấu trúc vị tròn đầy, nổi bật nốt mơ chín, đường nâu và hậu vị sạch.\n\nPhù hợp cho cả pha giấy lọc lẫn pha máy espresso. Với Aeropress, dùng 18g cà phê xay trung bình, 220ml nước 90°C, ủ 90 giây rồi ép chậm.",
     "Cầu Đất, Đà Lạt · 1.500m", "medium", 1,
     [("250g · Nguyên hạt", 195000, None), ("500g · Nguyên hạt", 370000, 390000)]),

    (1, "Robusta Buôn Ma Thuột Honey", "robusta-buon-ma-thuot-honey",
     "Đậm đà hương cacao đen, hạt dẻ rang và lớp crema dày mịn khi pha phin.",
     "Fine Robusta trồng ở độ cao 750m tại Cư M'gar, Đắk Lắk, chọn trái chín đỏ và sơ chế mật ong. Rang đậm vừa giúp giảm gắt, làm nổi vị sô-cô-la đen, hạt phỉ và hậu ngọt dịu không khét.\n\nDùng pha phin truyền thống: 25g cà phê xay vừa, châm 30ml nước 93°C ủ 45 giây rồi rót tiếp 55ml. Rất hợp kết hợp sữa đặc hoặc uống đen đá.",
     "Buôn Ma Thuột · 750m", "dark", 1,
     [("250g · Nguyên hạt", 125000, 140000), ("500g · Nguyên hạt", 235000, 260000), ("1kg · Nguyên hạt", 445000, None)]),

    (1, "Robusta Buôn Ma Thuột Natural", "robusta-buon-ma-thuot-natural",
     "Vị đậm chắc, mùi mít chín nhẹ, đường thắng và hạt điều rang bùi.",
     "Phơi nguyên trái trên sân gạch dưới nắng Tây Nguyên suốt 18 ngày để đường tự nhiên thấm sâu vào nhân. Rang đậm có kiểm soát giữ thân vị dày, thơm nồng mùi đường nâu và hạt điều.\n\nThích hợp pha phin nhôm hoặc Moka Pot. Nếu pha Moka Pot 3 cup, dùng 18g cà phê xay mịn vừa và nước nóng 85°C ở khoang dưới để tránh đắng gắt.",
     "Buôn Ma Thuột · 700m", "dark", 0,
     [("250g · Nguyên hạt", 119000, None), ("500g · Nguyên hạt", 225000, None)]),

    (1, "Arabica Khe Sanh Washed", "arabica-khe-sanh-washed",
     "Hương chanh dây, thảo mộc nhẹ và hậu vị trà xanh mát cổ từ Quảng Trị.",
     "Trồng trên nền đất đỏ bazan vùng Hướng Hóa ở độ cao 700m, giống Catimor Khe Sanh mang cá tính chua tươi và mùi thảo mộc đặc trưng. Rang sáng để bộc lộ nốt chanh dây và vỏ bưởi.\n\nNgon nhất khi pha Cold Brew tỉ lệ 1:10 ủ lạnh 14 tiếng, hoặc pha V60 với nước 91°C để cảm nhận vị trà rõ rệt.",
     "Khe Sanh, Quảng Trị · 700m", "light", 1,
     [("250g · Nguyên hạt", 165000, 185000), ("500g · Nguyên hạt", 315000, None)]),

    (1, "Arabica Khe Sanh Natural", "arabica-khe-sanh-natural",
     "Nốt dâu tằm, rượu vang đỏ nhẹ và vị ngọt mứt quả kéo dài.",
     "Những mẻ trái chín cuối vụ tại Khe Sanh được phơi khô nguyên vỏ trên giàn cao giúp hạt mang hương quả mọng đậm và độ ngọt cao. Rang mức vừa để cân bằng giữa vị chua trái cây và cacao.\n\nKhuyên pha bằng phễu đáy phẳng Kalita tỉ lệ 1:15, nhiệt độ nước 90°C, chia 3 lần rót đều tay.",
     "Khe Sanh, Quảng Trị · 750m", "medium", 0,
     [("250g · Nguyên hạt", 179000, None), ("500g · Nguyên hạt", 340000, 365000)]),

    (1, "Arabica Sơn La Washed", "arabica-son-la-washed",
     "Thơm táo xanh, hạnh nhân và vị ngọt sạch dễ uống mỗi sáng.",
     "Hạt Arabica vùng Chiềng Ban, Mai Sơn (1.100m) sơ chế ướt bằng nguồn nước suối núi. Rang vừa sáng cho tách cà phê cân bằng, ít đắng, nổi mùi táo xanh và hạt hạnh nhân rang.\n\nHợp pha giấy lọc, French Press hoặc máy pha gia đình. Với French Press, dùng 20g cà phê xay thô với 300ml nước 92°C, ngâm 4 phút.",
     "Sơn La · 1.100m", "medium", 1,
     [("250g · Nguyên hạt", 169000, None), ("500g · Nguyên hạt", 320000, None)]),

    (1, "Culi Sơn La Rang Vừa", "culi-son-la-rang-vua",
     "Hạt tròn đơn nhân cô đặc hương vị: sô-cô-la sữa, caramel và chút cam khô.",
     "Tuyển lọc những hạt Peaberry (Culi) tròn đơn nhân từ vụ thu hoạch Sơn La, hàm lượng tinh dầu cao hơn hạt phẳng thông thường. Rang vừa giúp vị dày, thơm mùi bơ cacao và cam thảo.\n\nPha Espresso chiết xuất 18g lấy 36g trong 27 giây cho lớp crema mịn, uống cùng sữa tươi không đường rất hài hòa.",
     "Sơn La · 1.150m", "medium", 0,
     [("250g · Nguyên hạt", 185000, 205000), ("500g · Nguyên hạt", 355000, None)]),

    (1, "Arabica Lâm Đồng Lạc Dương", "arabica-lam-dong-lac-duong",
     "Hương hoa cà phê, quýt chín và mật ong rừng từ vùng Langbiang.",
     "Thu hái ở độ cao 1.600m dưới chân núi Langbiang, khí hậu lạnh quanh năm giúp trái chín chậm và tích đường cao. Rang sáng làm bật vị chua thanh kiểu quýt chín và hậu mật ong.\n\nKhuyến nghị pha V60 hoặc Chemex với tỉ lệ 1:16, nước 93°C, xay cỡ đường cát trung bình.",
     "Lâm Đồng · 1.600m", "light", 0,
     [("250g · Nguyên hạt", 215000, None), ("500g · Nguyên hạt", 410000, 440000)]),

    (1, "Blend Sáng Tĩnh Lặng (70A/30R)", "blend-sang-tinh-lang",
     "Phối trộn 70% Arabica Cầu Đất và 30% Fine Robusta, thơm hạt rang, ít chua.",
     "Công thức phối trộn quen thuộc của Nhà Rang dành cho người thích ly cà phê cân bằng: đủ thơm hương trái cây từ Arabica nhưng vẫn có độ đậm và hậu cacao của Robusta.\n\nĐa dụng cho cả pha máy Espresso, Moka Pot lẫn pha phin. Dùng 18g cho máy pha đôi, chiết xuất ở 92°C.",
     "Cầu Đất & Buôn Ma Thuột", "medium", 1,
     [("250g · Nguyên hạt", 159000, None), ("500g · Nguyên hạt", 299000, 325000), ("1kg · Nguyên hạt", 575000, None)]),

    (1, "Blend Phin Truyền Thống (40A/60R)", "blend-phin-truyen-thong",
     "Đậm vị cà phê sữa đá Sài Gòn: thơm sô-cô-la đắng, bơ lạc và hậu ngọt.",
     "Kết hợp 60% Robusta Buôn Ma Thuột rang đậm cùng 40% Arabica Lâm Đồng rang vừa, không tẩm hương liệu hay bơ dầu. Cho nước cốt sánh, thơm sâu và không gắt cổ.\n\nPha phin 25g cà phê, rót 80ml nước sôi 94°C, thêm 25ml sữa đặc và đá bi để có ly nâu đá chuẩn vị.",
     "Buôn Ma Thuột & Lâm Đồng", "dark", 0,
     [("250g · Xay pha phin", 135000, None), ("500g · Xay pha phin", 255000, 280000)]),

    (1, "Blend Espresso Nhà Rang", "blend-espresso-nha-rang",
     "Tối ưu cho máy pha gia đình: crema dày, vị caramel và hạnh nhân nướng.",
     "Phối giữa Arabica Sơn La và Robusta chế biến ướt theo tỉ lệ 60/40, hồ sơ rang phát triển chậm giúp hạt ổn định áp suất chiết xuất. Khi pha với sữa tươi tạo vị ngọt béo tự nhiên.\n\nTỉ lệ khuyến nghị 1:2 (18g bột lấy 36g cốt) trong 26–30 giây ở 93°C.",
     "Sơn La & Buôn Ma Thuột", "medium", 0,
     [("250g · Nguyên hạt", 165000, None), ("500g · Nguyên hạt", 315000, None), ("1kg · Nguyên hạt", 595000, 640000)]),

    (1, "Typica Đà Lạt Lô Nhỏ", "typica-da-lat-lo-nho",
     "Hương trà ô long, đào trắng và đường phèn từ giống Typica cổ.",
     "Mẻ nhỏ sản lượng hạn chế từ nông hộ tại Trạm Hành, Cầu Đất. Giống Typica hạt dài cho hương thơm tinh tế của hoa trắng, trà ô long và hậu vị ngọt thanh như đường phèn.\n\nChỉ rang mức sáng nhẹ. Pha V60 tỉ lệ 1:16, nước 92°C, dùng nước lọc mềm (TDS 50–80 ppm) để vị trà rõ nhất.",
     "Cầu Đất, Đà Lạt · 1.600m", "light", 1,
     [("250g · Nguyên hạt", 265000, None)]),

    (1, "Cold Brew Blend Hạt Thô", "cold-brew-blend-hat-tho",
     "Phối trộn riêng để ủ lạnh: mát vị cam sấy, cacao nhẹ và gần như không đắng.",
     "Xay sẵn cỡ thô đồng đều từ Arabica Khe Sanh và Cầu Đất rang vừa sáng, đóng túi van một chiều. Khi ngâm lạnh 14–16 giờ cho nước cốt trong, thơm vỏ cam sấy và hậu ngọt tự nhiên.\n\nTỉ lệ ủ gợi ý: 50g cà phê với 500ml nước mát, lọc qua giấy lọc để uống dần trong 4 ngày.",
     "Khe Sanh & Cầu Đất", "medium", 0,
     [("250g · Xay thô Cold Brew", 175000, None), ("500g · Xay thô Cold Brew", 330000, None)]),

    # --- 2. DRIP BAG VA HOA TAN (6) ---
    (2, "Hộp 10 Gói Drip Arabica Cầu Đất", "drip-arabica-cau-dat",
     "10 túi lọc tai treo 12g rang xay mộc, mở ra là pha được ly pour-over.",
     "Mỗi gói chứa 12g Arabica Cầu Đất rang vừa xay đúng cỡ lọc, nạp khí nitơ để giữ hương thơm như mới xay. Không cần phễu hay cân, chỉ cần ly cao và ấm nước nóng.\n\nCách pha: xé miệng túi, gài hai tai lên miệng ly, rót 30ml nước 92°C ủ 30 giây, sau đó rót thêm 150ml làm 2 lần.",
     "Cầu Đất, Đà Lạt · 1.550m", "medium", 1,
     [("Hộp 10 gói (120g)", 145000, 165000), ("Hộp 20 gói (240g)", 275000, 310000)]),

    (2, "Hộp 10 Gói Drip Robusta Đậm Đà", "drip-robusta-dam-da",
     "Túi lọc vị đậm kiểu cà phê phin, hợp mang đi làm hoặc đi công tác.",
     "Sử dụng Fine Robusta Buôn Ma Thuột rang đậm vừa, đóng 14g mỗi túi cho tách cà phê dày vị cacao và hạt dẻ. Tiện lợi khi uống nóng hoặc pha ít nước để uống với đá.\n\nRót tổng cộng 120ml nước 93°C (nếu uống đá chỉ dùng 90ml), thời gian nhỏ giọt khoảng 2 phút.",
     "Buôn Ma Thuột · 750m", "dark", 0,
     [("Hộp 10 gói (140g)", 115000, None), ("Hộp 20 gói (280g)", 215000, None)]),

    (2, "Hộp Drip Thử Vị 3 Vùng Trồng", "drip-thu-vi-3-vung",
     "9 gói gồm Cầu Đất, Khe Sanh và Sơn La để nếm thử sự khác biệt từng vùng.",
     "Bộ hộp gồm 3 gói Arabica Cầu Đất (chua thanh cam vàng), 3 gói Arabica Khe Sanh (hương chanh dây, thảo mộc) và 3 gói Arabica Sơn La (táo xanh, hạnh nhân). Kèm thẻ ghi chú nốt hương in giấy mỹ thuật.\n\nPhù hợp cho người mới tìm hiểu cà phê đặc sản muốn tự so sánh hương vị tại nhà.",
     "Đà Lạt · Khe Sanh · Sơn La", "light", 0,
     [("Hộp 9 gói (108g)", 149000, None)]),

    (2, "Cà Phê Hòa Tan Sấy Lạnh Arabica", "hoa-tan-say-lanh-arabica",
     "Chiết xuất 100% Arabica Lâm Đồng sấy thăng hoa ở -40°C, tan nhanh cả nước lạnh.",
     "Thay vì sấy phun nhiệt cao làm mất mùi, dịch chiết cà phê được đông lạnh sâu và thăng hoa chân không để giữ lại hương hoa quả và vị ngọt tự nhiên. Không đường, không chất độn.\n\nPha 1 gói 2.5g với 120ml nước nóng hoặc nước lọc lạnh, khuấy 5 giây là dùng được ngay.",
     "Lâm Đồng · 1.500m", "medium", 0,
     [("Hộp 12 gói", 155000, 175000), ("Hũ thủy tinh 50g", 195000, None)]),

    (2, "Túi Ủ Lạnh Cold Brew Nhúng 6 Gói", "tui-u-lanh-cold-brew-6-goi",
     "Túi lọc vải không dệt chứa 35g cà phê xay thô, thả vào bình là xong.",
     "Mỗi túi lọc thiết kế vừa cho 350–400ml nước lọc, giúp bạn làm cà phê ủ lạnh sạch bã mà không cần dụng cụ lọc riêng. Hạt Arabica Sơn La rang vừa cho vị êm, hương cacao sữa.\n\nNgâm túi trong ngăn mát tủ lạnh 12 đến 16 tiếng rồi vớt bỏ túi, bảo quản dùng trong 4 ngày.",
     "Sơn La · 1.100m", "medium", 0,
     [("Túi 6 gói (210g)", 169000, None)]),

    (2, "Cà Phê Hòa Tan Sấy Lạnh Vị Cacao", "hoa-tan-say-lanh-cacao",
     "Phối trộn cà phê sấy lạnh cùng bột cacao Đắk Lắk nguyên chất, không đường.",
     "Tỉ lệ 75% tinh chất cà phê Robusta - Arabica sấy lạnh kết hợp 25% bột cacao lên men tự nhiên, mang lại mùi mocha dịu nhẹ mà không bị ngọt gắt.\n\nPha với 150ml sữa tươi ấm hoặc sữa hạt tạo nên ly mocha sáng nhanh gọn trong 1 phút.",
     "Đắk Lắk & Lâm Đồng", "dark", 0,
     [("Hộp 10 gói", 145000, None)]),

    # --- 3. DUNG CU PHA CHE (12) ---
    (3, "Phễu Lọc Gốm V60 Cỡ 02", "pheu-loc-gom-v60-02",
     "Phễu lọc gốm sứ tráng men giữ nhiệt ổn định, rãnh xoắn thoát nước đều.",
     "Đúc từ đất sét trắng nung ở 1.250°C với các đường gân xoắn ốc bên trong giúp giấy lọc không bám sát thành phễu, giữ dòng chảy thông thoáng. Cỡ 02 pha thoải mái từ 1 đến 4 tách (15–35g cà phê).\n\nĐường kính miệng 11.5cm, cao 10cm, nặng 320g. Dùng chung với giấy lọc hình nón cỡ 02, vệ sinh được trong máy rửa chén.",
     None, None, 1,
     [("Màu trắng kem", 245000, 280000), ("Màu nâu đất", 255000, None)]),

    (3, "Phễu Lọc Thủy Tinh Đáy Phẳng", "pheu-loc-thuy-tinh-day-phang",
     "Thủy tinh borosilicate chịu nhiệt, thiết kế 3 lỗ thoát giúp chiết xuất ngọt đều.",
     "Phễu đáy phẳng giảm sai số khi rót nước, rất dễ làm quen cho người mới tập pour-over. Chất liệu thủy tinh borosilicate dày 2.5mm chịu sốc nhiệt từ -10°C đến 120°C.\n\nKích thước cỡ 185 (pha 18–30g cà phê), đế silicone rời chống trượt khi đặt lên bình server hoặc trực tiếp lên cốc.",
     None, None, 0,
     [("Cỡ 185 · Trong suốt", 285000, None)]),

    (3, "Bình Server Thủy Tinh 600ml", "binh-server-thuy-tinh-600ml",
     "Bình đựng cà phê có vạch chia ml rõ nét, vòi rót chống nhỏ giọt.",
     "Thân bình thổi từ thủy tinh chịu nhiệt nhẹ tay, có vạch chia từ 100ml đến 600ml dễ canh lượng nước chiết xuất. Nắp đậy có gioăng silicone giữ ấm lâu hơn.\n\nĐường kính miệng 8.2cm tương thích với hầu hết phễu V60 và phễu đáy phẳng. Không đun trực tiếp trên bếp gas.",
     None, None, 0,
     [("Dung tích 600ml", 195000, 220000), ("Dung tích 360ml", 165000, None)]),

    (3, "Bình Pha Ép Aeropress Go", "binh-pha-ep-aeropress-go",
     "Dụng cụ pha ép khí nén gọn nhẹ, đóng trọn bộ trong chiếc cốc du lịch.",
     "Chiết xuất cà phê sạch bã, đậm đà chỉ trong 2 phút nhờ áp suất tay kết hợp giấy lọc tròn. Toàn bộ thân piston, muỗng đong, que khuấy và hộp giấy lọc xếp gọn trong cốc 440ml có nắp silicone.\n\nChất liệu nhựa polypropylene không chứa BPA, chịu nhiệt tốt, dễ rửa chỉ bằng cách xả nước ấm.",
     None, None, 1,
     [("Bộ tiêu chuẩn", 890000, 960000)]),

    (3, "Bình Pha French Press 600ml", "binh-pha-french-press-600ml",
     "Lưới lọc thép không gỉ 2 lớp cho tách cà phê dày vị, giữ trọn lớp dầu hạt.",
     "Khung bảo vệ inox 304 mờ chắc chắn bọc quanh lõi thủy tinh borosilicate 600ml (pha 3–4 tách). Bộ lọc kép bằng lưới thép mắt mịn hạn chế tối đa cặn bột rơi vào ly.\n\nThích hợp pha cà phê xay thô, pha trà lá nguyên cánh hoặc đánh bọt sữa thủ công tại nhà.",
     None, None, 0,
     [("600ml · Đen mờ", 320000, None), ("350ml · Đen mờ", 260000, None)]),

    (3, "Ấm Pha Moka Pot Nhôm 3 Cup", "am-pha-moka-pot-3-cup",
     "Ấm đun bếp kiểu Ý chiết xuất cà phê đậm sánh như espresso không cần máy.",
     "Đúc từ hợp kim nhôm dẫn nhiệt nhanh, thiết kế thân 8 cạnh cổ điển giúp phân tán nhiệt đều. Dung tích 3 cup cho ra khoảng 130–150ml cốt cà phê đậm đà.\n\nTay cầm nhựa phenolic cách nhiệt, van an toàn bằng đồng. Dùng được trên bếp gas và bếp hồng ngoại (bếp từ cần thêm đĩa chuyển nhiệt).",
     None, None, 0,
     [("3 Cup (150ml)", 385000, 420000), ("6 Cup (300ml)", 485000, None)]),

    (3, "Ấm Rót Cổ Ngỗng Inox 600ml", "am-rot-co-ngong-600ml",
     "Vòi cổ ngỗng đường kính 6mm kiểm soát dòng nước mảnh và thẳng đứng.",
     "Thân ấm bằng thép không gỉ 304 phủ sơn tĩnh điện đen nhám, chống bám vân tay. Nắp ấm có lỗ cắm nhiệt kế tiện theo dõi nhiệt độ nước khi pha giấy lọc.\n\nDung tích sử dụng tối ưu 500–600ml, nặng 410g cân bằng tay cầm. Đáy phẳng đun được trên bếp từ và bếp gas lửa nhỏ.",
     None, None, 1,
     [("600ml · Đen nhám", 445000, 490000), ("600ml · Inox xước", 425000, None)]),

    (3, "Ấm Rót Điện Kiểm Soát Nhiệt 800ml", "am-rot-dien-nhiet-800ml",
     "Chỉnh chính xác từng độ từ 40°C đến 100°C, giữ ấm 60 phút, màn hình LED.",
     "Công suất 1.200W đun sôi 600ml nước trong khoảng 3 phút, tích hợp đồng hồ bấm giờ chiết xuất ngay trên đế điện. Vòi cổ ngỗng cong mượt giúp dòng rót không bị đứt đoạn.\n\nPhù hợp cho người pha pour-over thường xuyên muốn kiểm soát ổn định nhiệt độ giữa các mẻ cà phê khác nhau.",
     None, None, 0,
     [("800ml · Đen mờ", 1290000, 1450000)]),

    (3, "Cân Điện Tử Pha Cà Phê Có Bấm Giờ", "can-dien-tu-pha-ca-phe",
     "Độ chia 0.1g, tải tối đa 2kg, sạc USB-C và có tấm lót silicone cách nhiệt.",
     "Cảm biến phản hồi nhanh, hiển thị đồng thời trọng lượng và thời gian chiết xuất trên màn hình LED ẩn dưới mặt kính mờ. Tích hợp chế độ tự chạy đồng hồ khi phát hiện giọt nước đầu tiên.\n\nPin sạc 1.000mAh dùng khoảng 2 tháng mỗi lần sạc. Kích thước 13x15cm vừa vặn cả bình server lẫn tay pha espresso.",
     None, None, 1,
     [("Bản tiêu chuẩn · Đen", 420000, 470000)]),

    (3, "Phin Pha Cà Phê Inox 304 Đế Rời", "phin-pha-inox-304",
     "Phin inox dày 0.8mm khoan lỗ mịn bằng laser, nhỏ giọt đều trong 5 phút.",
     "Gia công từ inox 304 an toàn thực phẩm, gài nén thiết kế vít vặn chắc chắn giúp ổn định độ nén bột. Miệng phin đường kính 7.5cm đặt vừa đa số cốc sứ và ly thủy tinh.\n\nDung tích 170ml pha chuẩn 20–25g bột cà phê. Đi kèm nắp đậy kiêm đĩa lót chống nhỏ giọt sau khi pha.",
     None, None, 0,
     [("Cỡ nhỏ (1 ly)", 115000, None), ("Cỡ lớn (2–3 ly)", 155000, None)]),

    (3, "Bình Ủ Lạnh Cold Brew Thủy Tinh 1L", "binh-u-lanh-cold-brew-1l",
     "Lõi lọc lưới thép siêu mịn tháo rời, dễ vệ sinh và vừa cánh cửa tủ lạnh.",
     "Thân bình thủy tinh dày 1.000ml kèm ống lọc inox mắt lưới 300 micron cho nước cốt trong, không cặn bột. Nắp vặn kín khí giúp cà phê không bị ám mùi thực phẩm trong tủ lạnh.\n\nChiều cao 26cm, đường kính đáy 8.8cm, gọn gàng cho việc ủ sẵn cà phê uống trong tuần.",
     None, None, 0,
     [("1 Lít · Nắp đen", 275000, 310000)]),

    (3, "Bình Đánh Bọt Sữa Cầm Tay Thủ Công", "binh-danh-bot-sua-thu-cong",
     "Lưới pittông kép tạo lớp bọt sữa mịn trong 30 giây không cần điện.",
     "Thân inox 304 hai lớp giúp giữ nhiệt sữa ở mức 60–65°C trong lúc đánh bọt. Chỉ cần đổ 150ml sữa tươi thanh trùng ấm vào bình và đẩy pittông đều tay 25–30 nhịp.\n\nDung tích 400ml, vệ sinh đơn giản dưới vòi nước ấm. Hợp pha cappuccino và latte tại nhà.",
     None, None, 0,
     [("400ml · Inox", 295000, None)]),

    # --- 4. LY VA COC GOM (8) ---
    (4, "Cốc Gốm Men Tro Không Quai 220ml", "coc-gom-men-tro-220ml",
     "Gốm vuốt tay Bát Tràng phủ men tro tự nhiên, giữ ấm lâu và đầm tay.",
     "Mỗi chiếc cốc được chuốt thủ công nên vân men tro có sắc độ khác nhau nhẹ, bề mặt hơi sần tạo cảm giác cầm chắc tay. Miệng cốc loe nhẹ giúp hương cà phê lan tỏa khi uống.\n\nDung tích 220ml, cao 8.5cm, phù hợp uống pour-over nóng hoặc flat white. An toàn với lò vi sóng và máy rửa chén.",
     None, None, 1,
     [("Men tro xám", 165000, None), ("Men nâu đất", 165000, None)]),

    (4, "Cốc Sứ Có Quai Dáng Bầu 300ml", "coc-su-co-quai-300ml",
     "Thành sứ dày 4mm giữ nhiệt tốt, quai cầm rộng thoải mái 2 ngón tay.",
     "Thiết kế dáng bầu tròn đáy giúp xoay trộn crema và sữa mượt mà khi rót latte art. Lớp men láng bên trong hạn chế bám màu cà phê sau thời gian dài sử dụng.\n\nDung tích 300ml, đường kính miệng 9cm. Hai tông màu trầm ấm dễ phối với mọi góc bàn làm việc.",
     None, None, 0,
     [("Kem cát", 185000, 210000), ("Xanh rêu trầm", 185000, None)]),

    (4, "Ly Espresso Gốm Kèm Đĩa Lót 90ml", "ly-espresso-gom-90ml",
     "Bộ ly nhỏ 90ml chuyên dùng cho espresso đơn và đôi, lòng ly vát tròn.",
     "Thành ly dày giúp ổn định nhiệt độ cốt espresso vốn dễ nguội nhanh. Đáy trong bo cong hỗ trợ giữ nguyên lớp crema vàng nâu khi chiết xuất trực tiếp từ máy.\n\nGồm 1 ly 90ml và 1 đĩa lót đồng bộ đường kính 11.5cm, men lì chống trầy xước khi đặt muỗng.",
     None, None, 0,
     [("Nâu espresso", 155000, None), ("Trắng ngà", 155000, None)]),

    (4, "Ly Thủy Tinh Hai Lớp 250ml", "ly-thuy-tinh-hai-lop-250ml",
     "Thủy tinh borosilicate 2 lớp cách nhiệt, không đọng sương khi uống đá.",
     "Lớp chân không ở giữa giữ cà phê nóng lâu mà bên ngoài cầm không bị bỏng tay; khi pha đồ uống đá mặt ngoài vẫn khô ráo không làm ướt bàn làm việc.\n\nDung tích 250ml, trọng lượng nhẹ 140g. Nên rửa bằng tay với mút mềm để giữ độ trong suốt.",
     None, None, 0,
     [("Cỡ 250ml (1 ly)", 125000, None), ("Bộ 2 ly 250ml", 230000, 250000)]),

    (4, "Ly Cold Brew Thủy Tinh Gân Sọc 380ml", "ly-cold-brew-gan-soc-380ml",
     "Thân ly sọc dọc cầm chắc tay, dáng cao vừa vặn đá viên và lát cam sấy.",
     "Chất liệu thủy tinh trong suốt dày dặn, phần đáy nặng tạo cảm giác vững chãi. Miệng ly rộng 8cm dễ cho đá viên lớn và vệ sinh sạch sẽ.\n\nDung tích 380ml thích hợp cho cà phê ủ lạnh, bạc xỉu, americano đá hoặc trà trái cây.",
     None, None, 0,
     [("380ml · Trong suốt", 95000, None), ("380ml · Khói nhạt", 105000, None)]),

    (4, "Ly Thử Hương Cảm Quan 200ml", "ly-thu-huong-cam-quan-200ml",
     "Miệng ly thu hẹp rồi loe nhẹ kiểu ly vang, gom hương thơm cà phê lọc.",
     "Thiết kế lấy cảm hứng từ ly nếm chuyên nghiệp giúp tập trung các tầng hương hoa và trái cây ở khoang trên, đồng thời làm nguội cà phê đều để vị ngọt bộc lộ rõ hơn.\n\nThủy tinh mỏng 1.5mm, dung tích 200ml, nặng chỉ 95g.",
     None, None, 0,
     [("Trong suốt · 200ml", 145000, None)]),

    (4, "Bình Giữ Nhiệt Du Lịch Lõi Sứ 360ml", "binh-giu-nhiet-loi-su-360ml",
     "Lõi tráng men gốm không làm đổi mùi cà phê, giữ nóng 6 giờ và lạnh 10 giờ.",
     "Khắc phục nhược điểm có mùi kim loại của bình inox thông thường, lớp phủ gốm bên trong giữ trọn hương thơm nguyên bản của cà phê rang mộc. Nắp bật chống tràn có khóa an toàn.\n\nDung tích 360ml vừa khay đựng ly ô tô và ngăn bên ba lô. Đáy có đệm silicone giảm tiếng ồn khi đặt xuống bàn.",
     None, None, 0,
     [("Màu đất nung", 365000, 395000), ("Màu đen nhám", 365000, None)]),

    (4, "Chén Cupping Sứ Trắng 200ml", "chen-cupping-su-trang-200ml",
     "Chén thử nếm tiêu chuẩn đường kính 9cm, thành dày giữ nhiệt đều.",
     "Dùng để nếm so sánh nhiều mẻ cà phê cùng lúc theo quy chuẩn cupping. Lòng chén trắng tinh giúp quan sát màu nước và lớp váng cà phê rõ ràng.\n\nDung tích 200ml, có thể xếp chồng gọn gàng khi cất giữ.",
     None, None, 0,
     [("1 chén", 75000, None), ("Bộ 4 chén", 275000, 300000)]),

    # --- 5. PHU KIEN (6) ---
    (5, "Giấy Lọc V60 Cỡ 02 (Hộp 100 Tờ)", "giay-loc-v60-02-100-to",
     "Giấy lọc tẩy trắng oxy không mùi giấy, tốc độ chảy ổn định.",
     "Sản xuất từ bột gỗ nguyên sinh không dùng clo, không để lại vị giấy khi tráng sơ bằng nước nóng trước khi pha. Độ dày vừa phải giúp lọc sạch dầu thừa cho tách cà phê trong trẻo.\n\nQuy cách 100 tờ/túi, tương thích mọi phễu lọc hình nón cỡ 02 (1–4 tách).",
     None, None, 0,
     [("100 tờ · Trắng oxy", 89000, None), ("100 tờ · Nâu mộc", 85000, None)]),

    (5, "Giấy Lọc Đáy Phẳng Cỡ 185 (100 Tờ)", "giay-loc-day-phang-185",
     "Giấy gấp sóng giữ phom chắc chắn, phù hợp phễu Kalita và phễu đáy phẳng.",
     "Các nếp gấp sóng đều giúp giữ khoảng trống không khí giữa giấy và thành phễu, hạn chế tắc nghẽn dòng nước khi xay mịn. Không mùi lạ sau khi tráng nước nóng.\n\nĐóng gói 100 tờ trong hộp giấy cứng bảo vệ phom sóng không bị bẹp.",
     None, None, 0,
     [("100 tờ · Cỡ 185", 105000, None)]),

    (5, "Máy Xay Tay Lưỡi Thép CNC 38mm", "may-xay-tay-cnc-38mm",
     "Lưỡi xay thép không gỉ 5 cánh đồng đều, 36 nấc chỉnh từ Espresso tới Cold Brew.",
     "Trục đôi vòng bi giúp lưỡi xay không bị rung lắc, giảm tối đa bột mịn dư gây đắng. Thân hợp kim nhôm tiện rãnh chống trượt, sức chứa 25g hạt mỗi lần xay.\n\nChỉnh cỡ xay bằng vòng xoay có tiếng click rõ ràng. Kèm chổi vệ sinh lông mềm và túi vải rút mang theo du lịch.",
     None, None, 1,
     [("Bản thân đen", 790000, 880000), ("Bản thân bạc", 790000, None)]),

    (5, "Hộp Bảo Quản Hạt Kín Khí 500g", "hop-bao-quan-hat-kin-khi-500g",
     "Thân thép sơn tĩnh điện tích hợp van thoát khí CO2 một chiều và vòng nhớ ngày.",
     "Cà phê mới rang tiếp tục nhả khí CO2; van một chiều trên nắp đẩy khí dư ra ngoài đồng thời ngăn không khí và hơi ẩm xâm nhập. Vòng xoay ngày tháng giúp theo dõi độ tươi của mẻ rang.\n\nChứa được khoảng 450–500g cà phê nguyên hạt, đi kèm muỗng đong thép gắn nam châm bên thân hộp.",
     None, None, 0,
     [("Cỡ 500g · Đen mờ", 345000, None), ("Cỡ 250g · Đen mờ", 265000, None)]),

    (5, "Nhiệt Kế Cắm Nắp Ấm Rót", "nhiet-ke-cam-nap-am",
     "Mặt đồng hồ cơ inox đo nhanh từ 0°C đến 100°C, không cần pin.",
     "Đầu dò dài 13cm bằng inox 304 dễ dàng cắm qua lỗ thông hơi trên nắp ấm cổ ngỗng hoặc kẹp vào ca đánh sữa. Mặt hiển thị rõ vùng nhiệt 88–94°C lý tưởng cho pha cà phê.\n\nCó kẹp gài tháo rời, chống nước bắn khi vệ sinh.",
     None, None, 0,
     [("Đầu dò 13cm", 115000, None)]),

    (5, "Bộ Chổi Vệ Sinh Máy Xay & Khăn Barista", "bo-choi-ve-sinh-khan-barista",
     "Chổi cán gỗ óc chó lông tự nhiên kết hợp 2 khăn sợi nhỏ thấm hút nhanh.",
     "Lông chổi cứng vừa phải dễ quét sạch bột cà phê bám trong lưỡi máy xay tay và kẽ phin mà không làm trầy kim loại. Hai khăn microfiber màu nâu tối hạn chế lộ vết cà phê.\n\nKích thước khăn 30x30cm, giặt máy thoải mái và nhanh khô.",
     None, None, 0,
     [("Bộ 1 chổi + 2 khăn", 135000, None)]),

    # --- 6. QUA TANG VA COMBO (4) ---
    (6, "Hộp Quà Thử Vị 4 Vùng Cà Phê Việt", "hop-qua-thu-vi-4-vung",
     "4 túi 100g gồm Cầu Đất, Buôn Ma Thuột, Khe Sanh, Sơn La kèm sổ tay hướng dẫn.",
     "Hộp giấy kraft cứng ép kim tên Nhà Rang, bên trong có 4 túi hạt rang mới 100g đại diện 4 vùng trồng tiêu biểu của Việt Nam. Kèm tập hướng dẫn pha cơ bản và thiệp trống để bạn tự viết lời chúc.\n\nBạn có thể chọn nguyên hạt hoặc xay sẵn theo nhu cầu của người nhận.",
     "Đà Lạt · Đắk Lắk · Quảng Trị · Sơn La", "medium", 1,
     [("4x100g · Nguyên hạt", 345000, 380000), ("4x100g · Xay pha lọc", 345000, 380000)]),

    (6, "Combo Pha Phin Cho Người Mới", "combo-pha-phin-nguoi-moi",
     "Gồm 1 phin inox 304, 1 túi Blend Phin 250g xay sẵn và 1 ly thủy tinh 380ml.",
     "Bộ khởi đầu gọn gàng cho người muốn tự pha ly cà phê sữa đá buổi sáng tại nhà. Toàn bộ dụng cụ đã được chọn khớp kích thước miệng ly để đặt phin chắc chắn.\n\nTiết kiệm 15% so với mua lẻ từng món, kèm thẻ công thức pha phin nóng và phin đá chi tiết.",
     "Buôn Ma Thuột & Lâm Đồng", "dark", 0,
     [("Bộ tiêu chuẩn", 295000, 345000)]),

    (6, "Combo Pour-Over V60 Tại Nhà", "combo-pour-over-v60",
     "Trọn bộ phễu gốm V60, bình server 600ml, 100 tờ giấy lọc và 250g Arabica Cầu Đất.",
     "Đầy đủ các món cốt lõi để bắt đầu pha cà phê giấy lọc chuẩn vị mà không phải tìm mua lẻ từng phụ kiện tương thích. Hạt Arabica Cầu Đất rang sáng vừa được đóng gói ngay trong tuần.\n\nPhù hợp làm quà tân gia, sinh nhật hoặc tự thưởng cho góc bàn làm việc tại nhà.",
     "Cầu Đất, Đà Lạt · 1.550m", "light", 1,
     [("Bộ 4 món · Phễu trắng", 645000, 718000), ("Bộ 4 món · Phễu nâu", 655000, 728000)]),

    (6, "Hộp Quà Văn Phòng Drip & Cốc Gốm", "hop-qua-van-phong-drip-coc",
     "1 hộp 10 gói Drip Cầu Đất cùng 1 cốc gốm men tro 220ml trong hộp nắp nam châm.",
     "Món quà thực tế cho đồng nghiệp hoặc khách hàng bận rộn: chỉ cần bình nước nóng văn phòng là có ngay tách cà phê rang mộc đựng trong chiếc cốc gốm thủ công ấm tay.\n\nHộp lót mút cắt định hình chống va đập, an toàn khi gửi chuyển phát nhanh toàn quốc.",
     "Cầu Đất, Đà Lạt", "medium", 0,
     [("Hộp + Cốc men tro xám", 325000, 360000), ("Hộp + Cốc men nâu đất", 325000, 360000)]),
]

assert len(PRODUCT_CATALOG) == 50, f"Can dung 50 san pham, hien co {len(PRODUCT_CATALOG)}"

products = []
variants = []
images = []
v_id = 1
img_id = 1

for p_idx, item in enumerate(PRODUCT_CATALOG, start=1):
    cat_id, name, slug, short_desc, desc, origin, roast, featured, var_list = item
    created = NOW - timedelta(days=random.randint(100, 170))
    products.append({
        "id": p_idx, "category_id": cat_id, "name": name, "slug": slug,
        "short_description": short_desc, "description": desc,
        "origin": origin, "roast_level": roast,
        "is_active": 1, "is_featured": featured, "created_at": created,
    })

    for v_idx, (label, price, compare_at) in enumerate(var_list, start=1):
        sku = f"NR-{cat_id:02d}{p_idx:02d}-{v_idx:02d}"
        variants.append({
            "id": v_id, "product_id": p_idx, "sku": sku, "label": label,
            "price": price, "compare_at_price": compare_at,
            "stock": random.randint(15, 140), "is_active": 1, "created_at": created,
        })
        v_id += 1

    # 3 anh moi san pham -> 150 anh
    num_imgs = 3
    for i_idx in range(1, num_imgs + 1):
        images.append({
            "id": img_id,
            "product_id": p_idx,
            "url": f"https://picsum.photos/seed/{slug}-{i_idx}/800/800",
            "alt_text": f"{name} - góc chụp {i_idx}",
            "sort_order": i_idx,
            "is_primary": 1 if i_idx == 1 else 0,
            "created_at": created,
        })
        img_id += 1

# Ep dung 3 bien the het hang (stock = 0) va 5 bien the sap het (stock 1..5)
# Chon cac bien the khong nam o san pham featured dau tien de trang chu van dep
out_of_stock_ids = [15, 42, 78]
low_stock_pairs = [(18, 2), (33, 4), (55, 1), (67, 5), (89, 3)]
for v in variants:
    if v["id"] in out_of_stock_ids:
        v["stock"] = 0
    for lid, lval in low_stock_pairs:
        if v["id"] == lid:
            v["stock"] = lval

# ============================================================================
# 5. MA GIAM GIA (5 coupon)
# ============================================================================
coupons = [
    {"id": 1, "code": "WELCOME10", "description": "Giảm 10% cho đơn từ 200.000 ₫",
     "discount_type": "percent", "discount_value": 10, "min_order_value": 200000,
     "max_uses": 500, "used_count": 0,
     "starts_at": NOW - timedelta(days=120), "expires_at": NOW + timedelta(days=180), "is_active": 1},
    {"id": 2, "code": "FREESHIP", "description": "Giảm 30.000 ₫ phí vận chuyển cho đơn từ 300.000 ₫",
     "discount_type": "fixed", "discount_value": 30000, "min_order_value": 300000,
     "max_uses": 300, "used_count": 0,
     "starts_at": NOW - timedelta(days=120), "expires_at": NOW + timedelta(days=180), "is_active": 1},
    {"id": 3, "code": "NHARANG50K", "description": "Giảm 50.000 ₫ cho đơn từ 500.000 ₫",
     "discount_type": "fixed", "discount_value": 50000, "min_order_value": 500000,
     "max_uses": 200, "used_count": 0,
     "starts_at": NOW - timedelta(days=120), "expires_at": NOW + timedelta(days=180), "is_active": 1},
    {"id": 4, "code": "HETHAN", "description": "Mã ưu đãi mùa thu đã hết hạn",
     "discount_type": "fixed", "discount_value": 40000, "min_order_value": 250000,
     "max_uses": 100, "used_count": 0,
     "starts_at": NOW - timedelta(days=150), "expires_at": NOW - timedelta(days=10), "is_active": 1},
    {"id": 5, "code": "VIP20", "description": "Ưu đãi 20% dành cho thành viên (tạm khóa)",
     "discount_type": "percent", "discount_value": 20, "min_order_value": 400000,
     "max_uses": 50, "used_count": 0,
     "starts_at": NOW - timedelta(days=120), "expires_at": NOW + timedelta(days=180), "is_active": 0},
]

# ============================================================================
# 6. DON HANG (~220 don trong 90 ngay gan nhat)
# ============================================================================
# Phan bo trang thai: ~55% completed, 12% shipping, 10% confirmed, 10% pending, 13% cancelled
STATUS_POOL = (
    ["completed"] * 121
    + ["shipping"] * 26
    + ["confirmed"] * 22
    + ["pending"] * 22
    + ["cancelled"] * 29
)
random.shuffle(STATUS_POOL)

# Khach co the dat hang (uu tien khach active, khach demo co it nhat 8 don)
active_customers = [u for u in users if u["role"] == "customer" and u["status"] == "active"]
in_stock_variants = [v for v in variants if v["stock"] > 0]
product_by_id = {p["id"]: p for p in products}
customer_by_id = {c["user_id"]: c for c in customers}

orders = []
order_items = []
order_histories = []
oi_id = 1
oh_id = 1

# Sinh ngay trong 90 ngay, cuoi tuan nhieu hon
day_weights = []
for d in range(90):
    dt = NOW - timedelta(days=d)
    w = 1.6 if dt.weekday() >= 5 else 1.0
    day_weights.append((d, w))

total_w = sum(w for _, w in day_weights)
day_probs = [w / total_w for _, w in day_weights]

ORDER_NOTES = [
    None, None, None, None,
    "Giao giờ hành chính giúp mình nhé.",
    "Gọi trước khi giao 15 phút.",
    "Để ở quầy lễ tân nếu mình không nghe máy.",
    "Đóng gói kỹ giúp mình vì mua làm quà.",
    "Mình muốn hạt rang mới nhất tuần này.",
]

daily_seq = {}

for o_idx, status in enumerate(STATUS_POOL, start=1):
    # Dam bao khach demo (id=4) co 8 don voi nhieu trang thai (bao gom completed, pending, shipping)
    if o_idx <= 8:
        cust_user = next(u for u in users if u["id"] == 4)
        if o_idx <= 5:
            status = "completed"
        elif o_idx == 6:
            status = "pending"
        elif o_idx == 7:
            status = "shipping"
        else:
            status = "confirmed"
    else:
        cust_user = random.choice(active_customers)

    # Chon ngay tao don (phai >= ngay tao tai khoan)
    if status == "pending":
        days_ago = random.randint(0, 3)
    elif status in ("confirmed", "shipping"):
        days_ago = random.randint(1, 8)
    else:
        r = random.random()
        acc = 0.0
        days_ago = 0
        for d, p in zip([x[0] for x in day_weights], day_probs):
            acc += p
            if r <= acc:
                days_ago = d
                break

    created_at = NOW - timedelta(days=days_ago, hours=random.randint(1, 20), minutes=random.randint(0, 59))
    if created_at < cust_user["created_at"]:
        created_at = cust_user["created_at"] + timedelta(hours=2)

    date_key = created_at.strftime("%Y%m%d")
    daily_seq[date_key] = daily_seq.get(date_key, 0) + 1
    order_code = f"NR-{date_key}-{daily_seq[date_key]:04d}"

    # Chon 1..4 mon khac nhau
    num_items = random.choices([1, 2, 3, 4], weights=[30, 40, 22, 8])[0]
    chosen_vars = random.sample(in_stock_variants, num_items)

    subtotal = 0
    current_items = []
    for v in chosen_vars:
        qty = random.choices([1, 2, 3], weights=[68, 24, 8])[0]
        line_total = v["price"] * qty
        subtotal += line_total
        current_items.append({
            "id": oi_id,
            "order_id": o_idx,
            "variant_id": v["id"],
            "product_name": product_by_id[v["product_id"]]["name"],
            "variant_label": v["label"],
            "unit_price": v["price"],
            "quantity": qty,
            "line_total": line_total,
            "created_at": created_at,
        })
        oi_id += 1

    shipping_fee = 0 if subtotal >= 500000 else 30000

    # Ap ma giam gia (~30% don)
    coupon_id = None
    discount_amount = 0
    if random.random() < 0.30:
        valid_coupons = [c for c in coupons[:3] if subtotal >= c["min_order_value"]]
        if valid_coupons:
            cp = random.choice(valid_coupons)
            coupon_id = cp["id"]
            if cp["discount_type"] == "percent":
                discount_amount = (subtotal * cp["discount_value"]) // 100
            else:
                discount_amount = min(cp["discount_value"], subtotal)
            if status != "cancelled":
                cp["used_count"] += 1

    total = subtotal + shipping_fee - discount_amount
    payment_method = random.choices(["cod", "bank_transfer"], weights=[65, 35])[0]

    if status == "completed":
        payment_status = "paid"
    elif status == "cancelled":
        payment_status = "refunded" if (payment_method == "bank_transfer" and random.random() < 0.5) else "unpaid"
    elif status == "pending":
        payment_status = "unpaid"
    else:
        payment_status = "paid" if payment_method == "bank_transfer" else "unpaid"

    addr = random.choice(customer_addresses_map[cust_user["id"]])
    full_addr = f"{addr['street']}, {addr['ward']}, {addr['district']}, {addr['province']}"

    orders.append({
        "id": o_idx, "order_code": order_code, "customer_id": cust_user["id"],
        "status": status, "payment_method": payment_method, "payment_status": payment_status,
        "recipient_name": addr["recipient_name"], "phone": addr["phone"],
        "shipping_address": full_addr, "note": random.choice(ORDER_NOTES),
        "subtotal": subtotal, "shipping_fee": shipping_fee,
        "discount_amount": discount_amount, "total": total,
        "coupon_id": coupon_id, "created_at": created_at,
    })
    order_items.extend(current_items)

    # Cong diem tich luy cho don completed
    if status == "completed":
        customer_by_id[cust_user["id"]]["loyalty_points"] += total // 10000

    # Lich su trang thai tang dan theo thoi gian
    t = created_at
    order_histories.append({
        "id": oh_id, "order_id": o_idx, "from_status": None, "to_status": "pending",
        "changed_by": cust_user["id"], "note": "Khách đặt đơn hàng mới", "created_at": t,
    })
    oh_id += 1

    if status == "cancelled":
        t = t + timedelta(hours=random.randint(1, 12))
        if random.random() < 0.6:
            order_histories.append({
                "id": oh_id, "order_id": o_idx, "from_status": "pending", "to_status": "cancelled",
                "changed_by": cust_user["id"], "note": "Khách yêu cầu hủy đơn", "created_at": t,
            })
            oh_id += 1
        else:
            order_histories.append({
                "id": oh_id, "order_id": o_idx, "from_status": "pending", "to_status": "confirmed",
                "changed_by": 3, "note": "Đã xác nhận đơn hàng", "created_at": t,
            })
            oh_id += 1
            t = t + timedelta(hours=random.randint(2, 10))
            order_histories.append({
                "id": oh_id, "order_id": o_idx, "from_status": "confirmed", "to_status": "cancelled",
                "changed_by": 2, "note": "Hủy theo yêu cầu đổi địa chỉ của khách", "created_at": t,
            })
            oh_id += 1
    else:
        chain = ["confirmed", "shipping", "completed"]
        target_idx = chain.index(status) if status in chain else -1
        prev = "pending"
        notes_map = {
            "confirmed": "Đã xác nhận đơn và chuẩn bị đóng gói",
            "shipping": "Đã bàn giao cho đơn vị vận chuyển",
            "completed": "Giao hàng thành công",
        }
        for step_i in range(target_idx + 1):
            st = chain[step_i]
            t = t + timedelta(hours=random.randint(4, 30))
            if t > NOW:
                t = NOW - timedelta(minutes=max(1, (target_idx - step_i) * 5))
            order_histories.append({
                "id": oh_id, "order_id": o_idx, "from_status": prev, "to_status": st,
                "changed_by": random.choice([1, 2, 3]), "note": notes_map[st], "created_at": t,
            })
            oh_id += 1
            prev = st

# ============================================================================
# 7. DANH GIA (~120 danh gia, chi khach co don completed chua san pham do)
# ============================================================================
REVIEW_TEMPLATES_COFFEE = [
    (5, "Hương thơm rõ, hạt rang rất mới", "Mở túi ra thơm nức mùi hạt rang mộc, pha V60 lên đúng vị cam và hậu ngọt nhẹ. Ngày rang in trên bao mới cách lúc nhận 3 ngày."),
    (5, "Pha phin đậm mà không bị gắt", "Mình pha phin uống với sữa đặc thấy rất thơm, vị cacao rõ và không có mùi khét như mấy loại mua ngoài chợ."),
    (5, "Uống nóng hay đá đều hợp", "Thử pha giấy lọc tỉ lệ 1:15 theo gợi ý trên web, nước trong, vị chua thanh dễ chịu. Sẽ mua lại túi 500g."),
    (5, "Crema dày, hậu vị ngọt lâu", "Chạy máy espresso ở nhà chiết xuất đẹp, crema màu cánh gián dày mịn. Pha latte sáng uống rất cuốn."),
    (4, "Vị cân bằng, đóng gói kỹ", "Hạt đều màu, ít hạt vỡ. Cá nhân mình thích chua hơn một chút nhưng tổng thể rất dễ uống hàng ngày."),
    (4, "Thơm mùi hạt dẻ, giao hàng nhanh", "Đặt hôm trước hôm sau đã nhận được. Hạt rang vừa đúng gu, uống đen đá buổi chiều tỉnh táo hẳn."),
    (5, "Đúng gu cà phê rang mộc", "Không tẩm bơ hay hương liệu nên uống xong cổ họng rất sạch. Nhà mình cả hai vợ chồng đều thích mẻ này."),
    (5, "Ủ lạnh cực kỳ êm", "Ngâm cold brew 14 tiếng rồi rót qua đá, hương thơm dịu và gần như không đắng, uống thay trà luôn."),
    (4, "Hạt đẹp, hương vị ổn định", "Mua lần thứ hai rồi, chất lượng giữa các mẻ khá đồng đều. Túi có khóa zip và van một chiều bảo quản tiện."),
    (3, "Hơi chua nhẹ so với gu mình", "Chất lượng hạt tốt, thơm nhưng mình quen uống đậm đắng nên loại rang sáng này hơi lạ miệng."),
    (5, "Pha Aeropress ra vị rất sạch", "Hương hoa quả mở rõ khi cà phê nguội bớt. Đáng tiền cho một mẻ rang nhỏ trong nước."),
    (5, "Tiện lợi mà vẫn giữ mùi hạt", "Drip bag mang lên công ty pha nhanh gọn, đồng nghiệp ngồi cạnh còn hỏi mua ở đâu mà thơm vậy."),
    (4, "Hòa tan nhưng không bị mùi khét", "Pha nước lạnh tan nhanh, uống giống americano loãng nhẹ, rất hợp những hôm vội không kịp pha phin."),
    (5, "Đóng gói chắc chắn, mùi thơm lâu", "Gói nào cũng căng phồng khí bảo quản, mở ra là thấy thơm ngay. Nước cốt vừa miệng."),
    (2, "Giao hơi lâu một chút", "Cà phê uống ổn nhưng đơn này bên vận chuyển giữ hàng hơi lâu nên nhận trễ 2 ngày."),
]

REVIEW_TEMPLATES_GEAR = [
    (5, "Gốm cầm đầm tay, men rất đẹp", "Màu men bên ngoài trầm ấm hơn cả ảnh chụp, giữ nhiệt tốt. Rửa xong không bị bám ố màu cà phê."),
    (5, "Rót nước mượt, dễ kiểm soát dòng", "Vòi cổ ngỗng mảnh nên mới tập pha V60 vẫn rót đều tay được. Lớp sơn đen nhám nhìn rất gọn."),
    (5, "Cân nhạy, màn hình dễ nhìn", "Độ chia 0.1g phản hồi nhanh, có sẵn bấm giờ nên sáng pha cà phê không phải cầm thêm điện thoại."),
    (5, "Máy xay chạy êm, bột đều", "Lưỡi thép CNC xay 18g hạt chỉ mất khoảng 35 giây, ít bụi mịn hơn hẳn cái máy cũ mình dùng."),
    (4, "Hoàn thiện tốt trong tầm giá", "Phễu lọc vừa khít bình server, rãnh xoắn thoát nước đều. Hộp đóng gói có lớp chống sốc dày."),
    (5, "Ly hai lớp uống đá không đọng nước", "Để trên bàn làm việc gần laptop rất yên tâm vì thành ly không bị đổ mồ hôi. Cầm nhẹ tay."),
    (4, "Tiện mang đi du lịch", "Xếp gọn hết vào cốc luôn, mang đi cắm trại pha được cà phê nóng uống sáng rất thích."),
    (5, "Giấy lọc không có mùi giấy", "Tráng sơ nước nóng rồi pha thấy nước chảy đều, không bị nghẹt dòng và giữ vị sạch."),
    (5, "Hộp kín khí đẹp, có vòng nhớ ngày", "Đựng vừa gói 500g hạt, van xả khí hoạt động tốt, mở nắp nghe tiếng xì nhẹ rất yên tâm."),
    (4, "Phin inox dày dặn", "Lỗ lọc đều nên cà phê nhỏ giọt chậm vừa phải, khoảng 5 phút là xong một ly đậm."),
    (5, "Hộp quà chỉn chu, tặng rất ưng", "Mua tặng sinh nhật sếp, hộp kraft cứng cáp kèm sổ hướng dẫn pha nên người mới cũng dùng được ngay."),
    (4, "Bình ủ lạnh lọc sạch bã", "Ống lọc tháo rửa dễ, bỏ vừa cánh cửa tủ lạnh. Ủ một bình uống được 3 ngày."),
    (3, "Kích thước hơi nhỏ hơn tưởng tượng", "Dùng pha 1–2 ly thì vừa đẹp, nhưng nếu nhà đông người chắc nên chọn cỡ lớn hơn."),
    (5, "Combo tiết kiệm, đủ món cần dùng", "Mua bộ V60 này về là pha được luôn không phải mò mẫm chọn từng món cho khớp kích cỡ."),
    (5, "Nhiệt kế lên số nhanh", "Cắm vừa lỗ trên nắp ấm cổ ngỗng, nhìn vạch nhiệt độ rõ ràng khỏi phải đoán."),
]

# Lap danh sach (customer_id, product_id, completed_time) duy nhat tu don completed
eligible_pairs = {}
variant_to_product = {v["id"]: v["product_id"] for v in variants}
order_by_id = {o["id"]: o for o in orders}

for oi in order_items:
    o = order_by_id[oi["order_id"]]
    if o["status"] == "completed":
        pid = variant_to_product[oi["variant_id"]]
        key = (o["customer_id"], pid)
        if key not in eligible_pairs or o["created_at"] < eligible_pairs[key]:
            eligible_pairs[key] = o["created_at"]

eligible_list = list(eligible_pairs.items())
random.shuffle(eligible_list)

# Giu lai toi da 125 danh gia (nhung chua it nhat 1 mon cua khach demo chua danh gia de test form viet danh gia)
reviews = []
rev_id = 1
demo_skipped = False

for (cid, pid), order_dt in eligible_list:
    if len(reviews) >= 122:
        break
    if cid == 4 and not demo_skipped:
        demo_skipped = True
        continue  # De danh it nhat 1 san pham cho khach demo thu viet danh gia
    p = product_by_id[pid]
    pool = REVIEW_TEMPLATES_COFFEE if p["category_id"] in (1, 2) else REVIEW_TEMPLATES_GEAR
    rating, title, content = random.choice(pool)
    rev_dt = order_dt + timedelta(days=random.randint(2, 7))
    if rev_dt > NOW:
        rev_dt = NOW - timedelta(hours=random.randint(1, 12))
    reviews.append({
        "id": rev_id, "product_id": pid, "customer_id": cid,
        "rating": rating, "title": title, "content": content, "created_at": rev_dt,
    })
    rev_id += 1

# ============================================================================
# 8. GIO HANG (8 dong, khach demo id=4 co dung 2 mon)
# ============================================================================
cart_items = [
    {"id": 1, "customer_id": 4, "variant_id": 1, "quantity": 1, "created_at": NOW - timedelta(hours=3)},
    {"id": 2, "customer_id": 4, "variant_id": 44, "quantity": 1, "created_at": NOW - timedelta(hours=2)},
]
cart_id = 3
for uid in [6, 7, 8, 9, 10, 11]:
    v = random.choice(in_stock_variants)
    cart_items.append({
        "id": cart_id, "customer_id": uid, "variant_id": v["id"],
        "quantity": random.randint(1, 2), "created_at": NOW - timedelta(hours=random.randint(1, 48)),
    })
    cart_id += 1

# ============================================================================
# 9. KIEM TRA TINH NHAT QUAN BANG ASSERT
# ============================================================================
assert len(users) == 63
assert len(admins) == 3
assert len(customers) == 60
assert sum(1 for u in users if u["status"] == "blocked") == 3
assert len(categories) == 6
assert len(products) == 50
assert sum(1 for v in variants if v["stock"] == 0) == 3
assert sum(1 for v in variants if 1 <= v["stock"] <= 5) == 5
assert len(coupons) == 5

# Kiem tra tung don hang
items_by_order = {}
for oi in order_items:
    items_by_order.setdefault(oi["order_id"], []).append(oi)
    assert oi["line_total"] == oi["unit_price"] * oi["quantity"]

coupon_actual_uses = {c["id"]: 0 for c in coupons}
user_by_id = {u["id"]: u for u in users}

for o in orders:
    ois = items_by_order[o["id"]]
    assert o["subtotal"] == sum(x["line_total"] for x in ois)
    expected_ship = 0 if o["subtotal"] >= 500000 else 30000
    assert o["shipping_fee"] == expected_ship
    assert o["total"] == o["subtotal"] + o["shipping_fee"] - o["discount_amount"]
    assert o["created_at"] >= user_by_id[o["customer_id"]]["created_at"]
    if o["status"] == "completed" and o["payment_method"] == "cod":
        assert o["payment_status"] == "paid"
    if o["status"] == "pending" and o["payment_method"] == "bank_transfer":
        assert o["payment_status"] == "unpaid"
    if o["coupon_id"] is not None and o["status"] != "cancelled":
        coupon_actual_uses[o["coupon_id"]] += 1

for c in coupons:
    assert c["used_count"] == coupon_actual_uses[c["id"]], f"Coupon {c['code']} used_count lech"

# Kiem tra lich su trang thai tang dan
hist_by_order = {}
for h in order_histories:
    hist_by_order.setdefault(h["order_id"], []).append(h)
for oid, hs in hist_by_order.items():
    for i in range(1, len(hs)):
        assert hs[i]["created_at"] >= hs[i - 1]["created_at"]

# Kiem tra danh gia hop le
for r in reviews:
    assert (r["customer_id"], r["product_id"]) in eligible_pairs

# ============================================================================
# 10. GHI RA FILE database/seed.sql
# ============================================================================
def write_inserts(f, table, cols, rows_tuples, batch_size=50):
    if not rows_tuples:
        return
    col_str = ", ".join(cols)
    for i in range(0, len(rows_tuples), batch_size):
        batch = rows_tuples[i:i + batch_size]
        f.write(f"INSERT INTO {table} ({col_str}) VALUES\n")
        f.write(",\n".join(batch))
        f.write(";\n\n")


with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as f:
    f.write("-- Du lieu gia sinh tu dong boi database/generate_seed.py\n")
    f.write("SET NAMES utf8mb4;\n")
    f.write("USE nha_rang;\n")
    f.write("START TRANSACTION;\n\n")

    write_inserts(f, "users",
        ["id", "email", "password_hash", "full_name", "phone", "role", "status", "last_login_at", "created_at"],
        [f"({u['id']}, {sql_str(u['email'])}, {sql_str(u['password_hash'])}, {sql_str(u['full_name'])}, {sql_str(u['phone'])}, {sql_str(u['role'])}, {sql_str(u['status'])}, {sql_dt(u['last_login_at'])}, {sql_dt(u['created_at'])})" for u in users])

    write_inserts(f, "admins",
        ["user_id", "admin_level", "department", "created_at"],
        [f"({a['user_id']}, {sql_str(a['admin_level'])}, {sql_str(a['department'])}, {sql_dt(a['created_at'])})" for a in admins])

    write_inserts(f, "customers",
        ["user_id", "birthday", "loyalty_points", "newsletter", "created_at"],
        [f"({c['user_id']}, {sql_date(c['birthday'])}, {c['loyalty_points']}, {c['newsletter']}, {sql_dt(c['created_at'])})" for c in customers])

    write_inserts(f, "addresses",
        ["id", "customer_id", "recipient_name", "phone", "province", "district", "ward", "street", "is_default", "created_at"],
        [f"({a['id']}, {a['customer_id']}, {sql_str(a['recipient_name'])}, {sql_str(a['phone'])}, {sql_str(a['province'])}, {sql_str(a['district'])}, {sql_str(a['ward'])}, {sql_str(a['street'])}, {a['is_default']}, {sql_dt(a['created_at'])})" for a in addresses])

    write_inserts(f, "categories",
        ["id", "name", "slug", "description", "sort_order"],
        [f"({c[0]}, {sql_str(c[1])}, {sql_str(c[2])}, {sql_str(c[3])}, {c[4]})" for c in categories])

    write_inserts(f, "products",
        ["id", "category_id", "name", "slug", "short_description", "description", "origin", "roast_level", "is_active", "is_featured", "created_at"],
        [f"({p['id']}, {p['category_id']}, {sql_str(p['name'])}, {sql_str(p['slug'])}, {sql_str(p['short_description'])}, {sql_str(p['description'])}, {sql_str(p['origin'])}, {sql_str(p['roast_level'])}, {p['is_active']}, {p['is_featured']}, {sql_dt(p['created_at'])})" for p in products])

    write_inserts(f, "product_variants",
        ["id", "product_id", "sku", "label", "price", "compare_at_price", "stock", "is_active", "created_at"],
        [f"({v['id']}, {v['product_id']}, {sql_str(v['sku'])}, {sql_str(v['label'])}, {v['price']}, {'NULL' if v['compare_at_price'] is None else v['compare_at_price']}, {v['stock']}, {v['is_active']}, {sql_dt(v['created_at'])})" for v in variants])

    write_inserts(f, "product_images",
        ["id", "product_id", "url", "alt_text", "sort_order", "is_primary", "created_at"],
        [f"({im['id']}, {im['product_id']}, {sql_str(im['url'])}, {sql_str(im['alt_text'])}, {im['sort_order']}, {im['is_primary']}, {sql_dt(im['created_at'])})" for im in images])

    write_inserts(f, "coupons",
        ["id", "code", "description", "discount_type", "discount_value", "min_order_value", "max_uses", "used_count", "starts_at", "expires_at", "is_active"],
        [f"({c['id']}, {sql_str(c['code'])}, {sql_str(c['description'])}, {sql_str(c['discount_type'])}, {c['discount_value']}, {c['min_order_value']}, {c['max_uses']}, {c['used_count']}, {sql_dt(c['starts_at'])}, {sql_dt(c['expires_at'])}, {c['is_active']})" for c in coupons])

    write_inserts(f, "orders",
        ["id", "order_code", "customer_id", "status", "payment_method", "payment_status", "recipient_name", "phone", "shipping_address", "note", "subtotal", "shipping_fee", "discount_amount", "total", "coupon_id", "created_at"],
        [f"({o['id']}, {sql_str(o['order_code'])}, {o['customer_id']}, {sql_str(o['status'])}, {sql_str(o['payment_method'])}, {sql_str(o['payment_status'])}, {sql_str(o['recipient_name'])}, {sql_str(o['phone'])}, {sql_str(o['shipping_address'])}, {sql_str(o['note'])}, {o['subtotal']}, {o['shipping_fee']}, {o['discount_amount']}, {o['total']}, {'NULL' if o['coupon_id'] is None else o['coupon_id']}, {sql_dt(o['created_at'])})" for o in orders])

    write_inserts(f, "order_items",
        ["id", "order_id", "variant_id", "product_name", "variant_label", "unit_price", "quantity", "line_total", "created_at"],
        [f"({oi['id']}, {oi['order_id']}, {oi['variant_id']}, {sql_str(oi['product_name'])}, {sql_str(oi['variant_label'])}, {oi['unit_price']}, {oi['quantity']}, {oi['line_total']}, {sql_dt(oi['created_at'])})" for oi in order_items])

    write_inserts(f, "order_status_history",
        ["id", "order_id", "from_status", "to_status", "changed_by", "note", "created_at"],
        [f"({h['id']}, {h['order_id']}, {sql_str(h['from_status'])}, {sql_str(h['to_status'])}, {h['changed_by']}, {sql_str(h['note'])}, {sql_dt(h['created_at'])})" for h in order_histories])

    write_inserts(f, "reviews",
        ["id", "product_id", "customer_id", "rating", "title", "content", "created_at"],
        [f"({r['id']}, {r['product_id']}, {r['customer_id']}, {r['rating']}, {sql_str(r['title'])}, {sql_str(r['content'])}, {sql_dt(r['created_at'])})" for r in reviews])

    write_inserts(f, "cart_items",
        ["id", "customer_id", "variant_id", "quantity", "created_at"],
        [f"({ci['id']}, {ci['customer_id']}, {ci['variant_id']}, {ci['quantity']}, {sql_dt(ci['created_at'])})" for ci in cart_items])

    f.write("COMMIT;\n")

# In thong ke
status_counts = {}
completed_revenue = 0
for o in orders:
    status_counts[o["status"]] = status_counts.get(o["status"], 0) + 1
    if o["status"] == "completed":
        completed_revenue += o["total"]

print("Da sinh thanh cong database/seed.sql!")
print("-" * 45)
print(f"users:                {len(users)}")
print(f"admins:               {len(admins)}")
print(f"customers:            {len(customers)}")
print(f"addresses:            {len(addresses)}")
print(f"categories:           {len(categories)}")
print(f"products:             {len(products)}")
print(f"product_variants:     {len(variants)}")
print(f"product_images:       {len(images)}")
print(f"coupons:              {len(coupons)}")
print(f"orders:               {len(orders)}")
print(f"order_items:          {len(order_items)}")
print(f"order_status_history: {len(order_histories)}")
print(f"reviews:              {len(reviews)}")
print(f"cart_items:           {len(cart_items)}")
print("-" * 45)
print(f"Tong doanh thu (don completed): {completed_revenue:,} VND")
print("Don theo trang thai:", status_counts)
