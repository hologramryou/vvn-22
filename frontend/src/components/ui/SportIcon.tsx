interface Props {
  icon: string | null | undefined
  className?: string
}

function BeltIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      {/* left strap */}
      <path d="M0 22 L52 28 L52 34 L0 40 Z" fill="#1a56db" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
      {/* right strap */}
      <path d="M68 28 L120 20 L120 28 L68 34 Z" fill="#1a56db" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
      {/* knot center */}
      <path d="M48 18 L72 18 L72 44 L48 44 Z" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M52 22 L68 22 L68 40 L52 40 Z" fill="#1a56db" />
      <line x1="60" y1="18" x2="60" y2="44" stroke="#60a5fa" strokeWidth="1" opacity="0.6" />
      {/* yellow stripes on left tip */}
      <rect x="4" y="25" width="12" height="3" fill="#facc15" rx="0.5" />
      <rect x="4" y="30" width="12" height="3" fill="#facc15" rx="0.5" />
    </svg>
  )
}

export function SportIcon({ icon, className = 'w-8 h-6' }: Props) {
  if (!icon) return null
  if (icon === 'BELT') return <BeltIcon className={className} />
  // emoji: ignore width/height classes, use font-size instead
  return <span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{icon}</span>
}
