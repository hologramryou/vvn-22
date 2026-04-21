# AGENT IMPLEMENTATION SPEC — VOVINAM TOURNAMENT SCHEDULE

> Đây là spec dành cho AI agent thực thi. Đọc toàn bộ trước khi bắt đầu.
> Thực hiện **tuần tự theo thứ tự TASK**. Mỗi TASK phụ thuộc TASK trước.

---

## CONTEXT — HIỆN TRẠNG CODE

### Các file cần đọc trước khi implement:
- `backend/app/models/tournament.py` — model hiện tại
- `backend/app/schemas/tournament.py` — schema hiện tại
- `backend/app/repositories/tournament_repo.py` — repo hiện tại
- `backend/app/routers/tournaments.py` — router hiện tại

### Quy ước code hiện tại (PHẢI GIỮ):
- SQLAlchemy dùng `Column()` style (không dùng `Mapped[]`)
- Players lưu là **string tên** (không phải FK student)
- `winner` trong `BracketMatch` là `Integer` giá trị 1 hoặc 2
- Field tên là `match_number` (không phải `position`)
- Async/await toàn bộ, dùng `AsyncSession`
- Router không chứa business logic — chỉ gọi repo

### Những thứ KHÔNG được thay đổi:
- `GET /tournaments/structure`
- `GET /weight-classes/{wc_id}/bracket`
- `POST /weight-classes/{wc_id}/generate` (giữ nguyên, chỉ mở rộng)
- Schema `BracketOut`, `WeightClassItem`, `TournamentStructure`

---

## BUSINESS RULES (đọc kỹ)

### Tournament Status
```
DRAFT → PUBLISHED → ONGOING → COMPLETED
```
- Chỉ `DRAFT` mới cho phép generate/regenerate
- `PUBLISHED` trở đi: khoá toàn bộ generate

### Match Status (bracket_matches)
```
pending → ready → ongoing → completed
```
- `pending`: match chưa đủ 2 VĐV (vòng 2+ chưa có kết quả feed vào)
- `ready`: đủ 2 VĐV, có thể bắt đầu
- `ongoing`: đang thi đấu
- `completed`: có kết quả

### QuyenSlot Status
```
ready → ongoing → completed
```
- Tất cả slot tạo ra đều bắt đầu ở `ready` (không có prerequisite)

### BYE match
- `player2_name = "BYE"`, `is_bye = True`
- `status = "completed"` ngay khi tạo, `winner = 1`
- Không có action (không start, không nhập kết quả)

### Ràng buộc sân (CRITICAL)
- Mỗi sân (`court A` hoặc `court B`) tối đa **1** item `ongoing` tại một thời điểm
- Check cả `bracket_matches` lẫn `quyen_slots` khi validate

### Propagate winner (sau khi nhập kết quả)
- Xác định winner_name từ `winner == 1 → player1_name` hoặc `winner == 2 → player2_name`
- Điền vào `next_match`: `match_number % 2 == 1 → player1_name`, chẵn → `player2_name`
- Nếu `next_match.player1_name` và `next_match.player2_name` đều khác null: set `next_match.status = "ready"`

### Phân biệt Quyền vs Đối kháng
- `TournamentWeightClass` có `age_type_code`
- Quy tắc: nếu `age_type_code == "5"` → đây là nội dung **Quyền**
- Còn lại → **Đối kháng**

### Generate bracket — dynamic (không hardcode 16)
```python
import math, random
n = len(players)              # số VĐV thực
slots = 2 ** math.ceil(math.log2(n)) if n > 1 else 2
total_rounds = int(math.log2(slots))
byes = slots - n
```

### match_code
```python
# round 1 → 'A', round 2 → 'B', ...
prefix = chr(64 + round_number)
code = f"{prefix}{match_number}"  # "A1", "A2", "B1", "C1"...
```

### round_label
```python
def get_round_label(round: int, total_rounds: int) -> str:
    if round == total_rounds:     return "Chung kết"
    if round == total_rounds - 1: return "Bán kết"
    if round == total_rounds - 2: return "Tứ kết"
    return f"Vòng {round}"
```

---

## TASK 1 — MIGRATION

**File:** `backend/alembic/versions/005_tournament_schedule_fields.py`

```python
"""tournament schedule fields

Revision ID: 005
Revises: 004
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'  # đổi thành revision ID thực tế của migration trước

def upgrade():
    # 1. Tournament status: đổi default DRAFT, migrate "active" → "DRAFT"
    op.execute("UPDATE tournaments SET status = 'DRAFT' WHERE status = 'active'")
    op.alter_column('tournaments', 'status', server_default='DRAFT')

    # 2. bracket_matches: thêm các cột mới
    op.add_column('bracket_matches', sa.Column('match_code', sa.String(10), nullable=True))
    op.add_column('bracket_matches', sa.Column('court', sa.String(1), nullable=True))
    op.add_column('bracket_matches', sa.Column('schedule_order', sa.Integer(), nullable=True))
    op.add_column('bracket_matches', sa.Column('is_bye', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('bracket_matches', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bracket_matches', sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))
    # status vẫn là VARCHAR — thêm 'ready' vào allowed values (không cần thay đổi DB vì là VARCHAR)

    # 3. Tạo bảng quyen_slots
    op.create_table(
        'quyen_slots',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tournament_id', sa.Integer(), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('weight_class_id', sa.Integer(), sa.ForeignKey('tournament_weight_classes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('player_name', sa.String(150), nullable=False),
        sa.Column('content_name', sa.String(100), nullable=False),  # age_type label, e.g. "18–35 tuổi (quyền)"
        sa.Column('court', sa.String(1), nullable=True),
        sa.Column('schedule_order', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='ready', nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_quyen_slots_tournament', 'quyen_slots', ['tournament_id'])
    op.create_index('idx_quyen_slots_court_status', 'quyen_slots', ['court', 'status'])
    op.create_index('idx_bracket_matches_court_status', 'bracket_matches', ['court', 'status'])

def downgrade():
    op.drop_index('idx_bracket_matches_court_status', 'bracket_matches')
    op.drop_index('idx_quyen_slots_court_status', 'quyen_slots')
    op.drop_index('idx_quyen_slots_tournament', 'quyen_slots')
    op.drop_table('quyen_slots')
    op.drop_column('bracket_matches', 'finished_at')
    op.drop_column('bracket_matches', 'started_at')
    op.drop_column('bracket_matches', 'is_bye')
    op.drop_column('bracket_matches', 'schedule_order')
    op.drop_column('bracket_matches', 'court')
    op.drop_column('bracket_matches', 'match_code')
```

**Chạy migration:**
```bash
docker compose exec api alembic upgrade head
```

---

## TASK 2 — MODELS

**File:** `backend/app/models/tournament.py` — **THAY THẾ TOÀN BỘ**

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func
from sqlalchemy.dialects.postgresql import ARRAY
from app.core.database import Base


class Tournament(Base):
    __tablename__ = "tournaments"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(200), nullable=False)
    status     = Column(String(20), nullable=False, server_default="DRAFT")
    # DRAFT | PUBLISHED | ONGOING | COMPLETED
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TournamentWeightClass(Base):
    __tablename__ = "tournament_weight_classes"
    id                = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id     = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    category          = Column(String(20), nullable=False)       # phong_trao | pho_thong
    age_type_code     = Column(String(5),  nullable=False)       # 1A,1B,2,3,4,5 ...
    weight_class_name = Column(String(20), nullable=False)
    total_players     = Column(Integer, nullable=False, server_default="16")
    bracket_status    = Column(String(20), nullable=False, server_default="NOT_GENERATED")
    players           = Column(ARRAY(String), nullable=True)     # list of player names


class BracketMatch(Base):
    __tablename__ = "bracket_matches"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    weight_class_id = Column(Integer, ForeignKey("tournament_weight_classes.id", ondelete="CASCADE"), nullable=False)
    round          = Column(Integer, nullable=False)
    match_number   = Column(Integer, nullable=False)
    match_code     = Column(String(10), nullable=True)           # "A1", "B2", "C1"
    court          = Column(String(1), nullable=True)            # "A" | "B"
    schedule_order = Column(Integer, nullable=True)
    player1_name   = Column(String(150), nullable=True)          # None = TBD
    player2_name   = Column(String(150), nullable=True)          # None = TBD | "BYE"
    score1         = Column(Integer, nullable=True)
    score2         = Column(Integer, nullable=True)
    winner         = Column(Integer, nullable=True)              # 1 | 2
    status         = Column(String(20), nullable=False, server_default="pending")
    # pending | ready | ongoing | completed
    is_bye         = Column(Boolean, nullable=False, server_default="false")
    next_match_id  = Column(Integer, ForeignKey("bracket_matches.id"), nullable=True)
    started_at     = Column(DateTime(timezone=True), nullable=True)
    finished_at    = Column(DateTime(timezone=True), nullable=True)


class QuyenSlot(Base):
    __tablename__ = "quyen_slots"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    tournament_id  = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    weight_class_id = Column(Integer, ForeignKey("tournament_weight_classes.id", ondelete="CASCADE"), nullable=False)
    player_name    = Column(String(150), nullable=False)
    content_name   = Column(String(100), nullable=False)         # label của age_type
    court          = Column(String(1), nullable=True)            # "A" | "B"
    schedule_order = Column(Integer, nullable=True)
    status         = Column(String(20), nullable=False, server_default="ready")
    # ready | ongoing | completed
    started_at     = Column(DateTime(timezone=True), nullable=True)
    finished_at    = Column(DateTime(timezone=True), nullable=True)
```

**Cập nhật `backend/app/models/__init__.py`** — thêm import `QuyenSlot`:
```python
from app.models.tournament import Tournament, TournamentWeightClass, BracketMatch, QuyenSlot
```

---

## TASK 3 — SCHEMAS

**File:** `backend/app/schemas/tournament.py` — **THAY THẾ TOÀN BỘ**

```python
from pydantic import BaseModel, model_validator
from typing import Optional, Literal


# ── Existing schemas (GIỮ NGUYÊN) ─────────────────────────────────────────────

class WeightClassItem(BaseModel):
    id: int
    weight_class_name: str
    total_players: int
    bracket_status: str
    players: Optional[list[str]] = None


class AgeTypeItem(BaseModel):
    code: str
    description: str
    weight_classes: list[WeightClassItem]


class CategoryItem(BaseModel):
    category: str
    age_types: list[AgeTypeItem]


class TournamentStructure(BaseModel):
    tournament_id: int
    tournament_name: str
    categories: list[CategoryItem]


# ── BracketMatch schemas ───────────────────────────────────────────────────────

class BracketMatchOut(BaseModel):
    id: int
    round: int
    match_number: int
    match_code: Optional[str] = None
    court: Optional[str] = None
    schedule_order: Optional[int] = None
    player1_name: Optional[str] = None     # None → frontend hiển thị "TBD"
    player2_name: Optional[str] = None     # None → "TBD" | "BYE" → is_bye=True
    score1: Optional[int] = None
    score2: Optional[int] = None
    winner: Optional[int] = None           # 1 | 2
    status: str                            # pending | ready | ongoing | completed
    is_bye: bool = False
    next_match_id: Optional[int] = None
    started_at: Optional[str] = None       # ISO string
    finished_at: Optional[str] = None

    model_config = {"from_attributes": True}


class BracketOut(BaseModel):
    weight_class_id: int
    weight_class_name: str
    bracket_status: str
    matches: list[BracketMatchOut]


# ── QuyenSlot schemas ─────────────────────────────────────────────────────────

class QuyenSlotOut(BaseModel):
    id: int
    tournament_id: int
    weight_class_id: int
    player_name: str
    content_name: str
    court: Optional[str] = None
    schedule_order: Optional[int] = None
    status: str                            # ready | ongoing | completed
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Schedule schemas ──────────────────────────────────────────────────────────

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
    quyen_slots: list[QuyenSlotOut]
    bracket_matches: list[BracketMatchOut]


# ── Input schemas ─────────────────────────────────────────────────────────────

class MatchResultIn(BaseModel):
    winner: int        # 1 hoặc 2
    score1: int
    score2: int


class GenerateMatchesOut(BaseModel):
    tournament_id: int
    bracket_matches_created: int
    quyen_slots_created: int
    bye_matches: int


class GenerateScheduleOut(BaseModel):
    tournament_id: int
    quyen_scheduled: int
    bracket_scheduled: int
```

---

## TASK 4 — REPOSITORY

**File:** `backend/app/repositories/tournament_repo.py` — **THAY THẾ TOÀN BỘ**

```python
"""Tournament repository — bracket generation, schedule, result propagation."""
import math
import random
from datetime import datetime, timezone
from sqlalchemy import select, update, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tournament import Tournament, TournamentWeightClass, BracketMatch, QuyenSlot
from app.schemas.tournament import (
    TournamentStructure, CategoryItem, AgeTypeItem, WeightClassItem,
    BracketOut, BracketMatchOut, QuyenSlotOut,
    TournamentScheduleOut, ScheduleSummary,
    GenerateMatchesOut, GenerateScheduleOut,
)

# ── Constants ─────────────────────────────────────────────────────────────────

AGE_TYPE_META = {
    "phong_trao": {
        "1A": "Dưới 4 tuổi",
        "1B": "4–6 tuổi",
        "2":  "7–9 tuổi",
        "3":  "10–12 tuổi",
        "4":  "18–25 tuổi (đối kháng)",
        "5":  "18–35 tuổi (quyền)",
    },
    "pho_thong": {
        "1": "Không xác định",
        "2": "Lớp 6–9",
        "3": "Lớp 10–12",
        "4": "18–25 (đối kháng) / 18–35 (quyền)",
    },
}

CATEGORY_ORDER = ["phong_trao", "pho_thong"]

# age_type_code nào là Quyền
QUYEN_AGE_CODES = {"5"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_quyen(wc: TournamentWeightClass) -> bool:
    return wc.age_type_code in QUYEN_AGE_CODES


def _match_code(round_num: int, match_number: int) -> str:
    return f"{chr(64 + round_num)}{match_number}"


def _get_round_label(round_num: int, total_rounds: int) -> str:
    if round_num == total_rounds:     return "Chung kết"
    if round_num == total_rounds - 1: return "Bán kết"
    if round_num == total_rounds - 2: return "Tứ kết"
    return f"Vòng {round_num}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _court_has_ongoing(db: AsyncSession, court: str) -> str | None:
    """Trả về match_code/player_name của item ongoing trong sân, hoặc None."""
    bm = (await db.execute(
        select(BracketMatch.match_code).where(
            BracketMatch.court == court,
            BracketMatch.status == "ongoing",
        )
    )).scalar_one_or_none()
    if bm:
        return bm

    qs = (await db.execute(
        select(QuyenSlot.player_name).where(
            QuyenSlot.court == court,
            QuyenSlot.status == "ongoing",
        )
    )).scalar_one_or_none()
    return qs


# ── Tournament lookup ─────────────────────────────────────────────────────────

async def get_first_tournament_id(db: AsyncSession) -> int | None:
    row = (await db.execute(
        select(Tournament).order_by(Tournament.id).limit(1)
    )).scalar_one_or_none()
    return row.id if row else None


async def get_tournament(db: AsyncSession, tournament_id: int) -> Tournament | None:
    return (await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )).scalar_one_or_none()


# ── Tournament structure (GIỮ NGUYÊN LOGIC) ──────────────────────────────────

async def get_tournament_structure(db: AsyncSession, tournament_id: int) -> TournamentStructure | None:
    t = await get_tournament(db, tournament_id)
    if not t:
        return None

    wcs = (await db.execute(
        select(TournamentWeightClass)
        .where(TournamentWeightClass.tournament_id == tournament_id)
        .order_by(TournamentWeightClass.category, TournamentWeightClass.age_type_code, TournamentWeightClass.weight_class_name)
    )).scalars().all()

    from collections import defaultdict
    cat_map: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for wc in wcs:
        cat_map[wc.category][wc.age_type_code].append(
            WeightClassItem(
                id=wc.id,
                weight_class_name=wc.weight_class_name,
                total_players=wc.total_players,
                bracket_status=wc.bracket_status,
                players=wc.players,
            )
        )

    categories: list[CategoryItem] = []
    for cat in CATEGORY_ORDER:
        if cat not in cat_map:
            continue
        meta = AGE_TYPE_META.get(cat, {})
        age_types: list[AgeTypeItem] = []
        for code in list(meta.keys()):
            if code not in cat_map[cat]:
                continue
            age_types.append(AgeTypeItem(
                code=code,
                description=meta.get(code, code),
                weight_classes=cat_map[cat][code],
            ))
        if age_types:
            categories.append(CategoryItem(category=cat, age_types=age_types))

    return TournamentStructure(
        tournament_id=t.id,
        tournament_name=t.name,
        categories=categories,
    )


# ── Bracket retrieval ─────────────────────────────────────────────────────────

async def get_bracket(db: AsyncSession, weight_class_id: int) -> BracketOut | None:
    wc = (await db.execute(
        select(TournamentWeightClass).where(TournamentWeightClass.id == weight_class_id)
    )).scalar_one_or_none()
    if not wc:
        return None

    matches = (await db.execute(
        select(BracketMatch)
        .where(BracketMatch.weight_class_id == weight_class_id)
        .order_by(BracketMatch.round, BracketMatch.match_number)
    )).scalars().all()

    return BracketOut(
        weight_class_id=wc.id,
        weight_class_name=wc.weight_class_name,
        bracket_status=wc.bracket_status,
        matches=[BracketMatchOut.model_validate(m) for m in matches],
    )


# ── Generate Matches ──────────────────────────────────────────────────────────

async def generate_all_matches(db: AsyncSession, tournament_id: int) -> GenerateMatchesOut:
    """
    Generate bracket matches + quyen slots cho toàn bộ tournament.
    Chỉ gọi khi tournament.status == 'DRAFT'.
    """
    t = await get_tournament(db, tournament_id)
    if not t:
        raise ValueError("NOT_FOUND")
    if t.status != "DRAFT":
        raise ValueError("NOT_DRAFT")

    # Kiểm tra không có match ongoing/completed
    ongoing_check = (await db.execute(
        select(BracketMatch.id).where(
            BracketMatch.weight_class_id.in_(
                select(TournamentWeightClass.id).where(
                    TournamentWeightClass.tournament_id == tournament_id
                )
            ),
            BracketMatch.status.in_(["ongoing", "completed"]),
        ).limit(1)
    )).scalar_one_or_none()
    if ongoing_check:
        raise ValueError("HAS_ACTIVE_MATCHES")

    wcs = (await db.execute(
        select(TournamentWeightClass)
        .where(TournamentWeightClass.tournament_id == tournament_id)
    )).scalars().all()

    total_bracket = 0
    total_bye = 0
    total_quyen = 0

    for wc in wcs:
        players = list(wc.players or [])
        if not players:
            continue

        if _is_quyen(wc):
            # Xoá slot cũ
            await db.execute(
                delete(QuyenSlot).where(QuyenSlot.weight_class_id == wc.id)
            )
            await db.flush()

            content_name = AGE_TYPE_META.get(wc.category, {}).get(wc.age_type_code, wc.age_type_code)
            for player_name in players:
                slot = QuyenSlot(
                    tournament_id=tournament_id,
                    weight_class_id=wc.id,
                    player_name=player_name,
                    content_name=content_name,
                    status="ready",
                )
                db.add(slot)
            total_quyen += len(players)

        else:
            # Xoá bracket cũ
            await db.execute(
                delete(BracketMatch).where(BracketMatch.weight_class_id == wc.id)
            )
            await db.flush()

            n = len(players)
            if n < 2:
                continue

            slots_count = 2 ** math.ceil(math.log2(n))
            total_rounds = int(math.log2(slots_count))
            bye_count = slots_count - n

            random.shuffle(players)
            seeded = players + ["BYE"] * bye_count

            # Tạo từng round, mỗi round flush để lấy ID
            prev_round_matches: list[BracketMatch] = []

            for r in range(1, total_rounds + 1):
                matches_in_round = slots_count // (2 ** r)
                curr_round_matches: list[BracketMatch] = []

                for mn in range(1, matches_in_round + 1):
                    if r == 1:
                        idx = (mn - 1) * 2
                        p1 = seeded[idx]
                        p2 = seeded[idx + 1]
                        is_bye = (p2 == "BYE")
                        m = BracketMatch(
                            weight_class_id=wc.id,
                            round=r,
                            match_number=mn,
                            match_code=_match_code(r, mn),
                            player1_name=p1,
                            player2_name=p2 if not is_bye else "BYE",
                            is_bye=is_bye,
                            status="completed" if is_bye else "ready",
                            winner=1 if is_bye else None,
                            score1=None,
                            score2=None,
                        )
                    else:
                        m = BracketMatch(
                            weight_class_id=wc.id,
                            round=r,
                            match_number=mn,
                            match_code=_match_code(r, mn),
                            player1_name=None,
                            player2_name=None,
                            is_bye=False,
                            status="pending",
                        )
                    db.add(m)
                    curr_round_matches.append(m)

                await db.flush()  # lấy ID cho curr_round

                # Link next_match_id từ prev_round → curr_round
                for i, prev_m in enumerate(prev_round_matches):
                    prev_m.next_match_id = curr_round_matches[i // 2].id

                await db.flush()
                prev_round_matches = curr_round_matches

            # Đếm
            all_matches_wc = (await db.execute(
                select(BracketMatch).where(BracketMatch.weight_class_id == wc.id)
            )).scalars().all()
            total_bracket += len(all_matches_wc)
            total_bye += bye_count

            # Cập nhật bracket_status
            await db.execute(
                update(TournamentWeightClass)
                .where(TournamentWeightClass.id == wc.id)
                .values(bracket_status="GENERATED")
            )

    await db.flush()
    return GenerateMatchesOut(
        tournament_id=tournament_id,
        bracket_matches_created=total_bracket,
        quyen_slots_created=total_quyen,
        bye_matches=total_bye,
    )


# ── Generate Schedule ─────────────────────────────────────────────────────────

async def generate_schedule(db: AsyncSession, tournament_id: int) -> GenerateScheduleOut:
    """
    Gán court + schedule_order cho tất cả quyen_slots và bracket_matches.
    Quyền trước, Đối kháng sau. Luân phiên sân A / B.
    """
    t = await get_tournament(db, tournament_id)
    if not t:
        raise ValueError("NOT_FOUND")
    if t.status != "DRAFT":
        raise ValueError("NOT_DRAFT")

    order = 1
    quyen_count = 0
    bracket_count = 0

    # 1. Quyền slots — sắp xếp theo weight_class_id để nhất quán
    quyen_slots = (await db.execute(
        select(QuyenSlot)
        .where(QuyenSlot.tournament_id == tournament_id)
        .order_by(QuyenSlot.weight_class_id, QuyenSlot.id)
    )).scalars().all()

    for i, slot in enumerate(quyen_slots):
        slot.court = "A" if i % 2 == 0 else "B"
        slot.schedule_order = order
        order += 1
        quyen_count += 1

    await db.flush()

    # 2. Bracket matches — sắp xếp theo round, match_number; bỏ qua BYE
    bracket_matches = (await db.execute(
        select(BracketMatch)
        .where(
            BracketMatch.weight_class_id.in_(
                select(TournamentWeightClass.id).where(
                    TournamentWeightClass.tournament_id == tournament_id
                )
            ),
            BracketMatch.is_bye == False,
        )
        .order_by(BracketMatch.round, BracketMatch.match_number)
    )).scalars().all()

    for i, m in enumerate(bracket_matches):
        m.court = "A" if i % 2 == 0 else "B"
        m.schedule_order = order
        order += 1
        bracket_count += 1

    await db.flush()
    return GenerateScheduleOut(
        tournament_id=tournament_id,
        quyen_scheduled=quyen_count,
        bracket_scheduled=bracket_count,
    )


# ── Publish Tournament ────────────────────────────────────────────────────────

async def publish_tournament(db: AsyncSession, tournament_id: int) -> Tournament:
    t = await get_tournament(db, tournament_id)
    if not t:
        raise ValueError("NOT_FOUND")
    if t.status != "DRAFT":
        raise ValueError("NOT_DRAFT")

    # Kiểm tra có schedule chưa
    has_schedule = (await db.execute(
        select(QuyenSlot.id).where(
            QuyenSlot.tournament_id == tournament_id,
            QuyenSlot.court.isnot(None),
        ).limit(1)
    )).scalar_one_or_none()

    has_bracket_schedule = (await db.execute(
        select(BracketMatch.id).where(
            BracketMatch.weight_class_id.in_(
                select(TournamentWeightClass.id).where(
                    TournamentWeightClass.tournament_id == tournament_id
                )
            ),
            BracketMatch.court.isnot(None),
        ).limit(1)
    )).scalar_one_or_none()

    if not has_schedule and not has_bracket_schedule:
        raise ValueError("NO_SCHEDULE")

    t.status = "PUBLISHED"
    await db.flush()
    return t


# ── Full Schedule ─────────────────────────────────────────────────────────────

async def get_full_schedule(db: AsyncSession, tournament_id: int) -> TournamentScheduleOut | None:
    t = await get_tournament(db, tournament_id)
    if not t:
        return None

    quyen_slots = (await db.execute(
        select(QuyenSlot)
        .where(QuyenSlot.tournament_id == tournament_id)
        .order_by(QuyenSlot.schedule_order.nullslast(), QuyenSlot.id)
    )).scalars().all()

    bracket_matches = (await db.execute(
        select(BracketMatch)
        .where(
            BracketMatch.weight_class_id.in_(
                select(TournamentWeightClass.id).where(
                    TournamentWeightClass.tournament_id == tournament_id
                )
            ),
            BracketMatch.is_bye == False,
        )
        .order_by(BracketMatch.schedule_order.nullslast(), BracketMatch.round, BracketMatch.match_number)
    )).scalars().all()

    all_statuses = [s.status for s in quyen_slots] + [m.status for m in bracket_matches]
    summary = ScheduleSummary(
        quyen_count=len(quyen_slots),
        doi_khang_count=len(bracket_matches),
        ready_count=all_statuses.count("ready"),
        ongoing_count=all_statuses.count("ongoing"),
        completed_count=all_statuses.count("completed"),
    )

    return TournamentScheduleOut(
        tournament_id=t.id,
        tournament_name=t.name,
        tournament_status=t.status,
        summary=summary,
        quyen_slots=[QuyenSlotOut.model_validate(s) for s in quyen_slots],
        bracket_matches=[BracketMatchOut.model_validate(m) for m in bracket_matches],
    )


# ── Start Match ───────────────────────────────────────────────────────────────

async def start_match(db: AsyncSession, match_id: int) -> BracketMatch:
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        raise ValueError("NOT_FOUND")
    if match.status != "ready":
        raise ValueError("NOT_READY")
    if not match.player1_name or not match.player2_name:
        raise ValueError("MISSING_PLAYERS")

    blocker = await _court_has_ongoing(db, match.court)
    if blocker:
        raise ValueError(f"COURT_BUSY:{match.court}:{blocker}")

    match.status = "ongoing"
    match.started_at = _now()
    await db.flush()
    return match


# ── Start QuyenSlot ───────────────────────────────────────────────────────────

async def start_quyen_slot(db: AsyncSession, slot_id: int) -> QuyenSlot:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        raise ValueError("NOT_FOUND")
    if slot.status != "ready":
        raise ValueError("NOT_READY")

    blocker = await _court_has_ongoing(db, slot.court)
    if blocker:
        raise ValueError(f"COURT_BUSY:{slot.court}:{blocker}")

    slot.status = "ongoing"
    slot.started_at = _now()
    await db.flush()
    return slot


# ── Match Result ──────────────────────────────────────────────────────────────

async def update_match_result(
    db: AsyncSession,
    match_id: int,
    winner: int,
    score1: int,
    score2: int,
) -> BracketMatch:
    match = (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
    if not match:
        raise ValueError("NOT_FOUND")
    if match.status != "ongoing":
        raise ValueError("NOT_ONGOING")
    if winner not in (1, 2):
        raise ValueError("INVALID_WINNER")

    match.winner = winner
    match.score1 = score1
    match.score2 = score2
    match.status = "completed"
    match.finished_at = _now()

    # Propagate winner to next match
    if match.next_match_id:
        next_match = (await db.execute(
            select(BracketMatch).where(BracketMatch.id == match.next_match_id)
        )).scalar_one_or_none()
        if next_match:
            winner_name = match.player1_name if winner == 1 else match.player2_name
            if match.match_number % 2 == 1:
                next_match.player1_name = winner_name
            else:
                next_match.player2_name = winner_name
            # Chuyển ready nếu đủ 2 người
            if next_match.player1_name and next_match.player2_name:
                next_match.status = "ready"

    await db.flush()
    return match


# ── Complete QuyenSlot ────────────────────────────────────────────────────────

async def complete_quyen_slot(db: AsyncSession, slot_id: int) -> QuyenSlot:
    slot = (await db.execute(
        select(QuyenSlot).where(QuyenSlot.id == slot_id)
    )).scalar_one_or_none()
    if not slot:
        raise ValueError("NOT_FOUND")
    if slot.status != "ongoing":
        raise ValueError("NOT_ONGOING")

    slot.status = "completed"
    slot.finished_at = _now()
    await db.flush()
    return slot


# ── Get Match Detail ──────────────────────────────────────────────────────────

async def get_match(db: AsyncSession, match_id: int) -> BracketMatch | None:
    return (await db.execute(
        select(BracketMatch).where(BracketMatch.id == match_id)
    )).scalar_one_or_none()
```

---

## TASK 5 — ROUTER

**File:** `backend/app/routers/tournaments.py` — **THAY THẾ TOÀN BỘ**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.repositories import tournament_repo
from app.schemas.tournament import (
    BracketOut, MatchResultIn, TournamentStructure,
    TournamentScheduleOut, QuyenSlotOut, BracketMatchOut,
    GenerateMatchesOut, GenerateScheduleOut,
)

router = APIRouter(tags=["tournaments"])


# ── Existing endpoints (GIỮ NGUYÊN) ──────────────────────────────────────────

@router.get("/tournaments/structure", response_model=TournamentStructure)
async def get_structure(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    tid = await tournament_repo.get_first_tournament_id(db)
    if tid is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Chưa có giải đấu nào"})
    structure = await tournament_repo.get_tournament_structure(db, tid)
    if not structure:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return structure


@router.get("/weight-classes/{wc_id}/bracket", response_model=BracketOut)
async def get_bracket(
    wc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    bracket = await tournament_repo.get_bracket(db, wc_id)
    if not bracket:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy hạng cân"})
    return bracket


@router.post("/weight-classes/{wc_id}/generate", response_model=BracketOut)
async def generate_bracket_single(
    wc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Giữ nguyên endpoint cũ — generate bracket cho 1 hạng cân."""
    bracket = await tournament_repo.generate_bracket(db, wc_id)
    if not bracket:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy hạng cân"})
    return bracket


# ── New endpoints ─────────────────────────────────────────────────────────────

@router.post("/tournaments/{tournament_id}/generate-matches", response_model=GenerateMatchesOut)
async def generate_all_matches(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        result = await tournament_repo.generate_all_matches(db, tournament_id)
        await db.commit()
        return result
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
        if msg == "NOT_DRAFT":
            raise HTTPException(409, detail={"code": "NOT_DRAFT", "message": "Giải đấu đã published, không thể generate"})
        if msg == "HAS_ACTIVE_MATCHES":
            raise HTTPException(409, detail={"code": "HAS_ACTIVE_MATCHES", "message": "Có trận đang diễn ra, không thể regenerate"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.post("/tournaments/{tournament_id}/generate-schedule", response_model=GenerateScheduleOut)
async def generate_schedule(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        result = await tournament_repo.generate_schedule(db, tournament_id)
        await db.commit()
        return result
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
        if msg == "NOT_DRAFT":
            raise HTTPException(409, detail={"code": "NOT_DRAFT", "message": "Giải đấu đã published"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.patch("/tournaments/{tournament_id}/publish")
async def publish_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        t = await tournament_repo.publish_tournament(db, tournament_id)
        await db.commit()
        return {"id": t.id, "name": t.name, "status": t.status}
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
        if msg == "NOT_DRAFT":
            raise HTTPException(409, detail={"code": "NOT_DRAFT", "message": "Chỉ có thể publish giải đang DRAFT"})
        if msg == "NO_SCHEDULE":
            raise HTTPException(409, detail={"code": "NO_SCHEDULE", "message": "Vui lòng generate schedule trước khi publish"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.get("/tournaments/{tournament_id}/schedule", response_model=TournamentScheduleOut)
async def get_full_schedule(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await tournament_repo.get_full_schedule(db, tournament_id)
    if not result:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy giải đấu"})
    return result


@router.patch("/matches/{match_id}/start")
async def start_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        match = await tournament_repo.start_match(db, match_id)
        await db.commit()
        return {
            "id": match.id,
            "match_code": match.match_code,
            "status": match.status,
            "court": match.court,
            "started_at": match.started_at.isoformat() if match.started_at else None,
        }
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
        if msg == "NOT_READY":
            raise HTTPException(400, detail={"code": "NOT_READY", "message": "Trận phải ở trạng thái 'sẵn sàng' mới có thể bắt đầu"})
        if msg == "MISSING_PLAYERS":
            raise HTTPException(400, detail={"code": "MISSING_PLAYERS", "message": "Trận chưa đủ vận động viên"})
        if msg.startswith("COURT_BUSY"):
            _, court, blocker = msg.split(":", 2)
            raise HTTPException(409, detail={"code": "COURT_BUSY", "message": f"Sân {court} đang có trận diễn ra ({blocker})"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.post("/matches/{match_id}/result")
async def update_match_result(
    match_id: int,
    body: MatchResultIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        match = await tournament_repo.update_match_result(db, match_id, body.winner, body.score1, body.score2)
        await db.commit()
        return {"id": match.id, "winner": match.winner, "status": match.status}
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
        if msg == "NOT_ONGOING":
            raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Trận phải đang diễn ra mới nhập kết quả"})
        if msg == "INVALID_WINNER":
            raise HTTPException(400, detail={"code": "INVALID_WINNER", "message": "winner phải là 1 hoặc 2"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.patch("/quyen-slots/{slot_id}/start")
async def start_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        slot = await tournament_repo.start_quyen_slot(db, slot_id)
        await db.commit()
        return {
            "id": slot.id,
            "player_name": slot.player_name,
            "court": slot.court,
            "status": slot.status,
            "started_at": slot.started_at.isoformat() if slot.started_at else None,
        }
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
        if msg == "NOT_READY":
            raise HTTPException(400, detail={"code": "NOT_READY", "message": "Lượt thi không ở trạng thái sẵn sàng"})
        if msg.startswith("COURT_BUSY"):
            _, court, blocker = msg.split(":", 2)
            raise HTTPException(409, detail={"code": "COURT_BUSY", "message": f"Sân {court} đang bận ({blocker})"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.patch("/quyen-slots/{slot_id}/complete")
async def complete_quyen_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        slot = await tournament_repo.complete_quyen_slot(db, slot_id)
        await db.commit()
        return {
            "id": slot.id,
            "player_name": slot.player_name,
            "status": slot.status,
            "finished_at": slot.finished_at.isoformat() if slot.finished_at else None,
        }
    except ValueError as e:
        msg = str(e)
        if msg == "NOT_FOUND":
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy lượt thi"})
        if msg == "NOT_ONGOING":
            raise HTTPException(400, detail={"code": "NOT_ONGOING", "message": "Lượt thi chưa bắt đầu"})
        raise HTTPException(400, detail={"code": "ERROR", "message": msg})


@router.get("/matches/{match_id}", response_model=BracketMatchOut)
async def get_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    match = await tournament_repo.get_match(db, match_id)
    if not match:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Không tìm thấy trận đấu"})
    return BracketMatchOut.model_validate(match)
```

---

## TASK 6 — FRONTEND TYPES

**File:** `frontend/src/types/tournament.ts` — **THAY THẾ TOÀN BỘ**

```typescript
export type MatchStatus = 'pending' | 'ready' | 'ongoing' | 'completed'
export type TournamentStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED'
export type Court = 'A' | 'B'

export interface BracketMatch {
  id: number
  round: number
  match_number: number
  match_code: string | null
  court: Court | null
  schedule_order: number | null
  player1_name: string | null  // null = TBD
  player2_name: string | null  // null = TBD, "BYE" = đặc cách
  score1: number | null
  score2: number | null
  winner: 1 | 2 | null
  status: MatchStatus
  is_bye: boolean
  next_match_id: number | null
  started_at: string | null
  finished_at: string | null
}

export interface BracketOut {
  weight_class_id: number
  weight_class_name: string
  bracket_status: string
  matches: BracketMatch[]
}

export interface QuyenSlot {
  id: number
  tournament_id: number
  weight_class_id: number
  player_name: string
  content_name: string
  court: Court | null
  schedule_order: number | null
  status: 'ready' | 'ongoing' | 'completed'
  started_at: string | null
  finished_at: string | null
}

export interface ScheduleSummary {
  quyen_count: number
  doi_khang_count: number
  ready_count: number
  ongoing_count: number
  completed_count: number
}

export interface TournamentSchedule {
  tournament_id: number
  tournament_name: string
  tournament_status: TournamentStatus
  summary: ScheduleSummary
  quyen_slots: QuyenSlot[]
  bracket_matches: BracketMatch[]
}

// Existing types (giữ nguyên nếu đã có)
export interface WeightClassItem {
  id: number
  weight_class_name: string
  total_players: number
  bracket_status: string
  players: string[] | null
}

export interface AgeTypeItem {
  code: string
  description: string
  weight_classes: WeightClassItem[]
}

export interface CategoryItem {
  category: string
  age_types: AgeTypeItem[]
}

export interface TournamentStructure {
  tournament_id: number
  tournament_name: string
  categories: CategoryItem[]
}
```

---

## TASK 7 — FRONTEND API

**File:** `frontend/src/api/tournaments.ts` — **THÊM VÀO CUỐI FILE** (không xoá code cũ)

```typescript
import api from '@/lib/axios'
import type { TournamentSchedule, BracketMatch, QuyenSlot } from '@/types/tournament'

// ── Schedule ──────────────────────────────────────────────────────────────────

export const getSchedule = (tournamentId: number) =>
  api.get<TournamentSchedule>(`/tournaments/${tournamentId}/schedule`).then(r => r.data)

// ── Generate ──────────────────────────────────────────────────────────────────

export const generateMatches = (tournamentId: number) =>
  api.post(`/tournaments/${tournamentId}/generate-matches`).then(r => r.data)

export const generateSchedule = (tournamentId: number) =>
  api.post(`/tournaments/${tournamentId}/generate-schedule`).then(r => r.data)

export const publishTournament = (tournamentId: number) =>
  api.patch(`/tournaments/${tournamentId}/publish`).then(r => r.data)

// ── Match actions ─────────────────────────────────────────────────────────────

export const startMatch = (matchId: number) =>
  api.patch<BracketMatch>(`/matches/${matchId}/start`).then(r => r.data)

export const submitMatchResult = (matchId: number, data: { winner: 1 | 2; score1: number; score2: number }) =>
  api.post(`/matches/${matchId}/result`, data).then(r => r.data)

export const getMatch = (matchId: number) =>
  api.get<BracketMatch>(`/matches/${matchId}`).then(r => r.data)

// ── Quyen slot actions ────────────────────────────────────────────────────────

export const startQuyenSlot = (slotId: number) =>
  api.patch<QuyenSlot>(`/quyen-slots/${slotId}/start`).then(r => r.data)

export const completeQuyenSlot = (slotId: number) =>
  api.patch<QuyenSlot>(`/quyen-slots/${slotId}/complete`).then(r => r.data)
```

---

## TASK 8 — FRONTEND HOOK

**File:** `frontend/src/hooks/useSchedule.ts` — **TẠO MỚI**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import * as api from '@/api/tournaments'

// Lấy tournament_id từ context hoặc truyền vào
export function useSchedule(tournamentId: number) {
  return useQuery({
    queryKey: ['schedule', tournamentId],
    queryFn: () => api.getSchedule(tournamentId),
    enabled: !!tournamentId,
  })
}

export function useStartMatch(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: number) => api.startMatch(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
    },
  })
}

export function useSubmitResult(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, data }: { matchId: number; data: { winner: 1 | 2; score1: number; score2: number } }) =>
      api.submitMatchResult(matchId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
    },
  })
}

export function useStartQuyenSlot(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slotId: number) => api.startQuyenSlot(slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
    },
  })
}

export function useCompleteQuyenSlot(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slotId: number) => api.completeQuyenSlot(slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
    },
  })
}

export function useGenerateMatches(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.generateMatches(tournamentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
    },
  })
}

export function useGenerateSchedule(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.generateSchedule(tournamentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
    },
  })
}

export function usePublishTournament(tournamentId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.publishTournament(tournamentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
    },
  })
}
```

---

## TASK 9 — FRONTEND PAGES & COMPONENTS

Xem `basic_design/result/screen_spec.md` để biết UI spec đầy đủ.

### 9.1 Tổng hợp components cần tạo

| File | Mô tả |
|------|-------|
| `src/pages/MatchesPage.tsx` | Trang lịch tổng hợp — dùng `useSchedule`, render 2 bảng |
| `src/components/tournament/QuyenScheduleTable.tsx` | Bảng Quyền với action buttons |
| `src/components/tournament/MatchScheduleTable.tsx` | Bảng Đối kháng với action buttons |
| `src/components/tournament/MatchActionModal.tsx` | Modal start/submit result/view |
| `src/components/tournament/StatusBadge.tsx` | Badge status tái sử dụng |
| `src/components/tournament/CourtBadge.tsx` | Badge "Sân A"/"Sân B" |

### 9.2 StatusBadge spec

```typescript
// props: status: MatchStatus | 'ready' | 'ongoing' | 'completed' | 'pending'
const config = {
  pending:   { label: 'Chưa sẵn sàng', className: 'bg-gray-100 text-gray-500' },
  ready:     { label: 'Sẵn sàng',      className: 'bg-blue-100 text-blue-700' },
  ongoing:   { label: 'Đang diễn ra',  className: 'bg-yellow-100 text-yellow-700 animate-pulse' },
  completed: { label: 'Đã diễn ra',    className: 'bg-green-100 text-green-700' },
}
```

### 9.3 Logic hiển thị action button (referee)

```
QuyenSlot:
  ready    → [Bắt đầu]    disabled nếu court đang bận (check từ schedule data)
  ongoing  → [Hoàn thành]
  completed → -

BracketMatch (không phải BYE):
  ready    → [Bắt đầu]    disabled nếu court đang bận
  ongoing  → [Nhập kết quả]
  completed → [Xem kết quả]
  pending  → -

BYE match: không hiển thị action, row opacity-60
TBD match (player = null): không hiển thị action
```

### 9.4 Check court bận (client-side)

```typescript
// Từ TournamentSchedule data:
function isCourtBusy(schedule: TournamentSchedule, court: 'A' | 'B'): boolean {
  const qBusy = schedule.quyen_slots.some(s => s.court === court && s.status === 'ongoing')
  const mBusy = schedule.bracket_matches.some(m => m.court === court && m.status === 'ongoing')
  return qBusy || mBusy
}
```

### 9.5 TournamentsPage — thêm Generate controls

Thêm vào cuối panel phải (hoặc phía trên bracket) khi `tournament_status == 'DRAFT'`:

```tsx
{tournamentStatus === 'DRAFT' && (
  <div className="flex gap-2 mb-4">
    <button onClick={() => generateMatches.mutate()} className="btn-outline-blue">
      Generate Matches
    </button>
    <button onClick={() => generateSchedule.mutate()} className="btn-outline-blue">
      Generate Schedule
    </button>
    <button onClick={() => publishTournament.mutate()} className="btn-solid-green">
      Publish →
    </button>
  </div>
)}
```

---

## CHECKLIST TRƯỚC KHI HOÀN THÀNH

- [ ] Migration chạy thành công: `docker compose exec api alembic upgrade head`
- [ ] Backend restart không lỗi: `docker compose restart api`
- [ ] `GET /tournaments/structure` vẫn hoạt động (không bị break)
- [ ] `GET /weight-classes/{wc_id}/bracket` vẫn hoạt động
- [ ] `POST /tournaments/{id}/generate-matches` trả đúng count
- [ ] `POST /tournaments/{id}/generate-schedule` gán court + order
- [ ] `PATCH /matches/{id}/start` trả lỗi 409 khi sân bận
- [ ] `POST /matches/{id}/result` propagate winner đúng, next_match.status = "ready"
- [ ] `GET /tournaments/{id}/schedule` trả quyen_slots + bracket_matches đã sắp xếp
- [ ] Frontend TypeScript không có lỗi: `npm run build` thành công

