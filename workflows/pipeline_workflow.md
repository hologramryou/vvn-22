# Workflow: Spec → Design → Implement Pipeline

Pipeline 4 phase, mỗi phase có gate bắt buộc trước khi sang phase tiếp.

## Tổng quan

```
raw_request/
    │  /spec-clarification
    ▼
basic_design/          ← Gate 1: user confirm business flow, rule, event
    │  /api-contract-generation
    ▼
detail_design/         ← Gate 2: user confirm API contract, DB effects
    │  /worktree new <feature>
    ▼
implement (worktree)   ← Gate 3: tsc + pytest pass
    │  /commit w <msg>
    ▼
PR / merge             ← Gate 4: review xong
    │  /worktree remove <feature>
    ▼
done
```

---

## Phase 1 — Làm rõ spec

**Trigger:** User đưa yêu cầu mới hoặc thay đổi business  
**Skill:** `/spec-clarification`  
**Input:** `raw_request/*.md`  
**Output:** `basic_design/<module>/<feature>.md`

**Gate 1 — PHẢI PASS trước khi sang Phase 2:**
- [ ] Actor và flow chính đã xác định
- [ ] Business rule không còn mơ hồ
- [ ] Event nghiệp vụ quan trọng đã liệt kê
- [ ] User đã confirm hoặc assumption được ghi rõ

---

## Phase 2 — Thiết kế kỹ thuật

**Trigger:** Gate 1 pass  
**Skill:** `/api-contract-generation` (hoặc viết tay)  
**Input:** `basic_design/<module>/<feature>.md`  
**Output:** `detail_design/<module>/<feature>.md`

**Gate 2 — PHẢI PASS trước khi sang Phase 3:**
- [ ] API endpoints đầy đủ (method, path, request/response schema)
- [ ] Database effects rõ ràng (bảng nào, field nào thay đổi)
- [ ] Auth/permission đã xác định
- [ ] Acceptance criteria có thể verify được
- [ ] User đã confirm

---

## Phase 3 — Implement (trong worktree)

**Trigger:** Gate 2 pass  
**Skill:** `/worktree new <feature>` → implement → `/commit w <msg>`  
**Input:** `detail_design/<module>/<feature>.md`  
**Output:** code trong `backend/` và `frontend/`

**Thứ tự implement:**
```
backend:  models → schemas → repository → router → tests
frontend: types  → api     → hooks      → pages  → tests
```

**Gate 3 — PHẢI PASS trước khi tạo PR:**
- [ ] `pytest tests/` pass (không có lỗi mới)
- [ ] `npx tsc --noEmit` pass (không có lỗi TS mới)
- [ ] Tất cả AC trong detail_design đã được cover
- [ ] Không có `any` trong TypeScript mới
- [ ] Không có endpoint thiếu auth

---

## Phase 4 — Review & Merge

**Trigger:** Gate 3 pass  
**Skill:** `/commit w <msg>` → tạo PR  
**Action:** Review → merge → `/worktree remove <feature>`

**Gate 4 — Done:**
- [ ] PR được approve
- [ ] Branch đã merge vào main
- [ ] Worktree đã dọn sạch

---

## Quy tắc không phá vỡ

- **Không implement nếu chưa có `detail_design/`** — chạy Phase 1+2 trước.
- **Không merge nếu test fail** — fix trước.
- **Không xóa worktree nếu còn uncommitted changes** — commit hoặc stash trước.
- **Conflict giữa basic/detail design:** basic_design thắng về business intent, detail_design thắng về contract kỹ thuật.
