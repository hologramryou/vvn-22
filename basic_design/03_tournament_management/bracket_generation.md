# Tính năng: Bốc thăm & Sinh Bracket (Bracket Generation)

**Version:** 1.0
**Last Updated:** 2026-03-29
**API:** `POST /tournaments/{id}/generate-matches`
**Status:** ✅ Implemented

---

## 📌 Tuyên bố giới thiệu

Tính năng **Bốc thăm & Sinh Bracket** tự động tạo sơ đồ thi đấu (single elimination) cho tất cả hạng cân. Chỉ **Admin** mới được phép sinh bracket (ở trạng thái DRAFT).

**Điểm chính:**
- Single elimination (loại bỏ 1 trận)
- Tự động bố trí BYE (vòng đầu loại bỏ)
- Match code tự động theo format
- Vô địch = winner của vòng chung kết (F)

---

## 🏆 Thuật toán Sinh Bracket

### Single Elimination Logic

**Công thức slot:**
```
slots = 2^ceil(log2(n))
```

**Ví dụ:**
```
7 VĐV  → ceil(log₂7) = 3  → 2^3 = 8 slots
  → R1: 8 matches (1 BYE)
  → R2: 4 matches (SF)
  → R3: 2 matches (F)
  → Total: 7 trận (8 VĐV - 1 bye)

10 VĐV → ceil(log₂10) = 4 → 2^4 = 16 slots
  → R1: 16 matches (6 BYE)
  → R2: 8 matches
  → R3: 4 matches
  → R4: 2 matches
  → R5: 1 match
  → Total: 15 trận
```

### Bracket Structure

```
Round 1 (R1)           Round 2 (SF)          Round 3 (F)
─────────             ─────────             ─────────
Match 1: A vs B  ──┐
                   ├─→ Match 5: W1 vs W2  ──┐
Match 2: C vs D  ──┘                         ├─→ Match 7: Winner (Vô địch)
                                             │
Match 3: E - BYE ──┐                         │
                   ├─→ Match 6: E vs W4   ──┘
Match 4: F vs G  ──┘
```

### BYE Distribution

VĐV nằm trong BYE slot sẽ **tự động advance** lên vòng 2 (R2) mà không phải thi đấu.

**Ví dụ 7 VĐV (1 BYE):**
- Position 3: E - BYE (tự động advance)
- Các player khác: 1 vs 2, 4 vs 5, 6 vs 7

**Ví dụ 10 VĐV (6 BYE):**
- Positions 1-10: Real players
- Positions 11-16: BYE (tự động advance R1 → R2)

---

## 📝 Match Code Format

Mỗi match được gán code duy nhất giúp tracking và display.

**Format:**
```
<Category>_<AgeType>_<Gender>_<Weight>_<Court>_<Round>_<Number>
```

**Ví dụ:**
```
PT_1A_M_45_A_R1_001  = Phong Trào, Loại 1A, Nam, 45kg, Court A, R1, Match 1
PT_1A_M_45_A_R1_002  = ...
PT_1A_M_45_B_R1_001  = Phong Trào, Loại 1A, Nam, 45kg, Court B, R1, Match 1
PT_1A_F_48_A_R1_001  = Phong Trào, Loại 1A, Nữ, 48kg, Court A, R1, Match 1
...
PT_1A_M_45_A_R2_001  = ...SF...
PT_1A_M_45_A_R3_001  = ...Final...
```

**Thành phần:**
- **Category:** PT (Phong Trào) | PH (Phổ Thông)
- **AgeType:** 1A, 1B, 2, 3, 4 (PT) | 1, 2, 3, 4 (PH)
- **Gender:** M (Nam) | F (Nữ)
- **Weight:** Numeric + "kg" (45, 48, 51, ...)
- **Court:** A | B
- **Round:** R1, R2 (SF=Semifinal), R3 (F=Final)
- **Number:** 001, 002, ... (sequential per court per round)

---

## 🎯 Bracket Visualization

### Desktop View (Tree Layout)

```
           ┌──R1──────┐
           │          │
       ┌───┴─────┐    │
       │         │    │
   ┌─┴─┐   ┌──┴──┐   │
   │ A │ ┌─┤ B  |   │
   └─┬─┘ | └──┬──┘   │
     │   │    │    ┌──┐
     └───┼────┴────┤  ├───┬─────────┐
         │         │W │   │         │
         │         └──┘ ┌─┴──┐ ┌─┬─┐
         │              │ SF ├─┤ │ ├─┬────────┐
         │              └───┘ │ │ │ │        │
         │                    │ │ │ │  ┌─┐   │
         └────────────────────┼─┴─┬─┴──┤ ├───┘
                              │   │    └─┘
                              │ F │ = Vô địch
                              │ I │
                              │ N │
                              └───┘
```

### Match Card (Một dòng)

```
┌──────────────────────────────────────────────────┐
│ PT_1A_M_45_A_R1_001                              │
│ ┌─ Nguyễn A (CLB Q1) vs Trần B (CLB Q2)         │
│ │ Status: Ready (2/2)  Score: —  Court: A      │
│ │  [Start] [Details]                           │
│ └─────────────────────────────────────────────  │
└──────────────────────────────────────────────────┘
```

### Mobile View (Collapsed)

```
R1 (8 matches)
• A vs B — PT_1A_M_45_A — 🟢 Ready
• C vs D — PT_1A_M_45_B — 🟡 Pending
• E - BYE — PT_1A_M_51_A — ⚫ BYE
...

R2 - SF (4 matches)
• W1 vs W2 — PT_1A_M_45_A — ⚫ Pending
...

R3 - F (1 match)
• Final — PT_1A_M_45_A — ⚫ Pending
```

---

## 🔄 Auto-Advance Logic

### Winner Propagation

Khi match completed, winner được auto-assign vào bracket match tiếp theo:

**Example:**
```
Match 1: A vs B → Winner=A
   ↓ (Auto)
Match 5: A vs Next opponent

Match 1: E - BYE → Auto-complete, player1_name="E"
   ↓ (Auto)
Match 6: E vs Next opponent
```

### Match State Transition

```
pending (0-1 players)
   ↓ (Auto when 2 players assigned)
ready (2 players, no scores)
   ↓ (Admin starts match)
ongoing (timer, scoring)
   ↓ (Admin submits result)
completed (winner assigned, auto-propagate to next match)
```

---

## 🛡️ Edge Cases

### 1. Exactly 2 VĐV (1 match)
```
R1: 1 match
  Match 1: A vs B
    ↓
  Winner = Vô địch
```

### 2. Single VĐV (1 BYE)
```
R1: 1 match
  Match 1: A - BYE
    ↓ (auto-complete)
  A = Vô địch (auto)
```

### 3. Zero VĐV (Error)
```
Backend returns error: "NOT_ENOUGH_PLAYERS"
Bracket not generated
UI shows: "Cần ít nhất 1 VĐV để sinh bracket"
```

### 4. Odd numbers (e.g., 7, 15, 31 VĐV)
```
BYE slots tự động điều chỉnh.
VD: 7 VĐV → 8 slots → 1 BYE ở position 3
```

---

## 📊 Match States & Transitions

| State | Meaning | Can edit? | Score input? |
|-------|---------|:---------:|:------------:|
| `pending` | TBD, VĐV chưa đủ 2 | No | No |
| `ready` | Ready to start, 2 VĐV | No | No |
| `ongoing` | Timer running, chấm điểm | No | Yes |
| `completed` | Kết quả fixed | No | No (reviewed) |

---

## 🔐 Authorization

| Action | Admin | Referee | Viewer | Club |
|--------|:-----:|:-------:|:------:|:----:|
| View bracket | ✅ | ✅ | ✅ | ✅ |
| Generate bracket | ✅ | ❌ | ❌ | ❌ |
| Edit bracket (manual) | (N/A) | ❌ | ❌ | ❌ |
| Drag-drop reorder | (Planned) | ❌ | ❌ | ❌ |

---

## 🔄 API: Generate Brackets

### POST /tournaments/{tournament_id}/generate-matches

**Request:**
```bash
POST /tournaments/1/generate-matches
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "message": "Sinh bracket thành công",
  "summary": {
    "total_weight_classes": 19,
    "matches_created": 85,
    "bye_matches": 15,
    "categories": {
      "phong_trao": {
        "1A": { "matches": 24, "byes": 4 },
        "1B": { "matches": 22, "byes": 2 },
        "2": { "matches": 18, "byes": 6 },
        "3": { "matches": 12, "byes": 2 },
        "4": { "matches": 9, "byes": 1 }
      },
      "pho_thong": {
        "1": { "matches": 28, "byes": 4 },
        "2": { "matches": 20, "byes": 4 },
        "3": { "matches": 16, "byes": 2 },
        "4": { "matches": 14, "byes": 2 }
      }
    }
  }
}
```

**Error responses:**
```json
// 404: tournament not found
{ "detail": { "code": "NOT_FOUND", "message": "..." } }

// 403: Only admin
{ "detail": { "code": "FORBIDDEN", "message": "Chỉ admin được sinh bracket" } }

// 409: Already generated or tournament not DRAFT
{ "detail": { "code": "CONFLICT", "message": "Bracket đã sinh, vui lòng reset trước" } }
```

---

## ✅ Acceptance Criteria

- [ ] Generate creates correct match count (2^n slots)
- [ ] BYE slots properly assigned at random or deterministic position
- [ ] Match codes format correct: `<cat>_<age>_<gender>_<weight>_<court>_<round>_<number>`
- [ ] Single VĐV auto-completes as vô địch
- [ ] 2 VĐV creates 1 match (final)
- [ ] Auto-advance on completion propagates winner to next match
- [ ] Status transitions correct (pending → ready → ongoing → completed)
- [ ] Desktop visualization renders bracket tree correctly
- [ ] Mobile view shows collapsed/expandable rounds
- [ ] Empty weight class (0 VĐV) skipped without error
- [ ] API response includes summary stats

---

## 🔗 Related Specs

- [tournament_structure.md](./tournament_structure.md) — Weight class setup
- [match_execution.md](./match_execution.md) — Execute bracket matches
- [api_reference.md](./api_reference.md) — Complete API docs
