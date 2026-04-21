# UI Rules — Vovinam Fighting

Tài liệu này là nguồn duy nhất cho convention UI. Mọi component mới phải tuân theo.

---

## Màu sắc

| Role | Class | Dùng khi |
|---|---|---|
| Text chính | `text-slate-800` | Tên, tiêu đề, nội dung quan trọng |
| Label field | `text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide text-xs font-semibold` | Label trên field trong card/detail |
| Text mô tả phụ | `text-slate-500` | Mô tả bổ sung, không phải label |
| Placeholder / empty | `text-slate-400` | **Chỉ** dùng cho placeholder hoặc nội dung trống |
| Background trang | `bg-slate-50` | Root page wrapper |
| Card | `bg-white` + `border-slate-200` | Mọi card/panel |
| Table header | `bg-[var(--color-primary-dark,#1e3a5f)] text-white` | Header row bảng |

**Quy tắc:**
- **KHÔNG dùng `text-slate-400` / `text-gray-400` / `text-gray-500` cho label field** — dùng primary color
- `text-slate-400` chỉ cho placeholder, empty state, hoặc text thực sự mờ không mang thông tin
- Không dùng màu neon: tránh `blue-400`, `green-400` cho action button
- Action primary dùng `var(--color-primary)`, không hardcode `blue-600`/`blue-700`

---

## Card

```
bg-white rounded-2xl border border-slate-200 shadow-sm
```

Padding: `p-3` (compact), `p-4` (default), `p-5` (spacious)

---

## Filter / Toggle Chip

Dùng component `<FilterChip>`. Không viết inline.

```
Base:     px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
Active:   bg-blue-700 text-white border-blue-700
Inactive: bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50
Disabled: opacity-50 cursor-not-allowed
```

---

## Tree Path

Dùng component `<TreePathPills>`. Không viết inline.

- Mỗi segment là một pill `rounded-full`
- Màu xoay theo độ sâu: blue → emerald → amber → fuchsia
- Background nhạt `bg-*-50` + `border border-*-200` (không dùng `bg-*-100`)
- Size `sm` trong table, `md` trong card/detail

---

## Status Badge

Dùng component `<StatusBadge>`. Không viết inline status color logic.

| Status | Style |
|---|---|
| pending | slate |
| ready | emerald (xanh lá) |
| ongoing | emerald + pulse dot |
| completed | blue |
| checking | amber |
| cancelled | red |

---

## Empty State

Dùng component `<EmptyState>`. Cấu trúc:
- Icon (Trophy hoặc custom)
- Tiêu đề `text-slate-500`
- Optional sub-text `text-slate-400`
- Optional action button

---

## Button

Chưa extract thành component — dùng class trực tiếp theo convention:

| Variant | Classes |
|---|---|
| Primary | `bg-blue-700 text-white hover:bg-blue-800 rounded-lg px-4 py-2 text-sm font-medium` |
| Outline | `border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium` |
| Danger | `bg-red-600 text-white hover:bg-red-700 rounded-lg px-4 py-2 text-sm font-medium` |
| Ghost | `text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg px-3 py-1.5 text-sm` |

---

## Spacing

- Gap giữa items trong filter row: `gap-1.5`
- Gap giữa pills: `gap-1`
- Page padding: `px-4 py-6` (mobile), `px-6 py-8` (desktop)
