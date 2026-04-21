import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import {
  getMatchDetail,
  getMatchJudgePanel,
} from '../api/tournaments'
import { getUserRole } from '../lib/auth'
import { useMatchScoringWS } from '../hooks/useMatchScoringWS'
import type { MatchJudgePanelDetail } from '../types/tournament'

export function MatchJudgePanelPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = getUserRole()

  const panelQ = useQuery<MatchJudgePanelDetail>({
    queryKey: ['match-judge-panel', matchId],
    queryFn: () => getMatchJudgePanel(Number(matchId)),
    enabled: !!matchId,
    // Poll slowly — needed to detect status transitions (pending→ready→ongoing)
    // that gate the WS connection. Once WS connects, it handles realtime state.
    refetchInterval: 5000,
  })

  const matchQ = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchDetail(Number(matchId)),
    enabled: !!matchId,
    // No polling — WS handles all realtime score/phase/status updates.
    // REST poll would return stale DB scores (consensus is in-memory only).
    refetchInterval: false,
    // Disable auto-refetch triggers (critical on mobile: tab switch / network change
    // would fetch stale DB score and overwrite live in-memory consensus scores).
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const panel = panelQ.data
  const match = matchQ.data
  const judge = panel?.judge

  // Patch matchQ cache from WS — WS wins immediately, REST poll confirms 2s later.
  // No separate ws* state so stale WS snapshots can't freeze the display.
  const patchMatch = (patch: Partial<typeof match>) =>
    qc.setQueryData(['match', matchId], (old: typeof match) => old ? { ...old, ...patch } : old)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['match-judge-panel', matchId] })
  }

  // Use both panel.status (from poll) and match.status (from WS patchMatch) so WS connects
  // immediately when match transitions, even before the next poll cycle refreshes panelQ.
  const effectiveStatus = match?.status ?? panel?.status
  const isActiveWS = effectiveStatus === 'ready' || effectiveStatus === 'ongoing'

  // Auto-return to console when match is completed
  useEffect(() => {
    if (panel?.status === 'completed') {
      qc.removeQueries({ queryKey: ['referee-current-assignment'] })
      navigate('/referee-console', { replace: true })
    }
  }, [panel?.status, navigate, qc])

  const { connected: wsConnected, sendJudgeInput } = useMatchScoringWS({
    matchId: matchId ? Number(matchId) : undefined,
    enabled: !!matchId && !!panel && isActiveWS,
    onScoreUpdate: (s1, s2) => patchMatch({ score1: s1, score2: s2 }),
    onSnapshot: (_s1, _s2, state) => {
      // Apply phase/status/timer from snapshot. Score comes from onScoreUpdate only —
      // snapshot score could be stale DB fallback if _match_scores is not yet populated.
      patchMatch({
        score1: _s1,
        score2: _s2,
        ...(state?.match_phase ? { match_phase: state.match_phase as never } : {}),
        ...(state?.status ? { status: state.status as never } : {}),
        ...(state?.timer_active !== undefined ? { timer_active: state.timer_active } : {}),
      })
    },
    onMatchState: (state) => {
      patchMatch({
        score1: state.score1,
        score2: state.score2,
        match_phase: state.match_phase as never,
        status: state.status as never,
        timer_active: state.timer_active,
      })
    },
    onJudgeReady: () => refresh(),
  })

  const handleScore = (side: 1 | 2, delta: number) => {
    if (!canScore) return
    const playerSide = side === 1 ? 'RED' : 'BLUE'
    const scoreType = delta === 1 ? '+1' : delta === 2 ? '+2' : '-1'
    sendJudgeInput(playerSide as 'RED' | 'BLUE', scoreType as '+1' | '+2' | '-1')
  }

  if (panelQ.isError || matchQ.isError) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow border border-red-200 text-center max-w-sm">
          <p className="text-red-600 font-bold text-lg mb-2">Không kết nối được server tại sân</p>
          <p className="text-slate-500 text-sm">Kiểm tra local backend đang chạy tại sân ({import.meta.env.VITE_LOCAL_API_URL ?? 'localhost:8001'})</p>
          <button onClick={() => { panelQ.refetch(); matchQ.refetch() }} className="mt-4 px-4 py-2 bg-[var(--color-primary,#1d4ed8)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-dark,#1e3a5f)] transition">
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if (panelQ.isLoading || !panel) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-700 text-lg font-semibold">
          <Loader2 size={22} className="animate-spin text-blue-500" />
          Đang tải...
        </div>
      </div>
    )
  }

  // Judge panel only active from 'ready' onwards, and judge must be assigned (admin bypasses assignment check)
  const activeStatuses = ['ready', 'ongoing', 'completed']
  const isAssigned = !!panel.judge?.assigned_user_id || role === 'admin'
  if (!activeStatuses.includes(panel.status) || !isAssigned) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow border border-slate-200 text-center max-w-sm">
          <ShieldCheck size={40} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-700 font-bold text-lg mb-1">Chưa vào trận</p>
          <p className="text-slate-400 text-sm">
            {!isAssigned
              ? 'Bạn chưa được phân công vào trận này.'
              : 'Trận chưa bắt đầu — chờ admin kích hoạt.'}
          </p>
          <button
            onClick={() => navigate(role === 'referee' ? '/referee-console' : '/matches')}
            className="mt-5 px-5 py-2 bg-[var(--color-primary,#1d4ed8)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-dark,#1e3a5f)] transition"
          >
            Quay lại
          </button>
        </div>
      </div>
    )
  }

  // All realtime state comes from matchQ cache (updated by WS via patchMatch + REST polling).
  // panel.status is the canonical status source for WS-enable gating (panelQ).
  const isOngoing = (match?.status ?? panel.status) === 'ongoing'
  const isCompleted = panel.status === 'completed'

  const matchPhase = match?.match_phase ?? 'not_started'
  const timerActive = match?.timer_active ?? false
  const score1 = match?.score1 ?? 0
  const score2 = match?.score2 ?? 0
  const isActiveRound = matchPhase === 'round_1' || matchPhase === 'round_2' || matchPhase === 'extra_time'
  const canScore = isOngoing && isActiveRound && timerActive
  const isBreak = isOngoing && matchPhase === 'break'
  const isDrawPending = isOngoing && matchPhase === 'draw_pending'
  const isFinished = isOngoing && matchPhase === 'finished'

  const phaseLabel = matchPhase === 'round_1' ? 'Hiệp 1'
    : matchPhase === 'round_2' ? 'Hiệp 2'
    : matchPhase === 'extra_time' ? 'Hiệp Phụ'
    : matchPhase === 'break' ? 'Giải lao'
    : matchPhase === 'draw_pending' ? 'Chờ bốc thăm'
    : matchPhase === 'finished' ? 'Chờ xác nhận'
    : matchPhase === 'confirmed' ? 'Đã xác nhận'
    : ''

  return (
    <div className="min-h-screen bg-[#f0f4ff] p-4 flex flex-col gap-4 max-w-lg mx-auto">

      {/* Header card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(role === 'referee' ? '/referee-console' : '/matches')}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
            >
              <ArrowLeft size={18} className="text-slate-700" />
            </button>
            <div>
              <p className="text-xs text-slate-400 font-medium">Trọng tài{judge ? ` #${judge.judge_slot}` : ''}</p>
              <p className="text-lg font-bold text-slate-900">
                Trận {match?.match_number ?? '—'}{match?.court ? ` • Sân ${match.court}` : ''}{phaseLabel ? ` · ${phaseLabel}` : ''}
              </p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-gray-300'}`} />
        </div>
        <div className="flex gap-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            {match?.gender === 'M' ? 'Nam' : match?.gender === 'F' ? 'Nữ' : '—'}
          </span>
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
            {match?.age_type_code ?? panel.weight_class_name}
          </span>
          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
            {match?.weight_class_name ?? ''}
          </span>
        </div>
      </div>

      {/* Fighter score cards — shows live match score (admin-managed total) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Red */}
        <div className="bg-red-50 rounded-3xl p-5 border border-red-100 flex flex-col items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-red-100 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 text-center w-full justify-center truncate">
            {panel.player1_name ?? 'TBD'}
          </span>
          <p className="text-red-600 text-6xl font-black leading-none text-center mt-1">{score1}</p>
        </div>
        {/* Blue */}
        <div className="bg-blue-50 rounded-3xl p-5 border border-blue-100 flex flex-col items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 text-center w-full justify-center truncate">
            {panel.player2_name ?? 'TBD'}
          </span>
          <p className="text-blue-600 text-6xl font-black leading-none text-center mt-1">{score2}</p>
        </div>
      </div>


      {/* Waiting for timer to start */}
      {isOngoing && isActiveRound && !timerActive && (
        <div className="bg-slate-50 rounded-3xl p-5 shadow-sm text-center border border-slate-200">
          <p className="text-slate-500 text-lg font-bold">Chờ bắt đầu hiệp</p>
          <p className="text-slate-400 text-sm mt-1">Tổng trọng tài chưa bấm Start</p>
        </div>
      )}

      {/* Scoring area — only active during round_1, round_2, extra_time AND timer running */}
      {canScore && (
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {/* Red scoring */}
            <div className="flex flex-col gap-2">
              <button onClick={() => handleScore(1, 1)}
                className="bg-red-500 hover:bg-red-600 active:scale-95 text-white py-8 rounded-2xl font-black text-2xl transition flex items-center justify-center">
                +1
              </button>
              <button onClick={() => handleScore(1, 2)}
                className="bg-red-600 hover:bg-red-700 active:scale-95 text-white py-8 rounded-2xl font-black text-2xl transition flex items-center justify-center">
                +2
              </button>
            </div>

            {/* Blue scoring */}
            <div className="flex flex-col gap-2">
              <button onClick={() => handleScore(2, 1)}
                className="bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] active:scale-95 text-white py-8 rounded-2xl font-black text-2xl transition flex items-center justify-center">
                +1
              </button>
              <button onClick={() => handleScore(2, 2)}
                className="bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] active:scale-95 text-white py-8 rounded-2xl font-black text-2xl transition flex items-center justify-center">
                +2
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break phase */}
      {isBreak && (
        <div className="bg-amber-50 rounded-3xl p-5 shadow-sm text-center border border-amber-200">
          <p className="text-amber-600 text-lg font-bold">Đang giải lao</p>
          <p className="text-amber-500 text-sm mt-1">Chấm điểm tạm dừng</p>
        </div>
      )}

      {/* Draw pending */}
      {isDrawPending && (
        <div className="bg-orange-50 rounded-3xl p-5 shadow-sm text-center border border-orange-200">
          <p className="text-orange-600 text-lg font-bold">Chờ bốc thăm</p>
          <p className="text-orange-500 text-sm mt-1">Hai bên hòa điểm — đang chờ tổng trọng tài quyết định</p>
        </div>
      )}

      {/* Finished — waiting for confirmation */}
      {isFinished && (
        <div className="bg-blue-50 rounded-3xl p-5 shadow-sm text-center border border-blue-200">
          <p className="text-blue-600 text-lg font-bold">Chờ xác nhận kết quả</p>
          <p className="text-blue-500 text-sm mt-1">Trận đấu đã kết thúc — chờ tổng trọng tài xác nhận</p>
        </div>
      )}

      {/* Completed / Confirmed */}
      {isCompleted && (
        <div className="bg-white rounded-3xl p-5 shadow-sm text-center">
          <p className="text-slate-500 text-sm font-semibold">Trận đã kết thúc</p>
        </div>
      )}

    </div>
  )
}
