# Medal Tally — GET

## Method
GET

## Path
/tournaments/{tournament_id}/medals

## Description
Trả về bảng tổng sắp huy chương của giải, thống kê theo đơn vị (CLB hoặc tỉnh thành). Kèm chi tiết từng VĐV giành huy chương.

## Request

### Params
- `tournament_id` (int, required)

### Query
- `group_by` (string, optional) — `club` (mặc định) | `province`

### Body
_(none)_

## Response

### Success (200)
```json
{
  "tournament_id": 1,
  "group_by": "club",
  "updated_at": "2025-09-15T10:30:00Z",
  "tally": [
    {
      "rank": 1,
      "unit_id": 3,
      "unit_name": "CLB Vovinam Quận 1",
      "gold": 3,
      "silver": 2,
      "bronze": 1,
      "total": 6,
      "athletes": [
        {
          "student_id": 5,
          "name": "Nguyễn Văn A",
          "medal": "gold",
          "event_type": "sparring",
          "weight_class": 57,
          "gender": "M"
        }
      ]
    }
  ]
}
```

### Error
- `401 UNAUTHORIZED`
- `404 TOURNAMENT_NOT_FOUND`

## Rules
- **HCV (gold):** winner của trận `final` (1 VĐV/đội)
- **HCB (silver):** loser của trận `final` (1 VĐV/đội)
- **HCĐ (bronze):** 2 loser của trận `semi_final` (có thể 2 HCĐ / nội dung)
- Sắp xếp: gold DESC → silver DESC → bronze DESC → unit_name ASC
- `group_by = province` → nhóm theo `clubs.province_id`, join tên tỉnh từ bảng `provinces`

## Used By Screens
- `03_tournament_management/medal_tally`
