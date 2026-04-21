# vovinam_fighting - Spec Pipeline va Ung dung Cham diem Vovinam

Du an gom 4 lop:

1. Agent pipeline de chuyen yeu cau mo thanh tai lieu co cau truc
2. Ung dung web Vovinam gom `backend/` va `frontend/`
3. Structured Notes trong `.claude/notes/`
4. Human Docs trong `.claude/human-docs/`

## Cau truc thu muc

```text
vovinam_fighting/
|-- raw_request/                  # Yeu cau tho tu nguoi dung
|-- basic_design/                 # Basic Design cho nguoi doc
|-- detail_design/                # Detail Design Markdown cho AI
|-- backend/                      # FastAPI
|-- frontend/                     # React + TypeScript
|-- docs/                         # Phan tich, prototype, tai lieu tham khao
|-- scripts/                      # Script ho tro repo, pipeline, research
|-- .claude/
|   |-- agents/
|   |-- skills/
|   |-- notes/
|   `-- human-docs/
|-- templates/                    # Template Basic Design + Detail Design
|-- workflows/                    # Tai lieu quy trinh
`-- README.md
```

## Quy uoc spec

- `raw_request/` = raw request
- `basic_design/` = Basic Design
- `detail_design/` = Detail Design Markdown

Quy uoc nay la source of truth moi cho feature moi.

Naming convention file-level duoc chot tai:

- `workflows/spec_naming_convention.md`

## Agent pipeline

```text
raw_request/*.md
    |
    v
clarifier -> lam ro yeu cau
    |
    v
writer -> cap nhat basic_design/ + detail_design/
    |
    v
implementer -> viet code trong backend/ + frontend/
```

| Step | Dau vao | Dau ra |
|------|---------|--------|
| Clarify | `raw_request/*.md` | clarification artifact + Basic Design draft |
| Basic design | raw request + answers | `basic_design/*.md` |
| Detail design | basic design | `detail_design/*.md` |
| Implement | detail design | code + test |

## Structured Notes

Memory layer cho AI va team nam o:

- `.claude/notes/CURRENT_SESSION.md`
- `.claude/notes/DECISIONS.md`
- `.claude/notes/LEARNINGS.md`
- `.claude/notes/TROUBLESHOOTING.md`
- `.claude/notes/adr/`

## Human Docs

Tai lieu cho nguoi doc nam o:

- `.claude/human-docs/README_PIPELINE_VI.md`
- `.claude/human-docs/HOW_TO_USE_EFFICIENTLY.md`
- `.claude/human-docs/INTEGRATION_ARCHITECTURE.md`

## Scripts va Docs

- `scripts/spec_pipeline/`: script scaffold workflow spec moi
- `scripts/research/`: script nghien cuu, thu nghiem thuat toan
- `backend/scripts/debug/`: script debug thu cong cho backend
- `docs/analysis/`: tai lieu phan tich, issue analysis, notes nghiep vu
- `docs/prototypes/`: file prototype/debug khong thuoc runtime app

## Khoi dong ung dung

Yeu cau: Docker Desktop dang chay.

Port mapping hien tai:

| Service | Host | Container |
|---------|------|-----------|
| Frontend | `5174` | `5173` |
| Backend | `8001` | `8000` |
| PostgreSQL | `5433` | `5432` |
| Redis | `6380` | `6379` |

Khoi dong:

```bash
docker compose up -d
docker compose up -d --build
```

Seed du lieu:

```bash
docker compose exec api alembic upgrade head
docker compose exec api python -m app.seed
```

## Luu y

- `detail_design/` da chot dinh dang Markdown cho feature moi.
- Cac file YAML cu con lai trong repo la artifact legacy, khong nen dung de mo rong them feature moi.
- Root repo chi giu entrypoint va config chinh. Tooling, phan tich, prototype da duoc tach ra `scripts/` va `docs/`.
