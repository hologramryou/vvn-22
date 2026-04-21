import { filterChip } from '../../styles/tokens'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function FilterChip({ label, active, onClick, disabled, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        filterChip.base,
        active ? filterChip.active : filterChip.inactive,
        disabled ? filterChip.disabled : '',
        className ?? '',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
