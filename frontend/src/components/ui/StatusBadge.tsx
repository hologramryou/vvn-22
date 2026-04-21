const BADGE_STYLE: Record<string, string> = {
  pending:   'bg-slate-100 text-slate-600 border border-slate-200',
  ready:     'bg-blue-50 text-blue-700 border border-blue-200',
  checking:  'bg-amber-50 text-amber-700 border border-amber-200',
  ongoing:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  active:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  scoring:   'bg-violet-50 text-violet-700 border border-violet-200',
  completed: 'bg-sky-50 text-sky-700 border border-sky-200',
  inactive:  'bg-slate-100 text-slate-500 border border-slate-200',
  cancelled: 'bg-red-50 text-red-600 border border-red-200',
}

const BADGE_LABEL: Record<string, string> = {
  pending:   'Chờ',
  ready:     'Sẵn sàng',
  checking:  'Đang thi đấu',
  ongoing:   'Đang diễn ra',
  active:    'Hoạt động',
  scoring:   'Đang chấm',
  completed: 'Kết thúc',
  inactive:  'Ngừng hoạt động',
  cancelled: 'Đã hủy',
}

interface StatusBadgeProps {
  status: string
  label?: string
  pulse?: boolean
  className?: string
}

export function StatusBadge({ status, label, pulse, className }: StatusBadgeProps) {
  const style = BADGE_STYLE[status] ?? 'bg-slate-100 text-slate-500 border border-slate-200'
  const text = label ?? BADGE_LABEL[status] ?? status
  const shouldPulse = pulse ?? (status === 'ongoing' || status === 'checking')

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style} ${className ?? ''}`}>
      {shouldPulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
      )}
      {text}
    </span>
  )
}
