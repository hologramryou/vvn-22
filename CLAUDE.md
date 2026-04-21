# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Start full stack (local dev):**
```bash
docker compose up -d
docker compose exec api alembic upgrade head   # run migrations
docker compose exec api python -m app.seed     # seed initial data
```

Docker ports: Postgres → 5433, Redis → 6380, API → 8001, Web → 5174.

**Frontend (in `frontend/`):**
```bash
npm run dev      # Vite dev server on :5173
npm run build    # production build
```

**Backend (in `backend/`):**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

alembic upgrade head          # apply migrations
alembic downgrade -1          # rollback one
alembic revision -m "desc"    # new migration

pytest tests/                 # run backend tests
```

**Deploy to Railway:**
```bash
bash deploy-railway.sh
```

---

## Muc Dich

File nay la entry guide o root repo. Dung de dinh huong nhanh agent/nguoi sua code truoc khi di sau vao `backend/`, `frontend/` hoac cac tai lieu spec.

## Buc Tranh Repo Hien Tai

- Repo co 2 khoi chinh chay that:
  - `backend/`: FastAPI + SQLAlchemy async + Alembic
  - `frontend/`: React 18 + TypeScript + Vite + TanStack Query
- Repo dong thoi chua he thong tai lieu/spec pipeline:
  - `raw_request/`: yeu cau tho
  - `basic_design/`: tai lieu nghiep vu cho nguoi doc
  - `detail_design/`: tai lieu ky thuat cho AI/implementer
- Repo co them lop runtime va memory cho agent trong `.claude/`.

## Source Of Truth

Cho feature moi hoac thay doi nghiep vu:

1. `raw_request/` ghi yeu cau goc
2. `basic_design/` chot business flow, rule, event, screen scope
3. `detail_design/` chot API contract, processing flow, database effects, mapping ky thuat
4. `backend/` va `frontend/` implement theo spec da chot

Khong tao source of truth song song o noi khac.

## Nhung Gi Da Legacy

- Khong tao moi `human_spec.md`.
- Khong tao moi `agent_spec.yaml`.
- Khong dung `detail_design/legacy_yaml/` lam dau vao cho feature moi.
- Neu gap artifact cu chi coi la tai lieu tham khao, khong mo rong them tren format cu.

## Uu Tien Doc Tai Lieu

Khi bat dau mot task, doc theo thu tu:

1. User request hien tai
2. File/code trong pham vi dang sua
3. `CLAUDE.md` gan nhat theo subtree
4. `basic_design/` va `detail_design/` lien quan
5. `README.md` hoac `docs/analysis/` neu can them boi canh
6. `.claude/README.md` va `.claude/agents/AGENTS_STANDARD_VI.md` neu task lien quan workflow/agent/runtime

Neu co mau thuan:

- Code hien tai quyet dinh hien trang runtime
- `basic_design/` quyet dinh business intent
- `detail_design/` quyet dinh contract ky thuat
- Artifact legacy khong thang cac nguon tren

## Repository Map

- `backend/app/`: router, repository, model, schema, config
- `backend/alembic/`: migration
- `backend/tests/`: test backend
- `frontend/src/api/`: API layer
- `frontend/src/hooks/`: hooks cho server state va UI logic
- `frontend/src/pages/`: page-level screens
- `frontend/src/components/`: reusable UI
- `docs/analysis/`: phan tich van de, cleanup note, issue investigation
- `docs/prototypes/`: prototype/debug HTML
- `scripts/spec_pipeline/`: script ho tro pipeline spec
- `scripts/research/`: script nghien cuu/thu nghiem
- `templates/`: template tai lieu
- `workflows/`: quy trinh va naming convention

## Guardrails Chung

- Uu tien sua dung cho theo domain thay vi chap va o root.
- Khong de script debug, file tam, note phan tich moi o root repo.
- Neu them tai lieu moi, dat vao dung nhom:
  - phan tich vao `docs/analysis/`
  - prototype vao `docs/prototypes/`
  - workflow vao `workflows/`
  - raw request vao `raw_request/`
- Khong suy luan nghiep vu bang cach parse chuoi `name` cua tree node trong dynamic tournament structure.
- `Quyen dong doi` phai scope theo `tree_path` thuc te cua tournament structure. Khong duoc luu hoac so sanh theo rieng `kata.name`/`kata_id` ma bo qua `node_id`.
- `Club` / `Đơn Vị` la master data dung chung giua nhieu giai dau. Khong bao gio xoa `Club` khi xu ly xoa giai, va khong dua `club_id` vao scope delete tournament.
- `User` / `Quản lý tài khoản` va `Club` / `Quản lý Đơn vị` co the duoc gan voi nhieu giai dau. Day la lien ket cau hinh theo tournament, khong phai du lieu doc lap cua mot giai.
- Xoa giai chi duoc xoa du lieu thuoc chinh giai do:
  - van dong vien dang ky / assignment / selection trong giai
  - so do giai dau / tournament structure
  - danh sach tran dau / bracket / schedule / quyen slots
  - tong sap huy chuong va cac bang phu thuoc theo tournament_id
  - khong xoa `students` master data neu khong co yeu cau rieng
- Khi xoa giai, khong xoa `User`, khong xoa `Club`, va khong xoa cac cau hinh gan giua `User`/`Club` voi cac giai khac.
- Visibility phai theo role:
  - `admin`: thay tat ca giai dau
  - `coach` / `club`: chi thay cac giai dau ma minh duoc gan hoac tham gia
- Khong bo qua Q&A quan trong roi tu dong sang phase tiep theo. Neu buoc phai tiep tuc, phai ghi assumption ro trong artifact dang tao.

## Quy Tac Theo Khu Vuc

- Backend rule: `backend/CLAUDE.md`
- Frontend rule: `frontend/CLAUDE.md`
- Basic Design rule: `basic_design/CLAUDE.md`
- Detail Design rule: `detail_design/CLAUDE.md`

Cac file nay cu the hon root file. Khi lam trong subtree tuong ung, phai uu tien rule tai do.

## Workflow References

- Naming convention: `workflows/spec_naming_convention.md`
- Clarification workflow: `workflows/clarification_workflow.md`
- **Pipeline (đọc khi bắt đầu feature mới):** `workflows/pipeline_workflow.md`
- **Implement (đọc khi đã có detail_design/):** `workflows/implement_workflow.md`

## Khi nào đọc workflow nào

| Tình huống | Workflow cần đọc | Skill gọi |
|---|---|---|
| User đưa yêu cầu mới | `pipeline_workflow.md` | `/spec-clarification` |
| Đã có basic_design, cần API contract | `pipeline_workflow.md` Phase 2 | `/api-contract-generation` |
| Đã có detail_design, cần code | `implement_workflow.md` | `/worktree new <feature>` |
| Đang fix bug cụ thể | Không cần workflow | `/worktree new fix/<bug>` |
| Kết thúc task | — | `/commit w <msg>` → `/save-session` |

## Git Workflow

- Before editing code, you must create or switch to a dedicated task branch and a dedicated worktree for that branch.
- All implementation work must happen inside that task worktree, never directly in the main checkout.
- Default flow is to work on a feature branch, not directly on `main`.
- If the current branch is `main`, create or switch to a task branch before editing code.
- Make commits on that branch with a clear message after the change is validated.
- When the task is complete, merge the branch back into `main` after verification.
- Do not rewrite or discard unrelated user changes while doing the branch work.

## Verification Baseline

- Backend change: uu tien chay test backend lien quan; neu dung schema thi kiem tra Alembic upgrade path.
- Frontend change: kiem tra loading, empty, error, success state cua luong vua sua.
- Spec/doc change: kiem tra lai traceability giua raw request, basic design, detail design va code dang ton tai.
- Khong coi task hoan tat neu acceptance criteria quan trong chua duoc verify hoac chua neu ro phan chua verify duoc.

## Runtime Context

- `.claude/README.md`
- `.claude/agents/AGENTS_STANDARD_VI.md`
