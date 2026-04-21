import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { List, Loader2, Play, CheckCircle, Eye, X, Zap, Network, GripVertical, Save, ShieldCheck, Trophy, Users, RefreshCw } from 'lucide-react'
import { useTournament } from '../context/TournamentContext'
import { NoTournamentGuard } from '../components/NoTournamentGuard'
import { QuyenResultsModal } from '../components/QuyenResultsModal'
import { TeamMembersModal } from '../components/TeamMembersModal'
import { TreePathPills } from '../components/ui'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getSchedule,
  startMatch,
  cancelMatch,
  updateMatchResult,
  startQuyenSlot,
  completeQuyenSlot,
  updateSchedule,
  updateMatchJudgeSetup,
  updateQuyenJudgeSetup,
} from '../api/tournaments'
import { getUsers } from '../api/users'
import { localApi, isLocalMode } from '../lib/axios'
import type { QuyenSlot, ScheduleBracketMatch, TournamentSchedule } from '../types/tournament'
import { canScore, canSetup, getUserRole } from '../lib/auth'


function getQuyenBranchPath(slot: QuyenSlot): string | null {
  return slot.node_path
}

function getMatchBranchPath(match: ScheduleBracketMatch): string | null {
  return match.node_path
}

function getQuyenUnitLabel(slot: QuyenSlot): string {
  return slot.representative_type === 'club' ? slot.player_name : slot.player_club ?? '—'
}

function getQuyenRepresentativeText(slot: QuyenSlot): string {
  return slot.representative_type === 'club' ? 'Đồng đội' : slot.player_name
}

function getQuyenContentSubtext(slot: QuyenSlot): string {
  return slot.representative_type === 'club' ? 'Đại diện đơn vị' : slot.player_name
}

// â"€â"€ Status helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-blue-50 text-blue-400 border border-blue-200',
  ready:     'bg-blue-100 text-blue-700 border border-blue-200',
  checking:  'bg-amber-100 text-amber-700 border border-amber-300',
  ongoing:   'bg-yellow-100 text-yellow-700 border border-yellow-300',
  scoring:   'bg-violet-100 text-violet-700 border border-violet-200',
  completed: 'bg-green-100 text-green-700 border border-green-200',
}
const STATUS_LABEL: Record<string, string> = {
  pending:   'Chờ',
  ready:     'Sẵn sàng',
  checking:  'Đang thi đấu',
  ongoing:   'Đang thi đấu',
  scoring:   'Đang chấm',
  completed: 'Kết thúc',
}
const ROW_BG: Record<string, string> = {
  pending:   'bg-white',
  ready:     'bg-blue-50',
  checking:  'bg-amber-50',
  ongoing:   'bg-yellow-50',
  scoring:   'bg-violet-50',
  completed: 'bg-gray-50',
}

const STATUS_PRIORITY: Record<string, number> = {
  checking: 0, ongoing: 1, scoring: 2, ready: 3, pending: 4, completed: 5,
}

function displayStatus(m: { status: string; player1_name: string | null; player2_name: string | null; is_bye?: boolean }): string {
  return m.status
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-500'} ${status === 'ongoing' ? 'animate-pulse' : ''}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function getQuyenStatusMeta(slot: QuyenSlot): { key: string; label: string } {
  if (slot.status === 'pending') {
    if (slot.assigned_judges_count < 5) {
      return { key: 'pending', label: 'Chờ' }
    }
    return { key: 'ready', label: 'Sẵn sàng' }
  }
  return {
    key: slot.status,
    label: STATUS_LABEL[slot.status] ?? slot.status,
  }
}

function QuyenStatusBadge({ slot }: { slot: QuyenSlot }) {
  const meta = getQuyenStatusMeta(slot)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[meta.key] ?? 'bg-gray-100 text-gray-500'} ${meta.key === 'ongoing' ? 'animate-pulse' : ''}`}>
      {meta.label}
    </span>
  )
}

function getQuyenManageLabel(slot: QuyenSlot): string {
  if (slot.status === 'pending' && slot.assigned_judges_count < 5) return 'Setup trọng tài'
  if (slot.status === 'ready') return 'Bắt đầu'
  if (slot.status === 'completed') return 'Kết quả'
  return 'Điều hành chấm'
}

function getMatchStatusMeta(match: ScheduleBracketMatch): { key: string; label: string } {
  if (match.status === 'checking' || match.status === 'ongoing') {
    return { key: match.status, label: 'Đang thi đấu' }
  }
  return {
    key: match.status,
    label: STATUS_LABEL[match.status] ?? match.status,
  }
}

function MatchStatusBadge({ match }: { match: ScheduleBracketMatch }) {
  const meta = getMatchStatusMeta(match)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[meta.key] ?? 'bg-gray-100 text-gray-500'} ${meta.key === 'ongoing' ? 'animate-pulse' : ''}`}>
      {meta.label}
    </span>
  )
}

function getMatchManageLabel(match: ScheduleBracketMatch): string {
  if (match.status === 'ready') return 'Bắt đầu'
  if (match.status === 'pending') return 'Bắt đầu'
  return 'Chấm điểm'
}

function CourtBadge({ court }: { court: string | null }) {
  if (!court) return <span className="text-gray-300 text-xs">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white ${court === 'A' ? 'bg-blue-500' : 'bg-purple-500'}`}>
      Sân {court}
    </span>
  )
}

// â"€â"€ Modal types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type ModalState =
  | { type: 'start-match'; match: ScheduleBracketMatch }
  | { type: 'result'; match: ScheduleBracketMatch }
  | { type: 'view'; match: ScheduleBracketMatch }
  | { type: 'start-quyen'; slot: QuyenSlot }
  | { type: 'complete-quyen'; slot: QuyenSlot }
  | null

// â"€â"€ Court busy check â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function isCourtBusy(schedule: TournamentSchedule | undefined, court: string | null): boolean {
  if (!court || !schedule) return false
  return (
    schedule.bracket_matches.some(m => m.status === 'ongoing' && m.court === court) ||
    schedule.quyen_slots.some(s => ['checking', 'ongoing', 'scoring'].includes(s.status) && s.court === court)
  )
}

// â"€â"€ Quyá»n table â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface QuyenTableProps {
  slots: QuyenSlot[]
  schedule: TournamentSchedule
  onAction: (modal: ModalState) => void
  onManage: (slotId: number) => void
  onViewResults: (slotId: number) => void
  selectedSlotIds?: Set<number>
  onToggleSlot?: (slotId: number) => void
  onViewTeamMembers?: (slot: QuyenSlot) => void
}

function QuyenTable({ slots, schedule, onAction, onManage, onViewResults, selectedSlotIds, onToggleSlot, onViewTeamMembers }: QuyenTableProps) {
  if (slots.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">Không có lượt thi quyền phù hợp.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-[11px] uppercase tracking-wider">
            {onToggleSlot && <th className="py-2.5 px-3 w-8" />}
            <th className="py-2.5 px-3 text-left w-12 font-semibold">STT</th>
            <th className="py-2.5 px-3 text-left font-semibold">Nội dung thi đấu</th>
            <th className="py-2.5 px-3 text-left w-[26rem] font-semibold">Nhánh thi đấu</th>
            <th className="py-2.5 px-3 text-left font-semibold">Đại diện</th>
            <th className="py-2.5 px-3 text-left font-semibold whitespace-nowrap">Đơn vị</th>
            <th className="py-2.5 px-3 text-left w-20 font-semibold">Sân</th>
            <th className="py-2.5 px-3 text-left w-32 font-semibold">Trạng thái</th>
            <th className="py-2.5 px-3 text-left w-28 font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const busy = isCourtBusy(schedule, slot.court)
            return (
              <tr key={slot.id} className={`border-b border-gray-50 ${ROW_BG[slot.status] ?? ''}`}>
                {onToggleSlot && (
                  <td className="py-2.5 px-3 w-8 text-center">
                    {slot.assigned_judges_count === 0 && slot.status === 'pending' ? (
                      <input
                        type="checkbox"
                        checked={selectedSlotIds?.has(slot.id) ?? false}
                        onChange={() => onToggleSlot(slot.id)}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                    ) : (
                      <span className="w-4 h-4 block" />
                    )}
                  </td>
                )}
                <td className="py-2.5 px-3 whitespace-nowrap text-center">
                  {slot.schedule_order != null ? (
                    <span className="font-mono text-xs font-bold bg-[var(--color-primary,#1d4ed8)] text-white px-2 py-0.5 rounded-full tabular-nums">
                      {slot.schedule_order}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-sm text-[var(--color-primary-dark,#1e3a5f)]">{slot.content_name}</div>
                  <div className="text-[11px] text-slate-500">{getQuyenContentSubtext(slot)}</div>
                </td>
                <td className="py-2.5 px-3"><TreePathPills treePath={getQuyenBranchPath(slot)} size="sm" /></td>
                <td className="py-2.5 px-3 text-sm text-[var(--color-primary,#1d4ed8)]">{getQuyenRepresentativeText(slot)}</td>
                <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                  {slot.representative_type === 'club' && onViewTeamMembers && slot.club_id && slot.node_id ? (
                    <button
                      onClick={() => onViewTeamMembers(slot)}
                      className="text-indigo-600 hover:underline text-left"
                    >
                      {getQuyenUnitLabel(slot)}
                    </button>
                  ) : (
                    getQuyenUnitLabel(slot)
                  )}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap"><CourtBadge court={slot.court} /></td>
                <td className="py-2.5 px-3 whitespace-nowrap"><QuyenStatusBadge slot={slot} /></td>
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-1">
                    {(slot.status === 'pending' || slot.status === 'ready') && (
                      <>
                        <button
                          onClick={() => canSetup() && navigate(`/quyen-slots/${slot.id}/setup`)}
                          disabled={!canSetup()}
                          className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                            canSetup()
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                              : 'bg-gray-100 text-slate-400 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <ShieldCheck size={11} />Cài đặt trọng tài
                        </button>
                        <button
                          onClick={() => onManage(slot.id)}
                          disabled={slot.assigned_judges_count < 5 || !canSetup()}
                          className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                            slot.assigned_judges_count >= 5 && canSetup()
                              ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                              : 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Play size={11} />{getQuyenManageLabel(slot)}
                        </button>
                      </>
                    )}
                    {slot.status === 'checking' && canSetup() && (
                      <button
                        onClick={() => onManage(slot.id)}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-amber-500 text-white rounded hover:bg-amber-600 whitespace-nowrap"
                      >
                        <Eye size={11} />Điều hành chấm
                      </button>
                    )}
                    {slot.status === 'ongoing' && canSetup() && (
                      <button
                        onClick={() => onManage(slot.id)}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
                      >
                        <Eye size={11} />Điều hành chấm
                      </button>
                    )}
                    {slot.status === 'scoring' && canSetup() && (
                      <button
                        onClick={() => onManage(slot.id)}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-violet-600 text-white rounded hover:bg-violet-700 whitespace-nowrap"
                      >
                        <Eye size={11} />Điều hành chấm
                      </button>
                    )}
                    {slot.status === 'completed' && (
                      <button
                        onClick={() => onViewResults(slot.id)}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold border border-gray-200 text-gray-600 rounded hover:bg-gray-50 whitespace-nowrap"
                      >
                        <Eye size={11} />Xem kết quả
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// â"€â"€ Unified editable item (quyen + match together) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type UnifiedItem =
  | { kind: 'quyen'; id: number; schedule_order: number | null; status: string; court: string | null; data: QuyenSlot }
  | { kind: 'match'; id: number; schedule_order: number | null; status: string; court: string | null; data: ScheduleBracketMatch }

function unifiedId(item: UnifiedItem) {
  return item.kind === 'quyen' ? `q-${item.id}` : `m-${item.id}`
}

interface SortableUnifiedRowProps {
  item: UnifiedItem
  newOrder: number
  onCourtChange: (kind: 'quyen' | 'match', id: number, court: 'A' | 'B') => void
}

function SortableUnifiedRow({ item, newOrder, onCourtChange }: SortableUnifiedRowProps) {
  const canDrag = item.status === 'ready' || item.status === 'pending'
  const uid = unifiedId(item)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uid, disabled: !canDrag })

  const rowBg = isDragging ? 'bg-orange-50 shadow-lg ring-2 ring-orange-300 z-10' : ROW_BG[item.status] ?? 'bg-white'

  const kindBadge = item.kind === 'quyen'
    ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">Quyền</span>
    : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Đối kháng</span>

  let contentNode: React.ReactNode = null
  let branchNode: React.ReactNode = <span className="text-xs text-gray-300">—</span>
  let unitNode: React.ReactNode = <span className="text-xs text-gray-300">—</span>
  if (item.kind === 'quyen') {
    contentNode = (
      <>
        <div className="font-semibold text-sm text-[var(--color-primary-dark,#1e3a5f)]">{item.data.content_name}</div>
        <div className="text-[11px] text-slate-500">{getQuyenContentSubtext(item.data)}</div>
      </>
    )
    branchNode = <TreePathPills treePath={getQuyenBranchPath(item.data)} size="sm" />
    unitNode = <span className="text-xs text-gray-600">{getQuyenUnitLabel(item.data)}</span>
  } else {
    const m = item.data
    contentNode = (
      <>
        <div className="font-medium text-sm text-gray-800 truncate max-w-[240px]">{[m.player1_name, m.player2_name].filter(Boolean).join(' vs ') || 'TBD vs TBD'}</div>
        <div className="text-[11px] text-gray-400 truncate max-w-[240px]">{[m.weight_class_name, m.round_label, m.gender === 'M' ? 'Nam' : 'Nữ'].filter(Boolean).join(' · ')}</div>
      </>
    )
    branchNode = <TreePathPills treePath={getMatchBranchPath(m)} size="sm" />
    unitNode = (
      <div className="text-xs">
        <div className="text-red-600">{m.player1_club ?? '—'}</div>
        <div className="text-blue-600 mt-0.5">{m.player2_club ?? '—'}</div>
      </div>
    )
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`border-b border-gray-100 ${rowBg}`}
      {...attributes}
    >
      <td className="py-2 px-2 w-8">
        {canDrag ? (
          <button {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-400 touch-none block" title="Kéo để thay đổi vị trí">
            <GripVertical size={16} />
          </button>
        ) : (
          <GripVertical size={16} className="mx-auto text-gray-200" />
        )}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap text-center w-14">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${canDrag ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {newOrder}
        </span>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap w-24">{kindBadge}</td>
      <td className="py-2.5 px-3">{contentNode}</td>
      <td className="py-2.5 px-3 w-[20rem]">{branchNode}</td>
      <td className="py-2.5 px-3 w-40">{unitNode}</td>
      <td className="py-2 px-3 w-24">
        <div className="flex gap-1">
          {(['A', 'B'] as const).map(c => (
            <button key={c} onClick={() => onCourtChange(item.kind, item.id, c)}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                item.court === c
                  ? c === 'A' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}>{c}</button>
          ))}
        </div>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap w-32"><StatusBadge status={item.status} /></td>
    </tr>
  )
}

interface EditableUnifiedTableProps {
  items: UnifiedItem[]
  onDragEnd: (event: DragEndEvent) => void
  onCourtChange: (kind: 'quyen' | 'match', id: number, court: 'A' | 'B') => void
}

function EditableUnifiedTable({ items, onDragEnd, onCourtChange }: EditableUnifiedTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(unifiedId)} strategy={verticalListSortingStrategy}>
          <table className="w-full text-sm" style={{ minWidth: 1080 }}>
            <thead>
              <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-2 w-8"><GripVertical size={12} className="mx-auto text-white/40" /></th>
                <th className="py-2.5 px-3 text-center w-14 font-semibold">STT</th>
                <th className="py-2.5 px-3 text-left w-24 font-semibold">Loại</th>
                <th className="py-2.5 px-3 text-left font-semibold">Nội dung / Đối thủ</th>
                <th className="py-2.5 px-3 text-left w-[20rem] font-semibold">Nhánh thi đấu</th>
                <th className="py-2.5 px-3 text-left w-40 font-semibold">Đơn vị</th>
                <th className="py-2.5 px-3 text-left w-24 font-semibold">Sân</th>
                <th className="py-2.5 px-3 text-left w-32 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <SortableUnifiedRow key={unifiedId(item)} item={item} newOrder={idx + 1} onCourtChange={onCourtChange} />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// â"€â"€ All-in-one table (Quyá»n + Äá»'i khÃ¡ng, sorted by schedule_order) â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface AllTableProps {
  schedule: TournamentSchedule
  sttMap: Map<number, number>
  filteredQuyen: QuyenSlot[]
  filteredMatches: ScheduleBracketMatch[]
  onAction: (modal: ModalState) => void
  onScore: (id: number) => void
  onManageQuyen: (slotId: number) => void
  onViewResults: (slotId: number) => void
  onViewBracket: (wcId: number, matchId: number) => void
  focusStt?: number | null
  onClearFocus?: () => void
  navigate: ReturnType<typeof useNavigate>
  selectedMatchIds?: Set<number>
  onToggleMatch?: (matchId: number) => void
  selectedSlotIds?: Set<number>
  onToggleSlot?: (slotId: number) => void
  onViewTeamMembers?: (slot: QuyenSlot) => void
}

function AllTable({ schedule, sttMap, filteredQuyen, filteredMatches, onAction, onScore, onManageQuyen, onViewResults, onViewBracket, focusStt, onClearFocus, navigate, selectedMatchIds, onToggleMatch, selectedSlotIds, onToggleSlot, onViewTeamMembers }: AllTableProps) {
  const focusRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (focusStt != null && focusRowRef.current) {
      focusRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusStt])
  type Row =
    | { kind: 'quyen'; order: number; data: QuyenSlot }
    | { kind: 'match'; order: number; data: ScheduleBracketMatch }

  const rows: Row[] = [
    ...filteredQuyen.map(s => ({ kind: 'quyen' as const, order: s.schedule_order ?? 9999, data: s })),
    ...filteredMatches.filter(m => !m.is_bye).map(m => ({ kind: 'match' as const, order: m.schedule_order ?? 9999, data: m })),
  ].sort((a, b) => a.order - b.order)

  if (rows.length === 0) return <p className="text-xs text-gray-400 py-4 text-center">Không có trận đấu nào.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 1080 }}>
        <thead>
          <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-[11px] uppercase tracking-wider">
            {(onToggleMatch || onToggleSlot) && <th className="py-2.5 px-3 w-8" />}
            <th className="py-2.5 px-3 text-center w-14 font-semibold">STT</th>
            <th className="py-2.5 px-3 text-left w-24 font-semibold">Loại</th>
            <th className="py-2.5 px-3 text-left font-semibold">Nội dung / Đối thủ</th>
            <th className="py-2.5 px-3 text-left w-[24rem] font-semibold">Nhánh thi đấu</th>
            <th className="py-2.5 px-3 text-left w-36 font-semibold">Đơn vị</th>
            <th className="py-2.5 px-3 text-left w-16 font-semibold">Sân</th>
            <th className="py-2.5 px-3 text-left w-28 font-semibold">Trạng thái</th>
            <th className="py-2.5 px-3 text-left w-52 font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            if (row.kind === 'quyen') {
              const slot = row.data
              const busy = isCourtBusy(schedule, slot.court)
              return (
                <tr key={`q-${slot.id}`} className={`border-b border-gray-50 ${ROW_BG[slot.status] ?? ''}`}>
                  {(onToggleMatch || onToggleSlot) && (
                    <td className="py-2.5 px-3 w-8 text-center">
                      {onToggleSlot && slot.assigned_judges_count === 0 && slot.status === 'pending' ? (
                        <input
                          type="checkbox"
                          checked={selectedSlotIds?.has(slot.id) ?? false}
                          onChange={() => onToggleSlot(slot.id)}
                          className="w-4 h-4 accent-purple-600 cursor-pointer"
                        />
                      ) : (
                        <span className="w-4 h-4 block" />
                      )}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {slot.schedule_order != null
                      ? <span className="font-mono text-xs font-bold bg-[var(--color-primary,#1d4ed8)] text-white px-2 py-0.5 rounded-full tabular-nums">{slot.schedule_order}</span>
                      : <span className="text-gray-300 text-[11px]">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">Quyền</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-sm text-[var(--color-primary-dark,#1e3a5f)]">{slot.content_name}</div>
                    <div className="text-[11px] text-slate-500">{getQuyenContentSubtext(slot)}</div>
                  </td>
                  <td className="py-2.5 px-3"><TreePathPills treePath={getQuyenBranchPath(slot)} size="sm" /></td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                    {slot.representative_type === 'club' && onViewTeamMembers && slot.club_id && slot.node_id ? (
                      <button onClick={() => onViewTeamMembers(slot)} className="text-indigo-600 hover:underline text-left">
                        {getQuyenUnitLabel(slot)}
                      </button>
                    ) : (
                      getQuyenUnitLabel(slot)
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap"><CourtBadge court={slot.court} /></td>
                  <td className="py-2.5 px-3 whitespace-nowrap"><QuyenStatusBadge slot={slot} /></td>
                  <td className="py-2 px-3">
                    <div className="flex flex-col gap-1">
                      {(slot.status === 'pending' || slot.status === 'ready') && (
                        <>
                          <button
                            onClick={() => canSetup() && navigate(`/quyen-slots/${slot.id}/setup`)}
                            disabled={!canSetup()}
                            className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                              canSetup()
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                                : 'bg-gray-100 text-slate-400 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <ShieldCheck size={11} />Cài đặt trọng tài
                          </button>
                          <button
                            onClick={() => onManageQuyen(slot.id)}
                            disabled={slot.assigned_judges_count < 5 || !canSetup()}
                            className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                              slot.assigned_judges_count >= 5 && canSetup()
                                ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                : 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                            }`}
                          >
                            <Play size={11} />{getQuyenManageLabel(slot)}
                          </button>
                        </>
                      )}
                      {slot.status === 'checking' && canSetup() && (
                        <button 
                          onClick={() => onManageQuyen(slot.id)}
                          className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-amber-500 text-white rounded hover:bg-amber-600 whitespace-nowrap">
                          <Eye size={11} />Điều hành chấm
                        </button>
                      )}
                      {slot.status === 'ongoing' && canSetup() && (
                        <button 
                          onClick={() => onManageQuyen(slot.id)}
                          className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap">
                          <Eye size={11} />Điều hành chấm
                        </button>
                      )}
                      {slot.status === 'scoring' && canSetup() && (
                        <button 
                          onClick={() => onManageQuyen(slot.id)}
                          className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-violet-600 text-white rounded hover:bg-violet-700 whitespace-nowrap">
                          <Eye size={11} />Điều hành chấm
                        </button>
                      )}
                      {slot.status === 'completed' && (
                        <button 
                          onClick={() => onViewResults(slot.id)}
                          className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold border border-gray-200 text-gray-600 rounded hover:bg-gray-50 whitespace-nowrap">
                          <Eye size={11} />Xem kết quả
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            }

            const m = row.data
            const dStatus = displayStatus(m)
            const rowStt = sttMap.get(m.id) ?? null
            const isFocused = focusStt != null && rowStt === focusStt
            return (
              <tr
                key={`m-${m.id}`}
                ref={isFocused ? focusRowRef : null}
                className={`border-b transition-colors ${isFocused ? 'bg-yellow-100' : `border-gray-50 ${ROW_BG[dStatus] ?? ''}`}`}
                onClick={isFocused ? onClearFocus : undefined}
              >
                {(onToggleMatch || onToggleSlot) && (
                  <td className="py-2.5 px-3 w-8 text-center" onClick={e => e.stopPropagation()}>
                    {onToggleMatch && m.assigned_judges_count === 0 && (dStatus === 'pending' || dStatus === 'ready') ? (
                      <input
                        type="checkbox"
                        checked={selectedMatchIds?.has(m.id) ?? false}
                        onChange={() => onToggleMatch(m.id)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                    ) : (
                      <span className="w-4 h-4 block" />
                    )}
                  </td>
                )}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  {m.schedule_order != null
                    ? <span className="font-mono text-xs font-bold bg-[var(--color-primary,#1d4ed8)] text-white px-2 py-0.5 rounded-full tabular-nums">{m.schedule_order}</span>
                    : <span className="text-gray-300 text-[11px]">—</span>}
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Đối kháng</span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm text-red-600 truncate max-w-[150px]">{m.player1_name || 'TBD'}</span>
                    <span className="font-semibold text-sm text-blue-600 truncate max-w-[150px] mt-0.5">{m.player2_name || 'TBD'}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">{[m.weight_class_name, m.round_label, m.gender === 'M' ? 'Nam' : 'Nữ'].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="py-2.5 px-3"><TreePathPills treePath={getMatchBranchPath(m)} size="sm" /></td>
                <td className="py-2.5 px-3 text-xs">
                  <div className="text-red-600">{m.player1_club ?? '—'}</div>
                  <div className="text-blue-600 mt-0.5">{m.player2_club ?? '—'}</div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap"><CourtBadge court={m.court} /></td>
                <td className="py-2.5 px-3 whitespace-nowrap"><MatchStatusBadge match={m} /></td>
                <td className="py-2 px-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onViewBracket(m.weight_class_id, m.id)}
                      className="flex items-center gap-1 w-32 px-2 py-1 text-xs bg-orange-50 border border-orange-200 text-orange-600 rounded hover:bg-orange-100 whitespace-nowrap"
                    >
                      <Network size={11} />Sơ đồ
                    </button>
                    {(dStatus === 'pending' || dStatus === 'ready') && (
                      <>
                        <button
                          onClick={() => canSetup() && navigate(`/matches/${m.id}/setup`)}
                          disabled={!canSetup()}
                          className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                            canSetup()
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                              : 'bg-gray-100 text-slate-400 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <ShieldCheck size={11} />Cài đặt trọng tài
                        </button>
                        <button
                          onClick={() => onScore(m.id)}
                          disabled={false}
                          title={!isLocalMode ? 'Chỉ khả dụng ở chế độ local' : undefined}
                          className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                            isLocalMode && m.assigned_judges_count >= 5 && canSetup()
                              ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                              : 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Play size={11} />{getMatchManageLabel(m)}
                        </button>
                      </>
                    )}
                    {(dStatus === 'checking' || dStatus === 'ongoing') && canSetup() && (
                      <button
                        onClick={() => onScore(m.id)}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-yellow-500 text-white rounded hover:bg-yellow-600 whitespace-nowrap"
                      >
                        <Zap size={11} />{dStatus === 'checking' ? 'Điều hành chấm' : 'Chấm điểm'}
                      </button>
                    )}
                    {dStatus === 'completed' && (
                      <button
                        onClick={() => onAction({ type: 'view', match: m })}
                        className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold border border-gray-200 text-gray-600 rounded hover:bg-gray-50 whitespace-nowrap"
                      >
                        <Eye size={11} />Xem kết quả
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Sort round_labels in the correct tournament order (shared by MatchTable + EditableMatchTable)
const FIXED_LABEL_ORDER = ['Tứ kết', 'Bán kết', 'Chung kết']

function roundLabelSortKey(label: string): number {
  const vongMatch = label.match(/^Vòng (\d+)$/)
  if (vongMatch) return parseInt(vongMatch[1], 10)
  const idx = FIXED_LABEL_ORDER.indexOf(label)
  if (idx !== -1) return 1000 + idx
  return 999
}

// â"€â"€ Sortable match row (edit mode) â€" same columns as MatchTable â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// SortableMatchRow kept for reference (currently unused â€" EditableUnifiedTable replaced it)
interface SortableMatchRowProps {
  match: ScheduleBracketMatch
  newOrder: number
  onCourtChange: (matchId: number, court: 'A' | 'B') => void
}

function SortableMatchRow({ match, newOrder, onCourtChange }: SortableMatchRowProps) {
  const dStatus = displayStatus(match)
  const isBye = match.is_bye
  const canDrag = !isBye && (dStatus === 'ready' || dStatus === 'pending')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: match.id, disabled: !canDrag })
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`border-b border-gray-100 ${
        isDragging ? 'bg-orange-50 shadow-lg ring-2 ring-orange-300 z-10' :
        isBye ? 'opacity-50 bg-white' :
        (ROW_BG[dStatus] ?? 'bg-white')
      }`}
      {...attributes}
    >
      {/* Drag handle */}
      <td className="py-2 px-2 w-8">
        {canDrag ? (
          <button
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-400 touch-none block"
            title="Kéo để thay đổi vị trí"
          >
            <GripVertical size={16} />
          </button>
        ) : (
          <GripVertical size={16} className="mx-auto text-gray-200" />
        )}
      </td>
      {/* STT má»›i */}
      <td className="py-2.5 px-3 whitespace-nowrap text-center w-14">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${canDrag ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
          {newOrder}
        </span>
      </td>
      {/* Giá»›i tÃ­nh */}
      <td className="py-2.5 px-3 whitespace-nowrap w-20">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${match.gender === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
          {match.gender === 'M' ? 'Nam' : 'Nữ'}
        </span>
      </td>
      {/* Category */}
      <td className="py-2.5 px-3 whitespace-nowrap w-24">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${match.category === 'phong_trao' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`}>
          {match.category === 'phong_trao' ? 'Phong trào' : 'Phổ thông'}
        </span>
      </td>
      {/* Loáº¡i */}
      <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap font-medium w-16">
        Loại {match.age_type_code}
      </td>
      {/* Háº¡ng cÃ¢n */}
      <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap w-28">{match.weight_class_name}</td>
      {/* VÃ²ng */}
      <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap w-24">{match.round_label}</td>
      {/* Äá»'i thá»§ */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm truncate max-w-[130px] ${match.player1_name ? 'text-gray-800' : 'text-gray-300 italic'}`}>
            {match.player1_name || 'TBD'}
          </span>
          <span className="text-gray-300 text-[10px] font-bold flex-shrink-0">vs</span>
          {isBye ? (
            <span className="text-gray-300 italic text-xs">BYE</span>
          ) : (
            <span className={`font-medium text-sm truncate max-w-[130px] ${match.player2_name ? 'text-gray-800' : 'text-gray-300 italic'}`}>
              {match.player2_name || 'TBD'}
            </span>
          )}
        </div>
      </td>
      {/* SÃ¢n â€" A/B toggle */}
      <td className="py-2.5 px-3 whitespace-nowrap w-20">
        <div className="flex gap-1">
          {(['A', 'B'] as const).map(c => (
            <button
              key={c}
              onClick={() => onCourtChange(match.id, c)}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                match.court === c
                  ? c === 'A' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </td>
      {/* Tráº¡ng thÃ¡i */}
      <td className="py-2.5 px-3 whitespace-nowrap w-28"><StatusBadge status={dStatus} /></td>
    </tr>
  )
}

// â"€â"€ Editable match table (drag & drop) â€" mirrors MatchTable layout â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface EditableMatchTableProps {
  matches: ScheduleBracketMatch[]
  onDragEnd: (event: DragEndEvent) => void
  onCourtChange: (matchId: number, court: 'A' | 'B') => void
}

function EditableMatchTable({ matches, onDragEnd, onCourtChange }: EditableMatchTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Same round grouping as MatchTable
  const labelsInOrder = [...new Set(matches.map(m => m.round_label).filter(Boolean))].sort(
    (a, b) => roundLabelSortKey(a) - roundLabelSortKey(b)
  )

  // Global position map: match.id â†' STT number, using the same logic as sttMap in view mode
  // (group by round_label in sorted order, number 1..N within each group)
  // This ensures edit mode STT matches view mode STT exactly.
  const globalOrderMap = new Map<number, number>()
  let _stt = 1
  for (const label of labelsInOrder) {
    for (const m of matches.filter(mm => mm.round_label === label)) {
      if (!m.is_bye) globalOrderMap.set(m.id, _stt++)
    }
  }

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={matches.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <table className="w-full text-sm" style={{ minWidth: 940 }}>
            <thead>
              <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-2 w-8" title="Kéo thả để đổi thứ tự"><GripVertical size={12} className="mx-auto text-white/40" /></th>
                <th className="py-2.5 px-3 text-center w-14 font-semibold">STT</th>
                <th className="py-2.5 px-3 text-left w-20 font-semibold">Giới tính</th>
                <th className="py-2.5 px-3 text-left w-24 font-semibold">Phong trào / PT</th>
                <th className="py-2.5 px-3 text-left w-16 font-semibold">Loại</th>
                <th className="py-2.5 px-3 text-left w-28 font-semibold">Hạng cân</th>
                <th className="py-2.5 px-3 text-left w-24 font-semibold">Vòng</th>
                <th className="py-2.5 px-3 text-left font-semibold">Đối thủ</th>
                <th className="py-2.5 px-3 text-left w-20 font-semibold">Sân</th>
                <th className="py-2.5 px-3 text-left w-28 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {labelsInOrder.map(groupLabel => {
                const groupMatches = matches.filter(m => m.round_label === groupLabel)
                const done = groupMatches.filter(m => m.status === 'completed').length
                return (
                  <React.Fragment key={`edit-group-${groupLabel}`}>
                    <tr className="bg-[var(--color-primary-light,#eff6ff)] border-y border-[var(--color-primary,#1d4ed8)]/20">
                      <td colSpan={10} className="py-1.5 px-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--color-gradient-primary,#1e3a5f)] font-bold text-xs tracking-wide uppercase">{groupLabel}</span>
                          <span className="text-slate-500 text-[11px] font-medium">
                            {done}/{groupMatches.length} trận
                            {done === groupMatches.length && groupMatches.length > 0 && (
                              <span className="ml-1.5 text-emerald-600">✓ Xong</span>
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {groupMatches.map((m) => (
                      <SortableMatchRow
                        key={m.id}
                        match={m}
                        newOrder={globalOrderMap.get(m.id) ?? 0}
                        onCourtChange={onCourtChange}
                      />
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// â"€â"€ Äá»'i khÃ¡ng table â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface MatchTableProps {
  matches: ScheduleBracketMatch[]
  sttMap: Map<number, number>
  schedule: TournamentSchedule
  onAction: (modal: ModalState) => void
  onScore: (id: number) => void
  onViewBracket: (wcId: number, matchId: number) => void
  focusStt?: number | null
  navigate: ReturnType<typeof useNavigate>
  selectedMatchIds?: Set<number>
  onToggleSelect?: (matchId: number) => void
}


function MatchTable({ matches, sttMap, schedule, onAction, onScore, onViewBracket, focusStt, navigate, selectedMatchIds, onToggleSelect }: MatchTableProps) {
  const focusRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (focusStt != null && focusRowRef.current) {
      focusRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusStt])

  if (matches.length === 0) {
    return <p className="text-xs text-gray-400 py-4 text-center">Không có trận đấu phù hợp.</p>
  }

  // Group by round_label (semantic label), sorted: VÃ²ng 1 â†' VÃ²ng 2 â†' Tá»© káº¿t â†' BÃ¡n káº¿t â†' Chung káº¿t
  const labelsInOrder = [...new Set(matches.map(m => m.round_label).filter(Boolean))].sort(
    (a, b) => roundLabelSortKey(a) - roundLabelSortKey(b)
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 860 }}>
        <thead>
          <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-[11px] uppercase tracking-wider">
            {onToggleSelect && <th className="py-2.5 px-3 w-8" />}
            <th className="py-2.5 px-3 text-center w-14 font-semibold">STT</th>
            <th className="py-2.5 px-3 text-left w-20 font-semibold">Giới tính</th>
            <th className="py-2.5 px-3 text-left w-24 font-semibold">Phong trào / PT</th>
            <th className="py-2.5 px-3 text-left w-16 font-semibold">Loại</th>
            <th className="py-2.5 px-3 text-left w-28 font-semibold">Hạng cân</th>
            <th className="py-2.5 px-3 text-left w-24 font-semibold">Vòng</th>
            <th className="py-2.5 px-3 text-left font-semibold">Đối thủ</th>
            <th className="py-2.5 px-3 text-left w-36 font-semibold">Đơn vị</th>
            <th className="py-2.5 px-3 text-left w-16 font-semibold">Sân</th>
            <th className="py-2.5 px-3 text-left w-28 font-semibold">Trạng thái</th>
            <th className="py-2.5 px-3 text-left w-52 font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {labelsInOrder.map(groupLabel => {
            const roundMatches = matches.filter(m => m.round_label === groupLabel)
            const totalInRound = roundMatches.length
            const doneInRound = roundMatches.filter(m => m.status === 'completed').length
            const colSpan = onToggleSelect ? 12 : 11
            return (
              <React.Fragment key={`label-${groupLabel}`}>
                {/* Round section header */}
                <tr className="bg-[var(--color-primary-light,#eff6ff)] border-y border-[var(--color-primary,#1d4ed8)]/20">
                  <td colSpan={colSpan} className="py-1.5 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-gradient-primary,#1e3a5f)] font-bold text-xs tracking-wide uppercase flex items-center gap-2">
                        {groupLabel}
                      </span>
                      <span className="text-slate-500 text-[11px] font-medium">
                        {doneInRound}/{totalInRound} trận
                        {doneInRound === totalInRound && totalInRound > 0 && (
                          <span className="ml-1.5 text-emerald-600">✓ Xong</span>
                        )}
                      </span>
                    </div>
                  </td>
                </tr>
                {roundMatches.map((m) => {
                  const isBye = m.is_bye
                  const dStatus = displayStatus(m)
                  const tooltipText = [m.match_code ?? '', m.weight_class_name, m.round_label].filter(Boolean).join('  ·  ')
                  const rowStt = sttMap.get(m.id) ?? null
                  const isFocused = focusStt != null && rowStt === focusStt
                  return (
                    <tr
                      key={m.id}
                      ref={isFocused ? focusRowRef : null}
                      className={`border-b transition-colors ${isBye ? 'opacity-50' : (isFocused ? 'bg-yellow-100' : (ROW_BG[dStatus] ?? 'bg-white'))} ${(dStatus === 'ongoing' || dStatus === 'checking') && !isBye ? 'cursor-pointer' : ''}`}
                      onClick={() => { if ((dStatus === 'ongoing' || dStatus === 'checking') && !isBye) onScore(m.id) }}
                    >
                      {/* Checkbox — only for unassigned (assigned_judges_count === 0), non-bye, pending/ready */}
                      {onToggleSelect && (
                        <td className="py-2.5 px-3 w-8 text-center" onClick={e => e.stopPropagation()}>
                          {!isBye && m.assigned_judges_count === 0 && (dStatus === 'pending' || dStatus === 'ready') ? (
                            <input
                              type="checkbox"
                              checked={selectedMatchIds?.has(m.id) ?? false}
                              onChange={() => onToggleSelect(m.id)}
                              className="w-4 h-4 accent-blue-600 cursor-pointer"
                            />
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </td>
                      )}
                      {/* STT */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        {!m.is_bye && sttMap.has(m.id) ? (
                          <span
                            title={tooltipText}
                            className="font-mono text-xs font-bold bg-[var(--color-primary,#1d4ed8)] text-white px-2 py-0.5 rounded-full cursor-help tabular-nums"
                          >
                            {sttMap.get(m.id)}
                          </span>
                        ) : (
                          <span title={tooltipText} className="font-mono text-[11px] text-gray-400 cursor-help">â€"</span>
                        )}
                      </td>

                      {/* Giá»›i tÃ­nh */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.gender === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                          {m.gender === 'M' ? 'Nam' : 'Nữ'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${m.category === 'phong_trao' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`}>
                          {m.category === 'phong_trao' ? 'Phong trào' : 'Phổ thông'}
                        </span>
                      </td>

                      {/* Loáº¡i */}
                      <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap font-medium">
                        Loại {m.age_type_code}
                      </td>

                      {/* Háº¡ng cÃ¢n */}
                      <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">{m.weight_class_name}</td>

                      {/* VÃ²ng */}
                      <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{m.round_label}</td>

                      {/* Äá»'i thá»§ */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            {m.winner === 1 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                            <span className={`font-semibold text-sm truncate max-w-[160px] ${
                              m.winner === 1 ? 'text-green-700'
                              : m.winner === 2 ? 'text-slate-400'
                              : m.player1_name ? 'text-red-600' : 'text-slate-300 italic'
                            }`}>
                              {m.player1_name || 'TBD'}
                            </span>
                            {dStatus === 'completed' && !isBye && m.player1_name && (
                              <span className={`text-xs font-mono font-bold flex-shrink-0 ${m.winner === 1 ? 'text-green-600' : 'text-slate-400'}`}>
                                ({m.score1 ?? 0})
                              </span>
                            )}
                          </div>
                          {isBye ? (
                            <span className="text-slate-300 italic text-xs mt-0.5">BYE</span>
                          ) : (
                            <div className="flex items-center gap-1 min-w-0 mt-0.5">
                              {m.winner === 2 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                              <span className={`font-semibold text-sm truncate max-w-[160px] ${
                                m.winner === 2 ? 'text-green-700'
                                : m.winner === 1 ? 'text-slate-400'
                                : m.player2_name ? 'text-blue-600' : 'text-slate-300 italic'
                              }`}>
                                {m.player2_name || 'TBD'}
                              </span>
                              {dStatus === 'completed' && !isBye && m.player2_name && (
                                <span className={`text-xs font-mono font-bold flex-shrink-0 ${m.winner === 2 ? 'text-green-600' : 'text-slate-400'}`}>
                                  ({m.score2 ?? 0})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ÄÆ¡n vá»‹ */}
                      <td className="py-2.5 px-3 text-xs">
                        <div className="text-red-600">{m.player1_club ?? '—'}</div>
                        {!isBye && <div className="text-blue-600 mt-0.5">{m.player2_club ?? '—'}</div>}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap"><CourtBadge court={m.court} /></td>
                      <td className="py-2.5 px-3 whitespace-nowrap"><MatchStatusBadge match={m} /></td>

                      {/* Action */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => onViewBracket(m.weight_class_id, m.id)}
                            title="Xem sơ đồ thi đấu"
                            className="flex items-center gap-1 w-32 px-2 py-1 text-xs bg-orange-50 border border-orange-200 text-orange-600 rounded hover:bg-orange-100 whitespace-nowrap"
                          >
                            <Network size={11} />Sơ đồ
                          </button>
                          {!isBye && (dStatus === 'pending' || dStatus === 'ready') && (
                            <>
                              <button
                                onClick={() => canSetup() && navigate(`/matches/${m.id}/setup`)}
                                disabled={!canSetup()}
                                className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                                  canSetup()
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                                    : 'bg-gray-100 text-slate-400 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <ShieldCheck size={11} />Cài đặt trọng tài
                              </button>
                              <button
                                                                                        onClick={() => onScore(m.id)}
                                                                                        disabled={false}
                                title={!isLocalMode ? 'Chỉ khả dụng ở chế độ local' : undefined}
                                className={`flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                                  isLocalMode && m.assigned_judges_count >= 5 && canSetup()
                                    ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                                    : 'bg-gray-400 text-white cursor-not-allowed opacity-60'
                                }`}
                              >
                                <Play size={11} />{getMatchManageLabel(m)}
                              </button>
                            </>
                          )}
                          {!isBye && canScore() && (dStatus === 'checking' || dStatus === 'ongoing') && (
                            <button
                              onClick={() => onScore(m.id)}
                              className="flex items-center gap-1 w-32 px-2 py-1 text-xs font-semibold bg-yellow-500 text-white rounded hover:bg-yellow-600 whitespace-nowrap"
                            >
                              <Zap size={11} />{dStatus === 'checking' ? (canSetup() ? 'Điều hành chấm' : 'Vào bàn chấm') : (canSetup() ? 'Chấm điểm' : 'Vào bàn chấm')}
                            </button>
                          )}
                          {!isBye && dStatus === 'ongoing' && (
                            <button
                              onClick={() => onAction({ type: 'result', match: m })}
                              className="flex items-center gap-1 w-32 px-2 py-1 text-xs bg-[var(--color-primary,#1d4ed8)] text-white rounded hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] whitespace-nowrap"
                            >
                              Nhập KQ
                            </button>
                          )}
                          {!isBye && dStatus === 'completed' && (
                            <button
                              onClick={() => onAction({ type: 'view', match: m })}
                              className="flex items-center gap-1 w-32 px-2 py-1 text-xs bg-orange-50 border border-orange-200 text-orange-600 rounded hover:bg-orange-100 whitespace-nowrap"
                            >
                              <Eye size={11} />Xem KQ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// â"€â"€ Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// -- SyncAllButton ------------------------------------------------------------

const PAGE_SIZE = 20

function SyncAllButton({ tournamentId }: { tournamentId: number | null }) {
  const storageKey = tournamentId ? `sync_last_at_${tournamentId}` : null
  const qc = useQueryClient()

  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>(() => {
    if (!tournamentId) return 'idle'
    return localStorage.getItem(`sync_last_at_${tournamentId}`) ? 'done' : 'idle'
  })
  const [progress, setProgress] = useState<{ synced: number; total: number } | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    if (!tournamentId) return null
    const stored = localStorage.getItem(`sync_last_at_${tournamentId}`)
    return stored ? new Date(stored) : null
  })

  const lastSyncLabel = lastSyncAt
    ? lastSyncAt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
    : null

  if (!tournamentId) return null

  const handleSync = async () => {
    setState('syncing')
    setProgress(null)
    try {
      let page = 1
      let hasMore = true
      let totalSynced = 0
      let total = 0

      while (hasMore) {
        const res = await localApi.post<{ synced_count: number; total: number; has_more: boolean }>(
          `/sync/tournament/${tournamentId}/matches`,
          null,
          { params: { page, size: PAGE_SIZE } }
        )
        totalSynced += res.data.synced_count
        total = res.data.total
        hasMore = res.data.has_more
        setProgress({ synced: totalSynced, total })
        page++
      }

      const now = new Date()
      setLastSyncAt(now)
      if (storageKey) localStorage.setItem(storageKey, now.toISOString())
      setState('done')
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
      qc.invalidateQueries({ queryKey: ['match'] })
      qc.invalidateQueries({ queryKey: ['display-match'] })
    } catch {
      setState('error')
    }
  }

  const isDone = state === 'done'
  const isError = state === 'error'
  const isSyncing = state === 'syncing'

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      title={lastSyncLabel ? `Tải lần cuối: ${lastSyncLabel}` : 'Tải toàn bộ trận đối kháng về local'}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-lg disabled:opacity-50 transition-colors ${
        isDone
          ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100'
          : isError
          ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {isDone ? (
        <CheckCircle size={12} />
      ) : (
        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
      )}
      {isSyncing && progress
        ? `Đang sync... ${progress.synced}/${progress.total}`
        : isSyncing
        ? 'Đang sync...'
        : isDone
        ? 'Tải trận đấu'
        : isError
        ? 'Lỗi sync'
        : 'Tải trận đấu'}
    </button>
  )
}

interface ModalProps {
  modal: ModalState
  onClose: () => void
  onStartMatch: (matchId: number) => void
  onResult: (matchId: number, winner: 1 | 2, score1: number, score2: number) => void
  onStartQuyen: (slotId: number) => void
  onCompleteQuyen: (slotId: number) => void
  onCancelMatch: (matchId: number) => void
  isPending: boolean
  bracketMatches?: Array<{ id: number; match_number: number }>
}

function Modal({ modal, onClose, onStartMatch, onResult, onStartQuyen, onCompleteQuyen, onCancelMatch, isPending, bracketMatches }: ModalProps) {
  const navigate = useNavigate()
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')

  if (!modal) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Start match confirm */}
        {modal.type === 'start-match' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{modal.match.round_label} - {modal.match.weight_class_name}</h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex items-center justify-between py-3 bg-gray-50 rounded-lg px-4 mb-4">
              <span className="font-medium text-blue-700 text-sm">{modal.match.player1_name}</span>
              <span className="text-gray-400 text-xs">VS</span>
              <span className="font-medium text-red-600 text-sm">{modal.match.player2_name}</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Bắt đầu lượt thi đối kháng?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
              <button
                onClick={() => onStartMatch(modal.match.id)}
                disabled={false}
                className="px-4 py-2 text-sm bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin inline" /> : 'Bắt đầu →'}
              </button>
            </div>
          </div>
        )}

        {/* Enter result */}
        {modal.type === 'result' && (() => {
          const s1 = parseInt(score1) || 0
          const s2 = parseInt(score2) || 0
          const scoresEntered = score1 !== '' || score2 !== ''
          const autoWinner: 1 | 2 | null = s1 > s2 ? 1 : s2 > s1 ? 2 : null
          const isTie = scoresEntered && autoWinner === null
          const effectiveWinner: 1 | 2 | null = autoWinner ?? (isTie ? winner : null)
          return (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Nhập kết quả — {modal.match.round_label}</h3>
                <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
              </div>
              <div className="space-y-3 mb-4">
                {/* Score row */}
                <div className="flex items-center gap-3">
                  <div className={`flex-1 rounded-lg p-2 border transition-colors ${effectiveWinner === 1 ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                    <p className={`text-xs mb-1 font-medium ${effectiveWinner === 1 ? 'text-green-700' : 'text-gray-500'}`}>
                      {effectiveWinner === 1 && <Trophy size={14} className="inline mr-1" />}{modal.match.player1_name}
                    </p>
                    <input
                      type="number" min="0" value={score1}
                      onChange={e => setScore1(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-gray-400 font-bold">-</span>
                  <div className={`flex-1 rounded-lg p-2 border transition-colors ${effectiveWinner === 2 ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                    <p className={`text-xs mb-1 font-medium ${effectiveWinner === 2 ? 'text-green-700' : 'text-gray-500'}`}>
                      {effectiveWinner === 2 && <Trophy size={14} className="inline mr-1" />}{modal.match.player2_name}
                    </p>
                    <input
                      type="number" min="0" value={score2}
                      onChange={e => setScore2(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Tiebreaker â€" only shown when scores are equal */}
                {isTie && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-2">Điểm bằng nhau — chọn người thắng tie-break</p>
                    <div className="flex gap-2">
                      {([1, 2] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setWinner(val)}
                          className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
                            winner === val
                              ? 'bg-green-600 text-white border-green-600'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {val === 1 ? modal.match.player1_name : modal.match.player2_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
                <button
                  onClick={() => effectiveWinner && onResult(modal.match.id, effectiveWinner, s1, s2)}
                  disabled={!effectiveWinner || isPending}
                  className="px-4 py-2 text-sm bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin inline" /> : 'Lưu kết quả'}
                </button>
              </div>
            </div>
          )
        })()}

        {/* View result */}
        {modal.type === 'view' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Kết quả — {modal.match.round_label}</h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="text-center py-3 bg-gray-50 rounded-lg mb-3">
              <div className="flex items-center justify-center gap-4">
                <span className={`font-semibold ${modal.match.winner === 1 ? 'text-green-700' : 'text-gray-500'}`}>
                  {modal.match.player1_name} {modal.match.winner === 1 && <Trophy size={14} />}
                </span>
                <span className="text-xl font-bold text-gray-700">
                  {modal.match.score1 ?? 0} - {modal.match.score2 ?? 0}
                </span>
                <span className={`font-semibold ${modal.match.winner === 2 ? 'text-green-700' : 'text-gray-500'}`}>
                  {modal.match.winner === 2 && <Trophy size={14} />} {modal.match.player2_name}
                </span>
              </div>
            </div>
            {modal.match.next_match_id && (() => {
              const nextMatch = bracketMatches?.find(m => m.id === modal.match.next_match_id)
              return (
                <p className="text-xs text-gray-500 text-center">
                  Trận tiếp theo: <span className="font-semibold">#{nextMatch?.match_number ?? modal.match.next_match_id}</span>
                </p>
              )
            })()}
            <div className="flex justify-between items-center mt-4 gap-2 flex-wrap">
              {canSetup() && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { onClose(); navigate(`/matches/${modal.match.id}/score`) }}
                    className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
                  >
                    Vào điều khiển
                  </button>
                  <button
                    onClick={() => onCancelMatch(modal.match.id)}
                    disabled={isPending}
                    className="px-4 py-2 text-sm border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Hủy trận
                  </button>
                </div>
              )}
              <button onClick={onClose} className="ml-auto px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Đóng</button>
            </div>
          </div>
        )}

        {/* Start quyen confirm */}
        {modal.type === 'start-quyen' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Bắt đầu lượt thi Quyền</h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium text-blue-700">{modal.slot.player_name}</span></p>
            <p className="text-xs text-gray-500 mb-4">{modal.slot.content_name}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
              <button
                onClick={() => onStartQuyen(modal.slot.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin inline" /> : 'Bắt đầu →'}
              </button>
            </div>
          </div>
        )}

        {/* Complete quyen confirm */}
        {modal.type === 'complete-quyen' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Kết thúc bài thi Quyền</h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-700 mb-1"><span className="font-medium text-blue-700">{modal.slot.player_name}</span></p>
            <p className="text-xs text-gray-500 mb-4">{modal.slot.content_name}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">Hủy</button>
              <button
                onClick={() => onCompleteQuyen(modal.slot.id)}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin inline" /> : 'Chuyển sang chấm điểm ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// â"€â"€ Court status panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface CourtStatusPanelProps {
  schedule: TournamentSchedule
  onScore: (id: number) => void
  onManageQuyen: (slotId: number) => void
  onViewResults: (slotId: number) => void
}

function CourtStatusPanel({ schedule, onScore, onManageQuyen, onViewResults }: CourtStatusPanelProps) {
  type AnyItem = {
    id: number
    type: 'match' | 'quyen'
    dStatus: string
    court: string | null
    schedule_order: number | null
    label: string
    subLabel: string
  }

  const allItems: AnyItem[] = [
    ...schedule.bracket_matches.map(m => ({
      id: m.id,
      type: 'match' as const,
      dStatus: getMatchStatusMeta(m).key,
      court: m.court,
      schedule_order: m.schedule_order,
      label: [m.player1_name, m.player2_name].filter(Boolean).join(' vs ') || 'TBD vs TBD',
      subLabel: [m.weight_class_name, m.round_label].filter(Boolean).join(' · '),
    })),
    ...schedule.quyen_slots.map(s => ({
      id: s.id,
      type: 'quyen' as const,
      dStatus: getQuyenStatusMeta(s).key,
      court: s.court,
      schedule_order: s.schedule_order,
      label: s.content_name,
      subLabel: [getQuyenUnitLabel(s), getQuyenBranchPath(s)].filter(Boolean).join(' · '),
    })),
  ]

  const courts = ['A', 'B'] as const
  const hasActivity = allItems.some(i => i.dStatus === 'checking' || i.dStatus === 'ongoing' || i.dStatus === 'scoring' || i.dStatus === 'ready')
  if (!hasActivity) return null

  // Highest STT among completed items (global across both courts)
  const maxCompletedOrder = allItems
    .filter(i => i.dStatus === 'completed' && i.schedule_order != null)
    .reduce((max, i) => Math.max(max, i.schedule_order!), 0)

  return (
    <div className="grid grid-cols-2 gap-3">
      {courts.map(court => {
        const courtItems = allItems.filter(i => i.court === court)
        const ongoing = courtItems.find(i => i.dStatus === 'checking' || i.dStatus === 'ongoing' || i.dStatus === 'scoring')
        // Next ready of this court whose STT comes after the last completed match globally
        const nextReady = courtItems
          .filter(i => i.dStatus === 'ready' && (i.schedule_order ?? 0) > maxCompletedOrder)
          .sort((a, b) => (a.schedule_order ?? 9999) - (b.schedule_order ?? 9999))[0]

        return (
          <div key={court} className="bg-white rounded-xl border border-gray-200 p-3">
            {/* Court header */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${court === 'A' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                {court}
              </span>
              <span className="text-sm font-semibold text-gray-700">Sân {court}</span>
            </div>

            <div className="space-y-2">
              {/* Ongoing */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-yellow-600 mb-1">⚡ Đang diễn ra</p>
                {ongoing ? (
                  <div
                    className={`bg-yellow-50 border border-yellow-300 rounded-lg p-2 cursor-pointer hover:bg-yellow-100 active:bg-yellow-200 transition-colors`}
                    onClick={() => { if (ongoing.type === 'match') onScore(ongoing.id); else onManageQuyen(ongoing.id) }}
                    title={ongoing.type === 'match' ? 'Click để chấm điểm' : 'Click để vào điều hành chấm quyền'}
                  >
                    {ongoing.schedule_order != null && (
                      <span className="text-[10px] font-mono text-yellow-500 font-semibold">#{ongoing.schedule_order} · </span>
                    )}
                    <span className="text-xs font-semibold text-yellow-800">{ongoing.label}</span>
                    <p className="text-[10px] text-yellow-600 mt-0.5 truncate">{ongoing.subLabel}</p>
                    <p className="text-[10px] text-yellow-500 mt-1 font-medium">
                      → {ongoing.type === 'match' ? 'Nhấn để vào chấm điểm' : 'Nhấn để vào điều hành chấm quyền'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">Trống</p>
                  </div>
                )}
              </div>

              {/* Next ready */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-blue-500 mb-1">🔜 Sắp diễn ra</p>
                {nextReady ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    {nextReady.schedule_order != null && (
                      <span className="text-[10px] font-mono text-blue-500 font-semibold">#{nextReady.schedule_order} · </span>
                    )}
                    <span className="text-xs font-semibold text-blue-800">{nextReady.label}</span>
                    <p className="text-[10px] text-blue-500 mt-0.5 truncate">{nextReady.subLabel}</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-gray-400">Không có</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Bulk judge setup modal ──────────────────────────────────────────────────

const JUDGE_SLOTS_BULK = [1, 2, 3, 4, 5] as const

interface BulkSetupResult {
  matchId: number
  label: string
  ok: boolean
  error?: string
}

interface BulkJudgeSetupModalProps {
  matches: ScheduleBracketMatch[]
  tournamentId: number
  onClose: () => void
  onDone: () => void
}

function BulkJudgeSetupModal({ matches, tournamentId, onClose, onDone }: BulkJudgeSetupModalProps) {
  const [assigned, setAssigned] = useState<Record<number, number | null>>({ 1: null, 2: null, 3: null, 4: null, 5: null })
  const [results, setResults] = useState<BulkSetupResult[] | null>(null)
  const [isPending, setIsPending] = useState(false)

  const usersQ = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const referees = useMemo(
    () => (usersQ.data ?? []).filter(u => u.role === 'referee' && u.tournament_ids.includes(tournamentId)),
    [usersQ.data, tournamentId],
  )

  const selectedIds = JUDGE_SLOTS_BULK.map(s => assigned[s]).filter((v): v is number => v != null)
  const canSubmit = selectedIds.length === 5 && new Set(selectedIds).size === 5

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsPending(true)
    const judges = JUDGE_SLOTS_BULK.map(s => ({ judge_slot: s, user_id: assigned[s]! }))
    const settled = await Promise.allSettled(matches.map(m => updateMatchJudgeSetup(m.id, { judges })))
    const res: BulkSetupResult[] = matches.map((m, i) => {
      const s = settled[i]
      return {
        matchId: m.id,
        label: `${m.player1_name ?? 'TBD'} vs ${m.player2_name ?? 'TBD'} (${m.round_label ?? ''})`,
        ok: s.status === 'fulfilled',
        error: s.status === 'rejected' ? 'Không thể setup' : undefined,
      }
    })
    setResults(res)
    setIsPending(false)
  }

  const failCount = results?.filter(r => !r.ok).length ?? 0
  const successCount = results?.filter(r => r.ok).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Setup trọng tài hàng loạt</h2>
            <p className="text-xs text-gray-400 mt-0.5">{matches.length} trận đã chọn</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {results ? (
          <div className="px-6 py-5 space-y-3">
            <div className="flex gap-3">
              {successCount > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{successCount} thành công</span>
              )}
              {failCount > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">{failCount} thất bại</span>
              )}
            </div>
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {results.map(r => (
                <li key={r.matchId} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                  <span className="mt-0.5 flex-shrink-0">{r.ok ? '✓' : '✗'}</span>
                  <span className="truncate">{r.label}</span>
                  {r.error && <span className="text-xs ml-auto flex-shrink-0 text-red-500">{r.error}</span>}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { onDone(); onClose() }} className="px-4 py-2 text-sm font-semibold bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)]">
                Xong
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-500">Chọn 5 trọng tài khác nhau — sẽ áp dụng cho tất cả {matches.length} trận đã chọn.</p>
            <div className="grid gap-3">
              {JUDGE_SLOTS_BULK.map(slot => (
                <div key={slot} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-semibold text-blue-700 flex-shrink-0">Ghế {slot}</span>
                  <select
                    value={assigned[slot] ?? ''}
                    onChange={e => setAssigned(prev => ({ ...prev, [slot]: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                  >
                    <option value="">Chọn trọng tài</option>
                    {referees
                      .filter(u => u.id === assigned[slot] || !selectedIds.includes(u.id))
                      .map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)
                    }
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                className="px-4 py-2 text-sm font-semibold bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Áp dụng cho {matches.length} trận
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface BulkQuyenSetupResult {
  slotId: number
  label: string
  ok: boolean
  error?: string
}

interface BulkQuyenSetupModalProps {
  slots: QuyenSlot[]
  tournamentId: number
  onClose: () => void
  onDone: () => void
}

function BulkQuyenSetupModal({ slots, tournamentId, onClose, onDone }: BulkQuyenSetupModalProps) {
  const [assigned, setAssigned] = useState<Record<number, number | null>>({ 1: null, 2: null, 3: null, 4: null, 5: null })
  const [duration, setDuration] = useState<number>(180)
  const [results, setResults] = useState<BulkQuyenSetupResult[] | null>(null)
  const [isPending, setIsPending] = useState(false)

  const usersQ = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const referees = useMemo(
    () => (usersQ.data ?? []).filter(u => u.role === 'referee' && u.tournament_ids.includes(tournamentId)),
    [usersQ.data, tournamentId],
  )

  const selectedIds = JUDGE_SLOTS_BULK.map(s => assigned[s]).filter((v): v is number => v != null)
  const canSubmit = selectedIds.length === 5 && new Set(selectedIds).size === 5 && duration > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsPending(true)
    const judges = JUDGE_SLOTS_BULK.map(s => ({ judge_slot: s, user_id: assigned[s]! }))
    const settled = await Promise.allSettled(
      slots.map(s => updateQuyenJudgeSetup(s.id, { judges, performance_duration_seconds: duration }))
    )
    const res: BulkQuyenSetupResult[] = slots.map((s, i) => ({
      slotId: s.id,
      label: `${s.content_name} — ${s.player_name}`,
      ok: settled[i].status === 'fulfilled',
      error: settled[i].status === 'rejected' ? 'Không thể setup' : undefined,
    }))
    setResults(res)
    setIsPending(false)
  }

  const failCount = results?.filter(r => !r.ok).length ?? 0
  const successCount = results?.filter(r => r.ok).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Setup trọng tài Quyền hàng loạt</h2>
            <p className="text-xs text-gray-400 mt-0.5">{slots.length} lượt thi đã chọn</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {results ? (
          <div className="px-6 py-5 space-y-3">
            <div className="flex gap-3">
              {successCount > 0 && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{successCount} thành công</span>}
              {failCount > 0 && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">{failCount} thất bại</span>}
            </div>
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {results.map(r => (
                <li key={r.slotId} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                  <span className="mt-0.5 flex-shrink-0">{r.ok ? '✓' : '✗'}</span>
                  <span className="truncate">{r.label}</span>
                  {r.error && <span className="text-xs ml-auto flex-shrink-0 text-red-500">{r.error}</span>}
                </li>
              ))}
            </ul>
            <div className="flex justify-end pt-2">
              <button onClick={() => { onDone(); onClose() }} className="px-4 py-2 text-sm font-semibold bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)]">Xong</button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-500">Chọn 5 trọng tài và thời gian thực hiện — áp dụng cho {slots.length} lượt thi đã chọn.</p>
            <div className="flex items-center gap-3">
              <span className="w-44 text-xs font-semibold text-blue-700 flex-shrink-0">Thời gian thực hiện (giây)</span>
              <input
                type="number"
                min={30}
                max={600}
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
              />
            </div>
            <div className="grid gap-3">
              {JUDGE_SLOTS_BULK.map(slot => (
                <div key={slot} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-semibold text-blue-700 flex-shrink-0">Ghế {slot}</span>
                  <select
                    value={assigned[slot] ?? ''}
                    onChange={e => setAssigned(prev => ({ ...prev, [slot]: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                  >
                    <option value="">Chọn trọng tài</option>
                    {referees
                      .filter(u => u.id === assigned[slot] || !selectedIds.includes(u.id))
                      .map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)
                    }
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                className="px-4 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Áp dụng cho {slots.length} lượt thi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// â"€â"€ Main page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const MatchesPage = () => {
  const { selectedTournament } = useTournament()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusSttFromUrl = searchParams.get('stt') ? Number(searchParams.get('stt')) : null
  const [focusStt, setFocusStt] = useState<number | null>(focusSttFromUrl)
  // Sync when URL param changes (e.g. back navigation)
  useEffect(() => { setFocusStt(focusSttFromUrl) }, [focusSttFromUrl])
  const [modal, setModal] = useState<ModalState>(null)
  const [resultsSlotId, setResultsSlotId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'quyen' | 'doi_khang'>('all')
  const [filterCourt, setFilterCourt] = useState<'all' | 'A' | 'B'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'ready' | 'checking' | 'ongoing' | 'completed'>('all')
  // Edit mode (drag & drop) â€" unified list
  const [editMode, setEditMode] = useState(false)
  const [localUnified, setLocalUnified] = useState<UnifiedItem[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  // Bulk judge setup
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set())
  const [showBulkSetup, setShowBulkSetup] = useState(false)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<number>>(new Set())
  const [showBulkQuyenSetup, setShowBulkQuyenSetup] = useState(false)
  const [teamMembersSlot, setTeamMembersSlot] = useState<QuyenSlot | null>(null)
  const tournamentId = selectedTournament?.id ?? null

  // Step 2: get full schedule
  const {
    data: schedule,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['schedule', tournamentId],
    queryFn: () => getSchedule(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 5_000,  // poll every 5s to pick up match status changes quickly
  })

  // Mutations
  const startMatchMut = useMutation({
    mutationFn: async (matchId: number) => {
      await startMatch(matchId) // startMatch already syncs Railway → local internally
      return matchId
    },
    onSuccess: (matchId) => {
      setModal(null)
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
      qc.invalidateQueries({ queryKey: ['match', matchId] })
      qc.invalidateQueries({ queryKey: ['display-match', matchId] })
      navigate(`/matches/${matchId}/score`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ?? 'Lỗi không xác định'
      alert(msg)
    },
  })

  const resultMut = useMutation({
    mutationFn: ({ matchId, winner, score1, score2 }: { matchId: number; winner: 1 | 2; score1: number; score2: number }) =>
      updateMatchResult(matchId, { winner, score1, score2 }),
    onSuccess: () => { setModal(null); qc.invalidateQueries({ queryKey: ['schedule'] }); qc.invalidateQueries({ queryKey: ['bracket'] }) },
  })

  const startQuyenMut = useMutation({
    mutationFn: (slotId: number) => startQuyenSlot(slotId),
    onSuccess: (_, slotId) => {
      setModal(null)
      qc.invalidateQueries({ queryKey: ['schedule'] })
      navigate(`/quyen-slots/${slotId}/score`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ?? 'Lỗi không xác định'
      alert(msg)
    },
  })

  const completeQuyenMut = useMutation({
    mutationFn: (slotId: number) => completeQuyenSlot(slotId),
    onSuccess: () => { setModal(null); qc.invalidateQueries({ queryKey: ['schedule'] }) },
  })

  const updateScheduleMut = useMutation({
    mutationFn: (unified: UnifiedItem[]) =>
      updateSchedule(tournamentId!, {
        bracket_matches: unified.filter(x => x.kind === 'match').map((x, i) => ({
          id: x.id,
          schedule_order: unified.findIndex(u => u === x) + 1,
          court: x.court ?? undefined,
        })),
        quyen_slots: unified.filter(x => x.kind === 'quyen').map(x => ({
          id: x.id,
          schedule_order: unified.findIndex(u => u === x) + 1,
          court: x.court ?? undefined,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      setHasChanges(false)
      setEditMode(false)
    },
    onError: () => alert('Lỗi khi lưu lịch thi đấu. Vui lòng thử lại.'),
  })

  const cancelMatchMut = useMutation({
    mutationFn: (matchId: number) => cancelMatch(matchId),
    onSuccess: () => {
      setModal(null)
      qc.invalidateQueries({ queryKey: ['schedule'] })
      qc.invalidateQueries({ queryKey: ['bracket'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message ?? 'Không thể hủy trận đấu'
      alert(msg)
    },
  })

  const anyPending = startMatchMut.isPending || resultMut.isPending || startQuyenMut.isPending || completeQuyenMut.isPending || cancelMatchMut.isPending

  const _bracketMatches = schedule?.bracket_matches ?? []
  const _quyenSlots = schedule?.quyen_slots ?? []

  const eligibleMatchIds = useMemo(() => new Set(
    _bracketMatches
      .filter(m => !m.is_bye && m.assigned_judges_count === 0 && (m.status === 'pending' || m.status === 'ready'))
      .map(m => m.id)
  ), [_bracketMatches])

  const eligibleSlotIds = useMemo(() => new Set(
    _quyenSlots
      .filter(s => s.assigned_judges_count === 0 && s.status === 'pending')
      .map(s => s.id)
  ), [_quyenSlots])

  if (!selectedTournament) return <NoTournamentGuard />

  // Edit mode helpers
  const isAdmin = getUserRole() === 'admin'
  const canEditSchedule = isAdmin && schedule != null &&
    (schedule.tournament_status === 'DRAFT' || schedule.tournament_status === 'PUBLISHED')

  const buildUnified = (): UnifiedItem[] => {
    const all: UnifiedItem[] = [
      ...(schedule?.quyen_slots ?? []).map(s => ({
        kind: 'quyen' as const, id: s.id, schedule_order: s.schedule_order, status: s.status, court: s.court, data: s,
      })),
      ...(schedule?.bracket_matches ?? []).map(m => ({
        kind: 'match' as const, id: m.id, schedule_order: m.schedule_order, status: displayStatus(m), court: m.court, data: m,
      })),
    ]
    return all.sort((a, b) => (a.schedule_order ?? 9999) - (b.schedule_order ?? 9999))
  }

  const enterEditMode = () => {
    setLocalUnified(buildUnified())
    setHasChanges(false)
    setEditMode(true)
  }

  const exitEditMode = () => {
    setLocalUnified([])
    setHasChanges(false)
    setEditMode(false)
  }

  const handleDragEndUnified = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localUnified.findIndex(x => unifiedId(x) === active.id)
    const newIndex = localUnified.findIndex(x => unifiedId(x) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const target = localUnified[newIndex]
    if (target.status === 'completed' || target.status === 'ongoing') return
    setLocalUnified(arrayMove(localUnified, oldIndex, newIndex))
    setHasChanges(true)
  }

  const handleCourtChangeUnified = (kind: 'quyen' | 'match', id: number, court: 'A' | 'B') => {
    setLocalUnified(prev => prev.map(x => x.kind === kind && x.id === id ? { ...x, court } : x))
    setHasChanges(true)
  }

  // Client-side filtering
  const filteredQuyen = (schedule?.quyen_slots ?? []).filter(s => {
    if (filterCourt !== 'all' && s.court !== filterCourt) return false
    if (filterStatus !== 'all' && getQuyenStatusMeta(s).key !== filterStatus) return false
    return true
  })

  const filteredMatches = (schedule?.bracket_matches ?? []).filter(m => {
    if (filterCourt !== 'all' && m.court !== filterCourt) return false
    if (filterStatus !== 'all' && getMatchStatusMeta(m).key !== filterStatus) return false
    return true
  })

  const summary = schedule
    ? {
        quyen_count: schedule.summary.quyen_count,
        doi_khang_count: schedule.summary.doi_khang_count,
        ready_count:
          schedule.quyen_slots.filter((slot) => getQuyenStatusMeta(slot).key === 'ready').length +
          schedule.bracket_matches.filter((match) => !match.is_bye && getMatchStatusMeta(match).key === 'ready').length,
        ongoing_count: schedule.summary.ongoing_count,
        completed_count: schedule.summary.completed_count,
      }
    : null

  // STT map: dÃ¹ng schedule_order tá»« backend (unified counter Quyá»n+Äá»'i khÃ¡ng)
  const sttMap = new Map<number, number>(
    (schedule?.bracket_matches ?? [])
      .filter(m => !m.is_bye && m.schedule_order != null)
      .map(m => [m.id, m.schedule_order!])
  )

  // Sort by round order (schedule_order). Status is shown visually via row colours;
  // live match tracking is handled by the CourtStatusPanel above the table.
  const sortedMatches = [...filteredMatches].sort((a, b) =>
    (a.schedule_order ?? 9999) - (b.schedule_order ?? 9999)
  )

  const sortedQuyen = [...filteredQuyen].sort(
    (a, b) => (a.schedule_order ?? 9999) - (b.schedule_order ?? 9999)
  )

  const handleSelectAll = () => {
    if (activeTab === 'all' || activeTab === 'doi_khang') setSelectedMatchIds(new Set(eligibleMatchIds))
    if (activeTab === 'all' || activeTab === 'quyen') setSelectedSlotIds(new Set(eligibleSlotIds))
  }

  const handleDeselectAll = () => {
    setSelectedMatchIds(new Set())
    setSelectedSlotIds(new Set())
  }

  const visibleEligibleCount =
    (activeTab === 'all' || activeTab === 'doi_khang' ? eligibleMatchIds.size : 0) +
    (activeTab === 'all' || activeTab === 'quyen' ? eligibleSlotIds.size : 0)

  const visibleSelectedCount =
    (activeTab === 'all' || activeTab === 'doi_khang' ? selectedMatchIds.size : 0) +
    (activeTab === 'all' || activeTab === 'quyen' ? selectedSlotIds.size : 0)

  const handleManageQuyen = (slotId: number) => {
    const slot = schedule?.quyen_slots.find((item) => item.id === slotId)
    if (!slot) return
    if (slot.assigned_judges_count < 5) {
      navigate(`/quyen-slots/${slotId}/setup`)
      return
    }
    if (slot.status === 'pending' || slot.status === 'ready') {
      setModal({ type: 'start-quyen', slot })
      return
    }
    navigate(`/quyen-slots/${slotId}/score`)
  }

  const handleManageMatch = (matchId: number) => {
    const match = schedule?.bracket_matches.find((item) => item.id === matchId)
    if (!match) return
    if (match.status === 'pending' || match.status === 'ready') {
      if (match.assigned_judges_count >= 5) {
        setModal({ type: 'start-match', match })
      }
      return
    }
    navigate(`/matches/${matchId}/score?mode=control`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <List size={20} className="text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800">Lịch thi đấu</h1>
          {schedule && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              schedule.tournament_status === 'DRAFT'     ? 'bg-gray-100 text-gray-600' :
              schedule.tournament_status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' :
              schedule.tournament_status === 'ONGOING'   ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>{schedule.tournament_name}</span>
          )}
          {isLocalMode && <SyncAllButton tournamentId={tournamentId} />}
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { label: `Quyền: ${summary.quyen_count} lượt`, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: `Đối kháng: ${summary.doi_khang_count} trận`, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: `Sẵn sàng: ${summary.ready_count}`, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
              { label: `Đang diễn ra: ${summary.ongoing_count}`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
              { label: `Đã xong: ${summary.completed_count}`, cls: 'bg-green-100 text-green-700 border-green-200' },
            ].map(({ label, cls }) => (
              <span key={label} className={`px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>{label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
          <Loader2 size={24} className="animate-spin" /><span>Đang tải lịch...</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <p className="font-medium text-gray-500">Không thể tải lịch thi đấu</p>
          <button onClick={() => refetch()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Thử lại</button>
        </div>
      ) : !schedule || (schedule.quyen_slots.length === 0 && schedule.bracket_matches.length === 0) ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <List size={48} className="opacity-20" />
          <p className="font-medium text-gray-500">Chưa có lịch thi đấu</p>
          <p className="text-sm">Vào màn hình Giải đấu → Tạo tất cả sơ đồ → Tạo lịch thi đấu để xem danh sách trận.</p>
        </div>
      ) : (
        <div className="p-4 md:p-6 space-y-4">

          {/* Tab bar + filters */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Tabs */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tất cả
                <span className="text-xs text-slate-400 font-normal">({schedule.quyen_slots.length + schedule.bracket_matches.filter(m => !m.is_bye).length})</span>
              </button>
              <button
                onClick={() => setActiveTab('quyen')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'quyen'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-400 flex-shrink-0" />
                Quyền
                <span className="text-xs text-slate-400 font-normal">({schedule.quyen_slots.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('doi_khang')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'doi_khang'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 flex-shrink-0" />
                Đối kháng
                <span className="text-xs text-slate-400 font-normal">({schedule.bracket_matches.length})</span>
              </button>
            </div>

            {/* Sub-filters (hidden in edit mode) + edit controls */}
            <div className="flex gap-2 flex-wrap items-center">
              {!editMode && (
                <>
                  <select
                    value={filterCourt}
                    onChange={e => setFilterCourt(e.target.value as typeof filterCourt)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                  >
                    <option value="all">Tất cả sân</option>
                    <option value="A">Sân A</option>
                    <option value="B">Sân B</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ</option>
                    <option value="ready">Sẵn sàng</option>
                    <option value="checking">Chờ trọng tài sẵn sàng</option>
                    <option value="ongoing">Trong trận</option>
                    <option value="completed">Kết thúc</option>
                  </select>
                </>
              )}
              {/* Edit mode controls â€" admin only, DRAFT/PUBLISHED only */}
              {canEditSchedule && (
                editMode ? (
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <span className="text-xs text-orange-600 font-medium">● Chưa lưu</span>
                    )}
                    <button
                      onClick={() => updateScheduleMut.mutate(localUnified)}
                      disabled={!hasChanges || updateScheduleMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {updateScheduleMut.isPending
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Save size={12} />}
                      Lưu thay đổi
                    </button>
                    <button
                      onClick={exitEditMode}
                      disabled={updateScheduleMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      <X size={12} />Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={enterEditMode}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
                    title="Kéo thả để đổi thứ tự thi đấu"
                  >
                    <GripVertical size={12} />Chỉnh sửa lịch
                  </button>
                )
              )}
            </div>
          </div>

          {/* Court status panel */}
          <CourtStatusPanel
            schedule={schedule}
            onScore={handleManageMatch}
            onManageQuyen={handleManageQuyen}
            onViewResults={(slotId) => setResultsSlotId(slotId)}
          />

          {/* Select-all toolbar — admin only, not in edit mode */}
          {isAdmin && !editMode && visibleEligibleCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm">
              <span className="text-gray-500 text-xs">
                {visibleSelectedCount > 0
                  ? `Đã chọn ${visibleSelectedCount} / ${visibleEligibleCount} chưa setup`
                  : `${visibleEligibleCount} trận/lượt chưa setup trọng tài`}
              </span>
              <button
                onClick={handleSelectAll}
                disabled={visibleSelectedCount === visibleEligibleCount}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--color-primary,#1d4ed8)] text-white hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Chọn tất cả
              </button>
              {visibleSelectedCount > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  Bỏ chọn
                </button>
              )}
            </div>
          )}

          {/* Tab content */}
          <div className="bg-white rounded-xl border border-gray-200">
            {editMode ? (
              <EditableUnifiedTable
                items={localUnified}
                onDragEnd={handleDragEndUnified}
                onCourtChange={handleCourtChangeUnified}
              />
            ) : activeTab === 'all' ? (
              <AllTable
                schedule={schedule}
                sttMap={sttMap}
                filteredQuyen={filteredQuyen}
                filteredMatches={filteredMatches}
                onAction={setModal}
                onScore={handleManageMatch}
                onManageQuyen={handleManageQuyen}
                onViewResults={(slotId) => setResultsSlotId(slotId)}
                onViewBracket={(wcId, matchId) => navigate(`/tournaments?wc=${wcId}&match=${matchId}`)}
                focusStt={focusStt}
                onClearFocus={() => setFocusStt(null)}
                navigate={navigate}
                selectedMatchIds={isAdmin ? selectedMatchIds : undefined}
                onToggleMatch={isAdmin ? (id) => setSelectedMatchIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) : undefined}
                selectedSlotIds={isAdmin ? selectedSlotIds : undefined}
                onToggleSlot={isAdmin ? (id) => setSelectedSlotIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) : undefined}
                onViewTeamMembers={(slot) => setTeamMembersSlot(slot)}
              />
            ) : activeTab === 'quyen' ? (
              <QuyenTable
                slots={sortedQuyen}
                schedule={schedule}
                onAction={setModal}
                onManage={handleManageQuyen}
                onViewResults={(slotId) => setResultsSlotId(slotId)}
                selectedSlotIds={isAdmin ? selectedSlotIds : undefined}
                onToggleSlot={isAdmin ? (id) => setSelectedSlotIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) : undefined}
                onViewTeamMembers={(slot) => setTeamMembersSlot(slot)}
              />
            ) : (
              <MatchTable
                matches={sortedMatches}
                sttMap={sttMap}
                schedule={schedule}
                onAction={setModal}
                onScore={handleManageMatch}
                onViewBracket={(wcId, matchId) => navigate(`/tournaments?wc=${wcId}&match=${matchId}`)}
                focusStt={focusStt}
                navigate={navigate}
                selectedMatchIds={isAdmin ? selectedMatchIds : undefined}
                onToggleSelect={isAdmin ? (id) => setSelectedMatchIds(prev => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                }) : undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating action bar — bulk judge setup */}
      {isAdmin && (selectedMatchIds.size > 0 || selectedSlotIds.size > 0) && !editMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl bg-slate-800 px-5 py-3 shadow-2xl">
          {selectedMatchIds.size > 0 && (
            <button
              onClick={() => setShowBulkSetup(true)}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary,#1d4ed8)] hover:bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] px-4 py-2 text-sm font-semibold text-white transition"
            >
              <Users size={14} />
              Đối kháng ({selectedMatchIds.size})
            </button>
          )}
          {selectedSlotIds.size > 0 && (
            <button
              onClick={() => setShowBulkQuyenSetup(true)}
              className="flex items-center gap-2 rounded-xl bg-purple-500 hover:bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition"
            >
              <Users size={14} />
              Quyền ({selectedSlotIds.size})
            </button>
          )}
          <span className="text-slate-400 text-xs">Setup trọng tài</span>
          <button
            onClick={() => { setSelectedMatchIds(new Set()); setSelectedSlotIds(new Set()) }}
            className="text-slate-400 hover:text-white transition"
            title="Bỏ chọn tất cả"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk judge setup modal */}
      {showBulkSetup && tournamentId && (
        <BulkJudgeSetupModal
          matches={(schedule?.bracket_matches ?? []).filter(m => selectedMatchIds.has(m.id))}
          tournamentId={tournamentId}
          onClose={() => setShowBulkSetup(false)}
          onDone={() => {
            setSelectedMatchIds(new Set())
            qc.invalidateQueries({ queryKey: ['schedule'] })
          }}
        />
      )}

      {/* Bulk quyen judge setup modal */}
      {showBulkQuyenSetup && tournamentId && (
        <BulkQuyenSetupModal
          slots={(schedule?.quyen_slots ?? []).filter(s => selectedSlotIds.has(s.id))}
          tournamentId={tournamentId}
          onClose={() => setShowBulkQuyenSetup(false)}
          onDone={() => {
            setSelectedSlotIds(new Set())
            qc.invalidateQueries({ queryKey: ['schedule'] })
          }}
        />
      )}

      {/* Modal */}
      <Modal
        modal={modal}
        onClose={() => setModal(null)}
        onStartMatch={(matchId) => startMatchMut.mutate(matchId)}
        onResult={(matchId, winner, score1, score2) => resultMut.mutate({ matchId, winner, score1, score2 })}
        onStartQuyen={(slotId) => startQuyenMut.mutate(slotId)}
        onCompleteQuyen={(slotId) => completeQuyenMut.mutate(slotId)}
        onCancelMatch={(matchId) => cancelMatchMut.mutate(matchId)}
        isPending={anyPending}
        bracketMatches={schedule?.bracket_matches}
      />

      {/* Results Modal */}
      <QuyenResultsModal
        isOpen={resultsSlotId !== null}
        slotId={resultsSlotId ?? 0}
        onClose={() => setResultsSlotId(null)}
      />

      {teamMembersSlot && teamMembersSlot.club_id && teamMembersSlot.node_id && teamMembersSlot.kata_id && tournamentId && (
        <TeamMembersModal
          tournamentId={tournamentId}
          clubId={teamMembersSlot.club_id}
          nodeId={teamMembersSlot.node_id}
          kataId={teamMembersSlot.kata_id}
          kataName={teamMembersSlot.content_name}
          clubName={teamMembersSlot.player_name}
          onClose={() => setTeamMembersSlot(null)}
        />
      )}
    </div>
  )
}
