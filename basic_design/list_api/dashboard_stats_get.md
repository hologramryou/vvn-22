# Dashboard Stats — GET

## Method
GET

## Path
/dashboard/stats

## Description
Trả về tổng quan trạng thái hệ thống cho màn hình Dashboard: số trận đang diễn ra, số thảm hoạt động, danh sách trận ongoing, trạng thái thảm.

## Request

### Params
_(none)_

### Query
- `tournament_id` (int, optional) — Lọc theo giải đấu cụ thể. Mặc định: giải đấu đang `ongoing` mới nhất.

### Body
_(none — GET request)_

## Response

### Success (200)
```json
{
  "tournament": {
    "id": 1,
    "name": "Giải Vovinam TP.HCM 2025",
    "status": "ongoing"
  },
  "stats": {
    "matches_ongoing": 3,
    "mats_active": 2,
    "registrations_total": 124,
    "matches_scheduled": 18
  },
  "ongoing_matches": [
    {
      "id": 42,
      "mat_number": 1,
      "round": "semi_final",
      "blue_name": "Nguyễn Văn A",
      "blue_club": "CLB Quận 1",
      "red_name": "Trần Văn B",
      "red_club": "CLB Quận 3",
      "blue_score": 5,
      "red_score": 3,
      "started_at": "2025-09-15T08:30:00Z"
    }
  ],
  "mats": [
    {
      "mat_number": 1,
      "status": "busy",
      "event_type": "sparring",
      "match_id": 42
    },
    {
      "mat_number": 2,
      "status": "idle"
    }
  ]
}
```

### Error
- `401 UNAUTHORIZED` — Chưa đăng nhập
- `404 NO_ACTIVE_TOURNAMENT` — Không có giải đấu đang diễn ra

## Rules
- Nếu không có `tournament_id`, tự động lấy tournament mới nhất có `status = 'ongoing'`
- `matches_ongoing` = count matches với `status = 'ongoing'`
- `mats_active` = count mat_number phân biệt có trận ongoing
- Chỉ trả về tối đa 10 `ongoing_matches` (sắp xếp theo `started_at ASC`)

## Used By Screens
- `07_dashboard/dashboard`
