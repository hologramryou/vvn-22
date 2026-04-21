
# 🥋 Vovinam Fighting – Match Scoring System Spec (Updated)

## 1. 🔁 Flow các hiệp (BẮT BUỘC – ƯU TIÊN CAO NHẤT)

### 1.1 State Machine tổng thể

```text
→ ROUND_1
→ BREAK
→ ROUND_2
→ (Nếu bằng điểm) → EXTRA_TIME
→ FINISHED
→ CONFIRMED
```

---

### 1.2 Quy tắc chuyển trạng thái

#### ✅ Luồng hợp lệ

| From        | To         | Điều kiện                                             |
| ----------- | ---------- | ----------------------------------------------------- |
| NOT_STARTED | ROUND_1    | Admin bấm "Bắt đầu trận đấu"                              |
| ROUND_1     | BREAK      | Hết thời gian hiệp 1 hoặc Admin bấm "Kết thúc hiệp 1" sau đó cần bắt đầu giải lao |
| BREAK       | ROUND_2    | Admin bấm "Bắt đầu hiệp 2"                            |
| ROUND_2     | EXTRA_TIME | Hai bên bằng điểm                                     |
| ROUND_2     | FINISHED   | Có người thắng                                        |
| EXTRA_TIME  | FINISHED   | Kết thúc hiệp phụ                                     |
| FINISHED    | CONFIRMED  | Admin xác nhận                                        |

---

### 1.3 Quy tắc bắt buộc

* Phải **kết thúc hiệp 1 → mới được sang hiệp 2**
* Giải lao là bước **bắt buộc nhưng KHÔNG auto start**
* Không được skip giải lao
* Hiệp phụ chỉ xuất hiện khi **bằng điểm sau hiệp 2**
* Tất cả transition phải được enforce bằng:

  * state machine
  * disable button theo state

---

### 1.4 Trường hợp bằng điểm

#### Sau hiệp 2

* Nếu bằng điểm:

  * chuyển sang `EXTRA_TIME`

#### Sau hiệp phụ

* Nếu vẫn bằng điểm:

  * chuyển sang `DRAW_PENDING`
  * admin thực hiện **bốc thăm**
  * admin xác nhận kết quả cuối cùng

---

## 2. ⏱️ Cài đặt thời gian trận đấu

### 2.1 Thời gian hiệp chính

* Áp dụng cho:

  * Hiệp 1
  * Hiệp 2
  * ❗ Hiệp phụ (EXTRA_TIME)
* Default: theo config giải đấu
* Có thể chỉnh trước trận
* Sau khi bắt đầu trận:

  * ❌ Không cho chỉnh

---

### ❗ 2.2 Hiệp phụ sử dụng thời gian hiệp chính

* Không có config riêng cho hiệp phụ
* Hiệp phụ sử dụng **chính thời gian của hiệp chính**
* Đảm bảo consistency:

  * tránh mismatch logic
  * giảm complexity UI

---

### 2.3 Thời gian giải lao

* Default: **30 giây**
* Có thể chỉnh trước trận
* ❗ KHÔNG tự động chạy

---

## 3. ⚙️ Luồng vận hành trận đấu

### 3.1 Trước trận

Admin có thể:

* chỉnh thời gian hiệp chính
* chỉnh thời gian giải lao

---

### 3.2 Khi trận bắt đầu

* Lock toàn bộ setting
* Chuyển sang `ROUND_1`

---

### 3.3 Kết thúc hiệp 1

Điều kiện:

* Timer = 0 hoặc Admin bấm kết thúc

➡️ Hệ thống:

* Chuyển sang `BREAK`
* ❗ KHÔNG auto chạy timer

---

### 3.4 Bắt đầu giải lao (MANUAL)

* Admin bấm **"Bắt đầu giải lao"**
* Khi đó:

  * Timer giải lao mới bắt đầu chạy

---

### 3.5 Kết thúc giải lao

Điều kiện:

* Timer = 0 hoặc Admin bấm kết thúc

➡️ Hệ thống:

* Chuyển sang `ROUND_2`
* Chỉ bắt đầu khi Admin bấm **"Bắt đầu hiệp 2"**

---

### 3.6 Kết thúc hiệp 2

* Nếu bằng điểm:

  * → `EXTRA_TIME`
* Nếu không:

  * → `FINISHED`

---

### 3.7 Hiệp phụ (UPDATED)

* Sử dụng **thời gian giống hiệp chính**
* Không có config riêng
* Flow:

  * Admin bấm **"Bắt đầu hiệp phụ"**
  * Timer chạy

---

### 3.8 Kết thúc hiệp phụ

* Nếu có người thắng:

  * → `FINISHED`
* Nếu vẫn bằng:

  * → `DRAW_PENDING`

---

### 3.9 Bốc thăm

* Admin thực hiện bốc thăm
* Chọn winner
* Sau đó:

  * → `FINISHED`

---

### 3.10 Xác nhận kết quả

* Admin xác nhận cuối cùng:

  * → `CONFIRMED`

---

## 4. 🏆 Quy tắc xác định người thắng

### 4.1 Trường hợp thông thường

* Player có điểm cao hơn thắng

### 4.2 Trường hợp hiệp phụ vẫn hòa

* Không auto chọn
* Winner được xác định bằng:

  * **bốc thăm**
* Admin xác nhận kết quả

---

## 5. 👨‍⚖️ Quyền Admin

Admin có quyền:

* bắt đầu/kết thúc hiệp
* bắt đầu giải lao
* chỉnh điểm
* override kết quả
* bốc thăm
* xác nhận kết quả

---

### ⚠️ Rule bắt buộc

* Khi admin thay đổi điểm:

  * bắt buộc nhập note
* Không có note:

  * ❌ không cho submit

---

## 6. 📜 Log hệ thống (Panel bên phải)
### 6.1 Mục tiêu

    Chỉ ghi nhận các thay đổi liên quan đến điểm số của vận động viên để:
    phục vụ audit
    truy vết khiếu nại
    đảm bảo minh bạch chấm điểm

### 6.2 Phạm vi log (CHỈ LIÊN QUAN ĐIỂM)

Chỉ log các hành động sau:
Trọng tài chấm điểm (+ điểm)
Trọng tài trừ điểm (nếu có)
Thẻ phạt dẫn đến trừ điểm
Admin cộng điểm
Admin trừ điểm
Admin chỉnh sửa điểm (override)

---

### 6.2 Ví dụ

```text
10:15:21 | Referee A | +1 | Red
10:16:02 | System | End ROUND_1
10:16:10 | Admin | Start BREAK
10:16:40 | System | BREAK ended
10:17:00 | Admin | Start ROUND_2
10:20:00 | System | End ROUND_2
10:20:01 | System | Draw → EXTRA_TIME
10:22:00 | System | End EXTRA_TIME
10:22:01 | System | Draw → Pending
10:22:10 | Admin | Draw result | Blue wins
10:22:20 | Admin | Confirm result
```

---

## 7. 📺 Display Screen
Như hiện tại nếu cần thì sẽ sửa sao để dễ nhìn và pro
---

### ❗ Giải lao

* Không auto hiển thị
* Admin có thể bật/tắt

---

## 8. 🚫 Validation & Guard

* Không cho skip hiệp
* Không auto start giải lao
* Không auto start hiệp 2
* Không cho vào hiệp phụ sai điều kiện
* Không auto chọn winner khi hòa sau hiệp phụ

---

## 9. 🧠 State Enum

```ts
enum MatchState {
  NOT_STARTED,
  ROUND_1,
  BREAK,
  ROUND_2,
  EXTRA_TIME,
  DRAW_PENDING,
  FINISHED,
  CONFIRMED
}
```

---

## 10. 🎯 Acceptance Criteria

* Hiệp phụ dùng cùng thời gian hiệp chính
* Giải lao chỉ chạy khi admin bấm start
* Không có auto flow sai
* Flow đúng 100% theo state machine
* Admin control toàn bộ critical action
* Log đầy đủ

---

