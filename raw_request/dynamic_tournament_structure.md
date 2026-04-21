# Yêu cầu: Cấu trúc Giải Đấu Động

**Người yêu cầu:** Hoàng  
**Ngày:** 2026-04-05  
**Mục tiêu:** Thay thế cấu trúc hạng cân fix cứng bằng hệ thống động per giải đấu

---

## 🎯 Vấn đề hiện tại

- Các hạng cân, nhóm tuổi, loại hình đều fix cứng trong code
- Khi thêm giải mới với quy định khác phải sửa code
- Không thể customize theo mỗi giải riêng
- Khó cộng tác với admin để setup

---

## ✨ Mong muốn sau khi làm xong

**Admin có thể:**

1. **Tạo cấu trúc hạng cân theo dạng tree** cho mỗi giải
2. **Kéo thả để sắp xếp thứ tự hiển thị** (chỉ trong cùng cấp)
3. **Tạo tên bài quyền tuỳ chỉnh** cho mỗi giải
4. **Sao chép cấu trúc từ giải cũ** sang giải mới
5. **Thay đổi cấu trúc khi giải tươi chưa phát hành**, nhưng khi **đã phát hành chỉ được thêm, không được xóa**
6. **Tự động di chuyển VĐV** khi xóa một hạng cân

---

## 🏗️ Cấu trúc Tree mong muốn

### Ví dụ cấu trúc thực tế

```
GIẢI VOVINAM 2026

├─ NAM (Giới tính - Cấp 0)
│  │
│  ├─ PHONG TRÀO (Loại hình - Cấp 1)
│  │  │
│  │  ├─ LOẠI 1A (Nhóm - Cấp 2)
│  │  │  ├─ 45 kg
│  │  │  ├─ 48 kg
│  │  │  └─ 51 kg
│  │  │
│  │  └─ LOẠI 1B (Nhóm - Cấp 2)
│  │     ├─ 50 kg
│  │     └─ 55 kg
│  │
│  └─ PHỔ THÔNG (Loại hình - Cấp 1)
│     ├─ LOẠI 1 (Nhóm - Cấp 2)
│     │  ├─ 50 kg
│     │  └─ 55 kg
│     │
│     └─ LOẠI 2 (Nhóm - Cấp 2)
│        └─ 60 kg
│
└─ NỮ (Giới tính - Cấp 0)
   │
   ├─ PHONG TRÀO (Loại hình - Cấp 1)
   │  ├─ LOẠI 1A (Nhóm - Cấp 2)
   │  │  ├─ 40 kg
   │  │  └─ 45 kg
   │  │
   │  └─ LOẠI 1B (Nhóm - Cấp 2)
   │     └─ 45 kg
   │
   └─ PHỔ THÔNG (Loại hình - Cấp 1)
      └─ LOẠI 1 (Nhóm - Cấp 2)
         └─ 50 kg
```

### Quy tắc cấp bậc

- **Cấp 0 (Gender):** Nam / Nữ
- **Cấp 1 (Category):** Phong trào / Phổ thông / Đội tuyển (admin đặt tên tuỳ)
- **Cấp 2 (Group):** Loại 1A, 1B, 2, etc. (admin đặt tên tuỳ)
- **Cấp 3 (WeightClass):** 45kg, 48kg, 51kg, etc.

---

## 👤 Quy trình Setup sau khi tạo giải mới

### Bước 1: Admin truy cập "Quản lý cấu trúc hạng cân"

```
[Tạo Giải Vovinam 2026]
  ↓
[Vào tab "Cấu trúc Giải"]
  ↓
[Ghi nhìn cấu trúc tree hiện tại]
```

### Bước 2: Admin xây dựng tree từ trên xuống

**2a. Thêm Giới tính (Cấp 0)**
- Chọn [➕ Thêm Giới tính]
- Nhập tên: "Nam"
- Nhập tên: "Nữ"
- **KQ:** 2 nhánh Nam/Nữ xuất hiện

**2b. Thêm Loại hình (Cấp 1)**
- Chọn nhánh "Nam"
- Chọn [➕ Thêm Loại hình]
- Nhập tên: "Phong trào"
- Nhập tên: "Phổ thông"
- **KQ:** Nam có 2 con: Phong trào, Phổ thông

**2c. Thêm Nhóm (Cấp 2)**
- Chọn "Phong trào" (dưới Nam)
- Chọn [➕ Thêm Nhóm]
- Nhập tên: "Loại 1A", "Loại 1B"
- **KQ:** Phong trào có 2 con

**2d. Thêm Hạng cân (Cấp 3)**
- Chọn "Loại 1A"
- Chọn [➕ Thêm Hạng cân]
- Nhập tên: "45 kg", "48 kg", "51 kg"
- **KQ:** Loại 1A có 3 con

### Bước 3: Admin sắp xếp lại thứ tự (nếu cần)

**Kéo thả chỉ hoạt động:**
- ✅ Kéo "Nam" lên trên "Nữ" → đổi thứ tự giới tính
- ✅ Kéo "Phong trào" lên trên "Phổ thông" → đổi thứ tự loại hình
- ✅ Kéo "45 kg" xuống sau "51 kg" → đổi thứ tự hạng cân

**Kéo thả KHÔNG được phép:**
- ❌ Kéo "45 kg" từ dưới "Loại 1A" sang dưới "Loại 1B"
- ❌ Kéo "Loại 1A" từ dưới "Phong trào" sang dưới "Phổ thông"
- ❌ Kéo "Nam" để thành con của "Phong trào"

---

## 🏆 Quản lý Bài Quyền (Kata)

Tương tự cách quản lý hạng cân, admin cũng muốn quản lý **tên các bài quyền** per giải.

### Hiện tại (Fix cứng)

```
- Quyền 1
- Quyền 2
- Quyền 3
```

### Mong muốn (Dynamic)

Admin có thể:
- Tạo bài quyền tuỳ thích (VD: "Quyền Cầu Thủ", "Quyền Thiếu Niên")
- Sắp xếp thứ tự hiển thị
- Gán phạm vi tuổi (nếu cần): loại 1A chỉ thi quyền "Quyền Cầu Thủ"

### Cấu trúc mong muốn

```
Giải Vovinam 2026

├─ NAM
│  ├─ PHÔNG TRÀO
│  │  └─ LOẠI 1A (16-18 tuổi)
│  │     ├─ Quyền: [Quyền Cầu Thủ, Quyền Thiếu Niên] ← gán quyền
│  │     └─ Đối kháng: [Yes/No]
│  │
│  └─ PHỔ THÔNG
│     └─ LOẠI 1
│        ├─ Quyền: [Quyền Phổ Thông]
│        └─ Đối kháng: [Yes/No]
│
└─ NỮ
   ├─ ...

--- QUẢN LÝ BÀI QUYỀN ---

DANH SÁCH BÀI QUYỀN TRONG GIẢI:
1. Quyền Cầu Thủ (Phong trào 1A, 1B) — Thứ tự: 1
2. Quyền Thiếu Niên (Phong trào 2, 3) — Thứ tự: 2
3. Quyền Phổ Thông (Phổ thông) — Thứ tự: 3
```

### Quy trình quản lý bài quyền

**Bước 1: Tạo danh sách bài quyền cho giải**
- Vào tab "Quản lý Bài Quyền"
- Chọn [➕ Thêm Bài Quyền]
- Nhập: "Quyền Cầu Thủ"
- Ghi chú: "Dành cho phong trào từ 16-18 tuổi"
- Chọn nhóm áp dụng: [Loại 1A☐ Loại 1B☐ Loại 2☐...]
- **KQ:** Bài quyền xuất hiện trong danh sách + có thể kéo thả sắp xếp

**Bước 2: Gán bài quyền vào từng hạng cân**
- Trong cây hạng cân, chọn "Loại 1A"
- Mục "Nội dung thi đấu":
  - ☐ Quyền Cầu Thủ
  - ☐ Quyền Thiếu Niên
  - ☐ Đối kháng
- **KQ:** Loại 1A chỉ thi quyền này

---

## 🔒 Ràng buộc & Quy tắc

### 1. Trước khi phát hành giải (Status = DRAFT)

**Admin có thể:**
- ✅ Thêm bất kỳ node nào
- ✅ Xóa node
- ✅ Sắp xếp lại (kéo thả)
- ✅ Sửa tên node
- ✅ Thay đổi cấu trúc (đổi parent)

### 2. Sau khi phát hành (Status = PUBLISHED)

**Đã sinh bracket:**
- ❌ Không được xóa node nào
- ❌ Không được thay đổi parent (cấu trúc)
- ✅ Được thêm hạng cân mới
- ✅ Được sắp xếp lại (kéo thả)
- ✅ Được sửa tên

**Chưa sinh bracket:**
- ✅ Được thêm node
- ✅ Được xóa node
- ✅ Được sắp xếp
- ✅ Được sửa cấu trúc

### 3. Khi xóa hạng cân

**Nếu đã có VĐV:**
- Chọn hạng cân đích
- Tất cả VĐV tự động chuyển sang hạng cân đích
- Ghi log: "Di chuyển từ 45kg sang 48kg"

**Nếu không có VĐV:**
- Xóa ngay

---

## 📋 Quy trình Sao chép (Copy Tournament Structure)

### Use case

Admin muốn tạo Giải Vovinam 2027 với cấu trúc giống Giải Vovinam 2026

### Các bước

1. **Tạo giải mới:** "Giải Vovinam 2027"
2. **Vào tab "Cấu trúc"**
3. **Chọn [📋 Sao chép từ giải khác]**
4. **Chọn "Giải Vovinam 2026"**
5. **Chọn:** ☐ Copy cấu trúc hạng cân ☐ Copy bài quyền ☑ Copy VĐV (tuỳ chọn)
6. **Kết quả:**
   - Cây hạng cân được copy nguyên si
   - Tất cả bài quyền được copy
   - (Tuỳ chọn) VĐV từ 2026 được copy sang 2027

---

## 🔄 Luồng VĐV Đăng ký → Thi Đấu

```
1. VĐV đăng ký giải
   │
   ├─ Chọn đai (Vàng, Xanh, Nâu, Đen)
   │
   ├─ Hệ thống load cấu trúc hạng cân: NAM > PHONG TRÀO > LOẠI 1A
   │  (Filter theo đai → tìm nhóm tuổi phù hợp)
   │
   ├─ VĐV chọn: LOẠI 1A > 48kg
   │
   ├─ Hệ thống fetch nội dung thi đấu:
   │  - Quyền: [Quyền Cầu Thủ, Quyền Thiếu Niên]
   │  - Đối kháng: Có/Không
   │
   └─ VĐV xác nhận → Sinh bracket → Thi đấu
```

---

## 🎬 Màn hình chính

### Màn hình 1: Cấu trúc Hạng Cân (Tree Builder)

**URL:** `/tournaments/{tournament_id}/structure/weight-classes`

**Thành phần:**
1. **Cây dữ liệu** hiển thị tree
2. **Kéo thả** để sắp xếp (chỉ trong cùng cấp)
3. **Nó chức năng:**
   - ➕ Thêm node
   - ✏️ Sửa tên
   - 🗑️ Xóa (với chọn di chuyển VĐV)
4. **Thống kê:** Tổng VĐV, số hạng cân

### Màn hình 2: Quản lý Bài Quyền

**URL:** `/tournaments/{tournament_id}/structure/katas`

**Thành phần:**
1. **Danh sách bài quyền** trong giải
2. **Kéo thả** để sắp xếp thứ tự
3. **Nút chức năng:**
   - ➕ Thêm bài quyền mới
   - ✏️ Sửa tên, ghi chú
   - 🗑️ Xóa bài quyền (nếu chưa có ai thi)

### Màn hình 3: Gán Nội dung Thi Đấu

**URL:** `/tournaments/{tournament_id}/structure/assign-contents`

**Thành phần:**
1. **Chọn hạng cân** từ tree
2. **Dòng checkbox:**
   - ☐ Quyền Cầu Thủ
   - ☐ Quyền Thiếu Niên
   - ☐ Đối kháng
3. **Lưu** → cập nhật constraints

---

## 📌 Ưu tiên thực hiện

### Pha 1 (Bắt buộc)
- [ ] Xây dựng tree structure (CRUD)
- [ ] Kéo thả sắp xếp thứ tự
- [ ] Ghi log khi xóa + di chuyển VĐV

### Pha 2 (Quan trọng)
- [ ] Quản lý bài quyền (CRUD)
- [ ] Gán bài quyền vào hạng cân
- [ ] Copy cấu trúc giải cũ

### Pha 3 (Nice to have)
- [ ] Export/Import cấu trúc dạng JSON/Excel
- [ ] So sánh cấu trúc 2 giải

---

## ✅ Kiểm tra trước deploy

- [ ] Admin tạo giải mới với tree 4 cấp được
- [ ] Kéo thả chỉ hoạt động trong cùng cấp
- [ ] Thêm/xóa node hoạt động đúng
- [ ] VĐV tự động di chuyển khi xóa hạng cân
- [ ] Sao chép cấu trúc giải cũ hoạt động
- [ ] Sau khi phát hành, chỉ được thêm hạng cân
- [ ] Bài quyền được tạo và gán đúng

---

# 🔄 Tương thích Bracket Generation

## 🎯 Mục tiêu

**Sau khi chuyển sang cơ chế admin setup tree, sinh sơ đồ thi đấu phải:**
- ✅ Vẫn tuân thủ tất cả rules hiện tại
- ✅ Vẫn sinh đúng số match (slots = 2^ceil(log2(n)))
- ✅ BYE được phân bổ cân bằng
- ✅ Match code format không đổi
- ✅ Auto-advance logic vẫn hoạt động

---

## 📋 Rules hiện tại cần bảo tồn

### Rule 1: Minimum Players
```
Yêu cầu: >= 2 VĐV mới sinh bracket
Hiện tại: 
  if n < 2:
    raise ValueError("Tối thiểu 2 vận động viên")
    
Tương lai: 
  → Vẫn kiểm tra khi user click "Generate"
  → Validate TRƯỚC khi sinh
```

### Rule 2: Slot Calculation
```
Công thức: slots = 2^ceil(log2(n))

Ví dụ hiện tại:
  7 VĐV  → 8 slots  → 3 rounds (1 BYE)
  10 VĐV → 16 slots → 4 rounds (6 BYE)
  19 VĐV → 32 slots → 5 rounds (13 BYE)

Tương lai:
  → Logic KHÔNG ĐỔI
  → Chỉ cần query lại danh sách VĐV từ tree node
```

### Rule 3: BYE Distribution (Balanced)
```
Hiện tại: Có issue — BYEs all at end
Fix được chuẩn bị: distribute_byes_evenly() 

Tương lai: 
  → Vẫn dùng balanced bye distribution
  → Ensure left & right halves có gần đều số BYE
  → Tránh situation: một nửa bracket toàn BYE
```

### Rule 4: Match Code Format
```
Format hiện tại: Simple sequential code per weight class
Ví dụ: Match 1, Match 2, Match 3, ... được hiển thị với tournament_weight_class_id

Tương lai:
  → Vẫn dùng tournament_weight_class_id để identify match
  → Không cần composite code (PT_1A_M_45_A_R1_001)
  → Logic KHÔNG ĐỔI, đơn giản hơn
```

### Rule 5: Auto-Advance on BYE
```
Hiện tại:
  if player2 is None (BYE):
    status = "completed"
    winner_id = player1
    (không cần thi đấu, tự động advance)

Tương lai:
  → Logic KHÔNG ĐỔI
  → Query player1_id từ tree node đúng
```

### Rule 6: Auto-Advance on Match Completion
```
Hiện tại:
  When round 1 match completes:
    if winner_id is set:
      Insert/update next_round_match with winner

Tương lai:
  → Logic KHÔNG ĐỔI
  → Vẫn dùng next_match_id linking
```

---

## ⚠️ Breaking Changes (cần xử lý)

### Change 1: Player Query (must use tree node)

**OLD:**
```python
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

**NEW:**
```python
# Query dari tree node
node = await db.execute(
    select(TournamentWeightClassNode)
    .where(TournamentWeightClassNode.id == node_id)
)
node = node.scalar_one_or_none()

# Find students assigned to this node
assignments = await db.execute(
    select(StudentWeightAssignment)
    .where(StudentWeightAssignment.weight_class_node_id == node_id)
)
students = [a.student for a in assignments.all()]
```

**Impact:**
- Bracket generation phải thay đối query logic
- Pre-check: node phải tồn tại + có students
- Error handling: clarify error messages

---

### Change 2: Secondary Registrations (Quyền vs Sparring)

**Hiện tại có logic:**
```
Nếu student "phong_trao" loại "5" (Adult quyền) + sparring:
  → Tự động register cả age_type_code="4" (Đối kháng)

Nếu student "phong_trao" loại != "5" + quyen_selections:
  → Tự động register cả age_type_code="5" (Quyền)
```

**Tương lai cần làm rõ trong tree:**
```
In the tree, admin phải explicit tạo 2 branches:

╔ phong_trao (loại_1A)
║  ├─ Quyền (age_type_code="5")
║  │  ├─ 45kg (weight_class_node)
║  │  ├─ 48kg
║  │  └─ 51kg
║  │
║  └─ Đối kháng (age_type_code="4")
║     ├─ 45kg
║     ├─ 48kg
║     └─ 51kg

Bracket generation sẽ:
  1. Detect student assigned to "45kg" under "Quyền"
  2. Check compete_events = "sparring"
  3. Auto-create secondary assignment to "45kg" under "Đối kháng"
  4. Generate bracket cho CẢ 2 branches
```

**Validation:**
- Tree setup must include explicit nodes for all contest types
- If admin forgets to add "Đối kháng" branch → error guidance

---

## 🛡️ Validation Checklist (Admin Setup Phase)

### Khi admin setup tree, cần validate:

#### ✅ Tính toàn vẹn cây:
- [ ] Depth = 4 levels (Gender → Category → Group → Weight)
- [ ] Mỗi gender có ít nhất 1 category
- [ ] Mỗi category có ít nhất 1 group
- [ ] Mỗi group có ít nhất 1 weight class
- [ ] All leaf nodes (weight classes) có constraints defined

#### ✅ Tính nhất quán:
- [ ] `name` unique within parent + level
- [ ] `sort_order` sequential (1, 2, 3, ...) không gaps
- [ ] Không duplicate constraints

#### ✅ Constraints hợp lệ:
- [ ] `contests` = ["sparring", "kata", ...] (hợp lệ values)
- [ ] `gender_specific` = true/false (boolean)
- [ ] Nếu có "sparring" + "kata" → MUST có 2 age_type branch
- [ ] Nếu chỉ "kata" → chỉ 1 age_type_code = "5"

#### ✅ Tên hợp lệ:
- [ ] Category name không chứa ký tự đặc biệt (hoặc format rules)
- [ ] Weight class name phải là number hoặc "number kg" format
- [ ] Age type name không conflict với existing nhóm tuổi

---

## 🚀 Implementation Strategy

### Pha 1: Tree CRUD + Validation

**Goal:** Admin có thể setup tree structure đúng

**Task:**
1. [ ] Implement CRUD endpoints cho nodes
2. [ ] Validate tree structure rules (depth, constraints)
3. [ ] Add test cases cho invalid trees

---

### Pha 2: Bracket Generation Refactor

**Goal:** Bracket generation chạy OK với tree

**Task:**
1. [ ] Extract match code generation từ tree path
2. [ ] Update player query logic (use tree node)
3. [ ] Update secondary registration logic
4. [ ] Add validation: tree phải đủ nodes trước khi generate

---

### Pha 3: Edge Case Handling

**Goal:** Handle corner cases khi deploy

**Task:**
1. [ ] If admin deletes node with students → auto-move + reshuffle bracket
2. [ ] If admin changes tree after bracket generated → what happens?
3. [ ] If admin rename category → does match_code need update?

---

## ✅ Acceptance Criteria (Bracket Generation after Tree)

- [ ] Generate with tree structure produces same match count as before
- [ ] BYE distribution remains balanced
- [ ] Auto-advance still works
- [ ] Secondary registrations (sparring+quyền) still work
- [ ] Bracket can be regenerated without errors
- [ ] Deleted node → students auto-moved before bracket gen
- [ ] UI bracket visualization displays correct tournament weight class info
- [ ] Existing bracket of OLD tournaments still work (backward compat if needed)

