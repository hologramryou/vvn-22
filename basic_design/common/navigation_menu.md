# Spec — Navigation Menu (Sidebar)

**Version:** 1.0
**Date:** 2026-03-25
**Module:** Common / Layout
**Status:** Ready

---

## 1. Tổng quan

Sidebar điều hướng chính của toàn bộ ứng dụng. Cố định bên trái trên desktop, drawer trên mobile.

---

## 2. Cấu trúc menu (6 mục)

| # | Label | Route | Icon | Feature module |
|---|-------|-------|------|----------------|
| 1 | Dashboard | `/dashboard` | LayoutDashboard | 07_dashboard |
| 2 | Vận động viên | `/students` | Users | 01_student_management |
| 3 | Giải đấu | `/tournaments` | Trophy | 03_tournament_management |
| 4 | Danh sách trận đấu | `/matches` | List | 04_sparring_scoring |
| 5 | Bảng hiển thị | `/display` | Monitor | 06_display_scoreboard |
| 6 | Bảng tổng sắp huy chương | `/medals` | Medal | 03_tournament_management |

---

## 3. Role visibility

| Menu item | admin | club_manager | referee | scorekeeper | viewer |
|-----------|-------|--------------|---------|-------------|--------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vận động viên | ✓ | ✓ | — | — | ✓ (readonly) |
| Giải đấu | ✓ | ✓ | ✓ | ✓ | ✓ |
| Danh sách trận đấu | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bảng hiển thị | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bảng tổng sắp | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 4. Behavior

- **Active state:** Highlight mục hiện tại theo route đang active
- **Mobile:** Hamburger icon → drawer slide-in từ trái. Tap overlay ngoài để đóng.
- **Desktop:** Sidebar cố định, không collapsible ở giai đoạn đầu
- **Logo:** Hiển thị logo Vovinam + tên hệ thống ở top sidebar
- **User info:** Avatar + tên người dùng + nút Đăng xuất ở bottom sidebar

---

## 5. Responsive

| Breakpoint | Behavior |
|------------|----------|
| < 768px (mobile) | Drawer, ẩn khi không mở |
| 768–1023px (tablet) | Sidebar icon-only (collapse labels) |
| ≥ 1024px (desktop) | Sidebar full (icon + label) |

---

## 6. Navigation rules

- Unauthenticated → redirect to `/login`
- After login → redirect to `/dashboard`
- 404 → redirect to `/dashboard`
- `/display` (Bảng hiển thị) → mở trong tab mới (designed for TV/projector)
