# Backend CLAUDE.md

## Áp Dụng Cho

- `backend/app/`
- `backend/tests/`
- `backend/alembic/`

## Quy Tắc Kiến Trúc

- Dùng luồng: `routers/ -> repositories/ -> models/`.
- Không viết query DB trực tiếp trong `routers/`.
- Mọi request/response quan trọng phải có schema Pydantic.
- Dùng `AsyncSession` và async/await nhất quán.
- Khi sửa model DB, tạo migration Alembic nếu có thay đổi schema.

## Quy Tắc API

- Router chỉ xử lý HTTP concerns, validation bổ sung nhẹ và gọi repository/service.
- Lỗi nghiệp vụ quan trọng không được swallow silently.
- Response model phải khớp với contract trong Detail Design.
- Nếu AC có mã lỗi, auth, permission hoặc pagination, implement rõ ràng, không đoán.

## Quy Tắc Dữ Liệu

- Mapping ghi dữ liệu phải bám `detail_design/...`:
  - bảng nào
  - field nào
  - operation nào
- Không tự ý thêm relationship nếu spec chưa đủ rõ.

## Xác Minh

- Nếu sửa backend logic, ưu tiên chạy `pytest` nếu môi trường cho phép.
- Nếu sửa migration, kiểm tra luồng upgrade path.
