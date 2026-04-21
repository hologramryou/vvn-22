import { treePathLevels } from '../../styles/tokens'

interface TreePathPillsProps {
  treePath: string | null
  /** Extra segment appended after treePath segments (e.g. content_name) */
  suffix?: string | null
  size?: 'sm' | 'md'
  className?: string
}

export function TreePathPills({ treePath, suffix, size = 'md', className }: TreePathPillsProps) {
  const segments = treePath ? treePath.split('>').map(s => s.trim()).filter(Boolean) : []
  if (suffix) segments.push(suffix)

  if (segments.length === 0) return <span className="text-slate-400">—</span>

  const pillCls = size === 'sm'
    ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium'
    : 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {segments.map((seg, idx) => (
        <span key={idx} className={`${pillCls} ${treePathLevels[idx % treePathLevels.length]}`}>
          {seg}
        </span>
      ))}
    </div>
  )
}
