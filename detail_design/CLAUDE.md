# Detail Design CLAUDE.md

## Mục Tiêu

`detail_design/` dùng cho AI implement và review kỹ thuật.

## Bắt Buộc Có

- reference tới Basic Design
- traceability từ `BR-*` và `EVT-*`
- danh sách API đầy đủ
- request / response / validation
- processing flow
- screen mapping
- database effects
- event processing detail
- acceptance criteria kỹ thuật

## Bắt Buộc Mapping

- API -> Screen
- API -> Database
- Screen -> Database
- Event -> API sequence

## Không Dùng

- Không dùng file trong `detail_design/legacy_yaml/` để mở rộng feature mới.
- Không viết Detail Design mới bằng YAML.

## Naming

- file đặt theo `detail_design/<module>/<feature_name>.md`
- implementation note đặt theo `detail_design/implement/<feature_name>_implement.md`
