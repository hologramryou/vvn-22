# Team Kata Registration Scoped By Tree Path

## Business Rule

- Dang ky `quyen dong doi` khong duoc scope theo rieng `kata_id`.
- Moi dang ky phai gan voi mot `tree_path` cu the trong tournament structure.
- Scope dung cua mot dang ky la:
  - `tournament_id`
  - `club_id`
  - `node_id` (tree path duoc chon)
  - `kata_id`

## Example

- `Nhom Nam > 12-14 tuoi > Dong doi 1`
- `Nhom Nam > 15-17 tuoi > Dong doi 1`

Hai dang ky tren dung cung `kata.name = "Dong doi 1"` nhung la hai nhom thi khac nhau. Neu he thong chi luu theo `kata_id` thi se tron sai grouping khi xep cap/tran.

## UX Rule

- Khi admin hoac club dang ky quyen dong doi, UI phai cho chon theo tung `tree_path`.
- Danh sach tree path phai di theo thu tu cua cay (`sort_order`), khong sort chu cai.
- Ben trong moi tree path, bai quyen dong doi van di theo `kata.sort_order`.

## Data Migration Rule

- Du lieu dang ky quyen dong doi cu khong co `node_id` la du lieu khong map lossless.
- Migration 022 xoa du lieu cu trong `tournament_team_kata_registrations` truoc khi bat buoc `node_id`.

## API Rule

- API team kata registration dung payload:
  - `items[{ node_id, kata_id }]`
- Response tra ve tung registration kem:
  - `node_id`
  - `node_path`
  - `kata_id`
  - `kata_name`
