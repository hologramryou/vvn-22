import { Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  message: string
  sub?: string
  icon?: LucideIcon
  action?: React.ReactNode
  /** 'page' = full page center, 'card' = dashed border box */
  variant?: 'page' | 'card'
}

export function EmptyState({ message, sub, icon: Icon = Trophy, action, variant = 'card' }: EmptyStateProps) {
  if (variant === 'page') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Icon size={40} className="text-slate-300" />
        <p className="text-sm text-slate-500">{message}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
        {action}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-14 text-center">
      <Icon size={40} className="mx-auto mb-3 text-slate-300" />
      <p className="text-sm text-slate-500">{message}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
