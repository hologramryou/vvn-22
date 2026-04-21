import { Users } from 'lucide-react'
import { useTeamKataMembers } from '../hooks/useTournamentStructure'
import { Modal } from './ui/Modal'
import { EmptyState } from './ui/EmptyState'

interface Props {
  tournamentId: number
  clubId: number
  nodeId: number
  kataId: number
  kataName: string
  clubName: string
  onClose: () => void
}

export function TeamMembersModal({
  tournamentId, clubId, nodeId, kataId, kataName, clubName, onClose,
}: Props) {
  const { data, isLoading, isError } = useTeamKataMembers(tournamentId, clubId, nodeId, kataId)

  return (
    <Modal
      open
      onClose={onClose}
      title={kataName}
      subtitle={clubName}
      size="md"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Đóng
        </button>
      }
    >
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary,#1d4ed8)]" />
        </div>
      )}

      {isError && (
        <p className="py-4 text-center text-sm text-red-600">
          Không thể tải danh sách vận động viên
        </p>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[var(--color-primary-dark,#1e3a5f)]/50" />
            <span className="text-sm text-[var(--color-primary-dark,#1e3a5f)]/70">
              {data.members.length} / {data.team_size} vận động viên
            </span>
          </div>

          {data.members.length === 0 ? (
            <EmptyState message="Chưa có vận động viên được đăng ký" />
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {data.members.map((m, i) => (
                <li key={m.student_id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                  <span className="text-xs text-[var(--color-primary-dark,#1e3a5f)]/50 w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-primary,#1d4ed8)] truncate">{m.student_name}</p>
                    <p className="text-xs text-orange-600 font-medium truncate">{m.club_name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}
