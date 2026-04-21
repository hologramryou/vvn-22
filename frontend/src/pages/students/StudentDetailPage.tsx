import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Pencil, Download, X } from 'lucide-react'
import { fetchExportCardsData, fetchStudentDetail } from '../../api/students'
import { ExportModal } from '../../components/students/ExportModal'
import { eventLabel, categoryLabel } from '../../lib/constants'
import type { StudentCardData } from '../../types/student'
import { useTournament } from '../../context/TournamentContext'

const age = (dob: string | null) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : '?'

// ─── Sub-components ──────────────────────────────────────────────────────────
const Row = ({ label, value, valueStyle }: { label: string; value: React.ReactNode; valueStyle?: string }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
    <span className={`text-sm font-medium text-gray-900 text-right ml-4 ${valueStyle ?? ''}`}>{value ?? '—'}</span>
  </div>
)

const SectionCard = ({ dot, title, badge, children }: { dot: string; title: string; badge?: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        {title}
      </span>
      {badge && <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{badge}</span>}
    </div>
    {children}
  </div>
)

const TABS = ['Cá nhân', 'Điều kiện']

export const StudentDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  const [showExport, setShowExport] = useState(false)
  const [exportStudent, setExportStudent] = useState<StudentCardData[] | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const { selectedTournament } = useTournament()
  const userRole = localStorage.getItem('user_role') ?? 'viewer'
  const isAdmin = userRole === 'admin'

  const { data: s, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => fetchStudentDetail(Number(id)),
    enabled: !!id,
  })

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-primary,#1d4ed8)] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!s) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
      Không tìm thấy môn sinh
    </div>
  )

  const initials  = s.full_name.split(' ').map((w: string) => w[0]).slice(-2).join('')
  const genderKey = (s.gender === 'M' ? 'M' : 'F') as 'M' | 'F'
  const hasEvents = (s.compete_events?.length ?? 0) > 0

  const regWeightLabel = s.registration_weight_class_name ?? null

  const fallbackCardData: StudentCardData = {
    id: s.id,
    code: s.code,
    full_name: s.full_name,
    avatar_url: s.avatar_url,
    date_of_birth: s.date_of_birth,
    gender: s.gender,
    weight_class: s.weight_class,
    compete_events: s.compete_events,
    category_type: s.category_type,
    category_loai: s.category_loai,
    club_name: s.club_name,
    status: s.status,
  }

  async function handleExportStudent() {
    setExportLoading(true)
    try {
      let exportData: StudentCardData[] | null = null
      try {
        exportData = selectedTournament
          ? await fetchExportCardsData({ ids: [s.id], tournament_id: selectedTournament.id })
          : null
      } catch {
        exportData = null
      }
      setExportStudent(exportData && exportData.length > 0 ? exportData : [fallbackCardData])
      setShowExport(true)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="max-w-5xl mx-auto w-full bg-gray-100 min-h-screen flex flex-col">

        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg hover:bg-gray-100">
            <ChevronLeft size={22} className="text-gray-500" />
          </button>
          <span className="text-[15px] font-medium text-gray-900">Hồ sơ vận động viên</span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleExportStudent}
                disabled={exportLoading}
                className="text-sm font-medium text-green-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                <Download size={14} />{exportLoading ? 'Đang tải' : 'Export'}
              </button>
            )}
            <button onClick={() => navigate(`/students/${id}/edit`)}
              className="text-sm font-medium text-[var(--color-primary,#1d4ed8)] flex items-center gap-1">
              <Pencil size={14} />Sửa
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-[#0f2c5c] px-4 py-4 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div
              onClick={() => s.avatar_url && setShowAvatarModal(true)}
              className={`w-[68px] h-[68px] rounded-full bg-blue-100 flex items-center justify-center text-xl font-medium text-blue-700 border-2 border-white/25 ${s.avatar_url ? 'cursor-pointer' : ''}`}
            >
              {s.avatar_url
                ? <img src={s.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                : initials}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-semibold text-white truncate">{s.full_name}</div>
            <div className="text-[11px] text-white/50 mt-0.5">{s.code} · {s.gender === 'M' ? 'Nam' : 'Nữ'} · {age(s.date_of_birth)} tuổi</div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-[#C0DD97] text-[#27500A]' : 'bg-white/20 text-white/70'}`}>
                {s.status === 'active' ? 'Đang thi đấu' : 'Tạm ngưng'}
              </span>
              {hasEvents && s.compete_events!.map(e => (
                <span key={e} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  {eventLabel(e)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-px bg-gray-200 border-b border-gray-200">
          {[
            { val: `${age(s.date_of_birth)}`,                         lbl: 'Tuổi' },
            { val: regWeightLabel ?? '—',                             lbl: 'Hạng cân' },
            { val: s.club_name?.split(' ').slice(-2).join(' ') ?? '—', lbl: 'Đơn vị' },
            { val: '—',                                               lbl: 'HCV/HCB/HCĐ' },
          ].map(({ val, lbl }) => (
            <div key={lbl} className="bg-white px-2 py-2.5 text-center">
              <div className="text-[13px] font-semibold text-gray-900 truncate">{val}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>

        {/* Tabs — 3 tabs */}
        <div className="flex bg-white border-b border-gray-200 overflow-x-auto sticky top-[52px] z-10">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`flex-1 min-w-[72px] py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                i === tab ? 'text-[var(--color-primary,#1d4ed8)] border-[var(--color-primary,#1d4ed8)]' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-3 flex flex-col gap-3 flex-1">

          {/* ── Tab 0: Cá nhân ── */}
          {tab === 0 && (
            <SectionCard dot="bg-blue-500" title="Thông tin cá nhân & võ thuật">
              <Row label="Họ và tên"        value={s.full_name} />
              <Row label="Giới tính"        value={s.gender === 'M' ? 'Nam' : 'Nữ'} />
              <Row label="Số điện thoại"    value={s.phone} />
              <Row label="Email"            value={s.email} />
              <Row label="Đơn vị"       value={s.club_name} />
              {s.category_type && s.category_loai && (
                <Row label="Hạng mục thi đấu"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>{categoryLabel(s.category_type, s.category_loai)}</span>
                    </span>
                  }
                />
              )}
              {regWeightLabel && (
                <Row label="Hạng cân thi đấu" value={regWeightLabel} />
              )}
              {hasEvents && (
                <Row label="Nội dung thi đấu"
                  value={
                    <div className="flex flex-wrap gap-1 justify-end">
                      {s.compete_events!.map(e => (
                        <span key={e} className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                          {eventLabel(e)}
                        </span>
                      ))}
                    </div>
                  }
                />
              )}
              {s.quyen_selections && s.quyen_selections.length > 0 && (
                <Row label="Bài quyền thi đấu"
                  value={
                    <div className="flex flex-wrap gap-1 justify-end">
                      {s.quyen_selections.map(q => (
                        <span key={q} className="text-[10px] px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded-full font-medium">
                          {q}
                        </span>
                      ))}
                    </div>
                  }
                />
              )}
              {s.notes && <Row label="Ghi chú" value={s.notes} />}
            </SectionCard>
          )}

          {/* ── Tab 1: Điều kiện ── */}
          {tab === 1 && <>
            <SectionCard dot="bg-purple-500" title="Điều kiện tham dự giải">
              <div className="p-3 flex flex-col gap-2">
                {[
                  { icon:'🎂', key:'Độ tuổi thi đấu',       val:'Đối kháng: 17–35 tuổi · Quyền: 17–40 tuổi' },
                  { icon:'🥋', key:'Cấp đai tối thiểu',      val:'Lam đai: Quyền cơ bản · Hoàng đai: Quyền chuyên sâu và binh khí' },
                  { icon:'📋', key:'Giới hạn đăng ký quyền', val:'Tối đa 1–2 bài quyền / VĐV / giải' },
                  { icon:'⚖️', key:'Giới hạn hạng cân',      val:'01 hạng cân duy nhất / VĐV / giải đối kháng' },
                ].map(({ icon, key, val }) => (
                  <div key={key} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50">
                    <span className="text-sm mt-0.5">{icon}</span>
                    <div>
                      <div className="text-[11px] font-medium text-gray-900">{key}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{val}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mx-3 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed">
                ⚠️ Môn sinh cần đảm bảo cấp đai phù hợp với từng nội dung bài quyền trước khi đăng ký.
              </div>
            </SectionCard>

            <SectionCard dot="bg-blue-500" title="Trạng thái hợp lệ">
              <Row label="Độ tuổi"             value={`Hợp lệ (${age(s.date_of_birth)} tuổi)`} valueStyle="text-green-700" />
              <Row label="Cấp đai"             value={`Hợp lệ (${s.current_belt})`}            valueStyle="text-green-700" />
              <Row label="Nội dung đã đăng ký" value={hasEvents ? `${s.compete_events!.length} nội dung` : 'Chưa đăng ký'} />
              <Row label="Hạng cân đối kháng"  value={regWeightLabel ?? 'Chưa đăng ký'} />
            </SectionCard>
          </>}

        </div>
      </div>

      {showAvatarModal && s.avatar_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setShowAvatarModal(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setShowAvatarModal(false)}
          >
            <X size={20} />
          </button>
          <img
            src={s.avatar_url}
            alt={s.full_name}
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {showExport && exportStudent && (
        <ExportModal
          students={exportStudent}
          exportMode="single"
          tournamentName={selectedTournament?.name}
          onClose={() => { setShowExport(false); setExportStudent(null) }}
        />
      )}
    </div>
  )
}
