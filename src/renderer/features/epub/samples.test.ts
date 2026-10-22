// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { join } from 'path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildToc } from './toc'

const sampleDir = join(process.cwd(), 'samples')

async function loadSample(name: string): Promise<JSZip> {
  const buf = readFileSync(join(sampleDir, name))
  return JSZip.loadAsync(new Uint8Array(buf))
}

describe('generated sample EPUB fixtures', () => {
  it('EPUB2 NCX sample parses', async () => {
    const r = await buildToc(await loadSample('sample-epub2-ncx.epub'))
    expect(r.source).toBe('ncx')
    expect(r.items.map((i) => i.label)).toEqual(['第一章 启程', '第二章 深入'])
  })

  it('EPUB3 nav sample parses nested TOC', async () => {
    const r = await buildToc(await loadSample('sample-epub3-nav.epub'))
    expect(r.source).toBe('nav')
    expect(r.items[0].label).toBe('第一篇 基础')
    expect(r.items[0].children).toHaveLength(1)
  })

  it('headings fallback sample parses', async () => {
    const r = await buildToc(await loadSample('sample-no-toc-headings.epub'))
    expect(r.source).toBe('headings')
    expect(r.items).toHaveLength(2)
  })

  it('chinese + special chars + empty title sample parses', async () => {
    const r = await buildToc(await loadSample('sample-chinese-special.epub'))
    expect(r.source).toBe('ncx')
    expect(r.items[0].label).toContain('特殊')
    expect(r.items[1].label).toBe('(无标题)')
  })

  it('large 30-chapter sample parses', async () => {
    const r = await buildToc(await loadSample('sample-large-30chapters.epub'))
    expect(r.source).toBe('ncx')
    expect(r.items).toHaveLength(30)
  })
})
