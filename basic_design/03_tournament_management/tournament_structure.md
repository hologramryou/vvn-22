# Màn hình: Cấu trúc Giải đấu (Tournament Structure)

**URL:** `/tournaments`
**Version:** 1.0
**Last Updated:** 2026-03-29
**Status:** ✅ Implemented

---

## 📌 Tuyên bố giới thiệu

Màn hình **Cấu trúc Giải đấu** hiển thị tổng quan một giải đấu, bao gồm:

1. **Thông tin giải** — Tên, trạng thái (DRAFT/PUBLISHED/ONGOING/COMPLETED), năm
2. **Danh sách hạng cân** — Phân loại theo giới tính/loại hình/nhóm tuổi
3. **VĐV đăng ký** — Danh sách per weight class, số lượng, trạng thái
4. **Action buttons** — Sinh bracket (generate), lập lịch (schedule), publish, reset

---

## 👤 Vai trò & Quyền hạn

| Vai trò | Xem | Generate | Publish | Reset |
|---------|:---:|:--------:|:-------:|:----:|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Referee** | ✅ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ |
| **Club** | ✅ | ❌ | ❌ | ❌ |

---

## 🎨 Layout & Responsive

### Desktop (≥ 1024px)

```
┌────────────────────────────────────────────────────────────┐
│  Tournaments                                               │
│  Vovinam 2026 · DRAFT                                      │
│  [⚙️ Generate Bracket] [📅 Generate Schedule] [Publish]    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Phong Trào (11 hạng cân)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Hạng cân      │ Nam │ Nữ  │ Tổng │ Status          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Loại 1A       │     │     │      │                 │   │
│  │ - 45 kg       │  5  │  -  │   5  │ 🟢 Ready        │   │
│  │ - 48 kg       │  4  │  3  │   7  │ 🟢 Ready        │   │
│  │ - 51 kg       │  6  │  5  │  11  │ 🟢 Ready        │   │
│  │ ...                                  │                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Phổ Thông (8 hạng cân)                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Quyền (Hội diễn) — age_type='5'                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PT_1A_Nam_Quyền    │  8 VĐV                         │   │
│  │ PT_1A_Nữ_Quyền     │  5 VĐV                         │   │
│  │ PT_2_Nam_Quyền     │  4 VĐV                         │   │
│  │ ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Mobile (< 1024px)

```
┌───────────────────────────────────────┐
│ Tournaments                           │
│ Vovinam 2026 · DRAFT                  │
│ [⚙️] [📅] [🔑]                        │
├───────────────────────────────────────┤
│  Phong Trào (11 hạng)                │
│  ○ Loại 1A                           │
│    • 45kg: 5 Nam — 🟢                │
│    • 48kg: 7 total (4M+3F) — 🟢      │
│    • ...                             │
│  ○ Loại 1B                           │
│    ...                               │
│  Phổ Thông (8 hạng)                  │
│  ...                                 │
│  Quyền — 20 VĐV tổng                 │
│  ...                                 │
└───────────────────────────────────────┘
```

---

## 📊 Tournament Info Section

### Header

```
┌────────────────────────────────────────┐
│  Vovinam 2026                          │
│  Status: DRAFT                         │
│  29/3/2026 – 1/4/2026                  │
│  Địa điểm: SVĐ Thể dục Miếu Nổi        │
│                                        │
│  [⚙️ Generate Bracket]                 │
│  [📅 Generate Schedule]                │
│  [✅ Publish Tournament]               │
│  [🔄 Reset Bracket]                   │
└────────────────────────────────────────┘
```

**Fields:**

| Field | Type | Ghi chú |
|-------|------|--------|
| name | String | Tên giải (VD: "Vovinam 2026") |
| status | Enum | DRAFT, PUBLISHED, ONGOING, COMPLETED |
| year | Number | Năm tổ chức |
| venue | String | Địa điểm (tùy chọn) |
| date_start / date_end | Date | Khoảng thời gian (tùy chọn) |

### Status Badges

| Status | Màu | Icon | Ghi chú |
|--------|-----|------|--------|
| DRAFT | Gray | ⚪ | Chuẩn bị, có thể edit |
| PUBLISHED | Blue | 🔵 | Khóa, bắt đầu thi |
| ONGOING | Orange | 🟠 | Đang thi đấu |
| COMPLETED | Green | 🟢 | Kết thúc |

---

## 🏆 Weight Class Listing

### Group by Category & Age Type

**Phong Trào:**
- Loại 1A (6 hạng cân: 45, 48, 51, 54, 57, 60)
- Loại 1B (6 hạng cân)
- Loại 2, 3, 4 (mỗi cái 6 hạng)
- Loại 5 = Quyền (Hội diễn)

**Phổ Thông:**
- Loại 1, 2, 3, 4 (mỗi cái 6 hạng)

### Table Format (per Age Type)

```
┌────────────────────┬──────┬──────┬───────┬─────────────┐
│ Hạng cân (Weight)  │ Nam  │  Nữ  │ Tổng  │ Status      │
├────────────────────┼──────┼──────┼───────┼─────────────┤
│ 45 kg              │  5   │  —   │   5   │ 🟢 Ready    │
│ 48 kg              │  4   │  3   │   7   │ 🟢 Ready    │
│ 51 kg              │  6   │  5   │  11   │ 🟢 Ready    │
│ 54 kg              │  5   │  4   │   9   │ 🟢 Ready    │
│ 57 kg              │  7   │  6   │  13   │ 🟢 Ready    │
│ 60 kg              │  3   │  2   │   5   │ 🟢 Ready    │
└────────────────────┴──────┴──────┴───────┴─────────────┘
```

**Columns:**

| Column | Type | Ghi chú |
|--------|------|--------|
| **Hạng cân** | String | VD: "45 kg", "48 kg" |
| **Nam** | Number | Số VĐV nam (hoặc "—" nếu 0) |
| **Nữ** | Number | Số VĐV nữ (hoặc "—" nếu 0) |
| **Tổng** | Number | Total Nam + Nữ |
| **Status** | Badge | 🟢 Ready (≥2), 🟡 Needs (1 VĐV), ⚫ Empty (0) |

### Status Definition

- **🟢 Ready:** ≥2 VĐV → Có thể sinh bracket
- **🟡 Needs:** 1 VĐV → BYE trực tiếp (vô địch tự động)
- **⚫ Empty:** 0 VĐV → Bỏ qua

### Collapsible Sections (Mobile)

```
▼ Phong Trào (11 hạng cân)
  ▼ Loại 1A (6 hạng)
    45 kg: 5 Nam — 🟢
    48 kg: 7 (4M+3F) — 🟢
    ...
  ▼ Loại 1B (6 hạng)
    ...
▼ Phổ Thông (8 hạng)
  ...
▼ Quyền (20 VĐV)
  ...
```

---

## 🏅 Quyền Slots (Hội diễn Luyện)

Hiển thị riêng bên dưới danh sách hạng cân chính.

```
┌─────────────────────────────────────────┐
│ Quyền (age_type='5') — 20 VĐV tổng     │
├─────────────────────────────────────────┤
│ PT_1A_Nam_Quyền   │ 8 VĐV    │ 🟢     │
│ PT_1A_Nữ_Quyền    │ 5 VĐV    │ 🟢     │
│ PT_2_Nam_Quyền    │ 4 VĐV    │ 🟢     │
│ PT_3_Nữ_Quyền     │ 3 VĐV    │ 🟢     │
└─────────────────────────────────────────┘
```

---

## 🔘 Action Buttons

### Primary Actions (Sticky Top)

**For Admin:**
```
[⚙️ Generate Bracket]  [📅 Generate Schedule]  [✅ Publish]  [🔄 Reset]
```

**For Others:**
```
(No buttons, read-only)
```

### Button States

| Button | DRAFT | PUBLISHED | ONGOING | COMPLETED |
|--------|:-----:|:---------:|:-------:|:---------:|
| Generate Bracket | ✅ Enabled | ❌ Disabled | ❌ Disabled | ❌ Disabled |
| Generate Schedule | ✅ Enabled* | ❌ Disabled | ❌ Disabled | ❌ Disabled |
| Publish | ✅ Enabled* | ❌ Disabled | ❌ Disabled | ❌ Disabled |
| Reset | ✅ Enabled | ❌ Disabled | ❌ Disabled | ❌ Disabled |

> `*` — Requires bracket generated

### Button Behavior

**Generate Bracket:**
- Gọi `POST /tournaments/{id}/generate-matches`
- Sinh BracketMatch records (đối kháng only)
- Show spinner → Success toast / Error modal
- Refresh bracket visualization

**Generate Schedule:**
- Gọi `POST /tournaments/{id}/generate-schedule`
- Tạo QuyenSlot records + assign courts/order
- Show spinner → Success toast
- Update display

**Publish:**
- Gọi `PATCH /tournaments/{id}/publish`
- Check: bracket generated + schedule ready
- Status: DRAFT → PUBLISHED
- Show confirmation dialog
- Disable all edit buttons

**Reset:**
- Show danger confirmation: "Xóa toàn bộ bracket & lịch?"
- Backend: Delete all BracketMatch + QuyenSlot
- Status: PUBLISHED → DRAFT
- Refresh display

---

## 📊 Weight Class Details Modal (Optional)

Click on hạng cân → Show chi tiết VĐV:

```
┌──────────────────────────────────────────┐
│ PT_1A_Nam_45kg — 5 VĐV                  │
├──────────────────────────────────────────┤
│ # │ Họ & Tên     │ CLB      │ Đai cấp    │
├──────────────────────────────────────────┤
│ 1 │ Nguyễn A     │ CLB Q1   │ Lam Đai I  │
│ 2 │ Trần B       │ CLB Q2   │ Hoàng Đai  │
│ 3 │ Lê C         │ CLB Q1   │ Lam Đai II │
│ 4 │ Phạm D       │ CLB BT   │ Lam Đai I  │
│ 5 │ Võ E         │ CLB Q1   │ Hoàng Đai I│
│                                           │
│ [Add VĐV] [Remove VĐV]                   │
│                          [Close]         │
└──────────────────────────────────────────┘
```

---

## 🔄 API Integrations

### GET /tournaments/structure — Lấy cấu trúc giải

**Response:**
```json
{
  "tournament_id": 1,
  "tournament_name": "Vovinam 2026",
  "status": "DRAFT",
  "year": 2026,
  "venue": "SVĐ Thể dục Miếu Nổi",
  "weight_classes": [
    {
      "id": 101,
      "category": "phong_trao",
      "age_type_code": "1A",
      "age_type_label": "Loại 1A",
      "males": [
        {
          "weight": 45,
          "count": 5,
          "status": "ready"
        },
        {
          "weight": 48,
          "count": 7,
          "status": "ready"
        }
      ],
      "females": [
        {
          "weight": 45,
          "count": 2,
          "status": "ready"
        }
      ]
    },
    // ... more age types
  ],
  "quyen_slots_summary": {
    "total": 20,
    "by_category_age": [...]
  }
}
```

### POST /tournaments/{id}/generate-matches

**Response:**
```json
{
  "tournament_id": 1,
  "message": "Sinh bracket thành công",
  "matches_created": 85,
  "bye_matches": 15
}
```

### POST /tournaments/{id}/generate-schedule

**Response:**
```json
{
  "tournament_id": 1,
  "message": "Lập lịch thành công",
  "total_items": 105,
  "quyen_slots": 20,
  "bracket_matches": 85
}
```

### PATCH /tournaments/{id}/publish

**Response:**
```json
{
  "tournament_id": 1,
  "status": "PUBLISHED",
  "message": "Phát hành giải đấu thành công"
}
```

---

## ✅ Acceptance Criteria

- [ ] Load structure ≤ 2s
- [ ] Group by category/age_type correctly
- [ ] Status badges display per total VĐV
- [ ] Mobile collapse/expand works
- [ ] Generate buttons disabled when not applicable
- [ ] Generate success shows confirmation
- [ ] Reset shows danger dialog
- [ ] Publish validates bracket + schedule exist
- [ ] Read-only for non-admin roles

---

## 🔗 Related Specs

- [_index.md](_index.md) — Overview
- [bracket_generation.md](./bracket_generation.md) — Generate logic
- [match_execution.md](./match_execution.md) — Run matches
- [api_reference.md](./api_reference.md) — API endpoints
