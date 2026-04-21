import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getMatchDetailCloud, updateMatchJudgeSetup } from '../api/tournaments'
import { getUsers } from '../api/users'
import { getUserRole } from '../lib/auth'
import type { MatchDetail, MatchJudgeAssignment } from '../types/tournament'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ setup trọng tài',
  ready: 'Sẵn sàng',
  checking: 'Chờ trọng tài sẵn sàng',
  ongoing: 'Đang thi đấu',
  completed: 'Kết thúc',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-[#D9E6FF] bg-[#F7FAFF] text-[var(--color-primary-dark,#1e3a5f)]/70',
  ready: 'border-[#BFDBFE] bg-[#F4F8FF] text-[var(--color-primary,#1d4ed8)]',
  checking: 'border-amber-200 bg-amber-50 text-amber-700',
  ongoing: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const JUDGE_SLOTS = [1, 2, 3, 4, 5] as const

function InfoTile({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-4 shadow-[0_8px_22px_rgba(37,99,235,0.05)]">
      <p className="text-sm font-medium text-[var(--color-primary,#1d4ed8)]">{label}</p>
      {children ?? (
        <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-orange-700">{value}</p>
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
  judge: MatchJudgeAssignment
  assignedUserId: number | null
  referees: Array<{ id: number; full_name: string }>
  selectedJudgeIds: number[]
  disabled: boolean
  onChange: (value: number | null) => void
}) {
  const assigned = assignedUserId != null

  return (
    <article
      className={`rounded-[28px] border p-5 transition ${
        assigned
          ? 'border-[#BFDBFE] bg-[#F8FBFF] shadow-[0_12px_30px_rgba(37,99,235,0.08)]'
          : 'border-[#E6EEFF] bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-3 py-1 text-sm font-semibold text-[var(--color-primary,#1d4ed8)]">
          Ghế {judge.judge_slot}
        </span>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            assigned
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-[var(--color-primary-dark,#1e3a5f)]/50'
          }`}
        >
          {assigned ? 'Đã gán' : 'Chưa gán'}
        </span>
      </div>

      <div className="mt-5">
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

export function MatchSetupPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = getUserRole()

  const [assignedJudges, setAssignedJudges] = useState<Record<number, number | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
  })
  const initializedRef = useRef(false)

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/matches', { replace: true })
      return
    }
  }, [navigate, role])

  const detailQ = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchDetailCloud(Number(matchId)),
    enabled: !!matchId,
    refetchInterval: 2000,
  })

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!matchId,
  })

  useEffect(() => {
    if (!detailQ.data || initializedRef.current) return
    initializedRef.current = true
    const next: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null, 5: null }
    detailQ.data.judges.forEach((judge) => {
      next[judge.judge_slot] = judge.assigned_user_id
    })
    setAssignedJudges(next)
  }, [detailQ.data])

  const refresh = () => qc.invalidateQueries({ queryKey: ['match', matchId] })

  const saveSetupMut = useMutation({
    mutationFn: () => updateMatchJudgeSetup(Number(matchId), {
      judges: JUDGE_SLOTS.map((judgeSlot) => ({
        judge_slot: judgeSlot,
        user_id: assignedJudges[judgeSlot]!,
      })),
    }),
    onSuccess: (data) => {
      // Invalidate schedule queries
      const tournamentId = (detailQ.data as MatchDetail | undefined)?.tournament_id
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

  const match = detailQ.data as MatchDetail | undefined
  const isLocked = !!match && ['checking', 'ongoing', 'completed'].includes(match.status)

  const referees = useMemo(
    () => (usersQ.data ?? []).filter(
      (user) => user.role === 'referee' && user.tournament_ids.includes(match?.tournament_id ?? -1),
    ),
    [usersQ.data, match?.tournament_id],
  )

  const assignedCount = JUDGE_SLOTS.filter((judgeSlot) => assignedJudges[judgeSlot] != null).length
  const selectedJudgeIds = JUDGE_SLOTS
    .map((judgeSlot) => assignedJudges[judgeSlot])
    .filter((value): value is number => value != null)
  const canSaveSetup = selectedJudgeIds.length === 5 && new Set(selectedJudgeIds).size === 5

  if (detailQ.isLoading || !match) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FF] font-sans text-slate-800">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin text-[var(--color-primary,#1d4ed8)]" />
          <p className="text-lg font-semibold text-[var(--color-primary-dark,#1e3a5f)]">Đang tải thông tin trận đấu...</p>
        </div>
      </div>
    )
  }

  const headerStatusLabel = STATUS_LABEL[match.status] ?? match.status

  return (
    <div className="min-h-screen bg-[#F4F8FF] p-6 font-sans text-[var(--color-primary-dark,#1e3a5f)] md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/matches')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D9E6FF] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-dark,#1e3a5f)] shadow-[0_10px_24px_rgba(37,99,235,0.06)] transition hover:bg-[#F8FBFF]"
            >
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <div>
              <p className="text-sm font-medium tracking-[0.02em] text-[var(--color-primary,#1d4ed8)]">Setup trọng tài Đối kháng</p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--color-primary-dark,#1e3a5f)]">
                {match.weight_class_name} - {match.gender === 'M' ? 'Nam' : 'Nữ'}
              </h1>
            </div>
          </div>

          <span className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${STATUS_STYLE[match.status]}`}>
            {headerStatusLabel}
          </span>
        </div>

        <section className="rounded-[32px] border border-[#D9E6FF] bg-white px-6 py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)] md:px-8 md:py-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <p className="text-sm font-medium tracking-[0.02em] text-[var(--color-primary,#1d4ed8)]">Vận động viên</p>
              <div>
                <div className="flex gap-8">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-primary-dark,#1e3a5f)]/70">Vận động viên 1</h3>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-red-600 md:text-4xl">
                      {match.player1_name || 'TBD'}
                    </h1>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-primary-dark,#1e3a5f)]/70">Vận động viên 2</h3>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-blue-600 md:text-4xl">
                      {match.player2_name || 'TBD'}
                    </h1>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Hạng cân" value={match.weight_class_name} />
              <InfoTile label="Giới tính" value={match.gender === 'M' ? 'Nam' : 'Nữ'} />
              <InfoTile label="Vòng" value={match.round_label ?? `Vòng ${match.round}`} />
              <InfoTile label="Sân" value={match.court ?? '—'} />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#D9E6FF] bg-white px-6 py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)] md:px-8 md:py-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-[var(--color-primary,#1d4ed8)]">Cấu hình trọng tài</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--color-primary-dark,#1e3a5f)]">
                Gán trọng tài cho 5 ghế chấm
              </h2>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-[#D9E6FF] bg-[#F7FAFF] px-4 py-2 text-sm font-medium text-[var(--color-primary-dark,#1e3a5f)]/70">
              {assignedCount}/5 ghế đã gán
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {match.judges.map((judge) => {
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

          <div className="mt-8 flex justify-start">
            <button
              type="button"
              onClick={() => saveSetupMut.mutate()}
              disabled={!canSaveSetup || saveSetupMut.isPending || isLocked}
              className="inline-flex items-center rounded-2xl bg-[var(--color-primary,#1d4ed8)] px-5 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveSetupMut.isPending ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <Save size={18} className="mr-2" />
              )}
              Lưu cấu hình
            </button>
          </div>

          <p className="mt-4 text-sm text-[var(--color-primary-dark,#1e3a5f)]/70">
            Chọn đủ 5 trọng tài khác nhau rồi bấm lưu cấu hình. Sau khi admin bắt đầu trận đấu, màn setup sẽ bị khóa và không thể sửa nữa.
          </p>
        </section>
      </div>
    </div>
  )
}
