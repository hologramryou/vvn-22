import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Camera } from 'lucide-react'
import { fetchStudentDetail, fetchClubs, updateStudent, uploadStudentAvatar } from '../../api/students'
import {
  getParticipantRegistration,
  registerParticipant,
  reassignNode,
  updateContestTypes,
} from '../../api/tournament_structure'
import { useTournament } from '../../context/TournamentContext'
import {
  TournamentRegistrationPicker,
  EMPTY_REGISTRATION,
  type RegistrationValue,
} from '../../components/students/TournamentRegistrationPicker'

// ─── Shared UI ────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] focus:border-transparent'

const Field = ({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-gray-600">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100 mb-3">{children}</h2>
)

// ─── Main page ────────────────────────────────────────────────────────────────
export const StudentEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { selectedTournament } = useTournament()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (selectedTournament && selectedTournament.status !== 'DRAFT') navigate(`/students/${id}`, { replace: true })
  }, [selectedTournament, navigate, id])

  const userRole   = localStorage.getItem('user_role') ?? ''
  const myClubId   = Number(localStorage.getItem('club_id') ?? 0)
  const isClubRole = userRole === 'club'
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: '', gender: 'M', phone: '', address: '',
    date_of_birth: '',
    club_id: '',
    notes: '',
  })

  // Registration (tree-based)
  const [registration, setRegistration] = useState<RegistrationValue>(EMPTY_REGISTRATION)
  const [registrationLoaded, setRegistrationLoaded] = useState(false)
  type ApiError = {
    response?: {
      status?: number
      data?: {
        detail?: { message?: string } | string
      }
    }
  }

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['student', id],
    queryFn:  () => fetchStudentDetail(Number(id)),
    enabled:  !!id,
  })

  const tournamentId = selectedTournament?.id
  const { data: clubs = [] } = useQuery({
    queryKey: ['clubs', tournamentId],
    queryFn: () => fetchClubs(tournamentId),
    staleTime: 300_000,
  })

  // Load existing tournament registration
  const registrationQuery = useQuery({
    queryKey: ['participant-registration', selectedTournament?.id, id],
    queryFn:  () => getParticipantRegistration(selectedTournament!.id, Number(id)),
    enabled:  !!selectedTournament && !!id,
    retry:    false,  // 404 = not registered, that's fine
  })
  const existingReg = registrationQuery.data
  const registrationStatusCode =
    (registrationQuery.error as ApiError | null)?.response?.status ?? null
  const registrationLookupMessage =
    registrationStatusCode && registrationStatusCode !== 404
      ? (
          ((registrationQuery.error as ApiError | null)?.response?.data?.detail &&
            typeof (registrationQuery.error as ApiError | null)?.response?.data?.detail === 'object'
            ? (registrationQuery.error as ApiError | null)?.response?.data?.detail?.message
            : (registrationQuery.error as ApiError | null)?.response?.data?.detail) ||
          'Không thể tải đăng ký giải hiện tại của VĐV.'
        )
      : null
  const hasExistingRegistration = !!existingReg

  function getDesiredAssignedNodeId() {
    if (registration.sparring) {
      return registration.sparringWeightId
    }

    const existingClassificationNodeId = existingReg?.classification_node_id ?? existingReg?.node_id ?? null
    const existingAssignedNodeId = existingReg?.node_id ?? null

    if (
      existingAssignedNodeId &&
      existingClassificationNodeId &&
      existingAssignedNodeId !== existingClassificationNodeId &&
      registration.nodeId === existingClassificationNodeId
    ) {
      return existingAssignedNodeId
    }

    return registration.nodeId
  }

  // Pre-fill form from student data
  useEffect(() => {
    if (student && !ready) {
      setForm({
        full_name:     student.full_name,
        gender:        student.gender,
        phone:         student.phone ?? '',
        address:       student.address ?? '',
        date_of_birth: student.date_of_birth ? String(student.date_of_birth) : '',
        club_id:       student.club_id ? String(student.club_id) : '',
        notes:         student.notes ?? '',
      })
      setReady(true)
    }
  }, [student, ready])

  // Pre-fill registration from existing tournament registration
  useEffect(() => {
    if (existingReg && !registrationLoaded) {
      const sparring  = existingReg.contest_types.some(c => c.type === 'sparring')
      const kataIds   = existingReg.contest_types
        .filter(c => c.type === 'kata' && c.kata_id !== null)
        .map(c => c.kata_id!)
      setRegistration({
        nodeId: existingReg.classification_node_id ?? existingReg.node_id,
        sparring,
        sparringWeightId: existingReg.sparring_weight_id ?? null,
        kata: kataIds.length > 0,
        kataIds,
      })
      setRegistrationLoaded(true)
    }
  }, [existingReg, registrationLoaded])

  const set = (k: string, v: unknown) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
    // Khi đổi giới tính → reset node đăng ký vì node thuộc gender khác
    if (k === 'gender') {
      setRegistration(EMPTY_REGISTRATION)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.full_name.trim()) e.full_name = 'Vui lòng nhập họ tên'
    if (!form.club_id)          e.club_id   = 'Vui lòng chọn đơn vị'
    if (form.phone && !/^0\d{9}$/.test(form.phone)) e.phone = 'SĐT không hợp lệ (10 số, bắt đầu 0)'
    if (!registration.sparring && !registration.kata)
      e.node = 'Vui lòng chọn ít nhất một nội dung thi đấu (Đối kháng hoặc Quyền)'
    else if (registration.sparring && !registration.sparringWeightId)
      e.node = 'Vui lòng chọn hạng cân để đăng ký Đối kháng'
    else if (registration.kata && registration.kataIds.length === 0)
      e.node = 'Đã chọn Quyền nhưng chưa chọn bài quyền'
    else if (!registration.nodeId)
      e.node = 'Vui lòng chọn node phân loại để đăng ký giải'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    try {
      await uploadStudentAvatar(Number(id), file)
      qc.invalidateQueries({ queryKey: ['student', id] })
    } catch { /* non-fatal */ }
  }
  void avatarFile  // suppress unused warning

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof updateStudent>[1]) => updateStudent(Number(id), body),
    onSuccess: async () => {
      // Update tournament registration
      if (selectedTournament && registration.nodeId) {
        const contestTypes = [
          ...(registration.sparring ? [{ type: 'sparring' as const, kata_id: null, kata_name: null }] : []),
          ...(registration.kata ? registration.kataIds.map(kid => ({ type: 'kata' as const, kata_id: kid, kata_name: null })) : []),
        ]
        const desiredAssignedNodeId = getDesiredAssignedNodeId()

        try {
          if (!hasExistingRegistration) {
            // No existing registration → register fresh
            await registerParticipant(selectedTournament.id, Number(id), {
              node_id: registration.nodeId,
              sparring: registration.sparring,
              sparring_weight_id: registration.sparringWeightId,
              kata: registration.kata,
              kata_ids: registration.kataIds,
            })
          } else {
            // Update: reassign node if changed
            if (desiredAssignedNodeId && existingReg.node_id !== desiredAssignedNodeId) {
              await reassignNode(selectedTournament.id, Number(id), { new_node_id: desiredAssignedNodeId })
            }
            // Update contest types
            await updateContestTypes(selectedTournament.id, Number(id), { contest_types: contestTypes })
          }
        } catch (error: any) {
          const message =
            error?.response?.data?.detail?.message ||
            error?.response?.data?.detail ||
            'Có lỗi xảy ra khi cập nhật đăng ký giải.'
          setErrors(prev => ({ ...prev, node: String(message) }))
          return
        }
      }

      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student', id] })
      qc.invalidateQueries({ queryKey: ['participant-registration', selectedTournament?.id, id] })
      if (selectedTournament) {
        qc.invalidateQueries({ queryKey: ['tournament-structure', selectedTournament.id] })
        qc.invalidateQueries({ queryKey: ['bracket-tree', selectedTournament.id] })
      }
      qc.invalidateQueries({ queryKey: ['bracket'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      navigate('/students')
    },
    onError: () => {},
  })

  const submit = () => {
    if (selectedTournament && registrationQuery.isLoading) {
      setErrors(prev => ({ ...prev, node: 'Đang tải đăng ký giải hiện tại. Vui lòng thử lại sau vài giây.' }))
      return
    }
    if (registrationLookupMessage) {
      setErrors(prev => ({ ...prev, node: String(registrationLookupMessage) }))
      return
    }
    if (!validate()) return
    mutation.mutate({
      full_name:     form.full_name.trim(),
      gender:        form.gender,
      club_id:       Number(form.club_id),
      date_of_birth: form.date_of_birth || null,
      phone:         form.phone || null,
      address:       form.address || null,
      notes:         form.notes || null,
    })
  }

  // Guard: club role can only edit their own club's students
  if (!loadingStudent && ready && isClubRole && student?.club_id !== myClubId) {
    navigate('/students', { replace: true })
    return null
  }

  if (loadingStudent || !ready) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-primary,#1d4ed8)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900 text-[15px]">Chỉnh sửa môn sinh</h1>
              {student && <p className="text-xs text-gray-400">{student.full_name} · {student.code}</p>}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Hủy
            </button>
            <button onClick={submit} disabled={mutation.isPending}
              className="px-4 py-2 text-sm bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">
        {mutation.isError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            Có lỗi xảy ra, vui lòng thử lại.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

          {/* ── Cột trái: Thông tin cá nhân ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <SectionTitle>Thông tin cá nhân</SectionTitle>
            <div className="flex flex-col gap-4">

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-dashed border-blue-300 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {(avatarPreview ?? student?.avatar_url)
                    ? <img src={avatarPreview ?? student!.avatar_url!} alt="" className="w-full h-full object-cover" />
                    : <Camera size={24} className="text-blue-400" />
                  }
                </div>
                <div>
                  <button type="button" onClick={() => avatarInputRef.current?.click()}
                    className="text-sm text-blue-600 font-medium hover:underline">
                    {(avatarPreview ?? student?.avatar_url) ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện'}
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP · tối đa 2MB</p>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden" onChange={handleAvatarChange} />
              </div>

              <Field label="Họ và tên" required error={errors.full_name}>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                  placeholder="Nguyễn Văn A" className={inputCls} />
              </Field>

              <Field label="Giới tính" required>
                <div className="flex gap-2">
                  {[{ v:'M', l:'Nam' }, { v:'F', l:'Nữ' }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => set('gender', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.gender === v
                          ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}>{l}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Ngày sinh">
                <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                  className={inputCls} />
              </Field>

              <Field label="Số điện thoại" error={errors.phone}>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="0901234567" className={inputCls} maxLength={10} />
              </Field>

              <Field label="Địa chỉ">
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="Quận 1, TP. HCM" className={inputCls} />
              </Field>

              <Field label="Đơn vị" required error={errors.club_id}>
                <select value={form.club_id} onChange={e => set('club_id', e.target.value)}
                  disabled={isClubRole}
                  className={`${inputCls} ${isClubRole ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                  <option value="">-- Chọn đơn vị --</option>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {isClubRole && (
                  <p className="text-[11px] text-gray-400 mt-0.5">Tự động gán đơn vị của bạn</p>
                )}
              </Field>

              <Field label="Ghi chú">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Ghi chú thêm..." rows={2} maxLength={500}
                  className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </div>

          {/* ── Cột phải: Đăng ký thi đấu ── */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
              <SectionTitle>Đăng ký thi đấu</SectionTitle>
              {selectedTournament ? (
                <TournamentRegistrationPicker
                  tournamentId={selectedTournament.id}
                  studentGender={form.gender}
                  value={registration}
                  onChange={v => {
                    setRegistration(v)
                    setErrors(e => { const n = { ...e }; delete n.node; return n })
                  }}
                  error={errors.node}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">Chưa chọn giải đấu</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile footer ── */}
      <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button onClick={() => navigate(-1)}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
          Hủy
        </button>
        <button onClick={submit} disabled={mutation.isPending}
          className="flex-[2] py-2.5 bg-[var(--color-primary,#1d4ed8)] text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  )
}
