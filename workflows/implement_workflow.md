# Workflow: Implement Feature (trong Worktree)

Dùng workflow này sau khi `detail_design/` đã được chốt.

## Điều kiện tiên quyết (PHẢI có trước khi bắt đầu)

```bash
# Kiểm tra detail_design tồn tại
ls detail_design/<module>/<feature>.md
```

Nếu chưa có → quay lại `pipeline_workflow.md`, chạy Phase 1+2 trước.

---

## Bước 1 — Tạo worktree

```
/worktree new <feature-name>
```

Claude sẽ:
1. Tạo branch `feat/<feature-name>`
2. Checkout sang `../vovinam-<feature-name>/`
3. Xác nhận spec gate trước khi code

---

## Bước 2 — Đọc detail_design

Đọc `detail_design/<module>/<feature>.md` và extract:
- Danh sách API endpoints
- Schema request/response
- Database effects (bảng/field bị thay đổi)
- Acceptance criteria
- Auth requirements

---

## Bước 3 — Implement theo thứ tự dependency

### Backend (FastAPI)
```
models      →  backend/app/models/
schemas     →  backend/app/schemas/
repository  →  backend/app/repositories/
router      →  backend/app/routers/
migration   →  backend/alembic/versions/
tests       →  backend/tests/
```

Sau mỗi layer: `pytest tests/<module>/` trước khi sang layer tiếp.

### Frontend (React + TypeScript)
```
types       →  frontend/src/types/
api layer   →  frontend/src/api/
hooks       →  frontend/src/hooks/
pages/comp  →  frontend/src/pages/ hoặc components/
```

Sau khi xong: `npx tsc --noEmit` — fix hết lỗi trước khi báo done.

---

## Bước 4 — Verify Acceptance Criteria

Với mỗi AC trong detail_design:
```
Given [condition] → code xử lý điều kiện đó chưa?
When  [action]    → code thực hiện đúng action chưa?
Then  [result]    → code trả về đúng result chưa?
```

Nếu AC chưa cover → ghi `[MISSING: <AC text>]` và báo user.

---

## Bước 5 — Commit và push

```
/commit w "feat: <mô tả ngắn>"
```

Sau đó tạo PR để review.

---

## Bước 6 — Dọn dẹp sau merge

```
/worktree remove <feature-name>
```

---

## Checklist nhanh trước khi báo "done"

- [ ] `pytest tests/` — không có lỗi mới
- [ ] `npx tsc --noEmit` — không có lỗi TS mới
- [ ] Tất cả AC đã cover (không có `[MISSING]`)
- [ ] Không có `any` trong TypeScript
- [ ] Không có endpoint thiếu auth/permission check
- [ ] Migration đã chạy được (`alembic upgrade head`)
