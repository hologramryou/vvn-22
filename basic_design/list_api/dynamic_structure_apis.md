# API List: Dynamic Tournament Structure

**Version:** 1.1
**Date:** 2026-04-05
**Status:** Draft — Ready for AI Writer (YAML contract generation)
**Base URL:** `/tournaments/{tournament_id}`
**Auth:** Bearer JWT required for all endpoints
**Changelog:** v1.1 — CL-05: Kata là tournament-level setting, xóa node_id khỏi kata endpoints, xóa endpoints assign kata to node. CL-07: Thêm endpoint register VĐV (node + contest_types), thêm PATCH contest-types.

---

## Tổng quan endpoints

| # | Method | Path | Mô tả | Auth |
|---|--------|------|-------|------|
| 1 | GET | `/tournaments/{id}/weight-class-nodes` | Lấy full tree | All roles |
| 2 | POST | `/tournaments/{id}/weight-class-nodes` | Tạo node mới | Admin |
| 3 | PATCH | `/tournaments/{id}/weight-class-nodes/{node_id}` | Sửa node | Admin |
| 4 | DELETE | `/tournaments/{id}/weight-class-nodes/{node_id}` | Xóa node | Admin |
| 5 | POST | `/tournaments/{id}/weight-class-nodes/reorder` | Reorder siblings | Admin |
| 6 | POST | `/tournaments/{id}/weight-class-nodes/copy` | Copy từ giải cũ | Admin |
| 7 | GET | `/tournaments/{id}/weight-class-nodes/{node_id}/students` | VĐV của node | Admin, Referee |
| 8 | POST | `/tournaments/{id}/participants/{student_id}/register` | Đăng ký VĐV (node + contest_types) | Admin |
| 9 | POST | `/tournaments/{id}/participants/{student_id}/reassign` | Đổi node (hạng cân) cho VĐV | Admin |
| 10 | PATCH | `/tournaments/{id}/participants/{student_id}/contest-types` | Cập nhật nội dung thi đấu VĐV | Admin |
| 11 | GET | `/tournaments/{id}/participants/{student_id}` | Xem thông tin đăng ký VĐV | Admin, Referee |
| 12 | GET | `/tournaments/{id}/katas` | Danh sách bài quyền của giải | All roles |
| 13 | POST | `/tournaments/{id}/katas` | Tạo bài quyền | Admin |
| 14 | PATCH | `/tournaments/{id}/katas/{kata_id}` | Sửa bài quyền | Admin |
| 15 | DELETE | `/tournaments/{id}/katas/{kata_id}` | Xóa bài quyền | Admin |
| 16 | POST | `/tournaments/{id}/katas/reorder` | Reorder bài quyền | Admin |

**Đã xóa (so với v1.0):**
- ~~GET /nodes/{node_id}/contents~~ — không còn khái niệm "content gán vào node"
- ~~POST /nodes/{node_id}/contents~~ — kata không gán vào node
- ~~DELETE /nodes/{node_id}/contents/{content_id}~~ — idem

**Đã thêm (v1.1):**
- POST /participants/{student_id}/register — đăng ký VĐV với node + contest_types
- PATCH /participants/{student_id}/contest-types — cập nhật nội dung thi đấu
- GET /participants/{student_id} — xem thông tin đăng ký

---

## 1. GET `/tournaments/{id}/weight-class-nodes`

**Mô tả:** Lấy cấu trúc tree đầy đủ cho giải đấu.

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `format` | `tree` \| `flat` \| `statistics` | `tree` | Dạng response |

**Auth:** Bearer token, tất cả roles

**Response 200 — format=tree:**

```json
{
    "tournament_id": 1,
    "tournament_name": "Vovinam 2026",
    "tournament_status": "DRAFT",
    "tree": [
        {
            "id": 10,
            "parent_id": null,
            "level": 0,
            "node_type": "gender",
            "name": "Nam",
            "sort_order": 1,
            "min_age": null,
            "max_age": null,
            "student_count": 45,
            "children": [
                {
                    "id": 11,
                    "parent_id": 10,
                    "level": 1,
                    "node_type": "category",
                    "name": "Phong Trào",
                    "sort_order": 1,
                    "student_count": 30,
                    "children": [
                        {
                            "id": 12,
                            "parent_id": 11,
                            "level": 2,
                            "node_type": "group",
                            "name": "Loại 1A",
                            "sort_order": 1,
                            "min_age": 16,
                            "max_age": 18,
                            "student_count": 15,
                            "children": [
                                {
                                    "id": 13,
                                    "parent_id": 12,
                                    "level": 3,
                                    "node_type": "weight_class",
                                    "name": "45 kg",
                                    "sort_order": 1,
                                    "student_count": 5,
                                    "sparring_count": 3,
                                    "kata_count": 8,
                                    "bracket_status": "NOT_GENERATED",
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

**Response 200 — format=flat:**

```json
{
    "tournament_id": 1,
    "nodes": [
        {
            "id": 10,
            "parent_id": null,
            "level": 0,
            "node_type": "gender",
            "name": "Nam",
            "sort_order": 1,
            "student_count": 45
        },
        {
            "id": 11,
            "parent_id": 10,
            "level": 1,
            "node_type": "category",
            "name": "Phong Trào",
            "sort_order": 1,
            "student_count": 30
        }
    ],
    "total": 2
}
```

**Response 200 — format=statistics:**

```json
{
    "tournament_id": 1,
    "stats": {
        "total_nodes": 45,
        "by_level": {"0": 2, "1": 4, "2": 12, "3": 27},
        "leaf_nodes_with_students": 20,
        "leaf_nodes_empty": 7,
        "total_students_assigned": 285,
        "leaf_nodes_with_content": 22,
        "leaf_nodes_without_content": 5,
        "tree_is_complete": true,
        "can_generate_bracket": true
    }
}
```

**Error responses:**

```json
// 404
{"detail": {"code": "NOT_FOUND", "message": "Tournament không tồn tại"}}
```

---

## 2. POST `/tournaments/{id}/weight-class-nodes`

**Mô tả:** Tạo node mới trong tree.

**Auth:** Admin only

**Request body:**

```json
{
    "parent_id": 12,
    "name": "50 kg",
    "min_age": null,
    "max_age": null
}
```

**Lưu ý:** `level` và `node_type` tự động tính từ parent. Không nhận trong request.

**Response 201:**

```json
{
    "id": 99,
    "tournament_id": 1,
    "parent_id": 12,
    "level": 3,
    "node_type": "weight_class",
    "name": "50 kg",
    "sort_order": 4,
    "min_age": null,
    "max_age": null,
    "student_count": 0,
    "created_at": "2026-04-05T10:00:00Z"
}
```

**Error responses:**

```json
// 409 — name đã tồn tại trong cùng parent
{
    "detail": {
        "code": "DUPLICATE_NODE_NAME",
        "message": "Đã có node tên '50 kg' trong cùng nhóm này"
    }
}

// 422 — parent_id không thuộc cùng tournament
{
    "detail": {
        "code": "VALIDATION_ERROR",
        "message": "parent_id không hợp lệ"
    }
}

// 403 — tournament đã published + bracket đã sinh + không phải level 3
{
    "detail": {
        "code": "FORBIDDEN",
        "message": "Chỉ được thêm hạng cân (level 3) sau khi bracket đã sinh"
    }
}

// 403 — tournament ONGOING hoặc COMPLETED
{
    "detail": {
        "code": "FORBIDDEN",
        "message": "Không thể chỉnh sửa cấu trúc khi giải đang diễn ra"
    }
}
```

---

## 3. PATCH `/tournaments/{id}/weight-class-nodes/{node_id}`

**Mô tả:** Cập nhật tên hoặc age range của node. Không cho phép đổi parent hoặc level.

**Auth:** Admin only

**Request body (partial update):**

```json
{
    "name": "Loại 1A (Nâng cao)",
    "min_age": 16,
    "max_age": 18
}
```

**Không cho phép trong body:** `parent_id`, `level`, `node_type`, `tournament_id`

**Response 200:**

```json
{
    "id": 12,
    "name": "Loại 1A (Nâng cao)",
    "min_age": 16,
    "max_age": 18,
    "updated_at": "2026-04-05T10:05:00Z"
}
```

**Error responses:**

```json
// 404 — node không tồn tại hoặc không thuộc tournament này
{"detail": {"code": "NOT_FOUND", "message": "Node không tồn tại"}}

// 409 — name đã tồn tại trong cùng parent
{"detail": {"code": "DUPLICATE_NODE_NAME", "message": "..."}}
```

---

## 4. DELETE `/tournaments/{id}/weight-class-nodes/{node_id}`

**Mô tả:** Xóa node. Nếu có VĐV, phải chỉ định node đích để di chuyển VĐV.

**Auth:** Admin only

**Query params:**

| Param | Type | Required | Mô tả |
|-------|------|----------|-------|
| `move_to_node_id` | integer | Không — nhưng bắt buộc nếu có VĐV | Node đích để move VĐV |

**Behavior:**
1. Nếu node không có VĐV (kể cả descendants): xóa ngay
2. Nếu node có VĐV và `move_to_node_id` được cung cấp: move tất cả VĐV rồi xóa
3. Nếu node có VĐV và không có `move_to_node_id`: trả 409

**Response 200:**

```json
{
    "deleted_node_id": 13,
    "deleted_node_name": "45 kg",
    "students_moved": 5,
    "moved_to_node_id": 14,
    "moved_to_node_name": "48 kg",
    "audit_log": [
        {
            "student_id": 101,
            "student_name": "Nguyễn Văn A",
            "from_node_id": 13,
            "to_node_id": 14,
            "reason": "auto_moved_on_delete"
        }
    ]
}
```

**Error responses:**

```json
// 409 — có VĐV nhưng không cung cấp move_to_node_id
{
    "detail": {
        "code": "HAS_STUDENTS",
        "message": "Node có 5 VĐV. Vui lòng chỉ định move_to_node_id.",
        "student_count": 5
    }
}

// 409 — tournament đã published + bracket đã sinh
{
    "detail": {
        "code": "BRACKET_GENERATED",
        "message": "Không thể xóa node sau khi bracket đã được sinh"
    }
}

// 422 — move_to_node_id không phải level 3
{
    "detail": {
        "code": "VALIDATION_ERROR",
        "message": "move_to_node_id phải là hạng cân (level 3)"
    }
}
```

---

## 5. POST `/tournaments/{id}/weight-class-nodes/reorder`

**Mô tả:** Bulk reorder tất cả siblings (cùng parent). Frontend gửi sau khi drag-drop kết thúc.

**Auth:** Admin only

**Request body:**

```json
{
    "parent_id": 12,
    "nodes": [
        {"id": 15, "sort_order": 1},
        {"id": 13, "sort_order": 2},
        {"id": 14, "sort_order": 3}
    ]
}
```

**Validation:**
- Tất cả `id` phải là siblings (cùng `parent_id`)
- `sort_order` phải bắt đầu từ 1, liên tục, không gaps
- Số node trong request phải bằng số siblings thực tế

**Response 200:**

```json
{
    "parent_id": 12,
    "updated_count": 3,
    "nodes": [
        {"id": 15, "sort_order": 1, "name": "48 kg"},
        {"id": 13, "sort_order": 2, "name": "45 kg"},
        {"id": 14, "sort_order": 3, "name": "51 kg"}
    ]
}
```

**Error responses:**

```json
// 422 — nodes không cùng parent
{
    "detail": {
        "code": "VALIDATION_ERROR",
        "message": "Tất cả nodes phải là con của parent_id 12"
    }
}

// 422 — thiếu node (không đủ tất cả siblings)
{
    "detail": {
        "code": "VALIDATION_ERROR",
        "message": "Cần cung cấp đủ 3 nodes (hiện có 3 siblings)"
    }
}
```

---

## 6. POST `/tournaments/{id}/weight-class-nodes/copy`

**Mô tả:** Sao chép cấu trúc tree từ một giải đấu khác.

**Auth:** Admin only

**Precondition:** Target tournament (hiện tại) phải DRAFT và chưa có nodes nào.

**Request body:**

```json
{
    "source_tournament_id": 5,
    "include_katas": true
}
```

**Response 200:**

```json
{
    "source_tournament_id": 5,
    "source_tournament_name": "Vovinam 2025",
    "copied_nodes": 45,
    "copied_katas": 3,
    "message": "Đã sao chép cấu trúc thành công"
}
```

**Error responses:**

```json
// 404 — source tournament không tồn tại
{"detail": {"code": "NOT_FOUND", "message": "Giải nguồn không tồn tại"}}

// 409 — target tournament đã có nodes
{
    "detail": {
        "code": "TREE_NOT_EMPTY",
        "message": "Giải hiện tại đã có cấu trúc. Xóa trước khi sao chép."
    }
}

// 409 — target tournament không phải DRAFT
{
    "detail": {
        "code": "INVALID_STATUS",
        "message": "Chỉ có thể sao chép vào giải ở trạng thái DRAFT"
    }
}
```

---

## 7. GET `/tournaments/{id}/weight-class-nodes/{node_id}/students`

**Mô tả:** Lấy danh sách VĐV được assign vào node (và descendants nếu muốn).

**Auth:** Admin, Referee

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `include_descendants` | boolean | false | Bao gồm VĐV của các node con |

**Response 200:**

```json
{
    "node_id": 13,
    "node_name": "45 kg",
    "node_path": "Nam > Phong Trào > Loại 1A > 45 kg",
    "total_count": 5,
    "students": [
        {
            "assignment_id": 201,
            "student_id": 101,
            "full_name": "Nguyễn Văn A",
            "girdle": "Lam Đai I",
            "club_name": "CLB Quận 1",
            "assigned_at": "2026-04-01T09:00:00Z",
            "reason": "registered"
        }
    ]
}
```

---

## 8. POST `/tournaments/{id}/participants/{student_id}/register`

**Mô tả:** Admin đăng ký VĐV vào giải. VĐV chọn 1 node hạng cân (level 3) và các nội dung thi đấu.

**Auth:** Admin only

**Precondition:**
- VĐV chưa có assignment trong tournament này
- `node_id` phải là level 3 (WeightClass)
- Tournament phải DRAFT hoặc PUBLISHED (chưa ONGOING/COMPLETED)

**Request body:**

```json
{
    "node_id": 13,
    "contest_types": [
        { "type": "sparring" },
        { "type": "kata", "kata_id": 1 },
        { "type": "kata", "kata_id": 2 }
    ]
}
```

**Quy tắc `contest_types`:**
- Không được rỗng — ít nhất 1 entry
- `sparring`: tối đa 1 entry (không có `kata_id`)
- `kata`: mỗi entry phải có `kata_id` thuộc tournament này; không trùng nhau

**Response 201:**

```json
{
    "student_id": 101,
    "student_name": "Nguyễn Văn A",
    "tournament_id": 1,
    "node_id": 13,
    "node_path": "Nam > Phong Trào > Loại 1A > 45 kg",
    "contest_types": [
        { "id": 501, "type": "sparring", "kata_id": null, "kata_name": null },
        { "id": 502, "type": "kata", "kata_id": 1, "kata_name": "Quyền Cầu Thủ" },
        { "id": 503, "type": "kata", "kata_id": 2, "kata_name": "Quyền Thiếu Niên" }
    ],
    "registered_at": "2026-04-05T11:00:00Z"
}
```

**Error responses:**

```json
// 409 — VĐV đã đăng ký giải này
{
    "detail": {
        "code": "ALREADY_REGISTERED",
        "message": "VĐV đã đăng ký giải này (hạng: Nam > Phong Trào > Loại 1A > 45 kg)"
    }
}

// 422 — node không phải level 3
{"detail": {"code": "VALIDATION_ERROR", "message": "Phải chọn hạng cân (level 3)"}}

// 422 — contest_types rỗng
{"detail": {"code": "VALIDATION_ERROR", "message": "Phải chọn ít nhất 1 nội dung thi đấu"}}

// 422 — kata_id không thuộc tournament
{"detail": {"code": "VALIDATION_ERROR", "message": "Bài quyền #5 không thuộc giải này"}}

// 422 — sparring trùng
{"detail": {"code": "VALIDATION_ERROR", "message": "Chỉ được chọn đối kháng 1 lần"}}
```

---

## 9. POST `/tournaments/{id}/participants/{student_id}/reassign`

**Mô tả:** Admin chuyển VĐV sang hạng cân (node) khác trong cùng giải. Chỉ đổi node, không đổi contest_types.

**Auth:** Admin only

**Precondition:**
- Student phải đã được assign vào tournament
- New node phải là level 3 (leaf)
- Tournament không phải ONGOING/COMPLETED
- Nếu bracket đã sinh: không cho reassign (409)

**Request body:**

```json
{
    "new_weight_class_node_id": 14,
    "reason": "VĐV cân lại, cần đổi hạng"
}
```

**Response 200:**

```json
{
    "student_id": 101,
    "student_name": "Nguyễn Văn A",
    "from_node_id": 13,
    "from_node_path": "Nam > Phong Trào > Loại 1A > 45 kg",
    "to_node_id": 14,
    "to_node_path": "Nam > Phong Trào > Loại 1A > 48 kg",
    "reason": "VĐV cân lại, cần đổi hạng",
    "reassigned_at": "2026-04-05T11:00:00Z"
}
```

**Error responses:**

```json
// 404 — student chưa đăng ký giải này
{"detail": {"code": "NOT_REGISTERED", "message": "VĐV chưa đăng ký giải này"}}

// 409 — bracket đã sinh
{"detail": {"code": "BRACKET_GENERATED", "message": "Không thể reassign sau khi bracket đã sinh"}}

// 422 — new node không phải level 3
{"detail": {"code": "VALIDATION_ERROR", "message": "Phải chọn hạng cân (cấp 3)"}}
```

---

## 10. PATCH `/tournaments/{id}/participants/{student_id}/contest-types`

**Mô tả:** Admin cập nhật danh sách nội dung thi đấu của VĐV (thêm/xóa kata, thêm/xóa sparring). Không đổi node.

**Auth:** Admin only

**Precondition:**
- VĐV phải đã đăng ký tournament
- Tournament không phải ONGOING/COMPLETED
- Nếu bracket đã sinh: không cho thay đổi (409)

**Request body (full replace — gửi toàn bộ danh sách mới):**

```json
{
    "contest_types": [
        { "type": "sparring" },
        { "type": "kata", "kata_id": 3 }
    ]
}
```

**Response 200:**

```json
{
    "student_id": 101,
    "tournament_id": 1,
    "node_id": 13,
    "contest_types": [
        { "id": 510, "type": "sparring", "kata_id": null, "kata_name": null },
        { "id": 511, "type": "kata", "kata_id": 3, "kata_name": "Quyền Phổ Thông" }
    ],
    "updated_at": "2026-04-05T11:30:00Z"
}
```

**Error responses:**

```json
// 404 — VĐV chưa đăng ký
{"detail": {"code": "NOT_REGISTERED", "message": "VĐV chưa đăng ký giải này"}}

// 409 — bracket đã sinh
{"detail": {"code": "BRACKET_GENERATED", "message": "Không thể thay đổi nội dung thi đấu sau khi bracket đã sinh"}}

// 422 — contest_types rỗng
{"detail": {"code": "VALIDATION_ERROR", "message": "Phải chọn ít nhất 1 nội dung thi đấu"}}
```

---

## 11. GET `/tournaments/{id}/participants/{student_id}`

**Mô tả:** Xem thông tin đăng ký của 1 VĐV trong giải (node + contest_types).

**Auth:** Admin, Referee

**Response 200:**

```json
{
    "student_id": 101,
    "student_name": "Nguyễn Văn A",
    "tournament_id": 1,
    "node_id": 13,
    "node_path": "Nam > Phong Trào > Loại 1A > 45 kg",
    "contest_types": [
        { "id": 501, "type": "sparring", "kata_id": null, "kata_name": null },
        { "id": 502, "type": "kata", "kata_id": 1, "kata_name": "Quyền Cầu Thủ" }
    ],
    "registered_at": "2026-04-01T09:00:00Z"
}
```

**Error responses:**

```json
// 404 — VĐV chưa đăng ký
{"detail": {"code": "NOT_REGISTERED", "message": "VĐV chưa đăng ký giải này"}}
```

---

## 12. GET `/tournaments/{id}/katas`

**Mô tả:** Lấy danh sách bài quyền của giải đấu. Kata là setting chung của giải, không gán vào node.

**Auth:** All roles

**Response 200:**

```json
{
    "tournament_id": 1,
    "katas": [
        {
            "id": 1,
            "name": "Quyền Cầu Thủ",
            "description": "Dành cho phong trào 16-18 tuổi",
            "sort_order": 1,
            "students_selected_count": 15,
            "created_at": "2026-04-01T09:00:00Z"
        },
        {
            "id": 2,
            "name": "Quyền Thiếu Niên",
            "description": null,
            "sort_order": 2,
            "students_selected_count": 8,
            "created_at": "2026-04-01T09:00:00Z"
        }
    ],
    "total": 2
}
```

**Thay đổi so với v1.0:** Trường `used_by_nodes` bị xóa. Thay bằng `students_selected_count` — số VĐV đã chọn bài quyền này.

---

## 13. POST `/tournaments/{id}/katas`

**Mô tả:** Tạo bài quyền mới cho giải đấu.

**Auth:** Admin only

**Request body:**

```json
{
    "name": "Quyền Cầu Thủ",
    "description": "Dành cho phong trào 16-18 tuổi"
}
```

**Response 201:**

```json
{
    "id": 1,
    "tournament_id": 1,
    "name": "Quyền Cầu Thủ",
    "description": "Dành cho phong trào 16-18 tuổi",
    "sort_order": 1,
    "created_at": "2026-04-05T10:00:00Z"
}
```

**Error responses:**

```json
// 409 — tên trùng trong tournament
{"detail": {"code": "DUPLICATE_KATA_NAME", "message": "Đã có bài quyền tên này trong giải"}}
```

---

## 14. PATCH `/tournaments/{id}/katas/{kata_id}`

**Mô tả:** Sửa tên hoặc ghi chú bài quyền.

**Auth:** Admin only

**Request body (partial):**

```json
{
    "name": "Quyền Cầu Thủ (Nâng cao)",
    "description": "Cập nhật ghi chú"
}
```

**Response 200:**

```json
{
    "id": 1,
    "name": "Quyền Cầu Thủ (Nâng cao)",
    "description": "Cập nhật ghi chú",
    "updated_at": "2026-04-05T10:10:00Z"
}
```

---

## 15. DELETE `/tournaments/{id}/katas/{kata_id}`

**Mô tả:** Xóa bài quyền. Chỉ được xóa nếu không có VĐV nào đang chọn bài quyền này.

**Auth:** Admin only

**Response 200:**

```json
{"deleted_kata_id": 1, "message": "Đã xóa bài quyền"}
```

**Error responses:**

```json
// 409 — đang được VĐV chọn
{
    "detail": {
        "code": "KATA_IN_USE",
        "message": "Bài quyền đang được 15 VĐV chọn. Cập nhật nội dung thi đấu của các VĐV đó trước.",
        "affected_students_count": 15
    }
}
```

**Thay đổi so với v1.0:** Kiểm tra `student_contest_selections` thay vì `node_content_assignments`. Response trả `affected_students_count` thay vì `used_by_nodes`.

---

## 16. POST `/tournaments/{id}/katas/reorder`

**Mô tả:** Reorder danh sách bài quyền.

**Auth:** Admin only

**Request body:**

```json
{
    "katas": [
        {"id": 2, "sort_order": 1},
        {"id": 1, "sort_order": 2},
        {"id": 3, "sort_order": 3}
    ]
}
```

**Response 200:**

```json
{
    "updated_count": 3,
    "katas": [
        {"id": 2, "sort_order": 1, "name": "Quyền Thiếu Niên"},
        {"id": 1, "sort_order": 2, "name": "Quyền Cầu Thủ"},
        {"id": 3, "sort_order": 3, "name": "Quyền Phổ Thông"}
    ]
}
```

---

## Phân quyền tổng hợp

| Endpoint | Admin | Referee | Viewer | Club |
|----------|:-----:|:-------:|:------:|:----:|
| GET tree | ✅ | ✅ | ✅ | ✅ |
| POST node | ✅ | ❌ | ❌ | ❌ |
| PATCH node | ✅ | ❌ | ❌ | ❌ |
| DELETE node | ✅ | ❌ | ❌ | ❌ |
| POST reorder | ✅ | ❌ | ❌ | ❌ |
| POST copy | ✅ | ❌ | ❌ | ❌ |
| GET node students | ✅ | ✅ | ❌ | ❌ |
| POST register | ✅ | ❌ | ❌ | ❌ |
| POST reassign | ✅ | ❌ | ❌ | ❌ |
| PATCH contest-types | ✅ | ❌ | ❌ | ❌ |
| GET participant | ✅ | ✅ | ❌ | ❌ |
| GET katas | ✅ | ✅ | ✅ | ✅ |
| POST/PATCH/DELETE kata | ✅ | ❌ | ❌ | ❌ |
| POST kata reorder | ✅ | ❌ | ❌ | ❌ |

**Đã xóa (so với v1.0):**
- GET/POST/DELETE `/nodes/{node_id}/contents` — không còn tồn tại (kata không gán vào node)

---

## Error Code Registry

| Code | HTTP | Mô tả |
|------|------|-------|
| `NOT_FOUND` | 404 | Tournament, node, kata không tồn tại |
| `FORBIDDEN` | 403 | Không đủ quyền hoặc tournament status không cho phép |
| `DUPLICATE_NODE_NAME` | 409 | Tên node trùng trong cùng parent |
| `DUPLICATE_KATA_NAME` | 409 | Tên kata trùng trong cùng tournament |
| `HAS_STUDENTS` | 409 | Node có VĐV, cần chỉ định move_to |
| `TREE_NOT_EMPTY` | 409 | Target tree đã có nodes khi copy |
| `BRACKET_GENERATED` | 409 | Hành động không được phép sau khi bracket đã sinh |
| `KATA_IN_USE` | 409 | Kata đang được VĐV chọn, không xóa được |
| `NOT_REGISTERED` | 404 | VĐV chưa đăng ký giải |
| `ALREADY_REGISTERED` | 409 | VĐV đã đăng ký giải này (trùng node) |
| `INVALID_STATUS` | 409 | Tournament status không phù hợp với hành động |
| `VALIDATION_ERROR` | 422 | Input không hợp lệ |
| `TREE_VALIDATION_FAILED` | 422 | Tree chưa đủ điều kiện generate bracket |

**Đã xóa (so với v1.0):** `DUPLICATE_CONTENT` — không còn endpoint assign content vào node.
