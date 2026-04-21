# Tính năng: Thực Thi Thi Đấu (Match Execution)

**Version:** 1.0
**Last Updated:** 2026-03-29
**Status:** ✅ Implemented

---

## 📌 Tuyên bố giới thiệu

Tính năng **Thực Thi Thi Đấu** cho phép quản lý toàn bộ quá trình chạy giải: từ khởi động match, nhập điểm, tuyên bố kết quả cho đến cập nhật bảng xếp hạng.

**Điểm chính:**
- State machine: pending → ready → ongoing → completed
- Court A/B assignment (tự động xen kẽ)
- Global sequencing: Quyền hội diễn trước, sau đó bracket sparring
- Timer 2×180 giây/hiệp
- Auto-advance winner vào match tiếp theo

---

## 🏛️ Court Assignment Logic

### A/B Alternation

Match được gán court theo **thứ tự order** (từ generation):

```
Thứ tự (index)    Court
─────────────────────────
0 (chẵn)    →    A
1 (lẻ)      →    B
2 (chẵn)    →    A
3 (lẻ)      →    B
4 (chẵn)    →    A
5 (lẻ)      →    B
...
```

**Ví dụ R1 (8 matches × 2 courts):**
```
Court A                     Court B
─────────────────────────────────────
Match 1: A vs B (0)         Match 2: C vs D (1)
Match 3: E vs F (2)         Match 4: G vs H (3)
Match 5: I vs J (4)         Match 6: K vs L (5)
Match 7: M - BYE (6)        Match 8: N vs O (7)
```

### Dynamic Rebalancing (Future)

_Planned enhancement:_ Allow manual court reassignment if one court runs ahead.

---

## ⏱️ Global Sequencing

**Quyền hội diễn chạy TRƯỚC các match sparring.**

### Slide 1: Quyền Slots (age_type_code = '5')

```
Sequence Order  Event Type        Code              Duration
──────────────────────────────────────────────────────────
0               Quyền Hội Diễn    PT_5_M_Hội diễn   ~5 min
1               Quyền Hội Diễn    PT_5_F_Hội diễn   ~5 min
2               Quyền Hội Diễn    PH_5_M_Hội diễn   ~5 min
3               Quyền Hội Diễn    PH_5_F_Hội diễn   ~5 min
```

### Slide 2: Bracket Matches (age_type_code ≠ '5')

Bracket match sequenced by: **Round → Gender → Weight → Court**

```
Sequence Order  Event Type        Code                      Duration
──────────────────────────────────────────────────────────────────────
4               R1 Bracket        PT_1A_M_45_A_R1_001       2×180s
5               R1 Bracket        PT_1A_M_45_B_R1_001       2×180s
6               R1 Bracket        PT_1A_M_48_A_R1_001       2×180s
7               R1 Bracket        PT_1A_M_48_B_R1_001       2×180s
8               R1 Bracket        PT_1A_F_45_A_R1_001       2×180s
...
```

**Ordering rule:**
```
PRIMARY:   Round (R1 → R2 → R3)
SECONDARY:   Gender (M → F)
TERTIARY:    Weight (ascending: 45 → 48 → ...)
QUATERNARY:  Court (A → B)
```

---

## 🎫 Match State Machine

### State Diagram

```
                    ┌─────────┐
                    │ pending │ (initial)
                    └────┬────┘
                         │
                    Admin clicks START
                         ↓
                    ┌─────────┐
                    │  ready  │ (2 players assigned)
                    └────┬────┘
                         │
                    Referee clicks START
                         ↓
                    ┌─────────────┐
                    │  ongoing    │ (timer running)
                    └────┬────────┘
                         │
                    Referee submits RESULT
                         ↓
                    ┌──────────┐
                    │completed │ (winner locked)
                    └──────────┘
                         ↓
                    Auto-propagate to next_match
```

### State Descriptions

| State | Players assigned? | Can edit match? | Timer running? | Can submit score? |
|-------|:-----------------:|:---------------:|:--------------:|:----------------:|
| `pending` | 0-1 | Yes | No | No |
| `ready` | 2 | No | No | No |
| `ongoing` | 2 | No | Yes | Yes |
| `completed` | 2 | No | No | No |

---

## 📋 Match Execution Flow

### 1️⃣ Start Match (Referee)

**Preconditions:**
- Match status = `ready` (2 players assigned)
- Tournament status = `ONGOING`
- User role = Referee or Admin

**Actions:**
```
PATCH /matches/{id}/start
Body: { "court": "A" }  // optional, override

Backend:
  ✓ Set status → ongoing
  ✓ Start timer: 1st round 180s
  ✓ Lock match assignment
  ✓ Emit WebSocket: "MATCH_STARTED"
```

**Frontend:**
- Timer begins countdown from 180s
- UI changes: "START" button → "SUBMIT RESULT" button
- Scoring panel becomes active
- Player names become read-only

### 2️⃣ Score Entry (During Ongoing)

**Scoring Components:**

```
┌──────────────────────────────────────────┐
│  PT_1A_M_45_A_R1_001                     │
├──────────────────────────────────────────┤
│                                          │
│  R1: 180s  [||||||||--------] 2:35 left  │
│                                          │
│  🟔 Nguyễn A (CLB Q1)          vs vs      🟔 Trần B (CLB Q2)  │
│  ├─ Score: 6      C [•••-]         Score: 3      C [••--]       │
│  ├─ Kicks: 12     K [•••--]        Kicks: 8      K [••---]       │
│  └─ Punches: 8    P [•••--]        Punches: 5    P [••---]       │
│                                          │
│  ┌─ Round Menu:                          │
│  ├─ R1 [Active]  R2 [Pending]           │
│  └─ [+] Score  [-] Undo  [→] Next-Round │
│                                          │
│  [SUBMIT RESULT]                         │
└──────────────────────────────────────────┘
```

**Scoring Fields:**
- `tay_ao` (C = Cân cắt/Punch,K = Kick, P = Punch direct): 0-3 (multiplier)
- `score`: Auto-calculated = (C×1) + (K×2) + (P×3)

**Round Management:**
- Player can track 2 rounds max per match (R1, R2)
- Timer resets per round (180s each)
- After R1 complete → Auto-advance to R2 input

### 3️⃣ Result Submission (Referee)

**Preconditions:**
- Match status = `ongoing`
- Both players have final score assigned
- All rounds completed

**Actions:**
```
POST /matches/{id}/result
Body: {
  "winner": "player1",        // or "player2"
  "final_score_p1": 18,
  "final_score_p2": 12,
  "tay_ao_list": [
    { "round": 1, "player_num": 1, "c": 1, "k": 2, "p": 1 },
    { "round": 1, "player_num": 2, "c": 0, "k": 1, "p": 0 },
    { "round": 2, "player_num": 1, "c": 2, "k": 0, "p": 1 },
    { "round": 2, "player_num": 2, "c": 1, "k": 0, "p": 0 }
  ]
}

Backend:
  ✓ Validate final score consistency
  ✓ Set status → completed
  ✓ Save match record
  ✓ Auto-find next_match_id (winner advance)
  ✓ Update next_match: assign winner as player1 or player2
  ✓ Auto-complete BYE match if next is BYE vs Winner
  ✓ Emit WebSocket: "MATCH_COMPLETED"
  ✓ Trigger display/leaderboard update
```

**Frontend:**
- Result submission successful → modal confirm
- Return to match list
- Highlight next match for this bracket

### 4️⃣ Winner Auto-Advance

**Logic:**

```
When Match A completed with Winner = Player W:

IF next_match exists:
    IF next_match.player1 is null:
        next_match.player1_name ← W.name
        next_match.player1_id ← W.id
    ELSE IF next_match.player2 is null:
        next_match.player2_name ← W.name
        next_match.player2_id ← W.id
    
    // Check if both players assigned
    IF player1 AND player2 assigned:
        next_match.status ← ready
    ELSE:
        next_match.status ← pending
        Emit: "WAITING_FOR_OPPONENT"
```

**Example chain (Tournament winner):**
```
R1 Match 1: A vs B → Winner=A
  ↓ (auto) → R2 Match 1: A vs <pending>

R1 Match 2: C vs D → Winner=C
  ↓ (auto) → R2 Match 1: A vs C (both ready!)
  ↓ (auto) → Status change: pending → ready

R2 Match 1: A vs C → Winner=A
  ↓ (auto) → R3 Match (Final): A vs <pending>

R2 Match 2: E vs F → Winner=F
  ↓ (auto) → R3 Match (Final): A vs F
  ↓ (auto) → Status: pending → ready

R3 Match (Final): A vs F → Winner=A ← 🏆 VÔNG DIỄN CHAMPION A
```

---

## 🎬 Quyền Slot Execution

**Quyền slots track separately from bracket matches.**

### Start Quyền Slot

```
PATCH /quyen-slots/{id}/start
Body: { "court": "A" }

Backend:
  ✓ Set status → ongoing
  ✓ Start timer (duration TBD per category)
  ✓ Emit WebSocket: "QUYEN_STARTED"
```

### Complete Quyền Slot

```
PATCH /quyen-slots/{id}/complete
Body: { "result": "pass" | "fail" }

Backend:
  ✓ Set status → completed
  ✓ Record result
  ✓ Emit WebSocket: "QUYEN_COMPLETED"
  ✓ Trigger display update
```

**No scoring entry for Quyền** (pass/fail only).

---

## 📺 Display/Scoreboard Integration

### Live Leaderboard (Display Page)

When match completes, leaderboard auto-updates:

```
GET /tournaments/{id}/medals

Returns:
{
  "medals": {
    "gold": { "name": "Nguyễn A", "weight_class": "PT_1A_M_45" },
    "silver": { "name": "Trần B", "weight_class": "PT_1A_M_45" },
    "bronze": [
      { "name": "Lê C", "weight_class": "PT_1A_M_45" },
      { "name": "Hoàng D", "weight_class": "PT_1A_M_45" }
    ]
  },
  "by_category": { ... }
}
```

**Display Page (Live Timer):**
- Shows current live match on screen (especially for audience)
- Countdown 180s per round
- Score updates in real-time

---

## 🔐 Authorization

| Action | Admin | Referee | Viewer | Club |
|--------|:-----:|:-------:|:------:|:----:|
| View matches | ✅ | ✅ | ✅ | ✅ |
| Start match | ✅ | ✅ | ❌ | ❌ |
| Submit result | ✅ | ✅ | ❌ | ❌ |
| Edit past result | (N/A) | ❌ | ❌ | ❌ |
| View live timer | ✅ | ✅ | ✅ | ⚠️ |

---

## 🚨 Edge Cases

### 1. Match Timeout (No Result Submitted)

```
If match ongoing > 30 min:
  Backend task (cron): Auto-flag as "TIMEOUT"
  Emit warning to Referee
  UI shows: "⚠️ Vui lòng xác nhận kết quả"
```

### 2. Score Dispute / Recount

```
IF match completed < 5 min AND (Admin or Referee):
    POST /matches/{id}/reopen
    
Backend:
    ✓ Reset status: completed → ongoing
    ✓ Unlock score fields
    ✓ Notify opponent
```

### 3. Player No-Show

```
Manual override: Referee sets player_name → "Không xác định"
OR Admin cancels match before start
```

### 4. Unexpected BYE Completion

```
When bracket generated with BYE:
    next_match = BYE player (auto-advance)
    PATCH /matches/{id}/result
    Body: { "winner": "player1", "auto_bye": true }
    
Backend auto-completes next_match if both are decided
```

---

## 🔀 Match State Recovery

### Scenario: Referee Force Quit

```
Match was ongoing, timer stopped, no result submitted.

Frontend (on reconnect):
  IF match.status = ongoing AND time_elapsed > 30 min:
    Emit: "MATCH_STALLED_RECOVERY"
    Prompt Referee: "Nhập điểm hay huỷ match?"

Admin dashboard:
  Shows list of stalled matches
  [Resume] [Force Complete] [Reset] buttons
```

---

## ✅ Acceptance Criteria

- [ ] Court assignment alternates A/B per order index
- [ ] Global sequencing: Quyền placed before all bracket matches
- [ ] Match starts only when 2 players assigned
- [ ] Timer counts down 180s per round
- [ ] Score entry validates tay_ao counts (0-3 each)
- [ ] Winner auto-advances to next_match
- [ ] Both BYE + regular matches complete correctly
- [ ] Final champion correctly identified
- [ ] Quyền slots start/complete independently
- [ ] Past results not editable (except admin reopen within 5 min)
- [ ] Live leaderboard updates within 2s of result submission
- [ ] Stalled matches detected and flagged after 30 min

---

## 🔗 Related Specs

- [bracket_generation.md](./bracket_generation.md) — Generate brackets & slots
- [tournament_structure.md](./tournament_structure.md) — Setup weight classes
- [api_reference.md](./api_reference.md) — Complete API docs
