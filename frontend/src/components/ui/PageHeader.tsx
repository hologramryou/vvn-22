import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Action buttons / controls rendered on the right */
  actions?: ReactNode
  /** Extra content below title row (e.g. filter chips) */
  below?: ReactNode
}

export function PageHeader({ title, subtitle, actions, below }: PageHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {below && <div className="mt-3">{below}</div>}
    </div>
  )
}
