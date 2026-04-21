import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getQuyenSlotScoring, updateQuyenJudgeSetup } from '../api/tournaments'
import { getUsers } from '../api/users'
import { getUserRole } from '../lib/auth'
import type { QuyenJudgePanelOut, QuyenScoringDetail } from '../types/tournament'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ setup trọng tài',
  ready: 'Sẵn sàng',
  checking: 'Chờ trọng tài sẵn sàng',
  ongoing: 'Đang thi',
  scoring: 'Đang chấm',
  completed: 'Kết thúc',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-[#D9E6FF] bg-[#F7FAFF] text-[var(--color-primary-dark,#1e3a5f)]/70',
  ready: 'border-[#BFDBFE] bg-[#F4F8FF] text-[var(--color-primary,#1d4ed8)]',
  checking: 'border-amber-200 bg-amber-50 text-amber-700',
  ongoing: 'border-amber-200 bg-amber-50 text-amber-700',
  scoring: 'border-sky-200 bg-sky-50 text-sky-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const JUDGE_SLOTS = [1, 2, 3, 4, 5] as const

function InfoTile({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[#DBEAFE] bg-[#F8FBFF] px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_8px_22px_rgba(37,99,235,0.05)]">
      <p className="text-xs sm:text-sm font-medium text-[var(--color-primary,#1d4ed8)]">{label}</p>
      {children ?? (
        <p className="mt-1 text-base sm:text-lg font-semibold tracking-[-0.02em] text-orange-700">{value}</p>
      )}
    </div>
  )
}

function SetupSeatCard({
  judge,
  assignedUserId,
  referees,
  selectedJudgeIds,
  disabled,
  onChange,
}: {
  judge: QuyenJudgePanelOut
  assignedUserId: number | null
  referees: Array<{ id: number; full_name: string }>
  selectedJudgeIds: number[]
  disabled: boolean
  onChange: (value: number | null) => void
}) {
  const assigned = assignedUserId != null

  return (
    <article
      className={`rounded-[22px] border p-3 sm:p-4 transition ${
        assigned
          ? 'border-[#BFDBFE] bg-[#F8FBFF] shadow-[0_12px_30px_rgba(37,99,235,0.08)]'
          : 'border-[#E6EEFF] bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-[var(--color-primary,#1d4ed8)]">
          Ghế {judge.judge_slot}
        </span>

        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs sm:text-sm font-medium ${
            assigned
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-[var(--color-primary-dark,#1e3a5f)]/50'
          }`}
        >
          {assigned ? 'Đã gán' : 'Chưa gán'}
        </span>
      </div>

      <div className="mt-3 sm:mt-4">
        <label className="block text-sm font-medium text-[var(--color-primary,#1d4ed8)]">
          {assigned ? 'Trọng tài được gán' : 'Chọn trọng tài'}
        </label>
        <select
          value={assignedUserId ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
          className={`mt-3 w-full rounded-[18px] border px-4 py-3 text-base outline-none transition disabled:cursor-not-allowed disabled:bg-blue-50/30 ${
            assigned
              ? 'border-[#FED7AA] bg-[#FFF7ED] font-semibold text-orange-700 focus:border-[#FB923C]'
              : 'border-[#DBEAFE] bg-white text-[var(--color-primary-dark,#1e3a5f)] focus:border-[#60A5FA]'
          }`}
        >
          <option value="">Chọn account trọng tài</option>
          {referees
            .filter((user) => user.id === assignedUserId || !selectedJudgeIds.includes(user.id))
            .map((user) => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
        </select>
      </div>
    </article>
  )
}

export function QuyenSetupPage() {
  const { slotId } = useParams<{ slotId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = getUserRole()

  const [durationSeconds, setDurationSeconds] = useState(120)
  const [assignedJudges, setAssignedJudges] = useState<Record<number, number | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
  })

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/matches', { replace: true })
    }
  }, [navigate, role])

  const detailQ = useQuery({
    queryKey: ['quyen-slot-scoring', slotId],
    queryFn: () => getQuyenSlotScoring(Number(slotId)),
    enabled: !!slotId && role === 'admin',
    refetchInterval: 2000,
  })

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: role === 'admin',
  })

  useEffect(() => {
    if (!detailQ.data) return
    setDurationSeconds(detailQ.data.slot.performance_duration_seconds)
    const next: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null }
    detailQ.data.judges.forEach((judge) => {
      next[judge.judge_slot] = judge.assigned_user_id
    })
    setAssignedJudges(next)
  }, [detailQ.data])

  const refresh = () => qc.invalidateQueries({ queryKey: ['quyen-slot-scoring', slotId] })

  const saveSetupMut = useMutation({
    mutationFn: () => updateQuyenJudgeSetup(Number(slotId), {
      performance_duration_seconds: durationSeconds,
      judges: JUDGE_SLOTS.map((judgeSlot) => ({
        judge_slot: judgeSlot,
        user_id: assignedJudges[judgeSlot]!,
      })),
    }),
    onSuccess: (data) => {
      // Invalidate schedule queries
      const tournamentId = (detailQ.data as QuyenScoringDetail | undefined)?.slot?.tournament_id
      if (tournamentId) {
        qc.invalidateQueries({ queryKey: ['schedule', tournamentId] })
        qc.invalidateQueries({ queryKey: ['schedule'] })
      }
      // Navigate and reload
      navigate('/matches', { replace: true })
      setTimeout(() => {
        window.location.reload()
      }, 100)
    },
  })

  const detail = detailQ.data as QuyenScoringDetail | undefined
  const slot = detail?.slot
  const isLocked = !!slot && ['checking', 'ongoing', 'scoring', 'completed'].includes(slot.status)

  const referees = useMemo(
    () => (usersQ.data ?? []).filter(
      (user) => user.role === 'referee' && user.tournament_ids.includes(slot?.tournament_id ?? -1),
    ),
    [usersQ.data, slot?.tournament_id],
  )

  const assignedCount = JUDGE_SLOTS.filter((judgeSlot) => assignedJudges[judgeSlot] != null).length
  const selectedJudgeIds = JUDGE_SLOTS
    .map((judgeSlot) => assignedJudges[judgeSlot])
    .filter((value): value is number => value != null)
  const canSaveSetup = selectedJudgeIds.length === 5 && new Set(selectedJudgeIds).size === 5 && durationSeconds >= 10

  if (detailQ.isLoading || !slot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FF] font-sans text-slate-800">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-[var(--color-primary,#1d4ed8)]" />
          <p className="text-lg font-semibold text-[var(--color-primary-dark,#1e3a5f)]">Đang tải lượt thi Quyền...</p>
        </div>
      </div>
    )
  }

  const headerStatusLabel = STATUS_LABEL[slot.status] ?? slot.status

  return (
    <div className="min-h-screen bg-[#F4F8FF] p-2 sm:p-3 md:p-4 font-sans text-[var(--color-primary-dark,#1e3a5f)]">
      <div className="mx-auto w-full space-y-2.5 sm:space-y-3 md:space-y-4" style={{maxWidth: '95%'}}>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              onClick={() => navigate('/matches')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-primary-dark,#1e3a5f)] shadow-[0_10px_24px_rgba(37,99,235,0.06)] transition hover:bg-[#F8FBFF]"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Quay lại</span>
            </button>
            <div>
              <p className="text-xs sm:text-sm font-medium tracking-[0.02em] text-[var(--color-primary,#1d4ed8)]">Setup trọng tài Quyền</p>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-[-0.03em] text-[var(--color-primary-dark,#1e3a5f)]">{detail.tournament_name}</h1>
            </div>
          </div>

          <span className={`inline-flex shrink-0 items-center rounded-full border px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium ${STATUS_STYLE[slot.status]}`}>
            {headerStatusLabel}
          </span>
        </div>

        <section className="rounded-[20px] sm:rounded-[24px] md:rounded-[28px] border border-[#D9E6FF] bg-white px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)]">
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-1 sm:space-y-2">
              <p className="text-xs sm:text-sm font-medium tracking-[0.02em] text-[var(--color-primary,#1d4ed8)]">Vận động viên / đội</p>
              <div>
                <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold tracking-[-0.04em] text-orange-700">
                  {slot.player_name}
                </h1>
                <p className="mt-0.5 sm:mt-1 text-sm sm:text-base text-[var(--color-primary-dark,#1e3a5f)]/70">{slot.player_club ?? '—'}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:gap-2.5 sm:grid-cols-2">
              <InfoTile label="Nội dung" value={slot.content_name} />
              <InfoTile label="Nhánh thi đấu" value={detail.tree_path ?? '—'} />
              <InfoTile label="Thứ tự thi" value={`STT #${slot.schedule_order ?? '—'}`} />
              <InfoTile label="Thời lượng">
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    disabled={isLocked}
                    className="w-full rounded-xl border border-[#DBEAFE] bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-base sm:text-lg font-semibold tracking-[-0.02em] text-[var(--color-primary-dark,#1e3a5f)] outline-none transition focus:border-[#60A5FA] disabled:cursor-not-allowed disabled:bg-blue-50/30"
                  />
                  <span className="whitespace-nowrap text-xs sm:text-sm font-medium text-[var(--color-primary,#1d4ed8)]">giây</span>
                </div>
              </InfoTile>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] sm:rounded-[24px] md:rounded-[28px] border border-[#D9E6FF] bg-white px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-2.5 sm:gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium tracking-[0.02em] text-[var(--color-primary,#1d4ed8)]">Cấu hình trọng tài</p>
              <h2 className="mt-0.5 sm:mt-1 text-lg sm:text-xl md:text-2xl font-semibold tracking-[-0.03em] text-[var(--color-primary-dark,#1e3a5f)]">
                Gán trọng tài cho 5 ghế chấm
              </h2>
            </div>

            <span className="inline-flex shrink-0 items-center rounded-full border border-[#D9E6FF] bg-[#F7FAFF] px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-[var(--color-primary-dark,#1e3a5f)]/70">
              {assignedCount}/5 ghế đã gán
            </span>
          </div>

          <div className="mt-3 sm:mt-4 grid gap-2.5 sm:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {detail.judges.map((judge) => {
              const assignedUserId = assignedJudges[judge.judge_slot]

              return (
                <SetupSeatCard
                  key={judge.judge_slot}
                  judge={judge}
                  assignedUserId={assignedUserId}
                  referees={referees}
                  selectedJudgeIds={selectedJudgeIds}
                  disabled={isLocked}
                  onChange={(value) => setAssignedJudges((prev) => ({
                    ...prev,
                    [judge.judge_slot]: value,
                  }))}
                />
              )
            })}
          </div>

          <div className="mt-3 sm:mt-4 md:mt-5 flex justify-start">
            <button
              type="button"
              onClick={() => saveSetupMut.mutate()}
              disabled={!canSaveSetup || saveSetupMut.isPending || isLocked}
              className="inline-flex items-center rounded-xl bg-[var(--color-primary,#1d4ed8)] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveSetupMut.isPending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin sm:w-4 sm:h-4" />
              ) : (
                <Save size={14} className="mr-1.5 sm:w-4 sm:h-4" />
              )}
              Lưu cấu hình
            </button>
          </div>

          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--color-primary-dark,#1e3a5f)]/70">
            Chọn đủ 5 trọng tài khác nhau rồi bấm lưu cấu hình. Sau khi admin bắt đầu lượt thi, màn setup sẽ bị khóa và không thể sửa nữa.
          </p>
        </section>
      </div>
    </div>
  )
}
