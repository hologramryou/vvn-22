# SCORING PANEL — Màn hình điều hành trận đối kháng

## Feature
04_sparring_scoring

## Description
Màn hình điều hành real-time cho admin. Quản lý vòng đấu, đồng hồ, điểm số, thẻ vàng.
Sau khi hoàn tất ghi nhận kết quả và đồng bộ lên Railway.

## Route
`/matches/:matchId/score?mode=control`

## Actors
- **admin** (role = "admin"): toàn quyền điều hành
- **referee**: redirect về `/matches/{id}/judge-panel`
- **viewer**: redirect về `/matches`

---

## Match Status & Phase

```
pending          → Chưa bắt đầu (mặc định)
ready            → Đủ điều kiện, chưa bắt đầu
ongoing/not_started  → Admin đã vào điều hành, đang cài đặt thời gian
ongoing/round_1      → Đang thi đấu hiệp 1
ongoing/break        → Giải lao giữa 2 hiệp
ongoing/round_2      → Đang thi đấu hiệp 2
ongoing/extra_time   → Hiệp phụ (hòa sau 2 hiệp)
ongoing/draw_pending → Hòa, chờ admin chọn người thắng thủ công
ongoing/finished     → Kết thúc, chờ xác nhận
completed/confirmed  → Đã xác nhận kết quả
```

---

## Luồng chuẩn

### Bước 1 — Vào điều hành
```
Admin click "Vào điều hành" từ MatchesPage hoặc TournamentsPage
→ GET /matches/{id} → load status, phase, round_duration_seconds, break_duration_seconds
→ Nếu status = pending/ready → FE tự động gọi REST PATCH /matches/{id}/start
  → BE: status = ongoing, match_phase = not_started
  → Hiện màn hình "Cài đặt thời gian"
→ Nếu status = ongoing, phase = not_started → Hiện màn hình "Cài đặt thời gian"
→ Nếu status = ongoing, phase = round_1/break/... → Hiện màn hình thi đấu
→ Nếu status = completed → Hiện kết quả (readonly)
```

### Bước 2 — Cài đặt thời gian (ongoing/not_started)
```
Admin chỉnh Hiệp (giây) và Giải lao (giây)
→ onBlur → PATCH /matches/{id}/config → lưu vào DB
→ Đồng hồ hiển thị giá trị mới ngay lập tức (onChange)
→ Đồng hồ sync về giá trị server sau mỗi lần DB update (useEffect)
```

### Bước 3 — Bắt đầu Hiệp 1
```
Admin click "Bắt đầu Hiệp 1"
→ WS admin_cmd: { type: "admin_cmd", cmd: "begin" }
→ BE: match_phase = round_1, status = ongoing
→ WS broadcast match_state → tất cả client cập nhật
→ Đồng hồ bắt đầu đếm ngược
```

### Bước 4 — Kết thúc trận
```
Kết thúc từng hiệp → REST end_round → phase chuyển (break / round_2 / extra_time / finished)
→ Kết quả xác nhận → REST confirm → completed/confirmed → đồng bộ Railway
```

---

## Cancel

### Điều kiện được cancel
| Status | Điều kiện bổ sung | Kết quả |
|---|---|---|
| `ongoing` | Không có | Reset về `ready/not_started`, xóa toàn bộ log |
| `completed` | Next match chưa `ongoing`/`completed` | Reset về `ready/not_started`, xóa log, undo bracket |
| `completed` | Next match đã `ongoing`/`completed` | ❌ `NEXT_MATCH_STARTED` |
| `pending`/`ready` | — | ❌ `INVALID_STATUS` (chưa có gì để cancel) |

### Sau khi cancel
- BE: `status = ready`, `match_phase = not_started`, xóa MatchScoreLog + BracketScoreEvent + ConsensusTurns
- WS broadcast `match_state` với phase = not_started
- FE: navigate về `/matches`

### 3 vị trí nút Cancel trên FE
1. `ScoringPage` — view **finished** (trận đã xong, chưa confirm)
2. `ScoringPage` — view **đang thi đấu** (header bar)
3. `MatchesPage` — modal chi tiết trận

---

## Reset toàn bộ

Dùng khi admin muốn bắt đầu lại trong khi trận đang `ongoing`.

```
REST PATCH /matches/{id}/reset
→ status = ongoing, phase = not_started, điểm về 0
→ Fetch Railway: lấy round_duration_seconds + break_duration_seconds
→ PATCH /matches/{id}/config với giá trị từ Railway
→ FE refresh → useEffect sync timer từ server
```

---

## Cài đặt thời gian

- Hiển thị khi `phase = not_started` và `role = admin`
- Input: **Hiệp (giây)** — min 30, max 600, step 10
- Input: **Giải lao (giây)** — min 10, max 300, step 5
- onChange → setTimerSeconds trực tiếp (preview ngay)
- onBlur → PATCH /matches/{id}/config nếu giá trị thay đổi so với DB
- Đồng hồ luôn đồng bộ về giá trị server sau khi match data refresh

---

## Business Rules

- **BR-SC-01**: Chỉ admin mới vào được ScoringPage (referee redirect sang judge-panel)
- **BR-SC-02**: Start match chỉ cần `pending`/`ready` — không bắt buộc trọng tài phải sẵn sàng trước
- **BR-SC-03**: Hiệp 1 chỉ bắt đầu khi admin bấm "Bắt đầu Hiệp 1" (WS begin) sau khi đã cài thời gian
- **BR-SC-04**: Cancel chỉ cho phép `ongoing` hoặc `completed` (next match chưa bắt đầu)
- **BR-SC-05**: Sau cancel/reset, toàn bộ log điểm bị xóa sạch
- **BR-SC-06**: Một sân chỉ có tối đa 1 trận `ongoing` tại một thời điểm (court conflict check)
- **BR-SC-07**: Đồng hồ timer lấy giá trị từ server (`match.round_duration_seconds`) — không dùng giá trị local state cũ

---

## APIs

| API | Mô tả |
|---|---|
| `GET /matches/{id}` | Load trận |
| `PATCH /matches/{id}/start` | `pending`/`ready` → `ongoing/not_started` |
| `PATCH /matches/{id}/config` | Lưu round/break duration |
| `WS admin_cmd: begin` | `ongoing/not_started` → `ongoing/round_1` |
| `PATCH /matches/{id}/end-round` | Kết thúc hiệp, chuyển phase |
| `POST /matches/{id}/result` | Ghi kết quả |
| `POST /matches/{id}/confirm` | Xác nhận → completed/confirmed |
| `PATCH /matches/{id}/cancel` | Hủy trận (ongoing/completed only) |
| `PATCH /matches/{id}/reset` | Reset về not_started (ongoing only) |

---

## Data Source
- `match_start_patch.md` — start match
- `match_detail_get.md` — load thông tin trận
- `match_result_post.md` — ghi nhận kết quả
