import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { TournamentProvider } from '../../context/TournamentContext'
import { subscribeRailwayPending } from '../../lib/axios'

function useRailwayPending() {
  const [pending, setPending] = useState(false)
  useEffect(() => subscribeRailwayPending(setPending), [])
  return pending
}

export const AppLayout = () => {
  const bp = useBreakpoint()
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const railwayPending = useRailwayPending()   // desktop: expanded by default

  // Sidebar variant per breakpoint
  // mobile  (<768px)  → drawer overlay
  // tablet / desktop  → icon (collapsed) or full (expanded), toggleable
  const sidebarVariant: 'icon' | 'full' | 'drawer' =
    bp === 'mobile' ? 'drawer' :
    sidebarOpen     ? 'full'   : 'icon'

  return (
    <TournamentProvider>
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* ── Static sidebar (tablet / desktop) ── */}
      {bp !== 'mobile' && (
        <Sidebar
          open={false}
          onClose={() => {}}
          onToggle={() => setSidebarOpen(v => !v)}
          variant={sidebarVariant as 'icon' | 'full'}
        />
      )}

      {/* ── Mobile drawer ── */}
      {bp === 'mobile' && (
        <Sidebar
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          variant="drawer"
        />
      )}

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">

        {/* Mobile-only top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 h-12 bg-[var(--color-primary,#1d4ed8)] flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white"
          >
            <Menu size={20} />
          </button>
          <div className="w-6 h-6 bg-white/20 rounded-md flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">VV</span>
          </div>
          <span className="text-sm font-semibold text-white flex-1">Vovinam Fighting</span>
          <img src="/logo.jpg" alt="Logo" className="h-8 w-8 rounded-full object-cover" />
        </div>

        {/* Desktop top bar with logo */}
        <div className="hidden md:flex items-center justify-end px-4 h-12 flex-shrink-0 bg-white border-b border-gray-100">
          <img src="/logo.jpg" alt="Logo" className="h-9 w-9 rounded-full object-cover shadow-md" />
        </div>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Railway sync overlay */}
        {railwayPending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-xl px-6 py-4">
              <Loader2 size={20} className="animate-spin text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Đang lưu dữ liệu...</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </TournamentProvider>
  )
}
