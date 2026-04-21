# Tổng sắp huy chương theo Đơn vị - Detail Design

**Mã tính năng:** `MEDAL-CLUB-01`  
**Phiên bản:** `0.1`  
**Ngày cập nhật:** `2026-04-17`  
**Trạng thái:** `Draft`

**Basic Design tham chiếu:**
- `basic_design/03_tournament_management/medal_tally_by_club.md`

---

## 1. Mục tiêu kỹ thuật

- Mở rộng API `GET /tournaments/{id}/medal-tally` hiện tại: bổ sung `tree_path`, `status`, `club_name` cho từng winner
- Tạo API mới `GET /tournaments/{id}/medal-tally/by-club`: bảng xếp hạng đơn vị kiểu Olympic
- Cập nhật frontend `MedalsPage`: thêm tab "Theo Đơn vị", cập nhật tab "Theo hạng cân / Quyền" (tree path, sort, filter, club tag)
- Không thay đổi schema database — chỉ thêm query logic và schema Pydantic

---

## 2. Traceability từ Basic Design

### 2.1 Business Rules tham chiếu

| BR ID | Tóm tắt | Nguồn |
|---|---|---|
| BR-01 | Xếp hạng Olympic + tie-break bằng số VĐV ít hơn xếp trên | basic_design MEDAL-CLUB-01 |
| BR-02 | Đối kháng: 1 HCV + 1 HCB + đúng 2 HCĐ | basic_design MEDAL-CLUB-01 |
| BR-03 | Quyền: đúng 1 HCV + 1 HCB + 1 HCĐ, xác định khi tất cả hoàn thành | basic_design MEDAL-CLUB-01 |
| BR-04 | Club từ `StudentClub.is_current = true` | basic_design MEDAL-CLUB-01 |
| BR-06 | Lookup club đối kháng: `player_name` → `Student.full_name` + `weight_class_id` → `TournamentParticipant` → `StudentClub` | basic_design MEDAL-CLUB-01 |
| BR-07 | Tree path đối kháng: `"Đối kháng > {gender_label} > {weight_class_name}"` | basic_design MEDAL-CLUB-01 |
| BR-08 | Sort tree path: lexicographic theo chuỗi path | basic_design MEDAL-CLUB-01 |
| BR-09 | Filter đơn vị: giữ row nếu ít nhất 1 huy chương thuộc đơn vị | basic_design MEDAL-CLUB-01 |
| BR-10 | HCĐ đối kháng xác định ngay sau bán kết | basic_design MEDAL-CLUB-01 |
| BR-11 | Đối kháng chưa có chung kết → status=in_progress, vẫn trả HCĐ | basic_design MEDAL-CLUB-01 |
| BR-12 | Quyền chưa hoàn thành → status=in_progress, không trả huy chương nào | basic_design MEDAL-CLUB-01 |

### 2.2 Event tham chiếu

| Event ID | Tên event | Ý nghĩa nghiệp vụ | Nguồn |
|---|---|---|---|
| EVT-01 | Xem bảng tổng sắp đơn vị | Gọi API-02 | basic_design MEDAL-CLUB-01 |
| EVT-02 | Xem chi tiết huy chương có đơn vị | Gọi API-01 (mở rộng) | basic_design MEDAL-CLUB-01 |
| EVT-03 | Sort theo tree path | Frontend sort local | basic_design MEDAL-CLUB-01 |
| EVT-04 | Filter theo đơn vị | Frontend filter local | basic_design MEDAL-CLUB-01 |

---

## 3. Database Impact

### 3.1 Bảng liên quan

| Bảng | Vai trò | Loại tác động |
|---|---|---|
| tournament_weight_classes | Lấy hạng cân, gender, weight_class_name | SELECT only |
| bracket_matches | Lấy kết quả trận đấu (winner, player names) | SELECT only |
| tournament_participants | Cầu nối player_name → student_id | SELECT only |
| students | Lấy full_name để khớp tên | SELECT only |
| student_clubs | Lấy club_id của VĐV (is_current=true) | SELECT only |
| clubs | Lấy tên đơn vị | SELECT only |
| quyen_slots | Lấy kết quả thi quyền (official_score, player_name, player_club) | SELECT only |
| tournament_structure_nodes | Lấy node_path cho quyen groups | SELECT only |

> Không có write operation — feature này chỉ đọc dữ liệu.

### 3.2 Mapping ghi dữ liệu

_Không có — read-only feature._

---

## 4. Danh sách API

### API: `API-01` - Lấy tổng sắp huy chương (mở rộng)

**Method:** `GET`  
**Path:** `/tournaments/{tournament_id}/medal-tally`  
**Mục đích:** Trả danh sách huy chương theo hạng cân và nhóm quyền — mở rộng thêm `tree_path`, `status`, `club_name` cho mỗi winner  
**Auth:** Required (`get_current_user`)  
**Vai trò được phép:** Tất cả authenticated users  

#### Request

**Path Params**

| Tên | Kiểu | Required | Ghi chú |
|---|---|---|---|
| tournament_id | int | true | ID giải đấu |

#### Response

**Success**

- HTTP Code: `200`
- Schema Name: `MedalTallyOut` (mở rộng)

```
MedalTallyOut
├── tournament_id: int
├── tournament_name: str
├── weight_class_medals: list[WeightClassMedal]
│   ├── weight_class_id: int
│   ├── weight_class_name: str
│   ├── gender: str                    # "M" | "F"
│   ├── tree_path: str                 # "Đối kháng > Nam > 54kg"  ← NEW
│   ├── status: str                    # "completed" | "in_progress"  ← NEW
│   ├── gold: str | null               # tên VĐV
│   ├── gold_club: str | null          # tên đơn vị  ← NEW
│   ├── silver: str | null
│   ├── silver_club: str | null        # ← NEW
│   ├── bronze: list[str]              # tối đa 2 phần tử
│   └── bronze_clubs: list[str]        # ← NEW, cùng index với bronze
└── quyen_medals: list[QuyenMedalGroup]
    ├── node_id: int | null
    ├── node_path: str | null
    ├── content_name: str
    ├── status: str                    # "completed" | "in_progress"  ← NEW
    ├── gold: str | null
    ├── gold_club: str | null          # ← NEW
    ├── silver: str | null
    ├── silver_club: str | null        # ← NEW
    ├── bronze: list[str]
    └── bronze_clubs: list[str]        # ← NEW
```

**Errors**

| HTTP Code | Error Code | Khi nào xảy ra | Message |
|---|---|---|---|
| 404 | NOT_FOUND | tournament_id không tồn tại | Không tìm thấy giải đấu |

#### Processing Flow

**Weight class medals:**
1. Lấy tất cả `TournamentWeightClass` của tournament (loại trừ `age_type_code = "5"`)
2. Với mỗi weight class, build `tree_path = "Đối kháng > {gender_display} > {weight_class_name}"` (gender_display: M→"Nam", F→"Nữ")
3. Lấy `BracketMatch` của weight class, sort theo round desc
4. Xác định **HCV/HCB**: lấy trận `round = max(round)` (chung kết) có `status = "completed"` → winner = HCV, loser = HCB; nếu chưa completed → gold=null, silver=null
5. Xác định **HCĐ**: lấy 2 trận `round = max(round) - 1` (bán kết) có `status = "completed"` → loser của mỗi trận = HCĐ
6. Xác định `status`: "completed" nếu chung kết đã completed, ngược lại "in_progress"
7. Lookup club cho mỗi player có tên:
   - `player_name` → join `students` (full_name match) + `tournament_participants` (weight_class_id) → `student_id`
   - `student_id` → `student_clubs` WHERE `is_current = true` → `club_id` → `clubs.name`

**Quyen medals:**
8. Gọi `_build_quyen_ranking_groups` (logic hiện tại)
9. Với mỗi group: nếu **tất cả** slots trong group có `official_score IS NOT NULL` → status="completed", lấy rank 1/2/3; ngược lại → status="in_progress", gold/silver/bronze = null/[]
10. Club đã có sẵn trong `player_club_map` từ ranking groups — tái sử dụng trực tiếp

#### Database Effects — Reads

| Bảng | Field | Mục đích |
|---|---|---|
| tournament_weight_classes | id, weight_class_name, gender, age_type_code | Danh sách hạng cân |
| bracket_matches | weight_class_id, round, status, player1_name, player2_name, winner | Xác định huy chương |
| tournament_participants | weight_class_id, student_id | Lookup student từ tên |
| students | id, full_name | Khớp player_name |
| student_clubs | student_id, club_id, is_current | Lấy club hiện tại |
| clubs | id, name | Tên đơn vị |
| quyen_slots | node_id, player_name, official_score, player_club | Kết quả quyền |

#### Screen Mapping

| Screen ID | Event ID | Trigger | Mục đích gọi API |
|---|---|---|---|
| SCR-01 | EVT-02 | Tab "Theo hạng cân / Quyền" mount | Load dữ liệu huy chương kèm club + tree_path |

---

### API: `API-02` - Bảng xếp hạng theo Đơn vị

**Method:** `GET`  
**Path:** `/tournaments/{tournament_id}/medal-tally/by-club`  
**Mục đích:** Trả bảng xếp hạng đơn vị theo kiểu Olympic — chỉ tính huy chương từ tree path đã hoàn thành  
**Auth:** Required (`get_current_user`)  
**Vai trò được phép:** Tất cả authenticated users  

#### Request

**Path Params**

| Tên | Kiểu | Required | Ghi chú |
|---|---|---|---|
| tournament_id | int | true | ID giải đấu |

#### Response

**Success**

- HTTP Code: `200`
- Schema Name: `ClubMedalTallyOut`

```
ClubMedalTallyOut
├── tournament_id: int
├── tournament_name: str
└── rankings: list[ClubMedalRank]
    ├── rank: int                  # 1-based, tính sau sort
    ├── club_id: int
    ├── club_name: str
    ├── gold: int
    ├── silver: int
    ├── bronze: int
    ├── total: int                 # gold + silver + bronze
    └── athlete_count: int         # tổng VĐV của club tham dự tournament (tie-break)
```

**Errors**

| HTTP Code | Error Code | Khi nào xảy ra | Message |
|---|---|---|---|
| 404 | NOT_FOUND | tournament_id không tồn tại | Không tìm thấy giải đấu |

#### Processing Flow

1. Gọi nội bộ logic của `get_medal_tally` để lấy medals có club_name
2. Chỉ tính medals từ **tree path có `status = "completed"`**
3. Build `club_medals: dict[club_name, {gold, silver, bronze}]`:
   - Với mỗi `WeightClassMedal` có status="completed": cộng vào gold_club, silver_club, bronze_clubs
   - Với mỗi `QuyenMedalGroup` có status="completed": cộng vào gold_club, silver_club, bronze_clubs
4. Tính `athlete_count` cho mỗi club: đếm `TournamentParticipant` + `StudentContestSelection` của club trong tournament
5. Sort theo Olympic rule (BR-01): gold desc → silver desc → bronze desc → athlete_count asc
6. Gán rank (1-based) và build response

#### Database Effects — Reads

| Bảng | Field | Mục đích |
|---|---|---|
| (tất cả từ API-01) | — | Tái dùng logic medal tally |
| tournament_participants | student_id, weight_class_id | Đếm VĐV đối kháng theo club |
| student_contest_selections | student_id, tournament_id, contest_type | Đếm VĐV quyền theo club |
| student_clubs | student_id, club_id, is_current | Map student → club |

#### Screen Mapping

| Screen ID | Event ID | Trigger | Mục đích gọi API |
|---|---|---|---|
| SCR-01 | EVT-01 | Tab "Theo Đơn vị" mount | Load bảng xếp hạng CLB |

---

## 5. Cụm tính năng và màn hình

### 5.1 Cụm: MedalsPage với 2 tab

#### Screen: `SCR-01` - MedalsPage

**Loại màn hình:** `list`  
**Mục đích:** Hiển thị tổng sắp huy chương giải đấu theo 2 góc nhìn

##### API Dependencies

**Initial Load**

| API ID | Trigger | Mục đích |
|---|---|---|
| API-01 | Tab "Theo hạng cân / Quyền" active | Load huy chương kèm club + tree_path |
| API-02 | Tab "Theo Đơn vị" active | Load bảng xếp hạng CLB |

##### UI States — Tab "Theo hạng cân / Quyền"

| State ID | Condition | UI Behavior |
|---|---|---|
| STATE-LOADING | `isLoading = true` | Skeleton hoặc spinner |
| STATE-EMPTY | Không có huy chương nào | Empty state: "Chưa có huy chương nào được trao" |
| STATE-IN-PROGRESS | `status = "in_progress"` trên row | Badge "Đang thi đấu" trên cột tree path hoặc header row; đối kháng vẫn hiện HCĐ nếu có |
| STATE-COMPLETED | `status = "completed"` | Hiển thị đầy đủ HCV/HCB/HCĐ kèm club tag |
| STATE-ERROR | `isError = true` | Error message |

##### UI States — Tab "Theo Đơn vị"

| State ID | Condition | UI Behavior |
|---|---|---|
| STATE-LOADING | `isLoading = true` | Spinner |
| STATE-EMPTY | `rankings.length = 0` | Empty state: "Chưa có huy chương hoàn thành" |
| STATE-SUCCESS | `rankings.length > 0` | Bảng Olympic ranking |
| STATE-ERROR | `isError = true` | Error message |

##### Layout chi tiết

**Tab "Theo hạng cân / Quyền" — Controls:**
```
[Filter đơn vị: Tất cả ▾]   ← dropdown, chỉ liệt kê club có huy chương
Sort: click header "Tree Path" để sort lexicographic (asc/desc toggle)
```

**MedalCell (cập nhật):**
```tsx
<div className="flex flex-col gap-0.5">
  <span className="text-sm font-medium">🥇 Nguyễn Văn A</span>
  <span className="inline-flex">
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
      CLB Hà Nội
    </span>
  </span>
</div>
```

**Row trạng thái "Đang thi đấu" (đối kháng):**
- Hiển thị badge `Đang thi đấu` (amber) ở đầu row
- Cột HCV và HCB: hiển thị `—`
- Cột HCĐ: hiển thị tên VĐV + club tag nếu đã xác định

**Row trạng thái "Đang thi đấu" (quyền):**
- Toàn bộ cột HCV/HCB/HCĐ: hiển thị `—`
- Badge `Đang thi đấu` ở đầu row

**Tab "Theo Đơn vị" — Bảng:**

| # | Đơn vị | 🥇 | 🥈 | 🥉 | Tổng |
|---|---|---|---|---|---|
| 1 | CLB Hà Nội | 3 | 2 | 1 | 6 |

##### Events

| Event ID | Tên event | Trigger | Business Ref | API Sequence |
|---|---|---|---|---|
| EVT-01 | Xem bảng đơn vị | Click tab "Theo Đơn vị" | BR-01 | API-02 |
| EVT-02 | Xem chi tiết huy chương | Click tab "Theo hạng cân / Quyền" | BR-02–BR-12 | API-01 |
| EVT-03 | Sort theo tree path | Click header "Tree Path" | BR-08 | — (frontend local sort) |
| EVT-04 | Filter theo đơn vị | Chọn dropdown đơn vị | BR-09 | — (frontend local filter) |

---

## 6. Event Processing Detail

### Event: `EVT-03` - Sort theo tree path

**Source Screen:** `SCR-01`  
**Trigger:** Click header cột Tree Path  
**Xử lý:** Frontend sort local trên data đã fetch — sort lexicographic `tree_path` asc/desc (toggle)  
**Preconditions:** API-01 đã trả data

### Event: `EVT-04` - Filter theo đơn vị

**Source Screen:** `SCR-01`  
**Trigger:** Chọn club từ dropdown  
**Xử lý:** Frontend filter local — giữ row nếu `gold_club === club || silver_club === club || bronze_clubs.includes(club)`  
**Dropdown options:** Lấy từ set union của tất cả `gold_club`, `silver_club`, `bronze_clubs` trong data (loại null/empty, dedupe, sort A→Z)

---

## 7. Mapping tổng hợp

### 7.1 API ↔ Screen

| API ID | Screen ID | Event ID | Trigger |
|---|---|---|---|
| API-01 | SCR-01 | EVT-02 | Tab "Theo hạng cân / Quyền" mount |
| API-02 | SCR-01 | EVT-01 | Tab "Theo Đơn vị" mount |

### 7.2 API ↔ Database

| API ID | Bảng đọc chính | Bảng ghi | Ghi chú |
|---|---|---|---|
| API-01 | tournament_weight_classes, bracket_matches, tournament_participants, students, student_clubs, clubs, quyen_slots | — | Read-only |
| API-02 | (kế thừa API-01) + tournament_participants, student_contest_selections | — | Read-only |

### 7.3 Pydantic Schemas cần tạo / cập nhật

| Schema | Thay đổi | File |
|---|---|---|
| `WeightClassMedal` | Thêm `tree_path`, `status`, `gold_club`, `silver_club`, `bronze_clubs` | `backend/app/schemas/tournament.py` |
| `QuyenMedalGroup` | Thêm `status`, `gold_club`, `silver_club`, `bronze_clubs` | `backend/app/schemas/tournament.py` |
| `ClubMedalRank` | Mới: `rank`, `club_id`, `club_name`, `gold`, `silver`, `bronze`, `total`, `athlete_count` | `backend/app/schemas/tournament.py` |
| `ClubMedalTallyOut` | Mới: `tournament_id`, `tournament_name`, `rankings: list[ClubMedalRank]` | `backend/app/schemas/tournament.py` |

### 7.4 TypeScript Types cần tạo / cập nhật

| Type | Thay đổi | File |
|---|---|---|
| `WeightClassMedal` | Thêm `tree_path`, `status`, `gold_club`, `silver_club`, `bronze_clubs` | `frontend/src/types/tournament.ts` |
| `QuyenMedalGroup` | Thêm `status`, `gold_club`, `silver_club`, `bronze_clubs` | `frontend/src/types/tournament.ts` |
| `ClubMedalRank` | Mới | `frontend/src/types/tournament.ts` |
| `ClubMedalTallyOut` | Mới | `frontend/src/types/tournament.ts` |

---

## 8. Acceptance Criteria kỹ thuật

| AC ID | Given / When / Then | Screen | API | Bảng |
|---|---|---|---|---|
| AC-01 | Given giải có huy chương đã trao / When mở tab "Theo Đơn vị" / Then bảng hiển thị đúng HCV/HCB/HCĐ tổng hợp đối kháng + quyền | SCR-01 | API-02 | bracket_matches, quyen_slots |
| AC-02 | Given 2 CLB bằng HCV/HCB/HCĐ / When hiển thị bảng / Then CLB ít VĐV hơn xếp trên | SCR-01 | API-02 | tournament_participants |
| AC-03 | Given hạng cân đã hoàn thành / When xem tab "Theo hạng cân / Quyền" / Then `gold_club`, `silver_club`, `bronze_clubs` hiển thị đúng dưới dạng tag pill | SCR-01 | API-01 | student_clubs, clubs |
| AC-04 | Given hạng cân chưa có chung kết / When API-01 trả về / Then `status = "in_progress"`, `gold = null`, `silver = null`, `bronze` có thể có 0–2 phần tử | — | API-01 | bracket_matches |
| AC-05 | Given nhóm quyền chưa tất cả VĐV thi xong / When API-01 trả về / Then `status = "in_progress"`, `gold = null`, `silver = null`, `bronze = []` | — | API-01 | quyen_slots |
| AC-06 | Given hạng cân "in_progress" / When hiển thị / Then badge "Đang thi đấu" xuất hiện, HCĐ đã xác định vẫn hiển thị | SCR-01 | API-01 | — |
| AC-07 | Given nhóm quyền "in_progress" / When hiển thị / Then badge "Đang thi đấu", toàn bộ cột HCV/HCB/HCĐ là "—" | SCR-01 | API-01 | — |
| AC-08 | Given user click header "Tree Path" / When sort / Then rows sắp xếp lexicographic theo tree_path | SCR-01 | — | — |
| AC-09 | Given user chọn "CLB Hà Nội" từ dropdown / When filter / Then chỉ hiển thị rows có ít nhất 1 huy chương của CLB Hà Nội | SCR-01 | — | — |
| AC-10 | Given giải chưa có huy chương hoàn thành / When mở tab "Theo Đơn vị" / Then hiển thị empty state | SCR-01 | API-02 | — |
| AC-11 | Given dropdown filter / When render / Then chỉ liệt kê CLB có ít nhất 1 huy chương, không liệt kê toàn bộ CLB | SCR-01 | — | — |
| AC-12 | Given API-02 / When có tree path "in_progress" / Then huy chương từ tree path đó không được tính vào bảng đơn vị | — | API-02 | — |

---

## 9. Open Questions

_Không còn open question — tất cả đã được chốt trong basic design._
