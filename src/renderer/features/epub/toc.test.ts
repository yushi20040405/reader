// @vitest-environment jsdom
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  buildToc,
  extractHeadings,
  findCurrentTocPath,
  parseContainerXml,
  parseNavDocument,
  parseNcx,
  parseOpf
} from './toc'

function opfXml(options: {
  version?: string
  title?: string
  ncxId?: string
  navProperties?: boolean
  chapters?: Array<{ id: string; href: string }>
  extraManifest?: string[]
}): string {
  const version = options.version ?? '2.0'
  const title = options.title ?? '示例书'
  const chapters = options.chapters ?? [
    { id: 'ch1', href: 'chapter1.xhtml' },
    { id: 'ch2', href: 'chapter2.xhtml' }
  ]
  const extraManifest = options.extraManifest ?? []
  const manifestItems = [
    ...chapters.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
    ...extraManifest
  ].join('\n')
  const spineItems = chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:test</dc:identifier>
    <dc:title>${title}</dc:title>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="${options.ncxId ?? ''}">
    ${spineItems}
  </spine>
</package>`
}

async function makeZip(files: Record<string, string>): Promise<JSZip> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }
  return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }))
}

describe('parseContainerXml', () => {
  it('finds the OPF full-path', () => {
    const xml = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    expect(parseContainerXml(xml)).toBe('OEBPS/content.opf')
  })
})

describe('parseOpf', () => {
  it('extracts spine, title, ncx and nav', () => {
    const info = parseOpf(
      opfXml({
        version: '3.0',
        ncxId: 'ncx',
        navProperties: true,
        extraManifest: [
          '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
          '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        ]
      })
    )
    expect(info.title).toBe('示例书')
    expect(info.spine).toEqual(['chapter1.xhtml', 'chapter2.xhtml'])
    expect(info.ncxHref).toBe('toc.ncx')
    expect(info.navHref).toBe('nav.xhtml')
  })
})

describe('parseNcx', () => {
  it('parses nested navPoints with prefixed namespace', () => {
    const ncx = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="np1">
      <navLabel><text>第一章 开始</text></navLabel>
      <content src="chapter1.xhtml"/>
      <navPoint id="np1_1">
        <navLabel><text>1.1 小节</text></navLabel>
        <content src="chapter1.xhtml#sec1"/>
      </navPoint>
    </navPoint>
    <navPoint id="np2">
      <navLabel><text></text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
    const items = parseNcx(ncx)
    expect(items).toHaveLength(2)
    expect(items[0].label).toBe('第一章 开始')
    expect(items[0].children).toHaveLength(1)
    expect(items[0].children[0].href).toBe('chapter1.xhtml#sec1')
    expect(items[1].label).toBe('(无标题)')
  })
})

describe('parseNavDocument', () => {
  it('parses nested nav list', () => {
    const nav = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chapter1.xhtml">第一章</a>
          <ol><li><a href="chapter1.xhtml#s1">第一节</a></li></ol>
        </li>
        <li><a href="chapter2.xhtml">第二章 &amp; 特殊字符</a></li>
      </ol>
    </nav>
  </body>
</html>`
    const items = parseNavDocument(nav)
    expect(items).toHaveLength(2)
    expect(items[0].children).toHaveLength(1)
    expect(items[1].label).toBe('第二章 & 特殊字符')
  })
})

describe('extractHeadings', () => {
  it('extracts h1-h3 with ids and empty-title fallback', () => {
    const html = `<html><body>
      <h1>标题一</h1>
      <h2 id="sub">子标题</h2>
      <h3>  </h3>
    </body></html>`
    const headings = extractHeadings(html)
    expect(headings).toEqual([
      { label: '标题一', fragment: '' },
      { label: '子标题', fragment: '#sub' },
      { label: '(无标题)', fragment: '' }
    ])
  })
})

describe('buildToc', () => {
  it('prefers EPUB3 nav over NCX', async () => {
    const zip = await makeZip({
      'META-INF/container.xml': `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
      'OEBPS/content.opf': opfXml({
        version: '3.0',
        ncxId: 'ncx',
        extraManifest: [
          '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
          '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'
        ]
      }),
      'OEBPS/nav.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">导航章</a></li></ol></nav></body></html>`,
      'OEBPS/toc.ncx': `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint><navLabel><text>NCX章</text></navLabel><content src="chapter1.xhtml"/></navPoint></navMap></ncx>`,
      'OEBPS/chapter1.xhtml': '<html><body><h1>第一章</h1></body></html>',
      'OEBPS/chapter2.xhtml': '<html><body><h1>第二章</h1></body></html>'
    })
    const result = await buildToc(zip)
    expect(result.source).toBe('nav')
    expect(result.items[0].label).toBe('导航章')
  })

  it('falls back to NCX for EPUB2', async () => {
    const zip = await makeZip({
      'META-INF/container.xml': `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
      'content.opf': opfXml({
        version: '2.0',
        ncxId: 'ncx',
        extraManifest: ['<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>']
      }),
      'toc.ncx': `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint><navLabel><text>第二章</text></navLabel><content src="chapter2.xhtml"/></navPoint></navMap></ncx>`,
      'chapter1.xhtml': '<html><body><h1>第一章</h1></body></html>',
      'chapter2.xhtml': '<html><body><h1>第二章</h1></body></html>'
    })
    const result = await buildToc(zip)
    expect(result.source).toBe('ncx')
    expect(result.items[0].label).toBe('第二章')
    expect(result.items[0].href).toBe('chapter2.xhtml')
  })

  it('falls back to headings when no NCX/nav exist', async () => {
    const zip = await makeZip({
      'META-INF/container.xml': `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
      'content.opf': opfXml({ version: '3.0' }),
      'chapter1.xhtml': '<html><body><h1>第一章</h1></body></html>',
      'chapter2.xhtml': '<html><body><h2>第二章</h2></body></html>'
    })
    const result = await buildToc(zip)
    expect(result.source).toBe('headings')
    expect(result.items.map((i) => i.label)).toEqual(['第一章', '第二章'])
    expect(result.items[0].href).toBe('chapter1.xhtml')
  })
})

describe('findCurrentTocPath', () => {
  it('finds the matching chapter path', () => {
    const items = parseNcx(`<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>
      <navPoint><navLabel><text>一</text></navLabel><content src="a.xhtml"/>
        <navPoint><navLabel><text>一.一</text></navLabel><content src="a.xhtml#s"/></navPoint>
      </navPoint>
      <navPoint><navLabel><text>二</text></navLabel><content src="b.xhtml"/></navPoint>
    </navMap></ncx>`)
    expect(findCurrentTocPath(items, 'b.xhtml')).toEqual([1])
  })
})
