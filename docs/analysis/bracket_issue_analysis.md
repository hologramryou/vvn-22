# Bracket Generation Issue & Solutions

## ❌ Current Problem: 19 Participants

**Current Algorithm:**
```
n = 19
slots = 2^ceil(log2(19)) = 2^5 = 32 slots
total_rounds = 5
byes = 32 - 19 = 13
seeded = [P1, P2, ..., P19, BYE, BYE, ..., BYE] (13 BYEs at end)
```

**Result:** Positions 1-16 in R1 have:
- Positions 1-19: Players + BYEs mixed
- Positions 20-32: ALL BYEs (one entire half!)

This creates **severely unbalanced brackets** where:
- Left half: Some real matchups
- Right half: Almost all BYEs (many "free passes")
- One player may advance 2+ rounds without playing

---

## ✅ Solution: Balanced BYE Distribution

### Approach: Distribute BYEs evenly across bracket

Instead of `seeded = names + [None] * byes`, use:

```python
def distribute_byes_evenly(names: list[str], byes: int) -> list[str]:
    """Distribute bye slots evenly across bracket."""
    n = len(names)
    slots = n + byes
    
    # Calculate spacing to distribute byes evenly
    spacing = slots / (byes + 1)  # Gap between bye positions
    
    seeded = [None] * slots
    bye_indices = []
    player_idx = 0
    
    # Place byes at calculated intervals
    for bye_num in range(byes):
        bye_pos = int((bye_num + 1) * spacing) - 1
        bye_indices.append(bye_pos)
    
    # Fill remaining positions with players
    general_positions = [i for i in range(slots) if i not in bye_indices]
    
    for pos in general_positions:
        if player_idx < len(names):
            seeded[pos] = names[player_idx]
            player_idx += 1
    
    return seeded
```

### Example: 19 players, 13 byes → 32 slots

**Even distribution:**
```
spacing = 32 / 14 ≈ 2.29
Bye positions: 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30

Resulting bracket:
Slot  1: P1          |  Slot 17: P15
Slot  2: BYE     ─→  |  Slot 18: BYE  ─→
Slot  3: P2          |  Slot 19: P16
Slot  4: BYE     ─→  |  Slot 20: P17
Slot  5: P3          |  Slot 21: BYE  ─→
Slot  6: P4          |  Slot 22: P18
Slot  7: BYE     ─→  |  Slot 23: BYE  ─→
Slot  8: P5          |  Slot 24: P19
...
```

**Result:** 
- Left half (slots 1-16): 6-7 players + 6-7 byes
- Right half (slots 17-32): 6-7 players + 6-7 byes
- **Both branches equal strength!**

---

## 🎯 Alternative: Use "Balanced Bye Seeding"

Another common tournament approach:
```python
def balanced_bye_seeding(names: list[str], byes: int) -> list[str]:
    """Place byes at positions so they don't match first."""
    n = len(names)
    slots = n + byes
    
    # Split into halves
    half = slots // 2
    
    # Distribute byes such that first round has:
    # - Some real matchups
    # - BYEs spaced out
    seeded = [None] * slots
    
    # Assign byes to spread positions evenly
    bye_count = byes
    pos = 1
    while bye_count > 0:
        seeded[pos] = None
        pos += max(1, slots // (byes + 1))
        bye_count -= 1
    
    # Fill rest with shuffled players
    players = names.copy()
    random.shuffle(players)
    idx = 0
    for i in range(slots):
        if seeded[i] is None and idx < len(players):
            seeded[i] = players[idx]
            idx += 1
    
    return seeded
```

---

## 📊 Comparison: 19 Players

| Metric | Current | Balanced |
|--------|---------|----------|
| Slots | 32 | 32 |
| Byes | 13 | 13 |
| L-half players | ~9 | ~9-10 |
| R-half players | ~10 | ~9-10 |
| L-half byes | ~7 | ~6-7 |
| R-half byes | ~6 | ~6-7 |
| Balance Score | 40% | 95% |

---

## 🔧 Recommended Fix

**Priority 1:** Implement balanced bye distribution
```python
# In _build_bracket_for_wc()
seeded = distribute_byes_evenly(names, byes)  # Instead of: names + [None] * byes
```

**Priority 2:** Add test cases for edge cases
- 7, 19, 31 players (common issue numbers)
- Verify both halves have similar strength

**Priority 3:** Document in specs
- Update bracket generation spec with new algorithm
- Show example bracket visuals for 19 players

---

## 🧪 Test Cases

Add these validations:
```python
def validate_bracket_balance(seeded: list, byes: int):
    """Check if byes are evenly distributed."""
    half = len(seeded) // 2
    left_byes = sum(1 for i in range(half) if seeded[i] is None)
    right_byes = sum(1 for i in range(half, len(seeded)) if seeded[i] is None)
    
    # Both halves should have ±1 of average
    avg_byes = byes / 2
    return abs(left_byes - avg_byes) <= 1 and abs(right_byes - avg_byes) <= 1
```
