# Spec: Quản lý Bài Quyền (Kata Management)

**Version:** 1.1
**Date:** 2026-04-05
**Status:** Draft — Ready for AI Writer
**Priority:** Pha 2
**Dependency:** tree_node_management.md
**Changelog:** v1.1 — CL-05: Kata là setting chung của giải (tournament-level), không gán vào node. CL-07: VĐV đăng ký chọn 1 node + contest_types (sparring và/hoặc nhiều kata).

---

## 1. Mô tả tính năng

Admin tạo và quản lý **danh sách bài quyền riêng** cho từng giải đấu. Bài quyền là **setting chung của cả giải** — thuộc `tournament_id`, không gán vào node cụ thể nào.

Khi VĐV đăng ký, VĐV chọn:
1. **1 node hạng cân (level 3)** — duy nhất trong toàn giải
2. **Nội dung thi đấu** — sparring (tối đa 1) và/hoặc một hoặc nhiều kata từ danh sách kata của giải

### Hiện tại (cứng)

```python
# Hiện tại bài quyền = age_type_code = '5' trong tournament_weight_classes
# Content cố định: "Quyền 1", "Quyền 2", "Quyền 3"
```

### Mong muốn (dynamic)

Admin đặt tên bài quyền tùy ý cho giải. VĐV khi đăng ký tự chọn nội dung thi đấu:
- Sparring: 1 lần duy nhất
- Kata: có thể chọn nhiều bài từ danh sách kata của giải

---

## 2. Data Model

### Bảng: `tournament_kata_definitions`

Danh sách bài quyền setting chung của giải. Không có `node_id`.

```sql
CREATE TABLE tournament_kata_definitions (
    id              SERIAL PRIMARY KEY,
    tournament_id   INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    description     VARCHAR(500),
    sort_order      INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_kata_name_per_tournament UNIQUE (tournament_id, name)
);

CREATE INDEX idx_tkd_tournament ON tournament_kata_definitions (tournament_id, sort_order);
```

### Bảng: `student_contest_selections`

Lưu nội dung thi đấu VĐV đã chọn khi đăng ký. Liên kết với `student_weight_assignments` (1 VĐV - 1 node).

```sql
CREATE TABLE student_contest_selections (
    id                      SERIAL PRIMARY KEY,
    tournament_id           INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    student_id              INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    contest_type            VARCHAR(20) NOT NULL,
    -- 'sparring' | 'kata'
    kata_id                 INTEGER REFERENCES tournament_kata_definitions(id) ON DELETE CASCADE,
    -- NULL nếu contest_type = 'sparring'
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_student_sparring UNIQUE (tournament_id, student_id, contest_type)
        DEFERRABLE INITIALLY DEFERRED,
    -- Unique trên sparring: mỗi VĐV chỉ có 1 sparring per tournament
    -- Với kata: unique per (tournament_id, student_id, kata_id) — nhiều kata khác nhau OK
    CONSTRAINT uq_student_kata UNIQUE (tournament_id, student_id, kata_id),
    CONSTRAINT chk_kata_required CHECK (
        (contest_type = 'kata' AND kata_id IS NOT NULL) OR
        (contest_type = 'sparring' AND kata_id IS NULL)
    )
);

CREATE INDEX idx_scs_student_tournament ON student_contest_selections (tournament_id, student_id);
CREATE INDEX idx_scs_kata ON student_contest_selections (kata_id);
```

**Lưu ý quan trọng:**
- `student_weight_assignments` (trong `tree_node_management.md`) lưu node VĐV thuộc về
- `student_contest_selections` lưu nội dung thi đấu VĐV chọn — 2 bảng tách biệt
- 1 VĐV chỉ có 1 `student_weight_assignments` record per tournament (unique)
- 1 VĐV có thể có nhiều `student_contest_selections` records (sparring + nhiều kata)

---

## 3. Business Rules

### BLM-06: Quản lý danh sách bài quyền (tournament-level)

| Rule | Chi tiết |
|------|---------|
| Kata là setting của giải | Kata không gán vào node; thuộc `tournament_id` trực tiếp |
| Kata name unique trong giải | Không trùng tên trong cùng tournament |
| Sort order tự động | Khi tạo mới: max(existing) + 1 |
| Xóa kata | Chỉ xóa được nếu không có VĐV nào đang chọn kata này |
| Nếu đang dùng | Trả 409 với số lượng VĐV đang chọn |

### BLM-07: VĐV chọn nội dung thi đấu khi đăng ký

| Rule | Chi tiết |
|------|---------|
| VĐV chỉ thuộc 1 node | Unique constraint: `student_id + tournament_id` trên `student_weight_assignments` |
| Sparring: tối đa 1 | Mỗi VĐV chỉ chọn sparring 1 lần per tournament |
| Kata: chọn nhiều | VĐV có thể chọn 1 hoặc nhiều bài từ danh sách kata của giải |
| Phải chọn ít nhất 1 nội dung | Không cho phép đăng ký rỗng (0 contest_types) |
| Kata phải thuộc giải | `kata_id` phải thuộc cùng `tournament_id` |
| Không chọn kata trùng | Một VĐV không chọn cùng 1 kata 2 lần |

### BLM-08: Tương tác với bracket generation

Khi bracket được sinh:
- VĐV có `contest_type='sparring'` → đưa vào pool đối kháng của node (level 3) của VĐV
- VĐV có `contest_type='kata'` + `kata_id` → đưa vào pool biểu diễn quyền tương ứng
- Node không có VĐV nào chọn sparring → không sinh bracket đối kháng cho node đó (cảnh báo khi generate)

---

## 4. Validation Rules

### Khi tạo kata (POST /katas)

- [ ] `tournament_id` phải tồn tại
- [ ] Tournament phải DRAFT (kata definitions chỉ tạo khi setup)
- [ ] `name` không rỗng, max 150 ký tự
- [ ] `name` unique trong tournament

### Khi VĐV đăng ký (POST /participants/{student_id}/register)

- [ ] `node_id` phải là level 3 (WeightClass), thuộc cùng `tournament_id`
- [ ] VĐV chưa có assignment trong tournament (unique constraint)
- [ ] `contest_types` không rỗng — phải chọn ít nhất 1 nội dung
- [ ] Với mỗi entry `contest_type='sparring'`: không được trùng (chỉ 1 sparring per VĐV per tournament)
- [ ] Với mỗi entry `contest_type='kata'`: `kata_id` bắt buộc, phải thuộc `tournament_id`, không trùng nhau

### Khi xóa kata definition (DELETE /katas/{id})

- [ ] Kiểm tra `student_contest_selections` → nếu có VĐV đang chọn kata này → 409
- [ ] Response 409 phải kèm `affected_students_count`

---

## 5. UI Screens

### Screen 1: Quản lý Bài Quyền

**URL:** `/tournaments/{id}/setup/katas`

```
┌──────────────────────────────────────────────────────────────┐
│ Bài Quyền — Vovinam 2026                                     │
│                                          [+ Thêm Bài Quyền] │
├──────────────────────────────────────────────────────────────┤
│ # │ Tên Bài Quyền       │ Số VĐV chọn   │ Ghi chú  │        │
├──────────────────────────────────────────────────────────────┤
│ 1 │ Quyền Cầu Thủ       │ 15 VĐV        │          │ [✏][🗑]│
│ 2 │ Quyền Thiếu Niên    │ 8 VĐV         │          │ [✏][🗑]│
│ 3 │ Quyền Phổ Thông     │ 0 VĐV         │          │ [✏][🗑]│
│                                                              │
│  [≡ kéo thả để sắp xếp]                                     │
└──────────────────────────────────────────────────────────────┘
```

**Thay đổi so với v1.0:** Cột "Áp dụng cho" (node) bị xóa. Thay bằng "Số VĐV chọn".

### Screen 2: Đăng ký VĐV vào Giải

**URL:** `/tournaments/{id}/setup/participants/add`

```
┌──────────────────────────────────────────────────────────────┐
│ Đăng ký VĐV — Vovinam 2026                                   │
├──────────────────────────────────────────────────────────────┤
│ Tìm VĐV:  [________________________] [Tìm]                  │
│                                                              │
│ VĐV: Nguyễn Văn A (Lam Đai I, CLB Quận 1)                  │
│                                                              │
│ Chọn hạng cân:                                              │
│  Nam > Phong Trào > Loại 1A > [▼ Chọn hạng]                │
│                                                              │
│ Nội dung thi đấu:                                           │
│  [x] Đối kháng (Sparring)                                   │
│  Quyền:                                                     │
│  [x] Quyền Cầu Thủ                                         │
│  [ ] Quyền Thiếu Niên                                       │
│  [ ] Quyền Phổ Thông                                        │
│                                                              │
│                              [Hủy]   [Đăng ký]              │
└──────────────────────────────────────────────────────────────┘
```

**Lưu ý UX:**
- VĐV phải chọn đúng 1 hạng cân (node level 3)
- Phải chọn ít nhất 1 nội dung thi đấu
- Danh sách bài quyền lấy từ GET /tournaments/{id}/katas

---

## 6. Hành động → API Mapping

| Hành động UI | API |
|-------------|-----|
| Load danh sách bài quyền | GET /tournaments/{id}/katas |
| Tạo bài quyền mới | POST /tournaments/{id}/katas |
| Sửa tên/ghi chú bài quyền | PATCH /tournaments/{id}/katas/{kata_id} |
| Xóa bài quyền | DELETE /tournaments/{id}/katas/{kata_id} |
| Reorder bài quyền | POST /tournaments/{id}/katas/reorder |
| Đăng ký VĐV (chọn node + nội dung) | POST /tournaments/{id}/participants/{student_id}/register |
| Xem nội dung thi đấu của VĐV | GET /tournaments/{id}/participants/{student_id} |
| Cập nhật nội dung thi đấu của VĐV | PATCH /tournaments/{id}/participants/{student_id}/contest-types |

**Đã xóa:** Các endpoint `/nodes/{id}/contents` (assign kata to node) không còn tồn tại.

---

## 7. Acceptance Criteria

- [ ] AC-KM-01: Admin tạo được bài quyền với tên tùy ý, ghi chú tùy chọn
- [ ] AC-KM-02: Reorder bài quyền bằng drag-drop, thứ tự được lưu
- [ ] AC-KM-03: Xóa bài quyền đang được VĐV chọn → 409 với số VĐV bị ảnh hưởng
- [ ] AC-KM-04: Admin đăng ký VĐV: chọn 1 node (hạng cân) và chọn nhiều bài quyền — đều thành công
- [ ] AC-KM-05: Admin đăng ký VĐV chỉ chọn đối kháng (không chọn kata) — hợp lệ
- [ ] AC-KM-06: Admin đăng ký VĐV chỉ chọn kata (không chọn sparring) — hợp lệ
- [ ] AC-KM-07: VĐV không thể đăng ký vào 2 node trong cùng 1 giải — API trả 409
- [ ] AC-KM-08: Sao chép từ giải cũ với option "copy bài quyền" → copy kata definitions (không copy contest_selections của VĐV)

---

## 8. Điểm đã làm rõ

| ID | Câu hỏi | Kết quả |
|----|---------|---------|
| CL-05 | Bài quyền gán vào level nào? | Kata là setting chung của giải (tournament-level). Không gán vào node. VĐV tự chọn kata khi đăng ký. |
| CL-06 | Cảnh báo khi VĐV không có nội dung thi đấu? | Warning khi Generate Bracket, không block đăng ký |
| CL-07 | VĐV có thể thi cả Quyền lẫn Đối kháng? | Có. VĐV chọn 1 node + nhiều contest_types. Sparring tối đa 1, kata có thể chọn nhiều. |

---

## 9. Liên kết

- `dynamic_structure_final_spec.md` — Source of truth cho dynamic structure
- `dynamic_structure_final_spec_addendum.md` — Clarifications chốt thêm
- `dynamic_structure_index.md` — Điều hướng file chuẩn vs legacy
- `tree_node_management.md` — Tree CRUD + student_weight_assignments
- `bracket_generation_refactor.md` — Tác động lên bracket gen
- `basic_design/list_api/dynamic_structure_apis.md` — API contracts

