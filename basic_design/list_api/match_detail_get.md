# Match Detail — GET

## Method
GET

## Path
/matches/{match_id}

## Description
Lấy chi tiết một trận đấu theo ID. Dùng để load thông tin lên màn hình chấm điểm.

## Request

### Params
- `match_id` (integer, required): ID của BracketMatch

### Query
_(none)_

### Body
_(none)_

## Response

### Success (200)
```json
{
  "id": 42,
  "match_code": "Nam_PhongTrao_1A_45kg_A1",
  "round": 1,
  "match_number": 1,
  "court": "A",
  "player1_name": "Nguyễn Văn A",
  "player2_name": "Trần Văn B",
  "score1": null,
  "score2": null,
  "winner": null,
  "status": "ready",
  "is_bye": false,
  "weight_class_name": "45kg",
  "category": "phong_trao",
  "age_type_code": "1A",
  "gender": "M"
}
```

### Error
- 404 `NOT_FOUND`: Không tìm thấy trận đấu
- 401 `UNAUTHORIZED`: Chưa đăng nhập

## Rules
- Trả về đầy đủ thông tin để hiển thị màn hình chấm điểm mà không cần call thêm API khác
- Chỉ trả về BracketMatch (không áp dụng cho QuyenSlot)

## Used By Screens
- 04_sparring_scoring/scoring_panel
