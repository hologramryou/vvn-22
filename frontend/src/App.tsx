import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { TournamentProvider } from './context/TournamentContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { StudentListPage } from './pages/students/StudentListPage'
import { StudentDetailPage } from './pages/students/StudentDetailPage'
import { StudentCreatePage } from './pages/students/StudentCreatePage'
import { StudentEditPage } from './pages/students/StudentEditPage'
import { TournamentsPage } from './pages/TournamentsPage'
import { MatchesPage } from './pages/MatchesPage'
import { MedalsPage } from './pages/MedalsPage'
import { DisplayPage } from './pages/DisplayPage'
import { MatchSetupPage } from './pages/MatchSetupPage'
import { ScoringPage } from './pages/ScoringPage'
import { MatchJudgePanelPage } from './pages/MatchJudgePanelPage'
import { QuyenScoringPage } from './pages/QuyenScoringPage'
import { QuyenSetupPage } from './pages/QuyenSetupPage'
import { QuyenJudgePage } from './pages/QuyenJudgePage'
import { RefereeConsolePage } from './pages/RefereeConsolePage'
import { AccountsPage } from './pages/AccountsPage'
import { ClubListPage } from './pages/clubs/ClubListPage'
import { TournamentStructurePage } from './pages/tournaments/TournamentStructurePage'
import { KataManagerPage } from './pages/tournaments/KataManagerPage'
import { TournamentManagePage } from './pages/tournaments/TournamentManagePage'

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  const role  = localStorage.getItem('user_role')
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Display: full-screen, no sidebar, no auth required ── */}
      <Route path="/display" element={<TournamentProvider><DisplayPage /></TournamentProvider>} />

      {/* ── Authenticated pages (wrapped in AppLayout with sidebar) ── */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/dashboard"    element={<DashboardPage />} />
        <Route path="/students"     element={<StudentListPage />} />
        <Route path="/students/new" element={<StudentCreatePage />} />
        <Route path="/students/:id/edit" element={<StudentEditPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/tournaments"  element={<TournamentsPage />} />
        {/* /tournaments/manage phải trước /:tournamentId để không bị match nhầm */}
        <Route path="/tournaments/manage" element={<AdminRoute><TournamentManagePage /></AdminRoute>} />
        <Route path="/tournaments/:tournamentId/structure/weight-classes" element={<AdminRoute><TournamentStructurePage /></AdminRoute>} />
        <Route path="/tournaments/:tournamentId/structure/katas" element={<AdminRoute><KataManagerPage /></AdminRoute>} />
        <Route path="/matches"      element={<MatchesPage />} />
        <Route path="/referee-console" element={<RefereeConsolePage />} />
        <Route path="/medals"       element={<MedalsPage />} />
      </Route>

      {/* ── Admin-only pages ── */}
      <Route
        path="/accounts"
        element={<AdminRoute><AppLayout /></AdminRoute>}
      >
        <Route index element={<AccountsPage />} />
      </Route>
      <Route
        path="/clubs"
        element={<AdminRoute><AppLayout /></AdminRoute>}
      >
        <Route index element={<ClubListPage />} />
      </Route>

      {/* ── Scoring: full-screen, no sidebar, auth required ── */}
      <Route
        path="/matches/:matchId/setup"
        element={<PrivateRoute><MatchSetupPage /></PrivateRoute>}
      />
      <Route
        path="/matches/:matchId/score"
        element={<PrivateRoute><ScoringPage /></PrivateRoute>}
      />
      <Route
        path="/matches/:matchId/judge-panel"
        element={<PrivateRoute><MatchJudgePanelPage /></PrivateRoute>}
      />
      <Route
        path="/quyen-slots/:slotId/setup"
        element={<PrivateRoute><QuyenSetupPage /></PrivateRoute>}
      />
      <Route
        path="/quyen-slots/:slotId/score"
        element={<PrivateRoute><QuyenScoringPage /></PrivateRoute>}
      />
      <Route
        path="/quyen-slots/:slotId/judges/:judgeSlot"
        element={<PrivateRoute><QuyenJudgePage /></PrivateRoute>}
      />

      {/* ── Default redirect ── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
