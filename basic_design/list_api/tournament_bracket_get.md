# Tournament Bracket — GET

## Method
GET

## Path
/tournaments/{tournament_id}/bracket

## Description
Trả về cấu trúc sơ đồ thi đấu (bracket tree) của một giải đấu, theo nội dung và hạng cân. Dùng để render bracket Sigma / single-elimination.

## Request

### Params
- `tournament_id` (int, required)

### Query
- `event_type` (string, required) — `sparring` | `don_luyen` | `song_luyen` | `da_luyen` | `don_chan`
- `weight_class` (number, optional) — Chỉ áp dụng khi `event_type = sparring`
- `gender` (string, optional) — `M` | `F`

### Body
_(none)_

## Response

### Success (200)
```json
{
  "tournament_id": 1,
  "event_type": "sparring",
  "weight_class": 57,
  "gender": "M",
  "rounds": [
    {
      "round": "quarter_final",
      "round_label": "Tứ kết",
      "order": 1,
      "matches": [
        {
          "id": 10,
          "mat_number": 1,
          "status": "completed",
          "blue": { "student_id": 5, "name": "Nguyễn Văn A", "club": "CLB Q1", "score": 7 },
          "red":  { "student_id": 8, "name": "Trần Văn B",   "club": "CLB Q3", "score": 4 },
          "winner_id": 5,
          "result_type": "points"
        }
      ]
    },
    {
      "round": "semi_final",
      "round_label": "Bán kết",
      "order": 2,
      "matches": [...]
    },
    {
      "round": "final",
      "round_label": "Chung kết",
      "order": 3,
      "matches": [...]
    }
  ]
}
```

### Error
- `401 UNAUTHORIZED`
- `404 TOURNAMENT_NOT_FOUND`
- `404 NO_BRACKET` — Chưa có sơ đồ thi đấu cho nội dung này

## Rules
- Chỉ trả về matches có `event_type` khớp với param
- Nếu `event_type = sparring` mà không có `weight_class` → trả về tất cả hạng cân nhóm theo `weight_class`
- Round order: `round_1` → `quarter_final` → `semi_final` → `final`

## Used By Screens
- `03_tournament_management/bracket_draw`
