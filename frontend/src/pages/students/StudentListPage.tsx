import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LogOut, Users, SlidersHorizontal, X, ChevronLeft, ChevronRight,
  Plus, Upload, Bookmark, BookmarkCheck, Trash2, Check, RotateCcw, Lock, Download,
} from 'lucide-react'
import { useStudents } from '../../hooks/useStudents'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { StudentCard } from '../../components/students/StudentCard'
import { StudentTable } from '../../components/students/StudentTable'
import { StudentFilters } from '../../components/students/StudentFilters'
import { ImportModal } from '../../components/students/ImportModal'
import { deleteStudent, bulkDeleteStudents, fetchExportCardsData } from '../../api/students'
import { ExportModal } from '../../components/students/ExportModal'
import type { StudentCardData } from '../../types/student'
import type { SavedFilter } from '../../hooks/useStudents'
import { useTournament } from '../../context/TournamentContext'
import { NoTournamentGuard } from '../../components/NoTournamentGuard'
import {
  useKatas,
  useReplaceTeamKataRegistration,
  useReplaceTeamKataMembers,
  useStructureNodes,
  useTeamKataRegistration,
} from '../../hooks/useTournamentStructure'
import { fetchStudents } from '../../api/students'
import { getTeamKataMembers } from '../../api/tournament_structure'
import type { TournamentKata, TournamentStructureNode } from '../../types/tournament'
import type { Club } from '../../types/student'

const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: 'Đã phát hành',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Kết thúc',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const Skeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
    ))}
  </div>
)

function sortNodes<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

function buildNodePath(nodeId: number | null, flatNodes: TournamentStructureNode[]): number[] {
  if (!nodeId) return []
  const node = flatNodes.find(item => item.id === nodeId)
  if (!node) return []
  if (node.parent_id === null) return [nodeId]
  return [...buildNodePath(node.parent_id, flatNodes), nodeId]
}

function buildGroupLevels(
  flatNodes: TournamentStructureNode[],
  selectedPath: number[],
): TournamentStructureNode[][] {
  const levels: TournamentStructureNode[][] = []
  const rootNodes = sortNodes(flatNodes.filter(node => node.parent_id === null && node.node_type === 'group'))
  if (rootNodes.length === 0) return levels
  levels.push(rootNodes)

  for (const selectedId of selectedPath) {
    const children = sortNodes(
      flatNodes.filter(
        node => node.parent_id === selectedId && node.node_type === 'group',
      ),
    )
    if (children.length === 0) break
    levels.push(children)
  }

  return levels
}

function isTerminalGroupNode(nodeId: number | null, flatNodes: TournamentStructureNode[]): boolean {
  if (!nodeId) return false
  const node = flatNodes.find(item => item.id === nodeId)
  if (!node || node.node_type !== 'group') return false
  return !flatNodes.some(child => child.parent_id === nodeId && child.node_type === 'group')
}

function SaveFilterModal({
  onSave,
  onClose,
}: {
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-base">Lưu bộ lọc</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tên bộ lọc</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name); onClose() } }}
            placeholder="Ví dụ: Nam Phong trào Loại 4..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            Hủy
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => { onSave(name); onClose() }}
            className="px-4 py-2 text-sm bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Check size={14} />
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamKataRegistrationModal({
  tournamentId,
  clubs,
  isAdmin,
  myClubId,
  onClose,
}: {
  tournamentId: number
  clubs: Club[]
  isAdmin: boolean
  myClubId: number
  onClose: () => void
}) {
  const availableClubs = useMemo(() => clubs, [clubs])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(
    isAdmin ? (availableClubs[0]?.id ?? null) : (myClubId || null),
  )
  const [selectedPath, setSelectedPath] = useState<number[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  useEffect(() => {
    if (!isAdmin) {
      setSelectedClubId(myClubId || null)
      return
    }
    if (!selectedClubId && availableClubs.length > 0) {
      setSelectedClubId(availableClubs[0].id)
    }
  }, [availableClubs, isAdmin, myClubId, selectedClubId])

  const katasQ = useKatas(tournamentId)
  const nodesQ = useStructureNodes(tournamentId)
  const registrationQ = useTeamKataRegistration(tournamentId, selectedClubId)
  const saveMutation = useReplaceTeamKataRegistration(tournamentId)
  const saveMembersMutation = useReplaceTeamKataMembers(tournamentId)

  // memberSelections: { [nodeId:kataId]: studentId[] }
  const [memberSelections, setMemberSelections] = useState<Record<string, (number | null)[]>>({})
  const [clubStudents, setClubStudents] = useState<{ id: number; full_name: string }[]>([])

  useEffect(() => {
    if (!selectedClubId) return
    fetchStudents({ club_id: selectedClubId, tournament_id: tournamentId, page: 1, page_size: 100, status: 'active' })
      .then(res => setClubStudents(res.items ?? []))
      .catch(() => setClubStudents([]))
  }, [selectedClubId])
  const flatNodes = useMemo(() => nodesQ.data?.nodes ?? [], [nodesQ.data])
  const teamKatas = useMemo(
    () => ((katasQ.data?.katas ?? []) as TournamentKata[])
      .filter(kata => kata.division === 'team')
      .sort((a, b) => a.sort_order - b.sort_order),
    [katasQ.data],
  )
  const levels = useMemo(
    () => buildGroupLevels(flatNodes, selectedPath),
    [flatNodes, selectedPath],
  )
  const selectedNodeId = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null
  const canPickKata = useMemo(
    () => isTerminalGroupNode(selectedNodeId, flatNodes),
    [flatNodes, selectedNodeId],
  )
  const selectedNodePathLabel = useMemo(() => {
    if (!selectedNodeId) return ''
    return buildNodePath(selectedNodeId, flatNodes)
      .map(nodeId => flatNodes.find(node => node.id === nodeId)?.name ?? '?')
      .join(' > ')
  }, [flatNodes, selectedNodeId])
  const selectedKataIdsForNode = useMemo(() => {
    if (!selectedNodeId) return []
    return selectedKeys
      .filter(key => key.startsWith(`${selectedNodeId}:`))
      .map(key => Number(key.split(':')[1]))
  }, [selectedKeys, selectedNodeId])
  const registrationSummary = useMemo(() => {
    const kataMap = new Map(teamKatas.map(kata => [kata.id, kata]))
    const grouped = new Map<number, { nodeId: number; nodePath: string; nodeOrder: number[]; katas: TournamentKata[] }>()

    for (const key of selectedKeys) {
      const [nodeId, kataId] = key.split(':').map(Number)
      const kata = kataMap.get(kataId)
      if (!kata) continue
      const existing = grouped.get(nodeId)
      if (existing) {
        existing.katas.push(kata)
        continue
      }
      const nodePathIds = buildNodePath(nodeId, flatNodes)
      grouped.set(nodeId, {
        nodeId,
        nodePath: nodePathIds
          .map(pathNodeId => flatNodes.find(node => node.id === pathNodeId)?.name ?? '?')
          .join(' > '),
        nodeOrder: nodePathIds.map(
          pathNodeId => flatNodes.find(node => node.id === pathNodeId)?.sort_order ?? 0,
        ),
        katas: [kata],
      })
    }

    return Array.from(grouped.values())
      .map(item => ({
        ...item,
        katas: [...item.katas].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const maxLength = Math.max(a.nodeOrder.length, b.nodeOrder.length)
        for (let index = 0; index < maxLength; index += 1) {
          const diff = (a.nodeOrder[index] ?? -1) - (b.nodeOrder[index] ?? -1)
          if (diff !== 0) return diff
        }
        return a.nodePath.localeCompare(b.nodePath)
      })
  }, [flatNodes, selectedKeys, teamKatas])

  useEffect(() => {
    const registrations = registrationQ.data?.registrations ?? []
    setSelectedKeys(registrations.map(r => `${r.node_id}:${r.kata_id}`))
    if (registrations.length > 0 && flatNodes.length > 0) {
      setSelectedPath(buildNodePath(registrations[0].node_id, flatNodes))
    } else {
      setSelectedPath([])
    }
    if (!selectedClubId || registrations.length === 0) {
      setMemberSelections({})
      return
    }
    // Load saved members for each registered key
    ;(async () => {
      const entries = await Promise.all(
        registrations.map(async r => {
          try {
            const res = await getTeamKataMembers(tournamentId, selectedClubId, r.node_id, r.kata_id)
            const ids = res.members.map(m => m.student_id)
            // Pad to team_size with nulls
            const padded: (number | null)[] = [...ids]
            while (padded.length < res.team_size) padded.push(null)
            return [`${r.node_id}:${r.kata_id}`, padded] as const
          } catch {
            return null
          }
        }),
      )
      setMemberSelections(Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => e !== null)))
    })()
  }, [flatNodes, registrationQ.data?.registrations, selectedClubId, tournamentId])

  const selectedClubName = availableClubs.find(club => club.id === selectedClubId)?.name ?? 'Đơn vị'

  function toggleKata(nodeId: number, kataId: number) {
    const key = `${nodeId}:${kataId}`
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key],
    )
  }

  function handlePickNode(levelIndex: number, nodeId: number) {
    setSelectedPath(prev => [...prev.slice(0, levelIndex), nodeId])
  }

  function handleFocusNode(nodeId: number) {
    setSelectedPath(buildNodePath(nodeId, flatNodes))
  }

  function toggleSelectedNodeKata(kataId: number) {
    if (!selectedNodeId) return
    toggleKata(selectedNodeId, kataId)
  }

  async function handleSave() {
    if (!selectedClubId) return
    const kataMap = new Map(teamKatas.map(k => [k.id, k]))
    // Validate min_team_size before saving
    for (const key of selectedKeys) {
      const [, kata_id] = key.split(':').map(Number)
      const kata = kataMap.get(kata_id)
      if (!kata?.min_team_size) continue
      const filled = (memberSelections[key] ?? []).filter((id): id is number => id !== null).length
      if (filled < kata.min_team_size) {
        alert(`Bài "${kata.name}" yêu cầu tối thiểu ${kata.min_team_size} vận động viên (hiện tại: ${filled})`)
        return
      }
    }
    const items = selectedKeys.map(key => {
      const [node_id, kata_id] = key.split(':').map(Number)
      return { node_id, kata_id }
    })
    // Capture member selections before any async op — saveMutation invalidates registrationQ
    // which triggers a useEffect that overwrites memberSelections with server data (empty),
    // causing saveMembersMutation to receive studentIds: [] and wipe the user's selections.
    const capturedSelections = { ...memberSelections }

    await saveMutation.mutateAsync({ clubId: selectedClubId, items })

    // Save members for each registered (nodeId, kataId)
    for (const item of items) {
      const key = `${item.node_id}:${item.kata_id}`
      const selected = (capturedSelections[key] ?? []).filter((id): id is number => id !== null)
      await saveMembersMutation.mutateAsync({
        clubId: selectedClubId,
        nodeId: item.node_id,
        kataId: item.kata_id,
        studentIds: selected,
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Đăng ký Quyền Đồng Đội</h3>
            <p className="mt-1 text-sm text-gray-500">
              Chọn các bài quyền đồng đội cho đơn vị trong giải hiện tại.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {isAdmin ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Đơn vị</label>
              <select
                value={selectedClubId ?? ''}
                onChange={e => setSelectedClubId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              >
                {availableClubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Đơn vị: <span className="font-medium">{selectedClubName}</span>
            </div>
          )}

          {katasQ.isLoading || registrationQ.isLoading || nodesQ.isLoading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              Đang tải cấu hình quyền đồng đội và tree path...
            </div>
          ) : teamKatas.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-700">
              Giải này chưa cấu hình bài quyền đồng đội trong phần Cấu trúc giải đấu.
            </div>
          ) : levels.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-700">
              Giải này chưa có tree path nhóm hợp lệ cho quyền đồng đội.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Chọn tree path
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Chọn từng cấp giống luồng quyền cá nhân. Chỉ khi tới node cuối cùng, hệ thống mới hiển thị bài quyền đồng đội để chọn.
                  </p>
                </div>

                <div className="space-y-3">
                  {levels.map((options, levelIndex) => (
                    <div key={levelIndex}>
                      <p className="mb-1.5 text-[11px] font-medium text-gray-400">
                        {levelIndex === 0 ? 'Nhóm gốc' : 'Nhóm'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {options.map(option => {
                          const active = selectedPath[levelIndex] === option.id
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handlePickNode(levelIndex, option.id)}
                              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                active
                                  ? 'border-[var(--color-primary,#1d4ed8)] bg-[var(--color-primary,#1d4ed8)] text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              {option.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedNodeId && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-sm font-medium text-blue-700">
                      Đã chọn: {selectedNodePathLabel}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Chọn bài quyền đồng đội
                </p>
                {!selectedNodeId ? (
                  <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Chọn tree path trước khi đăng ký bài quyền đồng đội.
                  </div>
                ) : !canPickKata ? (
                  <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Tree path này chưa phải node cuối. Hãy chọn tiếp xuống cấp cuối cùng để hiện bài quyền đồng đội.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm font-medium text-gray-700">{selectedNodePathLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {teamKatas.map(kata => {
                        const active = selectedKataIdsForNode.includes(kata.id)
                        return (
                          <button
                            key={`${selectedNodeId}:${kata.id}`}
                            type="button"
                            onClick={() => toggleSelectedNodeKata(kata.id)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              active
                                ? 'border-[var(--color-primary,#1d4ed8)] bg-[var(--color-primary,#1d4ed8)] text-white'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {kata.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {registrationSummary.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Đã chọn theo tree path
                    </p>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                      {registrationSummary.length} nhóm
                    </span>
                  </div>
                  <div className="space-y-3">
                    {registrationSummary.map(item => (
                      <button
                        key={item.nodeId}
                        type="button"
                        onClick={() => handleFocusNode(item.nodeId)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{item.nodePath}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
                            {item.katas.length} bài quyền
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.katas.map(kata => (
                            <span
                              key={`${item.nodeId}-${kata.id}`}
                              className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            >
                              {kata.name}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {registrationSummary.length > 0 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
                    Vận động viên tham gia
                  </p>
                  <div className="space-y-4">
                    {registrationSummary.flatMap(item =>
                      item.katas.map(kata => {
                        const key = `${item.nodeId}:${kata.id}`
                        const slots = memberSelections[key] ?? Array.from({ length: kata.team_size }, () => null)
                        const selectedIds = new Set(slots.filter((id): id is number => id !== null))

                        function setSlot(slotIdx: number, studentId: number | null) {
                          setMemberSelections(prev => {
                            const current = prev[key] ?? Array.from({ length: kata.team_size }, () => null)
                            const next = [...current]
                            next[slotIdx] = studentId
                            return { ...prev, [key]: next }
                          })
                        }

                        return (
                          <div key={key} className="rounded-lg border border-gray-200 bg-white p-3">
                            <p className="text-sm font-medium text-gray-800 mb-1">{kata.name}</p>
                            <p className="text-xs text-gray-400 mb-2">{item.nodePath}</p>
                            <div className="space-y-2">
                              {slots.map((selected, slotIdx) => (
                                <select
                                  key={slotIdx}
                                  value={selected ?? ''}
                                  onChange={e => setSlot(slotIdx, e.target.value ? Number(e.target.value) : null)}
                                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary,#1d4ed8)]"
                                >
                                  <option value="">VĐV {slotIdx + 1} — chọn VĐV</option>
                                  {clubStudents
                                    .filter(s => !selectedIds.has(s.id) || s.id === selected)
                                    .map(s => (
                                      <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(registrationQ.error || saveMutation.error || nodesQ.error) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(saveMutation.error as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
                ?? (registrationQ.error as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
                ?? (nodesQ.error as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
                ?? 'Không thể tải hoặc lưu đăng ký quyền đồng đội'}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedClubId || saveMutation.isPending}
            className="rounded-lg bg-[var(--color-primary,#1d4ed8)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Đang lưu...' : 'Lưu đăng ký'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SavedFiltersBar({
  savedFilters,
  onApply,
  onDelete,
  onSaveNew,
  hasActiveFilter,
}: {
  savedFilters: SavedFilter[]
  onApply: (id: string) => void
  onDelete: (id: string) => void
  onSaveNew: () => void
  hasActiveFilter: boolean
}) {
  const [selected, setSelected] = useState('')

  const handleApply = (id: string) => {
    setSelected(id)
    onApply(id)
  }

  const handleDelete = (id: string) => {
    onDelete(id)
    if (selected === id) setSelected('')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {savedFilters.length > 0 && (
        <div className="flex items-center gap-1">
          <select
            value={selected}
            onChange={e => { if (e.target.value) handleApply(e.target.value) }}
            className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] text-gray-700 max-w-[200px]"
          >
            <option value="">— Bộ lọc đã lưu —</option>
            {savedFilters.map(sf => (
              <option key={sf.id} value={sf.id}>{sf.name}</option>
            ))}
          </select>
          {selected && (
            <button
              onClick={() => handleDelete(selected)}
              title="Xóa bộ lọc này"
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      {hasActiveFilter && (
        <button
          onClick={onSaveNew}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-[var(--color-primary,#1d4ed8)] text-[var(--color-primary,#1d4ed8)] rounded-lg hover:bg-blue-50 transition-colors"
        >
          {savedFilters.length > 0 ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          Lưu bộ lọc
        </button>
      )}
    </div>
  )
}

class StudentPageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StudentListPage render error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-xl w-full rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Không thể hiển thị trang vận động viên</h2>
            <p className="mt-2 text-sm text-gray-600">
              Đã xảy ra lỗi render trong màn `/students`. Hãy tải lại trang. Nếu lỗi còn lặp lại, mở console để xem chi tiết.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const StudentListPageContent = () => {
  const bp = useBreakpoint()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { selectedTournament } = useTournament()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showTeamKataModal, setShowTeamKataModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exportStudents, setExportStudents] = useState<StudentCardData[] | null>(null)
  const [exportMode, setExportMode] = useState<'selected' | 'club'>('selected')
  const [exportLoading, setExportLoading] = useState(false)

  const {
    data, isLoading, isFetching, error,
    clubs, keyword, setKeyword,
    clubId, setClubId,
    event, setEvent,
    gender, setGender,
    dynamicNodeId,
    weightClass, setWeightClass,
    quyenSelection, setQuyenSelection,
    categoryType, setCategoryType,
    categoryLoai, setCategoryLoai,
    weightVerified, setWeightVerified,
    setDynamicTreeFilter,
    savedFilters, saveCurrentFilter, applyFilter, deleteFilter, resetFilters,
    hasActiveFilter,
    page, setPage,
    pageSize, setPageSize,
  } = useStudents(selectedTournament?.id)

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteStudents,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setSelectedIds(new Set())
    },
  })

  if (!selectedTournament) return <NoTournamentGuard />

  const tournamentStatus = selectedTournament.status
  const isLocked = tournamentStatus !== 'DRAFT'

  const handleDelete = (id: number) => {
    if (confirm('Xác nhận xóa môn sinh này?')) deleteMutation.mutate(id)
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    if (confirm(`Xác nhận xóa ${selectedIds.size} môn sinh đã chọn?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds))
    }
  }

  const userName = localStorage.getItem('user_name') ?? 'Admin'
  const userRole = localStorage.getItem('user_role') ?? 'viewer'
  const myClubId = Number(localStorage.getItem('club_id') ?? 0)
  const isAdmin = userRole === 'admin'
  const canManageTeamKata = !isLocked && (isAdmin || (userRole === 'club' && myClubId > 0))
  const logout = () => { localStorage.clear(); window.location.href = '/login' }

  const tournamentName = selectedTournament.name
  const tournamentYear = (() => {
    const m = selectedTournament.name?.match(/\b(20\d{2})\b/)
    return m ? Number(m[1]) : new Date().getFullYear()
  })()

  const currentItems = data?.items ?? []

  function handleSelectChange(id: number, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(currentItems.map(s => s.id)) : new Set())
  }

  async function handleExportSelected() {
    if (selectedIds.size === 0) return
    setExportLoading(true)
    try {
      const exportData = await fetchExportCardsData({ ids: Array.from(selectedIds), tournament_id: selectedTournament.id })
      setExportMode('selected')
      setExportStudents(exportData)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleExportClub() {
    if (!clubId) return
    setExportLoading(true)
    try {
      const exportData = await fetchExportCardsData({ club_id: Number(clubId), tournament_id: selectedTournament.id })
      setExportMode('club')
      setExportStudents(exportData)
    } finally {
      setExportLoading(false)
    }
  }

  const canWriteAny = userRole === 'admin' && !isLocked
  const canEditStudent = (s: { club_id: number | null }) => {
    if (isLocked) return false
    if (userRole === 'admin') return true
    if (userRole === 'club' && myClubId > 0) return s.club_id === myClubId
    return false
  }

  const filterProps = {
    keyword, setKeyword,
    clubId, setClubId,
    event, setEvent,
    gender, setGender,
    dynamicNodeId,
    weightClass, setWeightClass,
    quyenSelection, setQuyenSelection,
    categoryType, setCategoryType,
    categoryLoai, setCategoryLoai,
    weightVerified, setWeightVerified,
    setDynamicTreeFilter,
    clubs,
    tournamentId: selectedTournament.id,
  }

  const desktopFilterActions = (
    <SavedFiltersBar
      savedFilters={savedFilters}
      onApply={applyFilter}
      onDelete={deleteFilter}
      onSaveNew={() => setShowSaveModal(true)}
      hasActiveFilter={hasActiveFilter}
    />
  )

  const desktopResetAction = hasActiveFilter ? (
    <button
      onClick={resetFilters}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
    >
      <RotateCcw size={12} />
      Reset bộ lọc
    </button>
  ) : null

  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--color-primary,#1d4ed8)] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">VV</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm md:text-base">Quản lý vận động viên</h1>
              {isFetching && !isLoading && (
                <span className="text-xs text-blue-500 animate-pulse">Đang tải...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && clubId && (
              <button
                onClick={handleExportClub}
                disabled={exportLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export CLB</span>
              </button>
            )}
            {isAdmin && selectedIds.size > 0 && (
              <button
                onClick={handleExportSelected}
                disabled={exportLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export ({selectedIds.size})</span>
              </button>
            )}
            {canWriteAny && selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Xóa ({selectedIds.size})</span>
              </button>
            )}
            {canWriteAny && (
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}
            {canManageTeamKata && (
              <button
                onClick={() => setShowTeamKataModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-[var(--color-primary,#1d4ed8)] text-[var(--color-primary,#1d4ed8)] rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Users size={13} />
                <span className="hidden sm:inline">Quyền Đồng Đội</span>
              </button>
            )}
            {(canWriteAny || (userRole === 'club' && !isLocked)) && (
              <button
                onClick={() => navigate('/students/new')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 transition-colors"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Thêm mới</span>
              </button>
            )}
            {isLocked && (
              <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 rounded-lg">
                <Lock size={12} />
                <span className="hidden sm:inline">{TOURNAMENT_STATUS_LABEL[tournamentStatus] ?? tournamentStatus}</span>
              </span>
            )}
            <span className="hidden sm:block text-sm text-gray-500 ml-1">{userName}</span>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {bp !== 'mobile' && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 pt-3 pb-2 space-y-2">
            <StudentFilters
              {...filterProps}
              topActions={desktopFilterActions}
              resetAction={desktopResetAction}
            />
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        {isLocked && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
            <Lock size={16} className="flex-shrink-0" />
            <span>
              Giải đấu đang ở trạng thái <strong>{TOURNAMENT_STATUS_LABEL[tournamentStatus] ?? tournamentStatus}</strong>.
              Không thể thêm, sửa hoặc xóa vận động viên. Vui lòng <strong>Reset giải đấu</strong> để chỉnh sửa.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} className="text-blue-600" />
            <span className="font-medium">{total.toLocaleString()}</span>
            <span>môn sinh</span>
          </div>

          {bp === 'mobile' && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 font-medium"
            >
              <SlidersHorizontal size={14} />
              Bộ lọc
              {hasActiveFilter && <span className="w-2 h-2 bg-[var(--color-primary,#1d4ed8)] rounded-full" />}
            </button>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Không tải được danh sách vận động viên. Vui lòng thử lại hoặc kiểm tra API `/students`.
          </div>
        ) : isLoading ? (
          <Skeleton />
        ) : bp === 'mobile' ? (
          <div className="space-y-2">
            {(data?.items ?? []).map(s => (
              <div key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="cursor-pointer">
                <StudentCard
                  student={s}
                  onDelete={handleDelete}
                  onEdit={studentId => navigate(`/students/${studentId}/edit`)}
                  canEdit={canEditStudent(s)}
                />
              </div>
            ))}
            {(data?.items ?? []).length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Users size={40} className="mx-auto mb-2 opacity-30" />
                <p>Không tìm thấy môn sinh</p>
              </div>
            )}
          </div>
        ) : (
          <StudentTable
            students={data?.items ?? []}
            onDelete={handleDelete}
            onView={studentId => navigate(`/students/${studentId}`)}
            onEdit={studentId => navigate(`/students/${studentId}/edit`)}
            canEdit={canEditStudent}
            canVerifyWeight={userRole === 'admin'}
            showCheckboxes={isAdmin}
            selectedIds={selectedIds}
            onSelectChange={handleSelectChange}
            onSelectAll={handleSelectAll}
          />
        )}

        {data && total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Trang {page} / {totalPages} · {total} bản ghi
            </span>
            <div className="flex items-center gap-1">
              <div className="mr-2 flex items-center gap-2">
                <label htmlFor="students-page-size" className="text-xs text-gray-500 whitespace-nowrap">
                  Số dòng/trang
                </label>
                <select
                  id="students-page-size"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              {totalPages > 1 && (
                <>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${n === page ? 'bg-[var(--color-primary,#1d4ed8)] text-white' : 'hover:bg-gray-100'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {exportStudents && (
        <ExportModal
          students={exportStudents}
          tournamentName={tournamentName}
          tournamentYear={tournamentYear}
          exportMode={exportMode}
          clubId={clubId ? Number(clubId) : undefined}
          onClose={() => { setExportStudents(null); setSelectedIds(new Set()) }}
        />
      )}

      {showImport && <ImportModal tournamentId={selectedTournament?.id} onClose={() => setShowImport(false)} />}

      {showSaveModal && (
        <SaveFilterModal
          onSave={saveCurrentFilter}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {showTeamKataModal && (
        <TeamKataRegistrationModal
          tournamentId={selectedTournament.id}
          clubs={clubs}
          isAdmin={isAdmin}
          myClubId={myClubId}
          onClose={() => setShowTeamKataModal(false)}
        />
      )}

      {bp === 'mobile' && drawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Bộ lọc</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <StudentFilters
              {...filterProps}
              mobile
              topActions={(
                <SavedFiltersBar
                  savedFilters={savedFilters}
                  onApply={id => { applyFilter(id); setDrawerOpen(false) }}
                  onDelete={deleteFilter}
                  onSaveNew={() => { setDrawerOpen(false); setShowSaveModal(true) }}
                  hasActiveFilter={hasActiveFilter}
                />
              )}
              resetAction={hasActiveFilter ? (
                <button
                  onClick={() => { resetFilters(); setDrawerOpen(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  <RotateCcw size={12} />
                  Reset bộ lọc
                </button>
              ) : null}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 bg-[var(--color-primary,#1d4ed8)] text-white py-3 rounded-xl font-semibold"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const StudentListPage = () => (
  <StudentPageErrorBoundary>
    <StudentListPageContent />
  </StudentPageErrorBoundary>
)
