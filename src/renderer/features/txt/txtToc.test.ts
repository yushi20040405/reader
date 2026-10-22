// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { buildFallbackToc, buildTxtToc, extractChapters, matchHeading } from './txtToc'

describe('matchHeading', () => {
  it('recognizes numbered chapters/volumes/sections', () => {
    expect(matchHeading('第一章 启程')).toBe('第一章 启程')
    expect(matchHeading('第1章 标题')).toBe('第1章 标题')
    expect(matchHeading('第十二回 风雪山神庙')).toBe('第十二回 风雪山神庙')
    expect(matchHeading('第 十 章')).toBe('第 十 章')
    expect(matchHeading('第三卷')).toBe('第三卷')
  })

  it('recognizes named sections', () => {
    expect(matchHeading('序章')).toBe('序章')
    expect(matchHeading('前言')).toBe('前言')
    expect(matchHeading('后记')).toBe('后记')
    expect(matchHeading('楔子')).toBe('楔子')
    expect(matchHeading('尾声')).toBe('尾声')
  })

  it('rejects non-headings and overly long lines', () => {
    expect(matchHeading('这是一个普通的段落。')).toBeNull()
    expect(matchHeading('')).toBeNull()
    expect(matchHeading('第一章' + '很长的内容'.repeat(20))).toBeNull()
  })
})

describe('extractChapters', () => {
  it('tracks char offsets across CRLF and LF', () => {
    const text = '第一章 开始\r\n正文内容\r\n第二章 继续\n更多内容'
    const chapters = extractChapters(text)
    expect(chapters.map((c) => c.label)).toEqual(['第一章 开始', '第二章 继续'])
    expect(chapters[0].charOffset).toBe(0)
    expect(chapters[1].charOffset).toBe('第一章 开始\r\n正文内容\r\n'.length)
  })
})

describe('buildTxtToc', () => {
  it('uses detected chapters when enough exist', () => {
    const text = '序章\n正文\n第一章\n正文\n第二章\n正文'
    const r = buildTxtToc(text)
    expect(r.mode).toBe('chapters')
    expect(r.items.map((i) => i.label)).toEqual(['序章', '第一章', '第二章'])
  })

  it('falls back to fixed-size sections when no headings', () => {
    const r = buildTxtToc('x'.repeat(12000))
    expect(r.mode).toBe('fallback')
    expect(r.items.length).toBeGreaterThan(1)
    expect(r.items[0].charOffset).toBe(0)
  })

  it('returns empty for empty text', () => {
    expect(buildTxtToc('').items).toEqual([])
  })
})

describe('buildFallbackToc', () => {
  it('splits by 5000 chars', () => {
    const items = buildFallbackToc('a'.repeat(10001))
    expect(items.length).toBe(3)
    expect(items[1].charOffset).toBe(5000)
  })
})
