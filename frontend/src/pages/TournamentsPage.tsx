import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Loader2, CheckCircle2, Circle, Zap, Users, Calendar, Send, RotateCcw, Play, X, User, GitBranch, Download } from 'lucide-react'
import {
  getTournamentStructureById,
  getBracket,
  generateBracket,
  generateSchedule,
  getSchedule,
  getBracketTree,
  publishTournament,
  resetTournament,
} from '../api/tournaments'
// updateMatchResult intentionally removed from bracket clicks; used only in ScoringPage
import { fetchStudentDetail, fetchStudents } from '../api/students'
import type { StudentListItem } from '../types/student'
import type { BracketMatch, WeightClassItem, BracketNodeItem, BracketTreeResponse, ParticipantInfo } from '../types/tournament'
import { WEIGHT_CLASSES, COMPETE_OPTIONS } from '../lib/constants'
import { canScore } from '../lib/auth'
import { useTournament } from '../context/TournamentContext'
import { NoTournamentGuard } from '../components/NoTournamentGuard'
import { BracketExportModal } from '../components/tournaments/BracketExportModal'
import { FilterChip } from '../components/ui'

// ── constants ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  phong_trao: 'Phong trào',
  pho_thong: 'Phổ thông',
}

// ── DisplayWC ──────────────────────────────────────────────────────────────

interface DisplayWC extends WeightClassItem {
  isVirtual: boolean    // true = no DB record, can't generate
  displayLabel: string  // user-friendly label: "45 kg", "Trên 92 kg"
}

// ── getDisplayWeightClasses ────────────────────────────────────────────────

function uniqueParticipants(participants: ParticipantInfo[] | null | undefined): ParticipantInfo[] {
  if (!participants || participants.length === 0) return []
  const seen = new Set<number>()
  return participants.filter((participant) => {
    if (seen.has(participant.student_id)) return false
    seen.add(participant.student_id)
    return true
  })
}

function getDisplayWeightClasses(
  ageTypeCode: string,
  gender: 'M' | 'F',
  dbWCs: WeightClassItem[],
): DisplayWC[] {
  // Quyền (Loại 5): just return DB WCs
  if (ageTypeCode === '5') {
    return dbWCs.map(wc => ({ ...wc, isVirtual: false, displayLabel: wc.weight_class_name }))
  }
  // Đối kháng: build from full standard list
  const stdList = WEIGHT_CLASSES[gender]
  const dbByKey = new Map(dbWCs.map(wc => [wc.weight_class_name, wc]))
  const result: DisplayWC[] = stdList.map(w => {
    const key = `${w.value}kg`
    const db = dbByKey.get(key)
    if (db) return { ...db, isVirtual: false, displayLabel: w.label }
    return {
      id: -(w.value),
      weight_class_name: key,
      gender,
      total_players: 0,
      bracket_status: 'NOT_GENERATED' as const,
      players: null,
      participants: [],
      isVirtual: true,
      displayLabel: w.label,
    }
  })
  // Also include child WCs (DB WCs not in the standard adult list)
  const stdKeys = new Set(stdList.map(w => `${w.value}kg`))
  const extraDbWCs = dbWCs.filter(wc => !stdKeys.has(wc.weight_class_name))
  return [
    ...extraDbWCs.map(wc => ({ ...wc, isVirtual: false, displayLabel: wc.weight_class_name })),
    ...result,
  ]
}

// ── Bracket layout constants ───────────────────────────────────────────────

const MATCH_H  = 78           // card height: no button — status~20px + 2×player~28px each
const MATCH_W  = 172
const GAP      = 20
const CONN_W   = 32
const UNIT     = MATCH_H + GAP
// Connector exits at center between the two player rows
const CARD_MID = 20 + 28      // status ~20px + player1 ~28px

// ── round label ────────────────────────────────────────────────────────────

function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Chung kết'
  if (round === totalRounds - 1) return 'Bán kết'
  if (round === totalRounds - 2) return 'Tứ kết'
  return `Vòng ${round}`
}

// ── MatchBox ───────────────────────────────────────────────────────────────

interface MatchBoxProps {
  match: BracketMatch
  stt: number | undefined
  onPlayerClick: (name: string, studentId: number | null) => void
  onScore: (id: number) => void
  onNavigateToStt: (stt: number) => void
  participantMap: Map<string, number>   // full_name → student_id
  highlighted?: boolean
  onClearHighlight?: () => void
}

function MatchBox({ match, stt, onPlayerClick, onScore, onNavigateToStt, participantMap, highlighted, onClearHighlight }: MatchBoxProps) {
  const dStatus = match.status

  const statusLabel =
    dStatus === 'completed'                  ? 'Kết thúc'
    : (dStatus === 'checking' || dStatus === 'ongoing') ? 'Đang thi đấu'
    : dStatus === 'ready'                    ? 'Sẵn sàng'
    : 'Chờ'

  const statusBadgeClass =
    dStatus === 'completed'                  ? 'bg-emerald-100 text-emerald-700'
    : (dStatus === 'checking' || dStatus === 'ongoing') ? 'bg-amber-100 text-amber-700 animate-pulse'
    : dStatus === 'ready'                    ? 'bg-blue-100 text-blue-600'
    : 'bg-gray-100 text-gray-400'

  const handlePlayerClick = (e: React.MouseEvent, name: string | null) => {
    e.stopPropagation()
    if (!name || name === 'BYE' || match.is_bye) return
    const studentId = participantMap.get(name) ?? null
    onPlayerClick(name, studentId)
  }

  return (
    <div
      onClick={highlighted ? onClearHighlight : undefined}
      className={`flex flex-col overflow-hidden select-none rounded-xl transition-all ${
        highlighted
          ? 'border-2 border-yellow-400 shadow-md shadow-yellow-100'
          : 'border border-gray-200 shadow-sm hover:shadow-md'
      } bg-white`}
      style={{ width: MATCH_W, height: MATCH_H }}
    >
      {/* status bar */}
      <div className="flex-shrink-0 px-2 py-1 flex justify-between items-center border-b border-gray-100 bg-gray-50/80" style={{ minHeight: 22 }}>
        <span className="font-mono whitespace-nowrap flex items-center gap-1">
          {stt != null && (
            <span
              onClick={e => { e.stopPropagation(); onNavigateToStt(stt) }}
              className="bg-slate-600 text-white px-1.5 rounded text-[10px] font-bold leading-4 cursor-pointer hover:bg-slate-700"
              title="Xem trong danh sách trận đấu"
            >
              #{stt}
            </span>
          )}
        </span>
        <span className={`text-[10px] whitespace-nowrap font-semibold px-1.5 py-0.5 rounded-full ${statusBadgeClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* player 1 — red */}
      <div
        onClick={e => handlePlayerClick(e, match.player1_name)}
        className={`flex-1 flex items-center gap-1 px-2 border-b border-gray-100 truncate ${
          match.is_bye || !match.player1_name
            ? 'cursor-default'
            : 'cursor-pointer'
        } ${
          match.winner === 1
            ? 'bg-emerald-50'
            : 'bg-red-50/60 hover:bg-red-50'
        }`}
      >
        {match.winner === 1
          ? <span className="text-emerald-500 flex-shrink-0 text-[10px]">▶</span>
          : <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        }
        <span className={`text-xs truncate font-medium ${
          !match.player1_name
            ? 'text-slate-300 italic'
            : match.winner === 1
            ? 'text-emerald-700 font-semibold'
            : match.winner === 2
            ? 'text-slate-400'
            : 'text-red-700'
        }`}>
          {match.player1_name || '—'}
        </span>
        {dStatus === 'completed' && !match.is_bye && (
          <span className={`ml-auto text-[10px] font-bold flex-shrink-0 ${match.winner === 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {match.score1 ?? 0}
          </span>
        )}
      </div>

      {/* player 2 — blue */}
      <div
        onClick={e => handlePlayerClick(e, match.player2_name)}
        className={`flex-1 flex items-center gap-1 px-2 truncate ${
          match.player2_name === 'BYE' || match.is_bye || !match.player2_name
            ? 'cursor-default'
            : 'cursor-pointer'
        } ${
          match.winner === 2
            ? 'bg-emerald-50'
            : 'bg-blue-50/60 hover:bg-blue-50'
        }`}
      >
        {match.winner === 2
          ? <span className="text-emerald-500 flex-shrink-0 text-[10px]">▶</span>
          : <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
        }
        <span className={`text-xs truncate font-medium ${
          !match.player2_name || match.player2_name === 'BYE'
            ? 'text-slate-300 italic'
            : match.winner === 2
            ? 'text-emerald-700 font-semibold'
            : match.winner === 1
            ? 'text-slate-400'
            : 'text-blue-700'
        }`}>
          {match.player2_name || '—'}
        </span>
        {dStatus === 'completed' && !match.is_bye && (
          <span className={`ml-auto text-[10px] font-bold flex-shrink-0 ${match.winner === 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {match.score2 ?? 0}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Dynamic BracketView ────────────────────────────────────────────────────

interface BracketViewProps {
  matches: BracketMatch[]
  sttMap: Map<number, number>
  participantMap: Map<string, number>
  onPlayerClick: (name: string, studentId: number | null) => void
  onScore: (id: number) => void
  onNavigateToStt: (stt: number) => void
  highlightMatchId?: number | null
  onClearHighlight?: () => void
}

function BracketView({ matches, sttMap, participantMap, onPlayerClick, onScore, onNavigateToStt, highlightMatchId, onClearHighlight }: BracketViewProps) {
  // Group and sort by round
  const byRound: Record<number, BracketMatch[]> = {}
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  }
  for (const r of Object.keys(byRound)) {
    byRound[+r].sort((a, b) => a.match_number - b.match_number)
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  if (rounds.length === 0) return null

  const totalRounds = rounds[rounds.length - 1]
  const r1Count = byRound[rounds[0]].length
  // Total height based on round 1 match count
  const totalH = r1Count * UNIT + MATCH_H

  return (
    <div className="relative">
    <div className="overflow-x-auto rounded-xl bg-gray-100/80 border border-gray-200 p-4 scroll-smooth">
      {/* Round labels — header row */}
      <div className="flex mb-2" style={{ minWidth: 'max-content' }}>
        {rounds.map((r, ri) => {
          const hasNext = ri < rounds.length - 1
          const label = getRoundLabel(r, totalRounds)
          const isLate = label === 'Bán kết' || label === 'Chung kết' || label === 'Tứ kết'
          return (
            <div
              key={r}
              style={{ width: MATCH_W + (hasNext ? CONN_W : 0), flexShrink: 0 }}
              className="text-center"
            >
              <span className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                label === 'Chung kết' ? 'bg-amber-100 text-amber-700'
                : label === 'Bán kết' ? 'bg-purple-100 text-purple-700'
                : label === 'Tứ kết'  ? 'bg-blue-100 text-blue-700'
                : isLate ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
              }`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-start" style={{ minWidth: 'max-content' }}>
        {rounds.map((r, ri) => {
          const rMatches   = byRound[r]
          const spacing    = Math.pow(2, r - 1) * UNIT
          const topOffset  = (Math.pow(2, r - 1) - 1) * UNIT / 2
          const hasNext    = ri < rounds.length - 1
          const colW       = MATCH_W + (hasNext ? CONN_W : 0)

          return (
            // Single position:relative column holds both cards AND the connector SVG
            <div key={r} style={{ position: 'relative', width: colW, height: totalH, flexShrink: 0 }}>
              {/* Match cards */}
              {rMatches.map((m, mi) => (
                <div
                  key={m.id}
                  style={{ position: 'absolute', top: topOffset + mi * spacing, width: MATCH_W }}
                >
                  <MatchBox match={m} stt={sttMap.get(m.id)} participantMap={participantMap} onPlayerClick={onPlayerClick} onScore={onScore} onNavigateToStt={onNavigateToStt} highlighted={highlightMatchId === m.id} onClearHighlight={onClearHighlight} />
                </div>
              ))}

              {/* Connector SVG — absolutely anchored at left:MATCH_W so y=0 is always the bracket top */}
              {hasNext && (
                <svg
                  style={{ position: 'absolute', left: MATCH_W, top: 0 }}
                  width={CONN_W}
                  height={totalH}
                >
                  {rMatches
                    .filter((_, i) => i % 2 === 0)
                    .map((_, ci) => {
                      const y1   = topOffset + ci * 2 * spacing + CARD_MID
                      const y2   = topOffset + (ci * 2 + 1) * spacing + CARD_MID
                      const midY = (y1 + y2) / 2
                      const vx   = CONN_W * 0.4
                      return (
                        <g key={ci}>
                          <line x1={0}   y1={y1}   x2={vx}     y2={y1}   stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1={0}   y1={y2}   x2={vx}     y2={y2}   stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1={vx}  y1={y1}   x2={vx}     y2={y2}   stroke="#CBD5E1" strokeWidth="1.5" />
                          <line x1={vx}  y1={midY} x2={CONN_W} y2={midY} stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
                        </g>
                      )
                    })}
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
      {/* fade hint — scroll right indicator on mobile */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-gray-100/90 to-transparent rounded-r-xl md:hidden" />
    </div>
  )
}

// ── Participant list ────────────────────────────────────────────────────────

function ParticipantList({ wc }: { wc: WeightClassItem }) {
  const participants = uniqueParticipants(wc.participants)
  if (participants.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {participants.map((p) => (
        <span
          key={p.student_id}
          className="inline-flex items-center px-2 py-0.5 bg-white border border-blue-200 text-[var(--color-primary,#1d4ed8)] rounded text-xs whitespace-nowrap"
          title={p.full_name}
        >
          {p.full_name}
        </span>
      ))}
    </div>
  )
}

// ── WeightClassCard ────────────────────────────────────────────────────────

function WeightClassCard({
  wc,
  selected,
  onClick,
}: {
  wc: DisplayWC
  selected: boolean
  onClick: () => void
}) {
  const isWarn = wc.total_players === 1
  const isOk   = wc.total_players >= 2

  const statusIcon = wc.isVirtual ? null
    : wc.bracket_status === 'GENERATED' ? <CheckCircle2 size={13} className="text-green-500" />
    : wc.bracket_status === 'GENERATING' ? <Loader2 size={13} className="text-blue-500 animate-spin" />
    : <Circle size={13} className={isOk ? 'text-gray-300' : 'text-amber-400'} />

  const baseClass = 'flex flex-col items-center justify-center rounded-lg border text-sm font-medium transition-all flex-shrink-0'
  const sizeClass = 'w-[72px] h-[64px]'

  const colorClass = wc.isVirtual
    ? selected
      ? 'border-gray-300 bg-gray-100 text-gray-500 shadow-sm'
      : 'border-dashed border-gray-200 bg-white text-gray-300 hover:border-gray-300 hover:text-gray-400'
    : selected
      ? isWarn
        ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm'
        : 'border-[var(--color-primary,#1d4ed8)] bg-blue-50 text-[var(--color-primary,#1d4ed8)] shadow-sm'
      : isWarn
        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'

  return (
    <button
      onClick={onClick}
      title={
        wc.isVirtual ? `${wc.displayLabel} — Chưa có VĐV`
        : isWarn ? 'Chỉ có 1 VĐV — cần thêm ít nhất 1 VĐV để tạo sơ đồ'
        : undefined
      }
      className={`${baseClass} ${sizeClass} ${colorClass}`}
    >
      <span className={`font-semibold leading-tight text-[13px] ${wc.isVirtual ? 'opacity-50' : ''}`}>
        {wc.displayLabel}
      </span>

      {wc.isVirtual ? (
        <span className="text-[10px] text-gray-300 mt-0.5">0 VĐV</span>
      ) : (
        <div className="flex items-center gap-0.5 mt-0.5">
          {statusIcon}
          <span className={`text-[11px] ${isWarn ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
            {wc.total_players} VĐV
          </span>
        </div>
      )}

      {isWarn && (
        <span className="flex items-center gap-0.5 mt-0.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 text-white text-[8px] font-bold flex items-center justify-center leading-none flex-shrink-0">!</span>
          <span className="text-[9px] text-amber-600 font-medium">Thiếu VĐV</span>
        </span>
      )}
    </button>
  )
}

// ── Dynamic tree helpers ───────────────────────────────────────────────────

function findNodeById(nodes: BracketNodeItem[], id: number): BracketNodeItem | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeById(n.children, id)
    if (found) return found
  }
  return null
}

function findPathNodes(nodes: BracketNodeItem[], ids: number[]): BracketNodeItem[] {
  const result: BracketNodeItem[] = []
  let current = nodes
  for (const id of ids) {
    const node = current.find(n => n.id === id)
    if (!node) break
    result.push(node)
    current = node.children
  }
  return result
}

interface NodeStats { totalWC: number; totalPlayers: number; warnCount: number }

function getGroupStats(nodes: BracketNodeItem[]): NodeStats {
  let totalWC = 0, totalPlayers = 0, warnCount = 0
  for (const node of nodes) {
    if (node.node_type === 'weight_class') {
      totalWC++
      const p = node.leaf_info?.total_players ?? 0
      totalPlayers += p
      if (p === 1) warnCount++
    } else {
      const sub = getGroupStats(node.children)
      totalWC += sub.totalWC
      totalPlayers += sub.totalPlayers
      warnCount += sub.warnCount
    }
  }
  return { totalWC, totalPlayers, warnCount }
}

// ── PlayerInfoModal ────────────────────────────────────────────────────────

interface PlayerInfoModalProps {
  name: string
  studentId: number | null
  tournamentId: number | null
  onClose: () => void
}

const QUYEN_EVENT_VALUES = new Set(['don_luyen', 'song_luyen', 'da_luyen', 'don_chan'])

function PlayerInfoModal({ name, studentId, tournamentId, onClose }: PlayerInfoModalProps) {
  // Step 1: fetch by ID if we have a real one
  const hasRealId = studentId != null && studentId > 0
  const { data: studentById, isLoading: loadingById } = useQuery({
    queryKey: ['student-detail', studentId, tournamentId],
    queryFn: () => fetchStudentDetail(studentId!, tournamentId ?? undefined),
    enabled: hasRealId,
  })

  // Step 2: if no real ID, search by name then fetch detail
  const { data: searchResult, isLoading: loadingSearch } = useQuery({
    queryKey: ['student-search-by-name', name],
    queryFn: () => fetchStudents({ keyword: name, page: 1, page_size: 5 }),
    enabled: !hasRealId && !!name,
    select: (res): StudentListItem | null => res.items?.find(s => s.full_name === name) ?? res.items?.[0] ?? null,
  })
  const resolvedId = searchResult?.id ?? null
  const { data: studentBySearch, isLoading: loadingDetail } = useQuery({
    queryKey: ['student-detail', resolvedId, tournamentId],
    queryFn: () => fetchStudentDetail(resolvedId!, tournamentId ?? undefined),
    enabled: resolvedId != null,
  })

  const student = hasRealId ? studentById : studentBySearch
  const isLoading = hasRealId ? loadingById : (loadingSearch || loadingDetail)

  // "sparring" = đối kháng; quyền events are don_luyen / song_luyen / da_luyen / don_chan
  const events       = student?.compete_events ?? []
  const hasDoiKhang  = events.includes('sparring')
  const quyenEvents  = events.filter(e => QUYEN_EVENT_VALUES.has(e))
  const hasQuyen     = quyenEvents.length > 0 || (student?.quyen_selections?.length ?? 0) > 0

  const eventLabel = (val: string) =>
    COMPETE_OPTIONS.find(o => o.value === val)?.label ?? val

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/30">
              {student?.avatar_url
                ? <img src={student.avatar_url} alt="" className="w-full h-full object-cover" />
                : <User size={20} className="text-white" />
              }
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{name}</p>
              {student && <p className="text-blue-200 text-xs">{student.code}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : !student ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Không tìm thấy thông tin vận động viên</p>
            </div>
          ) : (
            <div className="space-y-2.5">

              {/* Đơn vị */}
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1">Đơn vị</p>
                <p className="text-sm font-semibold text-gray-800">
                  {student.club_name ?? <span className="text-gray-400 font-normal italic">Chưa có đơn vị</span>}
                </p>
                {student.coach_name && (
                  <p className="text-xs text-gray-500 mt-0.5">HLV: {student.coach_name}</p>
                )}
              </div>

              {/* Nội dung thi đấu */}
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-2">Nội dung thi đấu</p>
                <div className="space-y-2">

                  {/* Đối kháng row */}
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${
                      hasDoiKhang ? 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white' : 'bg-blue-100 text-blue-300'
                    }`}>
                      Đối kháng
                    </span>
                    {hasDoiKhang ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {student.weight_class != null && (
                          <span className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 rounded text-[11px] font-medium">
                            {student.weight_class} kg
                          </span>
                        )}
                        {student.category_type && (
                          <span className="px-2 py-0.5 bg-white border border-blue-200 text-blue-600 rounded text-[11px]">
                            {student.category_type === 'phong_trao' ? 'Phong trào' : 'Phổ thông'}
                          </span>
                        )}
                        {!student.weight_class && !student.category_type && (
                          <span className="text-xs text-blue-600">Đã đăng ký</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-blue-300 italic pt-0.5">Không đăng ký</span>
                    )}
                  </div>

                  {/* Quyền row */}
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${
                      hasQuyen ? 'bg-purple-600 text-white' : 'bg-blue-100 text-blue-300'
                    }`}>
                      Quyền
                    </span>
                    {hasQuyen ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {/* event types e.g. Đơn luyện, Song luyện */}
                        {quyenEvents.map(ev => (
                          <span key={ev} className="px-2 py-0.5 bg-white border border-purple-200 text-purple-700 rounded text-[11px] font-medium">
                            {eventLabel(ev)}
                          </span>
                        ))}
                        {/* specific bài names e.g. Tứ trụ, Bình pháp */}
                        {(student.quyen_selections ?? []).map(q => (
                          <span key={q} className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-600 rounded text-[11px]">
                            {q}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-blue-300 italic pt-0.5">Không đăng ký</span>
                    )}
                  </div>

                </div>
              </div>

              {/* Ghi chú */}
              {student.notes ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide mb-1">Ghi chú</p>
                  <p className="text-sm text-amber-900 leading-snug">{student.notes}</p>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1">Ghi chú</p>
                  <p className="text-xs text-blue-300 italic">Không có ghi chú</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── TournamentsPage ────────────────────────────────────────────────────────

export const TournamentsPage = () => {
  const { tournaments, selectedTournament, setSelectedTournament } = useTournament()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedTournamentIdFromQuery = searchParams.get('id') ? Number(searchParams.get('id')) : null
  const autoSelectWcId = searchParams.get('wc') ? Number(searchParams.get('wc')) : null
  const autoHighlightMatchId = searchParams.get('match') ? Number(searchParams.get('match')) : null
  const showDebugPanel = searchParams.get('debug') === '1'
  const [highlightMatchId, setHighlightMatchId] = useState<number | null>(autoHighlightMatchId)
  const [genMsg, setGenMsg] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const isAdmin = localStorage.getItem('user_role') === 'admin'

  // Legacy mode state
  const [selectedCategory, setSelectedCategory] = useState<string>('phong_trao')
  const [selectedAgeType, setSelectedAgeType] = useState<string>('')
  const [selectedGender, setSelectedGender] = useState<'M' | 'F'>('M')

  // Dynamic mode state
  const [selectedByLevel, setSelectedByLevel] = useState<number[]>([])
  const [selectedWCNodeId, setSelectedWCNodeId] = useState<number | null>(null)

  // Common state
  const [selectedWC, setSelectedWC] = useState<number | null>(null)
  const [playerInfoModal, setPlayerInfoModal] = useState<{ name: string; studentId: number | null } | null>(null)
  const [showEmpty, setShowEmpty] = useState(false)
  const [expandedEmptyRows, setExpandedEmptyRows] = useState<Set<string>>(new Set())
  const toggleEmptyRow = (key: string) => setExpandedEmptyRows(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  // Support /tournaments?id=... by syncing query id to TournamentContext.
  useEffect(() => {
    if (!selectedTournamentIdFromQuery || Number.isNaN(selectedTournamentIdFromQuery)) return
    const found = tournaments.find(t => t.id === selectedTournamentIdFromQuery)
    if (!found) return
    if (selectedTournament?.id === found.id) return
    setSelectedTournament(found)
  }, [selectedTournamentIdFromQuery, tournaments, selectedTournament?.id, setSelectedTournament])

  // Load tournament structure by selected tournament id
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: structure, isLoading: loadingStructure, isError: structureError } = useQuery({
    queryKey: ['tournament-structure', selectedTournament?.id],
    queryFn: () => getTournamentStructureById(selectedTournament!.id),
    enabled: !!selectedTournament,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  // Load bracket tree for dynamic tournaments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: bracketTree, isLoading: loadingBracketTree } = useQuery({
    queryKey: ['bracket-tree', selectedTournament?.id],
    queryFn: () => getBracketTree(selectedTournament!.id),
    enabled: selectedTournament?.structure_mode === 'dynamic',
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  // Auto-select path in dynamic mode
  useEffect(() => {
    if (!bracketTree) return

    // Find first path to a leaf weight_class node (preferring >= 2 players).
    // If no weight_class exists yet, return path to the deepest first node.
    function findFirstPath(nodes: BracketNodeItem[]): number[] | null {
      for (const node of nodes) {
        if (node.node_type === 'weight_class') return [node.id]
        if (node.children.length > 0) {
          const childPath = findFirstPath(node.children)
          if (childPath) return [node.id, ...childPath]
        }
      }
      return null
    }

    function findDeepestFirstPath(nodes: BracketNodeItem[]): number[] {
      const first = nodes[0]
      if (!first) return []
      if (first.children.length === 0) return [first.id]
      return [first.id, ...findDeepestFirstPath(first.children)]
    }

    const path = findFirstPath(bracketTree.nodes) ?? findDeepestFirstPath(bracketTree.nodes)
    if (path.length > 0) {
      setSelectedByLevel(path)
      // Find leaf node to set selectedWC
      let current = bracketTree.nodes
      for (const id of path) {
        const node = current.find(n => n.id === id)
        if (!node) break
        if (node.node_type === 'weight_class') {
          setSelectedWCNodeId(node.id)
          setSelectedWC(node.leaf_info?.weight_class_id ?? null)
          break
        }
        current = node.children
      }
    }
  }, [bracketTree])

  // Auto-select on structure load (legacy mode)
  useEffect(() => {
    if (!structure || selectedTournament?.structure_mode === 'dynamic') return
    const cat = structure.categories.find((c) => c.category === selectedCategory)
      ?? structure.categories[0]
    if (!cat) return
    if (selectedCategory !== cat.category) setSelectedCategory(cat.category)

    const at = cat.age_types[0]
    if (!at) return
    if (!selectedAgeType) setSelectedAgeType(at.code)

    const ageType = cat.age_types.find((a) => a.code === selectedAgeType) ?? at
    if (!selectedWC) {
      const filteredByGender = ageType.weight_classes.filter((w) => w.gender === selectedGender)
      const display = getDisplayWeightClasses(ageType.code, selectedGender, filteredByGender)
      const best = display.find(w => !w.isVirtual && w.total_players >= 2)
        ?? display.find(w => !w.isVirtual)
        ?? display[0]
      setSelectedWC(best?.id ?? null)
    }
  }, [structure, selectedGender, selectedTournament?.structure_mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select weight class from URL ?wc= param (e.g. navigated from MatchesPage)
  useEffect(() => {
    if (!structure || !autoSelectWcId) return
    for (const cat of structure.categories) {
      for (const at of cat.age_types) {
        const wc = at.weight_classes.find(w => w.id === autoSelectWcId)
        if (wc) {
          setSelectedCategory(cat.category)
          setSelectedAgeType(at.code)
          setSelectedGender(wc.gender as 'M' | 'F')
          setSelectedWC(wc.id)
          return
        }
      }
    }
  }, [structure, autoSelectWcId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync highlight when URL param changes
  useEffect(() => {
    setHighlightMatchId(autoHighlightMatchId)
  }, [autoHighlightMatchId])

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    setSelectedAgeType('')
    setSelectedWC(null)
    const catData = structure?.categories.find((c) => c.category === cat)
    if (catData?.age_types[0]) {
      setSelectedAgeType(catData.age_types[0].code)
      const at = catData.age_types[0]
      const filteredByGender = at.weight_classes.filter((w) => w.gender === selectedGender)
      const display = getDisplayWeightClasses(at.code, selectedGender as 'M' | 'F', filteredByGender)
      const best = display.find(w => !w.isVirtual && w.total_players >= 2)
        ?? display.find(w => !w.isVirtual)
        ?? display[0]
      setSelectedWC(best?.id ?? null)
    }
  }

  const handleAgeTypeChange = (code: string) => {
    setSelectedAgeType(code)
    setSelectedGender('M')
    setSelectedWC(null)
    const catData = structure?.categories.find((c) => c.category === selectedCategory)
    const at = catData?.age_types.find((a) => a.code === code)
    if (at) {
      const filteredByGender = at.weight_classes.filter((w) => w.gender === 'M')
      const display = getDisplayWeightClasses(at.code, 'M', filteredByGender)
      const best = display.find(w => !w.isVirtual && w.total_players >= 2)
        ?? display.find(w => !w.isVirtual)
        ?? display[0]
      setSelectedWC(best?.id ?? null)
    }
  }

  const handleGenderChange = (gender: 'M' | 'F') => {
    setSelectedGender(gender)
    setSelectedWC(null)
    const at = currentCatData?.age_types.find((a) => a.code === selectedAgeType)
    if (at) {
      const filteredByGender = at.weight_classes.filter((w) => w.gender === gender)
      const display = getDisplayWeightClasses(at.code, gender, filteredByGender)
      const best = display.find(w => !w.isVirtual && w.total_players >= 2)
        ?? display.find(w => !w.isVirtual)
        ?? display[0]
      setSelectedWC(best?.id ?? null)
    }
  }

  // Derived data
  const currentCatData = structure?.categories.find((c) => c.category === selectedCategory)
  const currentAgeTypes = currentCatData?.age_types ?? []

  const displayWeightClasses: DisplayWC[] = (() => {
    if (!currentCatData || !selectedAgeType) return []
    const dbWCs = (
      currentCatData.age_types.find((a) => a.code === selectedAgeType)?.weight_classes ?? []
    ).filter((wc) => wc.gender === selectedGender)
    return getDisplayWeightClasses(selectedAgeType, selectedGender, dbWCs)
  })()

  const selectedWCData = displayWeightClasses.find((wc) => wc.id === selectedWC) ?? null

  // Dynamic mode derived data — bracketTree is source of truth for dynamic tournaments
  const isDynamic = selectedTournament?.structure_mode === 'dynamic'

  const dynamicLeafNode = (isDynamic && selectedWCNodeId && bracketTree)
    ? findNodeById(bracketTree.nodes, selectedWCNodeId)
    : null

  const selectedPathNodes = (isDynamic && bracketTree)
    ? findPathNodes(bracketTree.nodes, selectedByLevel)
    : []

  const dynamicSelectedWCData: DisplayWC | null = dynamicLeafNode?.leaf_info
    ? {
        id: dynamicLeafNode.leaf_info.weight_class_id,
        weight_class_name: dynamicLeafNode.name,
        gender: '',
        total_players: dynamicLeafNode.leaf_info.total_players,
        bracket_status: dynamicLeafNode.leaf_info.bracket_status,
        players: dynamicLeafNode.leaf_info.players,
        participants: (dynamicLeafNode.leaf_info.participants ?? []).map(p => ({
          student_id: p.student_id,
          full_name: p.full_name,
          gender: '',
          weight_class: null,
        })),
        isVirtual: false,
        displayLabel: dynamicLeafNode.name,
      }
    : null

  // Effective WC data: dynamic uses bracketTree leaf_info; legacy uses structure.categories
  const effectiveWCData = isDynamic ? dynamicSelectedWCData : selectedWCData

  const selectedTreePathLabel = (isDynamic && effectiveWCData)
    ? [
        ...selectedPathNodes.slice(0, -1).map(node => node.name),
        `Hạng ${effectiveWCData.displayLabel}`,
      ].join(' · ')
    : null

  // Effective tournament status: from bracketTree (dynamic) or structure (legacy)
  const effectiveTournamentStatus = bracketTree?.tournament_status ?? structure?.tournament_status

  // Quyen/kata mode is a legacy concept (age_type '5'); dynamic mode always shows bracket
  const isQuyenMode = isDynamic ? false : selectedAgeType === '5'

  // Load bracket for selected weight class
  const { data: bracket, isLoading: loadingBracket } = useQuery({
    queryKey: ['bracket', selectedWC],
    queryFn: () => getBracket(selectedWC!),
    enabled: !!selectedWC && selectedWC > 0 && effectiveWCData?.bracket_status === 'GENERATED',
  })

  // Load schedule to get schedule_order for each match
  const { data: schedule } = useQuery({
    queryKey: ['schedule', structure?.tournament_id],
    queryFn: () => getSchedule(structure!.tournament_id),
    enabled: !!structure?.tournament_id,
    staleTime: 0,
  })

  // Build STT map: use schedule_order directly from backend (same as MatchesPage)
  const sttMap = new Map<number, number>(
    (schedule?.bracket_matches ?? [])
      .filter(m => !m.is_bye && m.schedule_order != null)
      .map(m => [m.id, m.schedule_order!])
  )

  const findPreferredLeafPath = (nodes: BracketNodeItem[]): BracketNodeItem[] | null => {
    const sortedNodes = [...nodes].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)

    for (const node of sortedNodes) {
      if (node.node_type === 'weight_class' && node.leaf_info && (node.leaf_info.total_players ?? 0) >= 2) {
        return [node]
      }
      const childPath = findPreferredLeafPath(node.children)
      if (childPath) return [node, ...childPath]
    }

    for (const node of sortedNodes) {
      if (node.node_type === 'weight_class' && node.leaf_info) {
        return [node]
      }
      const childPath = findPreferredLeafPath(node.children)
      if (childPath) return [node, ...childPath]
    }

    return null
  }

  const handleSelectNode = (path: BracketNodeItem[]) => {
    const clickedNode = path[path.length - 1]
    if (!clickedNode) return

    let fullPath = path
    if (clickedNode.node_type !== 'weight_class' && clickedNode.children.length > 0) {
      const preferredLeafPath = findPreferredLeafPath(clickedNode.children)
      if (preferredLeafPath) {
        fullPath = [...path, ...preferredLeafPath]
      }
    }

    setSelectedByLevel(fullPath.map(node => node.id))

    const selectedLeaf = [...fullPath].reverse().find(node => node.node_type === 'weight_class')
    if (selectedLeaf) {
      setSelectedWCNodeId(selectedLeaf.id)
      setSelectedWC(selectedLeaf.leaf_info?.weight_class_id ?? null)
    } else {
      setSelectedWC(null)
      setSelectedWCNodeId(null)
    }
  }

  // Generate bracket mutation (per weight class)
  const generateMutation = useMutation({
    mutationFn: () => generateBracket(selectedWC!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament-structure', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket-tree', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket', selectedWC] })
    },
  })

  // Generate schedule mutation (auto-generates all matches first, then assigns courts)
  const schedMutation = useMutation({
    mutationFn: () => generateSchedule(selectedTournament!.id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tournament-structure', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket-tree', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      const total = data.total_scheduled ?? 0
      if (total === 0) {
        setGenMsg('Tạo xong — chưa có trận nào (cần ≥ 2 VĐV mỗi hạng cân)')
      } else {
        setGenMsg(`Đã tạo lịch: ${total} lượt thi · Sân A ${data.court_a_count} · Sân B ${data.court_b_count}`)
      }
      setTimeout(() => setGenMsg(null), 7000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
      setGenMsg(`Lỗi: ${msg ?? 'Không thể tạo lịch thi đấu'}`)
      setTimeout(() => setGenMsg(null), 7000)
    },
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: () => publishTournament(selectedTournament!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament-structure', selectedTournament!.id] })
      setGenMsg('Đã phát hành giải đấu!')
      setTimeout(() => setGenMsg(null), 4000)
    },
  })

  // Admin reset mutation
  const resetMutation = useMutation({
    mutationFn: () => resetTournament(selectedTournament!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournament-structure', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket-tree', selectedTournament!.id] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      setGenMsg('Đã reset giải đấu về trạng thái Nháp')
      setTimeout(() => setGenMsg(null), 5000)
    },
  })

  // Map player name → student_id for the selected weight class
  const participantMap = new Map<string, number>(
    (effectiveWCData?.participants ?? []).map(p => [p.full_name, p.student_id])
  )

  const handlePlayerClick = (name: string, studentId: number | null) => {
    setPlayerInfoModal({ name, studentId })
  }

  const bracketSize = (() => {
    const n = effectiveWCData?.total_players ?? 0
    if (n <= 1) return 2
    let s = 1
    while (s < n) s *= 2
    return s
  })()

  const hasAnyGenerated = (() => {
    if (isDynamic && bracketTree) {
      const check = (nodes: BracketNodeItem[]): boolean =>
        nodes.some(n => n.leaf_info?.bracket_status === 'GENERATED' || check(n.children))
      return check(bracketTree.nodes)
    }
    return structure?.categories.some(cat =>
      cat.age_types.some(at => at.weight_classes.some(wc => wc.bracket_status === 'GENERATED'))
    ) ?? false
  })()

  const hasRuntimeArtifacts =
    hasAnyGenerated ||
    (schedule?.quyen_slots.length ?? 0) > 0 ||
    (schedule?.bracket_matches.length ?? 0) > 0

  const renderBracketPanel = () => {
    if (!effectiveWCData) return null
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* panel header */}
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5 bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)]">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-snug">
              {isDynamic ? (
                <>
                  {selectedPathNodes.slice(0, -1).map(n => n.name).join(' · ')}
                  {selectedPathNodes.length > 1 ? ' · ' : ''}
                  Hạng {effectiveWCData.displayLabel}
                </>
              ) : (
                <>
                  Hạng {effectiveWCData.displayLabel}
                  {' · '}
                  {selectedGender === 'M' ? 'Nam' : 'Nữ'}
                  {' · '}
                  {CATEGORY_LABELS[selectedCategory]}
                  {' · '}
                  Loại {selectedAgeType}
                </>
              )}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Users size={12} />
              <span>{effectiveWCData.total_players} VĐV {isQuyenMode ? 'tham gia quyền' : 'đăng ký'}</span>
              {!isQuyenMode && effectiveWCData.total_players >= 2 && (
                <span className="px-2 py-0.5 bg-white/10 border border-white/20 text-white/90 rounded text-[11px]">
                  Bracket {bracketSize} vị trí
                </span>
              )}
            </div>
          </div>
          {isAdmin && !effectiveWCData.isVirtual && effectiveWCData.total_players >= 2 && !isQuyenMode && effectiveTournamentStatus === 'DRAFT' && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors ${
                effectiveWCData.bracket_status === 'GENERATED'
                  ? 'text-orange-300 border border-orange-300/40 hover:bg-orange-400/10'
                  : 'bg-white/15 text-white border border-white/20 hover:bg-white/25'
              }`}
            >
              {generateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {effectiveWCData.bracket_status === 'GENERATED' ? 'Tạo lại sơ đồ' : 'Tạo sơ đồ thi đấu'}
            </button>
          )}
        </div>

        <div className="p-5">

        {/* participant list */}
        {!isQuyenMode && effectiveWCData.participants && effectiveWCData.participants.length > 0 && (
          <div className="mb-5 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
            <p className="text-[11px] font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wider mb-2">
              Danh sách vận động viên đăng ký
            </p>
            <div className="relative">
              <div className="overflow-x-auto pb-1 scrollbar-thin">
                <ParticipantList wc={effectiveWCData} />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-blue-50/80 to-transparent rounded-r-lg" />
            </div>
          </div>
        )}

        {/* empty / not-enough states */}
        {!isQuyenMode && (
          <>
            {(effectiveWCData.isVirtual || effectiveWCData.total_players < 2) && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                <Users size={40} className="opacity-30" />
                <p className="text-sm">
                  {effectiveWCData.isVirtual
                    ? 'Không có vận động viên đăng ký hạng cân này'
                    : 'Cần tối thiểu 2 vận động viên để tạo sơ đồ'}
                </p>
              </div>
            )}
            {effectiveWCData.bracket_status === 'NOT_GENERATED' && effectiveWCData.total_players >= 2 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                <Trophy size={40} className="opacity-20" />
                <p className="text-sm text-gray-500">
                  Nhấn "Tạo sơ đồ thi đấu" để tạo bracket {bracketSize} vị trí
                </p>
              </div>
            )}
          </>
        )}

        {effectiveWCData.bracket_status === 'GENERATING' && (
          <div className="flex items-center justify-center py-12 gap-3 text-blue-500">
            <Loader2 size={24} className="animate-spin" />
            <span className="font-medium">Đang tạo sơ đồ...</span>
          </div>
        )}

        {effectiveWCData.bracket_status === 'GENERATED' && (
          <>
            {loadingBracket ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                <span>Đang tải sơ đồ...</span>
              </div>
            ) : bracket ? (
              <>
                <div className="md:hidden mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Kéo ngang để xem đầy đủ sơ đồ thi đấu.
                </div>
                <div onClick={() => setHighlightMatchId(null)}>
                  <BracketView
                    matches={bracket.matches}
                    sttMap={sttMap}
                    participantMap={participantMap}
                    onPlayerClick={handlePlayerClick}
                    onScore={(id) => navigate(`/matches/${id}/score`)}
                    onNavigateToStt={(stt) => navigate(`/matches?stt=${stt}`)}
                    highlightMatchId={highlightMatchId}
                    onClearHighlight={() => setHighlightMatchId(null)}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">Không có dữ liệu bracket</div>
            )}
          </>
        )}
        </div>{/* end p-5 */}
      </div>
    )
  }

  return !selectedTournament ? <NoTournamentGuard /> : (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-yellow-500" />
            <h1 className="text-xl font-bold text-gray-800">
              {bracketTree?.tournament_name ?? structure?.tournament_name ?? 'Giải đấu'}
            </h1>
            {effectiveTournamentStatus && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                effectiveTournamentStatus === 'DRAFT'      ? 'bg-gray-100 text-gray-600' :
                effectiveTournamentStatus === 'PUBLISHED'  ? 'bg-blue-100 text-blue-700' :
                effectiveTournamentStatus === 'ONGOING'    ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {effectiveTournamentStatus === 'DRAFT'     ? 'Nháp' :
                 effectiveTournamentStatus === 'PUBLISHED' ? 'Đã phát hành' :
                 effectiveTournamentStatus === 'ONGOING'   ? 'Đang diễn ra' : 'Hoàn thành'}
              </span>
            )}
          </div>

          {/* Action buttons — aligned with title on the right */}
          {((isAdmin && (structure || bracketTree)) || (isDynamic && bracketTree)) && (
            <div className="flex items-center gap-3 flex-wrap">
              {isDynamic && bracketTree && (
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14} />
                  Export PDF
                </button>
              )}
              {isAdmin && (
                <>
              <button
                onClick={() => navigate(`/tournaments/${selectedTournament!.id}/structure/weight-classes`)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-primary,#1d4ed8)] text-[var(--color-primary,#1d4ed8)] rounded-lg hover:bg-blue-50"
              >
                <GitBranch size={14} />
                Cấu trúc giải đấu
              </button>
              {effectiveTournamentStatus === 'DRAFT' && (
                <>
                  <button
                    onClick={() => schedMutation.mutate()}
                    disabled={schedMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {schedMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Tạo lịch &amp; sơ đồ thi đấu
                  </button>
                  <button
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
                  >
                    {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Phát hành
                  </button>
                </>
              )}
              {(effectiveTournamentStatus !== 'DRAFT' || hasRuntimeArtifacts) && (
                <button
                  onClick={() => {
                    if (confirm('Reset sẽ xóa toàn bộ sơ đồ và đưa giải về trạng thái Nháp. Tiếp tục?')) {
                      resetMutation.mutate()
                    }
                  }}
                  disabled={resetMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {resetMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  Reset giải đấu
                </button>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Feedback message */}
        {genMsg && (
          <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
            {genMsg}
          </div>
        )}

        {showDebugPanel && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold uppercase tracking-wide">Tournament Debug</div>
            <div className="mt-1 grid gap-1 md:grid-cols-2">
              <div>selectedTournament.id: {selectedTournament?.id ?? 'null'}</div>
              <div>selectedTournament.structure_mode: {selectedTournament?.structure_mode ?? 'null'}</div>
              <div>isDynamic: {isDynamic ? 'true' : 'false'}</div>
              <div>structure.tournament_id: {structure?.tournament_id ?? 'null'}</div>
              <div>structure.categories.length: {structure?.categories.length ?? 0}</div>
              <div>bracketTree.nodes.length: {bracketTree?.nodes.length ?? 0}</div>
              <div>selectedWC: {selectedWC ?? 'null'}</div>
              <div>selectedWCNodeId: {selectedWCNodeId ?? 'null'}</div>
            </div>
          </div>
        )}
      </div>

      {(selectedTournament?.structure_mode === 'dynamic' ? loadingBracketTree : loadingStructure) ? (
        <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
          <span>Đang tải...</span>
        </div>
      ) : structureError ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <Trophy size={48} className="opacity-20" />
          <p className="font-medium text-gray-500">Không thể kết nối tới API giải đấu</p>
          <p className="text-sm text-gray-400">Kiểm tra backend và chạy migration + seed dữ liệu</p>
        </div>
      ) : (!structure && !bracketTree) ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-gray-400">
          <Trophy size={48} className="opacity-20" />
          <p>Chưa có dữ liệu giải đấu</p>
        </div>
      ) : (
        <div className="p-6 space-y-5">
          {/* Dynamic tournament: 2-column layout — left tree nav, right detail panel */}
          {isDynamic && bracketTree ? (
            <>
              {(() => {
                const rows: JSX.Element[] = []

                const renderLevel = (nodes: BracketNodeItem[], depth: number, currentPath: BracketNodeItem[]) => {
                  const sorted = [...nodes].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
                  const groupNodes = sorted.filter(n => n.node_type === 'group')
                  // Hide 0-player WC chips after any bracket has been generated
                  const leafNodes = sorted.filter(n => n.node_type === 'weight_class')
                  const pathKey    = currentPath.map(n => n.id).join('-')

                  if (groupNodes.length > 0) {
                    rows.push(
                      <div key={`g-${depth}-${pathKey}`} className="flex items-center gap-1.5 flex-wrap">
                        {groupNodes.map(node => {
                          const isActive = selectedByLevel[depth] === node.id
                          const stats = getGroupStats([node])
                          const hasAthletes = stats.totalPlayers > 0

                          if (isActive) {
                            const btnCls = depth === 0
                              ? 'px-4 py-1 text-sm font-semibold rounded-lg border transition-all bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white border-transparent'
                              : 'px-3 py-0.5 text-xs font-medium rounded-lg border transition-all bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white border-transparent'
                            return (
                              <button key={node.id} onClick={() => handleSelectNode([...currentPath, node])} className={btnCls}>
                                {node.name}
                              </button>
                            )
                          }

                          // Inactive + has athletes → gray collapsed, chỉ hiện tên
                          if (hasAthletes) {
                            return (
                              <button
                                key={node.id}
                                onClick={() => handleSelectNode([...currentPath, node])}
                                className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition-all"
                              >
                                <span className="font-semibold">{node.name}</span>
                              </button>
                            )
                          }

                          // Inactive without athletes → default style
                          const btnCls = depth === 0
                            ? 'px-4 py-1 text-sm font-semibold rounded-lg border transition-all bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            : 'px-3 py-0.5 text-xs font-medium rounded-lg border transition-all bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                          return (
                            <button key={node.id} onClick={() => handleSelectNode([...currentPath, node])} className={btnCls}>
                              {node.name}
                            </button>
                          )
                        })}
                      </div>
                    )
                    const selected = groupNodes.find(n => n.id === selectedByLevel[depth])
                    if (selected?.children.length) {
                      renderLevel(selected.children, depth + 1, [...currentPath, selected])
                    }
                  }

                  if (leafNodes.length > 0) {
                    const emptyRowKey = `l-${depth}-${pathKey}`
                    const withPlayers  = leafNodes.filter(n => (n.leaf_info?.total_players ?? 0) > 0)
                    const emptyNodes   = leafNodes.filter(n => (n.leaf_info?.total_players ?? 0) === 0)
                    const showingEmpty = expandedEmptyRows.has(emptyRowKey)

                    const renderLeaf = (node: typeof leafNodes[0]) => {
                      const players  = node.leaf_info?.total_players ?? 0
                      const bracketSt = node.leaf_info?.bracket_status
                      const isWarn   = players === 1
                      const isOk     = players >= 2
                      const isSelected = selectedWCNodeId === node.id
                      const statusIcon = bracketSt === 'GENERATED'
                        ? <CheckCircle2 size={11} className="text-green-500" />
                        : bracketSt === 'GENERATING'
                        ? <Loader2 size={11} className="text-blue-500 animate-spin" />
                        : <Circle size={11} className={isOk ? 'text-gray-300' : isWarn ? 'text-amber-400' : 'text-gray-200'} />
                      const colorCls = isSelected
                        ? isWarn
                          ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm'
                          : 'border-[var(--color-primary,#1d4ed8)] bg-blue-50 text-[var(--color-primary,#1d4ed8)] shadow-sm'
                        : isWarn
                          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      return (
                        <button
                          key={node.id}
                          onClick={() => handleSelectNode([...currentPath, node])}
                          title={isWarn ? 'Chỉ có 1 VĐV — cần thêm ít nhất 1 VĐV để tạo sơ đồ' : undefined}
                          className={`flex flex-col items-center justify-center rounded-lg border font-medium transition-all flex-shrink-0 w-[60px] h-[52px] ${colorCls}`}
                        >
                          <span className="font-semibold leading-tight text-[11px]">{node.name}</span>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {statusIcon}
                            <span className={`text-[10px] ${isWarn ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                              {players}
                            </span>
                          </div>
                          {isWarn && (
                            <span className="text-[9px] text-amber-500 font-semibold mt-0.5 leading-none">⚠ Thiếu</span>
                          )}
                        </button>
                      )
                    }

                    rows.push(
                      <div key={emptyRowKey} className="flex items-center gap-1.5 flex-wrap pb-1">
                        {withPlayers.map(renderLeaf)}
                        {showingEmpty && emptyNodes.map(renderLeaf)}
                        {emptyNodes.length > 0 && (
                          <button
                            onClick={() => toggleEmptyRow(emptyRowKey)}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-all flex-shrink-0 h-[52px]"
                          >
                            {showingEmpty
                              ? <><span>←</span><span className="ml-0.5">Ẩn bớt</span></>
                              : <><span>+{emptyNodes.length} HC trống</span><span className="ml-0.5">→</span></>
                            }
                          </button>
                        )}
                      </div>
                    )
                  }
                }

                renderLevel(bracketTree.nodes, 0, [])
                return rows
              })()}

              {selectedWCNodeId && effectiveWCData && renderBracketPanel()}
              {selectedWCNodeId && !effectiveWCData && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Users size={40} className="opacity-20" />
                  <p className="text-sm">Cần tối thiểu 2 vận động viên để tạo sơ đồ</p>
                </div>
              )}
              {!selectedWCNodeId && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Trophy size={40} className="opacity-20" />
                  <p className="text-sm">Chưa có hạng cân nào được chọn. Chọn một hạng cân ở trên để xem thông tin.</p>
                </div>
              )}
            </>
          ) : null}

          {/* Legacy tournament rendering (only if NOT dynamic) */}
          {(!selectedTournament?.structure_mode || selectedTournament?.structure_mode === 'legacy') && structure ? (
            <>


          {/* gender tabs — Nam / Nữ */}
          <div className="flex items-center gap-1.5">
            {(['M', 'F'] as const).map((g) => (
              <FilterChip
                key={g}
                label={g === 'M' ? 'Nam' : 'Nữ'}
                active={selectedGender === g}
                onClick={() => handleGenderChange(g)}
              />
            ))}
          </div>

          {/* category tabs */}
          <div className="flex items-center gap-1.5">
            {structure.categories.map((cat) => (
              <FilterChip
                key={cat.category}
                label={CATEGORY_LABELS[cat.category] ?? cat.category}
                active={selectedCategory === cat.category}
                onClick={() => handleCategoryChange(cat.category)}
              />
            ))}
          </div>

          {/* age type selector */}
          {currentAgeTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentAgeTypes.map((at) => (
                <FilterChip
                  key={at.code}
                  label={`Loại ${at.code} (${at.description})`}
                  active={selectedAgeType === at.code}
                  onClick={() => handleAgeTypeChange(at.code)}
                />
              ))}
            </div>
          )}

          {/* weight class selector */}
          {(() => {
            const sorted = [...displayWeightClasses].sort((a, b) => {
              if (a.isVirtual === b.isVirtual) return 0
              return a.isVirtual ? 1 : -1
            })
            const emptyCount = sorted.filter(w => w.isVirtual).length
            const visible = showEmpty ? sorted : sorted.filter(w => !w.isVirtual)

            return (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {sorted.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Không có hạng cân nào</p>
                ) : (
                  <>
                    {visible.map((wc) => (
                      <WeightClassCard
                        key={wc.id}
                        wc={wc}
                        selected={selectedWC === wc.id}
                        onClick={() => setSelectedWC(wc.id)}
                      />
                    ))}
                    {emptyCount > 0 && (
                      <button
                        onClick={() => setShowEmpty(v => !v)}
                        className="flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[64px] rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all text-[11px] gap-0.5"
                        title={showEmpty ? 'Ẩn hạng cân trống' : `Hiện ${emptyCount} hạng cân trống`}
                      >
                        <span className="text-base leading-none">{showEmpty ? '‹' : '›'}</span>
                        <span>{showEmpty ? 'Ẩn' : `+${emptyCount}`}</span>
                        <span>trống</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* bracket panel */}
          {selectedWC && effectiveWCData && renderBracketPanel()}
          </>
          ) : null}
        </div>
      )}

      {showExportModal && selectedTournament && isDynamic && bracketTree && (
        <BracketExportModal
          tournamentId={selectedTournament.id}
          tournamentName={bracketTree.tournament_name}
          selectedNodeId={selectedWCNodeId}
          selectedTreePath={selectedTreePathLabel}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Player info modal */}
      {playerInfoModal && (
        <PlayerInfoModal
          name={playerInfoModal.name}
          studentId={playerInfoModal.studentId}
          tournamentId={selectedTournament?.id ?? null}
          onClose={() => setPlayerInfoModal(null)}
        />
      )}
    </div>
  )
}
