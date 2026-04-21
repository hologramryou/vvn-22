import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { COMPETE_OPTIONS, WEIGHT_CLASSES, CATEGORIES, QUYEN_BY_GENDER } from '../../lib/constants'
import type { Club } from '../../types/student'
import { getNodes, listKatas } from '../../api/tournament_structure'
import type { TournamentStructureNode } from '../../types/tournament'

const QUYEN_EVENTS = new Set(['don_luyen', 'song_luyen', 'da_luyen', 'don_chan'])

const selBase = 'px-3 py-2 text-sm border rounded-lg focus:outline-none transition-colors'
const selOn = `${selBase} border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500`
const selOff = `${selBase} border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed`
const treeChipBase = 'rounded-lg border font-medium transition-colors'
const treeChipCompact = `${treeChipBase} px-2.5 py-1 text-xs`
const treeChipDense = `${treeChipBase} px-2 py-1 text-[11px]`

interface Props {
  keyword: string
  setKeyword: (v: string) => void
  clubId: string
  setClubId: (v: string) => void
  event: string
  setEvent: (v: string) => void
  gender: string
  setGender: (v: string) => void
  dynamicNodeId: string
  weightClass: string
  setWeightClass: (v: string) => void
  quyenSelection: string
  setQuyenSelection: (v: string) => void
  categoryType: string
  setCategoryType: (v: string) => void
  categoryLoai: string
  setCategoryLoai: (v: string) => void
  weightVerified: string
  setWeightVerified: (v: string) => void
  setDynamicTreeFilter?: (next: {
    gender?: string
    dynamicNodeId?: string
    categoryType?: string
    categoryLoai?: string
    weightClass?: string
  }) => void
  clubs: Club[]
  tournamentId?: number
  mobile?: boolean
  topActions?: ReactNode
  resetAction?: ReactNode
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
      {options.map(({ value: optionValue, label }) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
            value === optionValue
              ? 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white border-transparent'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function parseCsv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function toCsv(values: string[]): string {
  return values.join(', ')
}

function toggleCsvValue(value: string, item: string): string {
  const current = parseCsv(value)
  const exists = current.includes(item)
  const next = exists ? current.filter(entry => entry !== item) : [...current, item]
  return toCsv(next)
}

function buildDynamicTree(flatNodes: TournamentStructureNode[], gender: string) {
  const cloned = flatNodes.map(node => ({ ...node, children: [] as TournamentStructureNode[] }))
  const byId = new Map(cloned.map(node => [node.id, node] as const))
  const roots: TournamentStructureNode[] = []

  for (const node of cloned) {
    if (node.parent_id === null) roots.push(node)
    else byId.get(node.parent_id)?.children.push(node)
  }

  const sortDeep = (nodes: TournamentStructureNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    nodes.forEach(node => sortDeep(node.children))
  }
  sortDeep(roots)

  if (!gender) return roots
  return roots.filter(root => root.node_code === gender || root.name === (gender === 'M' ? 'Nam' : 'Nữ'))
}

function getRootCode(node: TournamentStructureNode) {
  return node.node_code ?? (node.name === 'Nam' ? 'M' : 'F')
}

function findPathById(nodes: TournamentStructureNode[], targetId: number): TournamentStructureNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node]
    const childPath = findPathById(node.children, targetId)
    if (childPath) return [node, ...childPath]
  }
  return null
}

function findPathByName(nodes: TournamentStructureNode[], names: string[]): TournamentStructureNode[] | null {
  if (names.length === 0) return []
  const [currentName, ...rest] = names
  for (const node of nodes) {
    if (node.name !== currentName) continue
    if (rest.length === 0) return [node]
    const childPath = findPathByName(node.children, rest)
    if (childPath) return [node, ...childPath]
  }
  return null
}

function findPathByFields(
  roots: TournamentStructureNode[],
  gender: string,
  categoryType: string,
  categoryLoai: string,
  weightClass: string,
): TournamentStructureNode[] {
  const normalizedGenderRoots = gender
    ? roots.filter(root => getRootCode(root) === gender)
    : roots

  for (const root of normalizedGenderRoots) {
    if (weightClass) {
      const weightPath = findPathByName(root.children, [categoryType, categoryLoai, weightClass].filter(Boolean))
      if (weightPath) return [root, ...weightPath]
    }
    if (categoryLoai) {
      const loaiPath = findPathByName(root.children, [categoryType, categoryLoai].filter(Boolean))
      if (loaiPath) return [root, ...loaiPath]
    }
    if (categoryType) {
      const categoryPath = findPathByName(root.children, [categoryType])
      if (categoryPath) return [root, ...categoryPath]
    }
  }

  return normalizedGenderRoots.length === 1 ? [normalizedGenderRoots[0]] : []
}

function buildVisibleRows(roots: TournamentStructureNode[], selectedPath: TournamentStructureNode[]) {
  const rows: TournamentStructureNode[][] = [roots]
  let currentNodes = roots
  let depth = 0

  while (depth < selectedPath.length) {
    const selectedNode = selectedPath[depth]
    const current = currentNodes.find(node => node.id === selectedNode.id)
    if (!current || current.children.length === 0) break
    if (current.children.every(child => child.node_type === 'weight_class')) break
    rows.push(current.children)
    currentNodes = current.children
    depth += 1
  }

  return rows
}

function treeButtonClass(active: boolean, dense = false, disabled = false) {
  const sizeClass = dense ? treeChipDense : treeChipCompact
  if (disabled) {
    return `${sizeClass} border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed`
  }
  return `${sizeClass} ${
    active
      ? 'border-transparent bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white shadow-sm'
      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
  }`
}

export const StudentFilters = ({
  keyword,
  setKeyword,
  clubId,
  setClubId,
  event,
  setEvent,
  gender,
  setGender,
  dynamicNodeId,
  weightClass,
  setWeightClass,
  quyenSelection,
  setQuyenSelection,
  categoryType,
  setCategoryType,
  categoryLoai,
  setCategoryLoai,
  weightVerified,
  setWeightVerified,
  setDynamicTreeFilter,
  clubs,
  tournamentId,
  mobile,
  topActions,
  resetAction,
}: Props) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const nodesQ = useQuery({
    queryKey: ['student-filter-nodes', tournamentId],
    queryFn: () => getNodes(tournamentId!, 'flat'),
    enabled: !!tournamentId,
    staleTime: 30_000,
  })

  const katasQ = useQuery({
    queryKey: ['student-filter-katas', tournamentId],
    queryFn: () => listKatas(tournamentId!),
    enabled: !!tournamentId,
    staleTime: 30_000,
  })

  const selectedWeightClasses = useMemo(() => parseCsv(weightClass), [weightClass])
  const selectedQuyenItems = useMemo(() => parseCsv(quyenSelection), [quyenSelection])
  const primaryWeightClass = selectedWeightClasses[0] ?? ''

  const flatNodes = nodesQ.data?.nodes ?? []
  const allDynamicRoots = tournamentId && flatNodes.length ? buildDynamicTree(flatNodes, '') : []
  const isDynamic = allDynamicRoots.length > 0
  const parsedDynamicNodeId = dynamicNodeId ? Number(dynamicNodeId) : null
  const selectedPath = parsedDynamicNodeId
    ? (findPathById(allDynamicRoots, parsedDynamicNodeId) ?? findPathByFields(allDynamicRoots, gender, categoryType, categoryLoai, primaryWeightClass))
    : findPathByFields(allDynamicRoots, gender, categoryType, categoryLoai, primaryWeightClass)
  const selectedNode = selectedPath[selectedPath.length - 1] ?? null
  const nearLeafNode = selectedNode?.node_type === 'weight_class'
    ? (selectedPath[selectedPath.length - 2] ?? null)
    : (selectedNode && selectedNode.children.some(child => child.node_type === 'weight_class') ? selectedNode : null)
  const visibleRows = buildVisibleRows(allDynamicRoots, selectedPath)
  const hasNearLeafSelection = !!nearLeafNode
  const isQuyenEvent = isDynamic ? event === 'kata' : QUYEN_EVENTS.has(event)

  useEffect(() => {
    if (!isDynamic) return
    if (hasNearLeafSelection) return
    if (!event && !weightClass && !quyenSelection) return
    setEvent('')
  }, [isDynamic, hasNearLeafSelection, event, weightClass, quyenSelection, setEvent])

  const legacyLoaiOptions = categoryType
    ? (CATEGORIES.find(c => c.type === categoryType)?.loaiList ?? [])
    : []

  const legacyWeightOptions =
    gender === 'M' ? WEIGHT_CLASSES.M :
    gender === 'F' ? WEIGHT_CLASSES.F :
    [...WEIGHT_CLASSES.M, ...WEIGHT_CLASSES.F]

  const legacyQuyenItems = QUYEN_EVENTS.has(event)
    ? (
        gender === 'M' ? QUYEN_BY_GENDER.M.filter(g => g.type === event).flatMap(g => g.items) :
        gender === 'F' ? QUYEN_BY_GENDER.F.filter(g => g.type === event).flatMap(g => g.items) :
        [
          ...QUYEN_BY_GENDER.M.filter(g => g.type === event).flatMap(g => g.items),
          ...QUYEN_BY_GENDER.F.filter(g => g.type === event).flatMap(g => g.items),
        ]
      )
    : []

  const quyenItems = isDynamic
    ? (katasQ.data?.katas ?? []).filter(kata => kata.division === 'individual').map(kata => kata.name)
    : legacyQuyenItems

  const eventOptions = isDynamic
    ? [
        { value: 'sparring', label: 'Đối kháng' },
        { value: 'kata', label: 'Quyền' },
      ]
    : COMPETE_OPTIONS

  const genderOptions = [
    { value: '', label: 'Tất cả' },
    { value: 'M', label: 'Nam' },
    { value: 'F', label: 'Nữ' },
  ]

  const categoryOptions = [{ value: '', label: 'Tất cả' }, ...CATEGORIES.map(c => ({ value: c.type, label: c.label }))]
  const weightOptions = legacyWeightOptions.map(weight => ({ value: String(weight.value), label: weight.label }))

  const applyDynamicSelection = (
    node: TournamentStructureNode | null,
    path: TournamentStructureNode[],
  ) => {
    const root = path[0] ?? null
    const nextGender = root ? getRootCode(root) : ''
    const nextCategory = path[1]?.name ?? ''
    const nextWeight = node?.node_type === 'weight_class' ? node.name : ''
    const nextNearLeafNode = node?.node_type === 'weight_class'
      ? path[path.length - 2] ?? null
      : (node && node.children.some(child => child.node_type === 'weight_class') ? node : null)
    const nextLoai = nextNearLeafNode && nextNearLeafNode.level >= 2 ? nextNearLeafNode.name : ''

    setDynamicTreeFilter?.({
      gender: nextGender,
      dynamicNodeId: node ? String(node.id) : '',
      categoryType: nextCategory,
      categoryLoai: nextLoai,
      weightClass: nextWeight,
    })
  }

  const applyDynamicRoot = (node: TournamentStructureNode | null) => {
    applyDynamicSelection(node, node ? [node] : [])
    setEvent('')
    setWeightClass('')
    setQuyenSelection('')
  }

  const renderTopBar = () => (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
      <div className="relative flex-1 min-w-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder="Tìm tên hoặc mã VĐV..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-none">
        <div className="flex flex-wrap items-center gap-2">
          {topActions}
          {resetAction}
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(prev => !prev)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50"
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showAdvanced ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'}
        </button>
      </div>
    </div>
  )

  const renderDynamicTree = () => {
    if (!allDynamicRoots.length) return null

    const nearLeafWeights = nearLeafNode
      ? nearLeafNode.children.filter(child => child.node_type === 'weight_class')
      : []
    const selectedLabels = selectedPath.map(node => node.name)
    const selectedSummary = [
      selectedLabels.length > 0 ? selectedLabels.join(' > ') : null,
      selectedWeightClasses.length > 0 ? `${selectedWeightClasses.length} hạng cân` : null,
      selectedQuyenItems.length > 0 ? `${selectedQuyenItems.length} bài quyền` : null,
    ].filter(Boolean).join(' · ')

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        {clubs.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Đơn vị</div>
            <select
              value={clubId}
              onChange={e => setClubId(e.target.value)}
              className={`${selOn} w-full sm:w-auto min-w-[180px]`}
            >
              <option value="">Tất cả đơn vị</option>
              {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-700">
          {selectedSummary || 'Chưa chọn nhánh thi đấu'}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => applyDynamicRoot(null)} className={treeButtonClass(!selectedNode)}>
            Tất cả
          </button>
          {allDynamicRoots.map(root => (
            <button
              key={root.id}
              type="button"
              onClick={() => applyDynamicRoot(root)}
              className={treeButtonClass(selectedPath[0]?.id === root.id)}
            >
              {root.name}
            </button>
          ))}
        </div>

        {visibleRows.slice(1).map((rowNodes, index) => (
          <div key={`row-${index + 1}`} className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                const parentPath = selectedPath.slice(0, index + 1)
                const parentNode = parentPath[parentPath.length - 1] ?? null
                applyDynamicSelection(parentNode, parentPath)
                if (index + 1 <= 2) {
                  setEvent('')
                  setWeightClass('')
                  setQuyenSelection('')
                }
              }}
              className={treeButtonClass(selectedPath.length === index + 1)}
            >
              Tất cả
            </button>
            {rowNodes.map(node => {
              const pathToNode = [...selectedPath.slice(0, index + 1), node]
              const active = selectedPath[index + 1]?.id === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    applyDynamicSelection(node, pathToNode)
                    setWeightClass('')
                    setQuyenSelection('')
                  }}
                  className={treeButtonClass(active, index + 1 >= 2)}
                >
                  {node.name}
                </button>
              )
            })}
          </div>
        ))}

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Nội dung</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (hasNearLeafSelection) {
                  setEvent('')
                  setWeightClass('')
                  setQuyenSelection('')
                }
              }}
              disabled={!hasNearLeafSelection}
              className={treeButtonClass(event === '', false, !hasNearLeafSelection)}
            >
              Tất cả
            </button>
            {eventOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (hasNearLeafSelection) {
                    setEvent(option.value)
                    if (option.value === 'sparring') setQuyenSelection('')
                    if (option.value === 'kata') setWeightClass('')
                  }
                }}
                disabled={!hasNearLeafSelection}
                className={treeButtonClass(event === option.value, false, !hasNearLeafSelection)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {hasNearLeafSelection && event !== 'kata' && nearLeafWeights.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Hạng cân</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setWeightClass('')}
                className={treeButtonClass(selectedWeightClasses.length === 0, true)}
              >
                Tất cả
              </button>
              {nearLeafWeights.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWeightClass(toggleCsvValue(weightClass, item.name))}
                  className={treeButtonClass(selectedWeightClasses.includes(item.name), true)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasNearLeafSelection && event === 'kata' && quyenItems.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Bài quyền</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setQuyenSelection('')}
                className={treeButtonClass(selectedQuyenItems.length === 0, true)}
              >
                Tất cả
              </button>
              {quyenItems.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuyenSelection(toggleCsvValue(quyenSelection, item))}
                  className={treeButtonClass(selectedQuyenItems.includes(item), true)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderLegacyFilters = () => (
    <>
      <ToggleGroup options={genderOptions} value={gender} onChange={setGender} />
      <ToggleGroup options={categoryOptions} value={categoryType} onChange={setCategoryType} />

      <div className={mobile ? 'flex flex-col gap-3' : 'flex items-center gap-2 flex-wrap'}>
        <select value={clubId} onChange={event => setClubId(event.target.value)} className={`${selOn} ${mobile ? 'w-full' : 'min-w-[140px]'}`}>
          <option value="">Tất cả đơn vị</option>
          {clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>

        <select value={event} onChange={event => setEvent(event.target.value)} className={`${selOn} ${mobile ? 'w-full' : 'min-w-[150px]'}`}>
          <option value="">Tất cả nội dung</option>
          {eventOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select
          value={categoryLoai}
          onChange={event => setCategoryLoai(event.target.value)}
          disabled={legacyLoaiOptions.length === 0}
          className={`${legacyLoaiOptions.length > 0 ? selOn : selOff} ${mobile ? 'w-full' : 'min-w-[160px]'}`}
        >
          {legacyLoaiOptions.length === 0
            ? <option value="">- Chọn hạng mục trước -</option>
            : <>
                <option value="">Tất cả nhóm</option>
                {legacyLoaiOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}{option.hint ? ` - ${option.hint}` : ''}
                  </option>
                ))}
              </>
          }
        </select>

        <select
          value={weightClass}
          onChange={event => setWeightClass(event.target.value)}
          disabled={!weightOptions.length}
          className={`${weightOptions.length > 0 ? selOn : selOff} ${mobile ? 'w-full' : 'min-w-[160px]'}`}
        >
          {!weightOptions.length
            ? <option value="">- Chưa có hạng cân -</option>
            : <>
                <option value="">Tất cả hạng cân</option>
                {weightOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </>
          }
        </select>

        <select
          value={quyenSelection}
          onChange={event => setQuyenSelection(event.target.value)}
          disabled={!isQuyenEvent}
          className={`${isQuyenEvent ? selOn : selOff} ${mobile ? 'w-full' : 'min-w-[200px]'}`}
        >
          {!isQuyenEvent
            ? <option value="">- Chọn Quyền để lọc -</option>
            : <>
                <option value="">Tất cả bài quyền</option>
                {quyenItems.map(item => <option key={item} value={item}>{item}</option>)}
              </>
          }
        </select>

        <select value={weightVerified} onChange={event => setWeightVerified(event.target.value)} className={`${selOn} ${mobile ? 'w-full' : 'min-w-[160px]'}`}>
          <option value="">Tất cả hạng cân</option>
          <option value="true">Đã xác nhận</option>
          <option value="false">Chưa xác nhận</option>
        </select>
      </div>
    </>
  )

  return (
    <div className="flex flex-col gap-3">
      {renderTopBar()}
      {showAdvanced && (isDynamic ? renderDynamicTree() : renderLegacyFilters())}
    </div>
  )
}
