# Spec Chuẩn: Dynamic Tournament Structure

**Version:** 2.0  
**Date:** 2026-04-07  
**Status:** Proposed Final Spec  
**Purpose:** Hợp nhất spec và source hiện tại thành 1 thiết kế chuẩn để implement.

## 1. Kết luận chính

Feature dynamic tournament phải chốt theo 4 nguyên tắc:

1. `TournamentStructureNode` là **source of truth duy nhất** cho cấu trúc giải mới.
2. `StudentWeightAssignment` + `StudentContestSelection` là **source of truth duy nhất** cho đăng ký thi đấu của giải mới.
3. `TournamentWeightClass` + `TournamentParticipant` chỉ còn là **legacy path** cho giải cũ.
4. Code **không được parse `name` của node** để suy ra meaning domain như gender/category/group/weight.

## 2. Vấn đề đang có trong source

Qua review source hiện tại, có 5 lệch lớn:

1. Bracket/schedule vẫn sinh từ legacy tables, chưa đọc từ dynamic tree.
2. API tạo/sửa student vẫn auto-register vào legacy tournament flow.
3. UI đăng ký hiện cho admin chọn mọi leaf trong toàn tree, chưa lọc theo rule domain nên dễ vào sai khung.
4. Một phần backend đang map meaning của tree bằng cách parse tên node như `Phong Trào`, `Loại 1A`, `45kg`, nên tree chưa thực sự dynamic.
5. Create/Edit student đang gọi register dynamic theo kiểu best-effort, lỗi bị nuốt, nên user có thể tưởng đã đăng ký đúng nhưng DB chưa đúng.

## 3. Các phương án thiết kế

### Phương án A: Tree hoàn toàn tự do, admin chọn leaf thủ công

Ưu điểm:
- Linh hoạt nhất
- Ít đổi schema

Nhược điểm:
- Không đảm bảo VĐV vào đúng khung
- Không validate được giới tính, tuổi, cân nặng
- Bracket sinh ra vẫn có thể sai từ dữ liệu đầu vào

### Phương án B: Tree dynamic + rule engine hỗ trợ xếp khung

Ưu điểm:
- Vẫn dynamic theo từng giải
- Vẫn validate được đúng khung
- Cho phép admin override khi có ngoại lệ

Nhược điểm:
- Cần thêm metadata/rules cho node
- Cần refactor flow đăng ký

### Phương án C: Tree dynamic + auto-assign hoàn toàn, không cho override

Ưu điểm:
- Dữ liệu rất sạch
- UX nhanh

Nhược điểm:
- Quá cứng cho thực tế giải đấu
- Khó xử lý ngoại lệ nghiệp vụ

## 4. Phương án được chọn

**Chọn Phương án B**.

Lý do:
- Đúng với nhu cầu “dynamic per tournament”.
- Giải quyết trực tiếp bug “create VĐV chưa vào đúng khung”.
- Không khóa cứng admin trong các case ngoại lệ.

## 5. Kiến trúc chuẩn

### 5.1 Source of truth

Đối với tournament mới dùng dynamic structure:

- Structure: `tournament_structure_nodes`
- Assignment: `student_weight_assignments`
- Contest selections: `student_contest_selections`
- Kata catalog: `tournament_katas`

Legacy tables:

- `tournament_weight_classes`
- `tournament_participants`

chỉ dùng cho tournament cũ, không ghi thêm record mới nếu tournament đã bật dynamic structure.

### 5.2 Ý nghĩa của tree

Tree vẫn giữ 4 cấp:

- Level 0: Gender
- Level 1: Category
- Level 2: Group
- Level 3: Weight leaf

Nhưng `name` chỉ là **display label**.  
Meaning machine-readable phải nằm ở metadata, không nằm trong text label.

### 5.3 Metadata chuẩn cho node

Đề xuất thêm 2 field cho `tournament_structure_nodes`:

- `node_code VARCHAR(50) NULL`
- `rule_json JSONB NULL`

Quy ước:

- Level 0:
  - `node_code`: `M` hoặc `F`
- Level 1:
  - `node_code`: mã loại hình, ví dụ `phong_trao`, `pho_thong`, `doi_tuyen`
- Level 2:
  - `node_code`: mã nhóm, ví dụ `1A`, `1B`, `2`, `open_a`
  - `rule_json`: `{ "min_age": 16, "max_age": 18, "allowed_belts": ["yellow", "blue"] }`
- Level 3:
  - `node_code`: mã leaf, ví dụ `45`, `48`, `54`
  - `rule_json`: `{ "max_weight_kg": 48 }`

Nếu cần linh hoạt hơn, có thể cho `rule_json` chứa:

- `min_age`
- `max_age`
- `birth_year_from`
- `birth_year_to`
- `allowed_belts`
- `max_weight_kg`
- `manual_only`

## 6. Mô hình dữ liệu chuẩn

### 6.1 Tournament structure node

Giữ bảng hiện tại và bổ sung:

```sql
ALTER TABLE tournament_structure_nodes
ADD COLUMN node_code VARCHAR(50) NULL,
ADD COLUMN rule_json JSONB NULL;
```

Ràng buộc:

- `name` unique trong cùng parent
- `sort_order` liên tục trong siblings
- `node_code` nên unique trong cùng parent nếu có dùng machine logic

### 6.2 Student assignment

Giữ:

- 1 student chỉ thuộc 1 leaf node trong 1 tournament

```text
UNIQUE(student_id, tournament_id)
```

### 6.3 Contest selections

Giữ:

- `sparring`: tối đa 1
- `kata`: nhiều lựa chọn

Kata là **tournament-level catalog**, không gắn vào node.

## 7. Rule domain chuẩn cho “vào đúng khung”

## 7.1 Dữ liệu athlete dùng để xếp khung

Đăng ký dynamic tournament phải dùng:

- `gender`
- `date_of_birth`
- `current_belt`
- `competition_weight_kg`
- `weight_verified`

### Quyết định quan trọng

Các field sau trên student:

- `weight_classes`
- `category_type`
- `category_loai`
- `compete_events`
- `quyen_selections`

không còn là source of truth cho dynamic tournament.

Chúng chỉ có thể là:

- dữ liệu legacy
- hoặc default gợi ý cho form

## 7.2 Rule chọn node

Khi đăng ký VĐV vào tournament dynamic:

1. Chọn root theo `gender`.
2. Chọn category:
   - ưu tiên admin chọn
   - có thể prefill từ default profile nếu có
3. Lọc group hợp lệ theo `age` và `current_belt`.
4. Trong group đã chọn, chọn leaf theo `competition_weight_kg`.

### Rule weight

Với leaf có `max_weight_kg`, hệ thống chọn leaf nhỏ nhất thỏa:

```text
competition_weight_kg <= max_weight_kg
```

Nếu không có leaf phù hợp:

- trả lỗi `NO_ELIGIBLE_WEIGHT_NODE`

### Rule manual override

Admin được phép override ra ngoài node recommended, nhưng:

- phải có quyền admin
- phải nhập `override_reason`
- hệ thống ghi audit log

## 8. UX đăng ký chuẩn

## 8.1 Không dùng tree picker “raw”

UI hiện tại cho chọn toàn bộ tree là không đủ an toàn.

UI mới phải là:

1. Chọn tournament
2. Chọn category hoặc hệ thống prefill
3. Hệ thống hiển thị:
   - `recommended_group`
   - `recommended_weight_leaf`
   - danh sách leaf hợp lệ
4. Admin xác nhận hoặc override
5. Chọn `sparring` và/hoặc nhiều `kata`

## 8.2 API gợi ý eligible nodes

Đề xuất thêm:

```text
GET /tournaments/{id}/eligible-nodes/{student_id}
```

Response:

```json
{
  "recommended_node_id": 123,
  "recommended_path": "Nam > Phong Trào > Loại 4 > 54 kg",
  "candidate_nodes": [
    { "node_id": 123, "path": "Nam > Phong Trào > Loại 4 > 54 kg", "reason": "recommended" },
    { "node_id": 124, "path": "Nam > Phong Trào > Loại 4 > 60 kg", "reason": "override_allowed" }
  ],
  "warnings": []
}
```

## 8.3 Tạo student mới phải transactional

Flow hiện tại create student rồi gọi register riêng là không an toàn.

Cần 1 trong 2 cách:

### Cách khuyến nghị

```text
POST /tournaments/{id}/participants/register-student
```

Body:

```json
{
  "student": { "...": "..." },
  "registration": {
    "node_id": 123,
    "contest_types": [
      { "type": "sparring" },
      { "type": "kata", "kata_id": 2 }
    ]
  }
}
```

Server commit 1 transaction cho cả create student + register.

### Cách chấp nhận được

Giữ `POST /students`, nhưng nhận thêm:

```json
{
  "tournament_registration": { ... }
}
```

và vẫn commit 1 transaction.

## 9. Bracket generation chuẩn

## 9.1 Không đọc legacy tables cho tournament dynamic

Với tournament dynamic:

- Sparring bracket phải đọc từ:
  - `student_weight_assignments`
  - `student_contest_selections` với `contest_type = 'sparring'`
- Kata slots phải đọc từ:
  - `student_weight_assignments`
  - `student_contest_selections` với `contest_type = 'kata'`

## 9.2 Không dùng node content assignment

Chốt lại:

- Node không sở hữu danh sách nội dung thi đấu
- Athlete mới là nơi chọn `sparring` và `kata`

Điểm này **supersede** các draft cũ nói rằng node có `content assignment`.

## 9.3 Match identity

Không nên build match identity từ path text vì node name có thể đổi.

Đề xuất:

- `bracket_matches.structure_node_id`
- `quyen_slots.structure_node_id`

`match_code` chỉ là mã hiển thị trong bracket, ví dụ:

- `A1`
- `A2`
- `B1`

Phần context như gender/category/group/weight lấy từ `structure_node_id`.

## 10. Quy tắc tương thích ngược

### Tournament legacy

- tiếp tục chạy bằng `TournamentWeightClass` + `TournamentParticipant`

### Tournament dynamic

- không ghi thêm dữ liệu sang legacy tables
- không gọi auto-register legacy
- generate bracket phải đi nhánh dynamic

### Detect mode

Thêm flag trên tournament:

```sql
ALTER TABLE tournaments
ADD COLUMN structure_mode VARCHAR(20) NOT NULL DEFAULT 'legacy';
```

Giá trị:

- `legacy`
- `dynamic`

Không detect bằng cách “nếu có node thì coi như dynamic”, vì dễ tạo trạng thái nửa vời.

## 11. Acceptance criteria chuẩn

- Admin tạo tree 4 cấp với label tùy ý, nhưng system vẫn hiểu domain qua metadata chứ không parse label.
- Tạo mới VĐV trong context tournament dynamic phải được commit atomically cùng registration.
- Nữ không thể đăng ký vào nhánh Nam nếu không override có lý do.
- Athlete không thể vào leaf sai cân nếu không override có lý do.
- Bracket generation của tournament dynamic không đọc `TournamentParticipant`.
- Schedule/Kata slot của tournament dynamic không đọc `age_type_code == 5` từ legacy table.
- Rename node không làm hỏng identity của bracket đã sinh.
- Các tournament cũ vẫn chạy bình thường qua legacy path.

## 12. Kế hoạch implement khuyến nghị

### Phase 1: Chốt mode và dừng ghi chồng 2 hệ

- Thêm `structure_mode`
- Tắt `register_student_to_tournament()` cho tournament dynamic
- Chặn create/update student kiểu best-effort registration

### Phase 2: Thêm metadata + eligibility service

- Thêm `node_code`, `rule_json`
- Implement `eligible-nodes` service
- Refactor UI create/edit registration sang assisted flow

### Phase 3: Transactional registration

- Tạo API atomic create-student-and-register
- Trả lỗi rõ khi registration fail

### Phase 4: Refactor bracket/schedule

- Sinh bracket từ dynamic assignment + contest selections
- Gắn `structure_node_id` vào match/slot

### Phase 5: Cleanup legacy coupling

- Bỏ logic parse tên node
- Bỏ count merge old/new cho tournament dynamic

## 13. Quyết định chốt để team follow

1. Dynamic tree không phải chỉ là UI tree, mà là data model chính cho tournament mới.
2. `name` là display-only, không phải machine key.
3. Đăng ký đúng khung phải dựa trên rule engine, không dựa vào manual tree picker tự do.
4. Tournament-specific registration không được lưu lẫn vào student profile như source of truth.
5. Bracket dynamic phải refactor dứt điểm sang assignment tables, không chạy nửa legacy nửa dynamic.
