# Quản Lý Câu Lạc Bộ

## Tổng Quan
Spec này mô tả chức năng quản lý Câu Lạc Bộ trong hệ thống Vovinam Fighting. Chỉ người dùng có vai trò ADMIN mới có quyền truy cập và sử dụng các chức năng này.

## Yêu Cầu Truy Cập
- Chỉ ADMIN mới nhìn thấy sidebar/menu liên quan đến quản lý Câu Lạc Bộ
- Các vai trò khác (USER, CLUB_MANAGER, etc.) không thấy sidebar này

## Chức Năng Chính

### 1. Xem Danh Sách Câu Lạc Bộ
- Hiển thị danh sách tất cả Câu Lạc Bộ trong hệ thống
- Thông tin hiển thị cho mỗi Câu Lạc Bộ:
  - Tên Câu Lạc Bộ
  - Mô tả
  - Ngày thành lập
  - Số lượng thành viên
  - Trạng thái (Active/Inactive)
  - Ngày tạo/cập nhật cuối

### 2. Thêm Câu Lạc Bộ Mới
- Form thêm mới với các trường:
  - Tên Câu Lạc Bộ (bắt buộc, unique)
  - Mô tả (optional)
  - Ngày thành lập (date picker)
  - Logo/avatar (upload file)
  - Địa chỉ
  - Email liên hệ
  - Số điện thoại
- Validation:
  - Tên không được trùng
  - Email phải đúng định dạng
  - Các trường bắt buộc phải điền

### 3. Sửa Thông Tin Câu Lạc Bộ
- Chọn Câu Lạc Bộ từ danh sách để chỉnh sửa
- Form sửa tương tự form thêm, nhưng có dữ liệu pre-filled
- Có thể thay đổi tất cả thông tin trừ ID
- Validation giống như form thêm

### 4. Xóa Câu Lạc Bộ
- Xóa mềm (soft delete) - đánh dấu inactive thay vì xóa hẳn
- Confirmation dialog trước khi xóa
- Kiểm tra ràng buộc:
  - Nếu Câu Lạc Bộ có thành viên hoặc giải đấu đang hoạt động, không cho phép xóa
  - Hiển thị warning nếu có dữ liệu liên quan

## Giao Diện Người Dùng

### Sidebar
- Menu "Quản Lý Câu Lạc Bộ" chỉ hiển thị cho ADMIN
- Icon phù hợp (ví dụ: shield hoặc group icon)

### Trang Danh Sách
- Bảng hiển thị danh sách Câu Lạc Bộ
- Các cột: Tên, Mô tả, Thành viên, Trạng thái, Actions
- Buttons: Thêm mới, Sửa, Xóa cho mỗi row
- Search và filter theo tên, trạng thái

### Form Thêm/Sửa
- Modal hoặc trang riêng
- Fields theo yêu cầu ở trên
- Buttons: Lưu, Hủy

## API Endpoints

### Backend APIs
- `GET /api/admin/clubs` - Lấy danh sách Câu Lạc Bộ
- `POST /api/admin/clubs` - Tạo Câu Lạc Bộ mới
- `PUT /api/admin/clubs/{id}` - Cập nhật Câu Lạc Bộ
- `DELETE /api/admin/clubs/{id}` - Xóa Câu Lạc Bộ (soft delete)

### Frontend APIs
- Tương ứng với backend APIs
- Thêm error handling và loading states

## Bảo Mật
- Tất cả APIs yêu cầu authentication với role ADMIN
- Frontend check role trước khi render sidebar
- Audit log cho các thao tác thêm/sửa/xóa

## Validation Rules
- Tên Câu Lạc Bộ: 2-100 ký tự, không chứa ký tự đặc biệt
- Mô tả: tối đa 500 ký tự
- Email: định dạng email hợp lệ
- Số điện thoại: định dạng Việt Nam (+84 hoặc 0xxxxxxxxx)

## Xử Lý Lỗi
- Hiển thị thông báo lỗi rõ ràng cho người dùng
- Log errors cho admin debugging
- Rollback transaction nếu có lỗi trong quá trình lưu

## Testing
- Unit tests cho validation logic
- Integration tests cho APIs
- UI tests cho forms và danh sách