# SCREEN SPEC – LỊCH THI ĐẤU (VOVINAM)

> Dựa trên: `basic_design/tournament_schedule_update.md`
> Ngày: 2026-03-26
> File liên quan: `frontend/src/pages/MatchesPage.tsx`, `frontend/src/pages/TournamentsPage.tsx`

---

## 1. Tổng quan kiến trúc màn hình

### Phân chia trang

| Trang | Route | Nội dung |
|-------|-------|----------|
| `TournamentsPage` | `/tournaments` | Chọn hạng cân + xem **Bracket** (đối kháng) |
| `MatchesPage` | `/matches` | **Lịch thi đấu tổng hợp** — 2 sân, Quyền trước · Đối kháng sau |

> Sidebar đã có mục "Danh sách trận đấu" → `/matches`. **Không thêm tab "Lịch thi đấu" vào `TournamentsPage`.**

### Cập nhật `TournamentsPage`

`TournamentsPage` **không thay đổi layout** — giữ nguyên panel trái (chọn hạng cân) + panel phải (bracket). Chỉ cập nhật hiển thị `MatchBox` (xem mục 9).

---

## 2. Trạng thái Giải đấu (Tournament Status)

```
DRAFT → PUBLISHED → ONGOING → COMPLETED
```

| Status | Ý nghĩa | Hành động cho phép |
|--------|---------|-------------------|
| `DRAFT` | Đang chuẩn bị | Generate/Regenerate Matches, Generate/Regenerate Schedule |
| `PUBLISHED` | Đã phát hành | Chỉ xem; **không** regenerate, **không** đổi `match_code`, **không** đổi `order` |
| `ONGOING` | Đang thi đấu | Cập nhật kết quả trận |
| `COMPLETED` | Kết thúc | Chỉ xem |

---

## 3. Trạng thái Trận đấu (Match Status)

```
pending → ready → ongoing → completed
```

| Status | Label | Ý nghĩa |
|--------|-------|---------|
| `pending` | Chưa sẵn sàng | Trận chưa đủ điều kiện bắt đầu (VĐV feed-in chưa xác định) |
| `ready` | Sẵn sàng | Tất cả prerequisite matches đã `completed`; có thể bắt đầu |
| `ongoing` | Đang diễn ra | Đang thi đấu |
| `completed` | Đã kết thúc | Có kết quả |

### 3.1 Điều kiện chuyển trạng thái

| Chuyển | Điều kiện |
|--------|-----------|
| `pending → ready` | **Tất cả** match "feed vào" match này đã `completed` (tức là VĐV round sau đã xác định) |
| `ready → ongoing` | Referee bấm "Bắt đầu" **VÀ** sân tương ứng không có match nào đang `ongoing` |
| `ongoing → completed` | Referee nhập kết quả xác định người thắng |

### 3.2 Ràng buộc mỗi sân

> **Tại một thời điểm, mỗi sân chỉ được có tối đa 1 trận `ongoing`.**

- Nếu Sân A đang có match `ongoing`: các match `ready` được gán Sân A **không thể bắt đầu** cho đến khi match đó `completed`
- Nút "Bắt đầu" bị **disabled** + tooltip "Sân A đang có trận diễn ra"

### 3.3 BYE match (đặc cách)

| Thuộc tính | Giá trị |
|-----------|---------|
| `player2` | `null` (không có đối thủ) |
| `status` | `completed` **ngay từ khi tạo** |
| `winner` | VĐV được đặc cách |
| Hiển thị | Row mờ (`opacity-60`); badge `BYE` ở cột VĐV B; italic |
| Action | **Không hiển thị** nút thao tác (không Start, không nhập kết quả) |

---

## 4. Flow Generate Matches & Schedule (DRAFT)

### 4.1 Tổng quan luồng

```
[Danh sách VĐV đã đăng ký]
        │
        ▼
[Generate Matches]  ← có thể regenerate bất kỳ lúc nào (chỉ khi DRAFT)
        │
        ├─ Đối kháng: tính power-of-2 slots → full bracket structure
        │              (bao gồm cả semi/final chưa có VĐV)
        │
        └─ Quyền: mỗi VĐV = 1 slot thi đấu cá nhân
        │
        ▼
[Generate Schedule]  ← có thể regenerate bất kỳ lúc nào (chỉ khi DRAFT)
        │
        ├─ Quyền trước → xếp lịch Sân A / B luân phiên
        └─ Đối kháng sau → xếp lịch Sân A / B
        │
        ▼
[Publish Tournament] → tournamentStatus = PUBLISHED
        │
        └─ Từ đây: KHÔNG regenerate, KHÔNG đổi match_code, KHÔNG đổi order
```

### 4.2 Generate Matches — Đối kháng

1. Đếm số VĐV mỗi hạng cân
2. Tính `slots = 2^⌈log2(n)⌉` (làm tròn lên power of 2)
3. Số BYE = `slots - n`
4. Tạo **toàn bộ** cây bracket: round 1 → final
   - Mỗi match có `nextMatchId` trỏ về match cha
   - Round 1: gán VĐV (random hoặc seeding); BYE fills vị trí còn lại
   - Round 2+: `athlete_1 = null`, `athlete_2 = null` (fill khi có kết quả)
5. BYE match: set `status = completed`, `winner = VĐV được đặc cách` ngay khi tạo
6. Match round 1 (không BYE): `status = ready` (đủ điều kiện bắt đầu ngay)
7. Match round 2+: `status = pending` (chờ feed-in)

### 4.3 Generate Matches — Quyền

- Mỗi VĐV đăng ký Quyền = 1 `quyen_slot`
- `status = ready` ngay từ đầu (không có prerequisite)
- Không có `nextMatchId`

### 4.4 Generate Schedule từ Matches

Sau khi có danh sách matches:

**Bước 1 — Xếp Quyền:**
- Lấy tất cả `quyen_slot` (status ready)
- Phân bổ luân phiên: slot 1 → Sân A, slot 2 → Sân B, slot 3 → Sân A, ...
- Gán `order` tăng dần theo cặp (mỗi "khung giờ" = 2 slots chạy song song)

**Bước 2 — Xếp Đối kháng:**
- Chỉ xếp các match **đã có đủ 2 VĐV** tại thời điểm generate (round 1 + BYE)
- Round 2+ chưa có VĐV: **vẫn** thêm vào schedule với `order` được giữ chỗ (placeholder)
- Phân bổ Sân A / B luân phiên theo `match_code`

**Ràng buộc regenerate (DRAFT only):**
- Regenerate xóa toàn bộ matches + schedule cũ và tạo lại
- Match đang `ongoing` hoặc `completed` → **không cho phép** regenerate; hiển thị warning

### 4.5 UI — Nút Generate / Publish (TournamentsPage hoặc trang quản lý giải)

```
┌──────────────────────────────────────────────┐
│  Giải đấu: Vovinam 2026         [DRAFT]      │
│  ─────────────────────────────────────────   │
│  [Generate Matches]  [Generate Schedule]     │
│                                              │
│  Khi đã có matches + schedule:               │
│  [Regenerate Matches ↺]  [Regenerate Schedule ↺]  [Publish →]  │
│                                              │
│  ⚠ Regenerate sẽ xóa toàn bộ kết quả hiện tại  │
└──────────────────────────────────────────────┘
```

Khi `tournamentStatus = PUBLISHED / ONGOING / COMPLETED`:
- Ẩn tất cả nút Generate / Regenerate
- Hiển thị badge trạng thái tương ứng

---

## 5. `MatchesPage` — Lịch thi đấu tổng hợp

> Trang tại `/matches`, thay thế placeholder hiện tại.

### 5.1 Layout tổng thể

```
┌──────────────────────────────────────────────────────────────┐
│  Lịch thi đấu                                                │
│  [Quyền: 50 lượt · Đối kháng: 32 trận]                      │
│  [Đang diễn ra: 2 · Đã hoàn thành: 15 · Sẵn sàng: 4]       │
│  ────────────────────────────────────────────────────────    │
│  Filter: [Nội dung: Tất cả ▼]  [Sân: Tất cả ▼]             │
│          [Trạng thái: Tất cả ▼]                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  ■ QUYỀN                                          [Thu gọn]  │
│  ─────────────────────────────────────────────────────────   │
│  STT │ Nội dung     │ VĐV          │ Sân   │ TT             │
│   1  │ Quyền Tay    │ Nguyễn Văn A │ Sân A │ Đang thi       │
│   2  │ Quyền Tay    │ Trần Thị B   │ Sân B │ Sẵn sàng       │
│  ...                                                         │
│                                                              │
│  ■ ĐỐI KHÁNG                                      [Thu gọn]  │
│  ─────────────────────────────────────────────────────────   │
│  Mã  │ Vòng  │ VĐV A        │ VS │ VĐV B        │ Sân │ TT  │
│  A1  │ Vòng 1│ Lê Văn C     │ vs │ Phạm Văn D   │ A   │ ... │
│  A2  │ Vòng 1│ Hoàng Thị E  │ vs │ BYE          │ B   │ ... │
│  B1  │ Vòng 2│ TBD          │ vs │ TBD          │ A   │ ... │
└──────────────────────────────────────────────────────────────┘
```

> Match round 2+ chưa có VĐV hiển thị `TBD` (chờ kết quả vòng trước).

### 5.2 Summary Bar

| Badge | Nội dung | Màu |
|-------|----------|-----|
| Quyền | `{quyen_count} lượt` | tím nhạt |
| Đối kháng | `{doi_khang_count} trận` | xanh nhạt |
| Sẵn sàng | `{ready_count}` | xanh dương nhạt |
| Đang diễn ra | `{ongoing_count}` | vàng/cam |
| Đã hoàn thành | `{completed_count}` | xanh lá |

---

## 6. Filter Bar

```
[Nội dung: Tất cả ▼]   [Sân: Tất cả ▼]   [Trạng thái: Tất cả ▼]
```

**Filter Nội dung:** Tất cả / Quyền / Đối kháng

**Filter Sân:** Tất cả / Sân A / Sân B

**Filter Trạng thái:** Tất cả / Chưa sẵn sàng / Sẵn sàng / Đang diễn ra / Đã diễn ra

Filter hoạt động client-side.

---

## 7. Status Badge & Row Highlight (dùng chung Quyền + Đối kháng)

### 7.1 Status Badge

| Status | Label | Màu Badge |
|--------|-------|-----------|
| `pending` | Chưa sẵn sàng | `bg-gray-100 text-gray-500` |
| `ready` | Sẵn sàng | `bg-blue-100 text-blue-700` |
| `ongoing` | Đang diễn ra | `bg-yellow-100 text-yellow-700 animate-pulse` |
| `completed` | Đã diễn ra | `bg-green-100 text-green-700` |

### 7.2 Row Highlight

| Điều kiện | Style |
|-----------|-------|
| `ongoing` | `bg-yellow-50 border-l-4 border-yellow-400` |
| `ready` | `bg-blue-50 border-l-4 border-blue-300` |
| `completed` | `bg-gray-50` |
| `pending` | background mặc định |
| BYE match | `opacity-60` + background mặc định |

---

## 8. Bảng Quyền — `QuyenScheduleTable`

### 8.1 Cấu trúc columns

| Cột | Field | Độ rộng | Ghi chú |
|-----|-------|---------|---------|
| STT | `order` | 60px | Số thứ tự lượt thi |
| Nội dung | `content_name` | 140px | Tên bài quyền |
| Hạng cân | `weight_class` | 100px | |
| Vận động viên | `player_name` | flex | Màu xanh dương |
| CLB | `club_name` | 120px | |
| Sân | `court` | 60px | Badge `Sân A` / `Sân B` |
| Trạng thái | `status` | 120px | Badge (xem mục 7.1) |
| Thao tác | — | 100px | referee only |

### 8.2 Cột Thao tác (referee only — Quyền)

| Status | Nút | Điều kiện disabled |
|--------|-----|--------------------|
| `ready` | `[Bắt đầu]` outline xanh | Sân đang có match `ongoing` |
| `ongoing` | `[Hoàn thành]` solid xanh | — |
| `completed` | `[Xem]` outline xám | — |
| `pending` | — | không hiển thị |

---

## 9. Bảng Đối kháng — `MatchScheduleTable`

### 9.1 Cấu trúc columns

| Cột | Field | Độ rộng | Ghi chú |
|-----|-------|---------|---------|
| Mã trận | `match_code` | 80px | Font mono, badge xám nhạt |
| Vòng | `round_label` | 100px | |
| Hạng cân | `weight_class` | 100px | |
| VĐV A | `player1_name` | flex | Xanh dương; `TBD` nếu null |
| VS | — | 40px | |
| VĐV B | `player2_name` | flex | Đỏ; `TBD` hoặc badge `BYE` nếu null |
| Kết quả | `score1 - score2` | 80px | Chỉ hiện khi `completed` |
| Sân | `court` | 60px | Badge `Sân A` / `Sân B` |
| Trạng thái | `status` | 120px | Badge (xem mục 7.1) |
| Thao tác | — | 100px | referee only |

### 9.2 Cột Thao tác (referee only — Đối kháng)

| Status | Nút | Điều kiện disabled |
|--------|-----|--------------------|
| `ready` | `[Bắt đầu]` outline xanh | Sân đang có match `ongoing` → disabled + tooltip |
| `ongoing` | `[Nhập kết quả]` solid xanh | — |
| `completed` | `[Xem kết quả]` outline xám | — |
| `pending` | — | không hiển thị |

Viewer: cột thao tác chỉ có `[Chi tiết]` (chỉ khi `completed`).

### 9.3 BYE rows

- `player2`: badge `BYE` xám nhạt, italic
- `status = completed` ngay từ đầu
- Không có action button
- Row `opacity-60`

### 9.4 TBD rows (match chờ kết quả vòng trước)

- `player1` và/hoặc `player2` hiển thị `TBD` — màu xám, italic
- `status = pending`
- Không có action button
- Tooltip: "Chờ kết quả trận {prevMatchCode}"

---

## 10. Modal thao tác trận đấu

### 10.1 Modal "Bắt đầu" (referee, `ready → ongoing`)

```
┌────────────────────────────────────────┐
│  Trận A1 — Vòng 1               [X]   │
│  ────────────────────────────────────  │
│   Nguyễn Văn A      VS    Trần Văn B  │
│                                        │
│   Xác nhận bắt đầu trận đấu này?      │
│                                        │
│              [Hủy]  [Bắt đầu →]       │
└────────────────────────────────────────┘
```

- Gọi `PATCH /matches/{id}/status` với `{ status: "ongoing" }`
- Backend kiểm tra: sân không có match `ongoing` khác
- Sau thành công: đóng modal, invalidate `["schedule"]` + `["bracket", wc_id]`

### 10.2 Modal "Nhập kết quả" (referee, `ongoing → completed` — Đối kháng)

```
┌────────────────────────────────────────┐
│  Trận A1 — Vòng 1               [X]   │
│  🟡 Đang diễn ra                      │
│  ────────────────────────────────────  │
│   Nguyễn Văn A          Trần Văn B    │
│   [xanh]                 [đỏ]          │
│                                        │
│   Điểm:   [____]   -   [____]         │
│                                        │
│   Người thắng:                        │
│   ( ) Nguyễn Văn A                    │
│   ( ) Trần Văn B                      │
│                                        │
│              [Hủy]  [Lưu kết quả]     │
└────────────────────────────────────────┘
```

Validation:
- Điểm: số nguyên ≥ 0, không bắt buộc
- Người thắng: **bắt buộc** — button disabled cho đến khi chọn
- Sau submit: `POST /matches/{id}/result`
  - Backend tự động: fill `athlete` vào `nextMatch`, chuyển `nextMatch.status = ready` nếu đủ điều kiện
  - Invalidate `["schedule"]` + `["bracket", wc_id]`

### 10.3 Modal "Xem kết quả" (completed — Đối kháng)

```
┌────────────────────────────────────────┐
│  Trận A1 — Vòng 1               [X]   │
│   Nguyễn Văn A    3 - 1   Trần Văn B  │
│   🏆 Người thắng: Nguyễn Văn A        │
│   Trận tiếp theo: B1                  │
│                         [Đóng]        │
└────────────────────────────────────────┘
```

### 10.4 Modal "Hoàn thành" (referee, `ongoing → completed` — Quyền)

Đơn giản hơn: không có điểm số 1v1, chỉ xác nhận hoàn thành lượt thi.

```
┌────────────────────────────────────────┐
│  Lượt thi #5                    [X]   │
│  🟡 Đang diễn ra                      │
│  ────────────────────────────────────  │
│   Nguyễn Văn A — Quyền Tay Không      │
│                                        │
│   Xác nhận hoàn thành lượt thi này?   │
│              [Hủy]  [Hoàn thành ✓]    │
└────────────────────────────────────────┘
```

---

## 11. Đồng bộ Schedule ↔ Bracket

Sau mỗi thao tác kết quả Đối kháng:
- Backend tự cập nhật `nextMatch.athlete` + `nextMatch.status = ready` (nếu cả 2 feed-in đã `completed`)
- Frontend invalidate:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ["schedule"] })
  queryClient.invalidateQueries({ queryKey: ["bracket", weightClassId] })
  ```

**React Query keys:**
```typescript
queryKey: ["schedule"]               // MatchesPage
queryKey: ["bracket", weightClassId] // TournamentsPage bracket
```

---

## 12. Cập nhật `TournamentsPage` — Bracket View

Giữ nguyên layout. Chỉ cập nhật `MatchBox`:

### 12.1 Badge `match_code` + Status highlight

```
┌─────────────────────┐
│ A1   [ready]    🔵  │
│ Nguyễn Văn A        │
│ Trần Văn B      🔴  │
└─────────────────────┘
```

| Status | Node style |
|--------|-----------|
| `pending` | `border-gray-200 bg-white opacity-70` |
| `ready` | `border-blue-400 bg-blue-50` |
| `ongoing` | `border-yellow-400 bg-yellow-50 shadow-md` |
| `completed` | `border-gray-300 bg-gray-50` |

### 12.2 Người thắng (completed)

- Row người thắng: `bg-green-50 font-semibold text-green-800`
- Icon `✓` bên phải tên

### 12.3 TBD trong node

- `athlete = null` → hiển thị `TBD` màu xám, italic — `text-gray-400 italic text-xs`

---

## 13. Trạng thái loading / error / empty

| Trạng thái | Hiển thị |
|-----------|---------|
| Loading | Skeleton loader 5 rows mỗi section |
| Error | Alert đỏ + nút retry |
| Chưa có matches | "Chưa generate lịch thi đấu" + (nếu admin/referee) nút Generate |
| Không khớp filter | "Không có mục nào phù hợp bộ lọc." |

---

## 14. Responsive

- **Desktop (≥1024px):** Bảng đầy đủ cột
- **Tablet (768–1023px):** Ẩn cột "Vòng" và "CLB"
- **Mobile (<768px):** Chuyển sang card list

---

## 15. Tóm tắt components & API cần tạo/cập nhật

### Components

| # | Component | File | Loại |
|---|-----------|------|------|
| 1 | `QuyenScheduleTable` | `components/tournament/QuyenScheduleTable.tsx` | Mới |
| 2 | `MatchScheduleTable` | `components/tournament/MatchScheduleTable.tsx` | Mới |
| 3 | `MatchActionModal` | `components/tournament/MatchActionModal.tsx` | Mới |
| 4 | `MatchBox` (cập nhật) | `TournamentsPage.tsx` | Cập nhật |
| 5 | `MatchesPage` | `pages/MatchesPage.tsx` | Cập nhật |
| 6 | `useSchedule` hook | `hooks/useSchedule.ts` | Mới |

### API endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/tournaments/{id}/generate-matches` | Generate toàn bộ matches (DRAFT only) |
| `POST` | `/tournaments/{id}/generate-schedule` | Generate schedule từ matches (DRAFT only) |
| `GET` | `/tournaments/{id}/schedule` | Lấy lịch tổng hợp (Quyền + Đối kháng) |
| `PATCH` | `/matches/{id}/status` | Chuyển `ready → ongoing` |
| `POST` | `/matches/{id}/result` | Nhập kết quả (`ongoing → completed`) |
| `PATCH` | `/tournaments/{id}/publish` | Publish giải (DRAFT → PUBLISHED) |

