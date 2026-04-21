import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react'
import type { Club, ClubFormData } from '../../types/club'
import { listTournaments } from '../../api/tournaments'
import type { TournamentListItem } from '../../types/tournament'
import {
  useAdminClubs,
  useProvinces,
  useCreateClub,
  useUpdateClub,
  useDeleteClub,
} from '../../hooks/useAdminClubs'
import { Modal, PageHeader, ConfirmDialog, StatusBadge } from '../../components/ui'

// ── Field-level error tooltip ─────────────────────────────────────────────────

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <span className="inline-block w-3 h-3 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold leading-none flex-shrink-0">!</span>
      {msg}
    </p>
  )
}

// ── Club form modal ───────────────────────────────────────────────────────────

interface ClubFormProps {
  club?: Club | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
  provinces: { id: number; name: string; code: string }[]
  tournaments: TournamentListItem[]
  isLoading: boolean
}

const EMPTY_FORM: ClubFormData = {
  name: '',
  description: '',
  province_id: '',
  founded_date: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
  tournament_ids: [],
  coach_name: '',
  coach_phone: '',
  caretaker_name: '',
  caretaker_phone: '',
}

function ClubForm({ club, onClose, onSave, provinces, tournaments, isLoading }: ClubFormProps) {
  const isEdit = !!club
  const [form, setForm] = useState<ClubFormData>(
    club
      ? {
          name: club.name,
          description: club.description ?? '',
          province_id: club.province_id,
          founded_date: club.founded_date ?? '',
          address: club.address ?? '',
          phone: club.phone ?? '',
          email: club.email ?? '',
          logo_url: club.logo_url ?? '',
          tournament_ids: club.tournament_ids ?? [],
          coach_name: club.coach_name ?? '',
          coach_phone: club.coach_phone ?? '',
          caretaker_name: club.caretaker_name ?? '',
          caretaker_phone: club.caretaker_phone ?? '',
        }
      : { ...EMPTY_FORM },
  )
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ClubFormData, string>>>({})

  const clearFieldError = (k: keyof ClubFormData) =>
    setFieldErrors(fe => fe[k] ? { ...fe, [k]: undefined } : fe)

  const set = (k: keyof ClubFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    clearFieldError(k)
  }

  const VN_PHONE_RE = /^(0[3-9][0-9]{8}|(\+84)[3-9][0-9]{8})$/

  const submit = async () => {
    setError('')
    const fe: Partial<Record<keyof ClubFormData, string>> = {}

    if (!form.name.trim()) fe.name = 'Tên đơn vị không được để trống'
    else if (form.name.trim().length < 2) fe.name = 'Tên đơn vị phải từ 2 ký tự trở lên'
    if (!form.province_id) fe.province_id = 'Vui lòng chọn tỉnh/thành phố'
    if (form.phone.trim() && !VN_PHONE_RE.test(form.phone.trim()))
      fe.phone = 'Số điện thoại không đúng định dạng Việt Nam (VD: 0901234567)'

    if (Object.keys(fe).length) { setFieldErrors(fe); return }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      province_id: Number(form.province_id),
    }
    if (form.description.trim()) body.description = form.description.trim()
    if (form.founded_date) body.founded_date = form.founded_date
    if (form.address.trim()) body.address = form.address.trim()
    if (form.phone.trim()) body.phone = form.phone.trim()
    if (form.email.trim()) body.email = form.email.trim()
    body.tournament_ids = form.tournament_ids
    if (form.coach_name.trim()) body.coach_name = form.coach_name.trim()
    if (form.coach_phone.trim()) body.coach_phone = form.coach_phone.trim()
    if (form.caretaker_name.trim()) body.caretaker_name = form.caretaker_name.trim()
    if (form.caretaker_phone.trim()) body.caretaker_phone = form.caretaker_phone.trim()

    try {
      await onSave(body)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Có lỗi xảy ra, vui lòng thử lại')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Sửa Đơn Vị' : 'Thêm Đơn Vị Mới'}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tên đơn vị <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              maxLength={100}
              placeholder="VD: Đơn vị Vovinam Hà Nội"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${fieldErrors.name ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[var(--color-primary,#1d4ed8)]'}`}
            />
            {fieldErrors.name && <FieldError msg={fieldErrors.name} />}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              maxLength={500}
              rows={3}
              placeholder="Mô tả ngắn về đơn vị..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-0.5 text-right">
              {form.description.length}/500
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tỉnh/Thành <span className="text-red-500">*</span>
              </label>
              <select
                value={form.province_id}
                onChange={set('province_id')}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${fieldErrors.province_id ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[var(--color-primary,#1d4ed8)]'}`}
              >
                <option value="">-- Chọn tỉnh/thành --</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {fieldErrors.province_id && <FieldError msg={fieldErrors.province_id} />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngày thành lập</label>
              <input
                type="date"
                value={form.founded_date}
                onChange={set('founded_date')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input
              type="text"
              value={form.address}
              onChange={set('address')}
              placeholder="Địa chỉ đơn vị"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="clb@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="0901234567"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${fieldErrors.phone ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-[var(--color-primary,#1d4ed8)]'}`}
              />
              {fieldErrors.phone && <FieldError msg={fieldErrors.phone} />}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Giải đấu áp dụng</label>
            {tournaments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Chưa có giải đấu nào để gán
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                {tournaments.map(t => {
                  const checked = form.tournament_ids.includes(t.id)
                  return (
                    <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm(f => ({
                            ...f,
                            tournament_ids: f.tournament_ids.includes(t.id)
                              ? f.tournament_ids.filter(id => id !== t.id)
                              : [...f.tournament_ids, t.id],
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-[var(--color-primary,#1d4ed8)]"
                      />
                      <span className="flex-1">
                        <span className="block text-sm text-gray-800">{t.name}</span>
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">{t.status}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-gray-400">Có thể chọn nhiều giải đấu.</p>
          </div>

          {/* Coach */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Huấn luyện viên</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={form.coach_name}
                  onChange={set('coach_name')}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={form.coach_phone}
                  onChange={set('coach_phone')}
                  placeholder="0901234567"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
            </div>
          </div>

          {/* Caretaker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chăm sóc viên</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={form.caretaker_name}
                  onChange={set('caretaker_name')}
                  placeholder="Nguyễn Thị B"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={form.caretaker_phone}
                  onChange={set('caretaker_phone')}
                  placeholder="0901234567"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                />
              </div>
            </div>
          </div>
      </div>
    </Modal>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {type === 'success' ? '✓' : '✕'} {message}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export const ClubListPage = () => {
  const [keyword, setKeyword]     = useState('')
  const [status, setStatus]       = useState('all')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(20)
  const [modalClub, setModalClub] = useState<Club | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null)
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const params = { keyword, status, page, page_size: pageSize }
  const { data, isLoading, isError, refetch } = useAdminClubs(params)
  const { data: provinces = [] } = useProvinces()
  const { data: tournaments = [] } = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })
  const createMutation = useCreateClub()
  const updateMutation = useUpdateClub()
  const deleteMutation = useDeleteClub()

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value)
    setPage(1)
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value)
    setPage(1)
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const handleSave = async (body: Record<string, unknown>) => {
    if (modalClub) {
      await updateMutation.mutateAsync({ id: modalClub.id, body })
      showToast('Cập nhật đơn vị thành công', 'success')
    } else {
      await createMutation.mutateAsync(body)
      showToast('Tạo đơn vị thành công', 'success')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      showToast('Xóa đơn vị thành công', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      showToast(msg ?? 'Có lỗi xảy ra khi xóa', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Quản Lý Đơn Vị"
        subtitle={data ? `${data.total} đơn vị` : 'Đang tải...'}
        actions={
          <button
            onClick={() => setModalClub(null)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary,#1d4ed8)] text-white text-sm font-medium rounded-xl hover:bg-[var(--color-primary-dark,#1e3a5f)] transition-colors"
          >
            <Plus size={16} />
            Thêm mới
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={handleSearch}
            placeholder="Tìm kiếm tên đơn vị..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
          />
        </div>
        <select
          value={status}
          onChange={handleStatusChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
        >
          <option value="all">Tất cả</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-red-500 text-sm mb-3">Không thể tải danh sách đơn vị</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-[var(--color-primary,#1d4ed8)] text-white text-sm rounded-lg hover:bg-[var(--color-primary-dark,#1e3a5f)]"
            >
              Thử lại
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Không tìm thấy đơn vị nào
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-semibold">Tên đơn vị</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">HLV / Chăm sóc</th>
                <th className="px-4 py-3 text-center font-semibold">Thành viên</th>
                <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                <th className="px-4 py-3 text-right font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map(club => (
                <tr key={club.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{club.name}</div>
                    <div className="text-[11px] text-gray-400">{club.code}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {club.coach_name && (
                        <div><span className="text-gray-400">HLV:</span> {club.coach_name}{club.coach_phone ? ` · ${club.coach_phone}` : ''}</div>
                      )}
                      {club.caretaker_name && (
                        <div><span className="text-gray-400">CSV:</span> {club.caretaker_name}{club.caretaker_phone ? ` · ${club.caretaker_phone}` : ''}</div>
                      )}
                      {!club.coach_name && !club.caretaker_name && (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-700 font-medium">{club.member_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={club.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModalClub(club)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(club)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="clubs-page-size" className="text-sm text-gray-600">So dong/trang</label>
            <select
              id="clubs-page-size"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                ‹
              </button>
              <span className="text-sm text-gray-600">
                Trang {page} / {data.total_pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
      {/* Modal */}
      {modalClub !== undefined && (
        <ClubForm
          club={modalClub}
          onClose={() => setModalClub(undefined)}
          onSave={handleSave}
          provinces={provinces}
          tournaments={tournaments}
          isLoading={isMutating}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa đơn vị"
        message={`Bạn có chắc muốn xóa đơn vị "${deleteTarget?.name}"?`}
        confirmLabel="Xóa"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* Toast */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  )
}

