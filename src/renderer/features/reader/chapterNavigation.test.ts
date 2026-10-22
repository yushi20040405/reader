import { describe, expect, it } from 'vitest'
import { ReaderLocation, TocItem } from '../../../shared/types'
import {
  findCurrentIndex,
  findCurrentPath,
  flattenLinear,
  nextItem,
  prevItem
} from './chapterNavigation'

function tocItem(id: string, opts: Partial<TocItem> = {}): TocItem {
  return { id, label: id, level: 0, children: [], ...opts }
}

const tree: TocItem[] = [
  tocItem('a', {
    href: 'a.xhtml',
    children: [tocItem('a1', { href: 'a.xhtml#s1' }), tocItem('a2', { href: 'a.xhtml#s2' })]
  }),
  tocItem('b', { href: 'b.xhtml' }),
  tocItem('c', { href: 'c.xhtml' })
]

describe('flattenLinear', () => {
  it('returns document-order list including children', () => {
    expect(flattenLinear(tree).map((i) => i.id)).toEqual(['a', 'a1', 'a2', 'b', 'c'])
  })
})

describe('findCurrentIndex', () => {
  it('matches EPUB by href ignoring fragment', () => {
    const loc: ReaderLocation = { href: 'b.xhtml', percent: 50 }
    expect(findCurrentIndex(tree, loc)).toBe(3)
  })

  it('matches TXT by charOffset against ascending offsets', () => {
    const txt: TocItem[] = [
      tocItem('c1', { charOffset: 0 }),
      tocItem('c2', { charOffset: 100 }),
      tocItem('c3', { charOffset: 200 })
    ]
    const loc: ReaderLocation = { charOffset: 150, percent: 50 }
    expect(findCurrentIndex(txt, loc)).toBe(1)
  })

  it('returns -1 when nothing matches', () => {
    expect(findCurrentIndex(tree, { href: 'nope.xhtml', percent: 0 })).toBe(-1)
    expect(findCurrentIndex(tree, null)).toBe(-1)
  })
})

describe('findCurrentPath', () => {
  it('returns nested path for EPUB child item', () => {
    expect(findCurrentPath(tree, { href: 'a.xhtml#s2', percent: 10 })).toEqual([0, 1])
  })

  it('returns flat index for TXT', () => {
    const txt: TocItem[] = [
      tocItem('c1', { charOffset: 0 }),
      tocItem('c2', { charOffset: 100 })
    ]
    expect(findCurrentPath(txt, { charOffset: 100, percent: 50 })).toEqual([1])
  })

  it('returns null for no match', () => {
    expect(findCurrentPath(tree, { href: 'missing.xhtml', percent: 0 })).toBeNull()
  })
})

describe('nextItem / prevItem', () => {
  it('moves to next and previous chapter', () => {
    const atB: ReaderLocation = { href: 'b.xhtml', percent: 50 }
    expect(nextItem(tree, atB)?.id).toBe('c')
    expect(prevItem(tree, atB)?.id).toBe('a2')
  })

  it('returns null at the ends', () => {
    expect(nextItem(tree, { href: 'c.xhtml', percent: 100 })?.id).toBeUndefined()
    expect(prevItem(tree, { href: 'a.xhtml', percent: 0 })).toBeNull()
  })

  it('advances to first chapter when before the start', () => {
    expect(nextItem(tree, null)?.id).toBe('a')
  })
})
