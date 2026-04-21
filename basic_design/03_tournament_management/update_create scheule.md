Ok, mình viết lại cho bạn **prompt tiếng Việt chuẩn production**, giữ đúng tư duy system design (AI đọc là code đúng ngay, tránh bug như hiện tại).

---

## ✍️ Prompt tiếng Việt (dùng trực tiếp)

Bạn là một senior backend engineer. Hãy thiết kế và implement hệ thống tạo sơ đồ thi đấu (Tournament Generation System) cho giải võ (Vovinam).

---

## Bối cảnh

* Input là danh sách vận động viên (participants)
* Mỗi vận động viên đã có:

  * category (phong_trao / doi_khang)
  * division (1A, 1B, ...)
  * weight_class (45kg, 48kg, ...)
* Hệ thống phải tạo toàn bộ giải đấu trong MỘT lần chạy
* KHÔNG được tạo match rỗng không có vận động viên (trừ các vòng sau)

---

## Yêu cầu chính

### 1. Hàm chính

Implement function:

generateTournament(participants)

---

### 2. Group dữ liệu

* Nhóm vận động viên theo:

  * category
  * division
  * weight_class

→ Mỗi group sẽ là một bracket riêng

---

### 3. Tạo bracket

Cho mỗi group:

* Tạo sơ đồ loại trực tiếp (single elimination)
* Nếu số lượng không phải lũy thừa của 2:

  * Tự động thêm BYE
* Seed:

  * Random hoặc theo ranking

---

### 4. Tạo match

* Tạo toàn bộ match ngay từ đầu:

  * Round 1
  * Tứ kết
  * Bán kết
  * Chung kết

Mỗi match phải có:

* match_id
* round
* bracket_position
* participant_a_id
* participant_b_id
* status:

  * READY nếu đủ 2 người
  * CREATED nếu là match của vòng sau

---

### 5. Gán vận động viên

* PHẢI gán vận động viên ngay khi generate
* KHÔNG được tạo match mà không biết participant (trừ vòng sau)

---

### 6. Xử lý BYE

* Nếu có BYE:

  * Tự động cho người còn lại đi tiếp
  * Match tiếp theo phải được update trạng thái nếu đã biết đối thủ

---

### 7. Phân sân (court / ring)

* Tự động phân match vào nhiều sân
* Đảm bảo:

  * 1 vận động viên không thi đấu cùng lúc ở 2 sân
  * Ưu tiên theo round (round nhỏ trước)

---

### 8. Output

Trả về:

* Danh sách match
* Mỗi match gồm:

  * participants
  * round
  * court
  * status

---

### 9. Ràng buộc quan trọng

* Không tạo match rỗng (trừ vòng sau)
* Không để mismatch category / weight_class
* Mỗi vận động viên chỉ xuất hiện 1 lần mỗi vòng
* Dữ liệu phải consistent

---

### 10. Fix lỗi cần tránh

Hệ thống phải tránh lỗi:

"Đã có match nhưng không có participant do thiếu mapping weight_class"

→ Luôn đảm bảo match được tạo từ chính danh sách participants

---

## Bonus

* Viết luôn thuật toán:

  * chia bracket n người
  * phân bổ BYE
  * mapping winner → match tiếp theo

---

## Output mong muốn

* Code backend production-ready (Python FastAPI hoặc Node.js)
* Bao gồm:

  * model
  * service
  * thuật toán generate
  * ví dụ dữ liệu output

---

# 🔥 Gợi ý dùng prompt này

## 👉 Nếu bạn dùng Claude

Thêm dòng cuối:

```
Use Python FastAPI + PostgreSQL
```

