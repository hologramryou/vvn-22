import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Unlock, ExternalLink,
} from 'lucide-react'
import { TreePathPills } from '../components/ui'
import {
  completeQuyenSlot,
  getQuyenSlotScoring,
  startQuyenSlot,
  unlockQuyenJudgeScore,
  resetQuyenSlotTimer,
  resumeQuyenSlot,
  disqualifyQuyenSlot,
} from '../api/tournaments'
import { getUserRole } from '../lib/auth'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ trọng tài sẵn sàng',
  ready: 'Sẵn sàng',
  ongoing: 'Đang thi',
  scoring: 'Đang chấm',
  completed: 'Kết thúc',
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

function stepClass(state: 'done' | 'active' | 'todo'): string {
  if (state === 'done') return 'text-green-600'
  if (state === 'active') return 'text-[#F59E0B]'
  return 'text-[#7C93C9]'
}

function statusTextClass(status: string): string {
  if (status === 'scoring') return 'text-amber-500'
  if (status === 'ongoing') return 'text-blue-700'
  if (status === 'ready') return 'text-green-600'
  if (status === 'completed') return 'text-green-600'
  return 'text-[var(--color-primary,#1d4ed8)]'
}


export function QuyenScoringPage() {
  const { slotId } = useParams<{ slotId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = getUserRole()
  const [now, setNow] = useState(Date.now())
  const localRemainingRef = useRef<number>(0)
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false)
  const [showDurationEditModal, setShowDurationEditModal] = useState(false)
  const [editDuration, setEditDuration] = useState(120)

    useEffect(() => {
      if (role !== 'referee' && role !== 'admin') {
        navigate('/matches', { replace: true })
      }
    }, [navigate, role])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const detailQ = useQuery({
    queryKey: ['quyen-slot-scoring', slotId],
    queryFn: () => getQuyenSlotScoring(Number(slotId)),
      enabled: !!slotId && (role === 'admin' || role === 'referee'),
    refetchInterval: 2000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['quyen-slot-scoring', slotId] })

  const startMut = useMutation({
    mutationFn: () => startQuyenSlot(Number(slotId)),
    onSuccess: refresh,
  })

  const finishMut = useMutation({
    mutationFn: () => completeQuyenSlot(Number(slotId)),
    onSuccess: refresh,
  })

  const unlockMut = useMutation({
    mutationFn: (judgeSlot: number) => unlockQuyenJudgeScore(Number(slotId), judgeSlot),
    onSuccess: refresh,
  })

  const resetTimerMut = useMutation({
    mutationFn: (remaining?: number) => resetQuyenSlotTimer(Number(slotId), remaining !== undefined ? { remaining_seconds: remaining } : undefined),
    onSuccess: refresh,
  })

  const resumeMut = useMutation({
    mutationFn: () => resumeQuyenSlot(Number(slotId)),
    onSuccess: refresh,
  })

  const disqualifyMut = useMutation({
    mutationFn: () => disqualifyQuyenSlot(Number(slotId)),
    onSuccess: refresh,
  })

  const detail = detailQ.data
  const slot = detail?.slot

  const remaining = useMemo(() => {
    if (!slot) return 0
    return getRemainingSeconds(slot.started_at, slot.performance_duration_seconds, now)
  }, [slot, now])

  // Keep localRemainingRef in sync so pause can snapshot the current value
  useEffect(() => {
    localRemainingRef.current = remaining
  }, [remaining])

  useEffect(() => {
    if (!slot || slot.status !== 'ongoing' || slot.started_at === null || remaining > 0 || finishMut.isPending) return
    finishMut.mutate()
  }, [slot, remaining, finishMut])

  if (detailQ.isLoading || !slot) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center text-gray-900">
        <p className="text-lg font-semibold">Đang tải lượt thi Quyền...</p>
      </div>
    )
  }

  const isTimerRunning = slot.status === 'ongoing' && slot.started_at !== null
  const isCompleted = slot.status === 'completed'
  const headerStatusLabel = (STATUS_LABEL[slot.status] ?? slot.status)
  const isAllJudgesSubmitted = slot.submitted_judges_count === 5
  const stepStart: 'done' | 'active' | 'todo' = ['ongoing', 'scoring', 'completed'].includes(slot.status) ? 'done' : slot.status === 'ready' ? 'active' : 'todo'
  const stepScore: 'done' | 'active' | 'todo' = isAllJudgesSubmitted ? 'done' : ['ongoing', 'scoring'].includes(slot.status) ? 'active' : 'todo'
  const stepFinish: 'done' | 'active' | 'todo' = slot.status === 'completed' ? 'done' : slot.status === 'scoring' && isAllJudgesSubmitted ? 'active' : 'todo'

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4 text-[#7C93C9]" style={{
      fontFamily: 'system-ui, -apple-system, sans-serif !important',
      '--tw-font-family': 'system-ui, -apple-system, sans-serif !important'
    } as any}>
      <div className="mx-auto max-w-7xl space-y-2 sm:space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/matches')}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary,#1d4ed8)] bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-light,#eff6ff)] transition-colors" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
            <div className="text-base sm:text-lg font-semibold text-[var(--color-primary,#1d4ed8)] truncate" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>{detail.tournament_name}</div>
          </div>
          <div className="flex items-end gap-2 sm:gap-4 flex-wrap justify-end w-full sm:w-auto">
            <button
              onClick={() => setShowDisqualifyModal(true)}
              disabled={disqualifyMut.isPending}
              className="rounded-lg bg-red-600 px-2 sm:px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
              title="Loại vận động viên khỏi trận đấu"
            >
              {disqualifyMut.isPending ? 'Đang...' : 'Loại khỏi phần thi'}
            </button>
          </div>
        </div>

        {/* Trận số badge — ngoài grid để cả 2 cột bắt đầu cùng mức */}
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary,#1d4ed8)] bg-[var(--color-primary-light,#eff6ff)] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[var(--color-primary,#1d4ed8)]">
          Trận Số {slot.schedule_order ?? '—'} · Sân {slot.court ?? '—'}
        </div>

        {/* Main layout: left content + right sidebar (consistent width throughout) */}
        <div className="grid grid-cols-[1fr_160px] sm:grid-cols-[1fr_180px] gap-2 sm:gap-3">

          {/* LEFT COLUMN: info cards + status + judges */}
          <div className="space-y-2 sm:space-y-2.5 min-w-0">

            {/* Info cards row: player | content+branch | timer */}
            <div className="grid grid-cols-[3fr_4fr_2fr] gap-2 sm:gap-3">
              {/* Player/Unit Info */}
              <div className="flex flex-col gap-1.5 sm:gap-2 rounded-xl bg-white p-2.5 sm:p-3 border border-[#E0E9FF] shadow-sm min-h-[100px]">
                <div>
                  <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">
                    {slot.representative_type === 'club' ? 'Đơn vị' : 'Vận động viên'}:
                  </span>
                  <div className="text-sm sm:text-base font-bold text-orange-600 break-words" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>
                    {slot.representative_type === 'club' ? slot.player_club : slot.player_name}
                  </div>
                </div>
                {slot.representative_type === 'club' && slot.player_name && (
                  <div>
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">Đại diện:</span>
                    <div className="text-xs sm:text-sm font-semibold text-orange-600 break-words">{slot.player_name}</div>
                  </div>
                )}
                {slot.representative_type !== 'club' && slot.player_club && (
                  <div>
                    <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">Đơn vị:</span>
                    <div className="text-xs sm:text-sm font-semibold text-orange-600 break-words">{slot.player_club}</div>
                  </div>
                )}
              </div>

              {/* Content & Branch */}
              <div className="flex flex-col gap-2 rounded-xl bg-white p-2.5 sm:p-3 border border-[#E0E9FF] shadow-sm min-h-[100px]">
                <div>
                  <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">Nội dung thi đấu:</span>
                  <div className="text-xs sm:text-sm font-bold text-orange-600">{slot.content_name}</div>
                </div>
                <div className="border-t border-[#E0E9FF] pt-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">Nhánh đấu:</span>
                  <div className="text-xs sm:text-sm mt-0.5"><TreePathPills treePath={detail.tree_path} /></div>
                </div>
              </div>

              {/* Timer */}
              <div className="rounded-xl bg-white p-2.5 sm:p-3 border border-[#E0E9FF] shadow-sm flex flex-col items-center justify-center min-h-[100px]">
                <div className="text-[11px] sm:text-xs font-semibold text-[var(--color-primary,#1d4ed8)] uppercase tracking-wide">Thời gian</div>
                <div className="mt-1 text-3xl sm:text-4xl font-bold text-orange-500">
                  {isTimerRunning ? formatSeconds(remaining) : formatSeconds(slot.performance_duration_seconds)}
                </div>
              </div>
            </div>

            {/* Status panel */}
            <div className="rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3 shadow-sm space-y-2 flex flex-col">
              <div>
                <div className="text-xs sm:text-sm text-[#2563EB]">Trạng thái</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`text-lg sm:text-xl font-semibold ${statusTextClass(slot.status)}`}>{headerStatusLabel}</div>
                  {slot.is_disqualified && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 border border-red-300">
                      Bị Loại
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {slot.status === 'ready' && (
                  <button
                    onClick={() => startMut.mutate()}
                    disabled={startMut.isPending}
                    className="flex-1 rounded-xl bg-green-600 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {startMut.isPending ? 'Đang...' : 'Vào trận'}
                  </button>
                )}
                {/* ongoing + timer stopped → show Bắt đầu + Reset */}
                {slot.status === 'ongoing' && slot.started_at === null && (
                  <>
                    <button
                      onClick={() => resumeMut.mutate()}
                      disabled={resumeMut.isPending}
                      className="flex-1 rounded-xl bg-green-600 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {resumeMut.isPending ? 'Đang...' : 'Bắt đầu'}
                    </button>
                    <button
                      onClick={() => resetTimerMut.mutate(undefined)}
                      disabled={resetTimerMut.isPending}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  </>
                )}
                {/* ongoing + timer running → show Dừng */}
                {slot.status === 'ongoing' && slot.started_at !== null && (
                  <>
                    <button
                      onClick={() => resetTimerMut.mutate(localRemainingRef.current)}
                      disabled={resetTimerMut.isPending}
                      className="flex-1 rounded-xl bg-orange-500 px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {resetTimerMut.isPending ? 'Đang...' : 'Dừng'}
                    </button>
                    <button
                      onClick={() => finishMut.mutate()}
                      disabled={finishMut.isPending}
                      className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {finishMut.isPending ? 'Đang...' : 'Kết thúc sớm'}
                    </button>
                  </>
                )}
                {slot.status === 'scoring' && isAllJudgesSubmitted && (
                  <button
                    onClick={() => finishMut.mutate()}
                    disabled={finishMut.isPending}
                    className="flex-1 rounded-xl bg-green-600 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {finishMut.isPending ? 'Đang chốt...' : 'Kết thúc trận đấu'}
                  </button>
                )}
                {slot.status === 'completed' && (
                  <div className="flex-1 rounded-xl bg-green-600 px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-semibold text-white">
                    ✓ Đã công bố kết quả
                  </div>
                )}
              </div>

              <div className="mt-1 flex gap-3 text-xs sm:text-sm">
                <div className="text-[var(--color-primary,#1d4ed8)]">Đã xác nhận {slot.submitted_judges_count}/5</div>
              </div>
            </div>

            {/* Judge cards */}
            <div className="grid gap-1.5 sm:gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 auto-rows-max">
              {detail.judges.map((judge) => (
                <div key={judge.judge_slot} className="flex h-full min-h-[110px] sm:min-h-[125px] flex-col rounded-lg sm:rounded-xl bg-white border-2 border-[#E0E9FF] p-2 sm:p-2.5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="rounded-full bg-[#EAF2FF] px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold text-[#2563EB] whitespace-nowrap">Ghế {judge.judge_slot}</div>
                    <div className={`text-[8px] sm:text-[9px] font-semibold whitespace-nowrap px-1 sm:px-1.5 py-0.5 rounded-full ${
                      judge.submitted_at
                        ? 'bg-green-100 text-green-700'
                        : slot.status === 'scoring'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {judge.submitted_at ? 'Đã xác nhận' : 'Sẵn sàng'}
                    </div>
                  </div>

                  {/* Judge Name - allow wrap, no truncate */}
                  <div className="text-xs sm:text-sm font-bold text-orange-600 break-words leading-tight mb-1">
                    {judge.assigned_user_name ? judge.assigned_user_name : 'Chưa gán'}
                  </div>

                  {/* Score Display */}
                  <div className="flex-1 flex items-center justify-center">
                    {judge.score != null ? (
                      <div className="text-2xl sm:text-3xl font-bold text-[var(--color-primary,#1d4ed8)]">
                        {judge.score}
                      </div>
                    ) : (
                      <span className="text-[#BFDBFE] text-sm">—</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-auto flex gap-1 pt-1 sm:pt-1.5">
                    {judge.assigned_user_id && (
                      <button
                        onClick={() => window.open(`/quyen-slots/${slot.id}/judges/${judge.judge_slot}`, '_blank', 'noopener,noreferrer')}
                        className="flex-1 rounded-md sm:rounded-lg border border-[#D6E4FF] bg-[#F8FBFF] px-1 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-xs text-[var(--color-primary,#1d4ed8)] hover:bg-[#EAF2FF] font-semibold"
                      >
                        Chấm
                      </button>
                    )}
                    {judge.score != null && (
                      <button
                        onClick={() => unlockMut.mutate(judge.judge_slot)}
                        className="inline-flex items-center justify-center rounded-md sm:rounded-lg border border-rose-300 bg-rose-50 px-1 sm:px-2 py-0.5 sm:py-1 text-xs text-rose-700 hover:bg-rose-100"
                      >
                        <Unlock size={10} className="sm:w-3 sm:h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR: Màn hình + Điểm + Steps — same width throughout */}
          <div className="flex flex-col gap-2 sm:gap-2.5">

            {/* Màn hình button */}
            <div className="rounded-xl bg-white p-2.5 sm:p-3 border border-[#E0E9FF] shadow-sm flex items-center justify-center min-h-[100px]">
              <button
                onClick={() => window.open(`/display?mode=quyen&slotId=${slot.id}`, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary,#1d4ed8)] bg-[var(--color-primary-light,#eff6ff)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary,#1d4ed8)] hover:text-white transition-colors"
              >
                <span>Màn hình</span>
                <ExternalLink size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            </div>

            {/* Điểm */}
            <div className="rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3 text-center shadow-sm flex flex-col">
              <div className="text-xs sm:text-sm text-[#2563EB]">Điểm</div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold text-blue-700">
                {isCompleted && slot.official_score != null ? formatOfficialScore(slot.official_score) : '—'}
              </div>

              <div className="mt-1.5 grid grid-cols-3 gap-1 text-xs">
                <div className="rounded-lg bg-slate-50 p-1 text-[var(--color-primary,#1d4ed8)]">
                  <div className="text-[10px]">Tổng</div>
                  <div className="mt-0.5 font-semibold text-[var(--color-primary,#1d4ed8)] text-xs">{isCompleted ? (slot.total_judge_score ?? '') : '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-1 text-[var(--color-primary,#1d4ed8)]">
                  <div className="text-[10px]">Cao</div>
                  <div className="mt-0.5 font-semibold text-[var(--color-primary,#1d4ed8)] text-xs">{isCompleted ? (slot.highest_judge_score ?? '') : '—'}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-1 text-[var(--color-primary,#1d4ed8)]">
                  <div className="text-[10px]">Thấp</div>
                  <div className="mt-0.5 font-semibold text-[var(--color-primary,#1d4ed8)] text-xs">{isCompleted ? (slot.lowest_judge_score ?? '') : '—'}</div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3 shadow-sm space-y-0.5 text-xs flex flex-col">
              <div className={stepClass(stepStart)}>1. Bắt đầu</div>
              <div className={stepClass(stepScore)}>2. Nhận điểm</div>
              <div className={stepClass(stepFinish)}>3. Chốt kết quả</div>
            </div>
          </div>

        </div>

      </div>

      {showDisqualifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-lg max-w-sm">
            <h3 className="text-xl font-bold text-[#C2410C] mb-4">Xác nhận loại vận động viên</h3>
            <p className="text-sm text-[#7C93C9] mb-2">
              Vận động viên: <span className="font-semibold text-[#1E3A8A]">{slot.player_name}</span>
            </p>
            <p className="text-sm text-[#7C93C9] mb-4">
              Hành động này sẽ:
            </p>
            <ul className="text-xs text-[#7C93C9] space-y-1 mb-6 ml-4 list-disc">
              <li>Kết thúc trận đấu ngay lập tức</li>
              <li>Đặt tất cả điểm trọng tài = 0</li>
              <li>Ghi nhận trạng thái "Loại"</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisqualifyModal(false)}
                disabled={disqualifyMut.isPending}
                className="flex-1 rounded-lg border border-[#D6E4FF] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary,#1d4ed8)] hover:bg-[#F7FAFF] disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  disqualifyMut.mutate(undefined, {
                    onSuccess: () => {
                      setShowDisqualifyModal(false);
                      qc.invalidateQueries({ queryKey: ['schedule'] })
                      qc.invalidateQueries({ queryKey: ['quyen-results'] })
                      navigate('/matches')
                    },
                  })
                }}
                disabled={disqualifyMut.isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disqualifyMut.isPending ? 'Đang xử lý...' : 'Xác nhận loại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDurationEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white p-6 shadow-lg max-w-sm">
            <h3 className="text-xl font-bold text-blue-600 mb-4">Sửa Thời Gian Biểu Diễn</h3>
            <p className="text-sm text-[#7C93C9] mb-4">
              Vận động viên: <span className="font-semibold text-[#1E3A8A]">{slot?.player_name}</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#7C93C9] mb-2">
                Số giây:
              </label>
              <input
                type="number"
                min="30"
                max="300"
                value={editDuration}
                onChange={(e) => setEditDuration(Math.max(30, Math.min(300, parseInt(e.target.value) || 120)))}
                className="w-full rounded-lg border-2 border-blue-200 px-3 py-2 text-lg font-semibold text-blue-700 text-center"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDurationEditModal(false)}
                className="flex-1 rounded-lg border border-[#D6E4FF] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary,#1d4ed8)] hover:bg-[#F7FAFF]"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  setShowDurationEditModal(false)
                  // Note: To actually update duration, we'd need a backend endpoint
                  // For now, this just closes the modal
                }}
                className="flex-1 rounded-lg bg-[var(--color-primary,#1d4ed8)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark,#1e3a5f)]"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
