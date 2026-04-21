# Tổng quan: Cấu trúc Giải Đấu Động (Dynamic Tournament Structure)

> Note 2026-04-07: Sau khi review source hiện tại, file chuẩn để team bám implement là `dynamic_structure_final_spec.md`. Các clarifications chốt thêm về root nodes, cách hiển thị content thi đấu, và account migration theo giải nằm ở `dynamic_structure_final_spec_addendum.md`.

**Version:** 1.1
**Date:** 2026-04-05
**Status:** Draft — Chờ AI Writer sinh contracts
**Nguồn:** raw_request/dynamic_tournament_structure.md
**Author:** Hoàng
**Changelog:** v1.1 — CL-05/CL-07 confirmed: Kata là tournament-level setting; VĐV đăng ký chọn 1 node + nhiều contest_types.

---

## 1. Mục tiêu Feature

Thay thế cấu trúc hạng cân **fix cứng trong code** bằng hệ thống **tree động per giải đấu**.

### Vấn đề hiện tại

Trong schema hiện tại (`tournament_weight_classes`), mỗi hạng cân được mã hóa bằng 3 string fields cố định:

| Field | Ví dụ | Vấn đề |
|-------|-------|--------|
| `category` | `"phong_trao"` | Hard-coded enum |
| `age_type_code` | `"1A"`, `"1B"` | Hard-coded codes |
| `weight_class_name` | `"45kg"` | No validation |
| `gender` | `"M"` / `"F"` | OK nhưng tách biệt với tree |

Hệ quả: Không thể tùy chỉnh mỗi giải riêng; khi thêm loại hình mới phải sửa code và migration.

### Giải pháp

Thay bằng **adjacency list tree** với 4 cấp bậc cố định:

```
Cấp 0 — Gender:      Nam / Nữ
Cấp 1 — Category:    Phong Trào / Phổ Thông / (admin tùy đặt)
Cấp 2 — Group:       Loại 1A / 1B / ... (admin tùy đặt)
Cấp 3 — WeightClass: 45kg / 48kg / ... (admin tùy đặt)
```

Mỗi giải đấu có **tree riêng biệt** hoàn toàn, không chia sẻ với giải khác.

---

## 2. Actors & Use Cases

### Actors

| Actor | Mô tả |
|-------|-------|
| **Admin** | Toàn quyền CRUD cấu trúc tree, quản lý bài quyền |
| **Referee** | Xem cấu trúc (read-only) |
| **Viewer / Club** | Xem cấu trúc (read-only) |
| **System** | Auto-move VĐV khi xóa node; validate tree trước bracket gen |

### Use Cases chính

| ID | Actor | Use Case |
|----|-------|---------|
| UC-01 | Admin | Tạo cây hạng cân từ trên xuống (4 cấp) |
| UC-02 | Admin | Kéo thả sắp xếp thứ tự trong cùng cấp |
| UC-03 | Admin | Xóa hạng cân — tự động di chuyển VĐV sang hạng khác |
| UC-04 | Admin | Sao chép cấu trúc từ giải cũ |
| UC-05 | Admin | Tạo và quản lý danh sách bài quyền của giải (tournament-level) |
| UC-06 | Admin | Đăng ký VĐV: chọn 1 node hạng cân + chọn nội dung thi đấu (sparring/kata) |
| UC-07 | System | Validate tree đủ điều kiện trước khi sinh bracket |
| UC-08 | Admin | Reassign VĐV sang hạng cân khác trong cùng giải |

---

## 3. Tree Structure — Thiết kế đã xác nhận

### Adjacency List (lựa chọn cuối cùng)

Lý do chọn adjacency list thay vì nested set:
- Dễ insert/delete node đơn lẻ
- Cấp bậc cố định (0-3) nên không cần recursive query phức tạp
- Sort order được quản lý riêng bằng column `sort_order`

### Ví dụ cấu trúc thực tế

```
GIẢI VOVINAM 2026

Nam (level=0, sort_order=1)
  Phong Trào (level=1, sort_order=1, parent=Nam)
    Loại 1A (level=2, sort_order=1, parent=Phong Trào)
      45 kg (level=3, sort_order=1, parent=Loại 1A)
      48 kg (level=3, sort_order=2, parent=Loại 1A)
      51 kg (level=3, sort_order=3, parent=Loại 1A)
    Loại 1B (level=2, sort_order=2, parent=Phong Trào)
      50 kg (level=3, sort_order=1)
      55 kg (level=3, sort_order=2)
  Phổ Thông (level=1, sort_order=2, parent=Nam)
    Loại 1 (level=2, sort_order=1)
      50 kg (level=3, sort_order=1)
Nữ (level=0, sort_order=2)
  ...
```

### Ràng buộc quan trọng

| Ràng buộc | Mô tả |
|-----------|-------|
| Level 0 chỉ có 2 node | Nam và Nữ (admin đặt tên) |
| Name unique trong cùng parent | Không có 2 node cùng tên, cùng parent |
| Leaf node = level 3 | Chỉ level 3 mới gán VĐV trực tiếp |
| Sort order sequential | 1, 2, 3, ... không gaps |
| Drag-drop chỉ trong cùng parent | Không reparent qua drag-drop |

---

## 4. State Machine — Tournament Status vs. Quyền chỉnh sửa

```
DRAFT
├── Thêm node (tất cả cấp)         ✅
├── Xóa node                        ✅
├── Sửa tên node                    ✅
├── Reorder (kéo thả)               ✅
├── Đổi parent (reparent)           ✅
└── Reassign VĐV                    ✅

PUBLISHED + Bracket CHƯA sinh
├── Thêm node (tất cả cấp)         ✅
├── Xóa node                        ✅
├── Sửa tên                         ✅
├── Reorder                         ✅
└── Reassign VĐV                    ✅

PUBLISHED + Bracket ĐÃ sinh
├── Thêm leaf node (level 3 only)  ✅
├── Xóa node                        ❌
├── Sửa tên                         ✅
├── Reorder                         ✅
└── Reassign VĐV                    ❌

ONGOING / COMPLETED
└── Tất cả mutating operations      ❌
```

**Lưu ý quan trọng:** Spec gốc mô tả 2 sub-cases cho PUBLISHED:
- "Đã sinh bracket" → chỉ thêm leaf, không xóa
- "Chưa sinh bracket" → full edit như DRAFT

---

## 5. Phạm vi Feature (Scope)

### Pha 1 — Bắt buộc

| Feature | File spec chi tiết |
|---------|-------------------|
| CRUD tree nodes | tree_node_management.md |
| Reorder (drag-drop) | tree_node_management.md |
| Auto-move VĐV khi xóa | tree_node_management.md |
| Copy structure từ giải cũ | tree_node_management.md |

### Pha 2 — Quan trọng

| Feature | File spec chi tiết |
|---------|-------------------|
| Quản lý bài quyền (CRUD, tournament-level) | kata_management.md |
| Đăng ký VĐV: chọn node + contest_types | kata_management.md + tree_node_management.md |

### Pha 3 — Breaking Changes

| Feature | File spec chi tiết |
|---------|-------------------|
| Refactor bracket generation | bracket_generation_refactor.md |
| Migration từ schema cũ | bracket_generation_refactor.md |
| Backward compatibility | bracket_generation_refactor.md |

### Ngoài phạm vi (Out of scope)

- Export/Import cấu trúc dạng JSON/Excel
- So sánh cấu trúc 2 giải
- UI drag-drop visual feedback (phức tạp, nice-to-have)

---

## 6. Data Model Overview

### Bảng mới cần tạo

| Bảng | Mục đích |
|------|---------|
| `tournament_weight_class_nodes` | Adjacency list tree |
| `student_weight_assignments` | VĐV → leaf node mapping (unique per tournament) |
| `tournament_kata_definitions` | Danh sách bài quyền per giải (tournament-level, không gán vào node) |
| `student_contest_selections` | VĐV → nội dung thi đấu mapping (sparring + kata selections) |

**Đã loại bỏ:** `node_kata_assignments` — Kata không gán vào node (CL-05). Thay bằng `student_contest_selections` để lưu lựa chọn của từng VĐV.

### Bảng cũ cần migrate

| Bảng | Hành động |
|------|----------|
| `tournament_weight_classes` | Giữ lại cho tournaments cũ; không tạo mới |
| `tournament_participants` | Giữ lại cho tournaments cũ |

Chi tiết schema xem `bracket_generation_refactor.md`.

---

## 7. Clarifications — Đã xác nhận

Tất cả các điểm đã được user làm rõ:

| ID | Câu hỏi | Kết quả đã xác nhận |
|----|---------|---------------------|
| CL-01 | Sao chép giải cũ có bao gồm VĐV không? | Không copy VĐV. Copy kata definitions là tùy chọn riêng. |
| CL-02 | VĐV đăng ký — ai thực hiện? | Admin thêm VĐV thủ công. |
| CL-03 | Xóa Group/Category có VĐV ở descendants — move như thế nào? | 1 `move_to_node_id` chung cho TẤT CẢ descendants. |
| CL-04 | Integer hay UUID cho Tournament ID? | Giữ Integer ID. |
| CL-05 | Bài quyền gán vào node level nào? | Kata là setting chung của giải (tournament-level). Không gán vào node. |
| CL-06 | Cảnh báo khi node không có content? | Warning khi Generate Bracket, không block đăng ký. |
| CL-07 | VĐV thi cả Quyền và Đối kháng? | Có. VĐV chọn 1 node + contest_types: sparring (max 1) và/hoặc nhiều kata. VĐV chỉ thuộc 1 node duy nhất. |

---

## 8. Luồng Đăng Ký VĐV (CL-07)

```
Admin mở màn hình đăng ký VĐV
  │
  ├─ Tìm VĐV (GET /students?search=X)
  │
  ├─ Chọn 1 node hạng cân (level 3)
  │   └─ Dữ liệu từ: GET /tournaments/{id}/weight-class-nodes?format=tree
  │
  ├─ Chọn nội dung thi đấu:
  │   ├─ [x] Sparring (chỉ 1)
  │   └─ Kata: chọn từ danh sách (GET /tournaments/{id}/katas)
  │       ├─ [ ] Quyền Cầu Thủ
  │       ├─ [x] Quyền Thiếu Niên
  │       └─ [x] Quyền Phổ Thông
  │
  └─ Submit → POST /tournaments/{id}/participants/{student_id}/register
      Body: {
        node_id: 13,
        contest_types: [
          { type: "kata", kata_id: 2 },
          { type: "kata", kata_id: 3 }
        ]
      }
      Response:
        → 1 record student_weight_assignments (node_id=13)
        → 2 records student_contest_selections (kata_id=2, kata_id=3)
```

**Ràng buộc luồng (CL-07):**
- VĐV chỉ được chọn **đúng 1 node** — không thể chọn nhiều hạng cân
- Contest types: sparring tối đa 1 lần; kata: không giới hạn số lượng bài
- Phải chọn ít nhất 1 contest type

---

## 9. Liên kết tài liệu liên quan

| File | Mô tả |
|------|-------|
| `basic_design/03_tournament_management/tree_node_management.md` | CRUD nodes, validation rules, reorder |
| `basic_design/03_tournament_management/kata_management.md` | Quản lý bài quyền, gán nội dung |
| `basic_design/03_tournament_management/bracket_generation_refactor.md` | Breaking changes, migration |
| `basic_design/list_api/dynamic_structure_apis.md` | Tất cả API endpoints |
| `basic_design/03_tournament_management/bracket_generation.md` | Bracket logic hiện tại (tham khảo) |
| `basic_design/03_tournament_management/tournament_structure.md` | UI hiện tại (tham khảo) |







