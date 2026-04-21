
# 📄 1. Meta
Tại sidebar Giải đấu tôi cần tính năng tự động sinh bracket 
tạm thời bạn tự insert data đối kháng mỗi loại 16 người để tự động sinh bracket  

```yaml
screen_id: TOURNAMENT_BRACKET_MANAGEMENT
version: 1.0
type: OPERATOR_TOOL
goal:
  - Select category → ageType → weightClass
  - Generate bracket (Sigma) per weightClass
  - View / manage bracket
```

---

# 🧠 2. Domain Model

## 2.1 Hierarchy

```yaml
hierarchy:
  - category
  - age_type
  - weight_class
```

---

## 2.2 Category

```yaml
Category:
  id: string
  name: enum [PHONG_TRAO, PHO_THONG]
```

---

## 2.3 AgeType

```yaml
AgeType:
  id: string
  code: string # "1A", "1B", "2", ...
  categoryId: string
  description: string
```

### Mapping (hard rule)

```yaml
age_type_mapping:

  PHONG_TRAO:
    1A: "4-6 tuổi"
    1B: "4-6 tuổi"
    2: "7-9 tuổi"
    3: "10-12 tuổi"
    4: "18-25 (đối kháng)"
    5: "18-35 (quyền)"

  PHO_THONG:
    1: "Không xác định"
    2: "Lớp 6-9"
    3: "Lớp 10-12"
    4: "18-25 (đối kháng) / 18-35 (quyền)"
```

---

## 2.4 WeightClass

```yaml
WeightClass:
  id: string
  name: string # "48kg"
  ageTypeId: string
  totalPlayers: number
  status: enum [NOT_GENERATED, GENERATING, GENERATED]
  bracketId: string | null
```

---

## 2.5 Bracket

```yaml
Bracket:
  id: string
  weightClassId: string
  type: enum [DOUBLE_ELIMINATION]
  matches: Match[]
```

---

## 2.6 Match

```yaml
Match:
  id: string
  round: number
  bracketType: enum [WINNER, LOSER, FINAL]

  player1Id: string | null
  player2Id: string | null

  score1: number | null
  score2: number | null

  winnerId: string | null

  status: enum [UPCOMING, LIVE, FINISHED]

  nextMatchId: string | null
  loserNextMatchId: string | null
```

---

# 🧩 3. UI Structure

```yaml
layout:
  - header
  - category_tabs
  - age_type_selector
  - weight_class_selector
  - bracket_area
  - match_drawer
```

---

# 🎛 4. UI Components

## 4.1 Category Tabs

```yaml
component: CATEGORY_TABS
type: segmented_control
data_source: Category[]

behavior:
  on_change:
    - reset age_type
    - reset weight_class
    - load age_types by category
```

---

## 4.2 Age Type Selector

```yaml
component: AGE_TYPE_SELECTOR
type: segmented_control

data_source: AgeType[]

display:
  - code (1A, 1B...)
  - tooltip: description

behavior:
  on_change:
    - reset weight_class
    - load weight_classes
```

---

## 4.3 Weight Class Selector

```yaml
component: WEIGHT_CLASS_SELECTOR
type: horizontal_scroll_radio

data_source: WeightClass[]

display:
  - name
  - status_icon:
      NOT_GENERATED: "🚫"
      GENERATING: "⏳"
      GENERATED: "✅"

  - optional:
      totalPlayers

behavior:
  on_select:
    - if status == GENERATED → load bracket
    - else → show empty state

  on_generate_click:
    - call generate API
```

---

# 🔥 5. Generate Logic (Core)

## 5.1 Trigger

```yaml
trigger:
  location: weight_class_item
  action: click_generate
```

---

## 5.2 Preconditions

```yaml
validation:
  - totalPlayers >= 2
```

---

## 5.3 API

```http
POST /weight-classes/{id}/generate-bracket
```

```yaml
response:
  status: GENERATING
```

---

## 5.4 State Machine

```yaml
state_machine:

  NOT_GENERATED:
    on_generate:
      → GENERATING

  GENERATING:
    on_success:
      → GENERATED

  GENERATED:
    on_regenerate:
      → GENERATING
```

---

## 5.5 Realtime Event

```yaml
event: WEIGHT_CLASS_GENERATED

payload:
  weightClassId: string
```

---

# 🚫 6. Empty State

```yaml
condition:
  weightClass.status != GENERATED

ui:
  message: "Chưa có sơ đồ thi đấu"
  action_button: "Generate Bracket"
```

---

# 🏆 7. Bracket Display

```yaml
component: BRACKET_VIEW

layout:
  left: WINNER_BRACKET
  center: FINAL
  right: LOSER_BRACKET

interaction:
  - click_match → open drawer
  - hover_match → highlight path
```

---

# 🖱 8. Match Drawer

```yaml
component: MATCH_DRAWER

content:
  - player info
  - scores
  - history

actions:
  - update_score
  - set_winner
```

---

# ⚠️ 9. Disable Rules

```yaml
disable_rules:

  bracket_view:
    when:
      weightClass.status != GENERATED

  generate_button:
    when:
      - status == GENERATING
      - totalPlayers < 2
```

---

# 🧠 10. Auto Selection Logic

```yaml
auto_select:

  on_screen_load:
    - select first category
    - select age_type with max players
    - select weight_class:
        priority:
          1. GENERATED
          2. NOT_GENERATED
```

---

# ⚙️ 11. API Contract

## 11.1 Get Structure

```http
GET /tournaments/{id}/structure
```

```json
{
  "categories": [
    {
      "id": "PHONG_TRAO",
      "ageTypes": [
        {
          "id": "1A",
          "weightClasses": []
        }
      ]
    }
  ]
}
```

---

## 11.2 Get Bracket

```http
GET /weight-classes/{id}/bracket
```

---

## 11.3 Update Match

```http
POST /matches/{id}/result
```

---

# 🎨 12. Visual Rules

```yaml
color_rules:
  player1: blue
  player2: red

  winner: highlight
  loser: opacity_50

  live_match: gold_border
```

---

# 🚀 13. Performance

```yaml
performance:
  - virtualize bracket rendering
  - lazy load rounds
```

---

# 📌 14. Definition of Done

```yaml
done:
  - category selection works
  - age type selection works
  - weight class selection works
  - generate bracket works
  - correct disable states
  - bracket renders correctly
  - realtime update works
```


# Update spec 06/04/2026

Yêu cầu tổng quát:

Mọi thao tác liên quan đến vận động viên, đăng ký thi đấu, sơ đồ giải đấu, đăng ký đối kháng/quyền đều phải gắn với một giải đấu cụ thể (tournament_id).
Khi tạo mới, chỉnh sửa, hoặc lấy danh sách vận động viên, phải truyền kèm tournament_id để lọc đúng dữ liệu.
Khi đăng ký đối kháng/quyền, hệ thống phải lấy cấu trúc tree bracket của giải đấu tương ứng.
Không cho phép thao tác với vận động viên hoặc trận đấu nếu chưa chọn giải đấu.
Các điểm cần làm rõ trong prompt:

Luồng nghiệp vụ:

Quy trình tạo giải đấu mới.
Quy trình đăng ký vận động viên vào giải đấu.
Quy trình đăng ký nội dung đối kháng/quyền cho vận động viên (phải lấy theo tree bracket của giải).
Quy trình lấy danh sách vận động viên/trận đấu theo từng giải.
API/Model:

Tất cả API liên quan đến vận động viên, đăng ký thi đấu, bracket... đều phải có tham số tournament_id.
Khi lấy danh sách, phải lọc theo tournament_id.
Khi tạo/sửa/xóa, phải kiểm tra vận động viên/trận đấu có thuộc giải đấu đó không.
UI/UX:

Người dùng phải chọn giải đấu trước khi thao tác.
Khi chuyển giải đấu, toàn bộ dữ liệu hiển thị phải thay đổi theo giải đó.
Không cho phép thao tác nếu chưa chọn giải đấu.
Tree bracket:

Khi đăng ký đối kháng/quyền, phải lấy cấu trúc tree của giải đấu hiện tại.
Không cho phép đăng ký nếu chưa có bracket cho giải đấu.

Khi người dùng chọn một giải đấu (tournament), toàn bộ layout và dữ liệu của các module sau sẽ tự động thay đổi theo giải đấu đó:

Dashboard (thống kê, tổng quan)
Danh sách vận động viên (chỉ hiện VĐV thuộc giải đang chọn)
Sơ đồ giải đấu (bracket tree của giải đang chọn)
Danh sách trận đấu (match list của giải đang chọn)
Bảng hiển thị (scoreboard, kết quả)
Tổng sắp huy chương (medal tally của giải đang chọn)
Quản lý đơn vị (club/team thuộc giải đang chọn)
Quản lý tài khoản:

Có thể gán vai trò (role) cho user theo từng giải đấu hoặc toàn hệ thống.
Khi tạo/sửa tài khoản, cho phép chọn vai trò và giải đấu áp dụng (hoặc “tất cả giải đấu”).
Yêu cầu bổ sung cho UI/UX:

Khi chưa chọn giải đấu, các module trên phải ẩn hoặc báo “Vui lòng chọn giải đấu”.
Khi chuyển giải đấu, toàn bộ dữ liệu các tab trên phải reload theo giải mới.
Quản lý tài khoản không phụ thuộc giải đấu, nhưng khi gán role thì phải chọn giải đấu áp dụng.

