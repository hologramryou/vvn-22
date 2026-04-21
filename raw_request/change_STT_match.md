**Yêu cầu:** Implement tính năng kéo thả (drag & drop) để admin có thể:
1. **Đổi vị trí trận đấu** (reorder schedule): Kéo thả để thay đổi thứ tự trận đấu trong lịch thi đấu (schedule_order).
2. **Đổi sân** (change court): Thay đổi sân từ A sang B hoặc ngược lại cho từng trận đấu.

**Ràng buộc:**
- Chỉ admin mới được phép chỉnh sửa schedule.
- Không cho phép chỉnh sửa khi tournament status = "ONGOING" hoặc "COMPLETED".
- Schedule hiện tại được generate tự động, cần thêm khả năng manual edit.
- UI hiện tại hiển thị schedule trong bảng (MatchesPage.tsx), cần thêm drag functionality ở đó.

**Cấu trúc codebase hiện tại:**

Backend:
- Models: BracketMatch và QuyenSlot có fields schedule_order (int) và court ('A' | 'B').
- Routers: tournaments.py có endpoints generate-schedule và get-schedule.
- Schemas: tournament.py định nghĩa TournamentScheduleOut, ScheduleBracketMatchOut.

Frontend:
- Pages: MatchesPage.tsx hiển thị schedule dưới dạng bảng.
- API: tournaments.ts có getSchedule, generateSchedule.
- Types: tournament.ts định nghĩa interfaces cho ScheduleBracketMatch.

**Các bước implement cần thực hiện:**

1. **Backend:**
   - Thêm schema UpdateScheduleIn và UpdateScheduleOut trong schemas/tournament.py.
   - Thêm endpoint PATCH /tournaments/{tournament_id}/update-schedule trong routers/tournaments.py.
   - Thêm function update_match_schedule trong repositories/tournament_repo.py để update schedule_order và court.
   - Validate quyền admin và tournament status.

2. **Frontend:**
   - Cài đặt thư viện @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
   - Thêm API call updateSchedule trong api/tournaments.ts.
   - Trong MatchesPage.tsx:
     - Wrap bảng matches với DndContext và SortableContext.
     - Tạo component SortableMatchRow với useSortable hook.
     - Implement handleDragEnd để reorder và update schedule_order.
     - Thêm dropdown/select để change court cho từng match.
   - Sử dụng TanStack Query để invalidate và refetch schedule sau update.

**Yêu cầu output:**
- Cung cấp code đầy đủ cho tất cả files cần chỉnh sửa (không chỉ snippets).
- Giải thích logic từng bước.
- Đảm bảo code tương thích với codebase hiện tại (TypeScript strict, async/await, etc.).
- Thêm validation và error handling.
- Khi đã Phát hành giải đấu thì vẫn có thể chỉnh sửa đc vị trí số trận thì vẫn giữ nguyên
- Test cases cơ bản nếu có thể.

**Files cần chỉnh sửa/chú ý:**
- backend/app/schemas/tournament.py
- backend/app/routers/tournaments.py  
- backend/app/repositories/tournament_repo.py
- frontend/src/api/tournaments.ts
- frontend/src/pages/MatchesPage.tsx
- frontend/package.json (thêm dependencies)

Hãy implement từng bước một cách chi tiết và đảm bảo tính năng hoạt động đúng.