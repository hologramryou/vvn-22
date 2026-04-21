import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import * as structureAPI from '../../api/tournament_structure'
import type { TournamentStructureNode } from '../../types/tournament'

function sortedByOrder<T extends { sort_order: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.sort_order - b.sort_order)
}

function isLeaf(nodeId: number, flat: TournamentStructureNode[]): boolean {
  return !flat.some(n => n.parent_id === nodeId)
}

function isWeightClassNode(nodeId: number, flat: TournamentStructureNode[]): boolean {
  const node = flat.find(n => n.id === nodeId)
  if (!node) return false
  return node.node_type === 'weight_class'
}

function buildPath(nodeId: number | null, flat: TournamentStructureNode[]): number[] {
  if (!nodeId) return []
  const node = flat.find(n => n.id === nodeId)
  if (!node) return []
  if (node.parent_id === null) return [nodeId]
  return [...buildPath(node.parent_id, flat), nodeId]
}

function findGenderNode(flat: TournamentStructureNode[], gender: string): TournamentStructureNode | null {
  return flat.find(n =>
    n.parent_id === null && (
      n.node_code === gender ||
      (gender === 'M' ? n.name === 'Nam' : n.name === 'Nữ')
    )
  ) ?? null
}

function buildLevelsFromParent(
  flat: TournamentStructureNode[],
  parentId: number,
  path: number[],
): TournamentStructureNode[][] {
  const levels: TournamentStructureNode[][] = []
  const first = sortedByOrder(flat.filter(n => n.parent_id === parentId))
  if (first.length === 0) return []
  levels.push(first)
  for (const selectedId of path) {
    const children = sortedByOrder(flat.filter(n => n.parent_id === selectedId))
    if (children.length === 0) break
    levels.push(children)
  }
  return levels
}

export interface RegistrationValue {
  // Classification node (parent of weight_class) - required for any registration
  nodeId: number | null

  // Sparring registration
  sparring: boolean
  sparringWeightId: number | null  // Required if sparring=true (weight_class leaf node)

  // Kata registration
  kata: boolean
  kataIds: number[]  // Required if kata=true (≥1)
}

export const EMPTY_REGISTRATION: RegistrationValue = {
  nodeId: null,
  sparring: false,
  sparringWeightId: null,
  kata: false,
  kataIds: [],
}

type ActiveTab = 'sparring' | 'kata'

interface Props {
  tournamentId: number
  studentGender: string
  value: RegistrationValue
  onChange: (v: RegistrationValue) => void
  error?: string
}

function BoxingGloveIcon() {
  return <span aria-hidden="true" className="text-base leading-none">🥊</span>
}

function DualSwordsIcon() {
  return <span aria-hidden="true" className="text-base leading-none">🏆</span>
}

export function TournamentRegistrationPicker({
  tournamentId,
  studentGender,
  value,
  onChange,
  error,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sparring')
  const [nodePath, setNodePath] = useState<number[]>([])

  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const nodesQ = useQuery({
    queryKey: ['tournament-structure', 'nodes', tournamentId],
    queryFn: () => structureAPI.getNodes(tournamentId, 'flat'),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  })
  const katasQ = useQuery({
    queryKey: ['tournament-structure', 'katas', tournamentId],
    queryFn: () => structureAPI.listKatas(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  })

  const flatNodes = useMemo(() => nodesQ.data?.nodes ?? [], [nodesQ.data])
  const katas = useMemo(
    () => sortedByOrder((katasQ.data?.katas ?? []).filter(kata => kata.division === 'individual')),
    [katasQ.data],
  )

  useEffect(() => {
    if (value.nodeId && flatNodes.length > 0) {
      const fullPath = buildPath(value.nodeId, flatNodes)
      setNodePath(fullPath.slice(1))
    } else if (!value.nodeId) {
      setNodePath([])
    }
  }, [flatNodes, value.nodeId])

  if (nodesQ.isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Đang tải cấu trúc giải đấu...
      </div>
    )
  }

  if (flatNodes.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>
          Giải đấu chưa có cấu trúc hạng mục.{' '}
          <a href={`/tournaments/${tournamentId}/structure/weight-classes`} className="underline font-medium">
            Thiết lập cấu trúc
          </a>
        </span>
      </div>
    )
  }

  const genderNode = findGenderNode(flatNodes, studentGender)

  // Select tree up to parent of weight_class (not the weight_class itself)
  const levels = genderNode ? buildLevelsFromParent(flatNodes, genderNode.id, nodePath) : []
  const lastId = nodePath[nodePath.length - 1] ?? null

  // Check if selected node is parent of weight_class leaf (correct level)
  const isNodeParentOfLeaf = lastId !== null && !isLeaf(lastId, flatNodes) &&
    flatNodes.some(n => n.parent_id === lastId && isLeaf(n.id, flatNodes) && isWeightClassNode(n.id, flatNodes))

  // Get weight_class children of selected node
  const weightClassChildren = lastId && isNodeParentOfLeaf
    ? sortedByOrder(flatNodes.filter(n => n.parent_id === lastId && isLeaf(n.id, flatNodes) && isWeightClassNode(n.id, flatNodes)))
    : []

  const selectedKatas = katas.filter(k => value.kataIds.includes(k.id))
  const availableKatas = katas.filter(k => !value.kataIds.includes(k.id))

  const sparringChecked = value.sparring
  const kataChecked = value.kata

  function handleToggleSparring(e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    if (value.sparring) {
      onChange({ ...value, sparring: false, sparringWeightId: null })
      return
    }
    onChange({ ...value, sparring: true })
    setActiveTab('sparring')
  }

  function handleToggleKata(e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    if (value.kata) {
      onChange({ ...value, kata: false, kataIds: [] })
    } else {
      onChange({ ...value, kata: true })
      setActiveTab('kata')
    }
  }

  function handlePickNode(levelIdx: number, nodeId: number) {
    const newPath = [...nodePath.slice(0, levelIdx), nodeId]
    setNodePath(newPath)

    onChange({
      ...value,
      nodeId: nodeId,
      sparringWeightId: null,  // Reset when node changes
      kata: false,
      kataIds: [],
    })
  }

  function handlePickSparringWeight(weightId: number) {
    const isSelected = value.sparringWeightId === weightId
    onChange({
      ...value,
      sparring: !isSelected,
      sparringWeightId: isSelected ? null : weightId,
    })
  }

  function handlePickKata(kataId: number) {
    const newKataIds = value.kataIds.includes(kataId)
      ? value.kataIds.filter(id => id !== kataId)
      : [...value.kataIds, kataId]
    onChange({
      ...value,
      kata: newKataIds.length > 0,
      kataIds: newKataIds,
    })
  }

  function toggleKata(kataId: number) {
    const next = value.kataIds.includes(kataId)
      ? value.kataIds.filter(id => id !== kataId)
      : [...value.kataIds, kataId]
    onChange({ ...value, kataIds: next })
  }

  return (
    <div className="flex flex-col gap-3">

      <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4">
        {!genderNode ? (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle size={14} />
            Chưa tìm thấy nhánh {studentGender === 'M' ? 'Nam' : 'Nữ'} trong cấu trúc giải.{' '}
            <a href={`/tournaments/${tournamentId}/structure/weight-classes`} className="underline">
              Kiểm tra cấu trúc
            </a>
          </div>
        ) : (
          <>
            {/* Tree selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">Giới tính:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  studentGender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                }`}>
                  {genderNode.name}
                </span>
                <span className="text-[10px] text-gray-400">(tự động từ hồ sơ)</span>
              </div>

              <div className="flex flex-col gap-3">
                {levels.map((opts, li) => {
                  // Skip last level if node is selected and has weight_class children (show as tabs instead)
                  if (isNodeParentOfLeaf && li === levels.length - 1) return null

                  return (
                    <div key={li}>
                      <p className="text-[11px] text-gray-400 mb-1.5 font-medium">
                        {li === 0 ? 'Hạng mục' : 'Nhóm'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {opts.map(opt => {
                          const sel = nodePath[li] === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handlePickNode(li, opt.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                sel
                                  ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              {opt.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {value.nodeId && (
                <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-1">
                  {/* Tree path: Gender › ... › WeightClass */}
                  <p className="text-xs text-blue-700 font-medium">
                    {genderNode.name}
                    {' › '}
                    {nodePath.map(id => flatNodes.find(n => n.id === id)?.name ?? '?').join(' › ')}
                    {value.sparringWeightId && (() => {
                      const wNode = flatNodes.find(n => n.id === value.sparringWeightId)
                      return wNode ? ` › ${wNode.name}` : null
                    })()}
                  </p>
                  {/* Contest types */}
                  {(value.sparring || value.kata) && (
                    <div className="flex gap-1.5 flex-wrap">
                      {value.sparring && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                          🥊 Đối kháng
                        </span>
                      )}
                      {value.kata && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                          🏆 Quyền {value.kataIds.length > 0 ? `(${value.kataIds.length} bài)` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs when node is selected and has weight_class children */}
            {isNodeParentOfLeaf && value.nodeId && (
              <div className="border-t border-gray-100 pt-4">
                <div className={`flex rounded-xl border overflow-hidden mb-3 ${error ? 'border-red-300' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sparring')}
                    className={`flex-1 flex items-center gap-2 py-2.5 px-3 transition-colors ${
                      activeTab === 'sparring'
                        ? value.sparring
                          ? 'bg-[var(--color-primary,#1d4ed8)] text-white'
                          : 'bg-blue-50 text-blue-700 border-b-2 border-blue-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <BoxingGloveIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">Đối kháng</span>
                    {sparringChecked && (
                      <span className={`ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm ${
                        activeTab === 'sparring' && value.sparring
                          ? 'border-white/30 bg-white/15 text-white'
                          : 'border-blue-200 bg-blue-50 text-blue-600'
                      }`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  <div className="w-px bg-gray-200 flex-shrink-0" />

                  <button
                    type="button"
                    onClick={() => setActiveTab('kata')}
                    className={`flex-1 flex items-center gap-2 py-2.5 px-3 transition-colors ${
                      activeTab === 'kata'
                        ? value.kata
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-50 text-purple-700 border-b-2 border-purple-400'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <DualSwordsIcon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">Quyền</span>
                    {kataChecked && (
                      <span className={`ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm ${
                        activeTab === 'kata' && value.kata
                          ? 'border-white/30 bg-white/15 text-white'
                          : 'border-purple-200 bg-purple-50 text-purple-600'
                      }`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </div>

                {/* Sparring tab */}
                {activeTab === 'sparring' && weightClassChildren.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-gray-500 font-medium uppercase">Chọn hạng cân</p>
                    <div className="flex flex-wrap gap-1.5">
                      {weightClassChildren.map(w => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => handlePickSparringWeight(w.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            value.sparringWeightId === w.id
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50'
                          }`}
                        >
                          {w.name}
                          {value.sparringWeightId === w.id && <span className="ml-1 text-[10px] opacity-75">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kata tab */}
                {activeTab === 'kata' && katas.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-gray-500 font-medium uppercase">Chọn bài quyền</p>
                    <div className="flex flex-wrap gap-1.5">
                      {katas.map(k => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => handlePickKata(k.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            value.kataIds.includes(k.id)
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          {k.name}
                          {value.kataIds.includes(k.id) && <span className="ml-1 text-[10px] opacity-75">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
