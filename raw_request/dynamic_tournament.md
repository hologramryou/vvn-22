# Prompt Dynamic Tournament

> Dùng file này làm prompt giao việc cho AI agent khác. Không coi đây là spec triển khai chính thức.

```text
Bạn là senior full-stack engineer. Hãy sửa màn /tournaments và toàn bộ luồng giải đấu dynamic để hiển thị đúng theo cây giải đấu do admin cấu hình.

Bối cảnh:
- Hệ thống trước đây là legacy, hiện đã chuyển sang dynamic.
- Giao diện phải render theo cây thật, không theo các tab/filter kiểu cũ.
- Backend đã có endpoint GET /api/tournaments/{id}/bracket-tree và schema cây tương ứng.
- Frontend/src/pages/TournamentsPage.tsx vẫn còn logic đọc theo structure.categories / age_types / weight_classes.

Mục tiêu:
- /tournaments phải render hoàn toàn theo bracket-tree.
- Cây giải đấu là source of truth cho dynamic.
- Không để UI phụ thuộc vào flow tab kiểu cũ.

Yêu cầu UX:
1. Bố cục
- Giữ header hiện tại: tên giải, badge trạng thái, các nút hành động.
- Dynamic mode chuyển sang bố cục 2 cột:
  - Cột trái: cây điều hướng.
  - Cột phải: panel chi tiết của node/leaf đang chọn.
- Trên mobile phải xếp dọc, không vỡ layout.

2. Cây điều hướng
- Render theo BracketTreeResponse.nodes.
- Node nhóm hiển thị dạng accordion hoặc khối có thể mở rộng.
- Node lá hiển thị card riêng, có:
  - tên hạng
  - số VĐV
  - trạng thái NOT_GENERATED / GENERATING / GENERATED
- Có breadcrumb hoặc chip đường dẫn cho node đang chọn.
- Có badge số lượng VĐV và trạng thái ngay trên từng node.

3. Panel chi tiết
- Khi chọn node lá:
  - hiển thị tên hạng, giới tính, category, age type, số VĐV, trạng thái bracket.
  - hiển thị danh sách VĐV.
  - hiển thị bracket view hoặc empty state tương ứng.
- Khi chọn node nhóm:
  - hiển thị summary của nhánh.
  - hiển thị các node con để đi sâu.
- Không tự nhảy ngầm sang leaf đầu tiên nếu user chưa chọn gì, trừ khi có selection persisted rõ ràng.

4. Hành vi dynamic
- Không dùng structure.categories / age_types / weight_classes để điều hướng hoặc render.
- Chỉ dùng bracketTree làm source of truth.

5. Tương tác
- Click node nhóm: mở subtree.
- Click node lá: chọn leaf đó và set selected weight class.
- Có thể giữ selection theo URL query param nếu có.
- Có empty state rõ ràng khi nhánh chưa có VĐV hoặc chưa generate bracket.

6. Nút generate bracket
- Chỉ hiện nút generate bracket ở node lá.
- Chỉ cho phép generate khi tournament đang ở DRAFT.
- Không hiện nút generate ở node nhóm.

7. Tránh hard-code
- Không parse tên node để suy nghiệp vụ.
- Không hard-code số cấp tree.
- Không hard-code các nhãn Nam/Nữ, Phong trào/Phổ thông, Loại 1A... trong dynamic mode.

8. Nếu cần tách component
- Có thể tách component riêng cho dynamic tree, ví dụ:
  - DynamicBracketTree
  - DynamicTreeNode
  - DynamicLeafCard
  - DynamicBracketDetailPanel
- Có thể chỉnh frontend/src/types/tournament.ts nếu cần type rõ hơn.
- Chỉ sửa backend nếu thật sự thiếu dữ liệu, ưu tiên frontend trước.

9. Không phá luồng liên quan
- Không phá MatchesPage, ScoringPage, generate schedule, publish, reset.
- Không đổi schema DB nếu chưa cần.

10. Tiêu chí hoàn thành
- Nêu rõ root cause.
- Nêu rõ file đã sửa.
- Nêu rõ cách verify thủ công với 1 tournament dynamic và 1 tournament legacy.

Kết quả kỳ vọng:
- Mở /tournaments thì thấy cây giải đấu đúng như admin cấu hình.
- Đổi cây ở admin rồi quay lại /tournaments thì UI phản ánh đúng cây mới.
- Không còn phụ thuộc vào flow tab kiểu cũ.

Yêu cầu kiểm tra auto-generate match:
- Kiểm tra generate_all_matches() có sinh bracket theo từng leaf weight class hay không.
- Kiểm tra generate_schedule() có sắp xếp theo thứ tự tree hay không.
- Kiểm tra bracket và schedule có dùng đúng dữ liệu tree/assignment chứ không dựa vào logic cũ.
- Nếu bracket không đồng bộ với cây, phải sửa để đọc trực tiếp từ tree/assignment data.

Ghi chú về auto-gen:
- Thuật toán single-elimination theo từng weight class về cơ bản là đúng nếu đầu vào là leaf đúng và số VĐV thực tế.
- Rủi ro chính nằm ở phạm vi dữ liệu và thứ tự hiển thị, không phải ở công thức bracket.
- Ưu tiên cao nhất là tree-first rendering và đồng bộ source of truth.
```
