import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getQuyenJudgePanel, setQuyenJudgeReady, submitQuyenJudgeScore } from '../api/tournaments'
import { TreePathPills } from '../components/ui'
import { getUserRole } from '../lib/auth'

const SCORE_OPTIONS = Array.from({ length: 21 }, (_, index) => 80 + index)

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ trọng tài sẵn sàng',
  ready: 'Sẵn sàng',
  checking: 'Chờ trọng tài sẵn sàng',
  ongoing: 'Đang thi',
  scoring: 'Đang chấm',
  completed: 'Đã xác nhận',
}

function statusClass(status: string): string {
  if (status === 'completed') return 'text-emerald-600'
  if (status === 'scoring') return 'text-amber-500'
  if (status === 'checking') return 'text-amber-600'
  if (status === 'ongoing') return 'text-[#2563EB]'
  return 'text-[var(--color-primary,#1d4ed8)]'
}


export function QuyenJudgePage() {
  const { slotId, judgeSlot } = useParams<{ slotId: string; judgeSlot: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = getUserRole()
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    if (!['admin', 'referee'].includes(role)) {
      navigate('/matches', { replace: true })
    }
  }, [navigate, role])

  const panelQ = useQuery({
    queryKey: ['quyen-judge-panel', slotId, judgeSlot],
    queryFn: () => getQuyenJudgePanel(Number(slotId), Number(judgeSlot)),
    enabled: !!slotId && !!judgeSlot,
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (!panelQ.data) return
    setScore(panelQ.data.judge.score)
  }, [panelQ.data])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['quyen-judge-panel', slotId, judgeSlot] })
    qc.invalidateQueries({ queryKey: ['quyen-slot-scoring', slotId] })
    qc.invalidateQueries({ queryKey: ['display-quyen-slot', slotId] })
  }

  const readyMut = useMutation({
    mutationFn: (ready: boolean) => setQuyenJudgeReady(Number(slotId), Number(judgeSlot), ready),
    onSuccess: refresh,
  })

  const submitMut = useMutation({
    mutationFn: () => submitQuyenJudgeScore(Number(slotId), Number(judgeSlot), { score: score! }),
    onSuccess: refresh,
  })

  const panel = panelQ.data
  const slot = panel?.slot
  const judge = panel?.judge

  // Auto-return to console when slot is completed
  useEffect(() => {
    if (slot?.status === 'completed') {
      qc.removeQueries({ queryKey: ['referee-current-assignment'] })
      navigate('/referee-console', { replace: true })
    }
  }, [slot?.status, navigate, qc])

  if (panelQ.isLoading || !panel || !slot || !judge) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FF] font-sans text-slate-800">
        <p className="text-lg font-semibold">Đang tải bàn chấm điểm...</p>
      </div>
    )
  }

  const isWaiting = slot.status === 'checking'
  const canSubmit = slot.status === 'scoring' && score != null && judge.score == null

  return (
    <div className="min-h-screen bg-[#F4F8FF] text-slate-800" style={{
      fontFamily: 'system-ui, -apple-system, sans-serif !important',
      '--tw-font-family': 'system-ui, -apple-system, sans-serif !important'
    } as any}>
      <div className="mx-auto max-w-6xl px-2 sm:px-3 py-2 sm:py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border border-[#D9E6FF] bg-white px-2 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-primary,#1d4ed8)] shadow-[0_10px_24px_rgba(37,99,235,0.06)] hover:bg-[#F7FAFF]" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>
          <div className="rounded-full border border-[#BFDBFE] bg-[#EAF2FF] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#2563EB]" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>
            Ghế {judge.judge_slot}
          </div>
        </div>

        <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-[20px] sm:rounded-[28px] border border-[#D9E6FF] bg-white p-3 sm:p-5 shadow-[0_16px_48px_rgba(37,99,235,0.08)]" style={{fontFamily: 'system-ui, -apple-system, sans-serif !important'}}>
            <p className="text-xs sm:text-sm font-medium tracking-[-0.02em] text-[#3B82F6]">Bài thi hiện tại</p>
            <h1 className="mt-2 sm:mt-3 text-lg sm:text-2xl md:text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#C2410C]">
              {slot.player_name}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#7C93C9]">{slot.player_club ?? '—'}</p>

            <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 text-[11px] sm:text-xs">
              <div className="rounded-lg border border-[#E0E9FF] bg-[#F8FBFF] p-2">
                <p className="font-medium text-[#3B82F6]">Nội dung</p>
                <p className="mt-0.5 font-semibold text-[#1E3A8A] line-clamp-2">{slot.content_name}</p>
              </div>
              <div className="rounded-lg border border-[#E0E9FF] bg-[#F8FBFF] p-2">
                <p className="font-medium text-[#3B82F6]">Sân</p>
                <p className="mt-0.5 font-semibold text-[var(--color-primary,#1d4ed8)]">{slot.court ?? '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-[#E0E9FF] bg-[#F8FBFF] p-2">
                <p className="font-medium text-[#3B82F6] mb-0.5">Nhánh thi đấu</p>
                <div className="flex flex-wrap gap-1"><TreePathPills treePath={panel.tree_path} size="sm" /></div>
              </div>
              <div className="rounded-lg border border-[#E0E9FF] bg-[#F8FBFF] p-2">
                <p className="font-medium text-[#3B82F6]">Trọng tài</p>
                <p className="mt-0.5 font-semibold text-[#C2410C] line-clamp-2">{judge.assigned_user_name ?? 'Chưa gán'}</p>
              </div>
              <div className="rounded-lg border border-[#E0E9FF] bg-[#F8FBFF] p-2">
                <p className="font-medium text-[#3B82F6]">Trạng thái</p>
                <p className={`mt-0.5 font-semibold text-xs ${statusClass(slot.status)}`}>
                  {STATUS_LABEL[slot.status] ?? slot.status}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] sm:rounded-[28px] border border-[#D9E6FF] bg-white p-3 sm:p-5 shadow-[0_16px_48px_rgba(37,99,235,0.08)]">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium tracking-[-0.02em] text-[#3B82F6]">Bàn chấm</p>
                <h2 className="mt-1 sm:mt-2 text-sm sm:text-lg md:text-xl font-semibold tracking-[-0.02em] text-[#1E3A8A]">Chọn điểm 80-100</h2>
              </div>
              <div className="text-right min-w-[60px] sm:min-w-[80px]">
                <p className="text-xs font-medium text-[#7C93C9]">Điểm</p>
                <p className="mt-0.5 text-2xl sm:text-3xl md:text-4xl font-semibold leading-none tracking-[-0.02em] text-[#2563EB]">
                  {score ?? '--'}
                </p>
              </div>
            </div>

            {isWaiting && (
              <div className="mt-3 sm:mt-4 rounded-[16px] sm:rounded-[22px] border border-[#BFDBFE] bg-[#F4F8FF] p-3">
                <p className="text-xs sm:text-sm text-[var(--color-primary,#1d4ed8)]">Xác nhận sẵn sàng trước khi bắt đầu.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => readyMut.mutate(true)}
                    disabled={readyMut.isPending || judge.is_ready}
                    className="rounded-lg sm:rounded-xl bg-[var(--color-primary,#1d4ed8)] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-50"
                  >
                    Sẵn sàng
                  </button>
                  <button
                    onClick={() => readyMut.mutate(false)}
                    disabled={readyMut.isPending || !judge.is_ready}
                    className="rounded-lg sm:rounded-xl border border-[#D9E6FF] bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[var(--color-primary,#1d4ed8)] hover:bg-[#F7FAFF] disabled:opacity-50"
                  >
                    Bỏ sẵn sàng
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 sm:mt-4 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-7 xl:grid-cols-10 gap-1.5 sm:gap-2">
              {SCORE_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => setScore(value)}
                  disabled={slot.status !== 'scoring' || judge.score != null}
                  className={`rounded-[14px] sm:rounded-[20px] border px-1.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold transition ${
                    score === value
                      ? 'border-[#2563EB] bg-[#EAF2FF] text-[#1E3A8A]'
                      : 'border-[#D9E6FF] bg-[#F8FBFF] text-[#7C93C9] hover:bg-[#EEF5FF]'
                  } disabled:opacity-45`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-2 sm:mt-3 rounded-[16px] sm:rounded-[22px] border border-[#D9E6FF] bg-[#F8FBFF] p-2 sm:p-3">
              {judge.score != null ? (
                <div className="flex items-center gap-2 sm:gap-3 text-emerald-600">
                  <CheckCircle2 size={16} className="flex-shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold">Điểm được ghi nhận</p>
                    <p className="text-[10px] sm:text-xs text-[#7C93C9]">Công bố khi đủ 5/5 trọng tài.</p>
                  </div>
                </div>
              ) : slot.status !== 'scoring' ? (
                <p className="text-xs sm:text-sm text-[#7C93C9]">Chưa đến giai đoạn nhập điểm.</p>
              ) : (
                <p className="text-xs sm:text-sm text-[#7C93C9]">Điểm trọng tài khác được ẩn trong quá trình chấm.</p>
              )}
            </div>

            <div className="mt-2 sm:mt-4 flex justify-end">
              <button
                onClick={() => submitMut.mutate()}
                disabled={!canSubmit || submitMut.isPending}
                className="rounded-lg sm:rounded-2xl bg-[var(--color-primary,#1d4ed8)] px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.20)] hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-40"
              >
                Đã xác nhận điểm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
