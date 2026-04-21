import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Plus, GitBranch, BookOpen, BarChart2, Loader2, X, Trash2, Pencil, Check, Settings } from 'lucide-react'
import { SportIcon } from '../../components/ui/SportIcon'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { card, color } from '../../styles/tokens'
import {
  listTournaments,
  createTournament,
  deleteTournament,
  updateTournament,
  listTournamentTemplates,
  getTournamentConfig,
  updateTournamentConfig,
} from '../../api/tournaments'
import type { TournamentConfig } from '../../types/tournament'
import { useTournament } from '../../context/TournamentContext'

const STATUS_KEY: Record<string, string> = {
  DRAFT:     'pending',
  PUBLISHED: 'ready',
  ONGOING:   'ongoing',
  COMPLETED: 'completed',
  active:    'ongoing',
}

const SPORT_ICONS = [
  { emoji: 'BELT', label: 'Đai võ thuật' },
  { emoji: '🥋', label: 'Võ thuật' },
  { emoji: '🥊', label: 'Boxing' },
  { emoji: '⚽', label: 'Bóng đá' },
  { emoji: '🏸', label: 'Cầu lông' },
  { emoji: '🏊', label: 'Bơi lội' },
  { emoji: '🏋️', label: 'Cử tạ' },
  { emoji: '🤼', label: 'Vật' },
  { emoji: '🏇', label: 'Đua ngựa' },
  { emoji: '🎯', label: 'Bắn cung' },
  { emoji: '🏓', label: 'Bóng bàn' },
  { emoji: '🏆', label: 'Tổng hợp' },
  { emoji: '🎖️', label: 'Huy chương' },
]

const GRADIENT_PRESETS = [
  { from: '#38bdf8', to: '#ec4899', label: 'Sky → Pink' },
  { from: '#4ade80', to: '#facc15', label: 'Green → Yellow' },
  { from: '#818cf8', to: '#f97316', label: 'Indigo → Orange' },
  { from: '#c084fc', to: '#a5b4fc', label: 'Purple → Lavender' },
  { from: '#f43f5e', to: '#fb923c', label: 'Rose → Orange' },
  { from: '#7f1d1d', to: '#1e3a8a', label: 'Crimson → Navy' },
  { from: '#b45309', to: '#92400e', label: 'Amber → Brown' },
  { from: '#0891b2', to: '#06b6d4', label: 'Cyan → Teal' },
  { from: '#16a34a', to: '#86efac', label: 'Green → Mint' },
  { from: '#ca8a04', to: '#a16207', label: 'Yellow → Olive' },
  { from: '#0ea5e9', to: '#d946ef', label: 'Blue → Fuchsia' },
  { from: '#a855f7', to: '#ec4899', label: 'Violet → Pink' },
  { from: '#1d4ed8', to: '#1e3a5f', label: 'Blue → Navy (mặc định)' },
  { from: '#0f766e', to: '#14b8a6', label: 'Teal → Aqua' },
  { from: '#dc2626', to: '#7c3aed', label: 'Red → Purple' },
  { from: '#7c3aed', to: '#c026d3', label: 'Purple → Magenta' },
  { from: '#ea580c', to: '#facc15', label: 'Orange → Gold' },
  { from: '#0369a1', to: '#38bdf8', label: 'Ocean → Sky' },
  { from: '#be185d', to: '#f43f5e', label: 'Pink → Rose' },
  { from: '#334155', to: '#94a3b8', label: 'Slate → Silver' },
]

interface EditState {
  id: number
  name: string
  sport_icon: string
  primary_color?: string | null
  gradient_primary?: string | null
}

interface DeleteTarget {
  id: number
  name: string
}

export const TournamentManagePage = () => {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { setSelectedTournament } = useTournament()
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newIcon, setNewIcon]   = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [configTournamentId, setConfigTournamentId] = useState<number | null>(null)
  const [configDraft, setConfigDraft] = useState<TournamentConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments-list'],
    queryFn:  listTournaments,
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['tournament-templates'],
    queryFn: listTournamentTemplates,
  })

  const createMut = useMutation({
    mutationFn: createTournament,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournaments-list'] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
      qc.invalidateQueries({ queryKey: ['tournament-templates'] })
      setShowForm(false)
      setNewName('')
      setNewIcon('')
      setSelectedTemplateId('')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; sport_icon?: string; primary_color?: string | null; gradient_primary?: string | null } }) =>
      updateTournament(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournaments-list'] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
      setEditState(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteTournament,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tournaments-list'] })
      qc.invalidateQueries({ queryKey: ['tournaments'] })
      setDeleteTarget(null)
    },
  })

  const { data: loadedConfig } = useQuery({
    queryKey: ['tournament-config', configTournamentId],
    queryFn: () => getTournamentConfig(configTournamentId!),
    enabled: configTournamentId !== null,
  })

  const configMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TournamentConfig }) =>
      updateTournamentConfig(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(['tournament-config', configTournamentId], updated)
      setConfigDraft(updated)
    },
  })

  if (loadedConfig && configTournamentId !== null && configDraft === null) {
    setConfigDraft(loadedConfig)
  }

  const handleOpenConfig = (id: number) => {
    setConfigTournamentId(id)
    setConfigDraft(null)
    setEditState(null)
  }

  const handleSaveConfig = () => {
    if (!configTournamentId || !configDraft) return
    configMut.mutate({ id: configTournamentId, data: configDraft })
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    createMut.mutate({
      name: newName.trim(),
      sport_icon: newIcon || undefined,
      template_id: selectedTemplateId ? Number(selectedTemplateId) : null,
    })
  }

  const handleSaveEdit = () => {
    if (!editState || !editState.name.trim()) return
    updateMut.mutate({ id: editState.id, data: { name: editState.name.trim(), sport_icon: editState.sport_icon, primary_color: editState.primary_color, gradient_primary: editState.gradient_primary } })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      if (tournaments.find(t => t.id === deleteTarget.id)?.id === Number(localStorage.getItem('selected_tournament_id'))) {
        localStorage.removeItem('selected_tournament_id')
      }
    } catch {
      // handled by mutation error states if needed later
    }
  }

  return (
    <div className={`min-h-screen ${color.pageBg}`}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} className="text-yellow-500" />
            <h1 className="text-xl font-bold text-[var(--color-primary-dark,#1e3a5f)]">Quản lý Giải Đấu</h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90"
          >
            <Plus size={15} />
            Tạo giải mới
          </button>
        </div>
      </div>

      {/* New tournament form */}
      {showForm && (
        <div className={`mx-6 mt-4 p-4 ${card.base} space-y-3`}>
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Tên giải đấu..."
              className={`flex-1 border ${color.borderStrong} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Tạo
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(''); setNewIcon(''); setSelectedTemplateId('') }}
              className={`p-2 ${color.textSecondary} hover:text-slate-600 rounded-lg hover:bg-slate-100`}
            >
              <X size={16} />
            </button>
          </div>
          {/* Icon picker */}
          <div>
            <p className={`text-xs ${color.textSecondary} mb-1.5`}>Biểu tượng môn thể thao</p>
            <div className="flex flex-wrap gap-1.5">
              {SPORT_ICONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  onClick={() => setNewIcon(newIcon === emoji ? '' : emoji)}
                  className={`w-9 h-9 text-xl rounded-lg border transition-colors flex items-center justify-center ${newIcon === emoji ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50' : `${color.borderBase} hover:border-slate-300 bg-white`}`}
                >
                  <SportIcon icon={emoji} className="w-6 h-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
            <label className={`text-sm ${color.textSecondary}`}>Template sơ đồ</label>
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              className={`w-full border ${color.borderStrong} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
            >
              <option value="">Tạo trống</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.node_count} node, {template.kata_count} quyền)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tournament list */}
      <div className="p-6">
        {isLoading ? (
          <div className={`flex items-center justify-center h-40 gap-2 ${color.textMuted}`}>
            <Loader2 size={20} className="animate-spin" />
            <span>Đang tải...</span>
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState
            variant="page"
            message="Chưa có giải đấu nào"
            action={
              <button onClick={() => setShowForm(true)} className="text-sm text-[var(--color-primary,#1d4ed8)] hover:underline">
                Tạo giải đầu tiên
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map(t => {
              const statusKey = STATUS_KEY[t.status] ?? 'pending'
              const isEditing = editState?.id === t.id
              return (
                <div key={t.id} className={`${card.base} overflow-hidden hover:shadow-md transition-shadow`}>
                  {/* Header */}
                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {t.sport_icon
                        ? <SportIcon icon={t.sport_icon} className="w-10 h-8 flex-shrink-0" />
                        : <Trophy size={22} className="text-blue-300 flex-shrink-0" />
                      }
                      <p className="font-semibold text-[var(--color-primary-dark,#1e3a5f)] leading-snug text-sm" title={t.name}>{t.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] ${color.textMuted}`}>#{t.id} · {new Date(t.created_at).toLocaleDateString('vi-VN')}</span>
                      <button
                        onClick={() => setEditState(isEditing ? null : { id: t.id, name: t.name, sport_icon: t.sport_icon ?? '', primary_color: t.primary_color ?? null, gradient_primary: t.gradient_primary ?? null })}
                        className={`p-1 rounded transition-all ${isEditing ? 'text-[var(--color-primary,#1d4ed8)] bg-blue-100' : `opacity-0 group-hover:opacity-100 ${color.textMuted} hover:text-[var(--color-primary,#1d4ed8)] hover:bg-blue-100`}`}
                        title="Đổi tên / icon"
                      >
                        <Pencil size={13} />
                      </button>
                      <StatusBadge status={statusKey} />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">

                  {/* Edit form */}
                  {isEditing && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2">
                        <SportIcon icon={editState.sport_icon || ''} className="w-6 h-5" />
                        <input
                          autoFocus
                          value={editState.name}
                          onChange={e => setEditState(s => s && { ...s, name: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          className={`flex-1 border border-[var(--color-primary,#1d4ed8)] rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" title="Xóa icon"
                          onClick={() => setEditState(s => s && { ...s, sport_icon: '' })}
                          className={`w-8 h-8 text-xs rounded-lg border transition-colors ${editState.sport_icon === '' ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50' : `${color.borderBase} hover:border-slate-300 bg-white ${color.textMuted}`}`}
                        >✕</button>
                        {SPORT_ICONS.map(({ emoji, label }) => (
                          <button key={emoji} type="button" title={label}
                            onClick={() => setEditState(s => s && { ...s, sport_icon: emoji })}
                            className={`w-8 h-8 rounded-lg border transition-colors flex items-center justify-center ${editState.sport_icon === emoji ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50' : `${color.borderBase} hover:border-slate-300 bg-white`}`}
                          >
                            <SportIcon icon={emoji} className="w-5 h-4" />
                          </button>
                        ))}
                      </div>
                      <div>
                        <label className={`text-xs font-medium ${color.textSecondary}`}>Màu chủ đạo</label>
                        {/* Gradient preset palette */}
                        <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                          {GRADIENT_PRESETS.map((p, i) => {
                            const active = editState.primary_color === p.from && editState.gradient_primary === p.to
                            return (
                              <button
                                key={i}
                                type="button"
                                title={p.label}
                                onClick={() => setEditState(s => s && { ...s, primary_color: p.from, gradient_primary: p.to })}
                                className={`h-8 rounded-lg transition-all ${active ? 'ring-2 ring-offset-1 ring-slate-500 scale-105' : 'hover:scale-105'}`}
                                style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                              />
                            )
                          })}
                        </div>
                        {/* Preview + manual hex inputs */}
                        <div
                          className="mt-2 h-5 rounded-lg"
                          style={{ background: `linear-gradient(to right, ${editState.primary_color ?? '#1d4ed8'}, ${editState.gradient_primary ?? '#1e3a5f'})` }}
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <input type="color" value={editState.primary_color ?? '#1d4ed8'}
                            onChange={e => setEditState(s => s && { ...s, primary_color: e.target.value })}
                            className={`w-7 h-7 rounded border ${color.borderBase} cursor-pointer p-0.5 shrink-0`}
                          />
                          <input type="text" value={editState.primary_color ?? '#1d4ed8'}
                            onChange={e => setEditState(s => s && { ...s, primary_color: e.target.value })}
                            placeholder="#1d4ed8" maxLength={7}
                            className={`w-20 px-2 py-1 text-xs border ${color.borderBase} rounded font-mono`}
                          />
                          <span className={`${color.textMuted} text-xs`}>→</span>
                          <input type="color" value={editState.gradient_primary ?? '#1e3a5f'}
                            onChange={e => setEditState(s => s && { ...s, gradient_primary: e.target.value })}
                            className={`w-7 h-7 rounded border ${color.borderBase} cursor-pointer p-0.5 shrink-0`}
                          />
                          <input type="text" value={editState.gradient_primary ?? '#1e3a5f'}
                            onChange={e => setEditState(s => s && { ...s, gradient_primary: e.target.value })}
                            placeholder="#1e3a5f" maxLength={7}
                            className={`w-20 px-2 py-1 text-xs border ${color.borderBase} rounded font-mono`}
                          />
                          <button type="button"
                            onClick={() => setEditState(s => s && { ...s, primary_color: null, gradient_primary: null })}
                            className={`text-xs ${color.textMuted} hover:text-slate-600 shrink-0`}
                          >Reset</button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={updateMut.isPending}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                        >
                          {updateMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Lưu
                        </button>
                        <button onClick={() => setEditState(null)}
                          className={`px-3 py-1 text-xs ${color.textSecondary} border ${color.borderBase} rounded-lg hover:bg-slate-50`}
                        >Hủy</button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isEditing && configTournamentId !== t.id && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => navigate(`/tournaments/${t.id}/structure/weight-classes`)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <GitBranch size={15} />
                        Cấu trúc giải đấu
                      </button>
                      <button
                        onClick={() => navigate(`/tournaments/${t.id}/structure/katas`)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <BookOpen size={15} />
                        Bài Quyền
                      </button>
                      <button
                        onClick={() => handleOpenConfig(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                      >
                        <Settings size={15} />
                        Cài đặt giải đấu
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                        disabled={deleteMut.isPending}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        Xóa giải đấu
                      </button>
                      <button
                        onClick={() => { setSelectedTournament(t); navigate('/tournaments') }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${color.textSecondary} bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors`}
                      >
                        <BarChart2 size={15} />
                        Xem Sơ Đồ Đấu
                      </button>
                    </div>
                  )}

                  {/* Inline config form */}
                  {!isEditing && configTournamentId === t.id && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Cài đặt giải đấu</p>
                      {configDraft === null ? (
                        <div className={`flex items-center gap-2 ${color.textMuted} text-sm py-2`}>
                          <Loader2 size={14} className="animate-spin" /> Đang tải...
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <label className={`${color.textSecondary} self-center`}>Thời gian hiệp (s)</label>
                            <input type="number" min={30} max={600}
                              value={configDraft.default_round_duration_seconds}
                              onChange={e => setConfigDraft(d => d && { ...d, default_round_duration_seconds: Number(e.target.value) })}
                              className={`border ${color.borderStrong} rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                            />
                            <label className={`${color.textSecondary} self-center`}>Nghỉ giữa hiệp (s)</label>
                            <input type="number" min={10} max={300}
                              value={configDraft.default_break_duration_seconds}
                              onChange={e => setConfigDraft(d => d && { ...d, default_break_duration_seconds: Number(e.target.value) })}
                              className={`border ${color.borderStrong} rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                            />
                            <label className={`${color.textSecondary} self-center`}>Thời gian quyền (s)</label>
                            <input type="number" min={30} max={600}
                              value={configDraft.default_performance_duration_seconds}
                              onChange={e => setConfigDraft(d => d && { ...d, default_performance_duration_seconds: Number(e.target.value) })}
                              className={`border ${color.borderStrong} rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                            />
                            <label className={`${color.textSecondary} self-center`}>Cửa sổ đồng thuận (s)</label>
                            <input type="number" min={0.5} max={5} step={0.1}
                              value={configDraft.consensus_window_secs}
                              onChange={e => setConfigDraft(d => d && { ...d, consensus_window_secs: Number(e.target.value) })}
                              className={`border ${color.borderStrong} rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                            />
                            <label className={`${color.textSecondary} self-center`}>Trọng tài tối thiểu</label>
                            <input type="number" min={1} max={5}
                              value={configDraft.consensus_min_votes}
                              onChange={e => setConfigDraft(d => d && { ...d, consensus_min_votes: Number(e.target.value) })}
                              className={`border ${color.borderStrong} rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)]`}
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={handleSaveConfig} disabled={configMut.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                            >
                              {configMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Lưu
                            </button>
                            <button onClick={() => { setConfigTournamentId(null); setConfigDraft(null) }}
                              className={`px-3 py-1.5 text-xs ${color.textSecondary} border ${color.borderBase} rounded-lg hover:bg-slate-50`}
                            >Hủy</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  </div>{/* end body */}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xóa giải đấu"
        message={`Xóa giải đấu "${deleteTarget?.name}" và toàn bộ dữ liệu liên quan?`}
        confirmLabel="Xóa"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
