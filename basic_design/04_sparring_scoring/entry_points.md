# Entry Points — Vào màn hình chấm điểm

## Feature
04_sparring_scoring

## Description
Hai điểm vào màn hình ScoringPanel: từ sơ đồ thi đấu và từ lịch trình.

---

## Entry 1: TournamentsPage → BracketView

### Điều kiện hiển thị nút "Chấm điểm"
- `match.status === 'ready'`
- `userRole === 'admin' || userRole === 'referee'`
- `match.is_bye === false`

### Vị trí
Trong `MatchBox` component, góc trên phải của match card.

### UI
```
┌─────────────────────┐
│  Nguyễn Văn A       │  [▶ Chấm điểm]
│  vs                 │
│  Trần Văn B         │
└─────────────────────┘
```
- Nút nhỏ, icon `Play` (lucide), màu `bg-green-600 text-white`
- Hover: `hover:bg-green-700`

### Action
```typescript
onClick={() => navigate(`/matches/${match.id}/score`)
```

---

## Entry 2: MatchesPage → Schedule List

### Điều kiện hiển thị nút "Chấm điểm"
- `match.status === 'ready'` hoặc `'ongoing'`
- `userRole === 'admin' || userRole === 'referee'`

### Vị trí
Cột Actions cuối mỗi row trong bảng lịch trình.

### UI (per row)
```
| Sân A | Vòng 1 | Nguyễn Văn A vs Trần Văn B | 45kg Nam | ready | [▶ Chấm điểm] |
```
- Button: `text-xs`, icon `Play`, `text-green-600 border-green-200 hover:bg-green-50`
- Khi `ongoing`: icon `Zap`, màu `text-yellow-600 border-yellow-200`

### Action
```typescript
onClick={() => navigate(`/matches/${match.id}/score`)
```

---

## Actors
- referee, admin

## Data Source
- Dùng match data đã fetch từ bracket hoặc schedule list (không gọi thêm API ở bước này)

## Navigation
- Đi tới: `04_sparring_scoring/scoring_panel`
