Dưới đây là bản **prompt/spec chặt chẽ** để bạn đưa cho AI code.
Tôi viết theo hướng:

* chỉ tập trung vào **2 thứ cần implement**

  1. **Chấm điểm realtime**
  2. **Local Mode/ CLoud**
* vẫn giữ **cùng 1 source code**
* vẫn dùng **API hiện tại**
* chỉ khác ở chỗ khi vào màn hình thi đấu thì chuyển sang **local realtime mode**

---

## Realtime Scoring + Local Match Mode

Bạn cần implement **2 hạng mục chính** dưới đây cho hệ thống thi đấu đối kháng.

---

## 1. Mục tiêu tổng thể

Hệ thống hiện tại đã có sẵn các màn hình và business API cơ bản.
Yêu cầu mới là bổ sung cơ chế **realtime scoring tại sân** với rule chấm điểm theo cửa sổ **1.5 giây**, đồng thời bổ sung **Local Match Mode** để xử lý trận đấu live.

### Mục tiêu:

* không thay đổi kiến trúc business hiện tại quá nhiều
* vẫn dùng **cùng 1 source code**
* vẫn dùng **API hiện tại** cho các chức năng business thông thường
* chỉ khi vào màn hình thi đấu live thì chuyển sang **local/server mode**
* local mode là nơi xử lý toàn bộ realtime của trận đấu

---

# 2. Phạm vi implement

Chỉ implement 2 phần sau:

## A. Realtime Scoring

## B. Local Match Mode

KHÔNG mở rộng sang các phần ngoài phạm vi như:

* viết lại toàn bộ backend business
* thay đổi toàn bộ auth flow
* thay đổi toàn bộ database business hiện tại
* refactor toàn bộ hệ thống sang microservice

---

# 3. Business Context hiện tại

Hệ thống hiện tại đã có:

* business API đang hoạt động
* danh sách trận đấu
* màn hình thi đấu
* màn hình trọng tài
* màn hình display
* logic business thông thường

Yêu cầu mới là:

* giữ nguyên business flow hiện tại
* chỉ bổ sung local realtime mode cho phần thi đấu live

---

# 4. Runtime Architecture cần implement
## Flow
                  [ Railway / Cloud Server ]
                           ^
                           |
                business APIs / auth / config / data
                           |
                    [ Local App tại sân login kết nối raiway(Production)] 
                           |
              --------------------------------
              |                              |
       Business Screens                 Live Screens
       (go to Railway)            (go to Local Realtime)

Test thì dùng local

## 4.1 Một source code duy nhất

Hệ thống phải tiếp tục dùng **1 source code chung**.

Không được tách thành:

* 1 source cho cloud
* 1 source cho local

Mà phải theo hướng:

* cùng source
* khác mode chạy
* khác config môi trường

---

## 4.2 Hai mode hoạt động

Hệ thống phải có 2 mode:

### 1. Cloud / Business Mode

Dùng cho:

* login
* danh sách trận
* chi tiết trận
* config trận
* create/update match
* business data thông thường

Mode này tiếp tục dùng **API hiện tại**.

---

### 2. Local Match Mode

Chỉ dùng khi vào màn hình thi đấu live, bao gồm:

* admin control live
* 5 màn hình trọng tài
* màn hình display

Mode này dùng để xử lý:

* realtime scoring
* timer
* room realtime
* state trận đấu
* snapshot realtime
...

---

## 4.3 Điều kiện chuyển mode

Khi user đang ở các màn hình thông thường:

* hệ thống chạy ở **Cloud / Business Mode**

Khi user vào màn hình thi đấu live:

* hệ thống chuyển sang **Local Match Mode**

### Quy tắc chuyển mode:

* chỉ khi trận ở trạng thái phù hợp để vận hành live thì mới vào local mode
* local mode bắt đầu từ lúc vào màn hình live / checking room
* từ thời điểm đó, toàn bộ dữ liệu realtime của trận phải lấy từ local engine

---

# 5. Local Match Mode Specification

## 5.1 Vai trò của Local Match Mode

Local Match Mode là runtime xử lý toàn bộ trận đấu đang diễn ra tại sân.

Nó là **source of truth duy nhất** cho:

* trạng thái hiệp
* timer
* điểm số realtime
* referee ready state
* referee connection state
* input scoring
* log điểm hợp lệ
* snapshot của 7 màn hình

---

## 5.2 Local Match Mode không thay thế business API

Local mode **không được** thay thế toàn bộ business backend.

Thay vào đó:

* business data thông thường vẫn dùng API hiện tại
* local mode chỉ xử lý phần live của trận đấu

---

## 5.3 Thành phần local cần có

Cần implement các thành phần sau trong cùng source:

### a. Local Realtime Server

Phụ trách:

* websocket / realtime channel
* room theo match
* nhận input từ referee
* nhận command từ admin

### b. Local Match Engine

Phụ trách:

* state machine trận đấu
* timer
* scoring rule 1.5 giây
* tính điểm hợp lệ
* log scoring event hợp lệ

### c. Local Live Storage

Phụ trách:

* lưu session trận đấu live
* lưu log điểm
* lưu admin adjustments
* lưu dữ liệu tạm trong lúc trận đang chạy

Có thể dùng DB local hoặc storage cục bộ phù hợp, nhưng phải tách khỏi business flow thông thường.

---

# 6. Trạng thái trận đấu cần hỗ trợ

Tối thiểu phải có các trạng thái sau:

```ts
enum MatchState {
  NOT_STARTED,
  CHECKING,
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

## 6.1 Ý nghĩa trạng thái

| State        | Ý nghĩa                                                         |
| ------------ | --------------------------------------------------------------- |
| NOT_STARTED  | Trận chưa bắt đầu                                               |
| CHECKING     | Đang chuẩn bị vào trận / kiểm tra kết nối / chuẩn bị local mode |
| ROUND_1      | Hiệp 1                                                          |
| BREAK        | Giải lao                                                        |
| ROUND_2      | Hiệp 2                                                          |
| EXTRA_TIME   | Hiệp phụ                                                        |
| DRAW_PENDING | Hòa sau hiệp phụ, chờ bốc thăm                                  |
| FINISHED     | Trận kết thúc, chờ chốt                                         |
| CONFIRMED    | Kết quả chính thức                                              |

---

## 6.2 Quy tắc mode theo trạng thái

* `NOT_STARTED` và các màn business thông thường: dùng Cloud Mode
* từ `CHECKING` trở đi: trận chạy dưới Local Match Mode
* từ `CHECKING` trở đi, score/timer/state không được lấy từ business API nữa

---

# 7. Realtime Scoring Specification

Đây là phần quan trọng nhất.

## 7.1 Nguyên tắc chung

* Có 5 trọng tài kết nối vào cùng 1 match room
* Trọng tài gửi thao tác chấm điểm realtime
* Hệ thống không cộng điểm ngay khi một trọng tài bấm
* Hệ thống gom các thao tác theo cửa sổ **1.5 giây**
* Điểm chỉ được tính khi đủ điều kiện hợp lệ

---

## 7.2 Rule 1.5 giây

Trong cùng một cửa sổ **1.5 giây**, hệ thống phải xét các thao tác chấm điểm của các trọng tài.

Điểm chỉ được tính khi:

* có ít nhất **3 trọng tài khác nhau**
* cùng chấm cho **cùng một vận động viên**
* cùng chấm **cùng loại điểm**
* cùng thứ tự vị trí thao tác trong window

---

## 7.3 Một trọng tài có thể bấm nhiều lần

### Đây là rule bắt buộc:

* không được giới hạn 1 trọng tài chỉ được tính 1 lần trong 1 window
* một trọng tài có thể bấm nhiều lần liên tiếp
* hệ thống phải giữ nguyên thứ tự các lần bấm

Ví dụ:

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED, +1 RED
```

Kết quả:

=> Tổng RED +2

---

## 7.4 So khớp theo vị trí thao tác

Hệ thống phải group input scoring theo:

* window 1.5 giây
* playerSide
* scoreType
* thứ tự lần bấm của từng trọng tài trong window

### Nghĩa là:

Không chỉ xét “có +1 hay không”, mà phải xét:

* lần bấm thứ 1
* lần bấm thứ 2
* lần bấm thứ 3
* ...

Mỗi vị trí được xét như một scoring slot độc lập.

---

## 7.5 Ví dụ đúng

### Case 1

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED, +1 RED
D: +1 RED, +1 RED
```
=> RED +2

---

### Case 2

```text
A: +1 RED, +2 RED
B: +1 RED, +2 RED
C: +1 RED, +2 RED
```

Kết quả:
=> RED +3

---

### Case 3

```text
A: +1 RED, +1 RED
B: +1 RED, +1 RED
C: +1 RED
```

Kết quả: Khác lượt chấm
=> Không + điểm

---

## 7.6 Input model

Mỗi input scoring phải có ít nhất các field sau:

```ts
type RawJudgeInput = {
  id: string
  matchId: number
  refereeId: string
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2' | '-1'
  sequenceIndex: number
  createdAtMs: number
  state: 'ROUND_1' | 'ROUND_2' | 'EXTRA_TIME'
}
```

---

## 7.7 Valid scoring event

Khi một slot hợp lệ được xác nhận, hệ thống phải tạo `ValidScoreEvent`:

```ts
type ValidScoreEvent = {
  id: string
  matchId: number
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2'
  sequenceIndex: number
  refereeIds: string[]
  createdAtMs: number
}
```

---

## 7.8 Cập nhật điểm chính thức

Mỗi `ValidScoreEvent` chỉ được cộng đúng **1 lần** vào điểm chính thức.

Ví dụ:

* event `+1 RED` → RED +1
* event `+2 BLUE` → BLUE +2

Không nhân theo số trọng tài.

---

# 8. Display Behavior Specification

## 8.1 Mục tiêu

Màn hình display phải phân biệt rõ:

* **official score**
* **pending score**

Display không được hiểu nhầm rằng một click đơn lẻ đã là điểm chính thức.

---

## 8.2 Pending score

Khi mới có 1 hoặc 2 trọng tài bấm điểm:

* chưa được cộng vào official score
* phải hiển thị là pending

---

## 8.3 Cách hiển thị đề xuất

### Official score

* hiển thị lớn
* là điểm chính thức đã được xác nhận

### Pending score

* hiển thị nhỏ hơn
* có thể mờ hơn / nhấp nháy nhẹ
* có text: `chờ xác nhận`

---

## 8.4 Trường hợp nhiều lần bấm

### Ví dụ:

```text
A: +1 RED, +1 RED
```

Display có thể hiển thị:

* `(+2 chờ xác nhận)`
  nhưng logic nội bộ vẫn phải lưu là 2 slot riêng

### Ví dụ:

```text
A: +1 RED, +2 RED
```

Display nên hiển thị:

* `(+1 chờ, +2 chờ)`

Không nên gộp thành `+3 chờ` vì đây là hai loại điểm khác nhau.

---

## 8.5 Khi slot đủ xác nhận

Ngay khi một slot đạt đủ 3 trọng tài hợp lệ:

* official score phải cập nhật
* pending tương ứng phải biến mất

---

## 8.6 Khi hết 1.5 giây mà không đủ xác nhận

Nếu một slot không đạt đủ 3 trọng tài:

* pending của slot đó biến mất
* không cộng vào official score

---

# 9. Yêu cầu implement Local Match Mode

AI cần implement theo các nguyên tắc sau:

## 9.1 Cùng source code

* không tách repo mới
* local server và cloud app cùng nằm trong 1 source

## 9.2 Tận dụng API hiện tại

* business flow tiếp tục dùng API hiện có
* không viết lại toàn bộ backend business

## 9.3 Chỉ tách phần live

* vào `CHECKING` trở đi thì dùng Local Match Mode
* local mode xử lý toàn bộ realtime

## 9.4 WebSocket / Realtime channel

Cần có room theo match:

```text
match:{matchId}
```

---

# 10. Acceptance Criteria

## Local Mode

* từ `CHECKING` trở đi, trận dùng local mode
* score/timer/state không phụ thuộc cloud business API
* 7 màn hình dùng cùng một snapshot từ local

## Realtime scoring

* xét theo window 1.5 giây
* một trọng tài được phép bấm nhiều lần
* so khớp theo thứ tự từng lần bấm
* mỗi slot phải có ít nhất 3 trọng tài khác nhau cùng xác nhận
* mỗi slot hợp lệ chỉ cộng đúng 1 lần

## Display

* phân biệt official và pending
* không cộng official ngay khi mới có 1 trọng tài
* slot không đủ xác nhận phải tự mất
* slot đủ xác nhận phải chuyển thành official

---

# 11. Kết quả mong muốn

Sau khi implement xong, hệ thống phải đạt được:

* business flow hiện tại vẫn giữ nguyên
* local mode chỉ bật khi vào live match
* realtime scoring chạy ổn định tại local
* display phản ánh đúng trạng thái pending / official
* không để logic tính điểm nằm ở frontend
* toàn bộ scoring logic nằm trong local match engine

---

# 12. Yêu cầu coding

Khi code:

* ưu tiên tách `match-engine` thành module riêng
* code rõ ràng, dễ test
* có type đầy đủ
* có unit test cho scoring rule
* không hard-code logic ở UI
* không dùng database như realtime message bus
