📘 FUNCTIONAL SPEC – TOURNAMENT (VOVINAM)
1. 🎯 Mục tiêu chức năng

Chức năng Tournament cho phép:

Quản lý thi đấu theo hạng cân
Tự động tạo bracket
Theo dõi trạng thái trận đấu
Hiển thị tiến trình thi đấu
Quản lý lịch thi đấu theo mã trận
2. 🧩 Phạm vi

Áp dụng cho:

Thi đấu đối kháng (1 vs 1)
Mỗi hạng cân là một bracket độc lập

Không bao gồm:

Chấm điểm chi tiết
Livestream / scoring system (có thể mở rộng sau)
3. 👥 Quản lý vận động viên
3.1 Nguồn dữ liệu
Vận động viên được lấy từ danh sách đã đăng ký trên hệ thống
3.2 Điều kiện tạo bracket
Tối thiểu 2 vận động viên
Nếu < 2:
→ Không cho phép tạo bracket
4. 🌳 Tạo Bracket
4.1 Nguyên tắc
Hệ thống tự động sinh bracket theo dạng loại trực tiếp (single elimination)
4.2 Trường hợp số lượng vận động viên
✔ Số chẵn
Chia cặp thi đấu bình thường
✔ Số lẻ
Một số vận động viên sẽ được:
👉 đặc cách (BYE)
Đặc điểm:
Không cần thi đấu vòng đó
Tự động được vào vòng tiếp theo
4.3 Cấu trúc bracket
Mỗi trận đấu là một node
Mỗi node gồm:
2 vận động viên
Kết quả trận
Liên kết đến trận tiếp theo
5. 🆔 Mã trận đấu
Mỗi trận có một match code duy nhất
Format gợi ý:
Vòng 1: A1, A2, A3...
Vòng 2: B1, B2...
Chung kết: C1

👉 Dùng để:

Mapping với lịch thi đấu
Tìm kiếm nhanh trận
6. 🔄 Trạng thái trận đấu
6.1 Các trạng thái
Trạng thái	Ý nghĩa
Chưa diễn ra	Trận chưa bắt đầu
Đang diễn ra	Trận đang thi đấu
Đã diễn ra	Trận đã kết thúc
6.2 Hành vi

Chỉ được chuyển trạng thái theo thứ tự:

Chưa diễn ra → Đang diễn ra → Đã diễn ra
6.3 Kết quả trận đấu
Khi trận kết thúc:
Xác định người chiến thắng
Người thắng sẽ được đưa vào trận tiếp theo
7. 🎨 Hiển thị Bracket
7.1 Quy tắc hiển thị node

Mỗi trận gồm 2 dòng:

VĐV trên: màu xanh
VĐV dưới: màu đỏ
7.2 Highlight
Trạng thái	Hiển thị
Chưa diễn ra	Màu xám
Đang diễn ra	Màu nổi bật (vàng/cam)
Đã diễn ra	Highlight người thắng
7.3 Quy tắc highlight
Node (trận đấu): nền xanh nhạt
Người thắng:
Viền nổi bật
Có icon hoặc hiệu ứng
Chỉ 1 người thắng được highlight
8. 🖱️ Tương tác người dùng
8.1 Click vào trận đấu
Trận chưa diễn ra
Mở màn hình trận đấu
Chỉ cho phép trọng tài thao tác
Trận đang diễn ra
Hiển thị màn hình theo dõi trực tiếp
Trận đã diễn ra
Hiển thị kết quả trận đấu
9. 🧾 Lịch thi đấu (Match Schedule)
9.1 Mục đích
Hiển thị toàn bộ các trận theo danh sách
Cho phép theo dõi nhanh trạng thái
9.2 Thông tin hiển thị
Trường	Mô tả
Mã trận	Ví dụ: A1, B2
Vận động viên A	
Vận động viên B	
Trạng thái	
Kết quả	(nếu có)
9.3 Đồng bộ với bracket
Mỗi trận trong schedule tương ứng 1 node
Khi cập nhật kết quả:
Bracket và Schedule phải đồng bộ
10. 🔐 Phân quyền
Vai trò	Quyền
Trọng tài	Cập nhật trạng thái, nhập kết quả
Người xem	Chỉ xem
11. ⚠️ Các trường hợp đặc biệt
11.1 BYE
VĐV tự động thắng
Không hiển thị đối thủ
11.2 VĐV bỏ cuộc
Đối thủ thắng mặc định
11.3 Trận chưa đủ người
Không thể bắt đầu
12. ❗ Các điểm cần xác nhận thêm

Để hoàn thiện spec, bạn cần quyết định:

Có seed (xếp hạng) hay random?
->random

Có thời gian thi đấu cụ thể không?
-> Không cần thời gian thi đấu cụ thể chỉ cần thứ tự thi đấu người ở trên sân sẽ điều phối theo thứ tự match 

Có nhiều trận diễn ra cùng lúc không?
chỉ có 2 trận diễn ra cùng lúc ở 2 sân

Có chia theo sàn đấu (mat) không?
-> có chia theo sàn sàn A và sàn B 

Kết quả trận có cần điểm số hay chỉ thắng/thua?
Cần cả điểm số 