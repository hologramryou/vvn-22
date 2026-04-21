import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Trophy, List, Monitor, Award, LogOut, X,
  ChevronLeft, ChevronRight, ShieldCheck, Building2,
  ChevronDown, Calendar, ClipboardCheck,
} from 'lucide-react'
import { useTournament } from '../../context/TournamentContext'
import { SportIcon } from '../ui/SportIcon'

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label : 'Dashboard',
    icon  : LayoutDashboard,
    path  : '/dashboard',
    roles : ['admin', 'club', 'referee', 'scorekeeper', 'viewer'],
  },
  {
    label : 'Danh sách vận động viên',
    icon  : Users,
    path  : '/students',
    roles : ['admin', 'club', 'viewer'],
  },
  {
    label : 'Sơ đồ giải đấu',
    icon  : Trophy,
    path  : '/tournaments',
    end   : true,
    roles : ['admin', 'club', 'referee', 'scorekeeper', 'viewer'],
  },
  {
    label : 'Danh sách trận đấu',
    icon  : List,
    path  : '/matches',
    roles : ['admin', 'club', 'referee', 'scorekeeper', 'viewer'],
  },
  {
    label : 'Bàn trọng tài',
    icon  : ClipboardCheck,
    path  : '/referee-console',
    roles : ['referee'],
  },
  {
    label  : 'Bảng hiển thị',
    icon   : Monitor,
    path   : '/display',
    roles  : ['admin', 'club', 'referee', 'scorekeeper', 'viewer'],
    newTab : true,
  },
  {
    label : 'Tổng sắp huy chương',
    icon  : Award,
    path  : '/medals',
    roles : ['admin', 'club', 'referee', 'scorekeeper', 'viewer'],
  },
  {
    label : 'Quản lý Giải Đấu',
    icon  : Trophy,
    path  : '/tournaments/manage',
    roles : ['admin'],
  },
  {
    label : 'Quản Lý Đơn Vị',
    icon  : Building2,
    path  : '/clubs',
    roles : ['admin'],
  },
  {
    label : 'Quản lý tài khoản',
    icon  : ShieldCheck,
    path  : '/accounts',
    roles : ['admin'],
  },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  open      : boolean
  onClose   : () => void
  onToggle ?: () => void
  variant   : 'icon' | 'full' | 'drawer'
}

// ─── Component ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PUBLISHED: 'Đã công bố', ONGOING: 'Đang diễn ra', COMPLETED: 'Hoàn thành',
}
const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-gray-400', PUBLISHED: 'bg-blue-500', ONGOING: 'bg-green-500', COMPLETED: 'bg-gray-300',
}

export const Sidebar = ({ open, onClose, onToggle, variant }: SidebarProps) => {
  const userRole  = localStorage.getItem('user_role') ?? 'viewer'
  const userName  = localStorage.getItem('user_name') ?? 'User'
  const isDrawer  = variant === 'drawer'
  const showLabel = variant === 'full' || variant === 'drawer'
  const isAdmin   = userRole === 'admin'

  const { tournaments, selectedTournament, setSelectedTournament, isLoading: tourLoading } = useTournament()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(true)

  const logout = () => {
    localStorage.clear()
    window.location.href = '/login'
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    const roles = item.roles as readonly string[]
    return roles.includes(userRole) && !(isAdmin && roles.length === 1 && roles[0] === 'admin')
  })
  const adminItems = NAV_ITEMS.filter(item => {
    const roles = item.roles as readonly string[]
    return isAdmin && roles.length === 1 && roles[0] === 'admin'
  })

  // ─── Sidebar panel ──────────────────────────────────────────────────────────
  const panel = (
    <aside
      className={`
        flex flex-col h-full
        bg-blue-50 border-r border-blue-200
        ${variant === 'icon'   ? 'w-16'  : ''}
        ${variant === 'full'   ? 'w-60'  : ''}
        ${variant === 'drawer' ? 'w-72'  : ''}
      `}
    >
      {/* ── Logo ── */}
      <div className={`
        flex items-center gap-3 h-14 border-b border-blue-200 flex-shrink-0
        ${showLabel ? 'px-4' : 'justify-center px-0'}
      `}>
        <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        {showLabel && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900 leading-tight truncate">Vovinam Fighting</p>
            <p className="text-[10px] text-blue-400 leading-tight">Hệ thống thi đấu</p>
          </div>
        )}
        {isDrawer && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-blue-100 ml-auto">
            <X size={18} className="text-blue-400" />
          </button>
        )}
        {!isDrawer && onToggle && (
          <button
            onClick={onToggle}
            className="p-1 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
            title={showLabel ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
          >
            {showLabel ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {/* ── Tournament selector ── */}
      <div className={`border-b border-blue-200 flex-shrink-0 ${showLabel ? 'px-3 py-2' : 'px-1 py-2'}`}>
        {showLabel ? (
          <div>
            <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar size={9} />Giải đấu
            </p>
            {tourLoading ? (
              <div className="h-8 bg-blue-100 rounded-lg animate-pulse" />
            ) : (
              <div className="relative">
                <button
                  onClick={() => setPickerOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-xs font-medium transition-opacity hover:opacity-90"
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    {selectedTournament ? (
                      <>
                        {selectedTournament.sport_icon
                          ? <SportIcon icon={selectedTournament.sport_icon} className="w-4 h-3.5 flex-shrink-0" />
                          : <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[selectedTournament.status] ?? 'bg-gray-400'}`} />
                        }
                        <span className="truncate" title={selectedTournament.name}>{selectedTournament.name}</span>
                      </>
                    ) : (
                      <span className="text-blue-200">Chọn giải đấu...</span>
                    )}
                  </span>
                  <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-blue-200 rounded-xl shadow-xl overflow-hidden">
                    {tournaments.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">Chưa có giải đấu nào</p>
                    ) : (
                      tournaments.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTournament(t); setPickerOpen(false) }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${selectedTournament?.id === t.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}`}
                        >
                          {t.sport_icon
                            ? <SportIcon icon={t.sport_icon} className="w-4 h-3.5 flex-shrink-0" />
                            : <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status] ?? 'bg-gray-400'}`} />
                          }
                          <span className="flex-1 truncate">{t.name}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{STATUS_LABEL[t.status] ?? t.status}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* icon-only: show a small trophy dot */
          <button
            onClick={() => setPickerOpen(v => !v)}
            title={selectedTournament?.name ?? 'Chọn giải đấu'}
            className="w-full flex justify-center py-1"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${selectedTournament ? STATUS_DOT[selectedTournament.status] : 'bg-gray-300'}`} />
          </button>
        )}
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon

          if ('newTab' in item && item.newTab) {
            return (
              <button
                key={item.path}
                onClick={() => { window.open(item.path, '_blank'); if (isDrawer) onClose() }}
                className={`
                  w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                  text-slate-500 hover:bg-blue-100 hover:text-blue-700
                  ${showLabel ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                `}
                title={!showLabel ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {showLabel && <span className="truncate">{item.label}</span>}
                {showLabel && (
                  <span className="ml-auto text-[9px] text-blue-300 border border-blue-200 rounded px-1">↗</span>
                )}
              </button>
            )
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={'end' in item ? item.end : false}
              onClick={() => { if (isDrawer) onClose() }}
              className={({ isActive }) => `
                flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                ${showLabel ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                ${isActive
                  ? 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-blue-100 hover:text-blue-700'
                }
              `}
              title={!showLabel ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {showLabel && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* ── User + Logout ── */}
      {isAdmin && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => setAdminOpen(v => !v)}
            className={`
              w-full flex items-center gap-3 rounded-xl text-sm font-semibold transition-colors
              text-slate-600 hover:bg-blue-100 hover:text-blue-700
              ${showLabel ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
            `}
            title={!showLabel ? 'Quản trị' : undefined}
          >
            <ShieldCheck size={18} className="flex-shrink-0" />
            {showLabel && <span className="truncate flex-1 text-left">Quản trị</span>}
            {showLabel && (
              <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          {adminOpen && (
            <div className="mt-1 space-y-0.5">
              {adminItems.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={'end' in item ? item.end : false}
                    onClick={() => { if (isDrawer) onClose() }}
                    className={({ isActive }) => `
                      flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
                      ${showLabel ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'}
                      ${isActive
                        ? 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white shadow-sm'
                        : 'text-slate-500 hover:bg-blue-100 hover:text-blue-700'
                      }
                    `}
                    title={!showLabel ? item.label : undefined}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {showLabel && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-blue-200 px-2 py-3 flex-shrink-0">
        {showLabel && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`
            w-full flex items-center gap-3 rounded-xl text-sm text-slate-500
            hover:bg-blue-100 hover:text-blue-700 transition-colors
            ${showLabel ? 'px-3 py-2' : 'justify-center px-0 py-2.5'}
          `}
          title={!showLabel ? 'Đăng xuất' : undefined}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {showLabel && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  )

  // ─── Mobile: drawer overlay ──────────────────────────────────────────────────
  if (isDrawer) {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex flex-col h-full">{panel}</div>
      </div>
    )
  }

  // ─── Desktop / Tablet: static sidebar ───────────────────────────────────────
  return (
    <div className={`hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0 ${variant === 'icon' ? 'w-16' : 'w-60'}`}>
      {panel}
    </div>
  )
}
