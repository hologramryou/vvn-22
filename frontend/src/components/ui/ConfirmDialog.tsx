import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

const VARIANT_BTN: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  danger:  'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  default: 'bg-[var(--color-primary,#1d4ed8)] hover:opacity-90 text-white',
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy',
  variant = 'danger', onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" disableOverlayClose={loading}>
      <div className="flex gap-3">
        <span className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </span>
        <div>
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${VARIANT_BTN[variant]}`}
        >
          {loading ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
