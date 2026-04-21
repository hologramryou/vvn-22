# Spec: Refactor Bracket Generation — Dynamic Tree Integration

**Version:** 1.0
**Date:** 2026-04-05
**Status:** Draft — Ready for AI Writer
**Priority:** Pha 2 (sau khi Tree CRUD hoàn thành)
**Dependency:** tree_node_management.md, kata_management.md

---

## 1. Mục tiêu

Cập nhật logic sinh bracket để **đọc từ dynamic tree** thay vì từ `tournament_weight_classes` cũ.

Tất cả thuật toán hiện tại (slot calculation, BYE distribution, auto-advance, match codes) giữ nguyên. Chỉ thay đổi **nguồn dữ liệu** và **query logic**.

---

## 2. Breaking Changes

### Change 1: Player Query — từ Weight Class cũ sang Tree Node

**Hiện tại (OLD):**

```python
# Đọc từ bảng tournament_weight_classes (cấu trúc cứng)
players = await db.execute(
    select(Student)
    .join(TournamentParticipant)
    .join(TournamentWeightClass)
    .where(
        TournamentWeightClass.id == weight_class_id,
        TournamentWeightClass.category == "phong_trao",
        TournamentWeightClass.age_type_code == "1A",
        TournamentWeightClass.weight_class_name == "45kg"
    )
)
```

**Tương lai (NEW):**

```python
# Đọc từ student_weight_assignments → tournament_weight_class_nodes
assignments = await db.execute(
    select(StudentWeightAssignment)
    .join(TournamentWeightClassNode)
    .where(
        StudentWeightAssignment.tournament_id == tournament_id,
        StudentWeightAssignment.weight_class_node_id == node_id,
        TournamentWeightClassNode.level == 3  # chỉ leaf nodes
    )
)
students = [a.student for a in assignments.all()]
```

**Impact:**
- Bracket generation nhận `node_id` (leaf level 3) thay vì `weight_class_id`
- Pre-check: node phải tồn tại và là level 3
- Error message khi không đủ VĐV phải reference node name, không phải code cũ

### Change 2: Content Type Detection — từ age_type_code sang node_content_assignments

**Hiện tại (OLD):**

```python
# age_type_code = '5' → Quyền (hội diễn)
# age_type_code khác → Đối kháng
if weight_class.age_type_code == '5':
    generate_quyen_slot(...)
else:
    generate_bracket_match(...)
```

**Tương lai (NEW):**

```python
# Đọc content assignments từ node
contents = await get_node_contents(db, node_id)
for content in contents:
    if content.content_type == 'kata':
        generate_quyen_slot(node, content.kata)
    elif content.content_type == 'sparring':
        generate_bracket_match(node)
```

**Impact:**
- Một node có thể có cả quyền lẫn đối kháng → sinh cả hai loại
- Node không có content assignment → skip (warning, không error)

### Change 3: Secondary Registration — sparring + kata auto-link

**Logic cũ (ngầm định):**

```python
# Nếu student "phong_trao" loại "5" + sparring:
# → Tự động register cả age_type_code="4"
# Nếu student "phong_trao" loại != "5" + quyen_selections:
# → Tự động register cả age_type_code="5"
```

**Logic mới (explicit):**

Không còn auto-registration ngầm. Admin phải:
1. Tạo explicit nodes cho tất cả nội dung thi đấu trong tree
2. Node có `content_type='sparring'` và `content_type='kata'` riêng biệt
3. VĐV được assign vào 1 node level 3 — bracket gen tự nhìn vào content assignments của node đó

**Validation khi generate:**
- Nếu node có cả 'sparring' và 'kata' nhưng không có đủ VĐV cho sparring → warning
- Nếu node chỉ có 'kata' → tạo quyen_slot, không tạo bracket match

---

## 3. Backward Compatibility Strategy

### Tournaments đã tạo (dùng schema cũ)

**Vấn đề:** Tournaments cũ có `tournament_weight_classes` và `tournament_participants`. Không có `tournament_weight_class_nodes` và `student_weight_assignments`.

**Chiến lược: Dual-path trong code**

```python
async def generate_matches_for_tournament(tournament_id: int, db: AsyncSession):
    tournament = await get_tournament(db, tournament_id)
    
    # Detect schema version
    has_new_tree = await check_new_tree_exists(db, tournament_id)
    
    if has_new_tree:
        # NEW PATH: sử dụng tournament_weight_class_nodes
        await generate_from_tree(tournament_id, db)
    else:
        # OLD PATH: sử dụng tournament_weight_classes (legacy)
        await generate_from_weight_classes(tournament_id, db)
```

**Detect method:**

```python
async def check_new_tree_exists(db: AsyncSession, tournament_id: int) -> bool:
    result = await db.execute(
        select(func.count(TournamentWeightClassNode.id))
        .where(TournamentWeightClassNode.tournament_id == tournament_id)
    )
    return result.scalar() > 0
```

Tournaments cũ tiếp tục dùng `tournament_weight_classes` bình thường. Tournaments mới dùng tree.

### Migration plan (tùy chọn, không bắt buộc)

Nếu cần migrate tournaments cũ sang tree mới:

1. Tạo migration script: đọc `tournament_weight_classes` cũ → tạo tương đương trong `tournament_weight_class_nodes`
2. Copy `tournament_participants` → `student_weight_assignments`
3. Flag tournament đã migrate: thêm column `uses_tree_structure BOOLEAN DEFAULT FALSE` vào `tournaments`

**Quyết định:** Không bắt buộc migrate. Giữ dual-path. Tournaments mới tự động dùng tree.

---

## 4. Rules cần bảo tồn (không thay đổi)

### Rule 1: Minimum Players

```python
if len(players) < 2:
    raise ValueError("Tối thiểu 2 vận động viên")
    # Vẫn áp dụng, chỉ query source thay đổi
```

### Rule 2: Slot Calculation

```
slots = 2^ceil(log2(n))
# Logic KHÔNG ĐỔI
```

### Rule 3: BYE Distribution

```python
# Balanced BYE distribution (fix từ issue cũ)
# Logic KHÔNG ĐỔI
# Chỉ thay đổi input players list source
```

### Rule 4: Match Code Format

**Vấn đề mới:** Match code cũ có format `PT_1A_M_45_A_R1_001` dựa vào category/age_type_code cứng.

**Giải pháp:** Với tree mới, build match code từ tree path:

```python
def build_match_code_from_node(node: TournamentWeightClassNode) -> str:
    # Traverse tree từ leaf lên root để lấy path
    # Nam > Phong Trào > Loại 1A > 45kg
    # → "Nam_PhongTrao_Loai1A_45kg"
    path = await get_node_path(db, node.id)  # [gender, category, group, weight]
    parts = [slugify(n.name) for n in path]
    return "_".join(parts)
```

**Backward compat:** Tournaments cũ vẫn dùng format cũ. Format mới không cần backward compat vì chỉ dùng cho tournaments mới.

### Rule 5: Auto-Advance on BYE

```python
# Logic KHÔNG ĐỔI
if player2 is None:  # BYE
    status = "completed"
    winner_id = player1_id
```

### Rule 6: Auto-Advance on Match Completion

```python
# Logic KHÔNG ĐỔI
# next_match_id linking vẫn dùng
```

---

## 5. Validation Checklist trước khi Generate

Khi admin click "Generate Bracket", validate tree trước:

### Tree integrity checks

- [ ] Tournament có ít nhất 1 gender node (level 0)
- [ ] Mỗi gender có ít nhất 1 category (level 1)
- [ ] Mỗi category có ít nhất 1 group (level 2)
- [ ] Mỗi group có ít nhất 1 weight class (level 3)
- [ ] Ít nhất 1 leaf node có VĐV (>= 2 VĐV cho sparring, >= 1 cho kata)

### Content assignment checks

- [ ] Warning (không block): Leaf nodes không có content assignment
- [ ] Warning: Leaf nodes có content 'sparring' nhưng < 2 VĐV
- [ ] Info: Leaf nodes có content 'kata' nhưng 0 VĐV (skip silently)

### API response for validation

```json
POST /tournaments/{id}/generate-matches
Response 422 (validation failed):
{
    "code": "TREE_VALIDATION_FAILED",
    "message": "Cấu trúc tree không hợp lệ",
    "errors": [
        {
            "type": "insufficient_players",
            "node_id": 42,
            "node_path": "Nam > Phong Trào > Loại 1A > 45kg",
            "current_players": 1,
            "required": 2
        }
    ],
    "warnings": [
        {
            "type": "no_content_assigned",
            "node_id": 55,
            "node_path": "Nam > Phong Trào > Loại 1B > 50kg"
        }
    ]
}
```

---

## 6. Database Schema Changes

### Bảng cần tạo mới

| Bảng | File migration |
|------|---------------|
| `tournament_weight_class_nodes` | `007_add_dynamic_tree.py` |
| `student_weight_assignments` | `007_add_dynamic_tree.py` |
| `tournament_kata_definitions` | `007_add_dynamic_tree.py` |
| `node_content_assignments` | `007_add_dynamic_tree.py` |

### Bảng cũ — KHÔNG xóa, KHÔNG thay đổi

| Bảng | Lý do giữ |
|------|----------|
| `tournament_weight_classes` | Backward compat tournaments cũ |
| `tournament_participants` | Backward compat tournaments cũ |
| `bracket_matches` | Không đổi (chỉ thêm col nếu cần) |
| `quyen_slots` | Không đổi |

### Column mới trong `bracket_matches`

```sql
ALTER TABLE bracket_matches
    ADD COLUMN weight_class_node_id INTEGER 
        REFERENCES tournament_weight_class_nodes(id) ON DELETE SET NULL;
-- NULL = bracket từ cơ chế cũ (tournament_weight_classes)
-- NOT NULL = bracket từ tree mới
```

---

## 7. Acceptance Criteria (Bracket Generation after Tree)

- [ ] AC-BG-01: Generate bracket từ tree tạo đúng số match (2^n slots) như trước
- [ ] AC-BG-02: BYE distribution vẫn balanced
- [ ] AC-BG-03: Auto-advance vẫn hoạt động
- [ ] AC-BG-04: Leaf node có content 'sparring' → sinh bracket matches
- [ ] AC-BG-05: Leaf node có content 'kata' → sinh quyen_slots
- [ ] AC-BG-06: Leaf node có cả 2 content → sinh cả hai
- [ ] AC-BG-07: Tournaments cũ (không có tree) → bracket gen cũ vẫn hoạt động
- [ ] AC-BG-08: Node có < 2 VĐV cho sparring → API trả validation error rõ ràng
- [ ] AC-BG-09: Xóa node sau khi generate → không xóa được (409)
- [ ] AC-BG-10: Thêm leaf node sau khi generate → cho phép (không ảnh hưởng bracket đã sinh)

---

## 8. Implementation Sequence (gợi ý cho Implementer)

```
Bước 1: Migration (007_add_dynamic_tree.py)
  → Tạo 4 bảng mới
  → Thêm weight_class_node_id vào bracket_matches

Bước 2: Backend Models
  → TournamentWeightClassNode, StudentWeightAssignment
  → TournamentKataDefinition, NodeContentAssignment

Bước 3: Backend Repositories
  → TournamentTreeRepository (CRUD + tree queries)
  → StudentAssignmentRepository

Bước 4: Backend Routers
  → /tournaments/{id}/weight-class-nodes (CRUD, reorder, copy)
  → /tournaments/{id}/katas (CRUD, reorder)
  → /tournaments/{id}/weight-class-nodes/{node_id}/contents (CRUD)

Bước 5: Refactor generate_matches
  → Dual-path logic (detect tree vs legacy)
  → New tree path với validation

Bước 6: Frontend
  → TreeBuilder component
  → KataManagement component
  → ContentAssignment component
```

---

## 9. Liên kết

- `dynamic_structure_final_spec.md` — Source of truth cho dynamic structure
- `dynamic_structure_final_spec_addendum.md` — Clarifications chốt thêm
- `dynamic_structure_index.md` — Điều hướng file chuẩn vs legacy
- `tree_node_management.md` — Tree CRUD detail
- `kata_management.md` — Kata management detail
- `bracket_generation.md` — Logic bracket hiện tại (tham khảo)
- `basic_design/list_api/dynamic_structure_apis.md` — API contracts

