# Data Master: Cấp đai Vovinam & Hạng cân

**Version:** 1.0
**Last Updated:** 2026-03-29
**Status:** ✅ Final

---

## 📚 Tổng quan

Tài liệu này chứa toàn bộ **dữ liệu reference** (enum) được sử dụng trong module Quản lý Môn sinh:

1. **Cấp đai Vovinam** (18 cấp, 11 thi đấu)
2. **Hạng cân Nam/Nữ** (25 hạng)
3. **Loại thi đấu** (event type)
4. **Loại hình & Loại giải** (category)

---

## 🥋 I. Cấp đai Vovinam (Belt Ranks)

### 1. Danh sách 18 cấp (All ranks)

| # | Cấp đai | Màu | Thi đấu | Ghi chú |
|---|---------|-----|:------:|---------|
| 1 | Tự vệ nhập môn | Xanh nhạt | ✅ | Người mới, 3 tháng |
| 2 | Lam đai nhập môn | Xanh dương | ✅ | Nền tảng, 6 tháng |
| 3 | Lam đai I | Xanh dương đậm | ✅ | Bán công, 6 tháng |
| 4 | Lam đai II | Xanh dương đậm | ✅ | Nâng cao, 6 tháng |
| 5 | Lam đai III | Xanh dương sẫm | ✅ | Tiên tiến, 6 tháng |
| 6 | Chuẩn Hoàng đai | Vàng viền xanh | ✅ | Từ 12 tuổi, trung gian |
| 7 | Hoàng đai | Vàng | ✅ | Trung đẳng, 18 tháng |
| 8 | Hoàng đai I | Vàng | ✅ | Trung đẳng +, 18 tháng |
| 9 | Hoàng đai II | Vàng | ✅ | Trung đẳng ++, 18 tháng |
| 10 | Hoàng đai III | Vàng | ✅ | Trung đẳng +++, 18 tháng |
| 11 | Chuẩn Hồng đai | Đỏ viền vàng | ✅ | Cao đẳng, 24 tháng |
| 12 | Hồng đai I | Đỏ | ❌ | Không thi đấu |
| 13 | Hồng đai II | Đỏ | ❌ | Không thi đấu |
| 14 | Hồng đai III | Đỏ | ❌ | Không thi đấu |
| 15 | Hồng đai IV | Đỏ | ❌ | Không thi đấu |
| 16 | Hồng đai V | Đỏ | ❌ | Không thi đấu |
| 17 | Hồng đai VI | Đỏ | ❌ | Không thi đấu |
| 18 | Bạch đai | Trắng | ❌ | Chưởng môn (Sư phụ) |

### 2. Dropdown thi đấu (11 cấp — COMPETING_BELTS)

Chỉ những cấp có `thi_dau=✅`:

```
[
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
]
```

### 3. Belt color mapping (for UI badges)

```javascript
const BELT_COLORS = {
  "Tự vệ nhập môn": "#7dd3fc",        // sky-300
  "Lam đai nhập môn": "#0284c7",      // sky-600
  "Lam đai I": "#0284c7",             // sky-600
  "Lam đai II": "#0284c7",            // sky-600
  "Lam đai III": "#0284c7",           // sky-600
  "Chuẩn Hoàng đai": "#fcd34d",       // yellow-400
  "Hoàng đai": "#facc15",             // yellow-400
  "Hoàng đai I": "#facc15",           // yellow-400
  "Hoàng đai II": "#facc15",          // yellow-400
  "Hoàng đai III": "#facc15",         // yellow-400
  "Chuẩn Hồng đai": "#f97316",        // orange-500
  "Hồng đai I": "#ef4444",            // red-500
  "Hồng đai II": "#ef4444",           // red-500
  "Hồng đai III": "#ef4444",          // red-500
  "Hồng đai IV": "#dc2626",           // red-600
  "Hồng đai V": "#dc2626",            // red-600
  "Hồng đai VI": "#991b1b",           // red-800
  "Bạch đai": "#ffffff"               // white
}
```

### 4. Belt import mapping (case-insensitive, accents-tolerant)

```javascript
const BELT_IMPORT_MAP = {
  // Exact names (lowercase)
  "tu ve nhap mon": "Tự vệ nhập môn",
  "lam dai nhap mon": "Lam đai nhập môn",
  "lam dai i": "Lam đai I",
  "lam dai ii": "Lam đai II",
  "lam dai iii": "Lam đai III",
  "chuan hoang dai": "Chuẩn Hoàng đai",
  "hoang dai": "Hoàng đai",
  "hoang dai i": "Hoàng đai I",
  "hoang dai ii": "Hoàng đai II",
  "hoang dai iii": "Hoàng đai III",
  "chuan hong dai": "Chuẩn Hồng đai",
  "hong dai i": "Hồng đai I",
  "hong dai ii": "Hồng đai II",
  "hong dai iii": "Hồng đai III",
  "hong dai iv": "Hồng đai IV",
  "hong dai v": "Hồng đai V",
  "hong dai vi": "Hồng đai VI",
  "bach dai": "Bạch đai",
  // Aliases (with underscores, spaces, without accents, etc.)
  // ... (generated on-the-fly in BELT_IMPORT_MAP in backend)
}
```

---

## ⚖️ II. Hạng cân (Weight Classes)

### 1. Nam (Male)

| Làn (KG) | Phạm vi |
|----------|---------|
| 45 | < 45 kg |
| 48 | 45–48 kg |
| 51 | 48–51 kg |
| 54 | 51–54 kg |
| 57 | 54–57 kg |
| 60 | 57–60 kg |
| 64 | 60–64 kg |
| 68 | 64–68 kg |
| 72 | 68–72 kg |
| 77 | 72–77 kg |
| 82 | 77–82 kg |
| 92 | 82–92 kg |
| 100+ | > 92 kg |

### 2. Nữ (Female)

| Làn (KG) | Phạm vi |
|----------|---------|
| 42 | < 42 kg |
| 45 | 42–45 kg |
| 48 | 45–48 kg |
| 51 | 48–51 kg |
| 54 | 51–54 kg |
| 57 | 54–57 kg |
| 60 | 57–60 kg |
| 63 | 60–63 kg |
| 66 | 63–66 kg |
| 70 | 66–70 kg |
| 75 | 70–75 kg |
| 80+ | > 75 kg |

### 3. Hằng số (Backend)

```javascript
const WEIGHT_CLASSES = {
  "M": [45, 48, 51, 54, 57, 60, 64, 68, 72, 77, 82, 92, 100],
  "F": [42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 75, 80],
}

// Default display
const WEIGHT_CLASSES_DISPLAY = [45, 48, 51, 54, 57, 60, 64, 68, 72, 77, 82, 92, 100]
```

---

## 🏅 III. Loại thi đấu (Compete Events)

### Event types

```javascript
const COMPETE_EVENTS = [
  "quyền",              // Quyền (form/kata)
  "đối kháng",          // Sparring (full-contact)
  "song luyện",         // Partner drills
  "đơn luyện",          // Solo performance
  "đa luyện",           // Multiple styles
  "đòn chân",           // Kick techniques
]
```

### Mapping (Vietnam-local)

| Event | Mô tả | Ghi chú |
|-------|-------|--------|
| Quyền | Bài quyền (form) | VD: P01, P02, P03, ... |
| Đối kháng | Thi đấu toàn tiếp xúc | Có hạng cân |
| Song luyện | Tập đôi | Không thi đấu khoá |
| Đơn luyện | Luyện đơn | Hiếm thi đấu |
| Đa luyện | Kết hợp nhiều style | Nâng cao |
| Đòn chân | Chuyên đề chân | Hiếm |

---

## 📂 IV. Loại hình & Loại giải (Category)

### Loại hình (Category Type)

```javascript
const CATEGORY_TYPE = {
  "phong_trao": "Phong trào",      // Mass movement
  "pho_thong": "Phổ thông",        // General public
}
```

### Loại giải theo hình (Category Loai)

**Nếu `category_type = "phong_trao":`**
```
"1A", "1B", "2", "3", "4", "5", "6+"
```
Giải A, Giải B, Giải II, Giải III, Giải IV, Giải V, Giải VI+

**Nếu `category_type = "pho_thong":`**
```
"1", "2", "3", "4", "5+"
```
Giải I, Giải II, Giải III, Giải IV, Giải V+

---

## 🎯 V. Bài quyền (Quyen Forms)

### Nam (Male) — 5 bài

| Code | Tên | Độ khó | Ghi chú |
|------|-----|--------|--------|
| P01 | Quyền cơ sơ | ⭐ | Beginner |
| P02 | Quyền cơ bản | ⭐⭐ | Intermediate |
| P03 | Quyền chuyên sâu | ⭐⭐⭐ | Advanced |
| P04 | Quyền cao cấp | ⭐⭐⭐⭐ | Master |
| P05 | Quyền tự do | ⭐⭐⭐⭐⭐ | Freestyle |

### Nữ (Female) — 5 bài

| Code | Tên | Độ khó | Ghi chú |
|------|-----|--------|--------|
| P01F | Quyền cơ sơ (Nữ) | ⭐ | Beginner |
| P02F | Quyền cơ bản (Nữ) | ⭐⭐ | Intermediate |
| P03F | Quyền chuyên sâu (Nữ) | ⭐⭐⭐ | Advanced |
| P04F | Quyền cao cấp (Nữ) | ⭐⭐⭐⭐ | Master |
| P05F | Quyền tự do (Nữ) | ⭐⭐⭐⭐⭐ | Freestyle |

### Backend code

```javascript
const QUYEN_FORMS = {
  "M": [
    { code: "P01", name: "Quyền cơ sơ" },
    { code: "P02", name: "Quyền cơ bản" },
    { code: "P03", name: "Quyền chuyên sâu" },
    { code: "P04", name: "Quyền cao cấp" },
    { code: "P05", name: "Quyền tự do" },
  ],
  "F": [
    { code: "P01F", name: "Quyền cơ sơ (Nữ)" },
    { code: "P02F", name: "Quyền cơ bản (Nữ)" },
    { code: "P03F", name: "Quyền chuyên sâu (Nữ)" },
    { code: "P04F", name: "Quyền cao cấp (Nữ)" },
    { code: "P05F", name: "Quyền tự do (Nữ)" },
  ],
}
```

---

## 🔐 VI. Trạng thái võ sinh (Student Status)

```javascript
const STUDENT_STATUS = {
  "active": "Đang hoạt động",
  "inactive": "Tạm ngưng",
  "archived": "Đã lưu trữ",
}
```

| Status | Badge | Ghi chú |
|--------|-------|--------|
| `active` | 🟢 | Có thể tham gia thi đấu |
| `inactive` | 🟡 | Tạm thời không tham gia |
| `archived` | ⚫ | Đã rời khỏi hệ thống |

---

## 📝 VII. Validation Rules

### Quy tắc chung

| Field | Min | Max | Pattern | Ghi chú |
|-------|-----|-----|---------|--------|
| full_name | 2 | 150 | Text | Bắt buộc |
| phone | 10 | 15 | Digits | Tùy chọn, VN format |
| email | 5 | 150 | RFC5322 | Tùy chọn |
| address | 0 | 500 | Text | Tùy chọn |
| notes | 0 | 500 | Text | Tùy chọn |
| id_number | 10 | 12 | Alphanumeric | Auto-gen |
| code | 5 | 20 | `VS-\d+` | Auto-gen |

### Tùy chọn cấp đai

- Dropdown mặc định: 11 cấp thi đấu
- Người dùng có thể chọn bất kỳ cấp nào từ 18 cấp (nếu là admin)
- Readonly cho club users (force frontend logic)

---

## 🔗 Xem thêm

- [Student List](./student_list.md) — Sử dụng WEIGHT_CLASSES từ endpoint `/students/meta`
- [Student Detail](./student_detail.md) — Hiển thị belt badge với màu từ BELT_COLORS
- [API Reference](./api_reference.md) — Endpoint `/students/meta` trả về constants
