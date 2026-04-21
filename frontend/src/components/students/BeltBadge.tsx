import { BELT_STYLE } from '../../lib/constants'

export const BeltBadge = ({ belt }: { belt: string }) => {
  const style = BELT_STYLE[belt] ?? { bg: 'bg-gray-200', text: 'text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${style.bg} ${style.text}`}>
      {belt}
    </span>
  )
}
