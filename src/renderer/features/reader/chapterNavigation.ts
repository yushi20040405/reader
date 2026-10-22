import { ReaderLocation, TocItem } from '../../../shared/types'

/**
 * Depth-first linear ordering of a TOC tree (document order). Used for
 * previous/next chapter regardless of book format.
 */
export function flattenLinear(items: TocItem[]): TocItem[] {
  const out: TocItem[] = []
  const walk = (list: TocItem[]): void => {
    for (const item of list) {
      out.push(item)
      if (item.children.length > 0) walk(item.children)
    }
  }
  walk(items)
  return out
}

function matchHref(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return a.split('#')[0] === b.split('#')[0]
}

function splitHref(href: string): [path: string, fragment: string] {
  const i = href.indexOf('#')
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i + 1)]
}

/**
 * Index (into the linear ordering) of the item that corresponds to `loc`.
 * Returns -1 when no item matches (e.g. before the first chapter).
 */
export function findCurrentIndex(items: TocItem[], loc: ReaderLocation | null): number {
  if (!loc) return -1
  const linear = flattenLinear(items)

  if (loc.charOffset != null) {
    let idx = -1
    for (let i = 0; i < linear.length; i++) {
      const off = linear[i].charOffset
      if (off == null) continue
      if (off <= loc.charOffset) idx = i
      else break
    }
    return idx
  }

  if (loc.href) {
    return linear.findIndex((it) => matchHref(it.href, loc.href))
  }

  return -1
}

/**
 * Tree path (array of child indices) leading to the active TOC item. TXT TOC is
 * flat, so its path is a single index; EPUB is matched recursively by href.
 */
export function findCurrentPath(items: TocItem[], loc: ReaderLocation | null): number[] | null {
  if (!loc) return null
  if (loc.charOffset != null) {
    const linear = flattenLinear(items)
    const idx = findCurrentIndex(items, loc)
    return idx >= 0 ? [idx] : null
  }
  if (loc.href) {
    return matchHrefPath(items, loc.href)
  }
  return null
}

function matchHrefPath(items: TocItem[], href: string): number[] | null {
  const [path, fragment] = splitHref(href)
  // Prefer an exact `path#fragment` match (deepest subsection), then fall back
  // to matching the section path only (chapter-level highlight).
  return matchExactPath(items, path, fragment) ?? matchPathOnly(items, path)
}

function matchExactPath(items: TocItem[], path: string, fragment: string): number[] | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const [itemPath, itemFragment] = splitHref(item.href ?? '')
    if (itemPath !== path) continue
    if (itemFragment === fragment) return [i]
    if (item.children.length > 0) {
      const child = matchExactPath(item.children, path, fragment)
      if (child) return [i, ...child]
    }
  }
  return null
}

function matchPathOnly(items: TocItem[], path: string): number[] | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (splitHref(item.href ?? '')[0] === path) return [i]
    if (item.children.length > 0) {
      const child = matchPathOnly(item.children, path)
      if (child) return [i, ...child]
    }
  }
  return null
}

/** Next chapter in document order, or null when at the end. */
export function nextItem(items: TocItem[], loc: ReaderLocation | null): TocItem | null {
  const linear = flattenLinear(items)
  const idx = findCurrentIndex(items, loc)
  if (idx < 0) return linear.length > 0 ? linear[0] : null
  return linear[idx + 1] ?? null
}

/** Previous chapter in document order, or null when at the beginning. */
export function prevItem(items: TocItem[], loc: ReaderLocation | null): TocItem | null {
  const linear = flattenLinear(items)
  const idx = findCurrentIndex(items, loc)
  if (idx <= 0) return null
  return linear[idx - 1] ?? null
}
