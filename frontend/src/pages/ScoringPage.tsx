import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from 'lucide-react'
import {
  getMatchDetail,
  getMatchDetailCloud,
  startMatch,
  endMatchRound,
  startMatchRound,
  drawMatchResult,
  resetMatch,
  cancelMatch,
  updateMatchResult,
  confirmMatch,
  updateMatchConfig,
  getMatchScoreLogs,
  addMatchScoreLog,
  updateMatchLiveScore,
  setMatchTimerActive,
  getMatchConsensusTurns,
} from '../api/tournaments'
import { canScore, getUserRole } from '../lib/auth'
import type { MatchDetail, MatchScoreLog, ConsensusTurn } from '../types/tournament'
import { useMatchScoringWS } from '../hooks/useMatchScoringWS'

function formatTime(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? '?'
}

const PHASE_LABEL: Record<string, string> = {
  not_started: 'Chưa bắt đầu',
  round_1: 'Hiệp 1',
  break: 'Giải lao',
  round_2: 'Hiệp 2',
  extra_time: 'Hiệp phụ',
  draw_pending: 'Hòa — Chờ bốc thăm',
  finished: 'Kết thúc',
  confirmed: 'Đã xác nhận',
}

export function ScoringPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const role = getUserRole()

  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(180)
  const [roundDuration, setRoundDuration] = useState(180)
  const [breakDuration, setBreakDuration] = useState(30)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [yellowCards1, setYellowCards1] = useState(0)
  const [yellowCards2, setYellowCards2] = useState(0)
  const [manualWinner, setManualWinner] = useState<1 | 2 | null>(null)
  const [knockoutWinner, setKnockoutWinner] = useState<'red' | 'blue' | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ type: string } | null>(null)
  const [syncingToRailway, setSyncingToRailway] = useState(false)
  // Break sub-state: 'idle' = not started yet, 'running' = countdown, 'done' = ready to start next round
  const [breakState, setBreakState] = useState<'idle' | 'running' | 'done'>('idle')
  // Debounce ref for live-score API
  const liveScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track last local score update time — suppress DB sync briefly after local change
  const lastLocalScoreUpdateRef = useRef<number>(0)
  // Persistent BroadcastChannel — reuse across renders to avoid create/close on every tick
  const bcRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (!canScore()) { navigate('/matches', { replace: true }); return }
    if (role === 'referee' && matchId) {
      navigate(`/matches/${matchId}/judge-panel`, { replace: true })
    }
  }, [navigate, role, matchId])

  // Ref to prevent double-trigger of auto-end when timer hits 0
  const autoEndFiredRef = useRef(false)

  // Timer countdown
  useEffect(() => {
    if (!timerRunning) return
    if (timerSeconds <= 0) { setTimerRunning(false); broadcastTimerActive(false); return }
    const t = window.setInterval(() => setTimerSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [timerRunning, timerSeconds])

  const matchQ = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => getMatchDetail(Number(matchId)),
    enabled: !!matchId,
    // No polling — WS handles all realtime updates (score, phase, status).
    // Score is in-memory only on backend; REST would return stale DB values during live match.
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })

  // Fallback to Railway when match not yet synced to local DB (pre-start setup phase)
  const cloudMatchQ = useQuery<MatchDetail>({
    queryKey: ['match-cloud', matchId],
    queryFn: () => getMatchDetailCloud(Number(matchId)),
    enabled: !!matchId && matchQ.isError,
    refetchInterval: false,
  })

  const match = matchQ.data ?? cloudMatchQ.data

  // Open persistent BroadcastChannel once per matchId
  useEffect(() => {
    if (!matchId) return
    bcRef.current = new BroadcastChannel(`match-timer-${matchId}`)
    return () => { bcRef.current?.close(); bcRef.current = null }
  }, [matchId])

  // Broadcast timer + score state to display screen (same browser)
  // Reuse the persistent channel — no create/close on every tick
  useEffect(() => {
    if (!matchId || !bcRef.current) return
    const phase = match?.match_phase ?? 'not_started'
    const INACTIVE_PHASES = ['not_started', 'break', 'draw_pending', 'finished', 'confirmed']
    const effectiveTimerRunning = INACTIVE_PHASES.includes(phase) ? false : timerRunning
    bcRef.current.postMessage({ timerSeconds, timerRunning: effectiveTimerRunning, matchPhase: phase, score1, score2 })
  }, [matchId, timerSeconds, timerRunning, score1, score2, match?.match_phase])

  // Score logs — poll at moderate rate (audit trail only, not realtime-critical)
  const logsQ = useQuery<MatchScoreLog[]>({
    queryKey: ['match-score-logs', matchId],
    queryFn: () => getMatchScoreLogs(Number(matchId)),
    enabled: !!matchId,
    refetchInterval: 1500,
  })

  // Consensus turns — poll cùng tần suất
  const turnsQ = useQuery<ConsensusTurn[]>({
    queryKey: ['match-consensus-turns', matchId],
    queryFn: () => getMatchConsensusTurns(Number(matchId)),
    enabled: !!matchId,
    refetchInterval: 1500,
  })

  const [selectedTurn, setSelectedTurn] = useState<ConsensusTurn | null>(null)
  const [logTab, setLogTab] = useState<'score' | 'no_consensus'>('score')

  // Sync scores from match query cache on initial load and when WS setQueryData updates it.
  // Skip sync for 2s after a local (admin manual) score update to avoid overwriting optimistic state.
  useEffect(() => {
    if (!match) return
    if (Date.now() - lastLocalScoreUpdateRef.current < 2000) return
    setScore1(match.score1 ?? 0)
    setScore2(match.score2 ?? 0)
  }, [match?.id, match?.score1, match?.score2])

  // Sync local duration state from match data (initial load + after config save)
  useEffect(() => {
    if (!match) return
    setRoundDuration(match.round_duration_seconds)
    setBreakDuration(match.break_duration_seconds)
  }, [match?.round_duration_seconds, match?.break_duration_seconds])

  // Khi phase hoặc thời gian server thay đổi, đồng hồ reset về giá trị server.
  // Khi người dùng chỉnh input trực tiếp, onChange gọi setTimerSeconds ngay lập tức.
  useEffect(() => {
    if (!match) return
    const phase = match.match_phase
    const rd = match.round_duration_seconds
    const bd = match.break_duration_seconds
    if (phase === 'not_started' || phase === 'round_1' || phase === 'round_2' || phase === 'extra_time') {
      setTimerSeconds(rd)
      setTimerRunning(false)
      broadcastTimerActive(false)
    } else if (phase === 'break') {
      setTimerSeconds(bd)
      setTimerRunning(false)
      broadcastTimerActive(false)
      setBreakState('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.match_phase, match?.round_duration_seconds, match?.break_duration_seconds])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['match', matchId] })
    qc.invalidateQueries({ queryKey: ['schedule'] })
    qc.invalidateQueries({ queryKey: ['referee-current-assignment'] })
    qc.invalidateQueries({ queryKey: ['match-score-logs', matchId] })
    qc.invalidateQueries({ queryKey: ['match-consensus-turns', matchId] })
  }

  const { sendAdminCommand } = useMatchScoringWS({
    matchId: matchId ? Number(matchId) : undefined,
    enabled: !!matchId,
    onMatchState: (state) => {
      // Only update cache — do NOT invalidate (refetch). WS data is already fresh;
      // a background REST refetch causes transient stale values that trigger
      // the phase-reset useEffect and unnecessary re-renders on all screens.
      qc.setQueryData<MatchDetail>(['match', matchId], (old) => {
        if (!old) return old
        return {
          ...old,
          match_phase: state.match_phase as MatchDetail['match_phase'],
          status: state.status as MatchDetail['status'],
          score1: state.score1,
          score2: state.score2,
          timer_active: state.timer_active,
          ...(state.winner !== undefined ? { winner: state.winner } : {}),
        }
      })
      // When match completes, refresh schedule list so MatchesPage shows updated status
      if (state.status === 'completed') {
        qc.invalidateQueries({ queryKey: ['schedule'] })
        qc.invalidateQueries({ queryKey: ['bracket'] })
      }
    },
    onJudgeReady: () => qc.invalidateQueries({ queryKey: ['match', matchId] }),
    onScoreUpdate: (s1, s2) => {
      setScore1(s1)
      setScore2(s2)
      // Also update the match query cache so derived state (endRoundMut, display) stays in sync
      qc.setQueryData<MatchDetail>(['match', matchId], (old) => old ? { ...old, score1: s1, score2: s2 } : old)
      // Refresh log immediately when consensus score arrives
      qc.invalidateQueries({ queryKey: ['match-score-logs', matchId] })
      qc.invalidateQueries({ queryKey: ['match-consensus-turns', matchId] })
    },
  })

  // Always call REST + WS for timer state so _timer_active in-memory is updated even if WS is not OPEN.
  // Judge panel polls matchQ every 2s and reads timer_active from in-memory dict via REST.
  const broadcastTimerActive = (active: boolean) => {
    sendAdminCommand({ type: 'admin_cmd', cmd: 'timer_active', active })
    setMatchTimerActive(Number(matchId), active).catch(() => {})
  }

  const startMut = useMutation({ mutationFn: () => startMatch(Number(matchId)), onSuccess: refresh })

  // State machine mutations — dùng setQueryData thay vì invalidateQueries để update ngay lập tức
  const setPhase = (patch: Partial<MatchDetail>) =>
    qc.setQueryData<MatchDetail>(['match', matchId], (old) => old ? { ...old, ...patch } : old)

  const endRoundMut = useMutation({
    mutationFn: () => endMatchRound(Number(matchId), { score1, score2 }),
    onSuccess: () => {
      const cur = match?.match_phase
      if (cur === 'round_1') setPhase({ match_phase: 'break' })
      else if (cur === 'round_2') {
        if (score1 === score2) setPhase({ match_phase: 'extra_time' })
        else {
          setPhase({ match_phase: 'finished', status: 'completed', winner: score1 > score2 ? 1 : 2, score1, score2 })
          qc.invalidateQueries({ queryKey: ['schedule'] })
          qc.invalidateQueries({ queryKey: ['bracket'] })
        }
      } else if (cur === 'extra_time') {
        if (score1 === score2) setPhase({ match_phase: 'draw_pending' })
        else {
          setPhase({ match_phase: 'finished', status: 'completed', winner: score1 > score2 ? 1 : 2, score1, score2 })
          qc.invalidateQueries({ queryKey: ['schedule'] })
          qc.invalidateQueries({ queryKey: ['bracket'] })
        }
      }
    },
  })
  const startRoundMut = useMutation({
    mutationFn: () => startMatchRound(Number(matchId)),
    onSuccess: () => setPhase({ match_phase: 'round_2' }),
  })
  const [drawError, setDrawError] = useState<string | null>(null)
  const drawMut = useMutation({
    mutationFn: (winner: 1 | 2) => drawMatchResult(Number(matchId), { winner }),
    onSuccess: (_, winner) => { setDrawError(null); setPhase({ match_phase: 'finished', winner }) },
    onError: () => setDrawError('Lỗi khi chọn người thắng — thử lại'),
  })

  const resetMatchMut = useMutation({
    mutationFn: () => resetMatch(Number(matchId)),
    onSuccess: () => {
      setScore1(0); setScore2(0); setYellowCards1(0); setYellowCards2(0)
      setTimerRunning(false); setManualWinner(null)
      broadcastTimerActive(false)
      // Không setTimerSeconds ở đây — useEffect sẽ sync từ server sau khi refresh
      refresh()
    },
  })
  const cancelMatchMut = useMutation({
    mutationFn: () => cancelMatch(Number(matchId)),
    onSuccess: () => {
      // Local done — Railway sync is fire-and-forget (syncToRailwayWithRetry)
      setSyncingToRailway(true)
      setTimeout(() => setSyncingToRailway(false), 7000)
      refresh()
      navigate('/matches')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ?? 'Không thể hủy trận đấu'
      alert(msg)
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => confirmMatch(Number(matchId)),
    onSuccess: () => {
      refresh()
      // push_match_result_to_railway runs as background task on local server (~3-5s)
      setSyncingToRailway(true)
      setTimeout(() => {
        setSyncingToRailway(false)
        qc.invalidateQueries({ queryKey: ['schedule'] })
        qc.invalidateQueries({ queryKey: ['bracket'] })
      }, 5000)
    },
  })
  const configMut = useMutation({
    mutationFn: (body: { round_duration_seconds?: number; break_duration_seconds?: number }) =>
      updateMatchConfig(Number(matchId), body),
    onSuccess: (_, body) => {
      // Cập nhật cache ngay để useEffect đồng bộ timer về giá trị server mới
      qc.setQueryData<MatchDetail>(['match', matchId], (old) =>
        old ? { ...old, ...body } : old
      )
    },
  })
  const knockoutMut = useMutation({
    mutationFn: (winner: 1 | 2) => updateMatchResult(Number(matchId), { winner, score1, score2 }),
    onSuccess: () => {
      refresh()
      // Auto-sync to Railway immediately after knockout
      setSyncingToRailway(true)
      confirmMatch(Number(matchId)).finally(() => {
        setSyncingToRailway(false)
        qc.invalidateQueries({ queryKey: ['schedule'] })
        qc.invalidateQueries({ queryKey: ['bracket'] })
      })
    },
  })

  // Auto-end round / break when timer hits 0
  // Guard ref prevents double-fire across re-renders at timerSeconds=0
  useEffect(() => {
    if (timerSeconds > 0 || timerRunning) return
    if (!match) return
    const ph = match.match_phase
    if (ph === 'round_1' || ph === 'round_2' || ph === 'extra_time') {
      if (autoEndFiredRef.current) return
      autoEndFiredRef.current = true
      endRoundMut.mutate()
    } else if (ph === 'break') {
      if (autoEndFiredRef.current) return
      autoEndFiredRef.current = true
      setBreakState('done')
      startRoundMut.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerSeconds, timerRunning, match?.match_phase])

  // Reset guard whenever phase changes so next round/break can auto-end too
  useEffect(() => {
    autoEndFiredRef.current = false
  }, [match?.match_phase])

  // Score change + log + broadcast to all screens
  const updateScore = (side: 1 | 2, delta: number) => {
    lastLocalScoreUpdateRef.current = Date.now()
    const newS1 = side === 1 ? score1 + delta : score1
    const newS2 = side === 2 ? score2 + delta : score2
    if (side === 1) setScore1(newS1); else setScore2(newS2)
    addMatchScoreLog(Number(matchId), {
      action: delta > 0 ? 'score_add' : 'score_subtract',
      side, delta, score1_after: newS1, score2_after: newS2,
      description: `${delta > 0 ? '+' : ''}${delta}`,
    })
    // WS: broadcast ngay lập tức (nếu WS open)
    sendAdminCommand({ type: 'admin_cmd', cmd: 'live_score', score1: newS1, score2: newS2 })
    // REST: ngay lập tức để persist DB — display/judge-panel poll sẽ thấy ngay
    if (liveScoreTimerRef.current) clearTimeout(liveScoreTimerRef.current)
    liveScoreTimerRef.current = setTimeout(() => {
      updateMatchLiveScore(Number(matchId), { score1: newS1, score2: newS2 }).catch(() => {})
    }, 300)
  }

  const addYellowCard = (side: 1 | 2) => {
    if (side === 1) {
      const n = yellowCards1 + 1
      setYellowCards1(n)
      if (n % 3 === 0) {
        const newS = score1 - 2
        setScore1(newS)
        addMatchScoreLog(Number(matchId), {
          action: 'yellow_card', side: 1, delta: -2,
          score1_after: newS, score2_after: score2,
          description: `Thẻ vàng #${n} Đỏ → -2 điểm`,
        })
        sendAdminCommand({ type: 'admin_cmd', cmd: 'live_score', score1: newS, score2, yellow_cards1: n, yellow_cards2: yellowCards2 })
        updateMatchLiveScore(Number(matchId), { score1: newS, score2, yellow_cards1: n, yellow_cards2: yellowCards2 }).catch(() => {})
      } else {
        addMatchScoreLog(Number(matchId), {
          action: 'yellow_card', side: 1, delta: 0,
          score1_after: score1, score2_after: score2,
          description: `Thẻ vàng #${n} Đỏ`,
        })
        sendAdminCommand({ type: 'admin_cmd', cmd: 'live_score', score1, score2, yellow_cards1: n, yellow_cards2: yellowCards2 })
        updateMatchLiveScore(Number(matchId), { score1, score2, yellow_cards1: n, yellow_cards2: yellowCards2 }).catch(() => {})
      }
    } else {
      const n = yellowCards2 + 1
      setYellowCards2(n)
      if (n % 3 === 0) {
        const newS = score2 - 2
        setScore2(newS)
        addMatchScoreLog(Number(matchId), {
          action: 'yellow_card', side: 2, delta: -2,
          score1_after: score1, score2_after: newS,
          description: `Thẻ vàng #${n} Xanh → -2 điểm`,
        })
        sendAdminCommand({ type: 'admin_cmd', cmd: 'live_score', score1, score2: newS, yellow_cards1: yellowCards1, yellow_cards2: n })
        updateMatchLiveScore(Number(matchId), { score1, score2: newS, yellow_cards1: yellowCards1, yellow_cards2: n }).catch(() => {})
      } else {
        addMatchScoreLog(Number(matchId), {
          action: 'yellow_card', side: 2, delta: 0,
          score1_after: score1, score2_after: score2,
          description: `Thẻ vàng #${n} Xanh`,
        })
        sendAdminCommand({ type: 'admin_cmd', cmd: 'live_score', score1, score2, yellow_cards1: yellowCards1, yellow_cards2: n })
        updateMatchLiveScore(Number(matchId), { score1, score2, yellow_cards1: yellowCards1, yellow_cards2: n }).catch(() => {})
      }
    }
  }

  if (matchQ.isError && cloudMatchQ.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow border border-red-200 text-center max-w-sm">
          <p className="text-red-600 font-bold text-lg mb-2">Không kết nối được server tại sân</p>
          <p className="text-slate-500 text-sm">Kiểm tra local backend đang chạy tại sân ({import.meta.env.VITE_LOCAL_API_URL ?? 'localhost:8001'})</p>
          <button onClick={() => { matchQ.refetch(); cloudMatchQ.refetch() }} className="mt-4 px-4 py-2 bg-[var(--color-primary,#1d4ed8)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary-dark,#1e3a5f)] transition">
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if ((matchQ.isLoading && cloudMatchQ.isLoading) || !match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-lg font-semibold text-slate-700">
          <Loader2 size={20} className="animate-spin text-blue-500" />
          Đang tải màn điều hành...
        </div>
      </div>
    )
  }

  const phase = match.match_phase
  const isOngoing = match.status === 'ongoing'
  const isCompleted = match.status === 'completed'
  const assignedCount = match.judges.filter(j => j.assigned_user_id !== null).length

  const isActiveRound = isOngoing && (phase === 'round_1' || phase === 'round_2' || phase === 'extra_time')
  const canScoreNow = isActiveRound && timerRunning
  // Admin can still adjust scores / do knockout when waiting for confirmation
  const canAdjustScore = canScoreNow || (isOngoing && phase === 'finished' && role === 'admin')

  // ── Knockout overlay ────────────────────────────────────────────────────
  const knockoutOverlay = knockoutWinner && (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className={`${knockoutWinner === 'red' ? 'bg-gradient-to-br from-red-600 to-red-700 border-red-400' : 'bg-gradient-to-br from-blue-600 to-blue-700 border-blue-400'} rounded-3xl p-12 shadow-2xl border-4 text-center max-w-2xl`}>
        <h1 className="text-white text-7xl font-bold mb-6">KNOCKOUT!</h1>
        <p className="text-white text-4xl font-semibold mb-4">{knockoutWinner === 'red' ? 'ĐỎ' : 'XANH'} THẮNG</p>
        <p className="text-white text-3xl mb-8">{knockoutWinner === 'red' ? match.player1_name : match.player2_name}</p>
        <button onClick={() => setKnockoutWinner(null)} className="bg-white text-gray-900 px-8 py-4 rounded-xl font-bold text-xl hover:bg-gray-100 transition shadow-lg">
          Đóng
        </button>
      </div>
    </div>
  )

  // ── Confirmed view (completed) ─────────────────────────────────────────
  if (isCompleted || phase === 'confirmed' || phase === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 p-4 md:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="bg-white rounded-3xl p-4 shadow border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/matches')} disabled={syncingToRailway} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowLeft size={16} /> Quay lại
              </button>
              <div>
                <p className="text-xs text-blue-600 font-semibold">Kết quả cuối cùng</p>
                <p className="font-bold text-slate-900">{match.player1_name} vs {match.player2_name}</p>
              </div>
            </div>
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">Đã xác nhận</span>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`rounded-3xl p-8 text-center shadow ${match.winner === 1 ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-slate-700'}`}>
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl font-black ${match.winner === 1 ? 'bg-red-400' : 'bg-red-100 text-red-600'}`}>
                {getInitials(match.player1_name)}
              </div>
              <h2 className="text-2xl font-black mb-4">{match.player1_name ?? 'TBD'}</h2>
              <p className="text-7xl font-black">{match.score1 ?? 0}</p>
              {match.winner === 1 && <p className="mt-4 text-lg font-bold">THẮNG</p>}
            </div>
            <div className={`rounded-3xl p-8 text-center shadow ${match.winner === 2 ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-slate-700'}`}>
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl font-black ${match.winner === 2 ? 'bg-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                {getInitials(match.player2_name)}
              </div>
              <h2 className="text-2xl font-black mb-4">{match.player2_name ?? 'TBD'}</h2>
              <p className="text-7xl font-black">{match.score2 ?? 0}</p>
              {match.winner === 2 && <p className="mt-4 text-lg font-bold">THẮNG</p>}
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow border border-gray-200 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm text-slate-500">Người thắng</p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {match.winner === 1 ? match.player1_name : match.winner === 2 ? match.player2_name : 'Chưa xác định'}
            </p>
            {confirmMut.isError && (
              <p className="mt-3 text-sm text-red-600 font-semibold">
                Đồng bộ thất bại — thử lại hoặc kiểm tra kết nối local server
              </p>
            )}
            {confirmMut.isSuccess && (
              <p className="mt-3 text-sm text-emerald-600 font-semibold">
                Đã đồng bộ lên Railway thành công
              </p>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending || confirmMut.isSuccess}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
              >
                {confirmMut.isPending
                  ? <><Loader2 size={15} className="animate-spin" /> Đang đồng bộ...</>
                  : confirmMut.isSuccess
                  ? <><Trophy size={15} /> Đã đồng bộ</>
                  : <><Trophy size={15} /> Kết thúc & Đồng bộ</>
                }
              </button>
              <button
                onClick={() => window.open(`/display?match=${matchId}`, '_blank')}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                <ExternalLink size={15} /> Xem màn hình Display
              </button>
            </div>
            <div className="mt-3 flex gap-2 justify-center flex-wrap">
              <button
                onClick={() => setConfirmModal({ type: 'reset-all' })}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition"
              >
                <RotateCcw size={14} /> Reset toàn bộ trận đấu
              </button>
              <button
                onClick={() => setConfirmModal({ type: 'cancel-match' })}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
              >
                <X size={14} /> Hủy trận đấu
              </button>
            </div>
          </div>
        </div>
        {/* Modals — must be inside this early-return branch */}
        {confirmModal?.type === 'reset-all' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
              <p className="text-xl font-bold text-slate-900 mb-2">Reset tất cả?</p>
              <p className="text-slate-500 text-sm mb-6">Điểm số, thẻ vàng và đồng hồ sẽ về 0. Trận sẽ quay lại hiệp 1 (vẫn đang thi đấu).</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
                <button onClick={() => { resetMatchMut.mutate(); setConfirmModal(null) }}
                  disabled={resetMatchMut.isPending}
                  className="py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50">Xác nhận</button>
              </div>
            </div>
          </div>
        )}
        {confirmModal?.type === 'cancel-match' && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
              <p className="text-xl font-bold text-slate-900 mb-2">Hủy trận đấu?</p>
              <p className="text-slate-500 text-sm mb-6">Trận sẽ quay về trạng thái <strong>ready</strong>. Nếu trận đã kết thúc, kết quả người thắng ở trận tiếp theo sẽ bị xóa.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
                <button onClick={() => { cancelMatchMut.mutate(); setConfirmModal(null) }}
                  disabled={cancelMatchMut.isPending}
                  className="py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50">Xác nhận hủy</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Confirm modals ─────────────────────────────────────────────────────
  const confirmModalEl = confirmModal && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
        {confirmModal.type === 'reset-timer' && (
          <>
            <p className="text-xl font-bold text-slate-900 mb-2">Reset đồng hồ?</p>
            <p className="text-slate-500 text-sm mb-6">
              Đồng hồ sẽ về {formatTime(phase === 'break' ? breakDuration : roundDuration)} và dừng lại.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
              <button onClick={() => {
                setTimerSeconds(phase === 'break' ? breakDuration : roundDuration)
                setTimerRunning(false)
                broadcastTimerActive(false)
                setConfirmModal(null)
              }} className="py-3 rounded-xl bg-purple-500 text-white font-bold">Xác nhận</button>
            </div>
          </>
        )}
        {confirmModal.type === 'reset-all' && (
          <>
            <p className="text-xl font-bold text-slate-900 mb-2">Reset tất cả?</p>
            <p className="text-slate-500 text-sm mb-6">Điểm số, thẻ vàng và đồng hồ sẽ về 0. Trận sẽ quay lại hiệp 1 (vẫn đang thi đấu).</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
              <button onClick={() => { resetMatchMut.mutate(); setConfirmModal(null) }}
                disabled={resetMatchMut.isPending}
                className="py-3 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50">Xác nhận</button>
            </div>
          </>
        )}
        {confirmModal.type === 'end-round' && (
          <>
            <p className="text-xl font-bold text-slate-900 mb-2">Kết thúc {PHASE_LABEL[phase]}?</p>
            <p className="text-slate-500 text-sm mb-6">
              Điểm hiện tại: Đỏ {score1} — Xanh {score2}
              {phase === 'round_1' && '. Sẽ chuyển sang giải lao.'}
              {phase === 'round_2' && (score1 === score2 ? '. Hòa điểm → vào hiệp phụ.' : `. ${score1 > score2 ? 'Đỏ' : 'Xanh'} thắng.`)}
              {phase === 'extra_time' && (score1 === score2 ? '. Vẫn hòa → bốc thăm.' : `. ${score1 > score2 ? 'Đỏ' : 'Xanh'} thắng.`)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
              <button onClick={() => { endRoundMut.mutate(); setConfirmModal(null) }}
                disabled={endRoundMut.isPending}
                className="py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">Xác nhận</button>
            </div>
          </>
        )}
        {(confirmModal.type === 'knockout-red' || confirmModal.type === 'knockout-blue') && (
          <>
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-black ${confirmModal.type === 'knockout-red' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>KO</div>
            <p className="text-xl font-bold text-slate-900 mb-2">Knockout!</p>
            <p className="text-slate-500 text-sm mb-6">
              Xác nhận <strong>{confirmModal.type === 'knockout-red' ? 'Đỏ' : 'Xanh'}</strong> thắng Knockout?<br />
              <span className="text-slate-400">{confirmModal.type === 'knockout-red' ? match.player1_name : match.player2_name}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Huỷ</button>
              <button
                onClick={() => {
                  const w = confirmModal.type === 'knockout-red' ? 1 as const : 2 as const
                  knockoutMut.mutate(w)
                  setKnockoutWinner(confirmModal.type === 'knockout-red' ? 'red' : 'blue')
                  setConfirmModal(null)
                }}
                disabled={knockoutMut.isPending}
                className={`py-3 rounded-xl text-white font-bold disabled:opacity-50 ${confirmModal.type === 'knockout-red' ? 'bg-red-500' : 'bg-blue-500'}`}>
                Công bố thắng
              </button>
            </div>
          </>
        )}
        {confirmModal.type === 'cancel-match' && (
          <>
            <p className="text-xl font-bold text-slate-900 mb-2">Hủy trận đấu?</p>
            <p className="text-slate-500 text-sm mb-6">Trận sẽ quay về trạng thái <strong>ready</strong>. Kết quả và điểm số sẽ bị xóa.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmModal(null)} className="py-3 rounded-xl border border-gray-200 text-slate-700 font-semibold">Đóng</button>
              <button onClick={() => { cancelMatchMut.mutate(); setConfirmModal(null) }}
                disabled={cancelMatchMut.isPending}
                className="py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50">Xác nhận hủy</button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ── Main scoring view ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 p-4 md:p-6">
      {knockoutOverlay}
      {confirmModalEl}
      {/* Railway sync banner */}
      {syncingToRailway && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg">
          <Loader2 size={15} className="animate-spin" />
          Đang đồng bộ kết quả lên server...
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl space-y-4">

        {/* Top bar */}
        <div className="bg-white rounded-3xl px-6 py-4 shadow border border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/matches')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 transition">
                <ArrowLeft size={16} /> Quay lại
              </button>
              <div className="flex gap-2">
                <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full font-semibold text-sm">
                  {match.gender === 'M' ? 'Nam' : 'Nữ'}
                </span>
                <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full font-semibold text-sm">
                  {match.age_type_code}
                </span>
                <span className="bg-purple-100 text-purple-600 px-4 py-1.5 rounded-full font-semibold text-sm">
                  {match.weight_class_name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="border-2 border-gray-300 px-5 py-2 rounded-full shadow-sm">
                <p className="text-blue-600 font-bold text-base">
                  Trận Số {match.match_number}{match.court ? ` - Sàn ${match.court}` : ''}
                </p>
              </div>
              <button onClick={() => window.open(`/display?match=${matchId}`, '_blank')}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition">
                <Monitor size={15} /> Display
              </button>
              <button onClick={() => setConfirmModal({ type: 'cancel-match' })}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition">
                <X size={15} /> Hủy trận
              </button>
            </div>
          </div>
        </div>

        {/* Fighter + Timer row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Red fighter */}
          <div className="bg-white rounded-3xl p-6 shadow border border-gray-200 flex flex-col items-center">
            {/* Top: avatar + name */}
            <div className="flex items-center gap-3 mb-2">
              <div className="min-w-0 flex-1 text-right">
                <p className="text-red-700 font-semibold text-sm leading-tight truncate">{match.player1_name ?? 'TBD'}</p>
                {match.player1_club && (
                  <p className="text-orange-600 text-xs font-medium truncate">{match.player1_club}</p>
                )}
              </div>
              <div className="rounded-2xl w-14 h-14 border-2 border-red-200 shadow flex-shrink-0 overflow-hidden bg-red-100 flex items-center justify-center">
                {match.player1_avatar_url
                  ? <img src={match.player1_avatar_url} alt={match.player1_name ?? ''} className="w-full h-full object-cover" />
                  : <span className="text-red-600 text-2xl font-bold">{getInitials(match.player1_name)}</span>
                }
              </div>
            </div>
            {/* Center: score */}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-red-600 text-8xl font-black leading-none">{score1}</span>
            </div>
            {/* Yellow cards */}
            <div className="flex gap-1.5 justify-center mt-3 min-h-[28px] items-center flex-wrap">
              {Array.from({ length: yellowCards1 }).map((_, i) => (
                <div key={i} className="bg-yellow-400 w-5 h-7 rounded shadow" />
              ))}
            </div>
          </div>

          {/* Timer + status center card */}
          <div className="bg-white rounded-3xl p-6 shadow border border-gray-200 flex flex-col items-center justify-center">
            {/* Phase label */}
            <div className="flex items-center gap-2 mb-3">
              <Clock className="text-slate-500" size={18} />
              <span className="text-slate-600 text-sm uppercase tracking-wide font-semibold">
                {PHASE_LABEL[phase] ?? phase}
              </span>
            </div>

            {/* Timer display — hidden when finished (no countdown in this phase) */}
            {phase !== 'finished' && (
              <div className="text-slate-800 text-6xl font-black mb-4">{formatTime(timerSeconds)}</div>
            )}

            {/* Timer controls — shown in active rounds and break */}
            {(isActiveRound || phase === 'break') && (
              <>
                <div className="grid grid-cols-2 gap-2 w-full mb-2">
                  {phase === 'break' && breakState === 'idle' ? (
                    <button onClick={() => { setBreakState('running'); setTimerRunning(true); broadcastTimerActive(true) }}
                      className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white transition shadow">
                      <Play size={16} /> Bắt đầu giải lao
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { const next = !timerRunning; setTimerRunning(next); broadcastTimerActive(next) }}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow ${timerRunning ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                        {timerRunning ? <><Pause size={16} /> Dừng</> : <><Play size={16} /> Start</>}
                      </button>
                      <button onClick={() => setConfirmModal({ type: 'reset-timer' })}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-purple-500 hover:bg-purple-600 text-white transition shadow">
                        <RotateCcw size={16} /> Reset Timer
                      </button>
                    </>
                  )}
                </div>

                {/* Reset all — available in any active phase */}
                <div className="w-full mb-4">
                  <button onClick={() => setConfirmModal({ type: 'reset-all' })}
                    className="w-full px-4 py-2.5 rounded-xl font-semibold text-sm bg-orange-500 hover:bg-orange-600 text-white transition shadow">
                    Reset tất cả
                  </button>
                </div>
              </>
            )}

            {/* Draw pending */}
            {phase === 'draw_pending' && (
              <div className="w-full space-y-2 mb-4">
                <p className="text-center text-amber-600 font-bold text-sm mb-2">Hòa điểm — Bốc thăm chọn người thắng</p>
                {drawError && <p className="text-center text-red-600 text-xs font-semibold">{drawError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => drawMut.mutate(1)}
                    disabled={drawMut.isPending}
                    className="py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition disabled:opacity-50">
                    Đỏ thắng
                  </button>
                  <button onClick={() => drawMut.mutate(2)}
                    disabled={drawMut.isPending}
                    className="py-3 rounded-xl bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] text-white font-bold transition disabled:opacity-50">
                    Xanh thắng
                  </button>
                </div>
              </div>
            )}

            {/* Finished — show winner, no confirm needed (auto-completed) */}
            {phase === 'finished' && (
              <div className="w-full space-y-2 mb-4">
                <p className="text-center text-emerald-600 font-bold text-sm">
                  {match.winner === 1 ? 'Đỏ' : 'Xanh'} thắng: {score1} — {score2}
                </p>
              </div>
            )}

            {/* Duration config — only editable before match starts */}
            {phase === 'not_started' && role === 'admin' && (
              <div className="w-full rounded-2xl bg-blue-50 border border-blue-200 p-3 mb-2">
                <p className="text-xs font-bold text-blue-600 mb-2">Cài đặt thời gian</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-blue-500 block mb-1">Hiệp (giây)</label>
                    <input
                      type="number" min={30} max={600} step={10}
                      value={roundDuration}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v)) {
                          setRoundDuration(v)
                          setTimerSeconds(v)
                        }
                      }}
                      onBlur={() => {
                        const v = Math.max(1, roundDuration)
                        if (v !== roundDuration) setRoundDuration(v)
                        if (v !== match.round_duration_seconds) {
                          configMut.mutate({ round_duration_seconds: v })
                        }
                      }}
                      className="w-full border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-blue-500 block mb-1">Giải lao (giây)</label>
                    <input
                      type="number" min={10} max={300} step={5}
                      value={breakDuration}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v)) setBreakDuration(v)
                      }}
                      onBlur={() => {
                        const v = Math.max(1, breakDuration)
                        if (v !== breakDuration) setBreakDuration(v)
                        if (v !== match.break_duration_seconds) {
                          configMut.mutate({ break_duration_seconds: v })
                        }
                      }}
                      className="w-full border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
                {configMut.isSuccess && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">Đã lưu</p>
                )}
              </div>
            )}

            {/* Status block */}
            {!isOngoing && !isActiveRound && (
              <div className="w-full rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-xs font-semibold text-blue-600 mb-1">Trạng thái</p>
                <p className="text-blue-700 text-base font-bold">
                  {match.status === 'ready' ? 'Sẵn sàng bắt đầu' : 'Chờ setup trọng tài'}
                </p>
              </div>
            )}

            {/* Start match / Start round 1 (also shown after reset) */}
            {role === 'admin' && phase === 'not_started' && (
              <button
                onClick={() => {
                  if (match.status === 'ongoing') sendAdminCommand({ type: 'admin_cmd', cmd: 'begin' })
                  else startMut.mutate()
                }}
                disabled={startMut.isPending}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary,#1d4ed8)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-40 disabled:cursor-not-allowed transition">
                <Play size={16} />
                {match.status === 'ongoing' ? 'Bắt đầu Hiệp 1' : 'Bắt đầu'}
              </button>
            )}
            {startMut.isError && (
              <p className="mt-2 text-xs text-rose-600 text-center">
                {(startMut.error as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ?? 'Không thể bắt đầu trận đấu.'}
              </p>
            )}
          </div>

          {/* Blue fighter */}
          <div className="bg-white rounded-3xl p-6 shadow border border-gray-200 flex flex-col items-center">
            {/* Top: avatar + name */}
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-2xl w-14 h-14 border-2 border-blue-200 shadow flex-shrink-0 overflow-hidden bg-blue-100 flex items-center justify-center">
                {match.player2_avatar_url
                  ? <img src={match.player2_avatar_url} alt={match.player2_name ?? ''} className="w-full h-full object-cover" />
                  : <span className="text-blue-600 text-2xl font-bold">{getInitials(match.player2_name)}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="text-blue-700 font-semibold text-sm leading-tight truncate">{match.player2_name ?? 'TBD'}</p>
                {match.player2_club && (
                  <p className="text-orange-600 text-xs font-medium truncate">{match.player2_club}</p>
                )}
              </div>
            </div>
            {/* Center: score */}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-blue-600 text-8xl font-black leading-none">{score2}</span>
            </div>
            {/* Yellow cards */}
            <div className="flex gap-1.5 justify-center mt-3 min-h-[28px] items-center flex-wrap">
              {Array.from({ length: yellowCards2 }).map((_, i) => (
                <div key={i} className="bg-yellow-400 w-5 h-7 rounded shadow" />
              ))}
            </div>
          </div>
        </div>

        {/* Scoring buttons + result + log */}
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
          {/* Red scoring */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2].map((v) => (
                <button key={v} onClick={() => updateScore(1, v)} disabled={!canAdjustScore}
                  className="bg-red-500 hover:bg-red-600 active:scale-95 text-white py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                  +{v}
                </button>
              ))}
              <button onClick={() => updateScore(1, -1)} disabled={!canAdjustScore}
                className="bg-gray-300 hover:bg-gray-400 active:scale-95 text-slate-700 py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                -1
              </button>
              <button onClick={() => updateScore(1, -2)} disabled={!canAdjustScore}
                className="bg-gray-300 hover:bg-gray-400 active:scale-95 text-slate-700 py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                -2
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addYellowCard(1)} disabled={!canAdjustScore}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 py-2.5 rounded-xl font-bold text-sm transition shadow border-2 border-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed">
                + Thẻ Vàng
              </button>
              <button onClick={() => setConfirmModal({ type: 'knockout-red' })} disabled={!canAdjustScore}
                className="bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-sm transition shadow disabled:opacity-40 disabled:cursor-not-allowed">
                Knockout
              </button>
            </div>
          </div>

          {/* Center: Score log panel */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow flex flex-col max-h-[320px]">
            {/* Tab header */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              {(['score', 'no_consensus'] as const).map(tab => {
                const label = tab === 'score' ? 'Điểm số' : 'Không đồng thuận'
                const count = tab === 'no_consensus'
                  ? (turnsQ.data ?? []).filter(t => !t.is_consensus).length
                  : null
                return (
                  <button
                    key={tab}
                    onClick={() => setLogTab(tab)}
                    className={[
                      'flex-1 py-2 text-xs font-semibold transition-colors relative',
                      logTab === tab
                        ? 'text-[var(--color-primary,#1d4ed8)] border-b-2 border-[var(--color-primary,#1d4ed8)]'
                        : 'text-slate-400 hover:text-slate-600',
                    ].join(' ')}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-xs p-3">
              {logTab === 'score' ? (() => {
                type LogItem = { type: 'log'; data: MatchScoreLog } | { type: 'turn'; data: ConsensusTurn }
                const items: LogItem[] = [
                  ...(logsQ.data ?? []).filter(d => d.actor_type !== 'referee').map(d => ({ type: 'log' as const, data: d })),
                  ...(turnsQ.data ?? []).filter(t => t.is_consensus).map(d => ({ type: 'turn' as const, data: d })),
                ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())

                if (items.length === 0) return (
                  <p className="text-slate-400 text-center py-4">Chưa có điểm nào</p>
                )

                return items.map((item) => {
                  if (item.type === 'log') {
                    const log = item.data
                    return (
                      <div key={`log-${log.id}`} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                        <span className="text-slate-400 font-mono w-14 flex-shrink-0">
                          {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`font-semibold ${log.side === 1 ? 'text-red-600' : log.side === 2 ? 'text-blue-600' : 'text-slate-500'}`}>
                          {log.description ?? log.action}
                        </span>
                      </div>
                    )
                  }
                  const turn = item.data
                  const sideColor = turn.result_side === 'RED' ? 'text-red-600' : 'text-blue-600'
                  const judgesStr = turn.agreeing_slots ? turn.agreeing_slots.split(',').map(s => `GĐ${s}`).join(' ') : ''
                  const label = `${turn.result_delta != null && turn.result_delta > 0 ? '+' : ''}${turn.result_delta ?? ''} đồng thuận ${judgesStr}`.trim()
                  return (
                    <button key={`turn-${turn.id}`} onClick={() => setSelectedTurn(turn)}
                      className="w-full flex items-center gap-2 py-1 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded text-left">
                      <span className="text-slate-400 font-mono w-14 flex-shrink-0">
                        {new Date(turn.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`flex-1 font-semibold ${sideColor}`}>{label}</span>
                      <span className="text-slate-300 text-[10px]">▶</span>
                    </button>
                  )
                })
              })() : (() => {
                const noConItems = (turnsQ.data ?? [])
                  .filter(t => !t.is_consensus)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                if (noConItems.length === 0) return (
                  <p className="text-slate-400 text-center py-4">Không có lần nào</p>
                )

                return noConItems.map(turn => (
                  <button key={`nc-${turn.id}`} onClick={() => setSelectedTurn(turn)}
                    className="w-full flex items-center gap-2 py-1 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded text-left">
                    <span className="text-slate-400 font-mono w-14 flex-shrink-0">
                      {new Date(turn.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="flex-1 text-slate-400 italic">Không đồng thuận</span>
                    <span className="text-slate-300 text-[10px]">▶</span>
                  </button>
                ))
              })()}
            </div>
          </div>

          {/* Modal chi tiết turn đồng thuận */}
          {selectedTurn && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedTurn(null)}>
              <div className="bg-white rounded-2xl shadow-xl p-5 w-80 max-w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-sm text-slate-700">
                    {selectedTurn.is_consensus ? (
                      <span className={selectedTurn.result_side === 'RED' ? 'text-red-600' : 'text-blue-600'}>
                        Đồng thuận — {selectedTurn.result_side === 'RED' ? 'Đỏ' : 'Xanh'} {selectedTurn.result_type}
                      </span>
                    ) : (
                      <span className="text-slate-500">Không đồng thuận</span>
                    )}
                  </p>
                  <button onClick={() => setSelectedTurn(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="space-y-2 text-xs">
                  {/* Group votes by judge_slot */}
                  {Array.from(new Set(selectedTurn.votes.map(v => v.judge_slot))).sort().map(slot => {
                    const presses = selectedTurn.votes
                      .filter(v => v.judge_slot === slot)
                      .sort((a, b) => a.press_order - b.press_order)
                    return (
                      <div key={slot} className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
                        <span className="font-semibold text-slate-600 w-10 flex-shrink-0">GĐ {slot}</span>
                        <div className="flex flex-wrap gap-1">
                          {presses.map((p, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded font-bold ${
                              p.player_side === 'RED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {p.score_type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {selectedTurn.votes.length === 0 && (
                    <p className="text-slate-400 text-center py-2">Không có dữ liệu</p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                  {new Date(selectedTurn.created_at).toLocaleString('vi-VN')}
                  {selectedTurn.match_phase ? ` · ${selectedTurn.match_phase}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Blue scoring */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2].map((v) => (
                <button key={v} onClick={() => updateScore(2, v)} disabled={!canAdjustScore}
                  className="bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] active:scale-95 text-white py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                  +{v}
                </button>
              ))}
              <button onClick={() => updateScore(2, -1)} disabled={!canAdjustScore}
                className="bg-gray-300 hover:bg-gray-400 active:scale-95 text-slate-700 py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                -1
              </button>
              <button onClick={() => updateScore(2, -2)} disabled={!canAdjustScore}
                className="bg-gray-300 hover:bg-gray-400 active:scale-95 text-slate-700 py-7 rounded-2xl font-black text-3xl transition shadow-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                -2
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addYellowCard(2)} disabled={!canAdjustScore}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 py-2.5 rounded-xl font-bold text-sm transition shadow border-2 border-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed">
                + Thẻ Vàng
              </button>
              <button onClick={() => setConfirmModal({ type: 'knockout-blue' })} disabled={!canAdjustScore}
                className="bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold text-sm transition shadow disabled:opacity-40 disabled:cursor-not-allowed">
                Knockout
              </button>
            </div>
          </div>
        </div>

        {/* Judge cards row */}
        <div className="bg-white rounded-3xl p-5 shadow border border-gray-200">
          <div className="grid grid-cols-5 gap-3">
            {match.judges.map((judge) => (
              <div key={judge.judge_slot} className={`rounded-2xl border-2 p-3 flex flex-col gap-2 transition ${judge.assigned_user_id ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <p className="text-blue-600 font-semibold text-xs">Ghế {judge.judge_slot}</p>
                  <p className={`text-xs font-semibold ${judge.assigned_user_id ? 'text-green-600' : 'text-gray-400'}`}>
                    {judge.assigned_user_id ? 'Sẵn sàng' : 'Chưa gán'}
                  </p>
                </div>
                <p className="text-orange-600 font-bold text-xs text-center truncate">{judge.assigned_user_name ?? 'Chưa gán'}</p>
                {(judge as any).has_submitted && (
                  <div className="text-center">
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Đã xác nhận</span>
                  </div>
                )}
                <button
                  onClick={() => window.open(`/matches/${matchId}/judge-panel`, '_blank')}
                  className="mt-auto w-full py-1.5 rounded-xl bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] text-white text-xs font-bold transition">
                  Chấm
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
