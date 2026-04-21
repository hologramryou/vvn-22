# Bracket Draw — Sơ đồ thi đấu

## Feature
03_tournament_management

## Description
Hiển thị sơ đồ thi đấu (bracket) theo dạng cây loại trực tiếp (Sigma bracket / single-elimination). Theo dõi từng cặp đấu theo vòng. Cập nhật trạng thái trận real-time.

**URL:** `/tournaments/:id/bracket`

## Actors
- Tất cả roles (readonly view)
- admin, club_manager → thêm nút bắt đầu trận / cập nhật kết quả

## Components

### 1. Header
- Tên giải đấu + ngày
- Dropdown chọn nội dung thi đấu: Đối kháng / Đơn luyện / Song luyện / Đa luyện / Đòn chân
- Dropdown hạng cân (nếu là Đối kháng)
- Badge đếm: tổng trận / đã kết thúc / đang diễn ra

### 2. Bracket Tree (Sigma / Single-elimination)
Hiển thị dạng cột theo vòng:
```
Vòng 1     Tứ kết    Bán kết    Chung kết
[A vs B] →
           [Winner] →
[C vs D] →             [Winner] →
                                  [WINNER]
           [E vs F] →
[G vs H] →
           [Winner] →
```

Mỗi match node hiển thị:
- Tên VĐV Xanh (club ngắn) + điểm/kết quả
- Tên VĐV Đỏ (club ngắn) + điểm/kết quả
- Trạng thái badge: `Chờ đấu` / `Đang đấu 🔴` / `Đã kết thúc ✓`
- Click node → mở detail `/matches/:id`

### 3. Trạng thái trận (color coding)
| Trạng thái | Màu border node |
|------------|----------------|
| scheduled | Gray |
| ongoing | Xanh lá + animation nhấp nháy |
| completed | Blue (winner side), Gray (loser) |
| cancelled | Đỏ mờ |

## Data Source
- API: `list_api/tournament_bracket_get.md`
- Realtime: WebSocket `/ws/tournament/:id/bracket`

## Actions

- Click match node
  → Navigate: `/matches/:id`
- Dropdown đổi nội dung / hạng cân
  → Re-fetch bracket với params mới

## States
- `loading` — Skeleton bracket
- `empty` — "Chưa có sơ đồ thi đấu. Vui lòng bốc thăm trước."
- `active` — Hiển thị bracket tree
- `error` — Toast lỗi

## Navigation
- `/matches/:id` — Chi tiết trận (click node)
- `/tournaments/:id` — Quay lại chi tiết giải
