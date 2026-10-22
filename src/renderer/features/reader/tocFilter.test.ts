import { describe, expect, it } from 'vitest'
import { TocItem } from '../../../shared/types'
import { filterToc } from './tocFilter'

function tocItem(id: string, label: string, children: TocItem[] = []): TocItem {
  return { id, label, level: 0, children }
}

const tree: TocItem[] = [
  tocItem('a', '第一章 启程', [
    tocItem('a1', '1.1 出发'),
    tocItem('a2', '1.2 路途')
  ]),
  tocItem('b', '第二章 深入', [tocItem('b1', '2.1 探险')]),
  tocItem('c', '第三章 归来')
]

describe('filterToc', () => {
  it('returns the full tree for an empty query', () => {
    expect(filterToc(tree, '')).toBe(tree)
    expect(filterToc(tree, '   ')).toBe(tree)
  })

  it('matches labels case-insensitively', () => {
    const r = filterToc(tree, '启程')
    expect(r.map((i) => i.id)).toEqual(['a'])
  })

  it('keeps ancestors of a matching descendant', () => {
    const r = filterToc(tree, '探险')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('b')
    expect(r[0].children).toHaveLength(1)
    expect(r[0].children[0].id).toBe('b1')
  })

  it('drops non-matching branches entirely', () => {
    const r = filterToc(tree, '归来')
    expect(r.map((i) => i.id)).toEqual(['c'])
  })

  it('returns empty array when nothing matches', () => {
    expect(filterToc(tree, '不存在的章节')).toEqual([])
  })
})
