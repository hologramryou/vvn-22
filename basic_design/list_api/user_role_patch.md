# User Role Update — PATCH

## Method
PATCH

## Path
/auth/users/{user_id}/role

## Description
Admin cập nhật role cho user. Dùng để cấp quyền trọng tài (referee).

## Request

### Params
- `user_id` (integer, required)

### Body
```json
{ "role": "referee" }
```
- `role`: "viewer" | "referee" | "admin"

## Response

### Success (200)
```json
{ "id": 5, "username": "trongtai_01", "role": "referee" }
```

### Error
- 403 `FORBIDDEN`: Người gọi không phải admin
- 404 `NOT_FOUND`: User không tồn tại
- 400 `INVALID_ROLE`: Role không hợp lệ

## Rules
- Chỉ admin mới được thay đổi role
- Không tự đổi role của chính mình
- Các role hợp lệ: viewer, referee, admin

## Used By Screens
_(admin settings — ngoài scope sprint này)_
