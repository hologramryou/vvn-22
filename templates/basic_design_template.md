# [Tên tính năng] - Basic Design

**Mã tính năng:** `[FEATURE_CODE]`  
**Phiên bản:** `0.1`  
**Ngày:** `YYYY-MM-DD`  
**Trạng thái:** `Draft | In Review | Approved`

---

## 1. Mục tiêu

- Tính năng này giải quyết vấn đề gì
- Dành cho ai
- Giá trị mang lại

## 2. Phạm vi

### In Scope

- 

### Out of Scope

- 

## 3. Vai trò sử dụng

| Vai trò | Mô tả | Quyền liên quan |
|---|---|---|
| Admin |  |  |
| User |  |  |

## 4. Tổng quan nghiệp vụ

### 4.1 Luồng chính

1. 
2. 
3. 

### 4.2 Business Rules

- `BR-01`: 
- `BR-02`: 

### 4.3 Event nghiệp vụ

Lưu ý:
- Tại Basic Design chỉ mô tả **ý nghĩa nghiệp vụ** của event
- Không đi sâu vào xử lý API hay database

| Event ID | Tên event | Khi nào xảy ra | Ý nghĩa nghiệp vụ | Business Rule liên quan |
|---|---|---|---|---|
| EVT-01 |  |  |  |  |

## 5. Cụm tính năng và màn hình

Màn hình nên nhóm theo **cụm tính năng**, không mô tả rời rạc từng màn hình độc lập.

### 5.1 Cụm tính năng: [Tên cụm]

**Mục đích:**
- 

**Danh sách màn hình:**

| Mã màn hình | Tên màn hình | Mục đích |
|---|---|---|
| SCR-01 |  |  |

**Điều hướng chính:**

```text
Screen A -> Screen B -> Screen C
```

## 6. Danh sách API ở mức Basic Design

Lưu ý:
- Chỉ liệt kê danh sách API để người đọc hiểu hệ thống cần gì
- Chi tiết request/response/flow xử lý sẽ nằm ở Detail Design

| API ID | Method | Path | Mục đích | Vai trò gọi |
|---|---|---|---|---|
| API-01 | GET | /... |  |  |

## 7. Dữ liệu và thực thể liên quan

| Thực thể | Mô tả | Ghi chú |
|---|---|---|
| Club |  |  |
| Student |  |  |

## 8. Ràng buộc và giả định

- 

## 9. Acceptance Criteria mức nghiệp vụ

- `AC-01`: 
- `AC-02`: 

## 10. Open Questions

- `Q-01`: 
