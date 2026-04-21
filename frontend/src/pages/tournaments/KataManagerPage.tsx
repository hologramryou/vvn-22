import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, ChevronRight } from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'
import {
  useKatas,
  useCreateKata,
  useUpdateKata,
  useDeleteKata,
  useReorderKatas,
} from '../../hooks/useTournamentStructure'
import type { TournamentKata } from '../../types/tournament'

type KataDivision = 'individual' | 'team'

// ── AddKataModal ───────────────────────────────────────────────────────────

function AddKataModal({
  division,
  onClose,
  onSubmit,
  isLoading,
}: {
  division: KataDivision
  onClose: () => void
  onSubmit: (name: string, description: string | null, teamSize?: number, minTeamSize?: number | null) => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamSize, setTeamSize] = useState(2)
  const [minTeamSize, setMinTeamSize] = useState<number | null>(null)

  const minTeamSizeError = minTeamSize !== null && minTeamSize < 2

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || minTeamSizeError) return
    onSubmit(
      name.trim(),
      description.trim() || null,
      division === 'team' ? teamSize : undefined,
      division === 'team' ? minTeamSize : undefined,
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Thêm Bài Quyền</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên bài quyền <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              placeholder="VD: Quyền Cầu Thủ"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Mô tả bài quyền (không bắt buộc)"
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            />
          </div>
          {division === 'team' && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số người tối đa / đội <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={teamSize}
                  onChange={e => setTeamSize(Math.max(2, parseInt(e.target.value) || 2))}
                  min={2}
                  max={20}
                  className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số người tối thiểu / đội
                  <span className="ml-1 text-xs text-gray-400">(để trống = không bắt buộc)</span>
                </label>
                <input
                  type="number"
                  value={minTeamSize ?? ''}
                  onChange={e => setMinTeamSize(e.target.value ? parseInt(e.target.value) || 1 : null)}
                  min={2}
                  max={teamSize}
                  placeholder="Không giới hạn"
                  className={`w-32 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${minTeamSizeError ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-[var(--color-primary,#1d4ed8)]'}`}
                />
                {minTeamSizeError && (
                  <p className="text-xs text-red-600 mt-1">Phải từ 2 người trở lên</p>
                )}
                {!minTeamSizeError && minTeamSize !== null && minTeamSize === teamSize && (
                  <p className="text-xs text-blue-600 mt-1">Bắt buộc đúng {teamSize} người</p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading || minTeamSizeError}
              className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? 'Đang thêm...' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EditKataModal ──────────────────────────────────────────────────────────

function EditKataModal({
  kata,
  onClose,
  onSubmit,
  isLoading,
}: {
  kata: TournamentKata
  onClose: () => void
  onSubmit: (name: string, description: string | null, teamSize?: number, minTeamSize?: number | null) => void
  isLoading: boolean
}) {
  const [name, setName] = useState(kata.name)
  const [description, setDescription] = useState(kata.description ?? '')
  const [teamSize, setTeamSize] = useState(kata.team_size ?? 2)
  const [minTeamSize, setMinTeamSize] = useState<number | null>(kata.min_team_size ?? null)

  const minTeamSizeError = minTeamSize !== null && minTeamSize < 2

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || minTeamSizeError) return
    onSubmit(name.trim(), description.trim() || null, kata.division === 'team' ? teamSize : undefined, kata.division === 'team' ? minTeamSize : undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Sửa Bài Quyền</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên bài quyền <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            />
          </div>
          {kata.division === 'team' && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số người tối đa / đội <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={teamSize}
                  onChange={e => setTeamSize(Math.max(2, parseInt(e.target.value) || 2))}
                  min={2}
                  max={20}
                  className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số người tối thiểu / đội
                  <span className="ml-1 text-xs text-gray-400">(để trống = không bắt buộc)</span>
                </label>
                <input
                  type="number"
                  value={minTeamSize ?? ''}
                  onChange={e => setMinTeamSize(e.target.value ? parseInt(e.target.value) || 1 : null)}
                  min={2}
                  max={teamSize}
                  placeholder="Không giới hạn"
                  className={`w-32 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${minTeamSizeError ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 focus:ring-[var(--color-primary,#1d4ed8)]'}`}
                />
                {minTeamSizeError && (
                  <p className="text-xs text-red-600 mt-1">Phải từ 2 người trở lên</p>
                )}
                {!minTeamSizeError && minTeamSize !== null && minTeamSize === teamSize && (
                  <p className="text-xs text-blue-600 mt-1">Bắt buộc đúng {teamSize} người</p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading || minTeamSizeError}
              className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DeleteKataConfirm ──────────────────────────────────────────────────────

function DeleteKataConfirm({
  kata,
  onClose,
  onConfirm,
  isLoading,
}: {
  kata: TournamentKata
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-3">Xóa Bài Quyền</h3>

        {kata.usage_count > 0 ? (
          <>
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
              <p className="text-sm text-red-700">
                Không thể xóa — có <strong>{kata.usage_count} VĐV</strong> đang chọn bài này
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Xóa bài quyền '<strong>{kata.name}</strong>'?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Huỷ
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── KataRow ────────────────────────────────────────────────────────────────

function KataRow({
  kata,
  onEdit,
  onDelete,
  dragState,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  kata: TournamentKata
  onEdit: (kata: TournamentKata) => void
  onDelete: (kata: TournamentKata) => void
  dragState: { draggingId: number | null; overId: number | null }
  onDragStart: (id: number) => void
  onDragOver: (id: number, e: React.DragEvent) => void
  onDrop: (targetId: number) => void
}) {
  const isDragging = dragState.draggingId === kata.id
  const isDragOver = dragState.overId === kata.id

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white group
        ${isDragging ? 'opacity-40' : ''}
        ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}
        transition-all
      `}
      draggable
      onDragStart={() => onDragStart(kata.id)}
      onDragOver={e => onDragOver(kata.id, e)}
      onDrop={() => onDrop(kata.id)}
    >
      {/* Drag handle */}
      <span className="text-gray-300 cursor-grab select-none opacity-0 group-hover:opacity-100 transition-opacity">
        ⠿
      </span>

      {/* Order badge */}
      <span className="text-xs text-gray-400 w-8 text-center flex-shrink-0">
        #{kata.sort_order}
      </span>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{kata.name}</p>
        {kata.description && (
          <p className="text-xs text-gray-500 truncate">{kata.description}</p>
        )}
      </div>

      {/* Team size badge */}
      {kata.division === 'team' && (
        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex-shrink-0">
          {kata.team_size} người/đội
        </span>
      )}

      {/* Usage badge */}
      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
        {kata.usage_count} VĐV chọn
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(kata)}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
          title="Sửa"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(kata)}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Xóa"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function KataManagerPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const tid = Number(tournamentId)
  const { selectedTournament } = useTournament()

  const { data, isLoading, isError } = useKatas(tid)
  const createKata = useCreateKata(tid)
  const updateKata = useUpdateKata(tid)
  const deleteKata = useDeleteKata(tid)
  const reorderKatas = useReorderKatas(tid)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState<TournamentKata | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TournamentKata | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [activeDivision, setActiveDivision] = useState<KataDivision>('individual')

  const [dragState, setDragState] = useState<{ draggingId: number | null; overId: number | null }>({
    draggingId: null,
    overId: null,
  })

  const handleCreate = async (name: string, description: string | null, teamSize?: number, minTeamSize?: number | null) => {
    try {
      await createKata.mutateAsync({ division: activeDivision, name, description, team_size: teamSize, min_team_size: minTeamSize ?? null })
      setShowAddModal(false)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể tạo bài quyền'
      setErrorMsg(msg)
    }
  }

  const handleUpdate = async (name: string, description: string | null, teamSize?: number, minTeamSize?: number | null) => {
    if (!editTarget) return
    try {
      await updateKata.mutateAsync({
        kataId: editTarget.id,
        data: { division: editTarget.division, name, description, team_size: teamSize ?? null, min_team_size: minTeamSize ?? null },
      })
      setEditTarget(null)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể cập nhật bài quyền'
      setErrorMsg(msg)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteKata.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể xóa bài quyền'
      setErrorMsg(msg)
    }
  }

  const handleDragStart = (id: number) => {
    setDragState({ draggingId: id, overId: null })
  }

  const handleDragOver = (id: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragState(prev => ({ ...prev, overId: id }))
  }

  const handleDrop = async (targetId: number) => {
    const { draggingId } = dragState
    setDragState({ draggingId: null, overId: null })

    if (!draggingId || draggingId === targetId || !data) return

    const katas = [...data.katas]
      .filter(kata => kata.division === activeDivision)
      .sort((a, b) => a.sort_order - b.sort_order)
    const withoutDragging = katas.filter(k => k.id !== draggingId)
    const dragging = katas.find(k => k.id === draggingId)
    if (!dragging) return

    const targetIndex = withoutDragging.findIndex(k => k.id === targetId)
    withoutDragging.splice(targetIndex, 0, dragging)

    const reordered = withoutDragging.map((k, i) => ({
      kata_id: k.id,
      sort_order: i + 1,
    }))

    try {
      await reorderKatas.mutateAsync(reordered)
    } catch {
      setErrorMsg('Không thể thay đổi thứ tự')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary,#1d4ed8)]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-center text-red-600">
        Không thể tải danh sách bài quyền
      </div>
    )
  }

  const katas = [...data.katas]
    .filter(kata => kata.division === activeDivision)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb + tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs mb-3">
          <Link to="/tournaments" className="text-[var(--color-primary,#1d4ed8)] hover:underline transition-colors">
            Quản lý Giải Đấu
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-500 font-medium">{selectedTournament?.name ?? '...'}</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-400">Bài Quyền</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-primary-dark,#1e3a5f)]">Bài Quyền</h1>
            <p className="text-sm text-slate-500 mt-1">{data.total} bài quyền</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Thêm Bài Quyền
          </button>
        </div>

        {/* Tab nav — pill style (đồng bộ với TournamentStructurePage) */}
        <div className="mt-4 mb-4">
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
            <Link
              to={`/tournaments/${tid}/structure/weight-classes`}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all text-slate-500 hover:text-slate-700"
            >
              ⚔️ Đối kháng
            </Link>
            <Link
              to={`/tournaments/${tid}/structure/katas`}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all bg-white shadow-sm text-[var(--color-primary,#1d4ed8)]"
            >
              🥋 Quyền
            </Link>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveDivision('individual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeDivision === 'individual'
                ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Cá nhân
          </button>
          <button
            type="button"
            onClick={() => setActiveDivision('team')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeDivision === 'team'
                ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Đồng Đội
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Kata list */}
      {katas.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">Chưa có bài quyền nào</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Thêm Bài Quyền
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          {katas.map(kata => (
            <KataRow
              key={kata.id}
              kata={kata}
              onEdit={kata => setEditTarget(kata)}
              onDelete={kata => setDeleteTarget(kata)}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddKataModal
          division={activeDivision}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreate}
          isLoading={createKata.isPending}
        />
      )}

      {editTarget && (
        <EditKataModal
          kata={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleUpdate}
          isLoading={updateKata.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteKataConfirm
          kata={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isLoading={deleteKata.isPending}
        />
      )}
    </div>
  )
}
