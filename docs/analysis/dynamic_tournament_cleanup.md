# Dynamic Tournament Cleanup

Date: 2026-04-09
Status: active cleanup note

## Source of truth

Dynamic tournament should now be read in this order:

1. `basic_design/03_tournament_management/dynamic_structure_final_spec.md`
2. `basic_design/03_tournament_management/dynamic_structure_final_spec_addendum.md`
3. `basic_design/list_api/dynamic_structure_apis.md`
4. Runtime source:
   - `backend/app/routers/tournament_structure.py`
   - `backend/app/repositories/structure_repo.py`
   - `backend/app/repositories/student_repo.py`
   - `backend/app/repositories/tournament_repo.py`

## Files still present but not source of truth

These files should be treated as legacy, transitional, or historical context only:

- `raw_request/dynamic_tournament.md`
- `raw_request/dynamic_tournament_structure.md`
- `raw_request/dynamic_tournament_fix_spec.md`
- `basic_design/03_tournament_management/dynamic_structure_overview.md`
- `detail_design/legacy_yaml/dynamic_structure_api_spec.yaml`
- `basic_design/03_tournament_management/bracket_generation_refactor.md`

## Why this cleanup is needed

The repo currently mixes:

- raw request input
- transitional design docs
- finalized design docs
- legacy YAML contracts
- runtime behavior

That causes repeated drift around:

- dynamic vs legacy source of truth
- whether kata is node-bound or tournament-bound
- whether labels are parsed as domain meaning
- atomic vs best-effort registration flow
- old field names such as `weight_class_node_id`

## Cleanup rule

When updating dynamic tournament behavior:

- update final spec first
- update runtime code second
- update API contract doc third
- do not extend raw_request or legacy YAML unless preserving history

## Follow-up cleanup candidates

- move raw dynamic request docs into an explicit `archive/` subtree once no tooling depends on current paths
- move `detail_design/legacy_yaml/dynamic_structure_api_spec.yaml` into a more explicit deprecated location
- split tournament docs into `legacy` and `dynamic` sections in module index
- remove stale references to `dynamic_structure_overview.md` from related specs
