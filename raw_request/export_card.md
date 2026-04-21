# Spec tính năng Export thẻ vận động viên để in

# Mục tiêu

Cho phép người dùng export thẻ vận động viên theo mẫu thiết kế để phục vụ in ấn.

Hỗ trợ:

* Export 1 vận động viên
* Export nhiều vận động viên
* Export toàn bộ vận động viên trong cùng 1 câu lạc bộ
* Xuất file theo định dạng phù hợp để in

---

# Phân quyền

* Chỉ tài khoản Admin mới được phép export thẻ vận động viên
* User thường, huấn luyện viên, cộng tác viên hoặc tài khoản CLB không được phép sử dụng chức năng export
* Nếu user không có quyền:

  * Không hiển thị button export
  * Nếu gọi API trực tiếp vẫn trả về lỗi không có quyền

---

# Template thẻ chuẩn

Tất cả thẻ cần export phải bám sát template thiết kế đã được thống nhất.

Template gồm các thành phần:

* Header nền xanh
* Tên giải đấu
* Năm tổ chức giải
* Avatar hoặc initials
* Họ tên vận động viên
* Tên CLB
* Khối thông tin thi đấu
* Màu sắc, font chữ, khoảng cách, border radius theo đúng mẫu
* Footer hoặc pagination nếu export nhiều trang

Hệ thống cần đảm bảo:

* Không thay đổi layout giữa các vận động viên
* Không bị lệch chữ khi tên quá dài
* Không bị vỡ layout khi CLB hoặc hạng mục dài
* Tự động co font hoặc xuống dòng nếu dữ liệu quá dài
* Font tiếng Việt hiển thị đúng dấu
* Kích thước ảnh avatar được crop đúng tỷ lệ

---

# Use Case

## UC-01: Export thẻ của 1 vận động viên

### Điều kiện

* Người dùng đang ở màn hình detail vận động viên
* Vận động viên có đầy đủ dữ liệu cần thiết

### Luồng xử lý

1. Người dùng bấm nút "Export thẻ"
2. Hệ thống generate thẻ theo template
3. Hệ thống export file PDF hoặc PNG
4. Người dùng tải file về

### Output

* 1 file PDF hoặc PNG chứa đúng 1 thẻ vận động viên

---

## UC-02: Export nhiều vận động viên được chọn

### Điều kiện

* Người dùng đang ở màn hình danh sách vận động viên
* Người dùng chọn nhiều vận động viên

### Luồng xử lý

1. Người dùng tick checkbox nhiều vận động viên
2. Người dùng bấm "Export thẻ"
3. Hệ thống generate thẻ cho từng vận động viên
4. Hệ thống ghép thành 1 file PDF nhiều trang hoặc file ZIP
5. Người dùng tải file về

### Output

* PDF nhiều trang: mỗi trang chứa 1 hoặc nhiều thẻ
* Hoặc ZIP chứa nhiều file PNG/PDF

---

## UC-03: Export toàn bộ vận động viên trong CLB

### Điều kiện

* Người dùng đang ở màn hình detail câu lạc bộ hoặc danh sách vận động viên có filter theo CLB

### Luồng xử lý

1. Người dùng bấm "Export toàn bộ thẻ CLB"
2. Hệ thống lấy toàn bộ vận động viên thuộc CLB
3. Hệ thống generate thẻ theo template
4. Hệ thống xuất file PDF nhiều trang
5. Người dùng tải file về

### Output

* 1 file PDF chứa toàn bộ thẻ của vận động viên trong CLB

---

# UI

## Màn hình detail vận động viên

Thêm button:

* Export thẻ PNG
* Export thẻ PDF

## Màn hình danh sách vận động viên

Thêm:

* Checkbox chọn nhiều vận động viên
* Button "Export thẻ đã chọn"
* Button "Export toàn bộ CLB"

## Modal export

Hiển thị các option:

* Định dạng file: PDF / PNG
* Kích thước in: A4 / Card size
* Số thẻ trên 1 trang
* Có hiển thị QR code hay không
* Có hiển thị logo CLB hay không

---

# Template thẻ

## Khu vực header

* Tên giải đấu
* Năm giải đấu
* Màu nền theo branding giải đấu

## Khu vực avatar

* Ảnh vận động viên
* Nếu không có ảnh thì hiển thị chữ viết tắt tên

## Khu vực thông tin

* Họ tên
* Tên CLB
* Năm sinh
* Hạng mục thi đấu
* Nội dung thi đấu
* Hạng cân
* Giới tính
* Mã vận động viên
* Số báo danh

## Khu vực bổ sung

* QR code dẫn tới màn hình detail vận động viên
* Barcode nếu cần check-in
* Logo CLB
* Logo giải đấu

---

# Mapping dữ liệu

| Field UI         | Field DB/API            |
| ---------------- | ----------------------- |
| Họ tên           | athlete.name            |
| Ảnh đại diện     | athlete.avatarUrl       |
| Tên CLB          | club.name               |
| Năm sinh         | athlete.birthYear       |
| Hạng mục thi đấu | athlete.categoryName    |
| Nội dung thi đấu | athlete.competitionType |
| Hạng cân         | athlete.weightClass     |
| Giới tính        | athlete.gender          |
| Mã vận động viên | athlete.code            |
| Số báo danh      | athlete.bibNumber       |
| QR code URL      | athlete.detailUrl       |

---

# Rule nghiệp vụ

1. Chỉ Admin mới có quyền export thẻ
2. Nếu user không có quyền thì không hiển thị chức năng export
3. Nếu vận động viên không có avatar thì hiển thị initials của tên
4. Nếu không có logo CLB thì ẩn khu vực logo
5. Nếu tên vận động viên quá dài:

   * Tự động giảm font
   * Hoặc hiển thị tối đa 2 dòng
6. Nếu tên CLB quá dài:

   * Tự động xuống dòng
   * Không làm vỡ layout
7. Nếu hạng mục thi đấu hoặc nội dung thi đấu quá dài:

   * Tự động wrap text
   * Giữ chiều cao card đồng đều
8. Nếu export nhiều vận động viên thì cần sắp xếp theo:

   * Câu lạc bộ
   * Hạng mục thi đấu
   * Tên vận động viên
9. Nếu số lượng export lớn hơn 100 vận động viên:

   * Chạy background job
   * Hiển thị trạng thái processing
   * Khi hoàn thành gửi notification hoặc email tải file
10. Nếu export toàn bộ CLB:

* Chỉ export vận động viên đang active
* Không export vận động viên đã bị xóa mềm hoặc hủy đăng ký

11. File export cần có tên theo format:

```text
athlete-card-{athleteCode}.pdf
club-athlete-cards-{clubCode}-{yyyyMMdd}.pdf
```

12. Nếu export thất bại:

* Hiển thị message lỗi rõ ràng
* Có thể retry export

13. Nếu dữ liệu vận động viên thiếu các trường bắt buộc:

* Hiển thị cảnh báo trước khi export
* Cho phép bỏ qua hoặc dừng export

1. Nếu vận động viên không có avatar thì hiển thị initials của tên
2. Nếu không có logo CLB thì ẩn khu vực logo
3. Nếu export nhiều vận động viên thì cần sắp xếp theo:

   * Câu lạc bộ
   * Hạng mục thi đấu
   * Tên vận động viên
4. Nếu số lượng export lớn hơn 100 vận động viên:

   * Chạy background job
   * Hiển thị trạng thái processing
   * Khi hoàn thành gửi notification hoặc email tải file
5. File export cần có tên theo format:

```text
athlete-card-{athleteCode}.pdf
club-athlete-cards-{clubCode}-{yyyyMMdd}.pdf
```

---

# Non-functional Requirement

* Export tối đa 1000 vận động viên / lần
* Thời gian export dưới 10 giây với dưới 100 vận động viên
* PDF cần đảm bảo chất lượng in sắc nét
* Hỗ trợ responsive khi xem trước trên web
* Hỗ trợ font tiếng Việt không lỗi dấu
* Hỗ trợ cache template để giảm thời gian generate

---

# Technical Suggestion

## Frontend

* React component render thẻ
* Dùng html-to-image hoặc dom-to-image để export PNG
* Dùng html2canvas + jsPDF để export PDF
* Có preview trước khi export

## Backend

* Có thể generate server side bằng:

  * Puppeteer
  * Playwright
  * wkhtmltopdf
* Với export số lượng lớn nên dùng queue job
* Lưu file lên S3 hoặc storage tạm

---

# Task breakdown cho AI

1. Tạo UI button export tại màn hình detail vận động viên
2. Tạo UI checkbox và bulk action tại màn hình danh sách
3. Tạo React component template thẻ
4. Tạo API export single athlete
5. Tạo API export bulk athletes
6. Tạo background job cho export số lượng lớn
7. Tạo PDF template A4
8. Tạo preview modal trước khi export
9. Tạo unit test
10. Tạo e2e test cho flow export
