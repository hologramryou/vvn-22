import { Trash2, Pencil } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eventLabel, categoryLabel } from '../../lib/constants'
import { patchWeightVerified } from '../../api/students'
import type { StudentListItem } from '../../types/student'

interface Props {
  students: StudentListItem[]
  onDelete: (id: number) => void
  onView?: (id: number) => void
  onEdit?: (id: number) => void
  canEdit?: (s: StudentListItem) => boolean
  canVerifyWeight?: boolean
  showCheckboxes?: boolean
  selectedIds?: Set<number>
  onSelectChange?: (id: number, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
}

const weightLabel = (s: StudentListItem) => {
  const list = s.weight_classes?.length ? s.weight_classes : s.weight_class ? [s.weight_class] : []
  return list.map(v => `${v} kg`).join(', ') || '—'
}

export const StudentTable = ({ students, onDelete, onView, onEdit, canEdit, canVerifyWeight = false, showCheckboxes = false, selectedIds, onSelectChange, onSelectAll }: Props) => {
  const allSelected = students.length > 0 && students.every(s => selectedIds?.has(s.id))
  const qc = useQueryClient()
  const verifyMut = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) => patchWeightVerified(id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)] text-white text-xs uppercase tracking-wide">
            {showCheckboxes && (
              <th className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={allSelected} onChange={e => onSelectAll?.(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 cursor-pointer" />
              </th>
            )}
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Họ và tên</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Mã VĐV</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Đơn vị</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Hạng mục</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Nội dung thi đấu</th>
            <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Hạng cân</th>
            <th className="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.length === 0 ? (
            <tr>
              <td colSpan={showCheckboxes ? 8 : 7} className="text-center py-12 text-gray-400">Không có dữ liệu</td>
            </tr>
          ) : students.map(s => (
            <tr key={s.id}
              className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds?.has(s.id) ? 'bg-blue-50' : ''}`}
              onClick={() => onView?.(s.id)}>
              {showCheckboxes && (
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds?.has(s.id) ?? false}
                    onChange={e => onSelectChange?.(s.id, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                </td>
              )}
              <td className="px-4 py-3 font-medium text-blue-600 hover:underline whitespace-nowrap">{s.full_name}</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{s.code}</td>
              <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{s.club_name ?? '—'}</td>
              {/* Hạng mục */}
              <td className="px-4 py-3 whitespace-nowrap">
                {s.registration_category
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">{s.registration_category}</span>
                  : s.category_type && s.category_loai
                    ? (() => {
                        const lbl = categoryLabel(s.category_type, s.category_loai)
                        const isPhong = s.category_type === 'phong_trao'
                        return lbl
                          ? <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${isPhong ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>{lbl}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                      })()
                    : <span className="text-gray-300 text-xs">—</span>}
              </td>
              {/* Nội dung thi đấu */}
              <td className="px-4 py-3">
                {s.registration_content && s.registration_content.length > 0
                  ? <div className="flex flex-wrap gap-1">
                      {s.registration_content.map((item, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium whitespace-nowrap">
                          {item}
                        </span>
                      ))}
                    </div>
                  : s.compete_events && s.compete_events.length > 0
                    ? <div className="flex flex-wrap gap-1">
                        {s.compete_events.map(e => (
                          <span key={e} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium whitespace-nowrap">
                            {eventLabel(e)}
                          </span>
                        ))}
                      </div>
                    : <span className="text-gray-300 text-xs">—</span>}
              </td>
              {/* Hạng cân */}
              <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">
                    {s.registration_weight_class_name ?? weightLabel(s)}
                  </span>
                  {canVerifyWeight ? (
                    <button
                      title={s.weight_verified ? 'Đã xác nhận hạng cân — nhấn để bỏ xác nhận' : 'Chưa xác nhận — nhấn để xác nhận'}
                      disabled={verifyMut.isPending}
                      onClick={() => verifyMut.mutate({ id: s.id, value: !s.weight_verified })}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        s.weight_verified
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-300 hover:border-green-400'
                      } disabled:opacity-40`}
                    >
                      {s.weight_verified && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ) : (
                    <span
                      title={s.weight_verified ? 'Đã xác nhận hạng cân' : 'Chưa xác nhận hạng cân'}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        s.weight_verified
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      {s.weight_verified && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {(!canEdit || canEdit(s)) && (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onEdit?.(s.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      aria-label="Sửa">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(s.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Xoá">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
