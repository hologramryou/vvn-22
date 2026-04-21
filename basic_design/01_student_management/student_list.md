# Màn hình: Danh sách Môn sinh

**URL:** `/students`
**Version:** 2.0
**Last Updated:** 2026-03-29
**Status:** ✅ Implemented

---

## 📌 Tuyên bố giới thiệu

Màn hình **Danh sách Môn sinh** là dashboard chính cho việc quản lý toàn bộ võ sinh trong hệ thống. Người dùng có thể:

1. **Xem danh sách** — phân trang, lọc nâng cao theo 10 tiêu chí
2. **Tạo mới** — form modal hoặc inline (tùy thiết bị)
3. **Import Excel** — nhập hàng loạt (bulk import)
4. **Sửa/Xóa** — per record actions
5. **Lưu bộ lọc** — tái sử dụng combo filter

---

## 👤 Vai trò & Quyền hạn

| Vai trò | Xem | Tạo | Sửa | Xóa | Import |
|---------|:---:|:---:|:---:|:---:|:------:|
| **Admin** | Tất cả | ✅ | Tất cả | ✅ | ✅ |
| **Club** | CLB mình | ✅* | CLB mình | ✅* | ✅* |
| **Referee** | Tất cả | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | Tất cả | ❌ | ❌ | ❌ | ❌ |

> `*` — Admin enforcement: Backend force-set `club_id` = current user's club

---

## 🎨 Layout & Responsive Design

### Desktop (≥ 1024px)
```
┌─────────────────────────────────────────────────────────────────┐
│  Students                      [+ Tạo] [📤 Import] [⚙️ Filters] │
├─────────────────────────────────────────────────────────────────┤
│                          🔍 Bộ lọc nâng cao                     │
│ [Keyword] [CLB ▼] [Đai ▼] [Giới tính ▼] [Hạng cân ▼]            │
│ [Loại thi ▼] [Loại hình ▼] [Quyền ▼] [Trạng thái ▼] [🔄 Reset]  │
│ Bộ lọc đã lưu: [Filter 1] [Filter 2] [+ Lưu]                   │
├─────────────────────────────────────────────────────────────────┤
│ Hiển thị 1–20 / 156 | <Prev> [1] [2] [3] ... [8] <Next>        │
├──────┬────────┬─────────────┬──────────┬──────┬──────┬──────────┤
│ STT  │  Mã   │ Họ & Tên    │  CLB    │ Đai  │ Hạng │ Tối Tác  │
├──────┼────────┼─────────────┼──────────┼──────┼──────┼──────────┤
│ 1    │ VS001  │ Nguyễn A    │ CLB Q1  │ Lv3  │ 65kg │ Sửa | Xóa│
│ 2    │ VS002  │ Trần B      │ CLB Q2  │ Lv5  │ 70kg │ Sửa | Xóa│
│ ...  │        │             │         │      │      │          │
└──────┴────────┴─────────────┴──────────┴──────┴──────┴──────────┘
```

### Tablet/Mobile (< 1024px)
```
┌────────────────────────────────────┐
│ Students    [+] [📤] [⚙️]          │
├────────────────────────────────────┤
│  🔍 Bộ lọc (collapsible)           │
│ ▼ [Chọn tiêu chí...]              │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ Nguyễn A           VS-001     │  │
│  │ CLB Q1 · Lam Đai I · 65kg   │  │
│  │ [Sửa] [Xóa]                 │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Trần B             VS-002     │  │
│  │ CLB Q2 · Hoàng Đai · 70kg   │  │
│  │ [Sửa] [Xóa]                 │  │
│  └──────────────────────────────┘  │
│         <Prev> 1/8 <Next>         │
└────────────────────────────────────┘
```

---

## 📊 Bảng Danh sách (Desktop)

### Cột bảng

| Cột | Tên | Nội dung | Sort | Ghi chú |
|-----|-----|---------|:----:|---------|
| 1 | STT | 1, 2, 3, ... | — | Thứ tự trong trang hiện tại |
| 2 | Mã | VS-001, VS-002, ... | ✅ | Unique, auto-generate |
| 3 | Họ & Tên | Text | ✅ | Click → Chi tiết. Highlight if bookmark |
| 4 | Câu lạc bộ | Tên CLB | ✅ | — |
| 5 | Đai cấp | Badge + text (e.g., "Lam Đai I") | ✅ | Badge có màu tương ứng |
| 6 | Hạng cân | "65 kg", "Chưa cập nhật" | ✅ | — |
| 7 | Nội dung thi | Tags (QUY001, ĐK001, ...) hoặc "—" | — | Multi-value, wrap |
| 8 | Trạng thái | Active / Inactive | — | Badge green/gray |
| 9 | Hành động | Sửa · Xóa · ⋮ | — | Dropdown nếu nhiều |

### Bộ lọc (10 tiêu chí)

| # | Tên | Loại | Mặc định | Ghi chú |
|---|-----|------|---------|---------|
| 1 | **Tìm kiếm** | Text input | (không) | Search by name, code. Auto-trigger |
| 2 | **Câu lạc bộ** | Single select | (không) | Load từ `/students/clubs` endpoint |
| 3 | **Cấp đai** | Single select | (không) | 11 đai thi đấu (từ data master) |
| 4 | **Giới tính** | Radio: Nam/Nữ | (không) | 3 options: Nam, Nữ, Không xác định |
| 5 | **Hạng cân** | Single select | (không) | Load từ constants (25 hạng) |
| 6 | **Loại thi đấu** | Multi-checkbox | (không) | Đối kháng, Song luyện, Đơn luyện, ... |
| 7 | **Loại hình** | Radio | (không) | Phong trào / Phổ thông |
| 8 | **Loại giải** | Radio | (không) | Phong trào: 1A/1B/2/3/4/5; Phổ thông: 1/2/3/4 |
| 9 | **Quyền (Form)** | Single select | (không) | P01, P02, P03, ... (từ spec) |
| 10 | **Trạng thái** | Radio | "active" | Active / Inactive / Archived |

### Hành vi bộ lọc

- **Auto-trigger:** Khi user thay đổi bất kỳ filter, API gọi ngay (not debounce trên keyword)
- **Reset:** Button "🔄 Reset" → clear tất cả filter, query lại với defaults
- **Lưu bộ lọc:** User click "💾 Lưu bộ lọc" → Input tên → Save combo filter (LocalStorage hoặc DB)
- **Tái sử dụng:** Show saved filter history, click → apply immediately

---

## ➕ Tạo mới Môn sinh

### Modal Form (Desktop/Tablet) hoặc Full-page (Mobile)

**Bắt buộc fields:**
- `full_name` — Họ & tên (2–150 ký tự)
- `gender` — Giới tính (Nam / Nữ)
- `club_id` — Câu lạc bộ (dropdown, select từ `/students/clubs`)
- `current_belt` — Cấp đai (dropdown, mặc định "Tự vệ nhập môn")

**Không bắt buộc fields:**
- `phone` — Số điện thoại (10–15 ký tự)
- `email` — Email (format check)
- `address` — Địa chỉ
- `weight_class` — Hạng cân (single float)
- `weight_classes` — Hạng cân multiple (array float, nếu đối kháng)
- `compete_events` — Loại thi đấu (array string)
- `quyen_selections` — Quyền cụ thể (array string)
- `category_type` — Loại hình (phong_trao / pho_thong)
- `category_loai` — Loại giải (1A/1B/2/3/4/5 hoặc 1/2/3/4)
- `notes` — Ghi chú (≤ 500 ký tự)

**Validation:**
- Server kiểm tra `id_number` (CCCD) không trùng lặp
- Nếu trùng → return error `DUPLICATE_ID_NUMBER`
- Server auto-generate `id_number` nếu không cung cấp
- Server auto-set `join_date` = today()
- Server auto-register võ sinh vào tournament hiện tại

**Response:**
```json
{
  "id": 123,
  "code": "VS-001",
  "message": "Tạo môn sinh thành công"
}
```

**Hành động button:**
- [Huỷ] — Close modal / Go back
- [Lưu & Tiếp] — Save → Reset form → Keep modal open
- [Lưu] — Save → Close modal → Refresh danh sách

---

## 📤 Import Excel

### Yêu cầu file

- **Format:** `.xlsx` (Excel 2007+)
- **Size:** ≤ 10 MB
- **Character encoding:** UTF-8
- **Columns (bắt buộc):**
  - `ho_ten` — Họ tên
  - `gioi_tinh` — Giới tính (Nam/Nữ, không dấu OK)
  - `ten_cau_lac_bo` — Tên CLB (phải exact match)
  - `dai_cap` — Cấp đai (xem bảng ánh xạ dưới)

- **Columns (tùy chọn):**
  - `ngay_sinh` — Date (DD/MM/YYYY or YYYY-MM-DD)
  - `cccd` — CCCD/CMND (string, auto-gen if empty)
  - `so_dien_thoai` — Phone
  - `hang_can` — Hạng cân (float)
  - `noi_dung_thi_dau` — Content (semicolon-separated, if multiple)

### Ánh xạ Cấp đai (case-insensitive, có dấu/không dấu)

Chấp nhận: `tu ve nhap mon`, `Tự Vệ nhập môn`, `tu_ve_nhap_mon`, `TỰ VỆ NHẬP MÔN`, ...
```
tu ve nhap mon           → Tự vệ nhập môn
lam dai nhap mon         → Lam đai nhập môn
lam dai i                → Lam đai I
lam dai ii               → Lam đai II
lam dai iii              → Lam đai III
chuan hoang dai          → Chuẩn Hoàng đai
hoang dai                → Hoàng đai
hoang dai i              → Hoàng đai I
hoang dai ii             → Hoàng đai II
hoang dai iii            → Hoàng đai III
chuan hong dai           → Chuẩn Hồng đai
```

### Luồng Import

1. User click "📤 Import" → Modal mở
2. Drag-drop hoặc click select file `.xlsx`
3. **Step 1 — Select:** Show file info (name, size), required columns
4. **Step 2 — Uploading:** Spinner loading
5. **Step 3 — Result:**
   - Summary: X thành công, Y lỗi
   - Danh sách lỗi (row, tên, lỗi chi tiết)
   - Actions: Download error report, Close

### Error handling

| Mã lỗi | Message | Xử lý |
|--------|---------|-------|
| `MISSING_COLUMNS` | Thiếu cột bắt buộc | Show cột nào bị thiếu |
| `FILE_TOO_LARGE` | File vượt quá 10MB | Reject upload |
| `INVALID_BELT` | Cấp đai không tồn tại | Row error: "Đai cấp 'XYZ' không hợp lệ" |
| `CLUB_NOT_FOUND` | Tên CLB không tồn tại | Row error: "CLB 'ABC' không tồn tại" |
| `MISSING_NAME` | Họ tên trống | Row error: "Thiếu họ tên" |
| `INVALID_DATE` | Date format sai | Row error: "Ngày sinh không hợp lệ" |

---

## 🖼️ Hành động per-record

### Actions menu (⋮ hoặc inline buttons)

**For Admin/Club (if own student):**
- ✏️ **Sửa** → Modal edit (same as create form, but fields pre-filled)
- 🗑️ **Xóa** → Confirm dialog → DELETE /students/{id}
- 📷 **Tải avatar** → Click row or avatar cell → Upload modal
- ⭐ **Bookmark** → Save to favorites (highlight row name)

**For Referee/Viewer:**
- 👁️ **Xem chi tiết** → Navigate to `/students/{id}` (read-only)

---

## 📱 Responsive Details

### Mobile (< 768px)
- Table collapses into card layout (StudentCard component)
- Each card shows: Avatar, Name, Club, Belt (badge), Weight, Status
- Actions in dropdown (⋮)
- Filter button toggles sidebar (slides in from left)
- Pagination: [< Prev] [1/8] [Next >]

### Tablet (768–1024px)
- Table with horizontal scroll possible
- Some columns hidden (e.g., Notes), accessible via dropdown arrow

---

## 🔄 API Integrations

### GET /students — List with filters
```
Query params:
  - keyword: string (optional)
  - club_id: int (optional)
  - belt_rank: string (optional)
  - event: string (optional)
  - gender: string (optional)
  - weight_class: float (optional)
  - category_type: string (optional)
  - category_loai: string (optional)
  - quyen_selection: string (optional)
  - status: string = "active" (default)
  - page: int = 1
  - page_size: int = 20
```

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "code": "VS-001",
      "full_name": "Nguyễn A",
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
    }
  ],
  "total": 156,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

### POST /students — Create
**Request:**
```json
{
  "full_name": "Nguyễn A",
  "gender": "M",
  "club_id": 10,
  "current_belt": "Lam Đai I",
  "phone": "0912345678",
  "weight_class": 65,
  ...
}
```

**Response:** 201 Created
```json
{
  "id": 1,
  "code": "VS-001",
  "message": "Tạo môn sinh thành công"
}
```

### PUT /students/{id} — Update
**Request:** (same as POST, partial updates)
**Response:** 200 OK

### DELETE /students/{id} — Delete
**Response:** 204 No Content

### POST /students/import — Bulk import
**Request:** multipart/form-data (file: .xlsx)
**Response:** 200 OK
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
    }
  ]
}
```

### GET /students/clubs — List all clubs
**Response:**
```json
[
  { "id": 10, "name": "CLB Vovinam Q1" },
  { "id": 11, "name": "CLB Vovinam Q2" }
]
```

### GET /students/meta — Metadata (belts, weight classes)
**Response:**
```json
{
  "competing_belts": ["Tự vệ nhập môn", "Lam đai nhập môn", ...],
  "weight_classes": [45, 48, 51, ...]
}
```

---

## 💾 Local Storage & State Management

- **Saved filters:** Store in LocalStorage as JSON (per-user session)
- **Pagination state:** Remember current page + filter combo
- **Sorting:** Remember last sort column & direction
- **Refresh behavior:** On create/delete, invalidate TanStack Query cache (auto-refetch)

---

## ✅ Acceptance Criteria

- [ ] Danh sách tải & hiển thị ≤ 2s (với 20 items)
- [ ] Lọc nâng cao trigger API ngay lập tức (no debounce)
- [ ] Import Excel xử lý 1000 rows ≤ 10s
- [ ] Mobile layout tương thích tất cả devices (375–768px)
- [ ] Bookmark functionality lưu & tái sử dụng
- [ ] Error handling hiển thị rõ ràng per-row (import)
- [ ] Pagination remembers filter state across page turns
