# Spec: Quản lý Tree Nodes (Weight Class Hierarchy)

**Version:** 1.1
**Date:** 2026-04-05
**Status:** Draft — Ready for AI Writer
**Dependency:** dynamic_structure_final_spec.md
**See also:** dynamic_structure_index.md
**Changelog:** v1.1 — CL-07: VĐV chỉ thuộc 1 node duy nhất per tournament. Khi đăng ký chọn node + contest_types (sparring/kata). Thêm API register + reassign contest_types.

---

## 1. Mô tả tính năng

Admin quản lý toàn bộ cây phân cấp hạng cân cho một giải đấu cụ thể. Cây gồm 4 cấp:

- **Cấp 0 (Gender):** Giới tính — Nam / Nữ
- **Cấp 1 (Category):** Loại hình — Phong trào, Phổ thông, v.v.
- **Cấp 2 (Group):** Nhóm — Loại 1A, Loại 1B, v.v.
- **Cấp 3 (WeightClass):** Hạng cân — 45kg, 48kg, v.v. (leaf node)

---

## 2. Data Model

### Bảng: `tournament_weight_class_nodes`

```sql
CREATE TABLE tournament_weight_class_nodes (
    id              SERIAL PRIMARY KEY,
    tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    parent_id       INTEGER REFERENCES tournament_weight_class_nodes(id) ON DELETE CASCADE,
    level           SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 3),
    node_type       VARCHAR(20) NOT NULL,
    -- 'gender' | 'category' | 'group' | 'weight_class'
    name            VARCHAR(100) NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 1,
    min_age         SMALLINT,
    max_age         SMALLINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_node_name_per_parent UNIQUE (tournament_id, parent_id, name),
    CONSTRAINT chk_level_type CHECK (
        (level = 0 AND node_type = 'gender') OR
        (level = 1 AND node_type = 'category') OR
        (level = 2 AND node_type = 'group') OR
        (level = 3 AND node_type = 'weight_class')
    )
);

CREATE INDEX idx_twcn_tournament_parent ON tournament_weight_class_nodes (tournament_id, parent_id, sort_order);
CREATE INDEX idx_twcn_tournament_level  ON tournament_weight_class_nodes (tournament_id, level);
```

**Lý do dùng Integer thay UUID:** Tournament hiện tại dùng Integer PK. Giữ nhất quán để tránh migration phức tạp.

**Lý do dùng adjacency list:**
- Insert/delete đơn giản — chỉ update parent_id
- 4 cấp cố định — không cần recursive CTE phức tạp cho hầu hết query
- Sort order quản lý riêng, không phải encode vào nested set

### Bảng: `student_weight_assignments`

Lưu VĐV thuộc node hạng cân nào. Mỗi VĐV chỉ có 1 node trong toàn giải.

```sql
CREATE TABLE student_weight_assignments (
    id                  SERIAL PRIMARY KEY,
    tournament_id       INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    weight_class_node_id INTEGER NOT NULL REFERENCES tournament_weight_class_nodes(id),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id INTEGER REFERENCES users(id),
    previous_node_id    INTEGER REFERENCES tournament_weight_class_nodes(id),
    reason              VARCHAR(200) NOT NULL DEFAULT 'registered',
    -- 'registered' | 'moved' | 'auto_moved_on_delete' | 'admin_reassign'

    CONSTRAINT uq_student_tournament UNIQUE (tournament_id, student_id)
);

CREATE INDEX idx_swa_node ON student_weight_assignments (weight_class_node_id);
CREATE INDEX idx_swa_tournament ON student_weight_assignments (tournament_id);
```

**Ràng buộc quan trọng (CL-07):**
- Mỗi VĐV chỉ có **1 record** trong `student_weight_assignments` per tournament (`UNIQUE tournament_id, student_id`)
- VĐV không thể thuộc 2 node khác nhau trong cùng 1 giải
- Nội dung thi đấu (sparring, kata) được lưu riêng trong bảng `student_contest_selections` (xem `kata_management.md`)

**Luồng đăng ký đầy đủ:**

```
POST /tournaments/{id}/participants/{student_id}/register
  Body: {
    node_id: <level-3 node>,
    contest_types: [
      { type: "sparring" },
      { type: "kata", kata_id: 1 },
      { type: "kata", kata_id: 2 }
    ]
  }
  → Tạo 1 record trong student_weight_assignments
  → Tạo N records trong student_contest_selections
```

---

## 3. Business Rules

### BLM-01: Quy tắc tạo node

| Rule | Chi tiết |
|------|---------|
| Level tự động | Level = parent.level + 1; không tự nhập |
| Type theo level | level 0 → gender; 1 → category; 2 → group; 3 → weight_class |
| Name unique trong parent | Không thể có 2 node cùng tên trong cùng một parent |
| Sort order tự gán | Khi tạo mới: sort_order = max(siblings) + 1 |
| Chỉ admin tạo | Các role khác không có quyền |

### BLM-02: Quy tắc reorder

| Rule | Chi tiết |
|------|---------|
| Chỉ trong cùng parent | Drag-drop chỉ đổi thứ tự giữa siblings (cùng parent_id) |
| Không reparent | Không thể kéo node sang parent khác qua drag-drop |
| Input: danh sách sort_order mới | API nhận [{id, sort_order}] cho tất cả siblings |
| Validate tính liên tục | sort_order phải là 1, 2, 3, ... không gaps |
| Validate cùng parent | Tất cả node trong request phải có cùng parent_id |

### BLM-03: Quy tắc xóa node

| Trường hợp | Hành vi |
|-----------|---------|
| Node không có VĐV | Xóa ngay, cascade xóa descendants |
| Node có VĐV, `move_to_node_id` được cung cấp | Move tất cả VĐV sang target, rồi xóa |
| Node có VĐV, không cung cấp `move_to_node_id` | Tìm sibling leaf gần nhất; nếu không có → trả về 409 |
| Target node không phải level 3 | Từ chối, trả về 422 |
| Node không phải leaf nhưng có VĐV ở descendants | Move tất cả VĐV xuống descendants trước khi xóa |

**Cascade khi xóa non-leaf node:**
- Xóa group → xóa tất cả weight classes con → auto-move VĐV trong đó
- Xóa category → cascade xóa tất cả groups và weight classes bên dưới
- Mỗi lần move VĐV tạo audit record với reason = 'auto_moved_on_delete'

### BLM-04: Ràng buộc theo Tournament Status

| Tournament Status | Bracket Status | Allowed Operations |
|------------------|---------------|-------------------|
| DRAFT | bất kỳ | Tất cả: create, update, delete, reorder, reassign |
| PUBLISHED | NOT_GENERATED | Tất cả: create, update, delete, reorder, reassign |
| PUBLISHED | GENERATED | Chỉ: thêm leaf (level 3), update tên, reorder |
| ONGOING | bất kỳ | Chỉ: xem (read-only) |
| COMPLETED | bất kỳ | Chỉ: xem (read-only) |

**Cách detect bracket status:** Query `bracket_matches` — nếu có ít nhất 1 record với `tournament_id` thì bracket đã sinh.

### BLM-05: Quy tắc sao chép từ giải cũ

| Rule | Chi tiết |
|------|---------|
| Source tournament phải tồn tại | Trả 404 nếu không tìm thấy |
| Target tournament phải đang DRAFT | Không copy vào giải đã publish |
| Tree target phải rỗng | Nếu target đã có nodes → trả 409; user phải tự xóa trước |
| Copy structure | Tạo nodes mới với ID mới, giữ nguyên tên/level/sort_order |
| Copy bài quyền | Tùy chọn riêng (xem kata_management.md) |
| Không copy VĐV | VĐV KHÔNG được copy (khác giải, khác người đăng ký) |

---

## 4. Validation Rules

### Khi tạo node mới (POST)

- [ ] `tournament_id` phải tồn tại
- [ ] Tournament status phải là DRAFT hoặc PUBLISHED (không ONGOING/COMPLETED)
- [ ] Nếu PUBLISHED + bracket đã sinh: chỉ cho phép tạo level 3
- [ ] `parent_id` phải tồn tại và thuộc cùng `tournament_id`
- [ ] `level` = parent.level + 1 (auto-calculated, không nhận từ request)
- [ ] `name` không trùng với siblings (cùng parent)
- [ ] `name` không rỗng, max 100 ký tự

### Khi reorder (POST /reorder)

- [ ] Tất cả `id` phải thuộc cùng một `parent_id`
- [ ] `sort_order` phải unique trong danh sách
- [ ] `sort_order` bắt đầu từ 1, liên tục (1,2,3,...), không gaps
- [ ] Số lượng nodes trong request phải bằng số siblings thực tế

### Khi xóa (DELETE)

- [ ] Tournament phải DRAFT hoặc (PUBLISHED + bracket chưa sinh)
- [ ] Nếu có VĐV và không cung cấp `move_to_node_id`: tìm sibling tự động
- [ ] `move_to_node_id` nếu cung cấp: phải là level 3, cùng tournament, không phải node đang xóa
- [ ] `move_to_node_id` là **1 target duy nhất** cho tất cả VĐV của node và mọi descendants (CL-03)
- [ ] Ghi audit log cho mỗi VĐV được di chuyển

### Khi đăng ký VĐV (POST /register)

- [ ] `node_id` phải là level 3 (WeightClass), thuộc cùng `tournament_id`
- [ ] VĐV chưa có assignment trong tournament — nếu đã có → 409 `ALREADY_REGISTERED`
- [ ] `contest_types` không rỗng — phải có ít nhất 1 entry
- [ ] Sparring: không quá 1 entry per VĐV per tournament
- [ ] Kata: mỗi `kata_id` phải thuộc `tournament_id`, không được trùng nhau trong request

### Khi copy từ giải cũ (POST /copy)

- [ ] `source_tournament_id` phải tồn tại và khác `tournament_id` hiện tại
- [ ] Target tournament (hiện tại) phải DRAFT
- [ ] Target tournament chưa có nodes nào

---

## 5. UI Screens

### Screen 1: Tree Builder (Admin only)

**URL:** `/tournaments/{id}/setup/weight-classes`

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Vovinam 2026 · DRAFT                                        │
│ [Sao chép từ giải khác]        [Xóa tất cả] [Thống kê]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nam (2 loại hình, 45 VĐV)                    [+ Thêm con] │
│  ├── Phong Trào (3 nhóm, 30 VĐV)              [+ Thêm con] │
│  │   ├── Loại 1A (3 hạng, 15 VĐV)            [+ Thêm con] │
│  │   │   ├── 45 kg (5 VĐV) [✏] [🗑]  [≡ drag] │
│  │   │   ├── 48 kg (7 VĐV) [✏] [🗑]  [≡ drag] │
│  │   │   └── 51 kg (3 VĐV) [✏] [🗑]  [≡ drag] │
│  │   └── Loại 1B ...                                       │
│  └── Phổ Thông ...                                         │
│                                                             │
│  Nữ (...)                                     [+ Thêm con] │
│  └── ...                                                    │
│                                                             │
│  [+ Thêm Giới tính]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Actions per node:**
- [✏] → Inline edit tên (PATCH)
- [🗑] → Xóa (DELETE) — hiện modal nếu có VĐV
- [≡ drag] → Handle kéo thả (POST /reorder)
- [+ Thêm con] → Form inline thêm child node (POST)

**Modal xóa node có VĐV:**

```
┌──────────────────────────────────────────┐
│ Xóa hạng cân "45 kg"?                   │
│                                          │
│ Có 5 VĐV đang ở hạng này.               │
│                                          │
│ Di chuyển VĐV sang:                      │
│ [Dropdown chọn hạng cân đích]            │
│                                          │
│ [Hủy]                [Xác nhận xóa]     │
└──────────────────────────────────────────┘
```

**Modal sao chép từ giải cũ:**

```
┌──────────────────────────────────────────┐
│ Sao chép cấu trúc từ giải khác           │
│                                          │
│ Chọn giải nguồn:                         │
│ [Dropdown danh sách tournaments]          │
│                                          │
│ [x] Sao chép cấu trúc hạng cân           │
│ [x] Sao chép danh sách bài quyền         │
│ [ ] Sao chép VĐV đăng ký                 │
│                                          │
│ [Hủy]            [Sao chép]              │
└──────────────────────────────────────────┘
```

### Screen 2: Weight Class View (Read-only cho Referee/Viewer)

**URL:** `/tournaments/{id}/weight-classes`

Giống Screen 1 nhưng không có action buttons. Hiển thị số VĐV per node, thống kê tổng.

---

## 6. Hành động → API Mapping

| Hành động UI | API |
|-------------|-----|
| Load tree | GET /tournaments/{id}/weight-class-nodes?format=tree |
| Thêm node | POST /tournaments/{id}/weight-class-nodes |
| Sửa tên node | PATCH /tournaments/{id}/weight-class-nodes/{node_id} |
| Xóa node | DELETE /tournaments/{id}/weight-class-nodes/{node_id} |
| Reorder (kéo thả xong) | POST /tournaments/{id}/weight-class-nodes/reorder |
| Sao chép giải cũ | POST /tournaments/{id}/weight-class-nodes/copy |
| Xem VĐV của node | GET /tournaments/{id}/weight-class-nodes/{node_id}/students |
| Đăng ký VĐV (chọn node + contest_types) | POST /tournaments/{id}/participants/{student_id}/register |
| Reassign VĐV sang node khác | POST /tournaments/{id}/participants/{student_id}/reassign |
| Cập nhật nội dung thi đấu VĐV | PATCH /tournaments/{id}/participants/{student_id}/contest-types |

---

## 7. Acceptance Criteria

- [ ] AC-TN-01: Admin tạo được tree 4 cấp đầy đủ cho giải mới
- [ ] AC-TN-02: Reorder chỉ hoạt động trong cùng parent; drag sang parent khác bị từ chối bởi UI
- [ ] AC-TN-03: Xóa node có VĐV → hiện modal chọn hạng đích → move thành công → audit log tạo
- [ ] AC-TN-04: Xóa node không có VĐV → xóa ngay không cần modal
- [ ] AC-TN-05: Sao chép từ giải cũ → tree mới giống hệt, không copy VĐV
- [ ] AC-TN-06: Sau khi publish + bracket sinh → thêm leaf vẫn được, xóa bị từ chối (403/409)
- [ ] AC-TN-07: Name trùng trong cùng parent → API trả 409 với message rõ
- [ ] AC-TN-08: Tree builder load ≤ 2 giây với 100 nodes
- [ ] AC-TN-09: Admin đăng ký VĐV: chọn 1 node + chọn sparring + 2 kata → 3 records trong student_contest_selections, 1 record trong student_weight_assignments
- [ ] AC-TN-10: Admin đăng ký VĐV vào node đã có assignment → API trả 409 ALREADY_REGISTERED
- [ ] AC-TN-11: 1 VĐV không thể đăng ký vào 2 node khác nhau trong cùng 1 giải (unique constraint enforced)

---

## 8. Liên kết

- `dynamic_structure_final_spec.md` — Source of truth cho dynamic structure
- `dynamic_structure_final_spec_addendum.md` — Clarifications chốt thêm
- `dynamic_structure_index.md` — Điều hướng file chuẩn vs legacy
- `kata_management.md` — Quản lý bài quyền
- `bracket_generation_refactor.md` — Thay đổi bracket gen
- `basic_design/list_api/dynamic_structure_apis.md` — API contracts chi tiết

