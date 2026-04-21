# detail_design/ - Detail Design Markdown

`detail_design/` la thu muc chua **Detail Design** danh cho AI, code generation, validation va traceability ky thuat.

## Vai tro

- `raw_request/` = yeu cau tho tu nguoi dung
- `basic_design/` = Basic Design cho nguoi doc
- `detail_design/` = Detail Design Markdown cho AI implement

## Muc tieu cua Detail Design

- Mo ta ro danh sach API
- Mo ta ro man hinh nao goi API nao
- Mo ta ro event, trigger va business reference
- Mo ta ro luong xu ly API va backend processing
- Mo ta ro database effects: bang nao, field nao, thao tac nao
- Du chi tiet de implement, review va verify

## Cau truc khuyen nghi

```text
detail_design/
`-- 01_student_management/
    |-- student_list.md
    `-- student_detail.md
```

## Nguyen tac

1. Man hinh nhom theo cum tinh nang.
2. API phai co danh sach rieng, de scan nhanh.
3. Moi man hinh phai refer toi API lien quan.
4. Moi event phai co:
   - trigger
   - business reference
   - api sequence
   - database effects
5. Moi API phai chi ro:
   - request
   - response
   - validation
   - bang/field bi tac dong

## Template chuan

Khi tao moi, uu tien dung:

- `templates/detail_design_template.md`

## Luu y ve legacy

Repo hien con mot so file `.yaml` trong `detail_design/` do pipeline cu sinh ra.
Nhung file do la artifact legacy, khong con la dinh dang chuan cho feature moi.
