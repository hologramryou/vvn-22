# Fix: Setup Trọng Tài Endpoint Issues

## Problems Found & Fixed

### 1. **Backend API Bug** (CRITICAL) ✅
**File**: `backend/app/routers/tournaments.py` (line 354-371)

**Issue**: `get_match_detail` endpoint had undefined variable `current_user`
- Parameter was `_=Depends(get_current_user)` (underscore = not captured)
- Code tried to use `current_user.role` and `current_user.id` → NameError

**Fix**:
```python
# BEFORE:
async def get_match_detail(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),  # ❌ underscore not captured
):
    # ... later code tries to use current_user → ERROR

# AFTER:
async def get_match_detail(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),  # ✅ properly captured
):
```

**Result**: API endpoint `/GET /matches/{matchId}` now properly returns MatchDetail data

---

### 2. **Frontend Query Bug** (BLOCKING) ✅
**File**: `frontend/src/pages/MatchSetupPage.tsx` (line 124-134)

**Issue**: Query blocked by role check in `enabled` condition
- `enabled: !!matchId && role === 'admin'`
- When component mounted, role check returned false → query never fired
- BUT redirect happened asynchronously → infinite loading state

**Fix**:
```typescript
// BEFORE:
useEffect(() => {
  if (role !== 'admin') {
    navigate('/matches', { replace: true })
  }
}, [navigate, role])

const detailQ = useQuery({
  queryKey: ['match', matchId],
  queryFn: () => getMatchDetail(Number(matchId)),
  enabled: !!matchId && role === 'admin',  // ❌ blocks query
  refetchInterval: 2000,
})

// AFTER:
useEffect(() => {
  if (role !== 'admin') {
    navigate('/matches', { replace: true })
    return  // ✅ early return
  }
}, [navigate, role])

const detailQ = useQuery({
  queryKey: ['match', matchId],
  queryFn: () => getMatchDetail(Number(matchId)),
  enabled: !!matchId,  // ✅ no role check - redirect handles auth
  refetchInterval: 2000,
})

const usersQ = useQuery({
  queryKey: ['users'],
  queryFn: getUsers,
  enabled: !!matchId,  // ✅ fixed same issue
})
```

**Result**: Query fires immediately → data loads → redirects work properly if needed

---

## Expected Flow After Fix

### ✅ Success Case (Admin User)
1. User clicks "Setup Trọng Tài" button
2. Navigate to `/matches/:matchId/setup`
3. MatchSetupPage renders and queries API
4. Backend `/matches/:matchId` endpoint responds with MatchDetail data
5. Component displays setup UI
6. Admin assigns judges and saves
7. Redirect back to `/matches` + page reloads

### ✅ Authorization Case (Non-Admin)
1. User (non-admin role) accesses `/matches/:matchId/setup`
2. useEffect detects `role !== 'admin'`
3. Immediate redirect to `/matches`
4. Query cleanup handled automatically

---

## Testing Checklist

- [ ] Click "Setup Trọng Tài" button on Match row
- [ ] Page loads (no infinite "Đang tải..." spinner)
- [ ] Can see match details (player names, weight class, etc.)
- [ ] Judge seats show with selector dropdowns
- [ ] Select 5 different judges from dropdown
- [ ] Click "Lưu cấu hình" button
- [ ] Returns to `/matches` page
- [ ] Page shows updated state with "Bắt đầu" button (setup complete)
- [ ] Non-admin access to setup page redirects to `/matches`

---

## Files Modified
1. ✅ `backend/app/routers/tournaments.py` - Fixed current_user parameter
2. ✅ `frontend/src/pages/MatchSetupPage.tsx` - Removed role check from query enabled

## Root Cause
The issue was compounded:
- Backend API didn't properly capture the `current_user` parameter (Python error)
- Frontend query condition made backend call fail silently (query blocked)
- Result: Loading spinner persisted indefinitely

Both fixes are required for complete solution.

