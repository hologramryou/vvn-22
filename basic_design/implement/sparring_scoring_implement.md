# IMPLEMENT SPEC — Sparring Scoring Panel

## Mục tiêu
Tạo màn hình chấm điểm đối kháng cho trọng tài và admin.
Có thể vào từ: (1) click trận "ready" trên sơ đồ thi đấu, (2) click từ lịch trình.

---

## Acceptance Criteria

| AC | Mô tả |
|----|-------|
| AC-01 | Viewer bị redirect về /matches khi truy cập /matches/:id/score |
| AC-02 | Match status=pending → redirect /matches + toast "Trận chưa sẵn sàng" |
| AC-03 | Mount với status=ready → tự động call PATCH start → status=ongoing |
| AC-04 | Mount với status=ongoing → load trực tiếp, không call start lại |
| AC-05 | Mount với status=completed → hiển thị kết quả readonly |
| AC-06 | Hiển thị đúng tên player1 (Đỏ) và player2 (Xanh) |
| AC-07 | Điểm hiển thị realtime khi nhấn +1/+2 |
| AC-08 | Không cho điểm âm khi nhấn −1 tại điểm = 0 |
| AC-09 | Timer đếm ngược từ 180s, Start/Pause hoạt động đúng |
| AC-10 | Reset Timer → về 180s, giữ điểm |
| AC-11 | Hiệp tiếp theo → tăng currentRound, reset timer, giữ điểm tích lũy |
| AC-12 | Nút "Hiệp tiếp theo" ẩn khi currentRound = totalRounds |
| AC-13 | Reset tất cả → confirm dialog → reset điểm + round + timer |
| AC-14 | Nút "Ghi nhận kết quả" hiện khi currentRound = totalRounds |
| AC-15 | Confirm dialog hiển thị tổng điểm + auto-detect winner |
| AC-16 | Nếu điểm bằng nhau → hiện radio chọn thủ công |
| AC-17 | Submit gọi POST /result, thành công → navigate(-1) sau 1.5s |
| AC-18 | COURT_BUSY error → toast rõ ràng, không redirect |
| AC-19 | Nút "Chấm điểm" chỉ hiện với role admin/referee trên MatchBox |
| AC-20 | Nút "Chấm điểm" chỉ hiện với role admin/referee trên MatchesPage |

---

## Task List (theo thứ tự dependency)

### BACKEND

#### Task B1 — Thêm giá trị "referee" vào User.role
- File: `backend/app/models/user.py`
- Không cần migration (String column, chỉ là valid value thay đổi ở logic)
- Cập nhật security.py nếu có check role cụ thể

#### Task B2 — JWT response thêm trường `role`
- File: `backend/app/routers/auth.py`
- Endpoint `POST /auth/token`
- Thêm `role: current_user.role` vào response
- FE sẽ lưu: `localStorage.setItem('user_role', data.role)`

#### Task B3 — Thêm GET /matches/{match_id}
- File: `backend/app/routers/tournaments.py`
- Repository: `backend/app/repositories/tournament_repo.py` → thêm `get_match_detail(db, match_id)`
  ```python
  # JOIN BracketMatch → TournamentWeightClass để lấy thêm:
  # weight_class_name, category, age_type_code, gender
  ```
- Schema response: `MatchDetailOut` trong `backend/app/schemas/tournament.py`
  ```python
  class MatchDetailOut(BaseModel):
      id: int
      match_code: str | None
      round: int
      match_number: int
      court: str | None
      player1_name: str | None
      player2_name: str | None
      score1: int | None
      score2: int | None
      winner: int | None
      status: str
      is_bye: bool
      weight_class_name: str
      category: str
      age_type_code: str
      gender: str
  ```

#### Task B4 — PATCH /matches/{id}/start — thêm role check
- File: `backend/app/routers/tournaments.py`
- Thêm trước logic:
  ```python
  if current_user.role not in ("admin", "referee"):
      raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Chỉ admin/referee mới được bắt đầu trận"})
  ```

#### Task B5 — POST /matches/{id}/result — thêm role check + validate ongoing
- File: `backend/app/routers/tournaments.py`
- Thêm role check (admin/referee)
- Thêm validate status == 'ongoing' trong repository:
  ```python
  # tournament_repo.update_match_result:
  # if match.status != 'ongoing': return None, "NOT_ONGOING"
  ```

---

### FRONTEND

#### Task F1 — Lưu `user_role` vào localStorage khi login
- File: `frontend/src/pages/LoginPage.tsx`
- Sau khi nhận token response: `localStorage.setItem('user_role', data.role ?? 'viewer')`

#### Task F2 — Thêm helper `getUserRole()`
- File: `frontend/src/lib/auth.ts` (tạo mới nếu chưa có, hoặc thêm vào constants)
  ```typescript
  export const getUserRole = (): string =>
    localStorage.getItem('user_role') ?? 'viewer'

  export const canScore = (): boolean =>
    ['admin', 'referee'].includes(getUserRole())
  ```

#### Task F3 — Thêm route `/matches/:matchId/score`
- File: `frontend/src/App.tsx`
- Route KHÔNG wrap AppLayout (full-screen):
  ```tsx
  <Route path="/matches/:matchId/score"
    element={<PrivateRoute><ScoringPage /></PrivateRoute>}
  />
  ```

#### Task F4 — Thêm API function `getMatchDetail` và `startMatch`
- File: `frontend/src/api/tournaments.ts`
  ```typescript
  export const getMatchDetail = (matchId: number) =>
    api.get<MatchDetail>(`/tournaments/matches/${matchId}`).then(r => r.data)

  // startMatch đã có — đảm bảo signature đúng:
  export const startMatch = (matchId: number) =>
    api.patch<{id: number; status: string; court: string}>(`/tournaments/matches/${matchId}/start`)
      .then(r => r.data)
  ```

#### Task F5 — Thêm type `MatchDetail`
- File: `frontend/src/types/tournament.ts`
  ```typescript
  export interface MatchDetail {
    id: number
    match_code: string | null
    round: number
    match_number: number
    court: string | null
    player1_name: string | null
    player2_name: string | null
    score1: number | null
    score2: number | null
    winner: number | null
    status: 'pending' | 'ready' | 'ongoing' | 'completed'
    is_bye: boolean
    weight_class_name: string
    category: string
    age_type_code: string
    gender: string
  }
  ```

#### Task F6 — Tạo ScoringPage
- File: `frontend/src/pages/ScoringPage.tsx`
- Route params: `matchId` (từ useParams)
- **Không dùng AppLayout** (full-screen dark UI)
- Xem spec UI chi tiết tại: `basic_design/04_sparring_scoring/scoring_panel.md`

**State:**
```typescript
const [currentRound, setCurrentRound] = useState(1)
const TOTAL_ROUNDS = 2
const ROUND_SECONDS = 180
const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
const [isRunning, setIsRunning] = useState(false)
const [score1, setScore1] = useState(0)   // total tích lũy
const [score2, setScore2] = useState(0)
const [showConfirm, setShowConfirm] = useState(false)
```

**Timer logic (useEffect):**
```typescript
useEffect(() => {
  if (!isRunning) return
  const t = setInterval(() => {
    setTimeLeft(prev => {
      if (prev <= 1) { setIsRunning(false); return 0 }
      return prev - 1
    })
  }, 1000)
  return () => clearInterval(t)
}, [isRunning])
```

**On mount:**
```typescript
const { data: match, isLoading } = useQuery({
  queryKey: ['match', matchId],
  queryFn: () => getMatchDetail(Number(matchId)),
})

useEffect(() => {
  if (!match) return
  // Role guard
  if (!canScore()) { navigate('/matches', { replace: true }); return }
  // Status guard
  if (match.status === 'pending') { navigate('/matches', { replace: true }); return }
  if (match.status === 'completed') return  // readonly mode
  // Auto-start
  if (match.status === 'ready') {
    startMatch(match.id).catch(err => setStartError(err))
  }
}, [match])
```

**Score controls:**
```typescript
const addScore = (side: 1 | 2, pts: number) => {
  if (side === 1) setScore1(s => s + pts)
  else setScore2(s => s + pts)
}
const adjustScore = (side: 1 | 2, delta: number) => {
  if (side === 1) setScore1(s => Math.max(0, s + delta))
  else setScore2(s => Math.max(0, s + delta))
}
```

**Submit:**
```typescript
const submitMutation = useMutation({
  mutationFn: () => {
    const winner = score1 > score2 ? 1 : score2 > score1 ? 2 : manualWinner
    return updateMatchResult(match.id, { winner, score1, score2 })
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['bracket'] })
    qc.invalidateQueries({ queryKey: ['schedule'] })
    setTimeout(() => navigate(-1), 1500)
  },
})
```

**getRoundLabel helper:**
```typescript
function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Chung kết'
  if (round === totalRounds - 1) return 'Bán kết'
  if (round === totalRounds - 2) return 'Tứ kết'
  return `Vòng ${round}`
}
```

#### Task F7 — MatchBox: thêm nút "Chấm điểm"
- File: `frontend/src/pages/TournamentsPage.tsx`
- Trong `MatchBox` component, bên trong match card:
  ```tsx
  {canScore() && match.status === 'ready' && !match.is_bye && (
    <button
      onClick={e => { e.stopPropagation(); navigate(`/matches/${match.id}/score`) }}
      className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700"
    >
      <Play size={10} /> Chấm
    </button>
  )}
  ```
- Import `useNavigate` nếu chưa có trong TournamentsPage

#### Task F8 — MatchesPage: thêm nút "Chấm điểm"
- File: `frontend/src/pages/MatchesPage.tsx`
- Trong cột Actions của mỗi row:
  ```tsx
  {canScore() && (match.status === 'ready' || match.status === 'ongoing') && (
    <button
      onClick={() => navigate(`/matches/${match.id}/score`)}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
        match.status === 'ongoing'
          ? 'text-yellow-600 border-yellow-200 hover:bg-yellow-50'
          : 'text-green-600 border-green-200 hover:bg-green-50'
      }`}
    >
      {match.status === 'ongoing' ? <Zap size={12} /> : <Play size={12} />}
      Chấm điểm
    </button>
  )}
  ```

---

## File Summary

### Backend — tạo mới / sửa
| File | Thay đổi |
|------|----------|
| `backend/app/routers/auth.py` | Thêm `role` vào token response |
| `backend/app/routers/tournaments.py` | Thêm GET /matches/{id}, thêm role check start+result |
| `backend/app/repositories/tournament_repo.py` | Thêm `get_match_detail()`, update `update_match_result()` validate |
| `backend/app/schemas/tournament.py` | Thêm `MatchDetailOut` |

### Frontend — tạo mới / sửa
| File | Thay đổi |
|------|----------|
| `frontend/src/pages/LoginPage.tsx` | Lưu user_role vào localStorage |
| `frontend/src/lib/auth.ts` | Tạo mới: `getUserRole`, `canScore` |
| `frontend/src/App.tsx` | Thêm route `/matches/:matchId/score` (no AppLayout) |
| `frontend/src/types/tournament.ts` | Thêm `MatchDetail` interface |
| `frontend/src/api/tournaments.ts` | Thêm `getMatchDetail` |
| `frontend/src/pages/ScoringPage.tsx` | Tạo mới — toàn bộ scoring UI |
| `frontend/src/pages/TournamentsPage.tsx` | MatchBox thêm nút Chấm điểm |
| `frontend/src/pages/MatchesPage.tsx` | Row thêm nút Chấm điểm |

---

## UI Color Reference

| Phần | Class Tailwind |
|------|----------------|
| Background | `bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900` |
| Bên Đỏ | `bg-gradient-to-b from-red-600 to-red-800 border border-red-400/50` |
| Bên Xanh | `bg-gradient-to-b from-blue-600 to-blue-800 border border-blue-400/50` |
| Panel phụ | `bg-gray-800/90 border border-gray-700` |
| Nút Start | `bg-gradient-to-r from-green-500 to-emerald-600` |
| Nút Pause | `bg-gradient-to-r from-yellow-500 to-orange-500` |
| Nút Next Round | `bg-gradient-to-r from-purple-600 to-purple-700` |
| Nút Reset All | `bg-gradient-to-r from-red-600 to-red-700` |
| Điểm số | `text-8xl md:text-[12rem] font-black tabular-nums` |
| Timer | `text-6xl font-mono` |

---

## Notes

- **Không cần WebSocket** cho sprint này: timer chạy client-side, kết quả submit 1 lần cuối
- **Không persist state giữa các lần reload**: nếu F5 → load lại từ DB (status=ongoing → tiếp tục)
- **Seed data**: thêm user referee_01 với role="referee" trong seed.py để test

