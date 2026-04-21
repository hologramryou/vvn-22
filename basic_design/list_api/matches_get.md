# Matches List — GET

## Method
GET

## Path
/matches

## Description
Trả về danh sách trận đấu có phân trang, lọc theo giải đấu, loại nội dung, thảm, vòng đấu, trạng thái. Dùng cho màn hình Danh sách trận đấu.

## Request

### Params
_(none)_

### Query
- `tournament_id` (int, optional) — Mặc định: giải đấu đang ongoing
- `event_type` (string, optional) — `sparring` | `don_luyen` | `song_luyen` | `da_luyen` | `don_chan`
- `mat_number` (int, optional) — Số thảm
- `round` (string, optional) — `round_1` | `quarter_final` | `semi_final` | `final`
- `status` (string, optional) — `scheduled` | `ongoing` | `completed` | `cancelled`
- `page` (int, default 1)
- `page_size` (int, default 20, max 100)

### Body
_(none)_

## Response

### Success (200)
```json
{
  "items": [
    {
      "id": 42,
      "tournament_id": 1,
      "mat_number": 1,
      "event_type": "sparring",
      "round": "semi_final",
      "round_label": "Bán kết",
      "weight_class": 57,
      "scheduled_at": "2025-09-15T08:30:00Z",
      "status": "ongoing",
      "blue": {
        "student_id": 5,
        "name": "Nguyễn Văn A",
        "club": "CLB Quận 1",
        "score": 5
      },
      "red": {
        "student_id": 8,
        "name": "Trần Văn B",
        "club": "CLB Quận 3",
        "score": 3
      },
      "winner_id": null,
      "result_type": null
    }
  ],
  "total": 48,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### Error
- `401 UNAUTHORIZED`

## Rules
- Sort mặc định: `status` (ongoing trước → scheduled → completed → cancelled), rồi `scheduled_at ASC`
- Nếu không truyền `tournament_id` → lấy tournament đang `ongoing` mới nhất
- `round_label`: map từ `round` value sang tên hiển thị (Tứ kết, Bán kết, Chung kết...)

## Used By Screens
- `04_sparring_scoring/match_list`
