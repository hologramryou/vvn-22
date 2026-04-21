import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getQuyenSlotDisplay, getMatchDetail, getScheduleLocal, getSchedule, getMatchConsensusTurns, getMatchScoreLogs } from '../api/tournaments'
import { TreePathPills } from '../components/ui'
import { useMatchScoringWS } from '../hooks/useMatchScoringWS'
import { useTournament } from '../context/TournamentContext'
import type { JudgeActivity, MatchDetail, PendingSlot, ScheduleBracketMatch, QuyenSlot, ConsensusTurn, MatchScoreLog } from '../types/tournament'

// ── Quyen helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ trọng tài sẵn sàng',
  ready: 'Sẵn sàng',
  checking: 'Chờ trọng tài sẵn sàng',
  ongoing: 'Đang thi',
  scoring: 'Đang chấm',
  completed: 'Đã xác nhận',
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? '?'
}

function getRemainingSeconds(startedAt: string | null, duration: number, now: number): number {
  if (!startedAt) return duration
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000)
  return Math.max(0, duration - elapsed)
}

function formatSeconds(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function formatOfficialScore(score: number | null | undefined): string {
  if (score == null) return '--'
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

function formatJudgeScore(score: number | null | undefined): string {
  if (score == null) return ''
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

function getStatusTone(status: string): { dot: string; text: string } {
  switch (status) {
    case 'completed':
      return { dot: 'bg-emerald-500', text: 'text-[#1D4ED8]' }
    case 'ongoing':
      return { dot: 'bg-amber-500', text: 'text-[#C2410C]' }
    case 'scoring':
      return { dot: 'bg-sky-500', text: 'text-[#1D4ED8]' }
    case 'ready':
      return { dot: 'bg-blue-500', text: 'text-[#1D4ED8]' }
    case 'checking':
      return { dot: 'bg-amber-500', text: 'text-[#C2410C]' }
    default:
      return { dot: 'bg-slate-400', text: 'text-slate-600' }
  }
}


// ── Match Display ──────────────────────────────────────────────────────────

const MATCH_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Chờ bắt đầu',        cls: 'bg-slate-100 text-slate-600' },
  ready:     { label: 'Sẵn sàng',            cls: 'bg-blue-100 text-blue-700' },
  checking:  { label: 'Trọng tài xác nhận',  cls: 'bg-amber-100 text-amber-700' },
  ongoing:   { label: 'Đang đấu',            cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Kết thúc',            cls: 'bg-slate-100 text-slate-600' },
}

const PHASE_LABEL: Record<string, { label: string; cls: string }> = {
  not_started:   { label: 'Chờ bắt đầu',     cls: 'bg-slate-100 text-slate-600' },
  round_1:       { label: 'Hiệp 1',          cls: 'bg-green-100 text-green-700' },
  break:         { label: 'GIẢI LAO',         cls: 'bg-amber-100 text-amber-700' },
  round_2:       { label: 'Hiệp 2',          cls: 'bg-green-100 text-green-700' },
  extra_time:    { label: 'Hiệp Phụ',        cls: 'bg-purple-100 text-purple-700' },
  draw_pending:  { label: 'Chờ bốc thăm',    cls: 'bg-orange-100 text-orange-700' },
  finished:      { label: 'Kết thúc',          cls: 'bg-emerald-100 text-emerald-700' },
  confirmed:     { label: 'Kết thúc',         cls: 'bg-slate-100 text-slate-600' },
}

// ── JudgeCircle: flash-fade on first press, solid on subsequent presses ────
const CIRCLE_STYLE = `
  @keyframes circle-flash-fade {
    0%   { opacity: 1; transform: scale(1.15); }
    30%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0.25; transform: scale(1); }
  }
  .circle-flash-fade { animation: circle-flash-fade 1s ease-out forwards; }
`

function JudgeCircle({ count, color, label }: { count: number; color: string; label: string }) {
  // Track animation key so re-pressing resets the animation
  const [flashKey, setFlashKey] = useState(0)
  const prevCount = useRef(0)

  useEffect(() => {
    if (count > prevCount.current) setFlashKey(k => k + 1)
    prevCount.current = count
  }, [count])

  const baseClass = `w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shadow-md`

  if (count === 0) {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-slate-300">{label}</span>
      </div>
    )
  }
  if (count === 1) {
    // First press: flash then fade
    return (
      <div key={flashKey} className={`${baseClass} circle-flash-fade flex-shrink-0`} style={{ backgroundColor: color }}>
        {label}
      </div>
    )
  }
  // 2+ presses: solid, no animation
  return (
    <div className={`${baseClass} flex-shrink-0`} style={{ backgroundColor: color }}>
      {label}
    </div>
  )
}


function countAttacks(inputs: JudgeActivity[], side: 'RED' | 'BLUE'): number {
  return inputs
    .filter(a => a.playerSide === side)
    .reduce((s, a) => s + a.pressDeltas.reduce((sum, d) => sum + Math.abs(d), 0), 0)
}

function getTurnSide(turn: ConsensusTurn): 'RED' | 'BLUE' | null {
  if (turn.result_side === 'RED' || turn.result_side === 'BLUE') return turn.result_side
  // For non-consensus turns without result_side, use majority vote
  const counts: Record<string, number> = {}
  for (const v of turn.votes) {
    counts[v.player_side] = (counts[v.player_side] ?? 0) + 1
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0] as 'RED' | 'BLUE'
}

function computeAttacksFromTurns(turns: ConsensusTurn[]): { red: number; blue: number } {
  let red = 0, blue = 0
  for (const t of turns) {
    const side = getTurnSide(t)
    if (!side) continue
    const weight = 1
    if (side === 'RED') red += weight
    else blue += weight
  }
  return { red, blue }
}

function MatchDisplayView({ match }: { match: MatchDetail }) {
  const qc = useQueryClient()
  const matchKey = ['display-match', String(match.id)]

  // Patch the parent's React Query cache — WS updates score/phase immediately;
  // REST polling (every 3s) also writes to same cache as fallback.
  // This eliminates frozen broadcastScore state when WS is temporarily disconnected.
  const patchDisplay = (patch: Partial<MatchDetail>) =>
    qc.setQueryData<MatchDetail>(matchKey, (old) => old ? { ...old, ...patch } : old)

  const isCompleted = match.status === 'completed'
  const winner = match.winner

  const [timerSeconds, setTimerSeconds] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([])
  const [judgeInputs, setJudgeInputs] = useState<JudgeActivity[]>([])
  const [yellowCards1, setYellowCards1] = useState<number>(0)
  const [yellowCards2, setYellowCards2] = useState<number>(0)
  // Attack counts from ConsensusTurns + admin ScoreLogs REST
  const turnsQ = useQuery<ConsensusTurn[]>({
    queryKey: ['display-turns', match.id],
    queryFn: () => getMatchConsensusTurns(match.id),
    refetchInterval: isCompleted ? false : 3000,
  })
  const logsQ = useQuery<MatchScoreLog[]>({
    queryKey: ['display-score-logs', match.id],
    queryFn: () => getMatchScoreLogs(match.id),
    refetchInterval: isCompleted ? false : 3000,
  })
  const turnsAttacks = useMemo(
    () => turnsQ.data ? computeAttacksFromTurns(turnsQ.data) : { red: 0, blue: 0 },
    [turnsQ.data],
  )
  const logsAttacks = useMemo(() => {
    const logs = (logsQ.data ?? []).filter(l => l.side != null && l.delta != null && l.actor_type !== 'referee')
    return {
      red: logs.filter(l => l.side === 1).length,
      blue: logs.filter(l => l.side === 2).length,
    }
  }, [logsQ.data])
  const attackCount1 = turnsAttacks.red + logsAttacks.red
  const attackCount2 = turnsAttacks.blue + logsAttacks.blue
  // Throttle score_update — display updates at most once per 1s
  const lastScoreUpdateRef = useRef<number>(0)

  useEffect(() => {
    const ch = new BroadcastChannel(`match-timer-${match.id}`)
    ch.onmessage = (e: MessageEvent<{ timerSeconds: number; timerRunning: boolean; matchPhase?: string; score1?: number; score2?: number }>) => {
      const INACTIVE_PHASES = ['not_started', 'break', 'draw_pending', 'finished', 'confirmed']
      const phase = e.data.matchPhase
      const effectiveRunning = phase && INACTIVE_PHASES.includes(phase) ? false : e.data.timerRunning
      setTimerSeconds(e.data.timerSeconds)
      setTimerRunning(effectiveRunning)
      if (phase) patchDisplay({ match_phase: phase as MatchDetail['match_phase'] })
      // Score from BroadcastChannel only updates if WS hasn't already set a live value
      if (e.data.score1 !== undefined) patchDisplay({ score1: e.data.score1 })
      if (e.data.score2 !== undefined) patchDisplay({ score2: e.data.score2 })
    }
    return () => ch.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  // WS: realtime cross-device score updates.
  // Anonymous connections (no auth token) are allowed as spectators — backend accepts them.
  const { connected: wsConnected } = useMatchScoringWS({
    matchId: match.id,
    enabled: match.status !== 'completed',
    onScoreUpdate: (s1, s2) => {
      const now = Date.now()
      if (now - lastScoreUpdateRef.current < 1000) return
      lastScoreUpdateRef.current = now
      patchDisplay({ score1: s1, score2: s2 })
      // Refetch attack data immediately so bar doesn't dip before next poll
      qc.invalidateQueries({ queryKey: ['display-turns', match.id] })
      qc.invalidateQueries({ queryKey: ['display-score-logs', match.id] })
      setPendingSlots([])
      setJudgeInputs([])
    },
    onSnapshot: (s1, s2, state) => {
      patchDisplay({
        score1: s1,
        score2: s2,
        ...(state?.match_phase ? { match_phase: state.match_phase as MatchDetail['match_phase'] } : {}),
        ...(state?.status ? { status: state.status as MatchDetail['status'] } : {}),
        ...(state?.timer_active !== undefined ? { timer_active: state.timer_active } : {}),
      })
    },
    onPendingUpdate: (pending, inputs) => {
      setPendingSlots(pending)
      setJudgeInputs(inputs)
    },
    onMatchState: (state) => {
      patchDisplay({
        score1: state.score1,
        score2: state.score2,
        match_phase: state.match_phase as MatchDetail['match_phase'],
        status: state.status as MatchDetail['status'],
        timer_active: state.timer_active,
        ...(state.winner !== undefined ? { winner: state.winner } : {}),
      })
      if (state.yellow_cards1 != null) setYellowCards1(state.yellow_cards1)
      if (state.yellow_cards2 != null) setYellowCards2(state.yellow_cards2)
    },
  })

  // Score and phase come directly from match (updated by WS via patchDisplay + REST polling)
  const displayScore1 = match.score1 ?? 0
  const displayScore2 = match.score2 ?? 0

  // Pending deltas accumulating in current scoring window
  const pendingRed = pendingSlots
    .filter((p) => p.playerSide === 'RED' && p.judgeCount >= 1)
    .reduce((acc, p) => {
      const delta = p.scoreType === '+1' ? 1 : p.scoreType === '+2' ? 2 : -1
      return acc + delta
    }, 0)
  const pendingBlue = pendingSlots
    .filter((p) => p.playerSide === 'BLUE' && p.judgeCount >= 1)
    .reduce((acc, p) => {
      const delta = p.scoreType === '+1' ? 1 : p.scoreType === '+2' ? 2 : -1
      return acc + delta
    }, 0)

  const currentPhase = match.match_phase ?? 'not_started'
  const isBreak = currentPhase === 'break'
  const isDrawPending = currentPhase === 'draw_pending'
  const isFinished = currentPhase === 'finished'
  const ACTIVE_PHASES = ['round_1', 'round_2', 'extra_time']
  const isPaused = ACTIVE_PHASES.includes(currentPhase) && !match.timer_active

  const genderLabel = match.gender === 'M' ? 'Nam' : match.gender === 'F' ? 'Nữ' : ''
  const categoryLine = [genderLabel, match.age_type_code, match.weight_class_name].filter(Boolean).join(' · ')
  const categoryPills = [
    genderLabel ? { label: genderLabel, cls: 'bg-blue-100 text-blue-700' } : null,
    match.age_type_code ? { label: match.age_type_code, cls: 'bg-green-100 text-green-700' } : null,
    match.weight_class_name ? { label: match.weight_class_name, cls: 'bg-purple-100 text-purple-700' } : null,
  ].filter(Boolean) as { label: string; cls: string }[]

  const redDimmed = isCompleted && winner === 2
  const blueDimmed = isCompleted && winner === 1
  const redWins = isCompleted && winner === 1
  const blueWins = isCompleted && winner === 2

  const totalAttacks = attackCount1 + attackCount2
  const redPct = totalAttacks > 0 ? Math.round((attackCount1 / totalAttacks) * 100) : 50
  const bluePct = 100 - redPct

  // Use phase label when match is ongoing, otherwise fall back to status label
  const phaseCfg = PHASE_LABEL[currentPhase]
  const statusCfg = phaseCfg ?? MATCH_STATUS_LABEL[match.status] ?? { label: match.status, cls: 'bg-slate-100 text-slate-600' }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F3F7FF] flex flex-col select-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{CIRCLE_STYLE}</style>

      {/* Header */}
      <div className="bg-white border-b border-[#D9E6FF] px-8 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Left: category pills */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <span className="text-sm font-black text-[var(--color-primary,#1d4ed8)] tracking-widest uppercase shrink-0">Đối Kháng</span>
            {categoryPills.map((p) => (
              <span key={p.label} className={`text-sm font-bold px-3 py-1.5 rounded-full shrink-0 ${p.cls}`}>
                {p.label}
              </span>
            ))}
          </div>

          {/* Center: phase + timer + live */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Phase badge */}
            <div className={`text-sm font-bold px-4 py-1.5 rounded-full ${statusCfg.cls}`}>
              {statusCfg.label}
            </div>
            {/* Timer — prominent for audience */}
            {isBreak ? (
              <span className={`text-5xl font-black tabular-nums tracking-[-0.05em] leading-none ${timerRunning ? 'text-amber-500' : 'text-slate-400'}`}>
                {timerSeconds !== null ? formatSeconds(timerSeconds) : '--:--'}
              </span>
            ) : isDrawPending ? null : isFinished || currentPhase === 'confirmed' ? (
              winner ? (
                <span className={`text-sm font-black px-4 py-1.5 rounded-full ${winner === 1 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {winner === 1 ? match.player1_name : match.player2_name} thắng
                </span>
              ) : (
                <span className="text-sm font-bold px-4 py-1.5 rounded-full bg-slate-100 text-slate-500">Hoà</span>
              )
            ) : timerSeconds !== null ? (
              <span className={`text-5xl font-black tabular-nums tracking-[-0.05em] leading-none ${timerRunning ? 'text-[var(--color-primary,#1d4ed8)]' : 'text-slate-400'}`}>
                {formatSeconds(timerSeconds)}
              </span>
            ) : null}
            {/* Live / Paused indicator */}
            {isPaused ? (
              <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 text-amber-700 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> Tạm dừng
              </span>
            ) : wsConnected && !isCompleted ? (
              <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 text-green-700 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" /> LIVE
              </span>
            ) : null}
          </div>

          {/* Right: match number */}
          <div className="flex items-center flex-1 justify-end">
            <span className="bg-[var(--color-primary,#1d4ed8)] text-white text-sm font-bold px-4 py-1.5 rounded-full tracking-wide whitespace-nowrap">
              Trận {match.match_number}{match.court ? ` · Sân ${match.court}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Main grid: [judge-left] [red-card] [blue-card] [judge-right] / bar row */}
      <div className="flex-1 grid gap-3 p-4 min-h-0" style={{ gridTemplateColumns: 'auto 1fr 1fr auto', gridTemplateRows: '1fr auto' }}>

        {/* Col 1 / Row 1 — Red judge strip */}
        <div className="bg-white rounded-2xl border border-[#D9E6FF] shadow-sm px-3 py-2 flex flex-col gap-1.5 justify-center">
          {match.judges.map((j) => {
            const activity = judgeInputs.find(a => a.judgeSlot === j.judge_slot && a.playerSide === 'RED')
            const count1 = activity?.pressDeltas.filter(d => d === 1).length ?? 0
            const count2 = activity?.pressDeltas.filter(d => d === 2).length ?? 0
            return (
              <div key={j.judge_slot} className="flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap flex-shrink-0 ${
                  j.has_submitted ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : j.is_ready ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>GĐ {j.judge_slot}</div>
                <JudgeCircle count={count1} color="#ef4444" label="1" />
                <JudgeCircle count={count2} color="#dc2626" label="2" />
              </div>
            )
          })}
        </div>

        {/* Col 2 / Row 1 — Red fighter card */}
        <div className={`bg-red-500 rounded-3xl flex flex-col p-6 transition-all duration-500 min-h-0 relative ${redDimmed ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-3 shrink-0">
            <div className="min-w-0 flex-1">
              <p className="text-white text-2xl lg:text-3xl xl:text-4xl font-black leading-tight pb-1 truncate">
                {match.player1_name ?? 'TBD'}
              </p>
              <p className="text-orange-200 text-xs lg:text-sm font-medium truncate mt-0.5">{match.player1_club ?? '—'}</p>
            </div>
            <div className="rounded-2xl w-20 h-20 border-2 border-red-300 shadow flex-shrink-0 overflow-hidden bg-red-400 flex items-center justify-center">
              {match.player1_avatar_url
                ? <img src={match.player1_avatar_url} alt={match.player1_name ?? ''} className="w-full h-full object-cover" />
                : <span className="text-white text-3xl font-black">{getInitials(match.player1_name)}</span>
              }
            </div>
          </div>
          {redWins && (
            <div className="mt-2 self-start bg-white text-red-500 text-sm font-black px-5 py-1.5 rounded-full uppercase tracking-widest">Thắng</div>
          )}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-white text-[9rem] lg:text-[12rem] xl:text-[14rem] font-black leading-none">{displayScore1}</div>
            {yellowCards1 > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: yellowCards1 }).map((_, i) => (
                  <span key={i}>
                    <span className="text-2xl lg:text-3xl">🟨</span>
                    {(i + 1) % 3 === 0 && i + 1 < yellowCards1 && <span className="text-white font-black text-xl mx-1">-</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Col 3 / Row 1 — Blue fighter card */}
        <div className={`bg-blue-500 rounded-3xl flex flex-col p-6 transition-all duration-500 min-h-0 relative ${blueDimmed ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-2xl w-20 h-20 border-2 border-blue-300 shadow flex-shrink-0 overflow-hidden bg-blue-400 flex items-center justify-center">
              {match.player2_avatar_url
                ? <img src={match.player2_avatar_url} alt={match.player2_name ?? ''} className="w-full h-full object-cover" />
                : <span className="text-white text-3xl font-black">{getInitials(match.player2_name)}</span>
              }
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-white text-2xl lg:text-3xl xl:text-4xl font-black leading-tight pb-1 truncate">
                {match.player2_name ?? 'TBD'}
              </p>
              <p className="text-orange-200 text-xs lg:text-sm font-medium truncate mt-0.5">{match.player2_club ?? '—'}</p>
            </div>
          </div>
          {blueWins && (
            <div className="mt-2 self-end bg-white text-blue-500 text-sm font-black px-5 py-1.5 rounded-full uppercase tracking-widest">Thắng</div>
          )}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-white text-[9rem] lg:text-[12rem] xl:text-[14rem] font-black leading-none">{displayScore2}</div>
            {yellowCards2 > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: yellowCards2 }).map((_, i) => (
                  <span key={i}>
                    <span className="text-2xl lg:text-3xl">🟨</span>
                    {(i + 1) % 3 === 0 && i + 1 < yellowCards2 && <span className="text-white font-black text-xl mx-1">-</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Col 4 / Row 1 — Blue judge strip */}
        <div className="bg-white rounded-2xl border border-[#D9E6FF] shadow-sm px-3 py-2 flex flex-col gap-1.5 justify-center">
          {match.judges.map((j) => {
            const activity = judgeInputs.find(a => a.judgeSlot === j.judge_slot && a.playerSide === 'BLUE')
            const count1 = activity?.pressDeltas.filter(d => d === 1).length ?? 0
            const count2 = activity?.pressDeltas.filter(d => d === 2).length ?? 0
            return (
              <div key={j.judge_slot} className="flex items-center justify-end gap-2">
                <JudgeCircle count={count2} color="#2563eb" label="2" />
                <JudgeCircle count={count1} color="#3b82f6" label="1" />
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap flex-shrink-0 ${
                  j.has_submitted ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : j.is_ready ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>GĐ {j.judge_slot}</div>
              </div>
            )
          })}
        </div>

        {/* Row 2 — full width white card, colored bar inside aligned to cols 2-3 */}
        <div className="bg-white/80 rounded-2xl border border-[#D9E6FF] overflow-hidden grid"
          style={{ gridColumn: '1 / 5', gridRow: 2, gridTemplateColumns: 'subgrid' }}>
          {/* Numbers row — col 2-3 only */}
          <div className="flex items-center justify-between px-4 pt-2" style={{ gridColumn: '2 / 4' }}>
            <span className="text-red-500 font-black text-2xl tabular-nums">{attackCount1}</span>
            <span className="text-orange-600 tracking-widest uppercase text-[10px] font-bold">Tỉ lệ giao đấu</span>
            <span className="text-blue-500 font-black text-2xl tabular-nums">{attackCount2}</span>
          </div>
          {/* Colored bar — col 2-3 only */}
          <div className="flex h-4 mt-1.5 rounded-full overflow-hidden" style={{ gridColumn: '2 / 4' }}>
            <div className="bg-red-500 h-full transition-all duration-500 ease-out" style={{ width: `${redPct}%` }} />
            <div className="bg-blue-500 h-full flex-1 transition-all duration-500 ease-out" />
          </div>
          {/* Percent row — col 2-3 only */}
          <div className="flex items-center justify-between px-4 pb-2 pt-1 text-xs font-semibold" style={{ gridColumn: '2 / 4' }}>
            <span className="text-red-400">{redPct}%</span>
            <span className="text-blue-400">{bluePct}%</span>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── LiveSelector ───────────────────────────────────────────────────────────


function MatchCard({ m, onClick }: { m: ScheduleBracketMatch; onClick: () => void }) {
  const isLive = m.status === 'ongoing'
  const pathParts = m.node_path?.split('>').map(s => s.trim()).filter(Boolean) ?? []

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4 flex flex-col gap-3 group"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {pathParts.map((seg, i) => (
            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{seg}</span>
          ))}
          {m.court && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Sân {m.court}</span>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isLive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          {isLive ? 'Đang đấu' : 'Sẵn sàng'}
        </span>
      </div>

      {/* Players */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <p className="font-bold text-sm text-red-700 truncate">{m.player1_name ?? 'TBD'}</p>
          <p className="text-[10px] text-gray-400 truncate">{m.player1_club ?? ''}</p>
        </div>
        <div className="text-center">
          {isLive ? (
            <p className="text-xl font-black text-gray-800">
              {m.score1 ?? 0} <span className="text-gray-400 font-normal">–</span> {m.score2 ?? 0}
            </p>
          ) : (
            <p className="text-xs text-gray-400 font-medium">VS</p>
          )}
        </div>
        <div className="text-center">
          <p className="font-bold text-sm text-blue-700 truncate">{m.player2_name ?? 'TBD'}</p>
          <p className="text-[10px] text-gray-400 truncate">{m.player2_club ?? ''}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>{m.round_label} · #{m.match_number}</span>
        <span className="text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Mở Display →
        </span>
      </div>
    </button>
  )
}

function QuyenCard({ s, onClick }: { s: QuyenSlot; onClick: () => void }) {
  const isLive = s.status === 'ongoing'
  const pathParts = s.node_path?.split('>').map(p => p.trim()).filter(Boolean) ?? []

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-purple-300 transition-all p-4 flex flex-col gap-3 group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {pathParts.map((seg, i) => (
            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{seg}</span>
          ))}
          {s.content_name && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">{s.content_name}</span>
          )}
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isLive ? 'bg-purple-100 text-purple-700' :
          s.status === 'scoring' ? 'bg-sky-100 text-sky-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
          {STATUS_LABEL[s.status] ?? s.status}
        </span>
      </div>

      <div className="text-center py-1">
        <p className="font-bold text-base text-gray-800">{s.player_name}</p>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>Quyền</span>
        <span className="text-purple-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Mở Display →
        </span>
      </div>
    </button>
  )
}

function LiveSelector() {
  const { selectedTournament } = useTournament()

  // Bracket matches: local server có live score thực tế
  const localScheduleQ = useQuery({
    queryKey: ['display-schedule-local', selectedTournament?.id],
    queryFn: () => getScheduleLocal(selectedTournament!.id),
    enabled: !!selectedTournament?.id,
    refetchInterval: 5000,
  })

  // Quyen slots: chạy trên cloud API
  const cloudScheduleQ = useQuery({
    queryKey: ['display-schedule-cloud', selectedTournament?.id],
    queryFn: () => getSchedule(selectedTournament!.id),
    enabled: !!selectedTournament?.id,
    refetchInterval: 5000,
  })

  const liveMatches = useMemo(() =>
    (localScheduleQ.data?.bracket_matches ?? []).filter(m => m.status === 'ongoing' && !m.is_bye),
    [localScheduleQ.data]
  )
  const liveQuyen = useMemo(() =>
    (cloudScheduleQ.data?.quyen_slots ?? []).filter(s => s.status === 'ongoing' || s.status === 'scoring'),
    [cloudScheduleQ.data]
  )
  const total = liveMatches.length + liveQuyen.length
  const isLoading = localScheduleQ.isLoading && cloudScheduleQ.isLoading
  const isFetching = localScheduleQ.isFetching || cloudScheduleQ.isFetching

  return (
    <div className="h-screen bg-[#F3F7FF] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Display</p>
          <h1 className="text-lg font-black text-gray-900 mt-0.5">
            {selectedTournament?.name ?? 'Chưa chọn giải đấu'}
          </h1>
        </div>
        {isFetching && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            Đang cập nhật...
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full">
        {!selectedTournament ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-lg font-bold text-gray-700">Chưa chọn giải đấu</p>
            <p className="text-sm text-gray-400 mt-1">Chọn giải đấu ở thanh điều hướng để xem trận đang diễn ra.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-gray-400">
            <span className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            Đang tải lịch thi đấu...
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-lg font-bold text-gray-700">Chưa có trận nào đang diễn ra</p>
            <p className="text-sm text-gray-400 mt-1">Trang sẽ tự cập nhật khi có trận bắt đầu.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {liveMatches.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Đối kháng đang diễn ra ({liveMatches.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveMatches.map(m => (
                    <MatchCard key={m.id} m={m} onClick={() => window.open(`/display?match=${m.id}`, '_blank')} />
                  ))}
                </div>
              </section>
            )}

            {liveQuyen.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Quyền đang diễn ra ({liveQuyen.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveQuyen.map(s => (
                    <QuyenCard key={s.id} s={s} onClick={() => window.open(`/display?slotId=${s.id}&mode=quyen`, '_blank')} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main DisplayPage ───────────────────────────────────────────────────────

export const DisplayPage = () => {
  const [searchParams] = useSearchParams()
  const slotId = searchParams.get('slotId')
  const mode = searchParams.get('mode')
  const matchId = searchParams.get('match')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    // `now` is only consumed by the Quyen countdown below — don't burn a 1s re-render
    // on the whole page (including <MatchDisplayView />) when we're in match mode.
    if (mode !== 'quyen') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [mode])

  // Quyen query
  const detailQ = useQuery({
    queryKey: ['display-quyen-slot', slotId],
    queryFn: () => getQuyenSlotDisplay(Number(slotId)),
    enabled: mode === 'quyen' && !!slotId,
    refetchInterval: 2000,
  })

  // Local API for fast initial load. WS handles all realtime score/phase updates.
  const matchQ = useQuery({
    queryKey: ['display-match', matchId],
    queryFn: () => getMatchDetail(Number(matchId)),
    enabled: !!matchId,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Cloud fetch: (1) enrich club names, (2) fallback if local 404
  const qc = useQueryClient()
  const cloudMatchQ = useQuery({
    queryKey: ['display-match-cloud', matchId],
    queryFn: async () => {
      const data = await getMatchDetailCloud(Number(matchId))
      // Always patch club names into local cache
      if (data.player1_club || data.player2_club) {
        qc.setQueryData<MatchDetail>(['display-match', matchId], (old) =>
          old ? { ...old, player1_club: data.player1_club, player2_club: data.player2_club } : old
        )
      }
      // If local returned no data, seed the cache with cloud data
      const localData = qc.getQueryData<MatchDetail>(['display-match', matchId])
      if (!localData) {
        qc.setQueryData<MatchDetail>(['display-match', matchId], data)
      }
      return data
    },
    enabled: !!matchId,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  })

  // ── Match display branch ──
  if (matchId) {
    const isLoading = (matchQ.isLoading || matchQ.isError) && cloudMatchQ.isLoading
    const matchData = matchQ.data ?? cloudMatchQ.data
    if (isLoading || !matchData) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F3F7FF]">
          <p className="text-2xl font-semibold text-[var(--color-primary-dark,#1e3a5f)]">Đang tải...</p>
        </div>
      )
    }
    return <MatchDisplayView match={matchData} />
  }

  // ── Quyen display branch ──
  const detail = detailQ.data
  const slot = detail?.slot
  const remaining = useMemo(() => (
    slot ? getRemainingSeconds(slot.started_at, slot.performance_duration_seconds, now) : 0
  ), [slot, now])

  // ── Selector screen: no match/slotId params ──
  if (!matchId && (mode !== 'quyen' || !slotId)) {
    return <LiveSelector />
  }

  if (detailQ.isLoading || !slot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F7FF] font-sans text-gray-900">
        <p className="text-2xl font-semibold">Đang tải màn hình công khai...</p>
      </div>
    )
  }

  const revealed = slot.status === 'completed'
  const statusTone = getStatusTone(slot.status)

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F3F7FF] flex items-center justify-center" style={{
      fontFamily: 'system-ui, -apple-system, sans-serif !important',
      '--tw-font-family':  'system-ui, -apple-system, sans-serif !important'
    } as any}>
      <div className="bg-[#F3F7FF] text-gray-900 overflow-hidden flex flex-col w-full h-full">
      <div className="flex w-full flex-col gap-1.5 p-2 flex-1 overflow-hidden" style={{minHeight: 0}}>
        <header className="grid gap-1.5 lg:grid-cols-[auto_1.2fr] lg:items-stretch">
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/95 p-3 sm:p-4 shadow-sm flex flex-col justify-center" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>
            <p className="text-xs font-bold tracking-[0.01em] text-[#3B82F6]">Chấm điểm quyền</p>
            <h1 className="text-lg sm:text-2xl font-bold tracking-[-0.04em] text-[#C2410C] mt-1">
              {slot.player_name}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">{slot.player_club ?? '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <TreePathPills treePath={detail.tree_path} suffix={slot.content_name} />
            </div>
          </div>

          <section className="rounded-2xl border border-[#D9E6FF] bg-white/95 p-3 sm:p-4 shadow-sm" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>
            <p className="text-xs font-bold tracking-[0.01em] text-[#3B82F6]">Trạng thái</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
              <h2 className={`whitespace-nowrap text-sm sm:text-lg font-bold leading-tight tracking-[-0.03em] ${statusTone.text}`}>
                {STATUS_LABEL[slot.status] ?? slot.status}
              </h2>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {slot.submitted_judges_count}/{detail.judges.length} trọng tài đã chấm
            </p>
          </section>
        </header>

        {slot.status === 'ongoing' && slot.started_at ? (
          <section className="rounded-2xl border border-[#D9E6FF] bg-white/95 shadow-sm flex flex-col items-center justify-center flex-1 min-h-0">
            <p className="text-xs sm:text-sm font-bold tracking-[0.01em] text-[#3B82F6]">Thời gian</p>
            <div className="mt-4 flex items-center justify-center">
              <p className="text-7xl sm:text-9xl font-bold leading-none tracking-[-0.07em] text-[#16A34A]">
                {formatSeconds(remaining)}
              </p>
            </div>
          </section>
        ) : slot.status === 'ongoing' && !slot.started_at ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm flex flex-col items-center justify-center flex-1 min-h-0">
            <p className="text-xs sm:text-sm font-bold tracking-[0.01em] text-amber-600">Đang tạm dừng</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
            </div>
          </section>
        ) : revealed ? (
          <section className={`rounded-2xl border shadow-sm flex flex-col items-center justify-center flex-1 min-h-0 ${slot.is_disqualified ? 'border-red-300 bg-red-50' : 'border-[#D9E6FF] bg-white/95'}`}>
            <p className={`text-xs sm:text-sm font-bold tracking-[0.01em] ${slot.is_disqualified ? 'text-red-500' : 'text-[#3B82F6]'}`}>
              {slot.is_disqualified ? 'Bị Loại khỏi phần thi' : 'Điểm chính thức'}
            </p>
            {slot.is_disqualified ? (
              <div className="mt-4 flex items-center justify-center">
                <span className="inline-flex items-center rounded-2xl bg-red-100 border-2 border-red-400 px-8 py-4 text-5xl sm:text-6xl font-black text-red-600">
                  Bị Loại
                </span>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center">
                <p className="text-8xl sm:text-9xl font-bold leading-none tracking-[-0.07em] text-[#16A34A]">
                  {formatOfficialScore(slot.official_score)}
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-[#D9E6FF] bg-white/95 shadow-sm flex flex-col items-center justify-center flex-1 min-h-0">
            <p className="text-xs sm:text-sm font-bold tracking-[0.01em] text-[#3B82F6]">Đang chấm điểm</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-3 w-3 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-3 w-3 rounded-full bg-blue-400 animate-bounce" />
            </div>
          </section>
        )}

        {revealed && (
          <section className="grid gap-1.5 md:grid-cols-3 flex-shrink-0">
            <div className="rounded-lg border border-[#D9E6FF] bg-white/95 p-2 text-center shadow-sm">
              <p className="text-xs font-medium text-slate-600">Tổng 5 điểm</p>
              <p className="mt-1 text-sm sm:text-base tracking-[-0.03em] text-orange-600">{slot.total_judge_score ?? '--'}</p>
            </div>
            <div className="rounded-lg border border-[#D9E6FF] bg-white/95 p-2 text-center shadow-sm">
              <p className="text-xs font-medium text-slate-500">Điểm cao nhất</p>
              <p className="mt-1 text-sm sm:text-base font-semibold tracking-[-0.03em] text-[#1D4ED8]">{slot.highest_judge_score ?? '--'}</p>
            </div>
            <div className="rounded-lg border border-[#D9E6FF] bg-white/95 p-2 text-center shadow-sm">
              <p className="text-xs font-medium text-slate-500">Điểm thấp nhất</p>
              <p className="mt-1 text-sm sm:text-base font-semibold tracking-[-0.03em] text-slate-500">{slot.lowest_judge_score ?? '--'}</p>
            </div>
          </section>
        )}

        <section className="space-y-1.5 flex-shrink-0">
          <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {detail.judges.map((judge) => (
              <article
                key={judge.judge_slot}
                className="flex min-h-[100px] flex-col rounded-lg border border-[#D9E6FF] bg-white/95 p-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium tracking-[0.01em] text-orange-600 flex-1 truncate">
                    {judge.assigned_user_name ?? 'Chưa gán'}
                  </p>
                  <span className={`rounded-full px-1 py-0.5 text-[10px] font-medium whitespace-nowrap ${
                    judge.has_submitted
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-emerald-300 bg-emerald-50 text-emerald-600'
                  }`}>
                    {judge.has_submitted ? 'Đã xác nhận' : 'Sẵn sàng'}
                  </span>
                </div>

                <div className="mt-auto flex flex-col items-center justify-center py-1">
                  <p className="text-3xl font-bold leading-none tracking-[-0.03em] text-[#1D4ED8]">
                    {revealed && judge.has_submitted ? formatJudgeScore(judge.score) : '—'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
