# Dashboard

## Feature
07_dashboard

## Description
Màn hình tổng quan hệ thống — hiển thị trạng thái hoạt động hiện tại của giải đấu: trận đang diễn ra, thảm thi đấu đang hoạt động, và trạng thái hệ thống. Là màn hình landing sau khi đăng nhập.

## Actors
- admin, club_manager, referee, scorekeeper, viewer (tất cả roles)

## Components

### 1. Stats cards (4 ô)
| Card | Giá trị | Màu |
|------|---------|-----|
| Trận đang diễn ra | Số matches có status = 'ongoing' | Xanh lá |
| Thảm đang hoạt động | Số mat_number đang có trận ongoing | Xanh dương |
| Tổng VĐV đã đăng ký | Tổng tournament_registrations | Vàng |
| Trận chờ bắt đầu | Số matches status = 'scheduled' | Xám |

### 2. Bảng: Trận đang diễn ra
Hiển thị real-time các trận đang diễn ra với:
- Số thảm (Thảm A, Thảm B…)
- VĐV Xanh vs VĐV Đỏ (tên + đơn vị)
- Tỉ số hiện tại (blue_total_score : red_total_score)
- Vòng đấu (quarter_final, semi_final, final)
- Thời gian đã đấu (elapsed timer)
- Nút "Xem" → navigate `/matches/:id`

### 3. Bảng: Thảm thi đấu
Trạng thái tất cả thảm thi đấu đang dùng trong giải:
- Mat number (Thảm 1, 2…)
- Trận hiện tại (VĐV Xanh vs VĐV Đỏ) hoặc "Trống"
- Trạng thái: 🟢 Đang thi đấu / ⚪ Chờ trận tiếp theo
- Loại nội dung (Đối kháng / Hội diễn)

### 4. Trạng thái hệ thống (System status)
- WebSocket connection: Connected / Disconnected
- Giải đấu đang diễn ra: tên giải + ngày
- Thời gian server (hiển thị realtime clock)

## Data Source
- API: `list_api/dashboard_stats_get.md`
- Realtime update: WebSocket channel `/ws/dashboard`

## Actions

- Click vào trận đang diễn ra
  → Navigate: `/matches/:id`
- Click vào thảm
  → Navigate: `/matches?mat={mat_number}`

## States
- `loading` — Skeleton cards khi chờ API
- `no_active_match` — Hiển thị empty state "Chưa có trận nào đang diễn ra"
- `active` — Hiển thị đầy đủ stats + tables
- `error` — Toast lỗi, retry button

## Navigation
- `/matches/:id` — Chi tiết trận đấu
- `/matches` — Danh sách trận đấu (menu item 4)

## Refresh
- Auto-refresh mỗi 10 giây (polling) hoặc qua WebSocket push
- Badge 🔴 nhấp nháy khi có trận đang diễn ra
