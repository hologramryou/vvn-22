# Dynamic Tournament Fix Spec

## 1. Mục tiêu

Chuẩn hóa toàn bộ luồng đăng ký, hiển thị, filter, grouping, sorting và tournament views để dùng đúng dữ liệu của `dynamic tournament structure`, thay cho logic legacy đang bị fix cứng hoặc không đồng bộ.

Mục tiêu cuối:

1. Dữ liệu đăng ký thi đấu của VĐV phải bám theo node tree của giải.
2. Màn `/students`, filter, `/tournaments`, sơ đồ, bracket, schedule và quyền phải dùng cùng một source of truth.
3. Không còn tình trạng UI hiển thị đúng nhưng filter, count, bracket hoặc sorting vẫn chạy theo legacy.

## 2. Source of truth

Trong `dynamic tournament`, dữ liệu đúng phải lấy từ:

1. `StudentWeightAssignment.node_id`
   - Là node lá cuối cùng mà VĐV được gán trong cây thi đấu.
   - Đây là nguồn sự thật cho nhánh phân loại theo tree.

2. `TournamentStructureNode`
   - Là cây cấu trúc đã setting trong giải.
   - Dùng để suy ra:
     - root giới tính
     - hạng mục
     - nhóm / loại
     - hạng cân
     - thứ tự sắp xếp theo `sort_order`

3. `StudentContestSelection`
   - Là dữ liệu VĐV đăng ký nội dung thi đấu nào.
   - `sparring` = đối kháng
   - `kata` = quyền

4. `TournamentKata`
   - Là danh sách bài quyền đã setting cho giải.
   - Dùng để lấy tên bài quyền và thứ tự hiển thị / grouping nếu cần.

Trong `dynamic mode`, không dùng các field legacy sau làm nguồn chính:

1. `Student.weight_class`
2. `Student.weight_classes`
3. `Student.category_type`
4. `Student.category_loai`
5. `Student.compete_events`
6. `Student.quyen_selections`

Các field legacy chỉ giữ vai trò backward compatibility cho `legacy mode`.

## 3. Quy tắc đăng ký thi đấu

### 3.1. Chọn giới tính

1. Khi chọn `Nam` hoặc `Nữ`, hệ thống phải map vào `Node 0` tương ứng trong tree.
2. `Node 0` chỉ là root theo giới tính, dùng làm điểm bắt đầu để load các node phía dưới.

### 3.2. Tab Đối kháng

1. Tab `Đối kháng` hiển thị các node từ `Node 1` trở đi dưới root giới tính đã chọn.
2. User chọn dần từ trên xuống đến `node lá cuối cùng`.
3. `node lá cuối cùng` là `hạng cân`.
4. Khi user chọn xong, giá trị đúng để lưu là:
   - `StudentWeightAssignment.node_id = leaf node id`

### 3.3. Tab Quyền

1. Tab `Quyền` cho phép chọn 1 hoặc nhiều bài quyền từ `TournamentKata`.
2. Các bài quyền được lưu vào `StudentContestSelection` với `contest_type = kata`.

### 3.4. Các case hợp lệ

Hệ thống phải support đúng 3 case:

1. Chỉ thi đối kháng
2. Chỉ thi quyền
3. Thi cả đối kháng và quyền

### 3.5. Validation

1. Bắt buộc phải có ít nhất 1 nội dung thi đấu:
   - `sparring`
   - hoặc `kata`
2. Không được cho submit nếu cả `Đối kháng` và `Quyền` đều không chọn.
3. Chỉ cho submit nếu node được chọn là `node lá / node hạng cân`.
4. Không cho đăng ký ở node trung gian.
5. `gender` của VĐV phải khớp với root level-0 (`M/F`) của node đã chọn.
6. Nếu có `rule_json` về age / belt / weight thì phải validate đúng trước khi lưu.

### 3.6. Rule UI/State của tab Đối kháng

Đây là lỗi hiện tại cần fix rõ:

1. Khi user bỏ check `Đối kháng`, hệ thống phải coi là `không thi đối kháng`.
2. Các node đã chọn bên trong tab `Đối kháng` không còn được dùng để pass validation.
3. Không được hiển thị badge, summary hoặc trạng thái completed như là đã đăng ký đối kháng khi checkbox đang tắt.

Rule implement:

1. Khuyến nghị:
   - Khi uncheck `Đối kháng`, clear luôn selection path của nhánh này và reset `node_id`.

2. Nếu vì UX muốn giữ lại selection để bật lại nhanh:
   - Có thể giữ state tạm ở UI.
   - Nhưng state đó không được dùng để validation.
   - Không được lưu như đăng ký `sparring`.
   - Không được render như đang thi đối kháng.

3. Chỉ khi checkbox `Đối kháng` = bật và đã chọn `leaf node` thì mới hợp lệ cho nhánh đối kháng.

4. Nếu checkbox `Đối kháng` = tắt thì toàn bộ node đã chọn trước đó trong tab này phải bị bỏ qua hoàn toàn.

5. Nếu chỉ còn `Quyền` được chọn thì submit như case chỉ thi quyền.

6. Nếu cả `Đối kháng` và `Quyền` đều tắt thì báo lỗi, không cho submit.

### 3.7. Rule UI/State của tab Quyền

1. Nếu bỏ check `Quyền` thì xem như không thi quyền.
2. Các bài quyền đã chọn không được dùng để render hoặc lưu như đăng ký `kata` khi tab `Quyền` đang tắt.
3. Validation phải phản ánh đúng trạng thái checkbox, không dựa vào state cũ còn sót lại.

## 4. Quy tắc hiển thị tại `/students`

Trang `/students` phải hiển thị đúng dữ liệu dynamic theo assignment + tree + contest selection.

### 4.1. Hạng mục

1. `Hạng mục` phải lấy từ `node_path` của `StudentWeightAssignment.node_id`.
2. Cụ thể: lấy `node thứ 2 sau root Nam/Nữ`.
3. Ví dụ:
   - `Nam > Phong trào > Loại 1A > 20kg`
   - `Hạng mục = Phong trào`

### 4.2. Hạng cân

1. `Hạng cân` phải lấy từ `node lá cuối cùng`.
2. Ví dụ:
   - `Nam > Phong trào > Loại 1A > 20kg`
   - `Hạng cân = 20kg`

### 4.3. Nội dung thi đấu

1. Nếu có `StudentContestSelection.contest_type = sparring` thì thêm `Đối kháng`.
2. Nếu có `StudentContestSelection.contest_type = kata` thì nối thêm tên các bài quyền đã chọn.
3. Format hiển thị là nối bằng dấu phẩy.
4. Ví dụ:
   - `Đối kháng`
   - `Long hổ quyền`
   - `Đối kháng, Long hổ quyền, Tứ trụ quyền`

### 4.4. Trường hợp chỉ thi quyền

1. Nếu VĐV chỉ thi quyền:
   - `Nội dung thi đấu` chỉ hiển thị các bài quyền đã chọn.
   - Không được tự render `Đối kháng`.
2. Việc xử lý `Hạng mục` và `Hạng cân` phải an toàn theo assignment / tree hiện có.
3. Không được crash nếu không có `sparring`.

### 4.5. Nguyên tắc hiển thị

1. Toàn bộ display phải derive từ:
   - `StudentWeightAssignment.node_id`
   - `TournamentStructureNode`
   - `StudentContestSelection`
   - `TournamentKata`
2. Không hardcode text từ field legacy.
3. Chỉ hiển thị VĐV đã đăng ký trong giải đang chọn.
4. Count chỉ tính VĐV có `status = active`.

## 5. Filter tại `/students`

Các filter phải dùng cùng nguồn dữ liệu với phần display.

### 5.1. Filter Hạng mục

1. Filter theo node ở cấp `hạng mục` trong dynamic tree.
2. Không filter theo `Student.category_type` legacy.

### 5.2. Filter Hạng cân

1. Filter theo `leaf node` / `StudentWeightAssignment.node_id`.
2. Không filter theo `Student.weight_class` hoặc `Student.weight_classes` legacy.

### 5.3. Filter Nội dung thi đấu

1. Filter `Đối kháng` theo `StudentContestSelection.contest_type = sparring`.
2. Filter `Quyền` theo `StudentContestSelection.contest_type = kata`.
3. Nếu filter theo bài quyền cụ thể thì phải join `TournamentKata`.

### 5.4. Quy tắc đồng bộ

1. Trường nào đang hiển thị theo dynamic source thì filter của trường đó cũng phải dùng dynamic source.
2. Không để display đúng nhưng filter vẫn dựa vào dữ liệu legacy.

## 6. `/tournaments`, sơ đồ, bracket, schedule

Sau khi chuyển sang dynamic, các màn tournament cũng phải dùng cùng source of truth.

### 6.1. Tree / node statistics

1. `student_count` của node phải lấy từ `StudentWeightAssignment`.
2. Chỉ tính VĐV active.
3. Xóa hết VĐV active khỏi node thì count phải về 0 ngay ở mọi nơi.

### 6.2. Đối kháng

1. Grouping theo hạng cân phải dựa trên `leaf node` thực tế.
2. Hiển thị category / nhóm / giới tính phải suy ra từ path của node.
3. Không hardcode danh sách hạng cân.

### 6.3. Quyền

1. Danh sách quyền, slot quyền, schedule quyền phải lấy từ:
   - `StudentContestSelection`
   - `TournamentKata`
2. Không dùng mapping quyền cũ fix cứng.

### 6.4. Summary / participant grouping

1. Tất cả summary, count, grouping phải phản ánh đúng đăng ký dynamic.
2. Nếu user không có `sparring` thì không được xuất hiện ở luồng đối kháng.
3. Nếu user không có `kata` thì không được xuất hiện ở luồng quyền.

## 7. Sorting / grouping algorithm

Phải sửa toàn bộ thuật toán sort/group cũ nếu đang hardcode theo legacy.

### 7.1. Sorting đối kháng

1. Thứ tự hạng cân phải theo `TournamentStructureNode.sort_order`.
2. Không sort theo danh sách kg cứng cũ.
3. Không parse text thủ công nếu tree đã có thứ tự.

### 7.2. Sorting quyền

1. Thứ tự bài quyền phải theo dữ liệu `TournamentKata` hoặc order đã setting.
2. Không dùng rule cũ fix cứng.

### 7.3. Grouping

1. Group theo node path + contest selection thực tế.
2. Không group theo `category_type`, `category_loai`, `weight_class` legacy trong dynamic mode.

### 7.4. Bracket / schedule generation

1. Dynamic tournament phải generate bracket / schedule từ:
   - assignment node thực tế
   - contest selection thực tế
   - tree setting thực tế
2. Legacy logic chỉ dùng cho `legacy mode`.

## 8. Tách biệt legacy và dynamic

1. `Legacy mode` tiếp tục dùng luồng cũ nếu cần.
2. `Dynamic mode` phải ưu tiên hoàn toàn:
   - `StudentWeightAssignment`
   - `TournamentStructureNode`
   - `StudentContestSelection`
   - `TournamentKata`
3. Không trộn source:
   - display dynamic nhưng filter legacy
   - list dynamic nhưng bracket legacy
   - schedule dynamic nhưng sorting legacy
4. Không sync ngược node id vào `Student.weight_class` hoặc `Student.weight_classes` nếu schema hiện tại không thiết kế như vậy.

## 9. API contract tối thiểu

### 9.1. Register dynamic participant

Input:

1. `tournament_id`
2. `student_id`
3. `node_id`
4. `contest_types[]`

Output cần đủ để render lại chính xác:

1. assignment
2. `node_path`
3. normalized fields để hiển thị ở list nếu cần

### 9.2. Get structure nodes

1. Trả `student_count` đã lọc active.
2. Count phải phản ánh assignment thực tế.

### 9.3. Get students by tournament

1. Trả fields derive từ assignment / node / contest selection.
2. Không lệch với tree setting.

## 10. Acceptance criteria

1. Chọn node `Nam` thì không đăng ký được VĐV `Nữ`, và ngược lại.
2. Không thể đăng ký nếu node chọn không phải node hạng cân.
3. Có thể đăng ký đúng 3 case:
   - chỉ đối kháng
   - chỉ quyền
   - cả hai
4. Nếu cả `Đối kháng` và `Quyền` đều không chọn thì không được submit.
5. Khi bỏ check `Đối kháng`, các node đã chọn trước đó không còn được dùng để pass validation, không được tính là đăng ký đối kháng, và không được lưu như dữ liệu đối kháng hợp lệ.
6. Khi bỏ check `Quyền`, các bài quyền đã chọn trước đó không còn được dùng để pass validation hoặc lưu như dữ liệu quyền hợp lệ.
7. `/students` hiển thị đúng:
   - `Hạng mục` theo node thứ 2 sau `Nam/Nữ`
   - `Hạng cân` theo node lá cuối
   - `Nội dung thi đấu` theo `sparring` + `kata`
8. Filter `/students`, tree count, bracket participants và tournament tabs luôn khớp cùng một source of truth dynamic.
9. Sorting hạng cân và quyền bám theo dynamic setting hiện tại của giải.
10. Xóa toàn bộ VĐV active khỏi node thì count = 0 ở mọi nơi.
11. Student list, tree count, bracket participants và schedule luôn khớp nhau.
12. Refresh trang không làm đổi kết quả nếu dữ liệu không đổi.

## 11. Kế hoạch implementation cho AI

1. Backend:
   - Chuẩn hóa guard và query theo active filter.
   - Refactor API list theo assignment / node / contest selection.
   - Refactor filter `/students` để dùng dynamic source of truth.
   - Refactor grouping / sorting / bracket / schedule để bỏ logic hardcode legacy trong dynamic mode.

2. Frontend:
   - Refactor UI đăng ký để enforce node hạng cân.
   - Fix checkbox/state của tab `Đối kháng`.
   - Fix checkbox/state của tab `Quyền`.
   - Đồng bộ display và filter theo dynamic source.

3. Test:
   - Register
   - Edit / reassign
   - Uncheck `Đối kháng`
   - Uncheck `Quyền`
   - Delete / bulk delete
   - Count sync
   - Filter sync
   - Bracket / schedule sync

## 12. Kết luận

Đây không phải bug fix cục bộ cho `/students`.

Đây là một refactor nghiệp vụ để chuyển toàn bộ `dynamic tournament` sang đúng mô hình:

1. tree setting
2. assignment node
3. contest selections
4. kata settings

Mọi hiển thị, filter, sort, grouping, bracket, schedule phải dùng chung một source of truth.
