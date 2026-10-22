import { useCallback, useMemo, useState } from 'react'
import { TocItem } from '../../../shared/types'
import { filterToc } from '../../features/reader/tocFilter'

interface TocPanelProps {
  items: TocItem[]
  /** Tree path (child indices) of the currently active item. */
  activePath: number[] | null
  onJump: (item: TocItem) => void
  /**
   * Optional per-item progress hint (0-100). Return null to hide the hint for
   * that item — callers should return null rather than fabricate a number.
   */
  itemProgress?: (item: TocItem) => number | null
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function TocPanel({ items, activePath, onJump, itemProgress }: TocPanelProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtering = query.trim().length > 0
  const visibleItems = useMemo(() => filterToc(items, query), [items, query])

  // Ancestors of the active item are auto-expanded so it stays visible.
  const activeAncestors = useMemo(() => {
    const set = new Set<string>()
    if (activePath && activePath.length > 1) {
      for (let i = 1; i < activePath.length; i++) {
        set.add(activePath.slice(0, i).join('.'))
      }
    }
    return set
  }, [activePath])

  // While filtering, force-open every node so matches are visible.
  const isExpanded = useCallback(
    (pathKey: string): boolean => filtering || expanded.has(pathKey) || activeAncestors.has(pathKey),
    [filtering, expanded, activeAncestors]
  )

  const toggle = useCallback((pathKey: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      return next
    })
  }, [])

  return (
    <div className="toc-panel">
      <input
        className="toc-search"
        type="search"
        placeholder="搜索目录…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="搜索目录"
      />
      {visibleItems.length === 0 ? (
        <p className="muted">无匹配章节</p>
      ) : (
        <ul className="toc-tree">
          {visibleItems.map((item, i) => (
            <TocNode
              key={String(i)}
              item={item}
              path={[i]}
              activePath={activePath}
              isExpanded={isExpanded}
              onToggle={toggle}
              onJump={onJump}
              itemProgress={itemProgress}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface TocNodeProps {
  item: TocItem
  path: number[]
  activePath: number[] | null
  isExpanded: (pathKey: string) => boolean
  onToggle: (pathKey: string) => void
  onJump: (item: TocItem) => void
  itemProgress?: (item: TocItem) => number | null
}

function TocNode({ item, path, activePath, isExpanded, onToggle, onJump, itemProgress }: TocNodeProps): JSX.Element {
  const pathKey = path.join('.')
  const hasChildren = item.children.length > 0
  const open = isExpanded(pathKey)
  const isActive = activePath !== null && pathsEqual(path, activePath)
  const progress = itemProgress ? itemProgress(item) : null

  return (
    <li>
      <div
        className={'toc-node-label' + (isActive ? ' is-active' : '')}
        style={{ paddingLeft: `${6 + path.length * 14}px` }}
      >
        <button
          className="toc-caret"
          aria-label={open ? '折叠' : '展开'}
          onClick={() => onToggle(pathKey)}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {open ? '▾' : '▸'}
        </button>
        <button className="toc-node-text" onClick={() => onJump(item)} title={item.label}>
          {item.label}
        </button>
        {progress != null && <span className="toc-progress">{progress}%</span>}
      </div>
      {hasChildren && open && (
        <ul className="toc-tree">
          {item.children.map((child, i) => (
            <TocNode
              key={`${pathKey}.${i}`}
              item={child}
              path={[...path, i]}
              activePath={activePath}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onJump={onJump}
              itemProgress={itemProgress}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
