# Basic Design CLAUDE.md

## Mục Tiêu

`basic_design/` dùng cho người đọc và review nghiệp vụ.

## Bắt Buộc Có

- mục tiêu
- phạm vi
- actor / quyền liên quan
- luồng chính
- business rules có mã `BR-*`
- event nghiệp vụ có mã `EVT-*`
- cụm tính năng và danh sách màn hình
- danh sách API mức Basic Design
- acceptance criteria mức nghiệp vụ

## Không Đưa Vào

- field-level database writes
- processing flow chi tiết của API
- request / response schema quá chi tiết
- implementation note cho code

## Naming

- file đặt theo `basic_design/<module>/<feature_name>.md`
- clarification artifact đặt tại `basic_design/_clarification/<feature_code>.md`
