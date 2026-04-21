# API Reference: Student Management Endpoints

**Version:** 1.0
**Last Updated:** 2026-03-29
**Base URL:** `http://localhost:8001` (local) or production domain
**Auth:** JWT Bearer token (required for all endpoints)

---

## 📋 Endpoint Summary

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/students` | Danh sách với bộ lọc | ✅ |
| GET | `/students/:id` | Chi tiết một võ sinh | ✅ |
| POST | `/students` | Tạo mới | ✅ Admin/Club |
| PUT | `/students/:id` | Cập nhật | ✅ Admin/Club (own) |
| DELETE | `/students/:id` | Xóa | ✅ Admin/Club (own) |
| POST | `/students/import` | Nhập Excel | ✅ Admin/Club |
| POST | `/students/:id/avatar` | Tải ảnh đại diện | ✅ Admin/Club |
| GET | `/students/clubs` | Danh sách CLB | ✅ |
| GET | `/students/meta` | Dữ liệu (belts, weights) | ✅ |

---

## 🔍 GET /students — Danh sách Môn sinh (Phân trang & Lọc)

**Description:** Lấy danh sách võ sinh có phân trang và lọc nâng cao.

### Request

**Method:** GET
**Path:** `/students`

**Query Parameters:**

```javascript
{
  // Pagination
  page: number = 1,              // Trang (1-indexed)
  page_size: number = 20,        // Kích thước trang (1-100)
  
  // Filter
  keyword: string,               // Tìm kiếm: tên hoặc mã
  club_id: number,               // Lọc theo CLB
  belt_rank: string,             // Lọc theo cấp đai
  event: string,                 // Lọc theo loại thi đấu
  gender: string,                // Lọc theo giới tính (M/F)
  weight_class: number,          // Lọc theo hạng cân
  category_type: string,         // Lọc theo loại hình (phong_trao/pho_thong)
  category_loai: string,         // Lọc theo loại giải (1A/1B/2/...)
  quyen_selection: string,       // Lọc theo quyền cụ thể (P01/P02/...)
  status: string = "active",     // Lọc theo trạng thái (active/inactive/archived)
}
```

### Request Example

```bash
GET /students?keyword=Nguyễn&club_id=10&belt_rank=Lam%20Đai%20I&page=1&page_size=20
Authorization: Bearer <token>
```

### Response (200 OK)

```json
{
  "items": [
    {
      "id": 1,
      "code": "VS-001",
      "full_name": "Nguyễn Văn A",
      "club_id": 10,
      "club_name": "CLB Vovinam Q1",
      "current_belt": "Lam Đai I",
      "weight_class": 65,
      "weight_classes": [65, 70],
      "compete_events": ["quyền", "đối kháng"],
      "quyen_selections": ["P01", "P02"],
      "category_type": "phong_trao",
      "category_loai": "1A",
      "status": "active"
    },
    {
      "id": 2,
      "code": "VS-002",
      "full_name": "Trần Thị B",
      "club_id": 11,
      "club_name": "CLB Vovinam Q2",
      "current_belt": "Hoàng Đai",
      "weight_class": 57,
      "weight_classes": null,
      "compete_events": ["quyền"],
      "quyen_selections": ["P03"],
      "category_type": "pho_thong",
      "category_loai": "2",
      "status": "active"
    }
  ],
  "total": 156,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

### Error Responses

- **401 Unauthorized:** JWT token missing or invalid
- **403 Forbidden:** Không đủ quyền hạn
- **400 Bad Request:** Query param invalid

---

## 👤 GET /students/:id — Chi tiết Môn sinh

**Description:** Lấy thông tin chi tiết một võ sinh, kèm lịch sử CLB + tham gia giải đấu.

### Request

**Method:** GET
**Path:** `/students/:id`
**URL Param:** `id` (integer) — Student ID

### Request Example

```bash
GET /students/1
Authorization: Bearer <token>
```

### Response (200 OK)

```json
{
  "id": 1,
  "code": "VS-001",
  "full_name": "Nguyễn Văn A",
  "date_of_birth": "1996-05-10",
  "gender": "M",
  "id_number": "001232345678",
  "phone": "0912345678",
  "email": null,
  "address": "123 Nguyễn Huệ, Q1, TP.HCM",
  "avatar_url": "https://storage.example.com/avatars/vs-001.jpg",
  "current_belt": "Lam Đai I",
  "belt_date": "2025-01-15",
  "join_date": "2025-01-01",
  "weight_class": 65,
  "weight_classes": [65, 70],
  "compete_events": ["quyền", "đối kháng"],
  "quyen_selections": ["P01", "P02"],
  "category_type": "phong_trao",
  "category_loai": "1A",
  "status": "active",
  "notes": "VĐV tài năng, need support",
  "club_id": 10,
  "club_name": "CLB Vovinam Q1",
  "club_address": "456 Lê Lợi, Q1",
  "coach_name": "Trần B",
  "coach_phone": "0987654321",
  "club_joined_at": "2025-01-01",
  
  // Club history (timeline)
  "club_history": [
    {
      "club_name": "CLB Vovinam Q1",
      "joined_at": "2025-01-01",
      "left_at": null,
      "is_current": true
    },
    {
      "club_name": "CLB Vovinam Q2",
      "joined_at": "2024-06-15",
      "left_at": "2024-12-31",
      "is_current": false
    },
    {
      "club_name": "CLB Vovinam Bình Thạnh",
      "joined_at": "2024-01-10",
      "left_at": "2024-06-14",
      "is_current": false
    }
  ],
  
  // Tournament participation
  "tournament_participation": [
    {
      "tournament_id": 1,
      "tournament_name": "Vovinam 2026",
      "tournament_date_start": "2026-04-15",
      "tournament_date_end": "2026-04-17",
      "registered_weight_class": 65,
      "registered_events": ["quyền", "đối kháng"],
      "registered_form": "P01",
      "status": "REGISTERED",
      "bracket_info": "Vòng 1 / Trận 3",
      "result": null
    }
  ]
}
```

### Error Responses

- **404 Not Found:** Student không tồn tại
- **401 Unauthorized:** JWT missing
- **403 Forbidden:** Không đủ quyền (Club user xem student từ CLB khác)

---

## ➕ POST /students — Tạo mới Môn sinh

**Description:** Tạo một võ sinh mới. Auto-register vào tournament hiện tại.

### Request

**Method:** POST
**Path:** `/students`
**Content-Type:** `application/json`

### Request Body

```json
{
  "full_name": "Nguyễn Văn A",
  "gender": "M",
  "club_id": 10,
  "current_belt": "Tự vệ nhập môn",
  "phone": "0912345678",
  "email": "nguyenvanA@example.com",
  "address": "123 Nguyễn Huệ",
  "weight_class": 65,
  "weight_classes": [65, 70],
  "compete_events": ["quyền", "đối kháng"],
  "quyen_selections": ["P01", "P02"],
  "category_type": "phong_trao",
  "category_loai": "1A",
  "notes": "VĐV đã có kinh nghiệm",
  
  // Auto-generated (optional from frontend)
  "date_of_birth": "1996-05-10",
  "id_number": null,           // Auto-gen if empty
  "join_date": null,           // Auto-gen = today
  "province_id": null,
  "belt_date": null
}
```

### Validation Rules

- `full_name` (bắt buộc): 2–150 ký tự
- `gender` (bắt buộc): "M" | "F"
- `club_id` (bắt buộc): phải tồn tại và active
- `current_belt` (bắt buộc): phải từ 18 cấp đai
- `phone` (tùy chọn): 10–15 ký tự hoặc null
- `id_number` (tùy chọn): auto-generate nếu trống
- Nếu `id_number` được cung cấp → check duplicate
  - Nếu trùng → error `DUPLICATE_ID_NUMBER`

### Response (201 Created)

```json
{
  "id": 1,
  "code": "VS-001",
  "message": "Tạo môn sinh thành công"
}
```

### Error Responses

- **400 Bad Request:**
  ```json
  {
    "detail": {
      "code": "DUPLICATE_ID_NUMBER",
      "message": "CCCD đã tồn tại"
    }
  }
  ```
- **403 Forbidden:** Vai trò Referee/Viewer
- **422 Unprocessable Entity:** Validation failed

---

## ✏️ PUT /students/:id — Cập nhật Môn sinh

**Description:** Cập nhật thông tin một võ sinh (partial update).

### Request

**Method:** PUT
**Path:** `/students/:id`
**Content-Type:** `application/json`

**Request Body:** (same as POST, nhưng all fields optional để partial update)

```json
{
  "full_name": "Nguyễn Văn A Updated",
  "current_belt": "Lam Đai I",
  "weight_class": 70,
  ...
}
```

### Response (200 OK)

```json
{
  "id": 1,
  "message": "Cập nhật môn sinh thành công"
}
```

### Error Responses

- **404 Not Found:** Student không tồn tại
- **403 Forbidden:** Không đủ quyền (chỉ own club can update)
- **422 Unprocessable Entity:** Validation failed

---

## 🗑️ DELETE /students/:id — Xóa Môn sinh

**Description:** Xóa một võ sinh (soft delete hoặc hard delete tùy backend config).

### Request

**Method:** DELETE
**Path:** `/students/:id`

### Response (204 No Content)

```
(empty body)
```

### Error Responses

- **404 Not Found:** Student không tồn tại
- **403 Forbidden:** Không đủ quyền
- **409 Conflict:** Không thể xóa (nếu đang thi đấu hoặc có ràng buộc)

---

## 📤 POST /students/import — Nhập hàng loạt từ Excel

**Description:** Import múdedule võ sinh từ file `.xlsx`.

### Request

**Method:** POST
**Path:** `/students/import`
**Content-Type:** `multipart/form-data`

### Request Body

```
file: File (binary)   // File Excel, ≤ 10 MB, .xlsx
```

### Cột trong file (bắt buộc)

- `ho_ten` — Họ tên
- `gioi_tinh` — Giới tính (Nam/Nữ)
- `ten_cau_lac_bo` — Tên CLB
- `dai_cap` — Cấp đai

### Cột tùy chọn

- `ngay_sinh` — Date (DD/MM/YYYY or YYYY-MM-DD)
- `cccd` — CCCD/CMND
- `so_dien_thoai` — Phone
- `hang_can` — Weight class (float)
- `noi_dung_thi_dau` — Events (semicolon-separated)

### Response (200 OK)

```json
{
  "total_rows": 20,
  "success_rows": 18,
  "failed_rows": 2,
  "errors": [
    {
      "row": 5,
      "status": "error",
      "full_name": "Trần B",
      "error": "CLB 'XYZ' không tồn tại"
    },
    {
      "row": 15,
      "status": "error",
      "full_name": "Lê C",
      "error": "Đai cấp 'ABC' không hợp lệ"
    }
  ]
}
```

### Error Responses

- **400 Bad Request:**
  ```json
  {
    "detail": {
      "code": "MISSING_COLUMNS",
      "message": "Thiếu cột bắt buộc: ho_ten, gioi_tinh, ten_cau_lac_bo, dai_cap"
    }
  }
  ```
- **413 Payload Too Large:** File > 10 MB

---

## 📷 POST /students/:id/avatar — Tải Ảnh đại diện

**Description:** Upload avatar cho một võ sinh.

### Request

**Method:** POST
**Path:** `/students/:id/avatar`
**Content-Type:** `multipart/form-data`

### Request Body

```
file: File (binary)   // Image file (JPG/PNG, ≤ 5 MB)
```

### Response (200 OK)

```json
{
  "avatar_url": "https://storage.example.com/avatars/vs-001-abc123.jpg"
}
```

### Error Responses

- **400 Bad Request:** File type không hỗ trợ hoặc size quá lớn
- **404 Not Found:** Student không tồn tại
- **403 Forbidden:** Không đủ quyền

---

## 🏢 GET /students/clubs — Danh sách Câu lạc bộ

**Description:** Lấy danh sách tất cả CLB active (dùng trong dropdown).

### Request

**Method:** GET
**Path:** `/students/clubs`

### Response (200 OK)

```json
[
  {
    "id": 10,
    "name": "CLB Vovinam Q1"
  },
  {
    "id": 11,
    "name": "CLB Vovinam Q2"
  },
  {
    "id": 12,
    "name": "CLB Vovinam Bình Thạnh"
  }
]
```

---

## ⚙️ GET /students/meta — Metadata (Constants)

**Description:** Lấy các hằng số (belts, weight classes) dùng trong dropdown/validation.

### Request

**Method:** GET
**Path:** `/students/meta`

### Response (200 OK)

```json
{
  "competing_belts": [
    "Tự vệ nhập môn",
    "Lam đai nhập môn",
    "Lam đai I",
    "Lam đai II",
    "Lam đai III",
    "Chuẩn Hoàng đai",
    "Hoàng đai",
    "Hoàng đai I",
    "Hoàng đai II",
    "Hoàng đai III",
    "Chuẩn Hồng đai"
  ],
  "weight_classes": [45, 48, 51, 54, 57, 60, 64, 68, 72, 77, 82, 92, 100]
}
```

---

## 🔐 Authentication & Authorization

### Headers

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### JWT Claims (từ login)

```json
{
  "sub": "user_id",
  "role": "admin | club | referee | viewer",
  "club_id": 10,           // Nếu role = "club"
  "username": "club1"
}
```

### Authorization logic per endpoint

| Endpoint | Admin | Club | Referee | Viewer |
|----------|:-----:|:----:|:-------:|:------:|
| GET /students | ✅ All | ✅ Own club | ✅ All | ✅ All |
| GET /students/:id | ✅ | ✅* | ✅ | ✅ |
| POST /students | ✅ | ✅* | ❌ | ❌ |
| PUT /students/:id | ✅ | ✅* | ❌ | ❌ |
| DELETE /students/:id | ✅ | ✅* | ❌ | ❌ |
| POST /import | ✅ | ✅* | ❌ | ❌ |
| POST /avatar | ✅ | ✅* | ❌ | ❌ |
| GET /clubs | ✅ | ✅ | ✅ | ✅ |
| GET /meta | ✅ | ✅ | ✅ | ✅ |

> `*` — Club role: chỉ được nhìn/sửa/xóa student của CLB mình

---

## 🔍 Status Codes

| Code | Meaning |
|------|---------|
| **200** | OK — Success |
| **201** | Created — Resource created successfully |
| **204** | No Content — Success, no response body |
| **400** | Bad Request — Invalid input/params |
| **401** | Unauthorized — Missing/invalid JWT |
| **403** | Forbidden — Insufficient permissions |
| **404** | Not Found — Resource not found |
| **409** | Conflict — Cannot perform operation (constraint violation) |
| **413** | Payload Too Large — File size exceeded |
| **422** | Unprocessable Entity — Validation failed |
| **500** | Internal Server Error |

---

## 📝 Notes

1. **Pagination:** Default page=1, page_size=20, max page_size=100
2. **Filtering:** Tất cả query params đều optional; nếu omitted → return tất cả (với filter default status="active")
3. **Dates:** Format ISO 8601 (YYYY-MM-DD) trong response
4. **Timezone:** Server timezone = UTC, frontend handle local time
5. **Rate limiting:** TBD (subject to change)
6. **CORS:** Enabled cho frontend domain

---

## 📚 Xem thêm

- [Student List Spec](./student_list.md) — Cách sử dụng các endpoint
- [Student Detail Spec](./student_detail.md) — Get/:id chi tiết
- [Data Master](./data_master.md) — Belt names, weight classes, etc.
