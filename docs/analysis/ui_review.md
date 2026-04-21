# UI Review Report

**Scanned:** `frontend\src`  
**Findings:** 72 tổng — 0 🔴 critical · 23 🟡 warning · 49 🔵 suggestion  
**Files bị ảnh hưởng:** 24

## Tổng quan theo loại

| Check | Count | Mô tả |
|---|---|---|
| `h1_raw_in_page` | 21 🔵 | h1 raw trong page (không qua PageHeader) |
| `primary_border_text_hardcoded` | 17 🔵 | Border/text interactive hardcode |
| `inline_modal` | 16 🟡 | Modal thủ công — thay bằng <Modal> |
| `missing_aria_label` | 7 🔵 | Icon button thiếu aria-label |
| `any_type` | 4 🟡 | Dùng `any` type |
| `focus_ring_hardcoded` | 4 🔵 | Focus ring hardcode |
| `primary_button_hardcoded` | 2 🟡 | Nút action dùng màu primary hardcode (có text-white) |
| `local_statusbadge` | 1 🟡 | Định nghĩa StatusBadge local |


> **Không flag (giữ nguyên màu cố ý):**
> - `bg-blue-50/100/200` — light background cho pill, info card, quyen result
> - `text-blue-700` standalone — TreePathPills level 0, QuyenResultsModal semantic
> - `bg-red-50`, `bg-emerald-50`, `bg-amber-50` — player color, status color
> - ScoringPage, QuyenScoringPage, DisplayPage, MatchJudgePanelPage — design màn đặc biệt
> - BracketExportModal — export layout cố ý

---

## 🟡 Warning (23)

### `frontend/src/components/layout/Sidebar.tsx`
- **L355** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex">
  ```

### `frontend/src/components/students/ImportModal.tsx`
- **L88** `[any_type]` Dùng `any` type — khai báo type cụ thể
  ```
  onError: (err: any) => {
  ```

### `frontend/src/lib/constants.ts`
- **L67** `[primary_button_hardcoded]` Primary button hardcode bg-blue-xxx — đổi thành bg-[var(--color-primary)]
  ```
  "Lam đai II":       { bg: "bg-blue-600",   text: "text-white"   },
  ```
- **L68** `[primary_button_hardcoded]` Primary button hardcode bg-blue-xxx — đổi thành bg-[var(--color-primary)]
  ```
  "Lam đai III":      { bg: "bg-blue-700",   text: "text-white"   },
  ```

### `frontend/src/pages/DashboardPage.tsx`
- **L140** `[any_type]` Dùng `any` type — khai báo type cụ thể
  ```
  function ClubTick(props: any) {
  ```

### `frontend/src/pages/MatchesPage.tsx`
- **L1333** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
  ```
- **L1714** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
  ```
- **L1838** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
  ```
- **L97** `[local_statusbadge]` Định nghĩa StatusBadge local — import từ components/ui
  ```
  function StatusBadge({ status }: { status: string }) {
  ```

### `frontend/src/pages/TournamentsPage.tsx`
- **L536** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
  ```

### `frontend/src/pages/students/StudentCreatePage.tsx`
- **L148** `[any_type]` Dùng `any` type — khai báo type cụ thể
  ```
  onError: (error: any) => {
  ```

### `frontend/src/pages/students/StudentEditPage.tsx`
- **L233** `[any_type]` Dùng `any` type — khai báo type cụ thể
  ```
  } catch (error: any) {
  ```

### `frontend/src/pages/students/StudentListPage.tsx`
- **L97** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex items-center justify-center">
  ```
- **L313** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex items-center justify-center">
  ```
- **L1084** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 z-50 flex flex-col justify-end">
  ```

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

### `frontend/src/pages/tournaments/TournamentStructurePage.tsx`
- **L90** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L200** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L271** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L349** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```
- **L431** `[inline_modal]` Modal thủ công — nên dùng <Modal> component từ ui/
  ```
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  ```

## 🔵 Suggestion (49)

### `frontend/src/components/layout/Sidebar.tsx`
- **L149** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="p-1 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
  ```
- **L236** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  text-slate-500 hover:bg-blue-100 hover:text-blue-700
  ```
- **L261** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  : 'text-slate-500 hover:bg-blue-100 hover:text-blue-700'
  ```
- **L281** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  text-slate-600 hover:bg-blue-100 hover:text-blue-700
  ```
- **L308** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  : 'text-slate-500 hover:bg-blue-100 hover:text-blue-700'
  ```
- **L339** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  hover:bg-blue-100 hover:text-blue-700 transition-colors
  ```

### `frontend/src/components/students/StudentFilters.tsx`
- **L12** `[focus_ring_hardcoded]` Focus ring hardcode — đổi thành focus:ring-[var(--color-primary)]
  ```
  const selOn = `${selBase} border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500`
  ```
- **L346** `[focus_ring_hardcoded]` Focus ring hardcode — đổi thành focus:ring-[var(--color-primary)]
  ```
  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  ```

### `frontend/src/components/students/StudentTable.tsx`
- **L69** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <td className="px-4 py-3 font-medium text-blue-600 hover:underline whitespace-nowrap">{s.full_name}</td>
  ```

### `frontend/src/pages/AccountsPage.tsx`
- **L247** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-[var(--color-primary,#1d4ed8)]"
  ```

### `frontend/src/pages/DashboardPage.tsx`
- **L366** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-xl font-bold text-gray-900">{selectedTournament.name}</h1>
  ```

### `frontend/src/pages/DisplayPage.tsx`
- **L613** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-lg font-black text-gray-900 mt-0.5">
  ```
- **L759** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-lg sm:text-2xl font-bold tracking-[-0.04em] text-[#C2410C] mt-1">
  ```

### `frontend/src/pages/LoginPage.tsx`
- **L38** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-bold text-gray-900">Vovinam Fighting</h1>
  ```

### `frontend/src/pages/MatchSetupPage.tsx`
- **L218** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
  ```
- **L237** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-red-600 md:text-4xl">
  ```
- **L243** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-blue-600 md:text-4xl">
  ```

### `frontend/src/pages/MatchesPage.tsx`
- **L1385** `[focus_ring_hardcoded]` Focus ring hardcode — đổi thành focus:ring-[var(--color-primary)]
  ```
  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
  ```
- **L1397** `[focus_ring_hardcoded]` Focus ring hardcode — đổi thành focus:ring-[var(--color-primary)]
  ```
  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
  ```
- **L260** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="text-indigo-600 hover:underline text-left"
  ```
- **L569** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <button onClick={() => onViewTeamMembers(slot)} className="text-indigo-600 hover:underline text-left">
  ```
- **L1340** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
  ```
- **L1373** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
  ```
- **L1445** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
  ```
- **L1496** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
  ```
- **L1518** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
  ```
- **L1721** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
  ```
- **L1845** `[missing_aria_label]` Icon-only button thiếu aria-label — thêm aria-label để accessibility
  ```
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
  ```
- **L2194** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-xl font-bold text-gray-800">Lịch thi đấu</h1>
  ```

### `frontend/src/pages/MedalsPage.tsx`
- **L752** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-extrabold text-slate-100 leading-tight tracking-tight max-w-2xl truncate">
  ```

### `frontend/src/pages/QuyenJudgePage.tsx`
- **L115** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="mt-2 sm:mt-3 text-lg sm:text-2xl md:text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#C2410C]">
  ```

### `frontend/src/pages/QuyenSetupPage.tsx`
- **L221** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-lg sm:text-2xl font-semibold tracking-[-0.03em] text-slate-900">{detail.tournament_name}</h1>
  ```
- **L235** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-[-0.04em] text-[#C2410C]">
  ```

### `frontend/src/pages/RefereeConsolePage.tsx`
- **L38** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-bold text-slate-900">Bàn trọng tài</h1>
  ```

### `frontend/src/pages/ScoringPage.tsx`
- **L476** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-white text-7xl font-bold mb-6">KNOCKOUT!</h1>
  ```

### `frontend/src/pages/TournamentsPage.tsx`
- **L1221** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-xl font-bold text-gray-800">
  ```

### `frontend/src/pages/clubs/ClubListPage.tsx`
- **L273** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-[var(--color-primary,#1d4ed8)]"
  ```

### `frontend/src/pages/students/StudentCreatePage.tsx`
- **L220** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="text-sm text-blue-600 font-medium hover:underline">
  ```
- **L173** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="font-semibold text-gray-900 text-[15px]">Thêm môn sinh mới</h1>
  ```

### `frontend/src/pages/students/StudentEditPage.tsx`
- **L346** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  className="text-sm text-blue-600 font-medium hover:underline">
  ```
- **L301** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="font-semibold text-gray-900 text-[15px]">Chỉnh sửa môn sinh</h1>
  ```

### `frontend/src/pages/students/StudentListPage.tsx`
- **L837** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="font-bold text-gray-900 leading-tight text-sm md:text-base">Quản lý vận động viên</h1>
  ```

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
- **L887** `[primary_border_text_hardcoded]` Interactive border/text primary hardcode — cân nhắc dùng CSS var
  ```
  <Link to="/tournaments" className="hover:text-blue-600">Giải đấu</Link>
  ```
- **L895** `[h1_raw_in_page]` h1 trực tiếp trong page — cân nhắc dùng <PageHeader>
  ```
  <h1 className="text-2xl font-bold text-gray-900">
  ```
