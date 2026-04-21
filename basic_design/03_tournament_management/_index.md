# Module: Quản lý Giải đấu (Tournament Management)

**Version:** 1.0
**Last Updated:** 2026-03-29
**Status:** ✅ Partially Implemented

---

## 📌 Tổng quan

Module **Quản lý Giải đấu** quản lý toàn bộ vòng đời của một giải đấu Vovinam, từ tạo to hoàn thành, bao gồm:

1. **Cấu trúc giải** — Danh sách hạng cân (weight classes) phân loại theo giới tính/loại hình
2. **Đăng ký võ sinh** — Thêm/xoá vs sinh tham gia
3. **Bốc thăm & sinh bracket** — Tạo sơ đồ thi đấu (single elimination)
4. **Lập lịch thi đấu** — Assign court (A/B) + thứ tự (order)
5. **Thực thi & chấm điểm** — Bắt đầu trận, nhập điểm, xác định tay áo
6. **Xem kết quả** — Medal tally, bracket visualization, schedule
7. **Quyền (Hội diễn)** — Slot xen kẽ trong schedule

---

## 🏆 Trạng thái Giải đấu (Tournament States)

```
[DRAFT]
  ↓ (Add students, Generate bracket/schedule)
[PUBLISHED]
  ↓ (Start matches)
[ONGOING]
  ↓ (All matches completed)
[COMPLETED]
  ↓ (View medals + final results)
```

| Trạng thái | Quyền hạn |  Ghi chú |
|-----------|----------|---------|
| **DRAFT** | Admin: Sinh bracket, lập lịch, publish | Có thể reset & tái sinh |
| **PUBLISHED** | Không được sửa bracket/schedule | Khóa cấu trúc, bắt đầu thi |
| **ONGOING** | Admin/Referee: Nhập điểm, start match | Đang thi đấu, realtime |
| **COMPLETED** | Xem huy chương, kết quả | Read-only, lưu trữ |

---

## 👥 Đối tượng sử dụng

| Vai trò | Quyền (Tournament) | Ghi chú |
|---------|------------------|--------|
| **Admin** | CRUD giải, sinh bracket, publish, start match, nhập điểm | Toàn quyền |
| **Referee** | Xem schedule, nhập điểm trong match | Chấm điểm realtime |
| **Viewer** | Xem bracket, schedule, kết quả, medal | Read-only |
| **Club** | Xem bracket, schedule + results | Read-only |

---

## 📊 Khái niệm chính

### Weight Class (Hạng cân phân loại)

Một kombinasi của 4 chiều:
- **Danh mục (Category):** Phong Trào (PT) | Phổ Thông (PH)
- **Nhóm tuổi (Age Type):** 
  - PT: `1A, 1B, 2, 3, 4, 5` (6 loại), `5=Quyền (hội diễn)`)
  - PH: `1, 2, 3, 4` (4 loại)
- **Giới tính:** Nam (M) | Nữ (F)
- **Hạng cân:** 45kg, 48kg, 51kg, ... (20+ hạng)

**Ví dụ:** `PT_1A_Nam_65kg` = Phong Trào, Loại 1A, Nam, 65kg

### Bracket

- **Type:** Single elimination (loại bỏ 1 trận)
- **Slots:** `2^ceil(log2(n))` (vd: 7 VĐV → 8 slots)
- **Rounds:** Quyền các vòng từ R1 → SF → F (chung kết)
- **BYE:** Tự động xử lý, cho VĐV thẳng tiến

### Match States

```
pending → ready → ongoing → completed
```

- **pending:** 0 hoặc 1 VĐV assigned
- **ready:** Đủ 2 VĐV (1 vsủa BYE)
- **ongoing:** Admin start, đang chấm điểm
- **completed:** Kết quả có winner, tự động advance

### Court Assignment

2 sân: **Court A** (order 0, 2, 4, ...) | **Court B** (order 1, 3, 5, ...)

Toàn bộ schedule (Quyền + Bracket matches) xếp tuần tự theo order.

### Quyền Slot (Hội diễn)

- Xuất hiện khi VĐV đăng ký `age_type_code='5'`
- Xen kẽ trong schedule với bracket matches
- Có player_name + content_name (bài quyền)
- States: ready → ongoing → completed

---

## 🎯 Luồng Workflow chính

### Phase 1: Setup (Admin)
```
1. Tournament ở DRAFT
2. Admin xem danh sách weight classes
3. Xem danh sách VĐV đã đăng ký (auto-register khi tạo student)
4. Có thể thêm/xoá VĐV trong weight class
```

### Phase 2: Generate (Admin only)
```
1. POST /tournaments/{id}/generate-matches
   → Sinh bracket (đối kháng only, bỏ qua quyền-5)
   → Tạo BracketMatch records

2. POST /tournaments/{id}/generate-schedule
   → Tạo QuyenSlot records (từ VĐV age_type=5)
   → Assign court & order cho tất cả matches + slots
   → Global sequencing
```

### Phase 3: Publish (Admin only)
```
1. PATCH /tournaments/{id}/publish
2. Trạng thái: DRAFT → PUBLISHED
3. Khóa cấu trúc (không được sinh lại)
```

### Phase 4: Execute (Admin + Referee)
```
1. Xem schedule (GET /tournaments/{id}/schedule)
2. PATCH /matches/{id}/start (admin only)
   → Check court không bận
   → Status: ready → ongoing
   → Timer bắt đầu (2×180s)

3. PATCH /matches/{id}/result (admin + referee)
   → Nhập score1/score2
   → Chọn winner (hand: 1 hay 2)
   → Auto-advance winner →next match

4. PATCH /quyen-slots/{id}/start (admin)
5. PATCH /quyen-slots/{id}/complete (admin)
```

### Phase 5: Complete (View)
```
1. Tất cả match = completed
2. GET /tournaments/{id}/medals
   → Medal tally per weight class
3. Xem bracket visualization
```

---

## 📋 Các màn hình trong module

| URL | Màn hình | Mục đích |
|-----|----------|---------|
| `/tournaments` | **TournamentsPage** | Xem giải, bốc thăm, lập lịch, publish |
| `/matches` | **MatchesPage** | Xem schedule realtime, bắt đầu trận, xem quyền |
| `/scoring` | **ScoringPage** | Nhập điểm detailed (timer, video, annotation) |
| `/medals` | **MedalsPage** | Bảng huy chương (Gold/Silver/Bronze) |
| `/display` | **DisplayPage** | Màn hình công cộng (TBD) |

---

## 🔐 Phân quyền (Permission Matrix)

| Chức năng | Admin | Referee | Viewer | Club |
|-----------|:-----:|:-------:|:------:|:----:|
| Xem giải/bracket/schedule | ✅ | ✅ | ✅ | ✅ |
| Sinh bracket/schedule | ✅ | ❌ | ❌ | ❌ |
| Publish giải | ✅ | ❌ | ❌ | ❌ |
| Bắt đầu trận (Start) | ✅ | ❌ | ❌ | ❌ |
| Nhập điểm (Score), chọn tay áo | ✅ | ✅* | ❌ | ❌ |
| Reset/Redo (Admin override) | ✅ | ❌ | ❌ | ❌ |

> `*` — Referee có thể nhập điểm nhưng không thể reset

---

## 📚 Danh sách file spec

| File | Mô tả |
|------|-------|
| **_index.md** | Tài liệu này — Overview module |
| **tournament_structure.md** | Danh sách giải, weight classes, VĐV đăng ký |
| **bracket_generation.md** | Bốc thăm & sinh bracket (logic + UI) |
| **match_execution.md** | Thực thi trận, nhập điểm, schedule |
| **api_reference.md** | API endpoints & request/response |

---

## ⚡ Tính năng nổi bật

✅ **Multi-dimensional Weight Classification**
- 4 chiều (category, age_type, gender, weight)
- ~100+ unique weight class combinations

✅ **Automatic Bracket Generation**
- Single elimination, auto BYE
- Không cần drag-drop setup

✅ **Court Assignment & Scheduling**
- Auto alternate A/B
- Global sequencing (Quyền + Matches)

✅ **Real-time Match Execution**
- Live timer (2×180s per round)
- Instant winner propagation

✅ **Quyền Integration**
- Xen kẽ schedule
- Separate start/complete workflow

✅ **Medal Tally**
- Auto-calculate per weight class
- Gold/Silver/Bronze from bracket results

---

## 🔗 Xem thêm

- [Tournament Structure](./tournament_structure.md) — Danh sách giải & hạng cân
- [Bracket Generation](./bracket_generation.md) — Sinh bracket logic
- [Match Execution](./match_execution.md) — Chạy trận & lịch thi
- [API Reference](./api_reference.md) — API endpoints chi tiết
