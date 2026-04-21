# Matches Schedule — GET

## Method
GET

## Path
/tournaments/{tournament_id}/schedule

## Description
Trả về lịch thi đấu của giải, nhóm theo thảm và ngày. Dùng cho màn hình Schedule và Dashboard.

## Request

### Params
- `tournament_id` (int, required)

### Query
- `date` (string, optional) — ISO date `YYYY-MM-DD`. Mặc định: ngày hiện tại
- `mat_number` (int, optional) — Lọc theo thảm cụ thể
- `status` (string, optional) — `scheduled` | `ongoing` | `completed` | `all` (mặc định: `all`)

### Body
_(none)_

## Response

### Success (200)
```json
{
  "date": "2025-09-15",
  "tournament_id": 1,
  "mats": [
    {
      "mat_number": 1,
      "matches": [
        {
          "id": 10,
          "sequence": 1,
          "scheduled_at": "2025-09-15T08:00:00Z",
          "event_type": "sparring",
          "round": "quarter_final",
          "weight_class": 57,
          "status": "completed",
          "blue": { "student_id": 5, "name": "Nguyễn Văn A", "club": "CLB Q1" },
          "red":  { "student_id": 8, "name": "Trần Văn B",   "club": "CLB Q3" },
          "blue_score": 7,
          "red_score": 4,
          "winner_id": 5
        }
      ],
      "stats": {
        "total": 8,
        "completed": 3,
        "ongoing": 1,
        "scheduled": 4
      }
    }
  ]
}
```

### Error
- `401 UNAUTHORIZED`
- `404 TOURNAMENT_NOT_FOUND`

## Rules
- Nếu không có `date` → trả về ngày hiện tại (server timezone Asia/Ho_Chi_Minh)
- `sequence` là thứ tự trận trong ngày trên thảm đó (1-based)
- Sort: `mat_number ASC`, rồi `scheduled_at ASC`

## Used By Screens
- `03_tournament_management/schedule`
- `07_dashboard/dashboard` (subset: ongoing matches only)
