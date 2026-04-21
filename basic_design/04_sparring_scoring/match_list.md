Tạo màn hình chi tiết trận đấu vovinam cho trọng tài với các yêu cầu sau:

**Layout tổng thể:**
- Nền tối gradient từ xám đen sang xám đậm
- Responsive hoàn toàn cho cả mobile và desktop
- Header có nút quay lại, tên vòng đấu, và hiển thị hiệp đấu hiện tại

**Phần bảng điểm (2 cột ngang nhau):**
- Bên trái: PHÍA ĐỎ - gradient đỏ (from-red-600 to-red-800), viền đỏ sáng
- Bên phải: PHÍA XANH - gradient xanh dương (from-blue-600 to-blue-800), viền xanh sáng
- Điểm số hiển thị cực lớn (text-8xl trên mobile, text-[12rem] trên desktop)
- Tên vận động viên hiển thị phía dưới điểm
- Bo tròn, có shadow và border sáng

**Phần timer (dưới bảng điểm, bên trái):**
- Icon đồng hồ
- Thời gian hiển thị theo định dạng MM:SS với font mono rất lớn
- Nút Bắt đầu/Tạm dừng: xanh lá khi chưa chạy, cam/vàng khi đang chạy
- Nút Reset Timer màu xám
- Nút "Hiệp tiếp theo" màu tím (chỉ hiện khi chưa hết số hiệp)
- Nút "Reset tất cả" màu đỏ
- Tất cả nút có gradient, shadow, và icon

**Phần điều khiển điểm (dưới bảng điểm, bên phải):**
- Chia 2 cột: ĐỎ và XANH
- Mỗi bên có:
  - Tiêu đề màu tương ứng
  - 2 nút cộng điểm nhanh: +1 và +2 (gradient đậm)
  - Bảng hiển thị điểm hiện tại lớn (text-5xl)
  - 2 nút điều chỉnh tinh: +1 và -1
  - Nút label phía dưới (ĐỎ/XANH) với gradient và viền
- Tất cả nút có gradient tương ứng màu đỏ/xanh, shadow, bo góc

**Chức năng:**
- Timer đếm ngược từ 180 giây (3 phút)
- Click nút Bắt đầu/Tạm dừng để điều khiển timer
- Các nút +1, +2 để cộng điểm nhanh
- Các nút +1, -1 để điều chỉnh điểm (không cho âm)
- Quản lý nhiều hiệp đấu (mặc định 2 hiệp)
- Reset timer riêng hoặc reset toàn bộ
- Navigation: nhận dữ liệu từ router state (số trận, tên VĐV, vòng đấu)

**Màu sắc chủ đạo:**
- Background: gradient gray-900 → gray-800 → gray-900
- Đỏ: red-600 → red-800 với border red-400/50
- Xanh: blue-600 → blue-800 với border blue-400/50
- Xám: gray-800/90 → gray-700/90 cho các panel phụ
- Nút xanh lá: green-500 → emerald-600
- Nút cam: yellow-500 → orange-500
- Nút tím: purple-600 → purple-700
- Nút đỏ: red-600 → red-700

**Grid layout:**
- Desktop: lg:grid-cols-2 với gap-6
- Bảng điểm: lg:col-span-2 (full width)
- Timer và Controls: mỗi cái 1 cột

Dùng React, TypeScript, Tailwind CSS, Lucide React icons, React Router