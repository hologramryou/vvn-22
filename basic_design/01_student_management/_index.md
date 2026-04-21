# Module: Quản lý Môn sinh

**Version:** 1.0
**Last Updated:** 2026-03-29
**Status:** ✅ Implemented

---

## 📌 Tổng quan

Module "Quản lý Môn sinh" (Student Management) là một trong những core module của ứng dụng Vovinam. Nó cho phép **quản trị viên hệ thống** và **quản lý câu lạc bộ (CLB)** quản lý toàn bộ dữ liệu về các võ sinh tham gia giải đấu.

### 🎯 Mục đích chính

1. **Duy trì danh sách võ sinh** — lưu trữ thông tin cá nhân, cấp đai, hạng cân
2. **Nhập hàng loạt từ Excel** — tăng tốc độ nhập liệu so với tạo thủ công
3. **Lọc & tìm kiếm nâng cao** — hỗ trợ các tiêu chí phức tạp (cấp đai, CLB, hạng cân, loại thi đấu)
4. **Xem chi tiết (profile)** — tất cả thông tin lịch sử CLB và tham gia giải đấu

---

## 👥 Đối tượng sử dụng

| Vai trò | Quyền hạn | Ghi chú |
|---------|-----------|--------|
| **Admin** | CRUD tất cả, Import, Lọc xem tất cả | Toàn quyền |
| **Club** | CRUD chỉ môn sinh của CLB mình | Không thể cross-club |
| **Referee** | Xem danh sách (read-only) | Không có chỉnh sửa |
| **Viewer** | Xem danh sách (read-only) | Không có chỉnh sửa |

---

## 📋 Các màn hình trong module

### 1. **Danh sách Môn sinh** (`/students`)
   - Bảng danh sách phân trang
   - Bộ lọc nâng cao (keyword, CLB, đai cấp, hạng cân, v.v.)
   - Lưu bộ lọc (saved filters)
   - Tạo mới, import Excel, sửa, xóa, tải avatar

### 2. **Chi tiết Môn sinh** (`/students/:id`)
   - Tab: Thông tin cơ bản
   - Tab: Lịch sử CLB (club history)
   - Tab: Tham gia giải đấu (tournament participation)
   - Actions: Sửa, xóa, tải avatar, thay đổi trạng thái

---

## 🗄️ Dữ liệu liên quan

- **Data Master 1:** Cấp đai Vovinam (18 cấp, 11 cấp tham gia thi đấu)
- **Data Master 2:** Hạng cân Nam/Nữ (25 hạng cân)
- **Data Master 3:** Loại thi đấu (Đối kháng, Hội diễn)

---

## 📚 Danh sách các file spec

| File | Mô tả |
|------|-------|
| **_index.md** | Tài liệu này — tổng quan module |
| **student_list.md** | Chi tiết màn hình danh sách & tạo mới |
| **student_detail.md** | Chi tiết xem/sửa hồ sơ môn sinh |
| **data_master.md** | Dữ liệu master (đai, hạng cân, loại thi) |
| **api_reference.md** | API endpoints & request/response |

---

## 🔄 Luồng xử lý chính

### Luồng 1: Tạo mới võ sinh thủ công
```
User → Nhấp "Tạo môn sinh mới"
    ↓
[Modal Form] Điền form (tên, giới tính, CLB, cấp đai, ...)
    ↓
Confirm → POST /students
    ↓
[Backend] Kiểm tra CCCD trùng → Tạo student → Auto-register tournament
    ↓
Thành công → Refresh danh sách
```

### Luồng 2: Nhập hàng loạt từ Excel
```
User → Nhấp "Import Excel"
    ↓
[Modal] Chọn file .xlsx
    ↓
[Kiểm tra] Cột bắt buộc: họ tên, giới tính, CLB, cấp đai
    ↓
POST /students/import
    ↓
[Backend] Parse từng dòng → Validate → Insert DB
    ↓
[Result] Show số thành công, số lỗi, chi tiết lỗi từng dòng
```

### Luồng 3: Lọc & tìm kiếm
```
User → Nhập keyword hoặc chọn filter
    ↓
(Auto) Trigger API với query params
    ↓
GET /students?keyword=X&belt_rank=Y&club_id=Z&...
    ↓
[Backend] Filter từ database
    ↓
Hiển thị kết quả ~ 1-2 giây (với pagination)
```

---

## ⚡ Tính năng nổi bật

✅ **Lọc nâng cao – 10 tiêu chí**
- Từ khóa (họ tên, mã)
- Câu lạc bộ (single select)
- Cấp đai (single select)
- Loại thi đấu (multi select)
- Giới tính
- Hạng cân
- Loại hình (phong trào / phổ thông)
- Loại giải (1A/1B/2/3/4/5 hoặc 1/2/3/4)
- Quyền (specific form type)
- Trạng thái (active/inactive/archived)

✅ **Lưu bộ lọc (Saved Filters)**
- User có thể lưu combo filter → dùng lại
- Mỗi user lưu tối đa (không giới hạn)
- Xóa được bộ lọc đã lưu

✅ **Import từ Excel**
- Kiểm tra cột bắt buộc
- Parse multiple date formats (DD/MM/YYYY, YYYY-MM-DD)
- Auto-map belt name (có dấu/không dấu)
- Return detailed error report

✅ **Upload Avatar**
- Per student
- Resize & optimize hình ảnh
- Lưu URL vào database

---

## 🔐 Phân quyền chi tiết

### Màn hình danh sách (`GET /students`)
| Vai trò | Quyền | Ghi chú |
|---------|-------|--------|
| Admin | Thấy tất cả môn sinh toàn hệ thống | Không bị filter club_id |
| Club | Thấy chỉ môn sinh của CLB mình | Force filter trong query |
| Referee | Xem tất cả (read-only) | `viewer=true` trong query |
| Viewer | Xem tất cả (read-only) | `viewer=true` trong query |

### Tạo mới (`POST /students`)
| Vai trò | Quyền |
|---------|-------|
| Admin | ✅ Chỉ định club_id bất kỳ |
| Club | ✅ Force club_id = CLB của tài khoản |
| Referee | ❌ Forbidden |
| Viewer | ❌ Forbidden |

### Sửa/Xóa (`PUT/DELETE /students/{id}`)
| Vai trò | Quyền |
|---------|-------|
| Admin | ✅ Tất cả student |
| Club | ✅ Chỉ student của CLB mình |
| Referee | ❌ Forbidden |
| Viewer | ❌ Forbidden |

---

## 📞 Liên hệ & Hỗ trợ

Nếu có câu hỏi về spec này, vui lòng xem:
- [API Reference](./api_reference.md) — chi tiết API endpoints
- [Data Master](./data_master.md) — danh sách cấp đai & hạng cân
- [Student List Screen](./student_list.md) — UI/UX danh sách
- [Student Detail Screen](./student_detail.md) — UI/UX chi tiết hồ sơ
