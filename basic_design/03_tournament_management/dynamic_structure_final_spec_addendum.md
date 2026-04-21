# Addendum: Dynamic Structure Final Spec

**Date:** 2026-04-07  
**Status:** Final Clarifications  
**Applies to:** `dynamic_structure_final_spec.md`

## 1. Root nodes level 0

Level 0 phai ho tro **nhieu root nodes**, khong duoc hard-code gioi han 2 node dau tien.

Quy tac:

- System cho phep tao nhieu node voi `parent_id = null`.
- `sort_order` cua root nodes van phai lien tuc.
- UI tree builder phai co kha nang them nhieu root nodes ro rang.
- Khong duoc viet logic FE/BE kieu "da co 2 root thi khoa tao".

Ghi chu:

- Source backend hien tai `create_node(parent_id = null)` da cho phep tao nhieu root.
- Van de can chot la spec va UI, khong phai engine CRUD co hard limit.

## 2. Hien thi noi dung thi dau

Phan hien thi noi dung thi dau phai tach ro 2 loai:

- `sparring`: hien thi theo **hang can / node_path**
- `kata`: hien thi theo **ten bai quyen**

Quyen la setting chung cua giai dau, nhung khi hien thi tren athlete, schedule, result thi van phai hien **ten bai quyen cu the**.

Quy uoc response:

- Neu `contest_type = "sparring"`:
  - `content_display = node_path`
  - vi du: `Nam > Phong Trao > Loai 4 > 54 kg`
- Neu `contest_type = "kata"`:
  - `content_display = kata_name`
  - vi du: `Ngu mon quyen`

Khong dung 1 field generic mo ho de hien thi ca hai loai content.

## 3. Tournament-wide kata setting

Chot lai:

- Kata la **tournament-level catalog**
- Kata **khong gan vao node**
- Athlete chon 1 leaf node de xep khung thi dau
- Athlete chon them:
  - `sparring` neu thi doi khang
  - 1 hoac nhieu `kata_id` neu thi quyen

He qua:

- Tree dung de phan khung / phan bang thi dau
- Kata dung de cau hinh noi dung quyen chung cua tournament
- Schedule quyen doc tu `StudentContestSelection(type = "kata")`, khong doc tu node

## 4. Account migration theo giai dau

Ngoai du lieu athlete, account non-admin cung phai duoc gan ngu canh tournament.

Nguyen tac:

- `admin` la account cap he thong, **khong migrate theo giai**
- Tat ca account con lai phai co mapping theo tournament:
  - `club`
  - `referee`
  - `viewer`
  - cac role van hanh khac neu co

Thiet ke de xuat:

```sql
CREATE TABLE tournament_user_memberships (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL,
  club_id INTEGER NULL REFERENCES clubs(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tournament_id, user_id)
);
```

Authorization rule:

1. Neu user la `admin`:
   - bypass membership check
2. Neu user khong phai `admin`:
   - bat buoc co membership active cua tournament do
   - quyen thao tac lay tu membership cua tournament

Khong dung thuần `users.role` va `users.club_id` lam source of truth cho tournament dynamic.

## 5. Acceptance criteria bo sung

- Level 0 tao duoc nhieu root nodes; UI/BE khong hard-limit 2 node dau tien.
- Schedule/registration hien thi dung content:
  - sparring ra hang can
  - kata ra ten bai quyen
- Non-admin account chi truy cap duoc tournament khi co membership cua giai do.
- Admin duoc truy cap xuyen giai ma khong can membership.
