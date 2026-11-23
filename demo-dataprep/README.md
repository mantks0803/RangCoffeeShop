# Demo DataPrep với dữ liệu Nhà Rang

Giữ dữ liệu seed để kiểm tra website và dùng `hang_nhap_thu.csv` làm dữ liệu nhập từ nhà cung cấp. `danh_muc_tham_chieu.csv` mô phỏng danh mục đã xác nhận. Hai file này dùng thử độc lập. Khi nối MCP, đưa lô nhập vào bảng trung gian trước khi áp dụng thay đổi vào danh mục.

| Dòng | Kết quả kỳ vọng |
| --- | --- |
| 1 | Tra đúng SKU để điền xuất xứ Cầu Đất, Đà Lạt · 1.550m. |
| 2 | Chuẩn hóa mức rang thành `medium` và giá thành số nguyên `195000`, theo quy ước VND định dạng Việt Nam. |
| 3 | Dùng mô tả để tìm `NR-0102-01`. Chỉ điền sau khi khớp cách sơ chế, vùng trồng và quy cách 250g nguyên hạt. |
| 4 | Cần rà soát vì cả Washed và Honey đều có biến thể 250g và mô tả chưa đủ để chọn. |
| 5 | Cần rà soát tồn kho âm và đối chiếu phiếu nhập. |
| 6 | Giá, SKU, mức rang và số lượng hợp lệ theo dữ liệu nhập. |

Chạy thử bằng cách gửi lô hàng và danh mục cho Agent. Yêu cầu trả CSV kết quả, lý do chỉnh sửa và các dòng cần xác nhận. Để demo tự động sau này, đưa thêm một dòng có SKU hợp lệ và một dòng mơ hồ vào bảng trung gian rồi theo dõi trạng thái.
