# Spec: Dynamic Weight Class Hierarchy Management

**Version:** 1.0  
**Date:** 2026-04-05  
**Status:** Draft (Ready for AI Writer)  
**Published by:** Clarification Phase

---

## 📋 Executive Summary

Thay thế hardcoded weight classes bằng **tree-based dynamic hierarchy** cho mỗi tournament. Admin có thể:
- ✅ Tạo/chỉnh sửa cấu trúc weight class per tournament
- ✅ Reorder nodes (chỉ trong cùng level, drag-drop)
- ✅ Gán constraints (contests, gender-specific)
- ✅ Copy tree từ tournament cũ
- ✅ Thay đổi chỉ khi chưa release; post-release chỉ thêm, không xóa

---

## 🎯 Business Requirements

### Clarification Answers (Confirmed)

| Câu hỏi | Trả lời | Ý nghĩa |
|--------|--------|---------|
| Per-tournament setup? | YES | Mỗi giải có tree riêng |
| Node naming? | Custom | Admin đặt tên tự do |
| Constraints? | YES | Mỗi weight class có contests + gender_specific |
| Reuse from old tournament? | YES | Copy tree structure |
| Delete weight class? | Move students | Auto-move sang class khác nếu có |
| Reassign student? | Yes | Student có thể đổi weight class |
| Post-release editing? | Add only | Can add nodes, NOT delete |

---

## 🏗️ Data Model

### Table: `tournament_weight_class_nodes`

```sql
CREATE TABLE tournament_weight_class_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tournament_weight_class_nodes(id) ON DELETE CASCADE,
  
  -- Hierarchy level (0-3)
  level INT NOT NULL CHECK (level BETWEEN 0 AND 3),
  -- 0: Gender (Nam/Nữ)
  -- 1: Category (Phong trào/Phổ thông)
  -- 2: Group (Loại 1A/1B, etc.)
  -- 3: Weight (45kg, 50kg, etc.)
  
  type VARCHAR(50) NOT NULL, -- 'gender', 'category', 'group', 'weight_class'
  name VARCHAR(255) NOT NULL, -- Custom name
  
  -- Metadata
  min_age INT,               -- Min age for this category
  max_age INT,               -- Max age for this category
  sort_order INT NOT NULL DEFAULT 0, -- For reordering
  
  -- Constraints JSON
  constraints JSONB DEFAULT '{}'::jsonb, -- {contests: ['sparring', 'kata'], gender_specific: true}
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Uniqueness: name must be unique within same parent + level
  UNIQUE(tournament_id, parent_id, name, level),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES tournament_weight_class_nodes(id) ON DELETE CASCADE
);

-- Index for quick tree traversal
CREATE INDEX idx_tournament_weight_class_parent 
  ON tournament_weight_class_nodes(tournament_id, parent_id, level);

CREATE INDEX idx_tournament_weight_class_sort 
  ON tournament_weight_class_nodes(tournament_id, parent_id, sort_order);
```

### Table: `student_weight_assignments`

Map student → leaf weight class nodes. Dùng để track khi reorder/delete.

```sql
CREATE TABLE student_weight_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  weight_class_node_id UUID NOT NULL REFERENCES tournament_weight_class_nodes(id),
  
  -- Student metadata at time of assignment
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  assigned_by_user_id UUID REFERENCES users(id),
  
  -- For audit trail
  previous_node_id UUID REFERENCES tournament_weight_class_nodes(id),
  reason VARCHAR(500), -- 'registered', 'moved', 'auto_moved_on_delete'
  
  UNIQUE(tournament_id, student_id), -- One assignment per tournament
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);
```

---

## 📊 Hierarchy Example

```
Tournament: Vovinam 2026

├─ Nam (gender_id, sort_order=1)
│  ├─ Phong trào (category_id, sort_order=1)
│  │  ├─ Loại 1A (group_id, sort_order=1)
│  │  │  ├─ 45kg (weight_id, sort_order=1)
│  │  │  ├─ 48kg (weight_id, sort_order=2)
│  │  │  └─ 51kg (weight_id, sort_order=3)
│  │  └─ Loại 1B (group_id, sort_order=2)
│  │     ├─ 48kg (weight_id, sort_order=1)
│  │     └─ 52kg (weight_id, sort_order=2)
│  └─ Phổ thông (category_id, sort_order=2)
│     ├─ Loại 1 (group_id, sort_order=1)
│     │  ├─ 50kg (weight_id, sort_order=1)
│     │  └─ 55kg (weight_id, sort_order=2)
│     └─ Loại 2 (group_id, sort_order=2)
│        └─ 60kg (weight_id, sort_order=1)
│
└─ Nữ (gender_id, sort_order=2)
   ├─ Phong trào (category_id, sort_order=1)
   │  ├─ Loại 1A (group_id, sort_order=1)
   │  │  ├─ 40kg (weight_id, sort_order=1)
   │  │  └─ 45kg (weight_id, sort_order=2)
   │  └─ Loại 1B (group_id, sort_order=2)
   │     └─ 45kg (weight_id, sort_order=1)
   └─ Phổ thông (category_id, sort_order=1)
      └─ Loại 1 (group_id, sort_order=1)
         └─ 50kg (weight_id, sort_order=1)
```

---

## 🔗 API Endpoints

### 1. GET `/tournaments/{tournament_id}/weight-classes`

**Purpose:** Fetch full tree structure  
**Permissions:** Admin, Referee, Viewer, Club  
**Query Params:**
- `format=tree` (default) | `format=flat` | `format=statistics`

**Response (format=tree):**
```json
{
  "tournament_id": "uuid-123",
  "tree": [
    {
      "id": "node-1",
      "type": "gender",
      "level": 0,
      "name": "Nam",
      "sort_order": 1,
      "constraints": {},
      "children": [
        {
          "id": "node-2",
          "type": "category",
          "level": 1,
          "name": "Phong trào",
          "sort_order": 1,
          "constraints": {},
          "children": [
            {
              "id": "node-3",
              "type": "group",
              "level": 2,
              "name": "Loại 1A",
              "sort_order": 1,
              "constraints": {},
              "children": [
                {
                  "id": "node-4",
                  "type": "weight_class",
                  "level": 3,
                  "name": "45kg",
                  "sort_order": 1,
                  "constraints": {"contests": ["sparring", "kata"], "gender_specific": false},
                  "student_count": 5,
                  "children": []
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Response (format=flat):**
```json
{
  "nodes": [
    {"id": "node-1", "parent_id": null, "level": 0, "type": "gender", "name": "Nam", ...},
    {"id": "node-2", "parent_id": "node-1", "level": 1, "type": "category", "name": "Phong trào", ...},
    ...
  ]
}
```

**Response (format=statistics):**
```json
{
  "total_nodes": 45,
  "levels": {
    "0": 2,    // 2 genders
    "1": 4,    // 4 categories
    "2": 12,   // 12 groups
    "3": 27    // 27 weight classes
  },
  "students_mapped": 285,
  "unmapped_students": 3,
  "tree_is_complete": true,
  "can_publish": true
}
```

---

### 2. POST `/tournaments/{tournament_id}/weight-classes`

**Purpose:** Create new node  
**Permissions:** Admin only  
**Body:**
```json
{
  "parent_id": "node-2",  // parentของ node ที่จะเพิ่ม (if null, top-level)
  "name": "50kg",
  "type": "weight_class",  // enum: gender, category, group, weight_class
  "min_age": null,
  "max_age": null,
  "constraints": {
    "contests": ["sparring", "kata"],
    "gender_specific": false
  }
}
```

**Response:**
```json
{
  "id": "node-new",
  "tournament_id": "uuid-123",
  "parent_id": "node-2",
  "level": 3,
  "type": "weight_class",
  "name": "50kg",
  "sort_order": 1,
  "constraints": {...},
  "created_at": "2026-04-05T10:00:00Z"
}
```

**Validations:**
- ✅ Level auto-calculated from parent
- ✅ Name unique within parent + level
- ✅ Type must match level (level 0 → gender, level 1 → category, etc.)
- ❌ CANNOT add if tournament is PUBLISHED (unless adding to level 3 only)

---

### 3. PATCH `/tournaments/{tournament_id}/weight-classes/{node_id}`

**Purpose:** Update node  
**Permissions:** Admin only  
**Body (partial update):**
```json
{
  "name": "New Name",
  "constraints": {
    "contests": ["sparring"],
    "gender_specific": true
  }
}
```

**NOT allowed:**
- ❌ `parent_id` (structure immutable)
- ❌ `type` (structure immutable)
- ❌ `level` (auto-calculated)

**Response:**
```json
{
  "id": "node-id",
  "name": "New Name",
  "constraints": {...},
  "updated_at": "2026-04-05T10:02:00Z"
}
```

---

### 4. POST `/tournaments/{tournament_id}/weight-classes/reorder`

**Purpose:** Bulk reorder nodes in same parent  
**Permissions:** Admin only  
**Body:**
```json
{
  "moves": [
    {
      "id": "node-4",
      "sort_order": 1
    },
    {
      "id": "node-5",
      "sort_order": 2
    },
    {
      "id": "node-6",
      "sort_order": 3
    }
  ]
}
```

**Validations:**
- ✅ All nodes must have same parent_id
- ✅ sort_order must be unique within parent
- ✅ No gaps in sort_order (1, 2, 3, ...)

**Response:**
```json
{
  "success": true,
  "updated_count": 3,
  "nodes": [
    {"id": "node-4", "sort_order": 1},
    {"id": "node-5", "sort_order": 2},
    {"id": "node-6", "sort_order": 3}
  ]
}
```

---

### 5. DELETE `/tournaments/{tournament_id}/weight-classes/{node_id}`

**Purpose:** Delete node + auto-move students  
**Permissions:** Admin only  
**Query Params:**
- `move_to_node_id` (optional): Target node for student reassignment
- `action=force` (optional, admin only): Force delete (for cleanup)

**Pre-conditions:**
- ❌ CANNOT delete if tournament is PUBLISHED
- ✅ Can delete if DRAFT / unpublished

**Behavior (if node has student assignments):**
1. If `move_to_node_id` provided:
   - Auto-move all students to target node
   - Create audit records reason="auto_moved_on_delete"
2. If no `move_to_node_id`:
   - Find sibling weight class (same parent)
   - Move students to sibling
   - If no sibling, move to parent's sibling (next-level)
   - If unsuccessful, return 409 Conflict

**Response:**
```json
{
  "success": true,
  "deleted_node_id": "node-id",
  "students_moved": 5,
  "moved_to_node_id": "node-sibling",
  "audit_trail": [
    {
      "student_id": "st-1",
      "from_node": "node-id",
      "to_node": "node-sibling",
      "reason": "auto_moved_on_delete"
    }
  ]
}
```

---

### 6. POST `/tournaments/{tournament_id}/weight-classes/copy`

**Purpose:** Copy tree from another tournament  
**Permissions:** Admin only  
**Body:**
```json
{
  "source_tournament_id": "uuid-old-tournament",
  "include_students": false  // If true, copy student assignments too
}
```

**Response:**
```json
{
  "success": true,
  "copied_nodes": 45,
  "source_tournament_id": "uuid-old-tournament",
  "message": "Weight class structure copied successfully"
}
```

---

### 7. GET `/tournaments/{tournament_id}/weight-classes/{node_id}/students`

**Purpose:** List students assigned to node (and descendants if specified)  
**Permissions:** Admin, Referee, Viewer  
**Query Params:**
- `include_descendants=true` (default: false)
- `filter_by_status=ACTIVE|CONFIRMED|REJECTED`

**Response:**
```json
{
  "node_id": "node-4",
  "node_name": "45kg",
  "students": [
    {
      "id": "st-1",
      "full_name": "Nguyễn Văn A",
      "girdle": "Yellow",
      "club": "CLB Sư Phụ",
      "assigned_at": "2026-04-05T09:00:00Z"
    }
  ],
  "total_count": 5
}
```

---

### 8. POST `/tournaments/{tournament_id}/students/{student_id}/reassign-weight-class`

**Purpose:** Move student to different weight class  
**Permissions:** Admin only  
**Body:**
```json
{
  "new_weight_class_node_id": "node-new",
  "reason": "Student re-weighed, needed to change class"
}
```

**Validations:**
- ✅ Student must be assigned to tournament
- ✅ New node must be leaf (weight class level)
- ✅ New node must be same tournament
- ❌ CANNOT reassign if tournament PUBLISHED and bracket generated

**Response:**
```json
{
  "success": true,
  "student_id": "st-1",
  "from_weight_class": "45kg",
  "to_weight_class": "48kg",
  "reassigned_at": "2026-04-05T10:05:00Z"
}
```

---

## 🎨 UI Specs

### Screen 1: Weight Class Tree Builder

**URL:** `/tournaments/{id}/setup/weight-classes`  
**Permissions:** Admin only

**Components:**
1. **Header**
   - Tournament name + Status badge
   - Action buttons: [Copy from...] [Export] [Reset]

2. **Tree View (Main)**
   - Expandable/collapsible nodes
   - Drag-drop reorder (ONLY within same level)
   - Icon badges: 👥 (student count), ⚠️ (has children)
   - Color coding by level

3. **Node Actions**
   - 📝 Edit name + constraints
   - ➕ Add child node
   - 🗑️ Delete (with move dialog)
   - 🔗 View students

4. **Constraints Editor (Modal)**
   - Checkboxes: Sparring? Kata?
   - Toggle: Gender-specific?
   - Min/Max age sliders

**Drag-Drop Rules:**
```javascript
// Allowed:
- Drag between nodes of same parent
- Reorder siblings

// NOT allowed:
- Drag child out of current parent
- Drag between genders
- Drag between categories
- Change structure mid-tournament
```

### Screen 2: Weight Class Management

**URL:** `/tournaments/{id}/weight-classes`  
**Permissions:** Admin, Referee, Viewer

**Components:**
1. **Tree View (Read-only)** - show student counts per leaf node
2. **Statistics Panel**
   - Total nodes: X
   - Total students: Y
   - Unmapped: Z
3. **Action Panel (Admin only)**
   - [Edit Structure] → Screen 1
   - [Reassign Student]
   - [Copy from Tournament]

---

## 🔐 State Machine & Constraints

### Tournament Status → Weight Class Actions

```
DRAFT
├─ ✅ Create nodes
├─ ✅ Update nodes
├─ ✅ Delete nodes
├─ ✅ Reorder nodes
└─ ✅ Reassign students

PUBLISHED
├─ ✅ Add leaf nodes (weight classes) ONLY
├─ ❌ Delete any nodes
├─ ✅ Reorder nodes
├─ ✅ Reassign students (if no bracket)
└─ ❌ Change parent relationships

ONGOING
├─ ❌ Add/edit/delete nodes
├─ ❌ Reorder nodes
└─ ✅ Reassign students (limited)

COMPLETED
└─ ❌ All mutating operations locked
```

---

## 🔄 Data Flow: Student Registration → Weight Class Assignment

```
1. Student registers for tournament
   │
   ├─ Select girdle (Vàng, Xanh, Nâu, Đen)
   │
   ├─ System fetches weight class tree for tournament
   │  (filtered by: girdle mapping)
   │
   ├─ Admin/System selects weight class node
   │  (end user: category → group → weight)
   │
   ├─ Create row in student_weight_assignments
   │  (student_id, tournament_id, weight_class_node_id)
   │
   └─ Ready for bracket generation
```

---

## 🧪 Test Cases

### Case 1: Create complete tree structure
- Create Gender (Nam)
- Create Category under Nam (Phong trào)
- Create Group under Phong trào (Loại 1A)
- Create Weight under Loại 1A (45kg)
- Verify tree structure via GET endpoint

### Case 2: Reorder siblings
- Create 3 weight classes: 45kg, 48kg, 51kg
- Drag 51kg to position 1
- Verify sort_order updates correctly

### Case 3: Delete with student auto-move
- Assign 5 students to 45kg weight class
- Delete 45kg weight class
- Verify students auto-moved to sibling (48kg)
- Verify audit trail created

### Case 4: Copy tree from old tournament
- Create tournament A with full tree (10 nodes)
- Create tournament B
- Copy tree from A to B
- Verify structure identical, no students copied

### Case 5: Reassign student weight class
- Student assigned to 45kg
- Reassign to 48kg
- Verify bracket generation still works (if pre-bracket)

### Case 6: Post-publish constraints
- Publish tournament
- Try to delete weight class → ❌ Fail
- Try to add weight class → ✅ Success
- Try to change parent → ❌ Fail

---

## 🚀 Implementation Priority

### Phase 1 (High Priority)
- [ ] Database schema + migrations
- [ ] CRUD endpoints (GET, POST, PATCH, DELETE)
- [ ] Reorder endpoint
- [ ] Tree builder UI (basic)

### Phase 2 (Medium Priority)
- [ ] Copy tournament endpoint
- [ ] Reassign student endpoint
- [ ] Constraints editor UI
- [ ] Student auto-movement on delete

### Phase 3 (Nice to Have)
- [ ] Drag-drop with visual feedback
- [ ] Tree statistics
- [ ] Export tree as JSON/CSV

---

## 📝 Notes

- **Immutability:** Never allow `parent_id` or `type` changes once created
- **Audit:** Log all changes to `tournament_weight_class_nodes` for audit trail
- **Cascading delete:** When delete tournament → all nodes deleted automatically
- **Level validation:** Enforce level 0-3 strictly; auto-calculate from parent
- **Silo per tournament:** Nodes are completely isolated per tournament_id

---

## ✅ Ready for Next Phase

This spec is **ready for AI-Writer Phase 2** to generate:
1. OpenAPI YAML contracts for all endpoints
2. Pydantic schemas for request/response
3. SQLAlchemy models
4. React components for UI
