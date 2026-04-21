Bạn là senior backend + system architect. Hãy thiết kế và implement hệ thống quản lý thi đấu cho giải võ (Vovinam), bao gồm:

* RBAC (phân quyền)
* Match lifecycle (trạng thái trận đấu)
* Scheduling (tạo lịch thi đấu)
* UI behavior liên quan

Yêu cầu code production-ready, rõ ràng, dễ maintain.

---

# 1. RBAC (Role-Based Access Control)

## Roles

* ADMIN
* USER (viewer)
* REFEREE (trọng tài)
* CLUB (huấn luyện viên)

---

## 1.1 ADMIN

* Full quyền:

  * CRUD tất cả entity
  * generate tournament
  * start match
  * finish match
  * schedule match

---

## 1.2 USER (Viewer)

* Chỉ được:

  * xem match, bracket, schedule
  * filter / search

* Không được:

  * create / update / delete

---

## 1.3 REFEREE

### Quyền tổng quát

* Truy cập TẤT CẢ màn hình (full visibility)
* Nhưng mặc định read-only

---

### Được phép:

* Xem tất cả dữ liệu
* Truy cập màn hình match
* Chấm điểm (score)

---

### Điều kiện chấm điểm:

* Chỉ khi:
  match.status = IN_PROGRESS

---

### Không được:

* start match
* finish match
* edit bất kỳ dữ liệu nào

---

---

## 1.4 CLUB

* Chỉ quản lý vận động viên của CLB mình
Khi create vận động viên thì chỉ đc tạo CLB của mình. Nên khi tạo mới 1 vận động viên sẽ disable dropdown chọn câu lạc bộ. Gán default là câu lạc bộ của chính account

---

### Được:

* create / edit / delete participant

---

### Rule bắt buộc:

* participant.club_id = current_user.club_id

---

### Không được:

* sửa match
* sửa schedule

---

---

## 1.5 Backend Enforcement

* Mọi API phải check role
* Unauthorized → trả về HTTP 403

---

# 2. MATCH LIFECYCLE

## Status

* CREATED
* READY
* ON_DECK
* IN_PROGRESS
* COMPLETED
* CANCELLED

---

## Transition hợp lệ

* CREATED → READY
* READY → ON_DECK
* ON_DECK → IN_PROGRESS
* IN_PROGRESS → COMPLETED
* ANY → CANCELLED

---

## Actions

### startMatch(matchId)

* Chỉ ADMIN
* Chỉ khi status = ON_DECK
* Set → IN_PROGRESS

---

### submitScore(matchId)

* Chỉ REFEREE hoặc ADMIN
* Chỉ khi status = IN_PROGRESS

---

### finishMatch(matchId, winnerId)

* Chỉ ADMIN
* Chỉ khi status = IN_PROGRESS

→ Update:

* winner_id
* fill vào match tiếp theo

---

## Rule quan trọng

* Click UI KHÔNG được update winner
* Chỉ finishMatch mới set winner

---

# 3. SCHEDULING LOGIC

## Mục tiêu

* Không schedule cuốn chiếu theo 1 hạng cân
* Không trộn loạn giữa các hạng cân
* Phải theo round + block theo weight_class

---

## Logic chuẩn

### Bước 1:

* Lấy tất cả match có status = READY

---

### Bước 2:

* Group theo:

  * round
  * weight_class

---

### Bước 3: Sort

* round theo thứ tự:
  R1 → QF → SF → F

* weight_class theo thứ tự tăng dần

---

### Bước 4: Schedule

for each round:
for each weight_class:
schedule ALL match của weight_class đó trước
rồi mới chuyển sang weight_class khác

---

## Rule bắt buộc

* KHÔNG được:

  * xen kẽ match giữa các weight_class trong cùng round

* PHẢI:

  * xử lý từng weight_class theo block

---

## Constraint

* 1 vận động viên không thi đấu cùng lúc
* Respect số lượng sân (court)

---

# 4. UI BEHAVIOR

## Match Screen

### ADMIN

* Có nút:

  * Start Match
  * Finish Match

---

### REFEREE

* Nếu match != IN_PROGRESS:
  → disable scoring UI

* Nếu match = IN_PROGRESS:
  → enable scoring UI

---

### USER / CLUB

* Chỉ xem
* Không có action button

---

## Quan trọng

* Không ẩn màn hình theo role
* Chỉ disable action

---

# 5. DATA MODEL (gợi ý)

user:

* id
* role
* club_id

participant:

* id
* name
* club_id

match:

* id
* status
* participant_a_id
* participant_b_id
* winner_id
* round
* weight_class

score:

* id
* match_id
* judge_id
* score_value

---

# 6. OUTPUT YÊU CẦU

* Implement:

  * RBAC middleware / guard
  * Match service (state machine)
  * Scheduler service
  * API endpoints

* Đảm bảo:

  * Không auto win khi click
  * Scheduler đúng logic round + weight block
  * Permission đúng theo role

* Code rõ ràng, dễ maintain, production-ready
