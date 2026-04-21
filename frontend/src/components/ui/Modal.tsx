import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Optional subtitle shown below title */
  subtitle?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  children: ReactNode
  /** Rendered in footer area, right-aligned */
  footer?: ReactNode
  /** Prevent closing by clicking overlay */
  disableOverlayClose?: boolean
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm:    'max-w-sm',
  md:    'max-w-md',
  lg:    'max-w-lg',
  xl:    'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Modal({
  open, onClose, title, subtitle, size = 'md',
  children, footer, disableOverlayClose,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={disableOverlayClose ? undefined : onClose}
      />
      <div className={`relative z-10 w-full ${SIZE[size]} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-primary-dark,#1e3a5f)]">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-[var(--color-primary-dark,#1e3a5f)]/70">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="ml-3 p-1.5 rounded-lg text-[var(--color-primary-dark,#1e3a5f)]/50 hover:text-[var(--color-primary-dark,#1e3a5f)] hover:bg-blue-50 transition-colors shrink-0"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Close button only (no title) */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-[var(--color-primary-dark,#1e3a5f)]/50 hover:text-[var(--color-primary-dark,#1e3a5f)] hover:bg-blue-50 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
