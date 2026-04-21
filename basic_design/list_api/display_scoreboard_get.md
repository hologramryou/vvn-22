# Display Scoreboard — GET

## Method
GET

## Path
/display/scoreboard

## Description
Trả về snapshot trạng thái hiện tại của bảng điểm công cộng cho một trận đấu hoặc thảm thi đấu. Dùng để khởi tạo màn hình display trước khi WebSocket kết nối.

## Request

### Params
_(none)_

### Query
- `match_id` (int, optional) — ID trận cụ thể
- `mat_number` (int, optional) — Số thảm (trả về trận đang ongoing trên thảm đó)

> Phải truyền một trong hai: `match_id` hoặc `mat_number`

### Body
_(none)_

## Response

### Success (200) — Đối kháng
```json
{
  "match_id": 42,
  "event_type": "sparring",
  "mat_number": 1,
  "round": "semi_final",
  "round_label": "Bán kết",
  "status": "ongoing",
  "tournament_name": "Giải Vovinam TP.HCM 2025",
  "blue": {
    "student_id": 5,
    "name": "NGUYỄN VĂN A",
    "club": "CLB Quận 1",
    "score": 5,
    "warnings": 1
  },
  "red": {
    "student_id": 8,
    "name": "TRẦN VĂN B",
    "club": "CLB Quận 3",
    "score": 3,
    "warnings": 0
  },
  "clock": {
    "mode": "countdown",
    "remaining_ms": 105000,
    "round_number": 1,
    "total_rounds": 2,
    "is_running": true
  }
}
```

### Success (200) — Hội diễn
```json
{
  "match_id": 55,
  "event_type": "don_luyen",
  "mat_number": 2,
  "status": "ongoing",
  "tournament_name": "Giải Vovinam TP.HCM 2025",
  "athlete": {
    "student_id": 12,
    "name": "NGUYỄN VĂN C",
    "club": "CLB Quận 5"
  },
  "scores_by_referee": [
    {
      "referee_id": 3,
      "technique": 8.5,
      "spirit": 9.0,
      "timing": 8.8,
      "difficulty": 7.5,
      "submitted": true
    }
  ],
  "final_score": null
}
```

### Error
- `400 MISSING_PARAMS` — Không có `match_id` hoặc `mat_number`
- `404 NO_ACTIVE_MATCH` — Thảm đang trống
- `401 UNAUTHORIZED`

## Rules
- `match_id` ưu tiên hơn `mat_number` nếu truyền cả hai
- Nếu `mat_number` mà có nhiều trận ongoing → trả về trận `started_at` gần nhất
- `clock.remaining_ms` tính từ server thời điểm response (để client sync đồng hồ)

## Used By Screens
- `06_display_scoreboard/public_scoreboard`
