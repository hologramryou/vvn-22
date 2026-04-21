# Naming Convention - Basic Design va Detail Design

## Muc tieu

Thong nhat naming convention o cap file de:

- de tim kiem
- de trace tu raw request -> basic design -> detail design
- de agent va script scaffold khong tao sai vi tri

## Folder-level

- `raw_request/`
- `basic_design/`
- `detail_design/`

## Module-level

Mau folder:

- `01_student_management`
- `02_club_management`
- `03_tournament_management`

Rule:

- prefix 2 chu so
- sau do la ten module snake_case

## Feature-level

### Raw request

`raw_request/<feature_name>.md`

Vi du:

- `raw_request/dynamic_tournament_structure.md`
- `raw_request/export_card.md`

### Clarification artifact

`basic_design/_clarification/<feature_code>.md`

Vi du:

- `basic_design/_clarification/TM_DYNAMIC_STRUCTURE.md`
- `basic_design/_clarification/STUDENT_EXPORT_CARD.md`

### Basic Design

`basic_design/<module>/<feature_name>.md`

Vi du:

- `basic_design/03_tournament_management/dynamic_structure_final_spec.md`
- `basic_design/01_student_management/export_card.md`

### Detail Design

`detail_design/<module>/<feature_name>.md`

Vi du:

- `detail_design/legacy_yaml/dynamic_structure_api_spec.yaml`  # legacy example only, not source of truth
- `detail_design/01_student_management/export_card.md`

## Rule dat ten

### feature_name

- dung `snake_case`
- uu tien ten theo capability, khong theo task tam thoi
- khong them version vao ten file
- khong dung prefix `spec_`

### feature_code

- dung `UPPER_SNAKE_CASE`
- uu tien co namespace module

Vi du:

- `TM_DYNAMIC_STRUCTURE`
- `STUDENT_EXPORT_CARD`
- `SPARRING_SCORE_PANEL`

## Rule su dung

1. Moi feature moi bat buoc co 1 file trong `raw_request/`.
2. Moi feature moi bat buoc co 1 file Basic Design va 1 file Detail Design cung `feature_name`.
3. Clarification artifact dung `feature_code`, khong dung `feature_name`.
4. Khong tao `human_spec.md`, `agent_spec.yaml` cho feature moi.
5. Neu can file implement note:
   - `detail_design/implement/<feature_name>_implement.md`

## Khuyen nghi

- 1 feature = 1 Basic Design file
- 1 feature = 1 Detail Design file
- ben trong file co the chia nhieu cum tinh nang, nhieu screen, nhieu API
