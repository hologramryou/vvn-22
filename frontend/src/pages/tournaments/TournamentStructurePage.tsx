import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useLocation } from 'react-router-dom'
import { Plus, Copy, ChevronRight, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { createTournamentTemplate } from '../../api/tournaments'
import {
  useStructureNodes,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useReorderNodes,
  useCopyStructure,
} from '../../hooks/useTournamentStructure'
import type { TournamentStructureNode } from '../../types/tournament'
import { Modal } from '../../components/ui'

// ── Level config ───────────────────────────────────────────────────────────

const LEVEL_ICONS = ['📁', '📂', '🗂️', '⚖️', '📌', '🔹', '🔸']
const LEVEL_ROW_TONES = [
  {
    filled: 'bg-slate-50/85 hover:bg-slate-100/85',
    emptyGroup: 'bg-slate-50/70',
    chip: 'border-slate-200 border-l-slate-300 bg-slate-50 text-slate-500',
  },
  {
    filled: 'bg-blue-50/70 hover:bg-blue-100/70',
    emptyGroup: 'bg-blue-50/55',
    chip: 'border-blue-200 border-l-blue-300 bg-blue-50/75 text-slate-600',
  },
  {
    filled: 'bg-emerald-50/70 hover:bg-emerald-100/70',
    emptyGroup: 'bg-emerald-50/55',
    chip: 'border-emerald-200 border-l-emerald-300 bg-emerald-50/75 text-slate-600',
  },
  {
    filled: 'bg-amber-50/75 hover:bg-amber-100/75',
    emptyGroup: 'bg-amber-50/60',
    chip: 'border-amber-200 border-l-amber-300 bg-amber-50/80 text-slate-600',
  },
  {
    filled: 'bg-violet-50/70 hover:bg-violet-100/70',
    emptyGroup: 'bg-violet-50/55',
    chip: 'border-violet-200 border-l-violet-300 bg-violet-50/75 text-slate-600',
  },
] as const

function nodeIcon(node: TournamentStructureNode) {
  if (node.node_type === 'weight_class') return '⚖️'
  return node.level === 0 ? '📁' : '📂'
}
function levelTone(level: number) {
  return LEVEL_ROW_TONES[level % LEVEL_ROW_TONES.length]
}
function sortNodes(nodes: TournamentStructureNode[]) {
  return [...nodes].sort((a, b) => a.sort_order - b.sort_order)
}
function childrenOf(nodes: TournamentStructureNode[], parentId: number | null) {
  return sortNodes(nodes.filter(node => node.parent_id === parentId))
}

// ── AddChildModal ──────────────────────────────────────────────────────────

type AddNodeType = 'group' | 'weight_class'

function AddChildModal({
  parentNode,
  onClose,
  onSubmit,
  isLoading,
  defaultNodeType = 'group',
}: {
  parentNode: TournamentStructureNode | null  // null = root level
  onClose: () => void
  onSubmit: (name: string, parentId: number | null, nodeType: AddNodeType) => void
  isLoading: boolean
  defaultNodeType?: AddNodeType
}) {
  const [name, setName] = useState('')
  const [nodeType, setNodeType] = useState<AddNodeType>(defaultNodeType)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), parentNode?.id ?? null, nodeType)
  }

  const isRoot = parentNode === null

  return (
    <Modal
      open
      onClose={onClose}
      title={isRoot ? 'Thêm cấp đầu tiên' : `Thêm mới trong: ${parentNode.name}`}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!name.trim() || isLoading}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${
              nodeType === 'weight_class'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] hover:opacity-90'
            }`}
          >
            {isLoading ? 'Đang thêm...' : nodeType === 'weight_class' ? 'Thêm hạng cân' : 'Thêm cấp'}
          </button>
        </>
      }
    >
      {/* Node type selector — chỉ hiện khi có parent (không phải root) */}
      {!isRoot && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setNodeType('group')}
            className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              nodeType === 'group'
                ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            <span>📂</span>
            <span>Cấp trung gian</span>
            <span className={`text-[10px] font-normal ${nodeType === 'group' ? 'text-blue-100' : 'text-gray-400'}`}>
              Chứa cấp con bên trong
            </span>
          </button>
          <button
            type="button"
            onClick={() => setNodeType('weight_class')}
            className={`flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
              nodeType === 'weight_class'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
            }`}
          >
            <span>⚖️</span>
            <span>Hạng cân</span>
            <span className={`text-[10px] font-normal ${nodeType === 'weight_class' ? 'text-green-100' : 'text-gray-400'}`}>
              VĐV đăng ký vào đây
            </span>
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {nodeType === 'weight_class' ? 'Tên hạng cân' : 'Tên cấp'}
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as React.FormEvent)}
          maxLength={100}
          placeholder={nodeType === 'weight_class' ? 'VD: 45kg, 54kg, Hạng nhẹ...' : 'VD: Nam, Phong trào, Thiếu niên...'}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
          autoFocus
        />
      </div>
    </Modal>
  )
}

// ── EditNodeModal ──────────────────────────────────────────────────────────

function EditNodeModal({
  node,
  onClose,
  onSubmit,
  isLoading,
}: {
  node: TournamentStructureNode
  onClose: () => void
  onSubmit: (name: string) => void
  isLoading: boolean
}) {
  const [name, setName] = useState(node.name)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim())
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Đổi tên — ${node.name}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Huỷ
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!name.trim() || name === node.name || isLoading}
            className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </>
      }
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tên mới</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as React.FormEvent)}
          maxLength={100}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
          autoFocus
        />
      </div>
    </Modal>
  )
}

// ── DeleteNodeModal ────────────────────────────────────────────────────────

function DeleteNodeModal({
  node,
  allNodes,
  onClose,
  onSubmit,
  isLoading,
}: {
  node: TournamentStructureNode
  allNodes: TournamentStructureNode[]
  onClose: () => void
  onSubmit: (moveToNodeId: number | null) => void
  isLoading: boolean
}) {
  const [moveToNodeId, setMoveToNodeId] = useState<number | null>(null)

  // Get descendants count
  const countDescendants = (n: TournamentStructureNode): number =>
    n.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0)
  const descendantCount = countDescendants(node)

  // Get siblings (same level, same parent) from allNodes flat list
  const siblings = allNodes.filter(
    n => n.parent_id === node.parent_id && n.level === node.level && n.id !== node.id,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (node.student_count > 0 && !moveToNodeId) return
    onSubmit(moveToNodeId)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Xóa cấp — ${node.name}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Huỷ
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={(node.student_count > 0 && !moveToNodeId) || isLoading}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </>
      }
    >
      {node.student_count > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800 font-medium mb-2">
            Node này có {node.student_count} VĐV — chọn hạng cân để chuyển họ sang
          </p>
          <select
            value={moveToNodeId ?? ''}
            onChange={e => setMoveToNodeId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Chuyển VĐV sang...</option>
            {siblings.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.student_count} VĐV)
              </option>
            ))}
          </select>
        </div>
      )}
      {descendantCount > 0 && (
        <p className="text-sm text-red-700 mb-3">Sẽ xóa thêm {descendantCount} node con</p>
      )}
      {node.student_count === 0 && (
        <p className="text-sm text-gray-600">Xác nhận xóa '{node.name}'?</p>
      )}
    </Modal>
  )
}

// ── CopyStructureModal ─────────────────────────────────────────────────────

function CopyStructureModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void
  onSubmit: (sourceTournamentId: number, copyKatas: boolean) => void
  isLoading: boolean
}) {
  const [sourceTournamentId, setSourceTournamentId] = useState('')
  const [copyKatas, setCopyKatas] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceTournamentId) return
    onSubmit(Number(sourceTournamentId), copyKatas)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Sao chép cấu trúc từ giải khác"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Huỷ
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!sourceTournamentId || isLoading}
            className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Đang sao chép...' : 'Sao chép'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID giải nguồn</label>
          <input
            type="number"
            value={sourceTournamentId}
            onChange={e => setSourceTournamentId(e.target.value)}
            placeholder="Nhập ID giải đấu nguồn"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            autoFocus
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            id="copy-katas"
            checked={copyKatas}
            onChange={e => setCopyKatas(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Copy luôn danh sách bài quyền</span>
        </label>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-800">
            Sẽ xóa toàn bộ cấu trúc hiện tại nếu có. Thao tác không thể hoàn tác.
          </p>
        </div>
      </div>
    </Modal>
  )
}

function SaveTemplateModal({
  defaultName,
  onClose,
  onSubmit,
  isLoading,
}: {
  defaultName: string
  onClose: () => void
  onSubmit: (name: string, description: string, copyKatas: boolean) => void
  isLoading: boolean
}) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [copyKatas, setCopyKatas] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), description.trim(), copyKatas)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Lưu template sơ đồ giải đấu"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            Hủy
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={!name.trim() || isLoading}
            className="px-4 py-2 text-sm text-white bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Đang lưu...' : 'Lưu template'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên template</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] resize-none"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={copyKatas}
            onChange={e => setCopyKatas(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Lưu luôn danh sách bài quyền</span>
        </label>
      </div>
    </Modal>
  )
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: {
      data?: {
        detail?: { message?: string; code?: string } | string
      }
    }
    message?: string
  }
  const detail = anyErr.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (detail && typeof detail === 'object') {
    if (detail.message) return detail.message
    if (detail.code) return detail.code
  }
  return anyErr.message || fallback
}

// ── TreeNode ───────────────────────────────────────────────────────────────

function TreeNode({
  node,
  canEdit,
  allNodes,
  expandedIds,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
  dragState,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: TournamentStructureNode
  canEdit: boolean
  allNodes: TournamentStructureNode[]
  expandedIds: Set<number>
  onToggleExpand: (id: number) => void
  onAddChild: (node: TournamentStructureNode) => void
  onEdit: (node: TournamentStructureNode) => void
  onDelete: (node: TournamentStructureNode) => void
  dragState: { draggingId: number | null; overId: number | null }
  onDragStart: (id: number) => void
  onDragOver: (id: number, e: React.DragEvent) => void
  onDrop: (targetId: number) => void
}) {
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = node.children.length > 0
  // weight_class nodes always render as regular rows (never as chip)
  const isEmptyLeaf = node.student_count === 0 && !hasChildren && node.node_type !== 'weight_class'
  const isEmptyGroup = node.student_count === 0 && hasChildren
  const indent = node.level * 20
  const tone = levelTone(node.level)
  const isDragging = dragState.draggingId === node.id
  const isDragOver = dragState.overId === node.id

  return (
    <div className="w-full">
      <div
        className={`
          group relative flex items-center gap-2 w-full border-b border-gray-100 transition-colors
          ${isEmptyLeaf
            ? 'px-3 py-1.5'
            : isEmptyGroup
              ? `px-3 py-2 ${tone.emptyGroup} text-gray-500`
              : `px-3 py-2 ${tone.filled} text-gray-700`
          }
          ${isDragging ? 'opacity-40' : ''}
          ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}
        `}
        style={{ paddingLeft: `${indent + 12}px` }}
        draggable={canEdit}
        onDragStart={() => onDragStart(node.id)}
        onDragOver={e => onDragOver(node.id, e)}
        onDrop={() => onDrop(node.id)}
      >
        {/* Drag handle */}
        {canEdit && (
          <span className="text-gray-300 cursor-grab select-none opacity-0 group-hover:opacity-100 transition-opacity">
            ⠿
          </span>
        )}

        {/* Expand/collapse */}
        <button
          onClick={() => hasChildren && onToggleExpand(node.id)}
          className={`text-gray-400 flex-shrink-0 ${hasChildren ? 'cursor-pointer hover:text-gray-600' : 'invisible'}`}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {isEmptyLeaf ? (
          <div className={`inline-flex min-w-0 items-center gap-2 rounded-xl border border-l-4 px-3 py-1.5 shadow-sm ${tone.chip}`}>
            <span className="text-base flex-shrink-0 text-gray-400">{nodeIcon(node)}</span>
            <span className="min-w-0 truncate text-sm">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-200 text-gray-600">
              {node.student_count} VĐV
            </span>
          </div>
        ) : (
          <>
            {/* Level icon */}
            <span className={`text-base flex-shrink-0 ${isEmptyGroup ? 'text-gray-400' : ''}`}>{nodeIcon(node)}</span>

            {/* Name */}
            <span className={`flex-1 text-sm ${isEmptyGroup ? 'text-gray-500' : ''}`}>{node.name}</span>

            {/* Student count badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${isEmptyGroup ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-600'}`}>
              {node.student_count} VĐV
            </span>
          </>
        )}

        {/* Action buttons (hover) */}
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onAddChild(node)}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Thêm cấp con"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onEdit(node)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="Đổi tên"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(node)}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
              title="Xóa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              canEdit={canEdit}
              allNodes={allNodes}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function TournamentStructurePage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const tid = Number(tournamentId)
  const qc = useQueryClient()
  const location = useLocation()

  const { data, isLoading, isError } = useStructureNodes(tid)
  const createNode = useCreateNode(tid)
  const updateNode = useUpdateNode(tid)
  const deleteNode = useDeleteNode(tid)
  const reorderNodes = useReorderNodes(tid)
  const copyStructure = useCopyStructure(tid)
  const saveTemplateMut = useMutation({
    mutationFn: createTournamentTemplate,
  })

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [addChildTarget, setAddChildTarget] = useState<TournamentStructureNode | null | false>(false)
  const [editTarget, setEditTarget] = useState<TournamentStructureNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TournamentStructureNode | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  const [dragState, setDragState] = useState<{ draggingId: number | null; overId: number | null }>({
    draggingId: null,
    overId: null,
  })

  const canEdit = data ? !(data.tournament_status === 'COMPLETED') : false

  useEffect(() => {
    if (!data) return
    const validNodeIds = new Set(data.nodes.map(node => node.id))
    setExpandedIds(prev => {
      if (prev.size === 0) {
        return new Set(data.nodes.map(node => node.id))
      }

      return new Set([...prev].filter(nodeId => validNodeIds.has(nodeId)))
    })
  }, [data])

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAddChild = async (name: string, parentId: number | null, nodeType: AddNodeType) => {
    try {
      await createNode.mutateAsync({
        parent_id: parentId,
        name,
        node_type: parentId === null ? 'group' : nodeType,
      })
      setAddChildTarget(false)
      setErrorMsg(null)
      // Auto-expand parent to show the new child
      if (parentId !== null) {
        setExpandedIds(prev => new Set([...prev, parentId]))
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể tạo node'
      setErrorMsg(msg)
    }
  }

  const [initingGender, setInitingGender] = useState(false)
  const handleInitGender = async () => {
    setInitingGender(true)
    try {
      await createNode.mutateAsync({ parent_id: null, name: 'Nam' })
      await createNode.mutateAsync({ parent_id: null, name: 'Nữ' })
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể khởi tạo'
      setErrorMsg(msg)
    } finally {
      setInitingGender(false)
    }
  }

  const handleEdit = async (name: string) => {
    if (!editTarget) return
    try {
      await updateNode.mutateAsync({ nodeId: editTarget.id, name })
      setEditTarget(null)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể đổi tên'
      setErrorMsg(msg)
    }
  }

  const handleDelete = async (moveToNodeId: number | null) => {
    if (!deleteTarget) return
    try {
      await deleteNode.mutateAsync({ nodeId: deleteTarget.id, moveToNodeId })
      setDeleteTarget(null)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể xóa node'
      setErrorMsg(msg)
    }
  }

  const handleCopy = async (sourceTournamentId: number, copyKatas: boolean) => {
    try {
      await copyStructure.mutateAsync({ source_tournament_id: sourceTournamentId, copy_katas: copyKatas })
      setShowCopyModal(false)
      setErrorMsg(null)
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: { message?: string } } } })
        .response?.data?.detail?.message ?? 'Không thể sao chép cấu trúc'
      setErrorMsg(msg)
    }
  }

  const handleSaveTemplate = async (name: string, description: string, copyKatas: boolean) => {
    try {
      await saveTemplateMut.mutateAsync({
        name,
        description: description || null,
        source_tournament_id: tid,
        copy_katas: copyKatas,
      })
      await qc.invalidateQueries({ queryKey: ['tournament-templates'] })
      setShowSaveTemplateModal(false)
      setErrorMsg(null)
      setInfoMsg(`Đã lưu template "${name}"`)
    } catch (err) {
      const msg = extractApiErrorMessage(err, 'Không thể lưu template')
      setErrorMsg(msg)
    }
  }

  // Drag-drop handlers
  const handleDragStart = (id: number) => {
    setDragState({ draggingId: id, overId: null })
  }

  const handleDragOver = (id: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragState(prev => ({ ...prev, overId: id }))
  }

  const handleDrop = async (targetId: number) => {
    const { draggingId } = dragState
    setDragState({ draggingId: null, overId: null })

    if (!draggingId || draggingId === targetId || !data) return

    // Find both nodes in flat list
    const allFlat = data.nodes
    const dragging = allFlat.find(n => n.id === draggingId)
    const target = allFlat.find(n => n.id === targetId)

    if (!dragging || !target) return
    if (dragging.parent_id !== target.parent_id) {
      setErrorMsg('Chỉ có thể sắp xếp trong cùng cấp')
      setTimeout(() => setErrorMsg(null), 2000)
      return
    }

    // Get all siblings and build new order
    const siblings = allFlat
      .filter(n => n.parent_id === dragging.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)

    const withoutDragging = siblings.filter(n => n.id !== draggingId)
    const targetIndex = withoutDragging.findIndex(n => n.id === targetId)
    withoutDragging.splice(targetIndex, 0, dragging)

    const reorderedNodes = withoutDragging.map((n, i) => ({
      node_id: n.id,
      sort_order: i + 1,
    }))

    try {
      await reorderNodes.mutateAsync({
        parent_id: dragging.parent_id,
        nodes: reorderedNodes,
      })
    } catch {
      setErrorMsg('Không thể thay đổi thứ tự')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary,#1d4ed8)]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-center text-red-600">
        Không thể tải cấu trúc giải đấu
      </div>
    )
  }

  const { tournament_name, tournament_status, nodes: flatNodes, stats, treeData } = data
  const isKatas = location.pathname.includes('/katas')

  const statusStyle =
    tournament_status === 'DRAFT'     ? 'bg-slate-100 text-slate-500' :
    tournament_status === 'PUBLISHED' ? 'bg-blue-50 text-[var(--color-primary,#1d4ed8)]' :
                                        'bg-emerald-50 text-emerald-600'

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs mb-3">
          <Link
            to="/tournaments/manage"
            className="text-[var(--color-primary,#1d4ed8)] hover:underline transition-colors"
          >
            Quản lý Giải Đấu
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-500 font-medium">{tournament_name}</span>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-slate-400">Cấu trúc</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--color-primary-dark,#1e3a5f)]">{tournament_name}</h1>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusStyle}`}>
                {tournament_status}
              </span>
            </div>
            {/* Stats chips */}
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">
                ⚖️ {stats.total_weight_classes} hạng cân
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                👤 {stats.total_students} VĐV
              </span>
            </div>
          </div>

          {/* Action buttons */}
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {flatNodes.length === 0 && (
                <>
                  <button
                    onClick={handleInitGender}
                    disabled={initingGender}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {initingGender ? 'Đang tạo...' : 'Khởi tạo Nam / Nữ'}
                  </button>
                  <button
                    onClick={() => setAddChildTarget(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm thủ công
                  </button>
                </>
              )}
              <button
                onClick={() => setShowCopyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Sao chép
              </button>
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Lưu template
              </button>
            </div>
          )}
        </div>

        {/* Tab nav — pill style */}
        <div className="mt-4">
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5">
            <Link
              to={`/tournaments/${tid}/structure/weight-classes`}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                !isKatas
                  ? 'bg-white shadow-sm text-[var(--color-primary,#1d4ed8)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ⚔️ Đối kháng
            </Link>
            <Link
              to={`/tournaments/${tid}/structure/katas`}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                isKatas
                  ? 'bg-white shadow-sm text-[var(--color-primary,#1d4ed8)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🥋 Quyền
            </Link>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {infoMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {infoMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* ── Tree ────────────────────────────────────────────────────────── */}
      {flatNodes.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-white">
          <p className="text-slate-400 text-sm mb-5">Chưa có cấu trúc giải đấu</p>
          {canEdit && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={handleInitGender}
                disabled={initingGender}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {initingGender ? 'Đang tạo...' : 'Khởi tạo Nam / Nữ'}
              </button>
              <button
                onClick={() => setAddChildTarget(null)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Thêm thủ công
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tree toolbar */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{flatNodes.length} node · {treeData.length} nhánh gốc</span>
              <span className="hidden sm:inline">· Kéo thả để sắp xếp trong cùng cấp</span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setAddChildTarget(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-primary,#1d4ed8)] rounded-lg hover:bg-[var(--color-primary-dark,#1e3a5f)] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm cấp gốc
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {treeData.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                canEdit={canEdit}
                allNodes={flatNodes}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onAddChild={setAddChildTarget}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {addChildTarget !== false && (
        <AddChildModal
          parentNode={addChildTarget}
          onClose={() => setAddChildTarget(false)}
          onSubmit={handleAddChild}
          isLoading={createNode.isPending}
          defaultNodeType={
            addChildTarget === null ? 'group' : (() => {
              const nodes = data?.nodes ?? []
              // If parent already has weight_class children → weight_class
              if (nodes.some(n => n.parent_id === addChildTarget.id && n.node_type === 'weight_class')) return 'weight_class'
              // If parent's siblings are weight_class → same level should also be weight_class
              if (addChildTarget.parent_id !== null && nodes.some(
                n => n.parent_id === addChildTarget.parent_id && n.node_type === 'weight_class' && n.id !== addChildTarget.id
              )) return 'weight_class'
              return 'group'
            })()
          }
        />
      )}

      {editTarget && (
        <EditNodeModal
          node={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEdit}
          isLoading={updateNode.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteNodeModal
          node={deleteTarget}
          allNodes={flatNodes}
          onClose={() => setDeleteTarget(null)}
          onSubmit={handleDelete}
          isLoading={deleteNode.isPending}
        />
      )}

      {showCopyModal && (
        <CopyStructureModal
          onClose={() => setShowCopyModal(false)}
          onSubmit={handleCopy}
          isLoading={copyStructure.isPending}
        />
      )}

      {showSaveTemplateModal && (
        <SaveTemplateModal
          defaultName={`Template ${tournament_name}`}
          onClose={() => setShowSaveTemplateModal(false)}
          onSubmit={handleSaveTemplate}
          isLoading={saveTemplateMut.isPending}
        />
      )}
    </div>
  )
}


