# Frontend CLAUDE.md

## Áp Dụng Cho

- `frontend/src/`

## Quy Tắc Kiến Trúc

- Server state dùng TanStack Query.
- Không dùng `useState` thay cho dữ liệu fetch từ API.
- API layer đặt trong `src/api/`.
- Types đặt trong `src/types/`.
- Pages không gọi HTTP trực tiếp nếu đã có API layer/hook phù hợp.

## Bắt Buộc Trước Khi Viết UI

Trước khi viết bất kỳ component hoặc page nào, Claude **phải** đọc:

1. `frontend/src/components/ui/` — kiểm tra xem đã có `Modal`, `PageHeader`, `ConfirmDialog`, `FormField`, `StatusBadge`, `EmptyState`, `FilterChip` chưa. Dùng lại nếu có, không tự tạo lại.
2. `frontend/src/styles/tokens.ts` — lấy đúng class từ `color`, `card`, `filterChip`, `treePathLevels`. Không hardcode Tailwind class khi token đã định nghĩa sẵn.
3. CSS custom properties hiện tại: `--color-primary`, `--color-primary-dark`, `--color-primary-text`. Dùng `bg-[var(--color-primary)]` thay vì `bg-blue-700` cho nút primary.

Nếu component cần chưa có → tạo mới vào `frontend/src/components/ui/` và export từ `index.ts`.

## Quy Tắc Màu Sắc

- **Primary button** (action chính): `bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]` — không dùng `bg-blue-700`.
- **Text tiêu đề**: `text-[var(--color-primary-dark)]` cho h1/h2 trang, không dùng `text-slate-800`/`text-gray-900`.
- **Text phụ / muted**: dùng `color.textSecondary` (`text-[var(--color-primary-dark)]/70`) hoặc `color.textMuted` (`text-[var(--color-primary-dark)]/50`) từ `tokens.ts`.
- **Tuyệt đối không dùng** `text-gray-*` hoặc `text-slate-*` cho text người dùng đọc — kể cả `text-slate-400`, `text-slate-500`. Dùng CSS var + opacity thay thế.
- **Semantic color** (giữ nguyên, không đổi): `bg-blue-50/100`, `bg-emerald-50`, `bg-amber-50`, tree path pills, màn hình chấm điểm.
- **Link/breadcrumb**: `text-[var(--color-primary)]` không dùng `text-slate-400`.

## Quy Tắc UI

- Không dùng `truncate` + `max-w-[...]` cứng trong ô table — gây mất thông tin. Để text wrap tự nhiên hoặc dùng `title` attribute nếu cần tooltip.
- Tên nội dung (content_name, tên bài quyền) trong table dùng `text-[var(--color-primary)]` thay vì `text-gray-800`.
- Màn hình phải bám `detail_design/...`:
  - Screen mapping
  - API dependencies
  - UI states
  - Event trigger
- Nếu Detail Design đã chỉ định API sequence, FE không được đổi flow mà không cập nhật spec.

## Quy Tắc Type

- Không dùng `any` nếu có thể khai báo type rõ.
- Ưu tiên type khớp với response/request đã định nghĩa.

## Xác Minh

- Nếu sửa luồng user-facing quan trọng, kiểm tra lại loading / success / error states.
- Nếu có test frontend sẵn, ưu tiên cập nhật theo AC liên quan.
