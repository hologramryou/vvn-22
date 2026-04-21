import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, Users, UserCog, Building2 } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, getClubsForSelect, UserOut, UserCreateIn, UserUpdateIn } from '../api/users'
import { listTournaments } from '../api/tournaments'
import type { TournamentListItem } from '../types/tournament'
import { Modal, PageHeader, ConfirmDialog } from '../components/ui'

// ── Role config ───────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'admin',   label: 'Admin',    icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
  { value: 'viewer',  label: 'Viewer',   icon: Eye,         color: 'bg-gray-100 text-gray-700' },
  { value: 'referee', label: 'Referee',  icon: UserCog,     color: 'bg-yellow-100 text-yellow-700' },
  { value: 'club',    label: 'Club',     icon: Building2,   color: 'bg-blue-100 text-blue-700' },
]

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLES.find(r => r.value === role) ?? ROLES[1]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ── User form modal ───────────────────────────────────────────────────────────

interface UserFormProps {
  user?: UserOut | null
  onClose: () => void
  onSave: (data: UserCreateIn | UserUpdateIn) => Promise<void>
  clubs: { id: number; name: string; code: string }[]
  tournaments: TournamentListItem[]
  isLoading: boolean
}

function UserForm({ user, onClose, onSave, clubs, tournaments, isLoading }: UserFormProps) {
  const isEdit = !!user

  const [username, setUsername]   = useState(user?.username ?? '')
  const [password, setPassword]   = useState('')
  const [fullName, setFullName]   = useState(user?.full_name ?? '')
  const [email, setEmail]         = useState(user?.email ?? '')
  const [phone, setPhone]         = useState(user?.phone ?? '')
  const [role, setRole]           = useState(user?.role ?? 'viewer')
  const [clubId, setClubId]       = useState<number | null>(user?.club_id ?? null)
  const [tournamentIds, setTournamentIds] = useState<number[]>(user?.tournament_ids ?? [])
  const [isActive, setIsActive]   = useState(user?.is_active ?? true)
  const [showPw, setShowPw]       = useState(false)
  const [error, setError]         = useState('')

  const submit = async () => {
    setError('')
    if (!fullName.trim()) { setError('Họ tên không được để trống'); return }
    if (!email.trim()) { setError('Email không được để trống'); return }
    if (!isEdit && !password) { setError('Mật khẩu không được để trống'); return }
    if (role === 'club' && !clubId) { setError('Vui lòng chọn đơn vị cho tài khoản Club'); return }

    try {
      if (isEdit) {
        const body: UserUpdateIn = {
          full_name: fullName,
          email,
          phone: phone || undefined,
          role,
          is_active: isActive,
          tournament_ids: tournamentIds,
        }
        if (password) body.password = password
        body.club_id = role === 'club' ? clubId : null
        await onSave(body)
      } else {
        await onSave({
          username,
          password,
          full_name: fullName,
          email,
          phone: phone || undefined,
          role,
          club_id: role === 'club' ? clubId : null,
          tournament_ids: tournamentIds,
          is_active: isActive,
        })
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail ?? 'Có lỗi xảy ra')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            Hủy
          </button>
          <button
            onClick={submit}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-[var(--color-primary,#1d4ed8)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-60"
          >
            {isLoading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo tài khoản'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          {/* Username (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên đăng nhập *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="vd: referee3"
              />
            </div>
          )}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tên đăng nhập</label>
              <input className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed" value={username} disabled />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEdit ? 'Mật khẩu mới (để trống = không thay đổi)' : 'Mật khẩu *'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Tối thiểu 6 ký tự'}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Họ và tên *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@vovinam.vn"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Số điện thoại</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="0901234567"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vai trò *</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setRole(r.value); if (r.value !== 'club') setClubId(null) }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    role === r.value ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50 text-[var(--color-primary,#1d4ed8)]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <r.icon size={14} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Club selector (only for club role) */}
          {role === 'club' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Đơn vị *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                value={clubId ?? ''}
                onChange={e => setClubId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Chọn đơn vị --</option>
                {clubs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tournament assignments */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Giải đấu áp dụng</label>
            {tournaments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Chưa có giải đấu nào để gán
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                {tournaments.map(t => {
                  const checked = tournamentIds.includes(t.id)
                  return (
                    <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setTournamentIds(prev =>
                            prev.includes(t.id)
                              ? prev.filter(id => id !== t.id)
                              : [...prev, t.id],
                          )
                        }}
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

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Kích hoạt tài khoản</span>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AccountsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [editUser, setEditUser]       = useState<UserOut | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserOut | null>(null)
  const [mutLoading, setMutLoading]   = useState(false)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: clubs = [] } = useQuery({ queryKey: ['clubs-select'], queryFn: getClubsForSelect })
  const { data: tournaments = [] } = useQuery({ queryKey: ['tournaments'], queryFn: listTournaments })

  const createMut = useMutation({ mutationFn: createUser, onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false) } })
  const updateMut = useMutation({ mutationFn: ({ id, body }: { id: number; body: UserUpdateIn }) => updateUser(id, body), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null) } })
  const deleteMut = useMutation({ mutationFn: deleteUser, onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setConfirmDelete(null) } })

  const handleCreate = async (data: UserCreateIn | UserUpdateIn) => {
    setMutLoading(true)
    try { await createMut.mutateAsync(data as UserCreateIn) } finally { setMutLoading(false) }
  }
  const handleUpdate = async (data: UserCreateIn | UserUpdateIn) => {
    if (!editUser) return
    setMutLoading(true)
    try { await updateMut.mutateAsync({ id: editUser.id, body: data as UserUpdateIn }) } finally { setMutLoading(false) }
  }

  const currentUserId = Number(localStorage.getItem('user_id'))

  const roleCount = (role: string) => users.filter(u => u.role === role).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Quản lý tài khoản"
        subtitle="Chỉ Admin mới có thể xem và quản lý trang này"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary,#1d4ed8)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark,#1e3a5f)] shadow-sm"
          >
            <Plus size={16} />
            Tạo tài khoản
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r.value} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${r.color}`}>
              <r.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{roleCount(r.value)}</p>
              <p className="text-xs text-gray-500">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
            <Users size={32} className="text-gray-300" />
            Chưa có tài khoản nào
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Tài khoản</th>
                <th className="text-left px-4 py-3 font-semibold">Họ tên</th>
                <th className="text-left px-4 py-3 font-semibold">Vai trò</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Đơn vị</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Đăng nhập lần cuối</th>
                <th className="text-left px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{user.full_name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {user.club_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : <span className="text-gray-300">Chưa đăng nhập</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {user.is_active
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Hoạt động</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Vô hiệu</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditUser(user)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      {user.id !== currentUserId && (
                        <button
                          onClick={() => setConfirmDelete(user)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <UserForm
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
          clubs={clubs}
          tournaments={tournaments}
          isLoading={mutLoading}
        />
      )}

      {/* Edit modal */}
      {editUser && (
        <UserForm
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={handleUpdate}
          clubs={clubs}
          tournaments={tournaments}
          isLoading={mutLoading}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Xóa tài khoản"
        message={`Bạn có chắc muốn xóa tài khoản "${confirmDelete?.username}" (${confirmDelete?.full_name})?`}
        confirmLabel="Xóa tài khoản"
        onConfirm={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
        loading={deleteMut.isPending}
      />
    </div>
  )
}
