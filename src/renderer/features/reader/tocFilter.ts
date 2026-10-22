import { TocItem } from '../../../shared/types'

/**
 * Case-insensitive TOC filtering. An item is kept when its own label matches OR
 * any descendant matches, so ancestors stay visible and a match is never
 * orphaned from its parents.
 */
export function filterToc(items: TocItem[], query: string): TocItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items

  const matches = (item: TocItem): boolean =>
    item.label.toLowerCase().includes(q) || item.children.some(matches)

  const filter = (list: TocItem[]): TocItem[] =>
    list
      .map((item) => ({ ...item, children: filter(item.children) }))
      .filter((item) => matches(item))

  return filter(items)
}
