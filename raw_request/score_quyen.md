# NGHIỆP VỤ CHẤM ĐIỂM THI ĐẤU QUYỀN – VOVINAM

## 1. Mục tiêu

Xây dựng quy trình chấm điểm thi đấu Quyền với:

- 5 trọng tài chấm điểm độc lập
- 1 màn hình hiển thị công khai (Display)
- 1 màn hình nhập điểm cho trọng tài
- 1 màn hình điều hành để quản lý trạng thái trận

Đảm bảo:

- Không hiển thị điểm trong lúc trọng tài đang chấm
- Tự động tính điểm khi đủ 5/5 trọng tài đã chốt
- Kết thúc trận tự động khi đủ điều kiện
- Xếp hạng và cập nhật huy chương theo từng nhánh thi đấu

---

## 2. Đối tượng chính

### 2.1. Lượt thi (Performance)

Một lượt thi Quyền của 1 vận động viên hoặc đội.

### 2.2. Trọng tài

- Có 5 trọng tài cho mỗi lượt thi
- Mỗi người chấm độc lập
- Không lưu tên trọng tài trong dữ liệu nghiệp vụ chấm điểm
- Trọng tài sử dụng các tài khoản đã được ban tổ chức cấu hình sẵn
- Ban tổ chức có thể tạo trước khoảng 10 tài khoản trọng tài để phân công linh hoạt

### 2.3. Nhánh thi đấu (Tree-path)

Ví dụ:

- Nam > Phong trào > Tuổi 16 > Long Hổ Quyền

Dùng để:

- Gom nhóm VĐV
- Xếp hạng
- Trao huy chương

---

## 3. Trạng thái lượt thi

| Trạng thái | Ý nghĩa |
| ---------- | ------- |
| Chờ | Chưa sẵn sàng thi |
| Sẵn sàng | Đủ 5/5 trọng tài sẵn sàng, có thể bắt đầu |
| Đang thi | VĐV đang biểu diễn |
| Đang chấm | Trọng tài đang nhập điểm |
| Đã chốt | 5/5 trọng tài đã chốt điểm |
| Kết thúc | Trận đã hoàn tất |

---

## 4. Luồng nghiệp vụ chính

### 4.1. Chọn trận và push realtime

- Admin chọn trận Quyền cần điều hành
- Hệ thống push realtime tới toàn bộ thiết bị trọng tài
- Các thiết bị hiển thị đúng trận đang diễn ra

### 4.2. Trạng thái sẵn sàng

- UI hiển thị trạng thái `Sẵn sàng`
- Chỉ khi đủ 5/5 trọng tài sẵn sàng thì màn hình điều hành mới enable nút bắt đầu

### 4.3. Bắt đầu lượt thi

- Điều hành bấm bắt đầu trận
- Trạng thái chuyển sang `Đang thi`
- Nếu cấu hình có đồng hồ thì bắt đầu đếm thời gian
- Màn hình Display hiển thị thông tin bài thi, nhưng chưa hiển thị điểm

### 4.4. Kết thúc bài thi

- Trận kết thúc khi:
  - Hết thời gian nếu đang bật chế độ auto end, hoặc
  - Admin bấm kết thúc sớm
- Sau đó trạng thái chuyển sang `Đang chấm`

### 4.5. Trọng tài nhập điểm

Mỗi trọng tài:

- Chọn điểm của mình trong khoảng từ `80` đến `100`
- Phase 1 dùng số nguyên
- Bấm `Đã chốt`
- Không được thấy điểm của trọng tài khác trước khi tự chốt

### 4.6. Khi đủ 5/5 trọng tài đã chốt

Hệ thống tự động:

- Tính kết quả
- Hiển thị điểm trên Display
- Tự động kết thúc trận

Không cần bước điều hành xác nhận riêng ở phase này.

---

## 5. Quy tắc tính điểm

### 5.1. Dữ liệu đầu vào

- Có đúng 5 điểm từ 5 trọng tài

### 5.2. Loại bỏ

- Loại 1 điểm cao nhất
- Loại 1 điểm thấp nhất

### 5.3. Điểm chính thức

- Sort 5 điểm theo thứ tự tăng dần
- Lấy 3 điểm ở giữa

Công thức chuẩn:

```text
Final Score = Sum(3 middle scores)
```

Ghi chú:

- Điểm chính thức là tổng của 3 điểm giữa sau khi loại 1 điểm cao nhất và 1 điểm thấp nhất
- Backend và UI phải hiển thị cùng một công thức này

### 5.4. Điểm phụ hiển thị

- Điểm cao nhất: chỉ hiển thị
- Điểm thấp nhất: chỉ hiển thị
- Cả hai không được tính vào kết quả chính thức

---

## 6. Hiển thị màn hình Display

### 6.1. Thông tin bài thi

- Nội dung
- Tên VĐV hoặc đội
- Đơn vị thi đấu
- Nhánh thi đấu
- Trạng thái hiện tại
- Đồng hồ, nếu trận đã bắt đầu và cấu hình có bật

### 6.2. Trong quá trình chấm

- Không hiển thị điểm của bất kỳ trọng tài nào
- Không hiển thị điểm chính thức

### 6.3. Khi 5/5 đã chốt

Hiển thị:

- Điểm chính thức
- Điểm cao nhất
- Điểm thấp nhất

### 6.4. Trọng tâm giao diện

- Điểm chính thức nằm ở trung tâm
- Là thành phần lớn nhất trên màn hình
- Các thông tin phụ nằm bên dưới hoặc phía sau về mức nhấn

---

## 7. Hiển thị màn hình Trọng tài

### 7.1. Nội dung

- Thông tin bài thi hiện tại
- Trạng thái trận
- Bộ chọn điểm từ `80` đến `100`
- Nút `Đã chốt`

### 7.2. Hành vi

- Trọng tài chỉ thấy đúng trận đang được điều hành push xuống
- Không thấy điểm của các trọng tài khác trước khi mình chốt
- Sau khi chốt, màn hình chuyển sang trạng thái đã gửi điểm

---

## 8. Hiển thị màn hình Điều hành

### 8.1. Vai trò

Điều hành có thể:

- Chọn trận
- Theo dõi 5/5 trạng thái sẵn sàng
- Bắt đầu trận
- Kết thúc sớm
- Theo dõi tiến độ 5/5 trọng tài đã chốt

### 8.2. Quyền sửa điểm

- Chỉ điều hành được phép mở khóa hoặc sửa điểm khi cần
- Cần lưu vết thao tác sửa điểm

---

## 9. Xếp hạng

### 9.1. Phạm vi xếp hạng

Trong cùng:

- Nội dung
- Giới tính
- Hệ thi đấu
- Nhóm tuổi
- Nhánh thi đấu

### 9.2. Điều kiện tính xếp hạng

- Cả nhánh đã hoàn tất toàn bộ lượt thi
- Tất cả lượt thi đã có kết quả hợp lệ

### 9.3. Nguyên tắc xếp hạng

- Sắp xếp theo điểm chính thức giảm dần

### 9.4. Trường hợp đồng điểm

Áp dụng lần lượt theo thứ tự sau:

1. Xét tổng điểm của cả 5 trọng tài
2. Nếu vẫn bằng nhau, xét điểm cao nhất
3. Nếu vẫn bằng nhau, xét điểm thấp nhất
4. Nếu vẫn bằng nhau, ban tổ chức quyết định đấu lại hoặc bốc thăm

Lưu ý:

- Không dùng khái niệm `Trọng tài chính` trong spec mới

---

## 10. Huy chương

### 10.1. Nguyên tắc

- Hạng 1 → Huy chương vàng
- Hạng 2 → Huy chương bạc
- Hạng 3 → Huy chương đồng

### 10.2. Điều kiện trao

- Cả nhánh đã hoàn tất
- Kết quả xếp hạng đã xác định xong

### 10.3. Nguồn dữ liệu

- Huy chương Quyền cập nhật vào trang huy chương hiện tại
- Dùng nguồn dữ liệu riêng cho Quyền
- Không dùng chung logic bracket đối kháng

---

## 11. Realtime

### 11.1. Yêu cầu

- Khi admin chọn trận, toàn bộ thiết bị trọng tài nhận đúng trận đang diễn ra
- Trạng thái sẵn sàng, bắt đầu, đang chấm, đã chốt phải cập nhật realtime
- Display không cần refresh

### 11.2. Luồng

1. Admin chọn trận
2. Hệ thống push xuống thiết bị trọng tài
3. Trọng tài xác nhận sẵn sàng
4. Đủ 5/5 thì enable bắt đầu
5. Admin bắt đầu trận
6. Trọng tài chấm và bấm `Đã chốt`
7. Đủ 5/5 thì hệ thống hiển thị kết quả và auto end

---

## 12. Cấu hình thời gian

- Cho phép cấu hình số giây cho mỗi trận
- Hỗ trợ 2 chế độ:
  - Auto end khi hết thời gian
  - Manual end bởi admin trước khi hết giờ
- Nếu chưa dùng đồng hồ ở một màn hình nào đó thì ẩn hoàn toàn, không hiển thị `--:--`

---

## 13. UI Theme và UX

### 13.1. Theme màu

| Thành phần | Màu |
| ---------- | --- |
| Background | `#0F172A` |
| Card | `#1E293B` |
| Primary | `#22C55E` |
| Text chính | `#E2E8F0` |
| Text phụ | `#94A3B8` |
| Accent | `#38BDF8` |

### 13.2. Highlight

- Điểm cao nhất dùng màu xanh dương nhẹ
- Điểm thấp nhất dùng màu xám hoặc fade

### 13.3. Animation

- Khi công bố điểm: fade + scale nhẹ khoảng `0.2s`

### 13.4. Trạng thái giao diện

| Trạng thái | UI hiển thị |
| ---------- | ----------- |
| Chờ | `Chờ trọng tài sẵn sàng` |
| Sẵn sàng | `Sẵn sàng` |
| Đang thi | Timer chạy |
| Đã chốt | Badge vàng |

---

## 14. Kiểm soát lỗi

### 14.1. Điểm không hợp lệ

- Ngoài khoảng `80-100`
- Không phải số nguyên hợp lệ

→ Không cho xác nhận

### 14.2. Thiếu trọng tài

- Chưa đủ 5/5 chốt → không tính kết quả
- Chưa đủ 5/5 sẵn sàng → không cho bắt đầu

### 14.3. Sửa điểm

- Chỉ điều hành được mở khóa hoặc sửa điểm
- Bắt buộc lưu audit log

---

## 15. Tiêu chí hoàn thành

- Có đầy đủ màn hình Display, màn hình trọng tài và màn hình điều hành
- Chỉ hiển thị kết quả khi đủ 5/5 đã chốt
- Tính đúng theo quy tắc loại điểm cao nhất và thấp nhất
- Điểm chính thức là trung tâm UI
- Hỗ trợ auto end và manual end
- Xếp hạng đúng theo nhánh thi đấu
- Cập nhật huy chương Quyền đúng trên trang huy chương hiện tại
