# Implementation Guide — Màn hình Danh sách Môn sinh

**Version:** 1.0
**Date:** 2026-03-24
**Scope:** BE + FE · Màn hình list môn sinh · Responsive Mobile

---

## 1. Tech Stack

| Layer | Công nghệ | Lý do chọn |
|-------|-----------|------------|
| **BE API** | FastAPI (Python) | Async native, auto OpenAPI docs, Pydantic validation |
| **Database** | PostgreSQL 15 | JSONB, GIN index, full-text search |
| **Cache** | Redis | Cache danh sách, debounce search |
| **FE Framework** | React 18 + TypeScript | Component model phù hợp responsive |
| **FE State** | TanStack Query v5 | Server state, cache, pagination tự động |
| **UI Components** | Ant Design Mobile / shadcn/ui | Responsive, hỗ trợ mobile tốt |
| **Styling** | Tailwind CSS | Utility-first, mobile-first breakpoints |
| **Real-time** | WebSocket (FastAPI) | Cần cho scoring — dùng chung kiến trúc |

---

## 2. Kiến trúc tổng thể

```
Mobile/Tablet/Desktop
        │  HTTPS
        ▼
┌───────────────────┐
│   React SPA       │  Vite · TypeScript · Tailwind
│   (Responsive)    │  TanStack Query (cache + pagination)
└────────┬──────────┘
         │ REST API + WebSocket
         ▼
┌───────────────────┐
│   FastAPI         │  Async · Pydantic · JWT Auth
│   (API Server)    │
└────────┬──────────┘
         │
    ┌────┴────┐
    ▼         ▼
PostgreSQL   Redis
(primary)   (cache · session · consensus window)
```

---

## 3. Backend Implementation

### 3.1 Cấu trúc thư mục BE

```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py          # Settings từ env
│   │   ├── database.py        # SQLAlchemy async engine
│   │   ├── redis.py           # Redis client
│   │   └── security.py        # JWT, RBAC
│   ├── models/
│   │   └── student.py         # SQLAlchemy ORM model
│   ├── schemas/
│   │   └── student.py         # Pydantic request/response schemas
│   ├── repositories/
│   │   └── student_repo.py    # Query logic, tách khỏi route
│   ├── services/
│   │   └── student_service.py # Business logic, import Excel
│   └── routers/
│       └── students.py        # API endpoints
├── tests/
└── alembic/                   # DB migrations
```

---

### 3.2 Database Model

```python
# app/models/student.py
from sqlalchemy import Column, Integer, String, Date, Numeric, ARRAY, Boolean, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from app.core.database import Base

class Student(Base):
    __tablename__ = "students"

    id             = Column(Integer, primary_key=True)
    code           = Column(String(20), unique=True, nullable=False)   # MS-00001
    full_name      = Column(String(150), nullable=False)
    date_of_birth  = Column(Date, nullable=False)
    gender         = Column(String(1), nullable=False)                 # M / F
    id_number      = Column(String(12), unique=True, nullable=False)   # CCCD
    phone          = Column(String(15))
    email          = Column(String(150))
    current_belt   = Column(String(30), nullable=False, default="Vang")
    belt_date      = Column(Date)
    join_date      = Column(Date, nullable=False)
    weight_class   = Column(Numeric(5, 2))
    compete_events = Column(ARRAY(String))
    status         = Column(String(20), nullable=False, default="active")
    notes          = Column(Text)
    search_vector  = Column(TSVECTOR)                                  # GIN index

    # Relationships
    student_clubs  = relationship("StudentClub", back_populates="student", lazy="selectin")
```

---

### 3.3 Pydantic Schemas

```python
# app/schemas/student.py
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Optional, List
from enum import Enum

class BeltRank(str, Enum):
    vang  = "Vang"
    xanh  = "Xanh"
    nau   = "Nau"
    den1  = "Den 1"
    # ... den2 → den9

class StudentListItem(BaseModel):
    id           : int
    code         : str
    full_name    : str
    club_name    : Optional[str]
    current_belt : BeltRank
    weight_class : Optional[float]
    status       : str

    model_config = ConfigDict(from_attributes=True)

class StudentListResponse(BaseModel):
    items      : List[StudentListItem]
    total      : int
    page       : int
    page_size  : int
    total_pages: int

class StudentFilter(BaseModel):
    keyword    : Optional[str] = None
    club_id    : Optional[int] = None
    belt_rank  : Optional[BeltRank] = None
    province_id: Optional[int] = None
    status     : Optional[str] = "active"
    page       : int = 1
    page_size  : int = 20
    sort_by    : str = "full_name"
    sort_dir   : str = "asc"
```

---

### 3.4 Repository — Query Logic

```python
# app/repositories/student_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.student import Student
from app.schemas.student import StudentFilter

class StudentRepository:

    async def get_list(
        self, db: AsyncSession, filters: StudentFilter
    ) -> tuple[list[Student], int]:

        query = (
            select(Student, Club.name.label("club_name"))
            .outerjoin(StudentClub, StudentClub.student_id == Student.id)
            .outerjoin(Club, Club.id == StudentClub.club_id)
            .where(StudentClub.is_current == True)
        )

        # Full-text search qua GIN index
        if filters.keyword:
            query = query.where(
                or_(
                    Student.search_vector.op("@@")(
                        func.plainto_tsquery("simple", filters.keyword)
                    ),
                    Student.id_number.ilike(f"%{filters.keyword}%"),
                    Student.code.ilike(f"%{filters.keyword}%"),
                )
            )

        if filters.club_id:
            query = query.where(StudentClub.club_id == filters.club_id)

        if filters.belt_rank:
            query = query.where(Student.current_belt == filters.belt_rank)

        if filters.status != "all":
            query = query.where(Student.status == filters.status)

        # Count total trước khi paginate
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)

        # Sort + Paginate
        order_col = getattr(Student, filters.sort_by, Student.full_name)
        query = query.order_by(
            order_col.asc() if filters.sort_dir == "asc" else order_col.desc()
        )
        query = query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)

        result = await db.execute(query)
        return result.all(), total
```

---

### 3.5 API Endpoint

```python
# app/routers/students.py
from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user, require_role
from app.schemas.student import StudentListResponse, StudentFilter

router = APIRouter(prefix="/students", tags=["students"])

@router.get("/", response_model=StudentListResponse)
async def list_students(
    keyword    : str | None = Query(None),
    club_id    : int | None = Query(None),
    belt_rank  : str | None = Query(None),
    province_id: int | None = Query(None),
    status     : str        = Query("active"),
    page       : int        = Query(1, ge=1),
    page_size  : int        = Query(20, ge=1, le=100),
    sort_by    : str        = Query("full_name"),
    sort_dir   : str        = Query("asc"),
    db         : AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    filters = StudentFilter(
        keyword=keyword, club_id=club_id, belt_rank=belt_rank,
        province_id=province_id, status=status,
        page=page, page_size=page_size,
        sort_by=sort_by, sort_dir=sort_dir,
    )

    # club_manager chỉ thấy môn sinh CLB của mình
    if current_user.role == "club_manager":
        filters.club_id = current_user.club_id

    students, total = await student_repo.get_list(db, filters)

    return StudentListResponse(
        items=students,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size),
    )
```

---

## 4. Frontend Implementation

### 4.1 Cấu trúc thư mục FE

```
frontend/
├── src/
│   ├── pages/
│   │   └── students/
│   │       ├── StudentListPage.tsx    # Page container
│   │       ├── StudentListPage.mobile.tsx  # Mobile layout override
│   │       └── index.ts
│   ├── components/students/
│   │   ├── StudentTable.tsx           # Desktop: Ant Design Table
│   │   ├── StudentCard.tsx            # Mobile: Card layout
│   │   ├── StudentFilters.tsx         # Bộ lọc (collapsible trên mobile)
│   │   └── ImportModal.tsx            # Modal import Excel
│   ├── hooks/
│   │   ├── useStudents.ts             # TanStack Query hook
│   │   └── useStudentFilters.ts       # URL search params sync
│   ├── api/
│   │   └── students.ts                # Axios calls
│   └── types/
│       └── student.ts                 # TypeScript interfaces
```

---

### 4.2 Responsive Strategy — Mobile-first

```
Breakpoint  Width        Layout
─────────── ─────────── ──────────────────────────────────
mobile      < 768px      Card list · Filter drawer · FAB
tablet      768–1024px   Compact table · Inline filters
desktop     > 1024px     Full table · Sidebar filters
```

```tsx
// hooks/useBreakpoint.ts
export const useBreakpoint = () => {
  const [bp, setBp] = useState<"mobile"|"tablet"|"desktop">("desktop")
  useEffect(() => {
    const match = () => {
      const w = window.innerWidth
      setBp(w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop")
    }
    match()
    window.addEventListener("resize", match)
    return () => window.removeEventListener("resize", match)
  }, [])
  return bp
}
```

---

### 4.3 TanStack Query — Data Fetching

```tsx
// hooks/useStudents.ts
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { fetchStudents } from "@/api/students"
import { useDebouncedValue } from "@/hooks/useDebounce"

export const useStudents = () => {
  const [params, setParams] = useSearchParams()

  const keyword     = params.get("keyword") ?? ""
  const debouncedKw = useDebouncedValue(keyword, 300)   // 300ms debounce
  const page        = Number(params.get("page") ?? 1)
  const clubId      = params.get("club_id")
  const beltRank    = params.get("belt_rank")
  const status      = params.get("status") ?? "active"

  const query = useQuery({
    queryKey: ["students", debouncedKw, page, clubId, beltRank, status],
    queryFn: () => fetchStudents({ keyword: debouncedKw, page, clubId, beltRank, status }),
    staleTime: 30_000,          // Cache 30 giây
    placeholderData: keepPreviousData,  // Giữ dữ liệu cũ khi chuyển trang
  })

  const setFilter = (key: string, value: string | null) => {
    setParams(prev => {
      value ? prev.set(key, value) : prev.delete(key)
      prev.set("page", "1")     // Reset về trang 1 khi đổi filter
      return prev
    })
  }

  return { ...query, setFilter, keyword, page, clubId, beltRank, status }
}
```

---

### 4.4 Mobile Card Layout

```tsx
// components/students/StudentCard.tsx
import { Badge } from "@/components/ui/badge"

const BELT_COLOR: Record<string, string> = {
  "Vang" : "bg-yellow-400 text-black",
  "Xanh" : "bg-blue-500 text-white",
  "Nau"  : "bg-amber-700 text-white",
  "Den 1": "bg-gray-900 text-white",
  // Den 2 → Den 9 ...
}

export const StudentCard = ({ student, onPress }: Props) => (
  <div
    className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm
               active:bg-gray-50 cursor-pointer border border-gray-100"
    onClick={() => onPress(student.id)}
  >
    {/* Avatar */}
    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
      {student.avatar_url
        ? <img src={student.avatar_url} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
            {student.full_name[0]}
          </span>
      }
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-gray-900 truncate">{student.full_name}</p>
      <p className="text-sm text-gray-500">{student.code} · {student.club_name}</p>
    </div>

    {/* Belt badge */}
    <Badge className={BELT_COLOR[student.current_belt] ?? "bg-gray-400 text-white"}>
      {student.current_belt}
    </Badge>
  </div>
)
```

---

### 4.5 Page Container — Responsive Switch

```tsx
// pages/students/StudentListPage.tsx
export const StudentListPage = () => {
  const bp = useBreakpoint()
  const { data, isLoading, setFilter, ...filters } = useStudents()

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3
                      flex items-center justify-between">
        <h1 className="text-lg font-bold">Môn sinh</h1>
        <div className="flex gap-2">
          <ImportButton />
          <CreateButton />
        </div>
      </div>

      {/* Filters — inline desktop, drawer mobile */}
      {bp === "mobile"
        ? <FilterDrawer filters={filters} onChange={setFilter} />
        : <FilterBar    filters={filters} onChange={setFilter} className="px-4 py-3" />
      }

      {/* Content */}
      <div className="px-4 py-3">
        {isLoading ? (
          <SkeletonList count={10} />
        ) : bp === "mobile" ? (
          // Mobile: danh sách card
          <div className="space-y-2">
            {data?.items.map(s => (
              <StudentCard key={s.id} student={s} onPress={id => navigate(`/students/${id}`)} />
            ))}
          </div>
        ) : (
          // Desktop/Tablet: bảng
          <StudentTable data={data?.items ?? []} />
        )}
      </div>

      {/* Pagination */}
      <Pagination
        current={filters.page}
        total={data?.total ?? 0}
        pageSize={20}
        onChange={p => setFilter("page", String(p))}
        className="px-4 py-4"
      />
    </div>
  )
}
```

---

## 5. Kiến trúc Real-time Chấm điểm (Consensus Scoring)

### 5.1 Yêu cầu cốt lõi

> **3/5 trọng tài bấm cùng đòn trong vòng 2 giây → hệ thống tự động cộng điểm.**

### 5.2 Sơ đồ luồng

```
Referee Tablet (×5)
     │  WebSocket (ws://server/ws/match/{match_id})
     ▼
┌────────────────────────────────────────────────────┐
│  FastAPI WebSocket Handler                         │
│                                                    │
│  on_message(referee_id, competitor, score_type):   │
│    1. Ghi raw event vào Redis Stream               │
│    2. Gọi ConsensusEngine.evaluate()               │
│    3. Nếu đạt ngưỡng → broadcast SCORE_CONFIRMED   │
│       Nếu chưa đạt   → broadcast SCORE_PENDING     │
└────────────────────────────────────────────────────┘
         │ Redis Pub/Sub
         ▼
┌────────────────────────────────────────────────────┐
│  ConsensusEngine (Redis-backed)                    │
│                                                    │
│  key: consensus:{match_id}:{competitor}:{type}     │
│  value: {referee_ids: [], first_ts: timestamp}     │
│  TTL: 2000ms                                       │
│                                                    │
│  Logic:                                            │
│    - SADD referee_id vào set                       │
│    - Đặt TTL 2s nếu là lần đầu tiên               │
│    - SCARD >= 3 → CONFIRMED                        │
│    - TTL expired → EXPIRED (hết cơ hội)            │
└────────────────────────────────────────────────────┘
         │ Broadcast
         ▼
┌────────────────────────────────────────────────────┐
│  Tất cả clients kết nối match đó                   │
│  (Trọng tài + Bảng điểm công cộng + Admin)         │
└────────────────────────────────────────────────────┘
```

### 5.3 ConsensusEngine — Redis Logic

```python
# app/services/consensus_engine.py
import redis.asyncio as redis
from dataclasses import dataclass
from enum import Enum

CONSENSUS_THRESHOLD = 3          # 3 trong 5 trọng tài
CONSENSUS_WINDOW_MS = 2000       # 2 giây

class ConsensusResult(Enum):
    PENDING   = "pending"        # Chưa đủ ngưỡng
    CONFIRMED = "confirmed"      # Đủ 3/5 trong 2 giây
    EXPIRED   = "expired"        # Hết cửa sổ 2s

@dataclass
class ScoreEvent:
    match_id    : str
    referee_id  : int
    competitor  : str            # "blue" | "red"
    score_type  : str            # "neck_lock_3pt" | "high_kick_2pt" | ...
    points      : int

class ConsensusEngine:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def _key(self, event: ScoreEvent) -> str:
        return f"consensus:{event.match_id}:{event.competitor}:{event.score_type}"

    async def evaluate(self, event: ScoreEvent) -> ConsensusResult:
        key = self._key(event)

        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.sadd(key, event.referee_id)
            pipe.scard(key)
            # Đặt TTL 2s chỉ khi key mới tạo (NX = not exists)
            pipe.expire(key, int(CONSENSUS_WINDOW_MS / 1000), nx=True)
            results = await pipe.execute()

        count = results[1]

        if count >= CONSENSUS_THRESHOLD:
            # Xoá key ngay để tránh double-confirm
            await self.redis.delete(key)
            return ConsensusResult.CONFIRMED

        return ConsensusResult.PENDING
```

### 5.4 WebSocket Handler

```python
# app/routers/ws_scoring.py
from fastapi import WebSocket, WebSocketDisconnect
from app.services.consensus_engine import ConsensusEngine, ScoreEvent

router = APIRouter()

class ConnectionManager:
    """Quản lý tất cả WS connections theo match_id"""
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def join(self, match_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(match_id, []).append(ws)

    async def leave(self, match_id: str, ws: WebSocket):
        self.rooms.get(match_id, []).remove(ws)

    async def broadcast(self, match_id: str, message: dict):
        for ws in self.rooms.get(match_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws/match/{match_id}")
async def scoring_ws(
    websocket: WebSocket,
    match_id: str,
    engine: ConsensusEngine = Depends(get_consensus_engine),
    db: AsyncSession = Depends(get_db),
):
    await manager.join(match_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # data = { referee_id, competitor, score_type, points }

            event = ScoreEvent(match_id=match_id, **data)
            result = await engine.evaluate(event)

            if result == ConsensusResult.CONFIRMED:
                # Ghi điểm vào DB
                await match_repo.add_score(db, event, confirmed=True)

                # Broadcast cho tất cả clients
                await manager.broadcast(match_id, {
                    "type"      : "SCORE_CONFIRMED",
                    "competitor": event.competitor,
                    "points"    : event.points,
                    "score_type": event.score_type,
                })
            else:
                # Báo trạng thái pending (hiển thị animation chờ)
                await manager.broadcast(match_id, {
                    "type"      : "SCORE_PENDING",
                    "competitor": event.competitor,
                    "score_type": event.score_type,
                })

    except WebSocketDisconnect:
        await manager.leave(match_id, websocket)
```

### 5.5 FE — WebSocket Hook cho Scoring

```tsx
// hooks/useMatchScoring.ts
import { useEffect, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

type ScoreMessage =
  | { type: "SCORE_CONFIRMED"; competitor: "blue"|"red"; points: number; score_type: string }
  | { type: "SCORE_PENDING";   competitor: "blue"|"red"; score_type: string }

export const useMatchScoring = (matchId: string) => {
  const ws        = useRef<WebSocket | null>(null)
  const qc        = useQueryClient()

  useEffect(() => {
    ws.current = new WebSocket(`${import.meta.env.VITE_WS_URL}/ws/match/${matchId}`)

    ws.current.onmessage = (e) => {
      const msg: ScoreMessage = JSON.parse(e.data)

      if (msg.type === "SCORE_CONFIRMED") {
        // Cập nhật score cache trực tiếp — không cần refetch
        qc.setQueryData(["match", matchId], (old: MatchData) => ({
          ...old,
          [msg.competitor === "blue" ? "blue_score" : "red_score"]:
            (old[msg.competitor === "blue" ? "blue_score" : "red_score"] ?? 0) + msg.points,
        }))
      }
    }

    return () => ws.current?.close()
  }, [matchId])

  // Trọng tài bấm điểm
  const sendScore = useCallback((
    competitor: "blue"|"red",
    scoreType: string,
    points: number,
  ) => {
    ws.current?.send(JSON.stringify({
      referee_id: currentUser.id,
      competitor,
      score_type: scoreType,
      points,
    }))
  }, [])

  return { sendScore }
}
```

---

## 6. Responsive Scoring UI (Mobile-first)

```tsx
// Màn hình trọng tài trên Tablet/Mobile
export const RefereeConsole = ({ matchId }: { matchId: string }) => {
  const { sendScore } = useMatchScoring(matchId)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* Header — tên VĐV + đồng hồ */}
      <MatchHeader matchId={matchId} />

      {/* Score buttons — 2 cột xanh/đỏ, chiếm phần lớn màn hình */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-3">

        {/* VĐV Xanh */}
        <div className="flex flex-col gap-2">
          <ScoreButton
            label="1 điểm"  sub="Đấm / Đá giáp"
            onClick={() => sendScore("blue", "punch_kick_1pt", 1)}
            className="bg-blue-600 active:bg-blue-700 flex-1"
          />
          <ScoreButton
            label="2 điểm"  sub="Đá tầm cao"
            onClick={() => sendScore("blue", "high_kick_2pt", 2)}
            className="bg-blue-600 active:bg-blue-700 flex-1"
          />
          <ScoreButton
            label="3 điểm"  sub="Kẹp cổ"
            onClick={() => sendScore("blue", "neck_lock_3pt", 3)}
            className="bg-blue-800 active:bg-blue-900 flex-1 text-xl font-bold"
          />
        </div>

        {/* VĐV Đỏ */}
        <div className="flex flex-col gap-2">
          <ScoreButton
            label="1 điểm"  sub="Đấm / Đá giáp"
            onClick={() => sendScore("red", "punch_kick_1pt", 1)}
            className="bg-red-600 active:bg-red-700 flex-1"
          />
          <ScoreButton
            label="2 điểm"  sub="Đá tầm cao"
            onClick={() => sendScore("red", "high_kick_2pt", 2)}
            className="bg-red-600 active:bg-red-700 flex-1"
          />
          <ScoreButton
            label="3 điểm"  sub="Kẹp cổ"
            onClick={() => sendScore("red", "neck_lock_3pt", 3)}
            className="bg-red-800 active:bg-red-900 flex-1 text-xl font-bold"
          />
        </div>
      </div>

      {/* Penalty row */}
      <div className="grid grid-cols-2 gap-2 p-3 pt-0">
        <PenaltyButton competitor="blue" onClick={() => sendScore("blue", "penalty_minus1", -1)} />
        <PenaltyButton competitor="red"  onClick={() => sendScore("red",  "penalty_minus1", -1)} />
      </div>
    </div>
  )
}
```

---

## 7. Checklist triển khai

### Backend
- [ ] Setup FastAPI project với async SQLAlchemy
- [ ] Tạo migration Alembic cho bảng `students`, `student_clubs`
- [ ] Implement `StudentRepository.get_list()` với GIN search
- [ ] Implement `GET /students/` endpoint với RBAC
- [ ] Implement `POST /students/import` với openpyxl
- [ ] Setup Redis + `ConsensusEngine`
- [ ] Implement WebSocket `/ws/match/{match_id}`
- [ ] Viết pytest cho ConsensusEngine (unit) và API (integration)

### Frontend
- [ ] Setup React + Vite + TanStack Query + Tailwind
- [ ] Implement `useStudents` hook với debounce 300ms
- [ ] Implement `StudentCard` (mobile) + `StudentTable` (desktop)
- [ ] Implement `FilterDrawer` (mobile) + `FilterBar` (desktop)
- [ ] Implement `ImportModal` với preview & error highlight
- [ ] Implement `useMatchScoring` WebSocket hook
- [ ] Implement `RefereeConsole` responsive layout
- [ ] Test trên Viewport 375px (iPhone SE) và 768px (iPad)
