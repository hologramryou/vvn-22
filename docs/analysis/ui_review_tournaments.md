# UI Review Report

**Scanned:** `frontend\src\pages\tournaments`  
**Findings:** 10 tổng — 0 🔴 critical · 3 🟡 warning · 7 🔵 suggestion  
**Files bị ảnh hưởng:** 3

## Tổng quan theo loại

| Check | Count | Mô tả |
|---|---|---|
| `primary_border_text_hardcoded` | 4 🔵 | Border/text interactive hardcode |
| `inline_modal` | 3 🟡 | Modal thủ công — thay bằng <Modal> |
| `h1_raw_in_page` | 3 🔵 | h1 raw trong page (không qua PageHeader) |


> **Không flag (giữ nguyên màu cố ý):**
> - `bg-blue-50/100/200` — light background cho pill, info card, quyen result
> - `text-blue-700` standalone — TreePathPills level 0, QuyenResultsModal semantic
> - `bg-red-50`, `bg-emerald-50`, `bg-amber-50` — player color, status color
> - ScoringPage, QuyenScoringPage, DisplayPage, MatchJudgePanelPage — design màn đặc biệt
> - BracketExportModal — export layout cố ý

---

## 🟡 Warning (3)

### `frontend/src/pages/tournaments/KataManagerPage.tsx`
- **L36** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L113** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L192** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```

## 🔵 Suggestion (7)

### `frontend/src/pages/tournaments/KataManagerPage.tsx`
- **L451** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <Link to="/tournaments" className="hover:text-blue-600">Giải đấu</Link>
  ```
- **L458** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-bold text-gray-900">Bài Quyền</h1>
  ```

### `frontend/src/pages/tournaments/TournamentManagePage.tsx`
- **L275** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <button onClick={() => setShowForm(true)} className="text-sm text-blue-600 hover:underline">
  ```
- **L299** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className={`p-1 rounded transition-all ${isEditing ? 'text-blue-600 bg-blue-100' : 'opacity-0 group-hover:opacity-100 text-blue-400 hover:te
  ```
- **L190** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-xl font-bold text-gray-800">Quản lý Giải Đấu</h1>
  ```

### `frontend/src/pages/tournaments/TournamentStructurePage.tsx`
- **L855** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <Link to="/tournaments" className="hover:text-blue-600">Giải đấu</Link>
  ```
- **L863** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-bold text-gray-900">
  ```
