# 🧠 Realtime Scoring System

## Local Runtime + Cloud Integration Specification

---

# 1. 🎯 Mục tiêu nghiệp vụ

Hệ thống cần đảm bảo cơ chế chấm điểm trong thi đấu đối kháng theo quy tắc:

* Trong mỗi cửa sổ thời gian **1.5 giây**
* Nếu có ít nhất **3 trên 5 trọng tài**
* cùng thực hiện một thao tác chấm điểm giống nhau:

  * cùng vận động viên
  * cùng loại điểm
  * cùng thứ tự thao tác

→ thì hệ thống phải xác nhận đó là **một điểm hợp lệ**

---

## 1.1 Bản chất hệ thống

```text
Đây là hệ thống xác nhận điểm dựa trên consensus (3/5 trọng tài) trong một khoảng thời gian giới hạn (1.5 giây).
```

---

# 2. ⚠️ Vấn đề nếu chỉ dùng Cloud

Nếu toàn bộ hệ thống xử lý trên Cloud (Railway):

* độ trễ mạng giữa các thiết bị không đồng đều
* không đảm bảo chính xác window 1.5 giây
* input từ trọng tài có thể lệch thứ tự
* dễ xảy ra sai lệch kết quả
* phụ thuộc internet tại sân

→ **Không đảm bảo tính chính xác của rule 3/5**

---

# 3. 🧩 Nguyên tắc kiến trúc

---

## 3.1 Một source code duy nhất

* Hệ thống sử dụng **một source code duy nhất**
* Không tồn tại:

  * local repo riêng
  * cloud repo riêng

---

## 3.2 Một database business dùng chung

* Toàn bộ dữ liệu nghiệp vụ nằm trên **Cloud Database (Railway)**
* Local **không có database business riêng**
* Local sử dụng chung database này thông qua API

---

## 3.3 Local không phải hệ thống riêng

```text
Local chỉ là một runtime instance của cùng hệ thống, chạy trong môi trường tại sân.
```

---

# 4. 🏗️ Vai trò Cloud và Local

---

## 4.1 Cloud (Railway)

Cloud chịu trách nhiệm:

* login / authentication
* danh sách trận đấu
* cấu hình trận
* dữ liệu vận động viên
* phân công trọng tài
* lưu kết quả cuối
* reporting / viewer

👉 Cloud là **business layer + data layer**

---

## 4.2 Local (tại sân)

Local chịu trách nhiệm:

* realtime scoring
* timer
* trạng thái trận
* gom input trong 1.5 giây
* xác nhận điểm theo rule 3/5
* đồng bộ 7 màn hình realtime

👉 Local là **realtime runtime layer**

---

# 5. 🔗 Quan hệ Local ↔ Cloud

---

## 5.1 Local vẫn kết nối Cloud bình thường

Trong môi trường production tại sân:

* Local container vẫn:

  * gọi API Railway
  * thực hiện CRUD dữ liệu
  * đọc dữ liệu match / config / user

👉 Không thay đổi business flow hiện tại

---

## 5.2 Local chỉ tách phần realtime

Chỉ khi vào giai đoạn thi đấu live:

* scoring
* timer
* state trận

→ được xử lý tại Local

---

## 5.3 Nguyên tắc quan trọng

```text
Cloud xử lý business
Local xử lý realtime
```

---

# 6. 🔁 Flow hoạt động

---

## 6.1 Trước khi thi đấu

* User truy cập local app
* Local app gọi Cloud API:

  * lấy danh sách trận
  * load config
  * chuẩn bị dữ liệu

👉 **Cloud Mode**

---

## 6.2 Khi vào màn hình thi đấu

Route:

```text
/live/matches/:id/*
```

Trận chuyển sang trạng thái:

```text
CHECKING
```

→ Hệ thống chuyển sang:

👉 **Local Runtime Mode**

---

## 6.3 Trong trận đấu (từ CHECKING trở đi)

Local runtime xử lý:

* nhận input từ 5 trọng tài
* gom theo window 1.5 giây
* xác nhận điểm hợp lệ
* cập nhật score
* broadcast realtime

⚠️ Cloud **không tham gia xử lý realtime**

---

## 6.4 Sau trận

Local:

* cập nhật kết quả lên Cloud
* lưu dữ liệu chính thức

---

# 7. ⚙️ Nguyên tắc chuyển Mode

| Giai đoạn          | Mode               |
| ------------------ | ------------------ |
| Trước CHECKING     | Cloud Mode         |
| Từ CHECKING trở đi | Local Runtime Mode |

---

# 8. 🔥 Nguyên tắc bắt buộc

---

## 8.1 Không tách hệ thống

* không có local system riêng
* không có cloud system riêng

👉 chỉ có **1 hệ thống**

---

## 8.2 Không tách database

* chỉ có **1 database business trên Cloud**
* không sync 2 DB
* không duplicate data

---

## 8.3 Local chỉ là runtime

```text
Local = runtime để đảm bảo realtime chính xác tại sân
Cloud = nơi quản lý dữ liệu và nghiệp vụ
```

---

# 9. 🎯 Kết luận

Hệ thống được thiết kế theo nguyên tắc:

* **1 source code**
* **1 database**
* **Cloud xử lý business**
* **Local xử lý realtime**

---

## 🔥 Câu chốt quan trọng

```text
Local container vẫn kết nối Railway bình thường để thực hiện toàn bộ nghiệp vụ CRUD như hiện tại. Chỉ khi trận đấu bước vào trạng thái CHECKING và các trạng thái thi đấu tiếp theo thì hệ thống mới chuyển sang Local Runtime Mode để xử lý realtime scoring, timer và trạng thái trận nhằm đảm bảo tính chính xác của cơ chế 3/5 trọng tài trong cửa sổ 1.5 giây.
```

Đúng, bạn nói đúng. Ví dụ đó **không hợp lệ toàn bộ**.

Vì rule bạn đang chốt không phải là:

* xét độc lập từng slot

mà là:

* phải có **ít nhất 3 trọng tài có cùng pattern thao tác**
* tức là:

  * cùng số lần bấm
  * cùng thứ tự từng lần bấm
  * cùng vận động viên
  * cùng loại điểm ở từng vị trí

Nên case này:

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED
```

**không hợp lệ**, vì:

* A và B có pattern 2 lần bấm
* C chỉ có pattern 1 lần bấm
* không có đủ 3 trọng tài có cùng một chuỗi thao tác hoàn chỉnh

=> **RED +0**

---

Dưới đây là bản viết lại chuẩn hơn để thay vào spec.

---

# 10. ⚙️ Scoring Mechanism (Cơ chế tính điểm)

## 10.1 Nguyên tắc tổng quát

Hệ thống không tính điểm theo từng click riêng lẻ.

Hệ thống chỉ xác nhận điểm khi có **ít nhất 3 trên 5 trọng tài** cùng thực hiện **một pattern thao tác giống nhau** trong cùng một cửa sổ thời gian **1.5 giây**.

---

## 10.2 Cửa sổ thời gian

```text
Scoring Window = 1.5 giây
```

* Tất cả input trong khoảng thời gian này được gom lại để xét
* Sau khi window kết thúc, hệ thống xác định pattern nào hợp lệ

---

## 10.3 Khái niệm Pattern thao tác

Trong mỗi window 1.5 giây, mỗi trọng tài tạo ra một chuỗi thao tác.

Ví dụ:

```text
A: +1 RED, +1 RED
```

được hiểu là pattern:

```text
[+1 RED, +1 RED]
```

Ví dụ khác:

```text
A: +1 RED, +2 RED
```

được hiểu là pattern:

```text
[+1 RED, +2 RED]
```

---

## 10.4 Điều kiện hợp lệ

Một pattern chỉ hợp lệ khi có ít nhất **3 trọng tài khác nhau** cùng có:

* cùng số lần bấm
* cùng vận động viên ở từng vị trí
* cùng loại điểm ở từng vị trí
* cùng thứ tự thao tác
* cùng nằm trong một window 1.5 giây

---

## 10.5 Quy tắc tính điểm

Nếu một pattern hợp lệ, hệ thống sẽ cộng điểm theo toàn bộ pattern đó.

---

### Ví dụ 1

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED, +1 RED
D: +1 RED, +1 RED
```

Kết quả:

* có ít nhất 3 trọng tài cùng pattern `[+1 RED, +1 RED]`

👉 RED được cộng:

* +1
* +1

=> **RED +2**

---

### Ví dụ 2

```text
A: +1 RED, +2 RED
B: +1 RED, +2 RED
C: +1 RED, +2 RED
```

Kết quả:

* có ít nhất 3 trọng tài cùng pattern `[+1 RED, +2 RED]`

👉 RED được cộng:

* +1
* +2

=> **RED +3**

---

## 10.6 Trường hợp không hợp lệ do khác số lần bấm

### Ví dụ 3

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED
```

Kết quả:

* A và B có pattern: `[+1 RED, +1 RED]`
* C có pattern: `[+1 RED]`

Không có đủ 3 trọng tài có cùng pattern hoàn chỉnh.

👉 **Không hợp lệ**
👉 **RED +0**

---

## 10.7 Trường hợp không hợp lệ do khác loại điểm

### Ví dụ 4

```text
A: +1 RED, +1 RED
B: +1 RED, +2 RED
C: +1 RED, +1 RED
D: +1 RED, +1 RED
```

Kết quả:

* A, C, D có pattern giống nhau: `[+1 RED, +1 RED]`
* B có pattern khác: `[+1 RED, +2 RED]`

Vì đã có ít nhất 3 trọng tài cùng một pattern hoàn chỉnh:

👉 pattern `[+1 RED, +1 RED]` hợp lệ
👉 **RED +2**

---

## 10.8 Không cộng theo số lượng trọng tài

Nếu một pattern đã hợp lệ:

* chỉ cộng đúng theo pattern đó
* không nhân theo số lượng trọng tài xác nhận

Ví dụ:

```text
A: +1 RED
B: +1 RED
C: +1 RED
D: +1 RED
```

👉 RED chỉ được **+1**, không phải +4

---

## 10.9 Input model

```ts
type RawJudgeInput = {
  matchId: number
  refereeId: string
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2' | '-1'
  sequenceIndex: number
  createdAt: number
}
```

---

## 10.10 Valid Score Pattern

```ts
type ValidScorePattern = {
  matchId: number
  refereeIds: string[]
  inputs: Array<{
    sequenceIndex: number
    playerSide: 'RED' | 'BLUE'
    scoreType: '+1' | '+2' | '-1'
  }>
  createdAt: number
}
```

---

## 10.11 Cập nhật điểm chính thức

Khi một pattern hợp lệ:

* hệ thống duyệt toàn bộ chuỗi thao tác trong pattern
* cộng điểm tương ứng vào điểm chính thức

Ví dụ:

```text
Pattern hợp lệ: [+1 RED, +1 RED]
```

👉 RED +2

---

## 10.12 Pending và Official

### Pending

* là pattern đang chờ đủ 3 trọng tài cùng xác nhận

### Official

* là pattern đã đủ điều kiện hợp lệ

---

## 10.13 Timeout

Sau khi hết window 1.5 giây:

* nếu không có ít nhất 3 trọng tài cùng một pattern hoàn chỉnh
* pattern đó bị loại
* không cộng điểm

---

## 10.14 Nguyên tắc chốt

```text
Hệ thống không xét độc lập từng slot nếu pattern của các trọng tài không đồng nhất về số lượng thao tác.
Một lượt chấm điểm chỉ hợp lệ khi có ít nhất 3 trọng tài cùng một pattern thao tác hoàn chỉnh trong cùng window 1.5 giây.
```

---

## 10.15 Kết luận

```text
Mỗi trọng tài có thể bấm nhiều lần trong cùng một window 1.5 giây. Tuy nhiên, hệ thống chỉ công nhận điểm khi có ít nhất 3 trọng tài cùng thực hiện một chuỗi thao tác hoàn chỉnh giống nhau.
```
