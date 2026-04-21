# Tổng sắp huy chương theo Đơn vị - Basic Design

**Mã tính năng:** `MEDAL-CLUB-01`  
**Phiên bản:** `0.1`  
**Ngày:** `2026-04-17`  
**Trạng thái:** `Draft`

---

## 1. Mục tiêu

- Hiển thị bảng xếp hạng huy chương theo từng Đơn vị/CLB trong một giải đấu
- Xem chi tiết từng hạng cân / nhóm quyền kèm tên VĐV và đơn vị của họ
- Dành cho: Admin, HLV, khán giả theo dõi kết quả giải
- Giá trị: giúp ban tổ chức và đơn vị theo dõi thành tích tổng hợp theo kiểu bảng Olympic

## 2. Phạm vi

### In Scope

- Tab "Theo Đơn vị" trong MedalsPage hiện tại
- Bảng xếp hạng đơn vị: tổng HCV / HCB / HCĐ, sắp xếp theo Olympic (HCV → HCB → HCĐ)
- Gộp cả huy chương đối kháng (hạng cân) và huy chương quyền
- Hiển thị tên đơn vị bên dưới tên VĐV ở tab "Theo hạng cân / Quyền" hiện tại

### Out of Scope

- Tổng sắp xuyên nhiều giải đấu
- Export PDF bảng tổng sắp theo đơn vị
- Phân tích thống kê nâng cao theo đơn vị

## 3. Vai trò sử dụng

| Vai trò | Mô tả | Quyền liên quan |
|---|---|---|
| Admin | Xem toàn bộ | Read |
| Coach / Club | Xem toàn bộ | Read |
| Khán giả | Xem toàn bộ (nếu public) | Read |

## 4. Tổng quan nghiệp vụ

### 4.1 Luồng chính

1. Người dùng vào MedalsPage, thấy 2 tab: **"Theo hạng cân / Quyền"** (hiện tại) và **"Theo Đơn vị"** (mới)
2. Tab "Theo Đơn vị": hiển thị bảng xếp hạng CLB theo Olympic — mỗi dòng là 1 đơn vị với số HCV/HCB/HCĐ
3. Tab "Theo hạng cân / Quyền" (cải thiện):
   - Mỗi hạng cân / nhóm quyền hiển thị **tree path** (nhánh trong cấu trúc giải)
   - Tên đơn vị hiển thị bên dưới tên VĐV đoạt huy chương
   - Người dùng có thể **sort theo tree path** (thứ tự nhánh trong cây giải)
   - Người dùng có thể **filter theo đơn vị** — chỉ hiện các hạng cân / nhóm quyền mà đơn vị đó có VĐV đoạt huy chương

### 4.2 Business Rules

- `BR-01`: Xếp hạng đơn vị: HCV nhiều hơn → nếu bằng HCV thì so HCB → nếu bằng HCB thì so HCĐ → nếu bằng tất cả thì đơn vị có **ít VĐV tham dự hơn** xếp trên (hiệu suất cao hơn)
- `BR-02`: Mỗi hạng cân đối kháng: 1 HCV (thắng chung kết) + 1 HCB (thua chung kết) + **đúng 2 HCĐ** (2 VĐV thua bán kết) — không có trường hợp 1 HCĐ
- `BR-03`: Mỗi nhóm quyền: **đúng 1 HCV + 1 HCB + 1 HCĐ** — xác định khi toàn bộ VĐV cùng bài quyền trong tree path đã hoàn thành thi đấu
- `BR-10`: Đối kháng — VĐV thua bán kết được xác định HCĐ **ngay lập tức** (không cần chờ chung kết); HCV và HCB chỉ xác định sau khi chung kết hoàn thành
- `BR-11`: Trạng thái tree path đối kháng:
  - Chung kết chưa đánh → hiển thị **"Đang thi đấu"** nhưng vẫn hiển thị 2 HCĐ đã xác định
  - Chung kết hoàn thành → hiển thị đủ HCV + HCB + HCĐ
- `BR-12`: Trạng thái tree path quyền:
  - Còn VĐV chưa thi → hiển thị **"Đang thi đấu"**, không hiển thị bất kỳ huy chương nào
  - Tất cả VĐV cùng bài quyền trong tree path đã hoàn thành → mới hiển thị HCV/HCB/HCĐ
- `BR-04`: Đơn vị của VĐV lấy từ `StudentClub` (`is_current = true`) tại thời điểm truy vấn
- `BR-05`: VĐV bắt buộc phải có đơn vị — không có trường hợp null
- `BR-06`: Tra cứu đơn vị của VĐV đối kháng bằng: `player_name` → `Student.full_name` + `weight_class_id` → `TournamentParticipant.student_id` → `StudentClub`
- `BR-07`: Tree path của hạng cân lấy từ `TournamentWeightClass.node_path` hoặc path của node cha trong tournament structure; nhóm quyền đã có `node_path` trong ranking group
- `BR-08`: Sort theo tree path là sort lexicographic theo chuỗi path (ví dụ `"Nam > 54kg"` trước `"Nữ > 48kg"`)
- `BR-09`: Filter theo đơn vị — một hạng cân / nhóm quyền được giữ lại nếu ít nhất 1 trong số HCV/HCB/HCĐ thuộc đơn vị đang filter

### 4.3 Event nghiệp vụ

| Event ID | Tên event | Khi nào xảy ra | Ý nghĩa nghiệp vụ | Business Rule liên quan |
|---|---|---|---|---|
| EVT-01 | Xem bảng tổng sắp đơn vị | Người dùng click tab "Theo Đơn vị" | Tổng hợp huy chương toàn giải theo CLB | BR-01, BR-02, BR-03 |
| EVT-02 | Xem chi tiết huy chương có đơn vị | Người dùng ở tab "Theo hạng cân / Quyền" | Biết VĐV thuộc đơn vị nào, xem theo nhánh giải | BR-04, BR-06, BR-07 |
| EVT-03 | Sort theo tree path | Người dùng click cột Tree Path | Sắp xếp lại danh sách theo thứ tự cây giải | BR-08 |
| EVT-04 | Filter theo đơn vị | Người dùng chọn đơn vị từ dropdown | Chỉ hiện hạng cân / quyền có VĐV của đơn vị đó đoạt huy chương | BR-09 |

## 5. Cụm tính năng và màn hình

### 5.1 Cụm: Bảng tổng sắp theo Đơn vị

**Mục đích:** Xếp hạng CLB theo tổng huy chương toàn giải

**Danh sách màn hình:**

| Mã màn hình | Tên màn hình | Mục đích |
|---|---|---|
| SCR-01 | MedalsPage — Tab "Theo Đơn vị" | Bảng xếp hạng CLB kiểu Olympic |

**Layout Tab "Theo Đơn vị":**

```
# | Đơn vị          | 🥇 | 🥈 | 🥉 | Tổng
--+------------------+----+----+----+------
1 | CLB Hà Nội      |  3 |  2 |  1 |    6
2 | CLB TP.HCM      |  2 |  1 |  3 |    6
...
```

### 5.2 Cụm: Tên đơn vị + tree path + sort/filter (cải thiện tab hiện tại)

**Mục đích:** Người xem biết VĐV thuộc đơn vị nào, xem theo nhánh cây giải, lọc nhanh theo đơn vị

**Layout MedalCell (cải thiện):**
```
🥇 Nguyễn Văn A
   [CLB Hà Nội]      ← tag pill: bg nhạt, border, font xs, bo tròn
```

Tag style: background màu nhạt trung tính (gray-100), border gray-200, text gray-600, bo tròn `rounded-full`, padding `px-2 py-0.5`, font `text-xs`

**Controls trên bảng:**
```
[Filter đơn vị: Tất cả ▾]   [Sort: Tree Path ▴▾]

Tree Path        | Hạng cân / Nhóm  | 🥇              | 🥈              | 🥉
-----------------+------------------+-----------------+-----------------+-------
Nam > 54kg       | 54 kg Nam        | Nguyễn A        | Trần B          | Lê C
                 |                  | CLB Hà Nội      | CLB TP.HCM      | CLB Huế
Nam > 58kg       | 58 kg Nam        | ...
Quyền > Trẻ > … | Roi trường       | ...
```

**Filter đơn vị:** dropdown danh sách tất cả đơn vị có VĐV đoạt huy chương trong giải — chọn 1 đơn vị → chỉ hiển thị rows có huy chương của đơn vị đó

**Điều hướng:**
```
MedalsPage
  └── Tab "Theo hạng cân / Quyền"  (hiện tại, cải thiện thêm club)
  └── Tab "Theo Đơn vị"            (mới)
```

## 6. Danh sách API ở mức Basic Design

| API ID | Method | Path | Mục đích | Vai trò gọi |
|---|---|---|---|---|
| API-01 | GET | `/tournaments/{id}/medal-tally` | Mở rộng response hiện tại — thêm `club_name`, `tree_path`, `status` (completed/in_progress) vào từng hạng cân / nhóm quyền | All |
| API-02 | GET | `/tournaments/{id}/medal-tally/by-club` | Trả bảng xếp hạng đơn vị kiểu Olympic, kèm số VĐV tham dự để tính tie-break | All |

## 7. Dữ liệu và thực thể liên quan

| Thực thể | Mô tả | Ghi chú |
|---|---|---|
| BracketMatch | Trận đấu đối kháng, có player1_name / player2_name / winner | Lookup club qua tên VĐV |
| TournamentParticipant | Liên kết student_id ↔ weight_class_id | Cầu nối tên → student_id |
| Student | full_name, id | Cần khớp tên với BracketMatch |
| StudentClub | student_id, club_id, is_current | Lấy club hiện tại |
| Club | id, name | Tên đơn vị hiển thị |
| QuyenSlot | player_name, player_club (đã có map) | Club đã được map sẵn trong ranking |

## 8. Ràng buộc và giả định

- Tra cứu đơn vị VĐV đối kháng bằng `player_name` match `Student.full_name` trong phạm vi `weight_class_id` → đủ chính xác trong context 1 giải
- VĐV quyền đã có `player_club` trong ranking groups — tái sử dụng, không cần lookup thêm
- Tên VĐV trong `BracketMatch` được nhập khi draw bracket, giả định khớp với `Student.full_name`

## 9. Acceptance Criteria mức nghiệp vụ

- `AC-01`: Tab "Theo Đơn vị" hiển thị đúng số HCV/HCB/HCĐ tổng hợp từ cả đối kháng lẫn quyền
- `AC-02`: Thứ tự xếp hạng đúng theo rule Olympic (BR-01)
- `AC-03`: Tab "Theo hạng cân / Quyền" hiển thị tên đơn vị bên dưới tên VĐV đoạt huy chương
- `AC-04`: Đơn vị lấy từ `StudentClub.is_current = true`
- `AC-05`: Nếu chưa có huy chương nào, tab "Theo Đơn vị" hiển thị empty state phù hợp
- `AC-06`: Cột Tree Path hiển thị đúng path nhánh cây giải cho từng hạng cân / nhóm quyền
- `AC-07`: Sort theo tree path hoạt động đúng thứ tự lexicographic
- `AC-08`: Filter theo đơn vị chỉ giữ lại rows có ít nhất 1 huy chương thuộc đơn vị đó
- `AC-09`: Dropdown filter chỉ liệt kê các đơn vị thực sự có huy chương trong giải (không liệt kê tất cả CLB)
- `AC-10`: Hạng cân đối kháng chưa có chung kết → hiển thị badge "Đang thi đấu", vẫn hiển thị 2 HCĐ đã xác định (nếu có)
- `AC-11`: Nhóm quyền chưa hoàn thành toàn bộ → hiển thị badge "Đang thi đấu", không hiển thị huy chương
- `AC-12`: Tie-break tab "Theo Đơn vị" — 2 đơn vị bằng HCV/HCB/HCĐ thì đơn vị ít VĐV tham dự hơn xếp trên
- `AC-13`: Huy chương tính vào bảng tổng sắp đơn vị chỉ khi tree path đó đã ở trạng thái hoàn thành

## 10. Open Questions

_(Đã giải quyết hết — không còn open question)_
