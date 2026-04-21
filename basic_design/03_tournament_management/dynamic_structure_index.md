# Dynamic Structure Index

Date: 2026-04-09
Status: active

## Read this first

For dynamic tournament work, use these files in order:

1. `dynamic_structure_final_spec.md`
2. `dynamic_structure_final_spec_addendum.md`
3. `../list_api/dynamic_structure_apis.md`

## Runtime source

- `backend/app/routers/tournament_structure.py`
- `backend/app/repositories/structure_repo.py`
- `backend/app/repositories/student_repo.py`
- `backend/app/repositories/tournament_repo.py`

## Historical docs only

These are not source of truth anymore:

- `dynamic_structure_overview.md`
- `bracket_generation_refactor.md`
- `../../raw_request/dynamic_tournament.md`
- `../../raw_request/dynamic_tournament_structure.md`
- `../../raw_request/dynamic_tournament_fix_spec.md`
- `../../detail_design/legacy_yaml/dynamic_structure_api_spec.yaml`

## Cleanup rule

- Do not extend historical docs for new behavior.
- Put clarifications into final spec or addendum.
- Update runtime code and API contract after spec changes.
