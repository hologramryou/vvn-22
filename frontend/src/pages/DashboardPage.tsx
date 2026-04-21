import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { Trophy, Users, Swords, Star, Monitor, Clock } from 'lucide-react'
import { useTournament } from '../context/TournamentContext'
import { getMedalsByClub, getAthleteStats } from '../api/tournaments'
import { getScheduleLocal, getSchedule } from '../api/tournaments'
import type { ClubMedalRank, ScheduleBracketMatch, QuyenSlot } from '../types/tournament'
import type { AthleteStatsByClub } from '../api/tournaments'

// ── Helpers ────────────────────────────────────────────────────────────────

const MEDAL_COLORS = { gold: '#F59E0B', silver: '#94A3B8', bronze: '#B45309' }

const STATUS_LABEL_MATCH: Record<string, string> = {
  pending: 'Chờ', ready: 'Sẵn sàng', ongoing: 'Đang diễn ra', completed: 'Hoàn thành',
}
const STATUS_LABEL_QUYEN: Record<string, string> = {
  pending: 'Chờ', ready: 'Sẵn sàng', checking: 'Kiểm tra', ongoing: 'Đang diễn ra',
  scoring: 'Đang chấm', completed: 'Hoàn thành',
}

// ── Snapshot card ──────────────────────────────────────────────────────────

function SnapCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Live match card ────────────────────────────────────────────────────────

function LiveMatchCard({ m }: { m: ScheduleBracketMatch }) {
  return (
    <div
      className="bg-white border border-green-200 rounded-xl p-3 cursor-pointer hover:border-green-400 hover:shadow-md transition-all"
      onClick={() => window.open(`/display?match=${m.id}`, '_blank')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Đang đấu
        </span>
        {m.court && <span className="text-xs text-gray-400">Sân {m.court}</span>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate">{m.player1_name ?? '—'}</span>
          <span className="text-lg font-bold text-blue-600 tabular-nums">{m.score1 ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate">{m.player2_name ?? '—'}</span>
          <span className="text-lg font-bold text-blue-600 tabular-nums">{m.score2 ?? 0}</span>
        </div>
      </div>
      {m.node_path && (
        <p className="mt-2 text-xs text-gray-400 truncate">{m.node_path} · {m.round_label}</p>
      )}
    </div>
  )
}

function LiveQuyenCard({ s }: { s: QuyenSlot }) {
  return (
    <div
      className="bg-white border border-purple-200 rounded-xl p-3 cursor-pointer hover:border-purple-400 hover:shadow-md transition-all"
      onClick={() => window.open(`/display?slotId=${s.id}&mode=quyen`, '_blank')}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          {s.status === 'scoring' ? 'Đang chấm' : 'Biểu diễn'}
        </span>
        {s.court && <span className="text-xs text-gray-400">Sân {s.court}</span>}
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate">{s.player_name}</p>
      <p className="text-xs text-gray-500 truncate">{s.content_name}</p>
      {s.node_path && <p className="mt-1 text-xs text-gray-400 truncate">{s.node_path}</p>}
    </div>
  )
}

// ── Upcoming item ──────────────────────────────────────────────────────────

function UpcomingRow({ item }: { item: ScheduleBracketMatch | QuyenSlot }) {
  const isMatch = 'player1_name' in item
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isMatch ? 'bg-blue-50' : 'bg-purple-50'}`}>
        {isMatch ? <Swords size={14} className="text-blue-500" /> : <Star size={14} className="text-purple-500" />}
      </div>
      <div className="flex-1 min-w-0">
        {isMatch ? (
          <p className="text-sm font-medium text-gray-800 truncate">
            {(item as ScheduleBracketMatch).player1_name ?? '?'} vs {(item as ScheduleBracketMatch).player2_name ?? '?'}
          </p>
        ) : (
          <p className="text-sm font-medium text-gray-800 truncate">{(item as QuyenSlot).player_name}</p>
        )}
        <p className="text-xs text-gray-400 truncate">
          {item.node_path} {isMatch ? `· ${(item as ScheduleBracketMatch).round_label}` : `· ${(item as QuyenSlot).content_name}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.court && <span className="text-xs text-gray-400">Sân {item.court}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          item.status === 'ready' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {isMatch
            ? STATUS_LABEL_MATCH[item.status] ?? item.status
            : STATUS_LABEL_QUYEN[(item as QuyenSlot).status] ?? item.status}
        </span>
      </div>
    </div>
  )
}

// ── Custom Y-axis tick — truncates long names, shows rank number ──────────

const YAXIS_W = 160
const MAX_CHARS = 22

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClubTick(props: any) {
  const { x = 0, y = 0, payload, index = 0 } = props as { x: number; y: number; payload: { value: string }; index: number }
  const full = payload?.value ?? ''
  const label = full.length > MAX_CHARS ? full.slice(0, MAX_CHARS - 1) + '…' : full
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        x={-6}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#374151"
        fontSize={11}
        fontFamily="system-ui, sans-serif"
      >
        <tspan fill="#9CA3AF" fontSize={10}>{index + 1}. </tspan>
        {label}
      </text>
    </g>
  )
}

// ── Athlete chart ──────────────────────────────────────────────────────────

function AthleteChart({ stats }: { stats: AthleteStatsByClub }) {
  const data = [...stats.by_club]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(r => ({ name: r.club_name, vdv: r.count }))

  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={YAXIS_W}
          tick={(props) => <ClubTick {...props} />}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#F0F9FF' }}
          contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
          formatter={(v) => [`${v} VĐV`, 'Số lượng']}
        />
        <Bar dataKey="vdv" radius={[0, 6, 6, 0]} maxBarSize={24} label={{ position: 'right', fontSize: 11, fill: '#6B7280' }}>
          {data.map((_, i) => (
            <Cell key={i} fill={`hsl(215, ${75 - i * 2}%, ${52 + i}%)`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Medal chart ────────────────────────────────────────────────────────────

function MedalChart({ rankings }: { rankings: ClubMedalRank[] }) {
  const [show, setShow] = useState({ gold: true, silver: true, bronze: true })

  const data = [...rankings]
    .filter(r => r.gold + r.silver + r.bronze > 0)
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze)
    .slice(0, 20)
    .map(r => ({ name: r.club_name, gold: r.gold, silver: r.silver, bronze: r.bronze }))

  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu huy chương</p>

  const toggles: { key: 'gold' | 'silver' | 'bronze'; label: string; active: string; inactive: string }[] = [
    { key: 'gold',   label: '🥇 Vàng', active: 'bg-amber-50 border-amber-400 text-amber-700',  inactive: 'bg-gray-50 border-gray-200 text-gray-400' },
    { key: 'silver', label: '🥈 Bạc',  active: 'bg-slate-100 border-slate-400 text-slate-600', inactive: 'bg-gray-50 border-gray-200 text-gray-400' },
    { key: 'bronze', label: '🥉 Đồng', active: 'bg-orange-50 border-orange-400 text-orange-700', inactive: 'bg-gray-50 border-gray-200 text-gray-400' },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {toggles.map(({ key, label, active, inactive }) => (
          <button
            key={key}
            onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${show[key] ? active : inactive}`}
          >
            {label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6B7280' }}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={YAXIS_W}
            tick={(props) => <ClubTick {...props} />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#FAFAFA' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {show.gold   && <Bar dataKey="gold"   name="Vàng" fill={MEDAL_COLORS.gold}   radius={[0, 4, 4, 0]} maxBarSize={14} />}
          {show.silver && <Bar dataKey="silver" name="Bạc"  fill={MEDAL_COLORS.silver} radius={[0, 4, 4, 0]} maxBarSize={14} />}
          {show.bronze && <Bar dataKey="bronze" name="Đồng" fill={MEDAL_COLORS.bronze} radius={[0, 4, 4, 0]} maxBarSize={14} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { selectedTournament } = useTournament()
  const tid = selectedTournament?.id

  const athleteQ = useQuery({
    queryKey: ['athlete-stats', tid],
    queryFn: () => getAthleteStats(tid!),
    enabled: !!tid,
    refetchInterval: 30_000,
  })

  const medalQ = useQuery({
    queryKey: ['medals-by-club', tid],
    queryFn: () => getMedalsByClub(tid!),
    enabled: !!tid,
    refetchInterval: 30_000,
  })

  const localScheduleQ = useQuery({
    queryKey: ['schedule-local', tid],
    queryFn: () => getScheduleLocal(tid!),
    enabled: !!tid,
    refetchInterval: 10_000,
  })

  const cloudScheduleQ = useQuery({
    queryKey: ['schedule-cloud', tid],
    queryFn: () => getSchedule(tid!),
    enabled: !!tid,
    refetchInterval: 10_000,
  })

  const athleteStats = athleteQ.data ?? { total: 0, by_club: [] }
  const rankings = medalQ.data?.rankings ?? []
  const bracketMatches = localScheduleQ.data?.bracket_matches ?? []
  const quyenSlots = cloudScheduleQ.data?.quyen_slots ?? []

  // Snapshot
  const totalAthletes = athleteStats.total
  const totalClubs = athleteStats.by_club.length
  const matchesTotal = bracketMatches.filter(m => !m.is_bye).length
  const matchesDone = bracketMatches.filter(m => !m.is_bye && m.status === 'completed').length
  const quyenTotal = quyenSlots.length
  const quyenDone = quyenSlots.filter(s => s.status === 'completed').length

  // Live
  const liveMatches = bracketMatches.filter(m => m.status === 'ongoing' && !m.is_bye)
  const liveQuyen = quyenSlots.filter(s => s.status === 'ongoing' || s.status === 'scoring')

  // Upcoming — merge and sort by schedule_order
  type AnyItem = ScheduleBracketMatch | QuyenSlot
  const upcoming: AnyItem[] = [
    ...bracketMatches.filter(m => !m.is_bye && (m.status === 'ready' || m.status === 'pending') && m.schedule_order !== null),
    ...quyenSlots.filter(s => (s.status === 'ready' || s.status === 'checking' || s.status === 'pending') && s.schedule_order !== null),
  ]
    .sort((a, b) => (a.schedule_order ?? 9999) - (b.schedule_order ?? 9999))
    .slice(0, 8)

  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-lg mx-auto mt-12">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 items-start mb-6">
            <Trophy size={22} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Chưa chọn giải đấu</p>
              <p className="text-xs text-amber-600 mt-1">Chọn một giải đấu từ thanh bên trái để xem dữ liệu dashboard.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Users,  label: 'Vận động viên', path: '/students' },
              { icon: Trophy, label: 'Sơ đồ giải',    path: '/tournaments' },
              { icon: Swords, label: 'Trận đấu',      path: '/matches' },
              { icon: Trophy, label: 'Huy chương',    path: '/medals' },
            ].map(({ icon: Icon, label, path }) => (
              <a key={path} href={path}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <Icon size={18} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{selectedTournament.name}</h1>
        <p className="text-sm text-gray-400">Dashboard giải đấu</p>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SnapCard icon={Users} label="Vận động viên" value={totalAthletes} sub={`${totalClubs} đơn vị`} color="bg-blue-500" />
        <SnapCard icon={Swords} label="Đối kháng" value={`${matchesDone}/${matchesTotal}`} sub="trận hoàn thành" color="bg-green-500" />
        <SnapCard icon={Star} label="Quyền" value={`${quyenDone}/${quyenTotal}`} sub="nội dung hoàn thành" color="bg-purple-500" />
        <SnapCard icon={Trophy} label="Huy chương" value={rankings.filter(r => r.gold + r.silver + r.bronze > 0).length} sub="đơn vị có huy chương" color="bg-amber-500" />
      </div>

      {/* Live + Upcoming */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Live */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={16} className="text-green-500" />
            <h2 className="text-sm font-semibold text-gray-800">Đang diễn ra</h2>
            {(liveMatches.length + liveQuyen.length) > 0 && (
              <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {liveMatches.length + liveQuyen.length} hoạt động
              </span>
            )}
          </div>
          {liveMatches.length === 0 && liveQuyen.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Không có trận nào đang diễn ra</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {liveMatches.map(m => <LiveMatchCard key={`m-${m.id}`} m={m} />)}
              {liveQuyen.map(s => <LiveQuyenCard key={`q-${s.id}`} s={s} />)}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Sắp diễn ra</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Không có lịch tiếp theo</p>
          ) : (
            <div>
              {upcoming.map((item, i) => <UpcomingRow key={i} item={item} />)}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* VDV by club */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-800">Số VĐV theo đơn vị</h2>
          </div>
          {athleteQ.isLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Đang tải...</div>
          ) : athleteStats.by_club.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <div className="overflow-y-auto max-h-[480px]">
              <AthleteChart stats={athleteStats} />
            </div>
          )}
        </div>

        {/* Medal by club */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">Tổng sắp huy chương</h2>
          </div>
          {medalQ.isLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Đang tải...</div>
          ) : (
            <div className="overflow-y-auto max-h-[520px]">
              <MedalChart rankings={rankings} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
