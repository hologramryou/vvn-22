import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, ChevronUp, ChevronDown } from 'lucide-react'
import { getMedals, getMedalsByClub } from '../api/tournaments'
import type { ClubMedalRank, QuyenMedalGroup, WeightClassMedal } from '../types/tournament'
import { useTournament } from '../context/TournamentContext'
import { NoTournamentGuard } from '../components/NoTournamentGuard'
import { TreePathPills, FilterChip } from '../components/ui'
import { TeamMembersModal } from '../components/TeamMembersModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePath(path: string): string[] {
  return path.split(' > ').map(s => s.trim()).filter(Boolean)
}

function pathMatches(itemSegs: string[], selected: string[]): boolean {
  if (selected.length === 0) return true
  for (let i = 0; i < selected.length; i++) {
    if (itemSegs[i] !== selected[i]) return false
  }
  return true
}

// ── Tree path chip filter ──────────────────────────────────────────────────────

function TreePathFilter({
  allPaths,
  selected,
  onChange,
}: {
  allPaths: string[][]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const maxDepth = allPaths.reduce((m, p) => Math.max(m, p.length), 0)

  const rows: string[][] = []
  for (let depth = 0; depth < maxDepth; depth++) {
    if (depth > 0 && selected.length < depth) break
    const matching = allPaths.filter(p => {
      for (let i = 0; i < depth; i++) {
        if (p[i] !== selected[i]) return false
      }
      return p.length > depth
    })
    const opts = [...new Set(matching.map(p => p[depth]).filter(Boolean))].sort()
    if (opts.length === 0) break
    rows.push(opts)
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      {rows.map((opts, depth) => (
        <div key={depth} className="flex flex-wrap gap-1.5">
          <FilterChip label="Tất cả" active={selected.length <= depth} onClick={() => onChange(selected.slice(0, depth))} />
          {opts.map(opt => (
            <FilterChip
              key={opt}
              label={opt}
              active={selected[depth] === opt}
              onClick={() => onChange([...selected.slice(0, depth), opt])}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Shared filter card ────────────────────────────────────────────────────────

const ctrlClass = 'inline-flex items-center gap-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors'

function FilterCard({
  clubOptions,
  filterClub,
  onClubChange,
  sortDir,
  onSortToggle,
  filterOpen,
  onFilterToggle,
  allPaths,
  pathSelected,
  onPathChange,
}: {
  clubOptions: string[]
  filterClub: string
  onClubChange: (v: string) => void
  sortDir: 'asc' | 'desc'
  onSortToggle: () => void
  filterOpen: boolean
  onFilterToggle: () => void
  allPaths: string[][]
  pathSelected: string[]
  onPathChange: (v: string[]) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Row 1 */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 flex-wrap">
        <div className="flex items-center gap-2">
          {clubOptions.length > 0 && (
            <>
              <span className="text-xs font-medium text-slate-500 select-none">Đơn vị</span>
              <select
                value={filterClub}
                onChange={e => onClubChange(e.target.value)}
                className="text-xs border border-slate-200 rounded-full px-2.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-shadow"
              >
                <option value="">Tất cả</option>
                {clubOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {filterClub && (
                <button onClick={() => onClubChange('')} className="text-slate-400 hover:text-slate-600 transition-colors leading-none">✕</button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onSortToggle} className={ctrlClass}>
            Sắp xếp {sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          <button onClick={onFilterToggle} className={ctrlClass}>
            Bộ lọc {filterOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {/* Row 2 — collapsible chips */}
      {filterOpen && allPaths.length > 0 && (
        <div className="border-t border-slate-100 px-3.5 py-2">
          <TreePathFilter allPaths={allPaths} selected={pathSelected} onChange={onPathChange} />
        </div>
      )}
    </div>
  )
}

// ── Club tag ──────────────────────────────────────────────────────────────────

const ClubTag = ({ name }: { name: string | null | undefined }) => {
  if (!name) return null
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mt-1 font-medium">
      {name}
    </span>
  )
}

// ── Quyen path pills ──────────────────────────────────────────────────────────

const PATH_PILL_STYLES = [
  'text-blue-600 bg-blue-50 border border-blue-100',
  'text-emerald-600 bg-emerald-50 border border-emerald-100',
  'text-violet-600 bg-violet-50 border border-violet-100',
]

const QuyenContentCell = ({ contentName, nodePath, inProgress }: {
  contentName: string
  nodePath: string | null | undefined
  inProgress?: boolean
}) => {
  const segs = nodePath ? nodePath.split(' > ').map(s => s.trim()).filter(Boolean) : []
  return (
    <div>
      <div className="text-sm font-semibold text-blue-700 leading-snug">{contentName}</div>
      {segs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {segs.map((seg, i) => (
            <span
              key={i}
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${PATH_PILL_STYLES[i % PATH_PILL_STYLES.length]}`}
            >
              {seg}
            </span>
          ))}
        </div>
      )}
      {inProgress && (
        <div className="mt-1.5">
          <InProgressBadge />
        </div>
      )}
    </div>
  )
}

// ── Quyen medal cell ──────────────────────────────────────────────────────────

type MedalTone = 'gold' | 'silver' | 'bronze'

const MEDAL_NAME_COLOR: Record<MedalTone, string> = {
  gold:   'text-yellow-600 font-bold',
  silver: 'text-sky-500 font-semibold',
  bronze: 'text-orange-600 font-semibold',
}

const QuyenMedalCell = ({
  names,
  clubs,
  clubIds,
  tone = 'gold',
  onTeamClick,
}: {
  names: string | (string | null)[] | null | undefined
  clubs?: (string | null)[] | null
  clubIds?: (number | null)[] | null
  tone?: MedalTone
  onTeamClick?: (clubId: number, name: string) => void
}) => {
  const nameArr: string[] = names === null || names === undefined
    ? []
    : Array.isArray(names) ? names.filter(Boolean) as string[] : [names]
  const clubArr: string[] = clubs ? clubs.filter(Boolean) as string[] : []
  const clubIdArr: (number | null)[] = clubIds ?? []

  if (nameArr.length === 0)
    return <span className="text-slate-400 select-none">—</span>

  return (
    <div className="flex flex-col gap-3">
      {nameArr.map((name, i) => {
        const club = clubArr[i] ?? null
        const clubId = clubIdArr[i] ?? null
        const isTeam = club === name
        const clickable = isTeam && !!clubId && !!onTeamClick
        const displayName = isTeam ? club : name
        return (
          <div key={i}>
            {clickable ? (
              <button
                onClick={() => onTeamClick!(clubId!, displayName!)}
                className={`text-sm leading-snug ${MEDAL_NAME_COLOR[tone]} hover:underline text-left`}
              >
                {displayName}
              </button>
            ) : (
              <div className={`text-sm leading-snug ${MEDAL_NAME_COLOR[tone]}`}>{displayName}</div>
            )}
            {!isTeam && club && (
              <div className="text-xs text-slate-400 mt-0.5 leading-snug">{club}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Shared medal table head ───────────────────────────────────────────────────

const MEDAL_ICON: Record<MedalTone, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' }

const MedalColHeader = ({ tone, label }: { tone: MedalTone; label: string }) => {
  const text: Record<MedalTone, string> = {
    gold:   'text-yellow-300',
    silver: 'text-slate-300',
    bronze: 'text-orange-300',
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-base leading-none">{MEDAL_ICON[tone]}</span>
      <span className={text[tone]}>{label}</span>
    </span>
  )
}

// ── Quyen table head ──────────────────────────────────────────────────────────

const QuyenTableHead = () => (
  <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white">
    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider w-10 text-blue-200">#</th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-blue-100">Nội dung</th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="gold" label="Vàng" /></th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="silver" label="Bạc" /></th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="bronze" label="Đồng" /></th>
  </tr>
)

// ── Status badge ──────────────────────────────────────────────────────────────

const InProgressBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 font-medium">
    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
    Đang thi đấu
  </span>
)

// ── Medal cell ────────────────────────────────────────────────────────────────

const MedalCell = ({
  names,
  clubs,
  tone = 'gold',
}: {
  names: (string | null)[] | string | null
  clubs?: (string | null)[]
  tone?: MedalTone
}) => {
  const nameArr = names === null ? [] : Array.isArray(names) ? names.filter(Boolean) as string[] : [names]
  if (nameArr.length === 0) return <span className="text-slate-400 select-none">—</span>
  return (
    <div className="flex flex-col gap-3">
      {nameArr.map((n, i) => (
        <div key={i}>
          <div className={`text-sm leading-snug ${MEDAL_NAME_COLOR[tone]}`}>{n}</div>
          {clubs?.[i] && <div className="text-xs text-slate-400 mt-0.5 leading-snug">{clubs[i]}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Table head (Đối kháng) ────────────────────────────────────────────────────

const MedalTableHead = () => (
  <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white">
    <th className="px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider w-10 text-blue-200">#</th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-blue-100">Nội dung</th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="gold" label="Vàng" /></th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="silver" label="Bạc" /></th>
    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="bronze" label="Đồng" /></th>
  </tr>
)

// ── Row: weight class ─────────────────────────────────────────────────────────

const WcRow = ({ wc, idx }: { wc: WeightClassMedal; idx: number }) => (
  <tr className="bg-white transition-colors hover:bg-slate-50">
    <td className="px-3 py-3 text-xs text-slate-400 w-10 text-center font-medium align-middle">{idx + 1}</td>
    <td className="px-4 py-3">
      <div className="flex flex-col justify-center min-h-[48px]">
        <div className="text-sm font-semibold text-blue-700">{wc.weight_class_name}</div>
        <div className="mt-0.5"><TreePathPills treePath={wc.tree_path} size="sm" /></div>
        {wc.status === 'in_progress' && <div className="mt-1"><InProgressBadge /></div>}
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-col justify-center min-h-[48px]">
        {wc.status === 'in_progress'
          ? <span className="text-slate-400">—</span>
          : <MedalCell names={wc.gold} clubs={wc.gold_club ? [wc.gold_club] : []} tone="gold" />}
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-col justify-center min-h-[48px]">
        {wc.status === 'in_progress'
          ? <span className="text-slate-400">—</span>
          : <MedalCell names={wc.silver} clubs={wc.silver_club ? [wc.silver_club] : []} tone="silver" />}
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-col justify-center min-h-[48px]">
        <MedalCell names={wc.bronze} clubs={wc.bronze_clubs ?? []} tone="bronze" />
      </div>
    </td>
  </tr>
)

// ── Row: quyen ────────────────────────────────────────────────────────────────

const QuyenRow = ({
  item,
  idx,
  onTeamClick,
}: {
  item: QuyenMedalGroup
  idx: number
  onTeamClick?: (clubId: number, nodeId: number, kataId: number, kataName: string, clubName: string) => void
}) => {
  const inProg = item.status === 'in_progress'

  function handleTeamClick(clubId: number, clubName: string) {
    if (!item.node_id || !item.kata_id || !onTeamClick) return
    onTeamClick(clubId, item.node_id, item.kata_id, item.content_name, clubName)
  }

  return (
    <tr className="bg-white transition-colors hover:bg-slate-50">
      <td className="px-3 py-3 text-xs text-slate-400 w-10 text-center font-medium tabular-nums align-middle">{idx + 1}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col justify-center min-h-[48px]">
          <QuyenContentCell
            contentName={item.content_name}
            nodePath={item.node_path}
            inProgress={inProg}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col justify-center min-h-[48px]">
          {inProg ? <span className="text-slate-400">—</span>
            : <QuyenMedalCell names={item.gold} clubs={item.gold_club ? [item.gold_club] : []} clubIds={item.gold_club_id ? [item.gold_club_id] : []} tone="gold" onTeamClick={handleTeamClick} />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col justify-center min-h-[48px]">
          {inProg ? <span className="text-slate-400">—</span>
            : <QuyenMedalCell names={item.silver} clubs={item.silver_club ? [item.silver_club] : []} clubIds={item.silver_club_id ? [item.silver_club_id] : []} tone="silver" onTeamClick={handleTeamClick} />}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col justify-center min-h-[48px]">
          {inProg ? <span className="text-slate-400">—</span>
            : <QuyenMedalCell names={item.bronze} clubs={item.bronze_clubs} clubIds={item.bronze_club_ids} tone="bronze" onTeamClick={handleTeamClick} />}
        </div>
      </td>
    </tr>
  )
}

// ── Tab: đối kháng ────────────────────────────────────────────────────────────

const TabDoiKhang = ({ tournamentId }: { tournamentId: number }) => {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterClub, setFilterClub] = useState<string>('')
  const [pathSelected, setPathSelected] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(true)

  const medalsQ = useQuery({
    queryKey: ['medals', tournamentId],
    queryFn: () => getMedals(tournamentId),
    retry: 1,
  })

  const medals = medalsQ.data

  // Parse tree paths: "Đối kháng > Nam > 54kg" → skip first "Đối kháng" segment
  const allPaths = useMemo(() => {
    if (!medals) return []
    return medals.weight_class_medals.map(w => {
      const segs = parsePath(w.tree_path)
      return segs.length > 1 ? segs.slice(1) : segs // skip "Đối kháng" prefix
    })
  }, [medals])

  const clubOptions = useMemo(() => {
    if (!medals) return []
    const names = new Set<string>()
    for (const w of medals.weight_class_medals) {
      if (w.gold_club) names.add(w.gold_club)
      if (w.silver_club) names.add(w.silver_club)
      ;(w.bronze_clubs ?? []).forEach(c => c && names.add(c))
    }
    return [...names].sort()
  }, [medals])

  const filtered = useMemo(() => {
    if (!medals) return []
    let items = medals.weight_class_medals.map((w, i) => ({
      item: w,
      segs: allPaths[i] ?? [],
    }))

    if (pathSelected.length > 0) {
      items = items.filter(({ segs }) => pathMatches(segs, pathSelected))
    }
    if (filterClub) {
      items = items.filter(({ item: w }) =>
        w.gold_club === filterClub ||
        w.silver_club === filterClub ||
        (w.bronze_clubs ?? []).includes(filterClub)
      )
    }
    items.sort((a, b) =>
      sortDir === 'asc'
        ? a.item.tree_path.localeCompare(b.item.tree_path)
        : b.item.tree_path.localeCompare(a.item.tree_path)
    )
    return items.map(({ item }) => item)
  }, [medals, allPaths, pathSelected, filterClub, sortDir])

  if (medalsQ.isLoading) return <LoadingState />
  if (medalsQ.isError) return <ErrorState />
  if (!medals) return null

  return (
    <div className="space-y-3">
      <FilterCard
        clubOptions={clubOptions}
        filterClub={filterClub}
        onClubChange={setFilterClub}
        sortDir={sortDir}
        onSortToggle={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen(o => !o)}
        allPaths={allPaths}
        pathSelected={pathSelected}
        onPathChange={setPathSelected}
      />

      {filtered.length === 0 ? (
        <EmptyState message={filterClub ? `Không có huy chương đối kháng nào của ${filterClub}` : 'Chưa có huy chương đối kháng nào'} />
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead><MedalTableHead /></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((wc, i) => <WcRow key={wc.weight_class_id} wc={wc} idx={i} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: quyền ────────────────────────────────────────────────────────────────

const TabQuyen = ({ tournamentId }: { tournamentId: number }) => {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterClub, setFilterClub] = useState<string>('')
  const [pathSelected, setPathSelected] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(true)
  const [teamMembersTarget, setTeamMembersTarget] = useState<{
    clubId: number; nodeId: number; kataId: number; kataName: string; clubName: string
  } | null>(null)

  const medalsQ = useQuery({
    queryKey: ['medals', tournamentId],
    queryFn: () => getMedals(tournamentId),
    retry: 1,
  })

  const medals = medalsQ.data

  const allPaths = useMemo(() => {
    if (!medals) return []
    return medals.quyen_medals.map(q => parsePath(q.node_path ?? ''))
  }, [medals])

  const clubOptions = useMemo(() => {
    if (!medals) return []
    const names = new Set<string>()
    for (const q of medals.quyen_medals) {
      if (q.gold_club) names.add(q.gold_club)
      if (q.silver_club) names.add(q.silver_club)
      ;(q.bronze_clubs ?? []).forEach(c => c && names.add(c))
    }
    return [...names].sort()
  }, [medals])

  const filtered = useMemo(() => {
    if (!medals) return []
    let items = medals.quyen_medals.map((q, i) => ({
      item: q,
      segs: allPaths[i] ?? [],
    }))
    if (pathSelected.length > 0) {
      items = items.filter(({ segs }) => pathMatches(segs, pathSelected))
    }
    if (filterClub) {
      items = items.filter(({ item: q }) =>
        q.gold_club === filterClub ||
        q.silver_club === filterClub ||
        (q.bronze_clubs ?? []).includes(filterClub)
      )
    }
    const pathOf = (q: QuyenMedalGroup) => `${q.node_path ?? ''} ${q.content_name}`
    items.sort((a, b) =>
      sortDir === 'asc'
        ? pathOf(a.item).localeCompare(pathOf(b.item))
        : pathOf(b.item).localeCompare(pathOf(a.item))
    )
    return items.map(({ item }) => item)
  }, [medals, allPaths, pathSelected, filterClub, sortDir])

  if (medalsQ.isLoading) return <LoadingState />
  if (medalsQ.isError) return <ErrorState />
  if (!medals) return null

  return (
    <div className="space-y-3">
      <FilterCard
        clubOptions={clubOptions}
        filterClub={filterClub}
        onClubChange={setFilterClub}
        sortDir={sortDir}
        onSortToggle={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen(o => !o)}
        allPaths={allPaths}
        pathSelected={pathSelected}
        onPathChange={setPathSelected}
      />

      {filtered.length === 0 ? (
        <EmptyState message={filterClub ? `Không có huy chương quyền nào của ${filterClub}` : 'Chưa có huy chương quyền nào'} />
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead><QuyenTableHead /></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item, i) => (
                <QuyenRow
                  key={`${item.node_id ?? 'root'}-${item.content_name}`}
                  item={item}
                  idx={i}
                  onTeamClick={(clubId, nodeId, kataId, kataName, clubName) =>
                    setTeamMembersTarget({ clubId, nodeId, kataId, kataName, clubName })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {teamMembersTarget && (
        <TeamMembersModal
          tournamentId={tournamentId}
          clubId={teamMembersTarget.clubId}
          nodeId={teamMembersTarget.nodeId}
          kataId={teamMembersTarget.kataId}
          kataName={teamMembersTarget.kataName}
          clubName={teamMembersTarget.clubName}
          onClose={() => setTeamMembersTarget(null)}
        />
      )}
    </div>
  )
}

// ── Tab: theo đơn vị ──────────────────────────────────────────────────────────

const rankBg = (rank: number) => {
  if (rank === 1) return 'bg-yellow-50'
  if (rank === 2) return 'bg-slate-50'
  if (rank === 3) return 'bg-orange-50'
  return 'bg-white'
}

const rankLabel = (rank: number) => {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="text-sm font-bold text-slate-400">{rank}</span>
}

const ClubRankRow = ({ r }: { r: ClubMedalRank }) => (
  <tr className={`transition-colors hover:brightness-95 ${rankBg(r.rank)}`}>
    <td className="px-4 py-3 text-center w-14 align-middle">{rankLabel(r.rank)}</td>
    <td className="px-4 py-3 font-semibold text-blue-700 align-middle">{r.club_name}</td>
    <td className="px-4 py-3 text-center align-middle">
      <span className="font-bold text-yellow-600 text-base">{r.gold || '—'}</span>
    </td>
    <td className="px-4 py-3 text-center align-middle">
      <span className="font-bold text-slate-500 text-base">{r.silver || '—'}</span>
    </td>
    <td className="px-4 py-3 text-center align-middle">
      <span className="font-bold text-orange-500 text-base">{r.bronze || '—'}</span>
    </td>
    <td className="px-4 py-3 text-center align-middle">
      <span className="font-semibold text-slate-600">{r.total}</span>
    </td>
  </tr>
)

const TabByClub = ({ tournamentId }: { tournamentId: number }) => {
  const byClubQ = useQuery({
    queryKey: ['medals-by-club', tournamentId],
    queryFn: () => getMedalsByClub(tournamentId),
    retry: 1,
  })

  if (byClubQ.isLoading) return <LoadingState />
  if (byClubQ.isError) return <ErrorState />
  if (!byClubQ.data) return null

  const { rankings } = byClubQ.data

  if (rankings.length === 0) return (
    <EmptyState message="Chưa có huy chương hoàn thành — hoàn thành các trận đấu để xem bảng xếp hạng" />
  )

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white">
            <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider w-14 text-blue-200">Hạng</th>
            <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-blue-100">Đơn vị</th>
            <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="gold" label="Vàng" /></th>
            <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="silver" label="Bạc" /></th>
            <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider"><MedalColHeader tone="bronze" label="Đồng" /></th>
            <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-blue-200">Tổng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rankings.map(r => <ClubRankRow key={r.club_id} r={r} />)}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared states ─────────────────────────────────────────────────────────────

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
    <Trophy size={36} className="animate-pulse opacity-30" />
    <p className="text-sm">Đang tải dữ liệu...</p>
  </div>
)

const ErrorState = () => (
  <div className="flex items-center justify-center py-20 text-red-400">
    <p className="text-sm font-medium">Không thể tải dữ liệu huy chương</p>
  </div>
)

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-14 text-center">
    <Trophy size={40} className="mx-auto mb-3 text-slate-300" />
    <p className="text-sm text-slate-500">{message}</p>
  </div>
)

// ── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'doi_khang' | 'quyen' | 'club'

const TABS: { id: TabId; label: string }[] = [
  { id: 'club', label: 'Tổng sắp' },
  { id: 'doi_khang', label: 'Đối kháng' },
  { id: 'quyen', label: 'Quyền' },
]

export const MedalsPage = () => {
  const { selectedTournament } = useTournament()
  const [activeTab, setActiveTab] = useState<TabId>('club')

  if (!selectedTournament) return <NoTournamentGuard />

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--color-primary,#152c47)] to-[var(--color-gradient-primary,#1e3d5c)] shadow-md">
        <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-0">
          {/* Icon + text block */}
          <div className="flex items-center gap-4">
            <div className="shrink-0 p-3 rounded-2xl bg-yellow-400/15 border border-yellow-400/30">
              <Trophy size={28} className="text-yellow-300" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-[0.18em] mb-1 select-none">
                Tổng sắp huy chương
              </p>
              <h1 className="text-2xl font-extrabold text-slate-100 leading-tight tracking-tight max-w-2xl truncate">
                {selectedTournament.name}
              </h1>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-0.5">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-all duration-150 border-b-2 select-none',
                    active
                      ? 'bg-white text-[var(--color-primary,#1d4ed8)] border-yellow-400 shadow-sm'
                      : 'text-slate-300 border-transparent hover:text-white',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === 'doi_khang' && <TabDoiKhang tournamentId={selectedTournament.id} />}
        {activeTab === 'quyen' && <TabQuyen tournamentId={selectedTournament.id} />}
        {activeTab === 'club' && <TabByClub tournamentId={selectedTournament.id} />}
      </div>
    </div>
  )
}
