# Match Start — PATCH

## Method
PATCH

## Path
/matches/{match_id}/start

## Description
Bắt đầu trận đấu: chuyển status từ `pending`/`ready` → `ongoing/not_started`.
Admin vào màn hình điều hành, cài đặt thời gian xong rồi mới bắt đầu Hiệp 1 qua WS.

## Request

### Params
- `match_id` (integer, required)

### Body
_(none)_

## Response

### Success (200)
```json
{
  "id": 42,
  "match_code": "Nam_PhongTrao_1A_45kg_A1",
  "status": "ongoing",
  "court": "A",
  "started_at": "2026-03-27T09:00:00"
}
```

### Error
- 400 `NOT_READY`: Status không phải `pending` hoặc `ready`
- 400 `MISSING_PLAYERS`: Chưa đủ VĐV (player1_name hoặc player2_name rỗng)
- 403 `FORBIDDEN`: Không phải admin
- 404 `NOT_FOUND`: Không tìm thấy trận
- 409 `COURT_BUSY`: Sân đang có trận/bài quyền đang diễn ra

## Rules
- Chỉ admin mới được gọi
- Cho phép start từ `pending` hoặc `ready` (đã bỏ logic chờ trọng tài sẵn sàng)
- Sau khi start: `status = ongoing`, `match_phase = not_started` — chưa vào Hiệp 1
- Hiệp 1 thực sự bắt đầu khi admin gửi WS command `begin`
- Một sân chỉ có tối đa 1 trận `ongoing` tại một thời điểm

## Used By Screens
- 04_sparring_scoring/scoring_panel
