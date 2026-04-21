import { useQuery } from '@tanstack/react-query'
import { getQuyenSlotScoring } from '../api/tournaments'
import type { QuyenSlot, QuyenJudgeScore } from '../types/tournament'
import { Modal } from './ui/Modal'

interface QuyenResultsModalProps {
  isOpen: boolean
  slotId: number
  onClose: () => void
}

function formatScore(score: number | null | undefined): string {
  if (score == null) return '--'
  return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

export function QuyenResultsModal({ isOpen, slotId, onClose }: QuyenResultsModalProps) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['quyen-results', slotId],
    queryFn: () => getQuyenSlotScoring(slotId),
    enabled: isOpen && !!slotId,
  })

  const slot = detail?.slot as QuyenSlot | undefined
  const judges = detail?.judges as QuyenJudgeScore[] | undefined
  const isDisqualified = slot?.is_disqualified ?? false

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-blue-200 hover:bg-blue-300 text-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Đóng
        </button>
      }
    >
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        {/* Header */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-blue-600">Kết quả Quyền</p>
          {slot && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold text-gray-900">
                {slot.player_name} {slot.player_club && `(${slot.player_club})`}
              </p>
              {isDisqualified && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 border border-red-300">
                  Bị Loại
                </span>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-gray-400">Đang tải...</p>
          </div>
        ) : slot ? (
          <div className="space-y-3">
            {/* Official Score */}
            <div className={`rounded-2xl border p-4 text-center ${isDisqualified ? 'bg-red-50 border-red-200' : 'bg-blue-100 border-blue-200'}`}>
              <p className={`text-xs font-semibold ${isDisqualified ? 'text-red-600' : 'text-blue-600'}`}>
                {isDisqualified ? 'Bị Loại khỏi phần thi' : 'Điểm chính thức'}
              </p>
              <p className={`mt-2 text-5xl font-black ${isDisqualified ? 'text-red-600' : 'text-blue-600'}`}>
                {isDisqualified ? '—' : formatScore(slot.official_score)}
              </p>
              {!isDisqualified && (
                <p className="mt-1 text-[10px] text-blue-500">
                  Tổng 3 điểm giữa (loại cao nhất và thấp nhất)
                </p>
              )}
            </div>

            {/* Summary Stats */}
            {!isDisqualified && (
              <div className="grid gap-2 grid-cols-3">
                <div className="rounded-lg bg-blue-100 border border-blue-200 p-3 text-center">
                  <p className="text-[10px] text-blue-600 font-semibold">Tổng 5 điểm</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{formatScore(slot.total_judge_score)}</p>
                </div>
                <div className="rounded-lg bg-blue-100 border border-blue-200 p-3 text-center">
                  <p className="text-[10px] text-blue-600 font-semibold">Cao nhất</p>
                  <p className="mt-1 text-lg font-bold text-blue-700">{formatScore(slot.highest_judge_score)}</p>
                </div>
                <div className="rounded-lg bg-blue-100 border border-blue-200 p-3 text-center">
                  <p className="text-[10px] text-blue-600 font-semibold">Thấp nhất</p>
                  <p className="mt-1 text-lg font-bold text-blue-500">{formatScore(slot.lowest_judge_score)}</p>
                </div>
              </div>
            )}

            {/* Judge Scores */}
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-2">Điểm từ 5 trọng tài</p>
              <div className="space-y-1.5">
                {judges?.map((judge) => (
                  <div
                    key={judge.judge_slot}
                    className="flex items-center justify-between rounded-lg bg-white border border-blue-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-xs font-bold text-blue-700">
                        {judge.judge_slot}
                      </span>
                      <span className="text-sm text-gray-700">
                        {judge.assigned_user_name ?? 'Chưa gán'}
                      </span>
                    </div>
                    <span className="text-base font-bold text-blue-600">
                      {judge.score != null ? formatScore(judge.score) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">Không có dữ liệu</p>
        )}
      </div>
    </Modal>
  )
}
