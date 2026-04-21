import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { getRefereeCurrentAssignment } from '../api/tournaments'
import { getUserRole } from '../lib/auth'

export function RefereeConsolePage() {
  const navigate = useNavigate()
  const role = getUserRole()

  const assignmentQ = useQuery({
    queryKey: ['referee-current-assignment'],
    queryFn: getRefereeCurrentAssignment,
    enabled: role === 'referee',
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (assignmentQ.data?.route) {
      navigate(assignmentQ.data.route, { replace: true })
    }
  }, [assignmentQ.data, navigate])

  if (role !== 'referee') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Trọng tài</p>
            <h1 className="text-2xl font-bold text-slate-900">Bàn trọng tài</h1>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          {assignmentQ.isLoading ? (
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 size={18} className="animate-spin" />
              <span>Đang kiểm tra trận đang diễn ra...</span>
            </div>
          ) : assignmentQ.data ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Đã tìm thấy trận hoặc lượt thi đang diễn ra được phân công cho bạn.</p>
              <p className="text-lg font-semibold text-slate-900">{assignmentQ.data.title}</p>
              <p className="text-sm text-slate-500">
                Ghế {assignmentQ.data.judge_slot} • Trạng thái {assignmentQ.data.status}
              </p>
              <button
                onClick={() => navigate(assignmentQ.data.route)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary,#1d4ed8)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark,#1e3a5f)]"
              >
                Vào bàn chấm
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-900">Chưa đến trận được phân công</p>
              <p className="text-sm text-slate-500">
                Khi admin xác nhận bắt đầu trận hoặc lượt thi đã gán cho bạn, màn này sẽ tự chuyển sang đúng layout chấm điểm.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
