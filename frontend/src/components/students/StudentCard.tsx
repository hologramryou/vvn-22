import { Trash2, Pencil } from 'lucide-react'
import { eventLabel, categoryLabel } from '../../lib/constants'
import type { StudentListItem } from '../../types/student'

interface Props {
  student: StudentListItem
  onDelete: (id: number) => void
  onEdit?: (id: number) => void
  canEdit?: boolean
}

export const StudentCard = ({ student, onDelete, onEdit, canEdit = true }: Props) => {
  const weights = student.registration_weight_class_name
    ?? (student.weight_classes?.length
      ? student.weight_classes.map(v => `${v} kg`).join(', ')
      : student.weight_class ? `${student.weight_class} kg` : null)

  const categoryBadge = student.registration_category
    ?? (student.category_type && student.category_loai
      ? categoryLabel(student.category_type, student.category_loai)
      : null)

  const contentItems = student.registration_content
    ?? student.compete_events?.map(eventLabel)
    ?? []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 active:bg-gray-50">
      <div className="w-11 h-11 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center font-bold text-blue-700 text-lg mt-0.5 overflow-hidden">
        {student.avatar_url
          ? <img src={student.avatar_url} alt="" className="w-full h-full object-cover" />
          : student.full_name.charAt(0)
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{student.full_name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">{student.code} · {student.club_name ?? '—'}</span>
          {categoryBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700">
              {categoryBadge}
            </span>
          )}
        </div>

        {weights && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">{weights}</span>
          </div>
        )}

        {contentItems.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {contentItems.map(item => (
              <span key={item} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button
            onClick={() => onEdit?.(student.id)}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Sửa"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(student.id)}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Xoá"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
