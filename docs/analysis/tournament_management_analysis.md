# Tournament Management Implementation Analysis

## 1. TOURNAMENT STRUCTURE & STATES

### Tournament Status States (4)
```
DRAFT → PUBLISHED → ONGOING → COMPLETED
```

**State Flow:**
- `DRAFT`: Khởi tạo → Cho phép thêm VĐV, generate bracket, schedule
- `PUBLISHED`: Có trận đấu → Không thể sửa, cho phép bắt đầu trận
- `ONGOING`: Có trận đấu đang diễn → Đang thi đấu
- `COMPLETED`: Hết tất cả trận → Xem kết quả, huy chương

**Models:** [Tournament](backend/app/models/tournament.py#L7)

---

## 2. WEIGHT CLASS CLASSIFICATION

### Phân loại Multi-Dimensional

Weight classes được chia theo **3 tiêu chí**:

#### a) **Danh mục (Category)** - 2 loại
| Code | Tên | Ghi chú |
|------|-----|--------|
| `phong_trao` | Phong Trào | Trẻ em + người lớn |
| `pho_thong` | Phổ Thông | Học sinh + người lớn |

#### b) **Nhóm tuổi (Age Type Code)** - Khác nhau theo danh mục

**Phong Trào (5 loại):**
```
1A → Dưới 4 tuổi
1B → 4–6 tuổi
2  → 7–9 tuổi
3  → 10–12 tuổi
4  → 18–25 tuổi (đối kháng)
5  → 18–35 tuổi (QUYỀN LUYỆN)
```

**Phổ Thông (4 loại):**
```
1 → Phổ thông chung
2 → Cấp 2 (lớp 6–9)
3 → Cấp 3 (lớp 10–12)
4 → 18–25 tuổi (đối kháng) / 18–35 tuổi
```

#### c) **Giới tính (Gender)** - 2 loại
```
M → Nam (Male)
F → Nữ (Female)
```

#### d) **Hạng cân (Weight Class)** - Động
```
Ví dụ: "45kg", "48kg", "51kg", "54kg", ..., "Trên 92kg"
```

### Total Classification
```
= Danh mục (2) × Hạng cân Name × Giới tính (2)
= Mỗi tuổi × 20+ hạng cân × 2 giới = ~40+ weight classes
```

**Models:** [TournamentWeightClass](backend/app/models/tournament.py#L16)

---

## 3. BRACKET GENERATION LOGIC

### Type: **Single Elimination**
- Supports BYE (bye rounds for odd player counts)
- Generates rounds automatically based on 2^n slots

### Algorithm

**Input:** Danh sách VĐV (≥ 2)

**Process:**
```
1. Calculate slots = 2^ceil(log2(n))
   - n = 7 → slots = 8 → 3 rounds
   - n = 5 → slots = 8 → 3 rounds (3 BYE)

2. Shuffle player list

3. Generate Round 1:
   - Pair: (P1,P2), (P3,P4), ...
   - BYE matches auto-advance (without scoring)

4. Link matches: Round 1 winners → Winners bracket
   - next_match_id points to next round

5. Generate Finals (Chung kết / Bán kết / Tứ kết)
```

**Match Code Format:**
```
{G}-{CAT}-{AGE}-{WC}
= Gender-Category-AgeType-Weight
= M-PT-1A-45  (Nam-PhongTrao-Under4-45kg)
= F-PH-3-54   (Nữ-PhoBThong-HS10-12-54kg)
```

### Bracket Status Per Weight Class
```
NOT_GENERATED → GENERATING → GENERATED
```

**Models:** [BracketMatch](backend/app/models/tournament.py#L45)

---

## 4. MATCH SCHEDULING

### Two Components

#### A. **Court Assignment**
```
Alternating logic:
- Odd-indexed (match_0, match_2, ...) → Court A
- Even-indexed (match_1, match_3, ...)  → Court B
```

#### B. **Schedule Order (Global sequencing)**

**Order Priority:**
1. **Quyền slots first** (by ID = registration order)
2. **Bracket matches** sorted by:
   - Round (R1 → QF → SF → F)
   - Gender (Nam/M > Nữ/F)
   - Weight class name (ascending)
   - Match number (ascending)

**Result:** Linear schedule_order from 1...N

**Example:**
```
Order 1: Quyền Nam 45kg — VĐV A          [Court A, Order 1]
Order 2: Quyền Nữ 48kg — VĐV B          [Court B, Order 2]
Order 3: ĐK R1 Nam 45kg — A vs B        [Court A, Order 3]
Order 4: ĐK R1 Nữ 45kg — C vs D        [Court B, Order 4]
Order 5: ĐK SF Nam 45kg — Winner1 vs W2 [Court A, Order 5]
```

**Models:** [BracketMatch.schedule_order, .court](backend/app/models/tournament.py#L46-L47), [QuyenSlot.schedule_order, .court](backend/app/models/tournament.py#L70-L71)

---

## 5. QUYỀN SLOTS (Hội Diễn Luyện)

### Data Structure

```python
QuyenSlot {
  id: int
  tournament_id: int
  weight_class_id: int         # Tham chiếu hạng cân (age_type_code='5')
  player_name: string          # Tên VĐV
  content_name: string         # Tên nội dung quyền (từ student.quyen_selections[0])
  court: 'A' | 'B' | null      # Assign trong schedule
  schedule_order: int | null   # Global order
  status: 'ready' | 'ongoing' | 'completed'
  started_at: datetime | null
  finished_at: datetime | null
}
```

### Workflow
1. **Generate:** Mỗi VĐV tham dự hạng cân quyền (age_type_code='5') → 1 slot
2. **Schedule:** Gán court + order (xen kẽ với bracket matches)
3. **Execute:** Start → Ongoing → Track start/finish time

**Models:** [QuyenSlot](backend/app/models/tournament.py#L65), [TournamentParticipant](backend/app/models/tournament.py#L37)

---

## 6. MATCH EXECUTION FLOW

### Match State Machine
```
pending → ready → ongoing → completed
         ↓                    ↑
         └────────────────────┘
```

**State Transitions:**

| From → To | Condition | Action |
|-----------|-----------|--------|
| pending → ready | 2 players assigned (not BYE) | Auto-detect |
| ready → ongoing | Manual start | Check court busy |
| ongoing → completed | Submit result | Store score + winner |

**Score Capture:**
- `score1, score2: int` (points per player)
- `winner: 1 | 2` (winner ID)
- Winner auto-advances to `next_match_id`

**Models:** [BracketMatch.status, .score1/2, .winner](backend/app/models/tournament.py#L53-L57)

---

## 7. FRONTEND SCREENS & COMPONENTS

### Active Pages (Frontend: `/src/pages`)

#### a. **TournamentsPage.tsx**
**Purpose:** Bracket visualization + management

**Features:**
- Display tournament structure (categories → age types → weight classes)
- Show participants per weight class
- Virtual/DB weight class handling
- Bracket diagram (canvas-based):
  - Rounds (R1, QF, SF, F)
  - Match connections (loser out)
  - Player names/status
- Button: "Generate Bracket" (admin) → calls `/tournaments/{id}/generate-matches`
- Button: "Generate Schedule" (admin) → calls `/tournaments/{id}/generate-schedule`
- Button: "Publish" (admin) → calls `/tournaments/{id}/publish`
- Button: "Reset" (admin) → calls `/tournaments/{id}/reset`

**Auth Check:** `canScore()` restricts edit buttons

#### b. **MatchesPage.tsx**
**Purpose:** Live schedule + execution

**Features:**
- Two-section layout:
  1. **Bracket Matches Table** (sorted by schedule_order)
  2. **Quyền Slots Table** (interspersed by schedule_order)
  
- Status badges: pending/ready/ongoing/completed
- Court assignment: Badge showing "Sân A" or "Sân B"
- Action buttons:
  - ready → "Bắt đầu" (start_match)
  - ongoing → "Kết quả" (update_match_result)
  - completed → "Xem"
- Modals:
  - "Start match" → Confirm + court check
  - "Enter result" → Score fields + winner detection
  - "Quyền actions" → Start/Complete quyền slots

#### c. **ScoringPage.tsx**
**Purpose:** Real-time scoring interface

**Features:**
- Round timer (3min per round × 2 rounds = 6min total)
- Score tracking per player + per round
- Score reasons dropdown (per round: Đòn thắng, Phản công, etc.)
- Manual winner selection (KO, disqualify)
- Submit result → Update match DB + propagate to next round

#### d. **MedalsPage.tsx**
**Purpose:** Medal tally after tournament (completed)

**Features:**
- Table: Weight Class | Gold | Silver | Bronze
- Grouped by gender (Nam / Nữ)
- Pull winners from completed bracket matches

#### e. **DisplayPage.tsx**
**Purpose:** Scoreboard display

#### f. **DashboardPage.tsx**
**Purpose:** Overview (TBD)

### Component Organization

**layout/ components:**
- `AppLayout.tsx` — Main layout wrapper
- `Sidebar.tsx` — Navigation

**students/ components:**
- Student-related shared UI

---

## 8. API ENDPOINTS (Backend: `routers/tournaments.py`)

### Group A: Structure & Bracket View

```
GET  /tournaments/structure
     → Returns: TournamentStructure
     → Shows: categories → age_types → weight_classes + participants

GET  /weight-classes/{wc_id}/bracket
     → Returns: BracketOut (all matches for 1 weight class)
     → Used by: bracket visualization
```

### Group B: Bracket Generation & Publish

```
POST /weight-classes/{wc_id}/generate
     → Generate bracket for single weight class
     → Auth: admin only
     → (Legacy endpoint; use tournament-level generate instead)

POST /tournaments/{tournament_id}/generate-matches
     → Generate brackets for all đối kháng weight classes (age_type != '5')
     → Skips Quyền (age_type='5')
     → Returns: { generated_weight_classes, skipped_weight_classes, ... }
     → Auth: admin only

POST /tournaments/{tournament_id}/generate-schedule
     → 1. Auto-generate any remaining brackets
     → 2. Create QuyenSlots for age_type='5'
     → 3. Assign courts + schedule_order
     → Returns: { court_a_count, court_b_count, total_scheduled }
     → Auth: admin only

GET  /tournaments/{tournament_id}/schedule
     → Returns: TournamentScheduleOut
     → Contains: bracket_matches[] + quyen_slots[] (both sorted by schedule)

PATCH /tournaments/{tournament_id}/publish
     → Transition: DRAFT → PUBLISHED
     → Checks: tournament is DRAFT + has matches/slots
     → Returns: { id, name, status }
     → Auth: admin only
```

### Group C: Match Execution

```
GET  /matches/{match_id}
     → Returns: MatchDetailOut
     → Shows: player names, scores, court, status, time tracking

PATCH /matches/{match_id}/start
     → Transition: ready → ongoing
     → Validates: both players assigned + court not busy
     → Stores: started_at
     → Returns: { id, match_code, status, court, started_at }
     → Auth: admin only

POST  /matches/{match_id}/result
     → Submit final score + winner
     → Input: { winner: 1|2, score1, score2 }
     → Validates: match is ongoing + winner in (1,2)
     → Propagates: winner to next_match_id player1_name
     → Stores: finished_at, sets status = 'completed'
     → Returns: { id, winner, status }
     → Auth: admin | referee
```

### Group D: Quyền Slot Execution

```
PATCH /quyen-slots/{slot_id}/start
     → Transition: ready → ongoing
     → Validates: court not busy
     → Stores: started_at
     → Returns: { id, player_name, status, court }
     → Auth: admin only

PATCH /quyen-slots/{slot_id}/complete
     → Transition: ongoing → completed
     → Stores: finished_at
     → Returns: { id, player_name, status }
     → Auth: admin only
```

### Group E: Admin Actions

```
POST /tournaments/{tournament_id}/reset
     → Clear all brackets + quyền slots
     → Reset bracket_status → NOT_GENERATED
     → Recount total_players from TournamentParticipant
     → Return tournament to DRAFT
     → Returns: { tournament_id, status }
     → Auth: admin only

GET  /tournaments/{tournament_id}/medals
     → Returns: MedalTallyOut
     → Shows: Weight class winners (gold/silver/bronze)
     → Aggregates from completed bracket matches
     → Auth: any
```

---

## 9. AUTHORIZATION & ROLE-BASED CONTROL

### Roles & Permissions

| Endpoint | Required Role |
|----------|---------------|
| Generate bracket | `admin` |
| Generate schedule | `admin` |
| Publish tournament | `admin` |
| Start match | `admin` |
| Update score | `admin` \| `referee` |
| Start/Complete quyền | `admin` |
| Reset tournament | `admin` |
| **Read-only** (structure/schedule/medals) | Any (with auth token) |

**Auth enforcement:** [get_current_user](backend/app/core/security.py) middleware checks JWT token + extracts role

---

## 10. WORKFLOW PIPELINE

### Create → Publish → Execute → Complete

```
1. CREATE PHASE (DRAFT)
   ├─ Admin: Set up tournament + weight classes
   ├─ General users: Register VĐV (TournamentParticipant)
   └─ Validate: ≥ 1 VĐV per weight class

2.GENERATE-BRACKET PHASE
   ├─ Admin: POST /tournaments/{id}/generate-matches
   ├─ Action: Single-elimination brackets for đối kháng (age_type != '5')
   ├─ Skips: Quyền at this stage
   └─ Result: BracketMatch records created

3. GENERATE-SCHEDULE PHASE
   ├─ Admin: POST /tournaments/{id}/generate-schedule
   ├─ Action:
   │  ├─ Auto-generate remaining brackets
   │  ├─ Create QuyenSlot for each quyền participant
   │  ├─ Assign courts (A/B alternating)
   │  └─ Global schedule_order sequencing
   └─ Result: schedule_order + court assigned to all matches/slots

4. PUBLISH PHASE (PUBLISHED)
   ├─ Admin: PATCH /tournaments/{id}/publish
   ├─ Validation: ≥ 1 match or ≥ 1 slot
   └─ Lock: Can't modify structure anymore

5. EXECUTION PHASE
   ├─ Admin: Runs each match sequentially
   ├─ Actions per match:
   │  ├─ PATCH /matches/{id}/start → ongoing
   │  ├─ ScoringPage: Admin enters scores + round tracking
   │  └─ POST /matches/{id}/result → completed + winner advances
   └─ Similar for quyền: /quyen-slots/{id}/start → /complete

6. COMPLETION PHASE (COMPLETED)
   ├─ Auto-set when: All matches + all quyền completed
   ├─ View: MedalsPage (winners by weight class)
   └─ Possible: POST /reset to go back to DRAFT
```

---

## 11. KEY FEATURES & CURRENT STATUS

### ✅ Implemented Features

| Feature | Status | Location |
|---------|--------|----------|
| Tournament CRUD | ✅ Basic | `tournament.py` models |
| Multi-dimensional weight classification | ✅ Full | Models: Category, Age Type, Gender |
| Single-elimination bracket generation | ✅ Full | `generate_all_matches()` with BYE |
| Schedule court assignment | ✅ Full | `generate_schedule()` alternating |
| Quyền slot creation | ✅ Full | From TournamentParticipant with age_type='5' |
| Match status tracking | ✅ Full | pending → ready → ongoing → completed |
| Score capture & result propagation | ✅ Full | `update_match_result()` + next_match link |
| Publish workflow | ✅ Full | Legal transitions validated |
| Bracket visualization (React) | ✅ Full | TournamentsPage.tsx with canvas |
| Live schedule (MatchesPage) | ✅ Full | Table with status badges + modals |
| Scoring interface (timer + rounds) | ✅ Full | ScoringPage.tsx |
| Medal tally | ✅ Full | MedalsPage.tsx |
| Role-based access control | ✅ Full | Admin-only endpoints + auth checks |

### 🔄 Partial/Planned

| Feature | Status | Notes |
|---------|--------|-------|
| Double-elimination bracket | ❌ N/A | Only single-elimination implemented |
| Real-time bracket updates (WebSocket) | ⚠️ TBD | Currently polling via React Query |
| Drag-drop schedule reordering | ⚠️ TBD | Spec mentions giai đoạn sau (future phase) |
| Seeding logic (ranked players) | ⚠️ TBD | Currently random shuffle |
| Multiple tournament support | ⚠️ Partial | Code supports multi, but UI uses first tournament |
| Scoreboard display (DisplayPage) | ⚠️ Planned | Empty component |
| Dashboard metrics (DashboardPage) | ⚠️ Planned | Empty component |

---

## 12. SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **Tournament States** | 4: DRAFT, PUBLISHED, ONGOING, COMPLETED |
| **Weight Class Dimensions** | Category (2) × Age Type (4–5) × Gender (2) × Weight (20+) |
| **Bracket Type** | Single elimination with BYE |
| **Court Assignment** | Alternating A/B |
| **Schedule Sequencing** | Quyền first (by reg order), then bracket (by round/gender/WC) |
| **Main Endpoints** | 13 active (structure, generate, schedule, publish, start, result, medals) |
| **Primary Roles** | admin (all actions), referee (score only), any (view) |
| **Frontend Screens** | 5 active + 1 planned (TournamentsPage, MatchesPage, ScoringPage, MedalsPage, DisplayPage, DashboardPage) |
| **Workflow** | Create → Generate (2-step) → Publish → Execute → Complete |
| **Data Flow** | TournamentParticipant → BracketMatch/QuyenSlot → Match Execution → Results |

---

## 13. QUICK REFERENCE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────┐
│                     TOURNAMENT LIFECYCLE                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [DRAFT] ──→ Generate Brackets ──→ Generate Schedule ──→ [PUBLISHED]  │
│     ↑            (Đối kháng only)      (Quyền + court)                │
│     │                                                         ↓        │
│     └─────────────────────────────────── ← [COMPLETED]       │        │
│                   Reset                      Match Results   ↓        │
│                                           [ONGOING]          │        │
│                                            Execute ←─────────┘        │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    WEIGHT CLASS MATRIX                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Category: Phong Trao / Pho Thong                                   │
│      ↓ Age: 1A/1B/2/3/4/5 or 1/2/3/4                               │
│      ↓ Gender: M / F                                                │
│      ↓ Weight: 45kg, 48kg, 51kg, ..., Trên 92kg                    │
│                                                                      │
│  Result: ~100+ unique weight_class combos per tournament            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              MATCH/SLOT SEQUENCING PER COURT                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Court A: [Q1:Nam] → [M1:Nam-R1] → [M3:Nam-R1] → [M5:Nam-SF] ...   │
│  Court B: [Q2:Nữ]  → [M2:Nữ-R1]  → [M4:Nữ-R1]  → [M6:Nữ-SF] ...   │
│                                                                      │
│  Interleaving ensures:                                              │
│  - Quyền distributed first (1-2 per tournament)                    │
│  - Each round completed before next (not interleaved across rounds) │
│  - Gender priority: Nam before Nữ within round                      │
│  - All at court_A → then court_B (global order)                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 14. CONTACT POINTS FOR FUTURE DEVELOPMENT

1. **Seeding/Rankings:** Modify `_build_bracket_for_wc()` to accept ranked list
2. **Double Elimination:** Extend `BracketMatch` with `loser_next_match_id`
3. **Drag-drop Schedule:** Frontend drag handler + `PATCH /matches/{id}/reorder`
4. **Real-time Updates:** Add WebSocket for live bracket/schedule changes
5. **Scoreboard Display:** Implement DisplayPage component + optional large-screen mode
6. **Multi-tournament:** Extend UI to SELECT tournament + store in session
7. **Permissions Enhancement:** Add referee-specific routes (e.g., score-only view)

