# Màn hình: Chi tiết Môn sinh

**URL:** `/students/:id`
**Version:** 2.0
**Last Updated:** 2026-03-29
**Status:** ✅ Implemented

---

## 📌 Tuyên bố giới thiệu

Màn hình **Chi tiết Môn sinh** hiển thị hồ sơ đầy đủ của một võ sinh, bao gồm:
- **Thông tin cá nhân & võ thuật** — chi tiết profile
- **Lịch sử câu lạc bộ** — quá trình chuyển CLB
- **Điều kiện tham dự** — kiểm tra năng lực thi đấu

**Auth:** Cần đăng nhập. Tất cả vai trò (Referee, Viewer, Club, Admin) đều có quyền xem.

---

## 👤 Vai trò & Quyền hạn

| Vai trò | Xem | Sửa | Xóa |
|---------|:---:|:---:|:---:|
| **Admin** | ✅ | ✅ | ✅ |
| **Club** | ✅* | ✅* | ✅* |
| **Referee** | ✅ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ |

> `*` — Chỉ được xem/sửa/xóa nếu student thuộc CLB mình

---

## 🎨 Layout & UI

### Header (Sticky top)
```
[← Quay lại]   Hồ sơ Võ sinh   [⋮ Hanh động]
```

### Hero Section (Dark blue background #1e3a5f)
```
┌─────────────────────────────────────────────┐
│   [Avatar]  Nguyễn Văn A                    │
│             VS-001 · Nam · 28 tuổi          │
│             Status: 🟢 Active               │
│             [P01] [P02] [ĐK001]  (tags)    │
│                                             │
│   Tuổi: 28   Hạng cân: 65kg   CLB: Q1     │
└─────────────────────────────────────────────┘
```

### Tab Bar (Sticky bottom-of-header)
```
[📋 Cá nhân]  [📜 Lịch sử CLB]  [🎖️ Giải đấu]
```

### Action Buttons (Bottom-right floating / Top-right)
- **For Admin/Club (own student):** [✏️ Sửa] [🗑️ Xóa] [📷 Tải avatar]
- **For Referee/Viewer:** (no buttons)

---

## 📑 Tab 1: Cá nhân (Personal Info)

### Section: Thông tin cơ bản

| Field | Value | Hiển thị | Ghi chú |
|-------|-------|---------|---------|
| **Họ & tên** | full_name | ✅ | Tên đầy đủ |
| **Mã** | code | ✅ | VD: VS-001 |
| **Giới tính** | gender | ✅ | Nam / Nữ |
| **Ngày sinh** | date_of_birth | ✅ | Định dạng: DD/MM/YYYY |
| **Tuổi** | Tính từ date_of_birth | ✅ | Realtime |
| **Số điện thoại** | phone | ✅ | Hoặc "—" nếu trống |
| **Email** | email | ❌ | Không hiển thị |
| **Địa chỉ** | address | ✅ | Hoặc "—" nếu trống |

### Section: Thông tin Vovinam

| Field | Value | Hiển thị | Ghi chú |
|-------|-------|---------|---------|
| **Câu lạc bộ** | club_name | ✅ | Link đến CLB page (nếu có) |
| **Ngày tham gia** | club_joined_at | ✅ | Ngày join CLB hiện tại |
| **Cấp đai** | current_belt | ✅ | Badge có màu + text |
| **Ngày lên cấp** | belt_date | ✅ | Hoặc "—" nếu trống |
| **Hạng cân** | weight_class | ✅* | Hoặc "—" nếu trống |
| **Hạng cân (Multiple)** | weight_classes | ✅* | Nếu thi đối kháng |
| **Nội dung thi đấu** | compete_events | ✅* | Tags: Đối kháng, Quyền, ... |
| **Quyền cụ thể** | quyen_selections | ✅* | Tags: P01, P02, P03, ... |
| **Loại hình** | category_type | ✅* | Phong trào / Phổ thông |
| **Loại giải** | category_loai | ✅* | 1A, 1B, 2, 3, 4, 5 (v.v.) |
| **Ghi chú** | notes | ✅* | Hoặc "—" nếu trống |

> `✅*` — Hiển thị chỉ nếu có dữ liệu

### UI Component: BeltBadge
```
┌──────────────────┐
│  Lam Đai I      │  (màu xanh dương)
│  Ngày lên: ...  │
└──────────────────┘
```

---

## 📜 Tab 2: Lịch sử Câu lạc bộ (Club History)

Hiển thị tất cả CLB mà student đã tham gia, theo thứ tự **mới nhất trước**.

### Timeline format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 🔵 CLB Vovinam Q1     [Hiện tại]
    Tham gia: 01/01/2025
    ────────────────────
    
 ⭕ CLB Vovinam Q2
    Tham gia: 15/06/2024
    Rời: 31/12/2024
    Thời gian: 7 tháng
    ────────────────────
    
 ⭕ CLB Vovinam Bình Thạnh
    Tham gia: 10/01/2024
    Rời: 14/06/2024
    Thời gian: 5 tháng

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Data

| Field | Ghi chú |
|-------|---------|
| **club_name** | Tên CLB |
| **joined_at** | Ngày tham gia (DD/MM/YYYY) |
| **left_at** | Ngày rời (nếu có), hoặc "Hiện tại" |
| **is_current** | Badge [Hiện tại] nếu true |
| **Duration** | Tính tự động: `left_at - joined_at` |

---

## 🎖️ Tab 3: Giải đấu (Tournament Participation)

Liệt kê tất cả **giải đấu mà student đã đăng ký tham gia**.

### Grid format

```
┌──────────────────────────────────────────────┐
│  Vovinam 2026                                │
│  Ngày: 15–17/04/2026                        │
│  Hạng cân: 65kg                             │
│  Nội dung: Đối kháng · Quyền P01            │
│                                              │
│  Status: 🟢 Đã đăng ký · 🟡 Đang thi · ✅ Hoàn thành
│  Vòng: Bảng A · Trận số: 3                 │
├──────────────────────────────────────────────┤
│  Giải Quốc phòng 2025                       │
│  ...                                         │
└──────────────────────────────────────────────┘
```

### Thông tin per-tournament

| Field | Ghi chú |
|-------|---------|
| **tournament_name** | Tên giải |
| **tournament_date_start / end** | Ngày khai mạc–đóng |
| **registered_weight_class** | Hạng cân sử dụng |
| **registered_events** | Nội dung: Đối kháng, Quyền, v.v. |
| **registered_form** | Quyền cụ thể: P01, P02, ... |
| **status** | REGISTERED / IN_PROGRESS / COMPLETED |
| **bracket_info** | Vòng, trận số (nếu có) |
| **result** | Win / Loss / Pending (nếu finished) |

---

## 🔄 API Integrations

### GET /students/{id} — Retrieve detail with all info
**Response:**
```json
{
  "id": 1,
  "code": "VS-001",
  "full_name": "Nguyễn A",
  "date_of_birth": "1996-05-10",
  "gender": "M",
  "id_number": "001232345678",
  "phone": "0912345678",
  "email": null,
  "address": "123 Nguyễn Huệ",
  "avatar_url": "https://...",
  "current_belt": "Lam Đai I",
  "belt_date": "2025-01-15",
  "join_date": "2025-01-01",
  "weight_class": 65,
  "weight_classes": [65, 70],
  "compete_events": ["đối kháng", "quyền"],
  "quyen_selections": ["P01", "P02"],
  "category_type": "phong_trao",
  "category_loai": "1A",
  "status": "active",
  "notes": "VĐV tài năng",
  "club_id": 10,
  "club_name": "CLB Vovinam Q1",
  "club_address": "...",
  "coach_name": "Trần B",
  "coach_phone": "0987654321",
  "club_joined_at": "2025-01-01",
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
    }
  ]
}
```

### PUT /students/{id} — Update student
**Request:** (same as POST create, partial updates)
**Response:** 200 OK
```json
{
  "id": 1,
  "message": "Cập nhật môn sinh thành công"
}
```

### DELETE /students/{id} — Delete student
**Response:** 204 No Content
```json
{}
```

### POST /students/{id}/avatar — Upload avatar
**Request:** multipart/form-data (file: image)
**Response:** 200 OK
```json
{
  "avatar_url": "https://storage.example.com/..."
}
```

---

## 📱 Responsive Design

### Desktop (≥ 1024px)
- Layout: Full-width max-w-5xl centered
- Hero: Horizontal (avatar on left, info on right)
- Tab content: Full-width, readable line-length

### Tablet (768–1024px)
- Layout: Full-width with side padding
- Hero: Horizontal (smaller avatar)
- Tab content: Adjusted font size

### Mobile (< 768px)
- Layout: Full-width, edge-to-edge with padding
- Hero: Stack (avatar on top, info below)
- Tab content: Single column, larger touch targets
- Action buttons: Sticky bottom or bottom sheet modal

---

## 🔐 Edit Mode (For Admin/Club only)

When user clicks [✏️ Sửa]:
1. Fields become editable (same form layout as create page)
2. Buttons change: [Hủy] [Lưu]
3. Pre-fill all current values
4. Submit via PUT /students/{id}
5. On success: Refresh data + Show toast + Exit edit mode

---

## ✅ Acceptance Criteria

- [ ] Load detail ≤ 2s (with club history)
- [ ] Avatar displays with fallback (initials)
- [ ] Belt badge shows with correct color per rank
- [ ] Club history shows in chronological order (newest first)
- [ ] Responsive layout stacks correctly on mobile
- [ ] Only Admin/Club role can see edit/delete buttons
- [ ] Edit mode pre-fills all current values
- [ ] Delete shows confirmation dialog
- [ ] Avatar upload shows progress

---

## 🔗 Related Specs

- [Student List](./student_list.md) — Danh sách & bộ lọc
- [Data Master](./data_master.md) — Danh sách cấp đai & hạng cân
- [API Reference](./api_reference.md) — Chi tiết API endpoints
