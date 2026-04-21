# Schedule — Lịch thi đấu theo thảm

## Feature
03_tournament_management

## Description
Hiển thị lịch thi đấu được sắp xếp theo thảm (Thảm A, Thảm B…). Cho phép xem thứ tự các trận theo từng thảm trong ngày. Dùng cho Ban tổ chức điều phối thi đấu.

**URL:** `/tournaments/:id/schedule`

## Actors
- Tất cả roles (readonly)
- admin → có thể kéo-thả thứ tự trận (giai đoạn sau)

## Components

### 1. Header
- Tên giải đấu
- Date picker — chọn ngày thi đấu
- Tổng: X trận trong ngày / Y thảm hoạt động

### 2. Tab bar — Theo thảm
Tab: `Tất cả` | `Thảm 1` | `Thảm 2` | `Thảm 3` | ...

### 3. Danh sách trận theo thảm
Mỗi thảm hiển thị danh sách trận theo thứ tự:

```
Thảm 1
├── [08:00] Trận 1 — Đối kháng 54kg — A vs B        [Đã kết thúc ✓]
├── [08:20] Trận 2 — Đối kháng 57kg — C vs D        [Đang đấu 🔴]
├── [08:40] Trận 3 — Đơn luyện Nam — E              [Chờ đấu]
└── [09:00] Trận 4 — Đối kháng 60kg — F vs G        [Chờ đấu]
```

Mỗi row hiển thị:
- Giờ dự kiến (`scheduled_at`)
- Số thứ tự trận trong ngày
- Nội dung (Đối kháng / Hội diễn + hạng cân nếu có)
- Tên VĐV (Xanh vs Đỏ, hoặc tên solo cho hội diễn)
- Badge trạng thái
- Nút "Bắt đầu" (nếu status = scheduled) / "Tiếp tục" (nếu ongoing) / "Xem kết quả" (nếu completed)

### 4. Quick stats per thảm
- Tổng trận | Đã kết thúc | Đang đấu | Chờ đấu
- Progress bar % hoàn thành

## Data Source
- API: `list_api/matches_schedule_get.md`

## Actions

- Click "Bắt đầu" / "Tiếp tục"
  → Navigate: `/matches/:id/scoring`
- Click "Xem kết quả"
  → Navigate: `/matches/:id`
- Tab đổi thảm
  → Filter client-side (không re-fetch)

## States
- `loading` — Skeleton rows
- `empty` — "Không có trận nào trong ngày này"
- `active` — Hiển thị danh sách
- `error` — Toast lỗi

## Navigation
- `/matches/:id/scoring` — Màn chấm điểm
- `/matches/:id` — Kết quả trận
- `/tournaments/:id/bracket` — Sơ đồ thi đấu
