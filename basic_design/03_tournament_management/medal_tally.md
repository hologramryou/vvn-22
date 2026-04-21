# Medal Tally — Bảng tổng sắp huy chương

## Feature
03_tournament_management

## Description
Thống kê và xếp hạng huy chương theo đơn vị (tỉnh / CLB). Hiển thị tổng số HCV, HCB, HCĐ. Cập nhật sau mỗi trận chung kết kết thúc.

**URL:** `/medals` hoặc `/tournaments/:id/medals`

## Actors
- Tất cả roles (readonly)

## Components

### 1. Header
- Tên giải đấu + trạng thái
- Tổng: X huy chương đã trao / Y nội dung đã kết thúc
- Toggle: Xem theo CLB / theo Tỉnh thành

### 2. Bảng tổng sắp

Columns: `#` | `Đơn vị` | `🥇 HCV` | `🥈 HCB` | `🥉 HCĐ` | `Tổng`

Sắp xếp mặc định: HCV giảm dần → HCB giảm dần → HCĐ giảm dần → Tên đơn vị tăng dần

```
# | Đơn vị        | 🥇 | 🥈 | 🥉 | Tổng
1 | TP. Hồ Chí Minh|  5 |  3 |  2 |  10
2 | Hà Nội         |  3 |  2 |  4 |   9
3 | Đà Nẵng        |  2 |  1 |  3 |   6
```

### 3. Chi tiết đơn vị (expand row)
Click vào đơn vị → expand danh sách VĐV + nội dung giành huy chương:
```
  Đơn luyện Nam (HCV) — Nguyễn Văn A
  Đối kháng 57kg Nam (HCB) — Trần Văn B
  Song luyện Nữ (HCĐ) — Lê Thị C
```

### 4. Biểu đồ (optional, giai đoạn sau)
Bar chart top 5 đơn vị theo tổng huy chương.

## Data Source
- API: `list_api/medal_tally_get.md`

## Actions

- Toggle CLB / Tỉnh thành
  → Re-fetch với `group_by` param
- Click tên đơn vị
  → Expand inline detail
- Click tên VĐV
  → Navigate: `/students/:id`

## States
- `loading` — Skeleton table rows
- `empty` — "Chưa có huy chương nào được trao"
- `active` — Hiển thị bảng xếp hạng
- `error` — Toast lỗi

## Navigation
- `/students/:id` — Hồ sơ VĐV
- `/tournaments/:id` — Chi tiết giải đấu
