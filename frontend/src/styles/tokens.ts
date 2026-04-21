// UI Design Tokens — source of truth for all shared styles
// Import from here instead of hardcoding Tailwind classes in components

// Default theme — used as CSS var fallback when no tournament color is set
export const DEFAULT_THEME = {
  primary:      '#1d4ed8', // blue-700
  primaryDark:  '#1e3a5f', // navy table header
  primaryLight: '#eff6ff', // blue-50
  primaryText:  '#ffffff',
} as const

export const color = {
  // Text — không dùng text-slate-* hay text-gray-*
  textPrimary:   'text-[var(--color-primary-dark,#1e3a5f)]',
  textSecondary: 'text-[var(--color-primary-dark,#1e3a5f)]/70',
  textMuted:     'text-[var(--color-primary-dark,#1e3a5f)]/50',
  textOnDark:    'text-white',

  // Background
  pageBg:        'bg-slate-50',
  cardBg:        'bg-white',
  tableHeaderBg: 'bg-gradient-to-r from-[var(--color-primary,#1d4ed8)] to-[var(--color-gradient-primary,#1e3a5f)]',

  // Border
  borderBase:    'border-slate-200',
  borderStrong:  'border-slate-300',
} as const

export const card = {
  base: 'bg-white rounded-2xl border border-slate-200 shadow-sm',
  padSm: 'p-3',
  padMd: 'p-4',
  padLg: 'p-5',
} as const

// Filter / toggle chip button
export const filterChip = {
  base:     'inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
  active:   'bg-[var(--color-primary,#1d4ed8)] text-[var(--color-primary-text,#fff)] border-[var(--color-primary,#1d4ed8)]',
  inactive: 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
  disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
} as const

// Tree path pill colors — rotate by depth level
export const treePathLevels = [
  'bg-blue-50 text-blue-700 border border-blue-200',
  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'bg-amber-50 text-amber-700 border border-amber-200',
  'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
] as const

// Status badge styles are owned by StatusBadge.tsx — do not duplicate here
