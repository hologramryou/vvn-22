# Match Result — POST

## Method
POST

## Path
/matches/{match_id}/result

## Description
Ghi nhận kết quả trận đấu: điểm từng bên, người thắng. Chuyển status → `completed`.
Tự động cập nhật trận kế tiếp (next_match_id) với tên người thắng.
Endpoint đã tồn tại — cần bổ sung kiểm tra quyền.

## Request

### Params
- `match_id` (integer, required)

### Query
_(none)_

### Body
```json
{
  "winner": 1,
  "score1": 15,
  "score2": 9
}
```
- `winner` (integer, required): 1 hoặc 2
- `score1` (integer, required): Điểm của player1 (phía Đỏ), >= 0
- `score2` (integer, required): Điểm của player2 (phía Xanh), >= 0

## Response

### Success (200)
```json
{
  "id": 42,
  "winner": 1,
  "score1": 15,
  "score2": 9,
  "status": "completed"
}
```

### Error
- 400 `INVALID_WINNER`: winner không phải 1 hoặc 2
- 400 `NOT_ONGOING`: Trận không ở trạng thái `ongoing` (phải start trước)
- 403 `FORBIDDEN`: Không phải admin hoặc referee
- 404 `NOT_FOUND`: Không tìm thấy trận

## Rules
- Chỉ admin hoặc referee mới được gọi
- `score1`, `score2` >= 0
- Sau khi complete: next_match_id của trận này (nếu có) được cập nhật player tương ứng
- Không thể overwrite kết quả của trận đã `completed` (trừ admin reset)

## Used By Screens
- 04_sparring_scoring/scoring_panel
