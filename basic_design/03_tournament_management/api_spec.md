# API SPEC – TOURNAMENT SCHEDULE (VOVINAM)

> Dựa trên: `basic_design/tournament_schedule_update.md`, `basic_design/result/screen_spec.md`
> Ngày: 2026-03-26
> Phạm vi: Toàn bộ backend cho luồng Generate → Schedule → Thi đấu

---

## 1. Database Models (SQLAlchemy)

### 1.1 Bảng `tournaments` — thêm cột `status`

**Migration:** `005_add_tournament_status.py`

```sql
ALTER TABLE tournaments
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'DRAFT';

-- DRAFT | PUBLISHED | ONGOING | COMPLETED
```

**SQLAlchemy:**
```python
class Tournament(Base):
    ...
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
```

---

### 1.2 Bảng `bracket_matches` — cập nhật

**Migration:** `006_update_bracket_matches_schedule_fields.py`

```sql
-- Status enum: thêm 'ready'
-- (nếu dùng PostgreSQL enum thì ALTER TYPE, nếu VARCHAR thì chỉ cần cập nhật check constraint)

ALTER TABLE bracket_matches
  ADD COLUMN match_code     VARCHAR(10),
  ADD COLUMN court          VARCHAR(1),      -- 'A' hoặc 'B'
  ADD COLUMN schedule_order INT,             -- thứ tự trong lịch tổng hợp
  ADD COLUMN started_at     TIMESTAMP,
  ADD COLUMN finished_at    TIMESTAMP;

-- status VARCHAR hiện tại: 'pending' | 'ongoing' | 'completed'
-- → mở rộng thành: 'pending' | 'ready' | 'ongoing' | 'completed'

CREATE UNIQUE INDEX uq_bracket_match_code
  ON bracket_matches (tournament_weight_class_id, match_code);

CREATE INDEX idx_bracket_matches_court_status
  ON bracket_matches (court, status);
```

**SQLAlchemy:**
```python
class BracketMatch(Base):
    __tablename__ = "bracket_matches"

    id                      : Mapped[int]          = mapped_column(primary_key=True)
    tournament_weight_class_id: Mapped[int]        = mapped_column(ForeignKey("..."))
    round                   : Mapped[int]
    position                : Mapped[int]
    match_code              : Mapped[str | None]   = mapped_column(String(10))
    court                   : Mapped[str | None]   = mapped_column(String(1))   # 'A' | 'B'
    schedule_order          : Mapped[int | None]
    player1_id              : Mapped[int | None]   = mapped_column(ForeignKey("students.id"))
    player2_id              : Mapped[int | None]   = mapped_column(ForeignKey("students.id"))
    winner_id               : Mapped[int | None]   = mapped_column(ForeignKey("students.id"))
    score1                  : Mapped[int | None]
    score2                  : Mapped[int | None]
    status                  : Mapped[str]          = mapped_column(String(20), default="pending")
    # 'pending' | 'ready' | 'ongoing' | 'completed'
    is_bye                  : Mapped[bool]         = mapped_column(default=False)
    next_match_id           : Mapped[int | None]   = mapped_column(ForeignKey("bracket_matches.id"))
    started_at              : Mapped[datetime | None]
    finished_at             : Mapped[datetime | None]
```

---

### 1.3 Bảng `quyen_slots` — MỚI

Lưu từng lượt thi đấu Quyền (mỗi VĐV = 1 slot).

**Migration:** `007_create_quyen_slots.py`

```sql
CREATE TABLE quyen_slots (
  id              SERIAL PRIMARY KEY,
  tournament_id   INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES students(id),
  content_name    VARCHAR(100) NOT NULL,   -- Tên bài quyền / nội dung
  weight_class_id INT REFERENCES weight_classes(id),
  court           VARCHAR(1),              -- 'A' | 'B'
  schedule_order  INT,
  status          VARCHAR(20) NOT NULL DEFAULT 'ready',
  -- 'ready' | 'ongoing' | 'completed'
  started_at      TIMESTAMP,
  finished_at     TIMESTAMP,

  UNIQUE (tournament_id, student_id, content_name)
);

CREATE INDEX idx_quyen_slots_tournament ON quyen_slots (tournament_id);
CREATE INDEX idx_quyen_slots_court_status ON quyen_slots (court, status);
```

**SQLAlchemy:**
```python
class QuyenSlot(Base):
    __tablename__ = "quyen_slots"

    id             : Mapped[int]        = mapped_column(primary_key=True)
    tournament_id  : Mapped[int]        = mapped_column(ForeignKey("tournaments.id"))
    student_id     : Mapped[int]        = mapped_column(ForeignKey("students.id"))
    content_name   : Mapped[str]        = mapped_column(String(100))
    weight_class_id: Mapped[int | None] = mapped_column(ForeignKey("weight_classes.id"))
    court          : Mapped[str | None] = mapped_column(String(1))
    schedule_order : Mapped[int | None]
    status         : Mapped[str]        = mapped_column(String(20), default="ready")
    started_at     : Mapped[datetime | None]
    finished_at    : Mapped[datetime | None]
```

---

## 2. Pydantic Schemas

### 2.1 Tournament

```python
class TournamentStatusUpdateIn(BaseModel):
    pass  # chỉ dùng endpoint PATCH /tournaments/{id}/publish, không cần body

class TournamentOut(BaseModel):
    id: int
    name: str
    status: Literal["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED"]
    # ... các field hiện có
```

---

### 2.2 BracketMatch

```python
class BracketMatchOut(BaseModel):
    id: int
    match_code: str | None
    round: int
    round_label: str                  # "Vòng 1", "Tứ kết", "Bán kết", "Chung kết"
    position: int
    court: str | None                 # "A" | "B"
    schedule_order: int | None
    player1_id: int | None
    player1_name: str | None          # None → hiển thị "TBD"
    player2_id: int | None
    player2_name: str | None          # None → hiển thị "TBD"; is_bye=True → hiển thị "BYE"
    winner_id: int | None
    winner_name: str | None
    score1: int | None
    score2: int | None
    status: Literal["pending", "ready", "ongoing", "completed"]
    is_bye: bool
    next_match_id: int | None
    next_match_code: str | None
    started_at: datetime | None
    finished_at: datetime | None
```

```python
class MatchStartIn(BaseModel):
    pass  # endpoint PATCH /matches/{id}/start không cần body

class MatchResultIn(BaseModel):
    winner_id: int                    # bắt buộc
    score1: int | None = None         # điểm player1, tùy chọn
    score2: int | None = None         # điểm player2, tùy chọn

    @model_validator(mode="after")
    def scores_non_negative(self):
        if self.score1 is not None and self.score1 < 0:
            raise ValueError("score1 phải >= 0")
        if self.score2 is not None and self.score2 < 0:
            raise ValueError("score2 phải >= 0")
        return self
```

---

### 2.3 QuyenSlot

```python
class QuyenSlotOut(BaseModel):
    id: int
    tournament_id: int
    student_id: int
    player_name: str
    club_name: str | None
    content_name: str
    weight_class_id: int | None
    weight_class_name: str | None
    court: str | None                 # "A" | "B"
    schedule_order: int | None
    status: Literal["ready", "ongoing", "completed"]
    started_at: datetime | None
    finished_at: datetime | None

class QuyenSlotResultIn(BaseModel):
    pass  # chỉ cần xác nhận hoàn thành, không có điểm số đối kháng
```

---

### 2.4 Schedule tổng hợp

```python
class ScheduleSummary(BaseModel):
    quyen_count: int
    doi_khang_count: int
    ready_count: int
    ongoing_count: int
    completed_count: int

class TournamentScheduleOut(BaseModel):
    tournament_id: int
    tournament_name: str
    tournament_status: str
    summary: ScheduleSummary
    quyen_slots: list[QuyenSlotOut]          # đã sắp xếp theo schedule_order
    bracket_matches: list[BracketMatchOut]   # đã sắp xếp theo schedule_order
```

---

## 3. API Endpoints

### 3.1 Generate Matches

#### `POST /tournaments/{tournament_id}/generate-matches`

Tạo toàn bộ bracket matches (Đối kháng) + quyen slots (Quyền) cho giải đấu.
Chỉ khả dụng khi `tournament.status == "DRAFT"`.

> Nếu đã có matches trước đó → xóa toàn bộ và tạo lại.
> **Điều kiện chặn:** Không được regenerate nếu có match nào đang `ongoing` hoặc `completed`.

**Request:**
```http
POST /tournaments/{tournament_id}/generate-matches
Authorization: Bearer <token>
```

**Logic backend:**

```python
# 1. Kiểm tra tournament.status == "DRAFT"
# 2. Kiểm tra không có match ongoing/completed
# 3. Xóa toàn bộ bracket_matches + quyen_slots cũ của tournament này
# 4. Với mỗi hạng cân đối kháng:
#    a. Lấy danh sách VĐV đăng ký hạng cân đó
#    b. Random shuffle danh sách
#    c. Tính slots = 2^⌈log2(n)⌉
#    d. Số BYE = slots - n
#    e. Tạo cây bracket đệ quy (full tree):
#       - Round 1: gán VĐV vào position; BYE vào vị trí thừa
#       - Round 2+: player1_id=None, player2_id=None, status='pending'
#    f. Gán match_code: round 1 → A1/A2..., round 2 → B1/B2...
#    g. BYE match: status='completed', winner=VĐV được đặc cách
#    h. Round 1 non-BYE match: status='ready'
#    i. Gán next_match_id cho từng match
#
# 5. Với mỗi VĐV đăng ký Quyền:
#    - Tạo 1 QuyenSlot per (student, content_name)
#    - status='ready'
```

**Response `200`:**
```json
{
  "tournament_id": 1,
  "generated": {
    "bracket_matches": 31,
    "quyen_slots": 50,
    "bye_matches": 3
  }
}
```

**Errors:**
- `404` — tournament không tồn tại
- `403` — không phải admin/referee
- `409` — `tournament.status != "DRAFT"` → `"Không thể generate khi giải đấu đã Published"`
- `409` — có match đang `ongoing`/`completed` → `"Có trận đang diễn ra, không thể regenerate"`

---

### 3.2 Generate Schedule

#### `POST /tournaments/{tournament_id}/generate-schedule`

Gán `court` và `schedule_order` cho tất cả matches + quyen_slots.
Phải chạy **sau** `generate-matches`. Chỉ khả dụng khi `DRAFT`.

**Request:**
```http
POST /tournaments/{tournament_id}/generate-schedule
Authorization: Bearer <token>
```

**Logic backend:**

```python
# 1. Kiểm tra tournament.status == "DRAFT"
# 2. Kiểm tra đã có matches (nếu chưa → lỗi)
# 3. Xếp Quyền trước:
#    - Lấy tất cả quyen_slots theo thứ tự đăng ký
#    - Phân bổ luân phiên: index chẵn → court='A', index lẻ → court='B'
#    - Gán schedule_order = 1, 2, 3, ...
#
# 4. Xếp Đối kháng sau:
#    - Lấy tất cả bracket_matches, sắp xếp theo (round ASC, position ASC)
#    - BYE matches: bỏ qua (không cần hiển thị trong schedule thực)
#    - Phân bổ luân phiên: court='A'/'B'
#    - Gán schedule_order tiếp nối sau Quyền
#    - Match pending (chưa có VĐV): vẫn gán schedule_order (giữ chỗ)
#
# 5. Lưu court + schedule_order vào DB
```

**Response `200`:**
```json
{
  "tournament_id": 1,
  "scheduled": {
    "quyen_slots": 50,
    "bracket_matches": 28,
    "court_a_count": 39,
    "court_b_count": 39
  }
}
```

**Errors:**
- `409` — chưa generate matches → `"Vui lòng generate matches trước"`
- `409` — tournament không ở trạng thái `DRAFT`

---

### 3.3 Publish Tournament

#### `PATCH /tournaments/{tournament_id}/publish`

Chuyển `tournament.status: DRAFT → PUBLISHED`.
Sau đó **không thể** regenerate matches hay schedule.

**Request:**
```http
PATCH /tournaments/{tournament_id}/publish
Authorization: Bearer <token>
```

**Validation:**
- Phải có matches đã generate
- Phải có schedule đã generate (ít nhất 1 match có `court` không null)

**Response `200`:**
```json
{
  "id": 1,
  "name": "Giải Vovinam 2026",
  "status": "PUBLISHED"
}
```

**Errors:**
- `409` — chưa generate schedule → `"Vui lòng generate schedule trước khi publish"`
- `409` — tournament không ở `DRAFT`

---

### 3.4 Lấy lịch thi đấu tổng hợp

#### `GET /tournaments/{tournament_id}/schedule`

Trả về toàn bộ lịch (Quyền + Đối kháng) đã sắp xếp theo `schedule_order`.

**Request:**
```http
GET /tournaments/{tournament_id}/schedule
```

**Query params (tùy chọn):**
| Param | Type | Mô tả |
|-------|------|-------|
| `type` | `"quyen"` \| `"doi_khang"` | Lọc theo loại nội dung |
| `court` | `"A"` \| `"B"` | Lọc theo sân |
| `status` | `string` | Lọc theo trạng thái |

**Response `200`:**
```json
{
  "tournament_id": 1,
  "tournament_name": "Giải Vovinam 2026",
  "tournament_status": "PUBLISHED",
  "summary": {
    "quyen_count": 50,
    "doi_khang_count": 28,
    "ready_count": 53,
    "ongoing_count": 2,
    "completed_count": 23
  },
  "quyen_slots": [
    {
      "id": 1,
      "student_id": 10,
      "player_name": "Nguyễn Văn A",
      "club_name": "CLB Hà Nội",
      "content_name": "Quyền Tay Không",
      "weight_class_id": 3,
      "weight_class_name": "Hạng 55kg Nam",
      "court": "A",
      "schedule_order": 1,
      "status": "completed",
      "started_at": "2026-03-26T08:00:00",
      "finished_at": "2026-03-26T08:05:00"
    }
  ],
  "bracket_matches": [
    {
      "id": 1,
      "match_code": "A1",
      "round": 1,
      "round_label": "Vòng 1",
      "position": 1,
      "court": "A",
      "schedule_order": 51,
      "player1_id": 5,
      "player1_name": "Lê Văn C",
      "player2_id": 8,
      "player2_name": "Phạm Văn D",
      "winner_id": null,
      "winner_name": null,
      "score1": null,
      "score2": null,
      "status": "ready",
      "is_bye": false,
      "next_match_id": 9,
      "next_match_code": "B1",
      "started_at": null,
      "finished_at": null
    },
    {
      "id": 2,
      "match_code": "B1",
      "round": 2,
      "round_label": "Bán kết",
      "position": 1,
      "court": "A",
      "schedule_order": 55,
      "player1_id": null,
      "player1_name": null,
      "player2_id": null,
      "player2_name": null,
      "winner_id": null,
      "winner_name": null,
      "score1": null,
      "score2": null,
      "status": "pending",
      "is_bye": false,
      "next_match_id": null,
      "next_match_code": null,
      "started_at": null,
      "finished_at": null
    }
  ]
}
```

**Errors:**
- `404` — tournament không tồn tại
- `400` — chưa có schedule (`"Lịch thi đấu chưa được tạo"`)

---

### 3.5 Bắt đầu trận đấu

#### `PATCH /matches/{match_id}/start`

Chuyển match `ready → ongoing`. Chỉ referee.

**Request:**
```http
PATCH /matches/{match_id}/start
Authorization: Bearer <token>
```

**Validation (theo thứ tự):**
1. Match phải ở trạng thái `ready`
2. `player1_id` và `player2_id` phải không null (trừ `is_bye`)
3. Sân của match (`court`) không được có match `ongoing` khác

**Logic:**
```python
# Kiểm tra court conflict:
existing_ongoing = await db.scalar(
    select(BracketMatch).where(
        BracketMatch.court == match.court,
        BracketMatch.status == "ongoing",
        BracketMatch.id != match_id
    )
)
if existing_ongoing:
    raise HTTPException(409, f"Sân {match.court} đang có trận diễn ra ({existing_ongoing.match_code})")

# Cập nhật:
match.status = "ongoing"
match.started_at = datetime.utcnow()
```

**Response `200`:**
```json
{
  "id": 1,
  "match_code": "A1",
  "status": "ongoing",
  "court": "A",
  "started_at": "2026-03-26T09:00:00"
}
```

**Errors:**
- `404` — match không tồn tại
- `400` — match không ở trạng thái `ready` → `"Trận phải ở trạng thái 'sẵn sàng' mới có thể bắt đầu"`
- `400` — thiếu VĐV → `"Trận chưa đủ vận động viên"`
- `409` — sân đang bận → `"Sân A đang có trận diễn ra (A2)"`
- `403` — không phải referee

---

### 3.6 Bắt đầu lượt thi Quyền

#### `PATCH /quyen-slots/{slot_id}/start`

Chuyển slot `ready → ongoing`. Chỉ referee.

**Validation:**
1. Slot phải ở `ready`
2. Sân không có slot/match `ongoing` khác

**Response `200`:**
```json
{
  "id": 1,
  "player_name": "Nguyễn Văn A",
  "content_name": "Quyền Tay Không",
  "court": "A",
  "status": "ongoing",
  "started_at": "2026-03-26T08:00:00"
}
```

**Errors:** tương tự `PATCH /matches/{id}/start`

---

### 3.7 Nhập kết quả trận đấu (Đối kháng)

#### `POST /matches/{match_id}/result`

Nhập kết quả, chuyển `ongoing → completed`. Chỉ referee.

**Request:**
```http
POST /matches/{match_id}/result
Authorization: Bearer <token>
Content-Type: application/json

{
  "winner_id": 5,
  "score1": 3,
  "score2": 1
}
```

**Logic backend:**
```python
# 1. Validate: match.status == "ongoing"
# 2. Validate: winner_id phải là player1_id hoặc player2_id
# 3. Cập nhật match:
#    - status = "completed"
#    - winner_id = winner_id
#    - score1, score2 = body values
#    - finished_at = now()
#
# 4. Propagate winner vào nextMatch:
#    next_match = match.next_match
#    if next_match:
#        # Xác định position trong next_match
#        if match.position % 2 == 1:  # position lẻ → player1 của next_match
#            next_match.player1_id = winner_id
#        else:                        # position chẵn → player2 của next_match
#            next_match.player2_id = winner_id
#
#        # Kiểm tra next_match có đủ 2 người chưa
#        if next_match.player1_id and next_match.player2_id:
#            next_match.status = "ready"
```

**Response `200`:**
```json
{
  "id": 1,
  "match_code": "A1",
  "status": "completed",
  "winner_id": 5,
  "winner_name": "Lê Văn C",
  "score1": 3,
  "score2": 1,
  "finished_at": "2026-03-26T09:10:00",
  "next_match_code": "B1",
  "next_match_status": "ready"
}
```

**Errors:**
- `400` — match không `ongoing` → `"Trận phải đang diễn ra mới nhập kết quả"`
- `400` — `winner_id` không thuộc trận → `"Người thắng không hợp lệ"`
- `403` — không phải referee

---

### 3.8 Hoàn thành lượt thi Quyền

#### `PATCH /quyen-slots/{slot_id}/complete`

Chuyển slot `ongoing → completed`. Không có điểm số. Chỉ referee.

**Request:**
```http
PATCH /quyen-slots/{slot_id}/complete
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "id": 1,
  "player_name": "Nguyễn Văn A",
  "content_name": "Quyền Tay Không",
  "court": "A",
  "status": "completed",
  "started_at": "2026-03-26T08:00:00",
  "finished_at": "2026-03-26T08:05:00"
}
```

---

### 3.9 Chi tiết một trận đấu

#### `GET /matches/{match_id}`

```http
GET /matches/{match_id}
```

**Response `200`:** xem schema `BracketMatchOut` ở mục 2.2 — đầy đủ tất cả fields.

---

### 3.10 Schedule theo hạng cân (bracket view)

#### `GET /weight-classes/{wc_id}/schedule`

Giữ nguyên, cập nhật response thêm `court`, `schedule_order`, và status `ready`.

---

## 4. Ràng buộc Sân — Chi tiết

```
Tại một thời điểm:
  count(ongoing matches với court='A') ≤ 1
  count(ongoing matches với court='B') ≤ 1

Áp dụng cho cả:
  - bracket_matches (đối kháng)
  - quyen_slots (quyền)
  → check cả 2 bảng khi validate
```

**Query check court conflict (Python):**
```python
from sqlalchemy import select, union_all, literal

async def court_has_ongoing(db: AsyncSession, court: str, exclude_id: int | None = None) -> bool:
    # Check bracket_matches
    q1 = select(BracketMatch.id).where(
        BracketMatch.court == court,
        BracketMatch.status == "ongoing",
    )
    # Check quyen_slots
    q2 = select(QuyenSlot.id).where(
        QuyenSlot.court == court,
        QuyenSlot.status == "ongoing",
    )
    result = await db.execute(union_all(q1, q2))
    return result.first() is not None
```

---

## 5. match_code Generation Logic

```python
def generate_match_code(round: int, position: int) -> str:
    prefix = chr(64 + round)   # round 1 → 'A', round 2 → 'B', ...
    return f"{prefix}{position}"

# Ví dụ:
# round=1, position=1 → "A1"
# round=1, position=2 → "A2"
# round=2, position=1 → "B1"
# round=3, position=1 → "C1" (Chung kết nếu tổng 3 vòng)
```

---

## 6. round_label Logic

```python
def get_round_label(round: int, total_rounds: int) -> str:
    if round == total_rounds:
        return "Chung kết"
    elif round == total_rounds - 1:
        return "Bán kết"
    elif round == total_rounds - 2:
        return "Tứ kết"
    else:
        return f"Vòng {round}"

# total_rounds = ceil(log2(n_players))
```

---

## 7. Bracket Generation — Pseudocode

```python
import math, random

def generate_bracket(players: list[Student], tournament_wc_id: int) -> list[BracketMatch]:
    n = len(players)
    if n < 2:
        raise ValueError("Tối thiểu 2 vận động viên")

    slots = 2 ** math.ceil(math.log2(n))
    total_rounds = int(math.log2(slots))
    byes = slots - n

    random.shuffle(players)
    # Thêm BYE vào cuối
    seeded = players + [None] * byes

    matches = []

    # Round 1
    round1 = []
    for i in range(0, slots, 2):
        p1 = seeded[i]
        p2 = seeded[i + 1]
        pos = i // 2 + 1
        is_bye = (p2 is None)
        status = "completed" if is_bye else "ready"
        winner_id = p1.id if is_bye else None
        m = BracketMatch(
            tournament_weight_class_id=tournament_wc_id,
            round=1, position=pos,
            match_code=generate_match_code(1, pos),
            player1_id=p1.id if p1 else None,
            player2_id=p2.id if p2 else None,
            winner_id=winner_id,
            is_bye=is_bye,
            status=status,
        )
        matches.append(m)
        round1.append(m)

    # Round 2 → final
    prev_round = round1
    for r in range(2, total_rounds + 1):
        curr_round = []
        for i in range(0, len(prev_round), 2):
            pos = i // 2 + 1
            m = BracketMatch(
                tournament_weight_class_id=tournament_wc_id,
                round=r, position=pos,
                match_code=generate_match_code(r, pos),
                status="pending",
            )
            # Gán next_match sau khi flush để có ID
            matches.append(m)
            curr_round.append(m)

        # Gán next_match_id cho prev_round
        for i, prev_m in enumerate(prev_round):
            prev_m.next_match_id = curr_round[i // 2].id  # set sau flush

        prev_round = curr_round

    return matches
```

---

## 8. Phân quyền

| Endpoint | Viewer | Referee | Admin |
|----------|--------|---------|-------|
| `GET /tournaments/{id}/schedule` | ✅ | ✅ | ✅ |
| `GET /matches/{id}` | ✅ | ✅ | ✅ |
| `GET /weight-classes/{wc_id}/schedule` | ✅ | ✅ | ✅ |
| `POST /tournaments/{id}/generate-matches` | ❌ | ✅ | ✅ |
| `POST /tournaments/{id}/generate-schedule` | ❌ | ✅ | ✅ |
| `PATCH /tournaments/{id}/publish` | ❌ | ❌ | ✅ |
| `PATCH /matches/{id}/start` | ❌ | ✅ | ✅ |
| `POST /matches/{id}/result` | ❌ | ✅ | ✅ |
| `PATCH /quyen-slots/{id}/start` | ❌ | ✅ | ✅ |
| `PATCH /quyen-slots/{id}/complete` | ❌ | ✅ | ✅ |

---

## 9. Tóm tắt thay đổi cần implement

### Migrations

| # | File | Nội dung |
|---|------|---------|
| 1 | `005_add_tournament_status.py` | Cột `status` vào `tournaments` |
| 2 | `006_update_bracket_matches_schedule_fields.py` | `match_code`, `court`, `schedule_order`, `started_at`, `finished_at`; thêm `ready` vào status enum |
| 3 | `007_create_quyen_slots.py` | Bảng `quyen_slots` mới |

### Backend (Python/FastAPI)

| # | Layer | Việc cần làm |
|---|-------|-------------|
| 1 | `models/tournament.py` | Thêm field `status` |
| 2 | `models/tournament.py` | Thêm model `QuyenSlot` |
| 3 | `models/tournament.py` | Cập nhật `BracketMatch` (thêm `court`, `schedule_order`, `match_code`, `started_at`, `finished_at`) |
| 4 | `schemas/tournament.py` | Thêm `BracketMatchOut` đầy đủ, `QuyenSlotOut`, `MatchResultIn`, `TournamentScheduleOut`, `ScheduleSummary` |
| 5 | `repositories/tournament_repo.py` | `generate_matches()` — tạo bracket + quyen_slots |
| 6 | `repositories/tournament_repo.py` | `generate_schedule()` — gán court + order |
| 7 | `repositories/tournament_repo.py` | `start_match()` — validate + court conflict check |
| 8 | `repositories/tournament_repo.py` | `submit_result()` — nhập kết quả + propagate winner |
| 9 | `repositories/tournament_repo.py` | `get_full_schedule()` — query tổng hợp 2 bảng |
| 10 | `routers/tournaments.py` | `POST /generate-matches` |
| 11 | `routers/tournaments.py` | `POST /generate-schedule` |
| 12 | `routers/tournaments.py` | `PATCH /publish` |
| 13 | `routers/tournaments.py` | `GET /schedule` |
| 14 | `routers/tournaments.py` | `PATCH /matches/{id}/start` |
| 15 | `routers/tournaments.py` | `POST /matches/{id}/result` (cập nhật) |
| 16 | `routers/tournaments.py` | `PATCH /quyen-slots/{id}/start` |
| 17 | `routers/tournaments.py` | `PATCH /quyen-slots/{id}/complete` |

### Frontend (React/TypeScript)

| # | File | Việc cần làm |
|---|------|-------------|
| 1 | `types/tournament.ts` | Thêm `QuyenSlot`, `TournamentSchedule`, `MatchStatus = "pending" \| "ready" \| "ongoing" \| "completed"` |
| 2 | `api/tournaments.ts` | Thêm các hàm gọi API mới (generate, schedule, start, result) |
| 3 | `hooks/useSchedule.ts` | TanStack Query hook cho schedule tổng hợp |
| 4 | `pages/MatchesPage.tsx` | Implement lịch tổng hợp 2 sân (xem screen_spec) |
| 5 | `components/tournament/QuyenScheduleTable.tsx` | Bảng Quyền |
| 6 | `components/tournament/MatchScheduleTable.tsx` | Bảng Đối kháng |
| 7 | `components/tournament/MatchActionModal.tsx` | Modal thao tác |
| 8 | `pages/TournamentsPage.tsx` | Thêm nút Generate + Publish; cập nhật `MatchBox` |

