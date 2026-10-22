// Generates sample EPUB fixtures for manual acceptance testing.
// Run: node scripts/generate-samples.mjs
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'samples')
mkdirSync(outDir, { recursive: true })

const chapter = (id, title, extra = '') =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title></head>
<body>
  <h1${extra ? ` id="${extra}"` : ''}>${title}</h1>
  <p>这是「${title}」的正文内容。用于验证 EPUB 解析、目录跳转与进度恢复。</p>
  <p>第二段，包含中文标点、数字 123 与符号 &amp; % # 等。</p>
</body>
</html>`

const container = (opfPath) =>
  `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

const mimetype = 'application/epub+zip'

async function writeEpub(name, files) {
  const zip = new JSZip()
  zip.file('mimetype', mimetype, { compression: 'STORE' })
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }
  const buf = await zip.generateAsync({ type: 'uint8array', mimeType: mimetype, compression: 'DEFLATE' })
  writeFileSync(join(outDir, name), buf)
  console.log('wrote', name)
}

const chapters = (n, base = 1) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `OEBPS/chapter${base + i}.xhtml`,
      chapter(`ch${base + i}`, `第${base + i}章 标题`)
    ])
  )

// 1. EPUB2 with NCX
await writeEpub('sample-epub2-ncx.epub', {
  'META-INF/container.xml': container('OEBPS/content.opf'),
  'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:epub2-ncx</dc:identifier>
    <dc:title>EPUB2 NCX 示例</dc:title>
    <dc:language>zh</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`,
  'OEBPS/toc.ncx': `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="np1"><navLabel><text>第一章 启程</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint id="np2"><navLabel><text>第二章 深入</text></navLabel><content src="chapter2.xhtml"/></navPoint>
  </navMap>
</ncx>`,
  'OEBPS/chapter1.xhtml': chapter('ch1', '第一章 启程'),
  'OEBPS/chapter2.xhtml': chapter('ch2', '第二章 深入')
})

// 2. EPUB3 with nav.xhtml (nested)
await writeEpub('sample-epub3-nav.epub', {
  'META-INF/container.xml': container('OEBPS/content.opf'),
  'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:epub3-nav</dc:identifier>
    <dc:title>EPUB3 nav 示例</dc:title>
    <dc:language>zh</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`,
  'OEBPS/nav.xhtml': `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body><nav epub:type="toc"><h1>目录</h1><ol>
  <li><a href="chapter1.xhtml">第一篇 基础</a><ol><li><a href="chapter1.xhtml#s1">1.1 小节</a></li></ol></li>
  <li><a href="chapter2.xhtml">第二篇 进阶</a></li>
</ol></nav></body></html>`,
  'OEBPS/chapter1.xhtml': chapter('ch1', '第一篇 基础', 's1'),
  'OEBPS/chapter2.xhtml': chapter('ch2', '第二篇 进阶')
})

// 3. No TOC, only headings in body
await writeEpub('sample-no-toc-headings.epub', {
  'META-INF/container.xml': container('OEBPS/content.opf'),
  'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:no-toc</dc:identifier>
    <dc:title>无目录（标题回退）示例</dc:title>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>`,
  'OEBPS/chapter1.xhtml': chapter('ch1', '第一节 标题'),
  'OEBPS/chapter2.xhtml': chapter('ch2', '第二节 标题')
})

// 4. Chinese + special characters + empty title
await writeEpub('sample-chinese-special.epub', {
  'META-INF/container.xml': container('OEBPS/content.opf'),
  'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:special</dc:identifier>
    <dc:title>中文与特殊字符</dc:title>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/></spine>
</package>`,
  'OEBPS/toc.ncx': `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint><navLabel><text>第一章 “引号” &amp; 特殊 &lt;字符&gt;</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint><navLabel><text>  </text></navLabel><content src="chapter1.xhtml#s1"/></navPoint>
  </navMap>
</ncx>`,
  'OEBPS/chapter1.xhtml': chapter('ch1', '中文与特殊字符', 's1')
})

// 5. Larger book (30 chapters)
{
  const n = 30
  const items = Array.from({ length: n }, (_, i) => `    <item id="ch${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')
  const itemrefs = Array.from({ length: n }, (_, i) => `    <itemref idref="ch${i + 1}"/>`).join('\n')
  const navPoints = Array.from({ length: n }, (_, i) => `    <navPoint id="np${i + 1}"><navLabel><text>第${i + 1}章</text></navLabel><content src="chapter${i + 1}.xhtml"/></navPoint>`).join('\n')
  await writeEpub('sample-large-30chapters.epub', {
    'META-INF/container.xml': container('OEBPS/content.opf'),
    'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:large</dc:identifier>
    <dc:title>大书示例（30 章）</dc:title>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${items}
  </manifest>
  <spine toc="ncx">
${itemrefs}
  </spine>
</package>`,
    'OEBPS/toc.ncx': `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
${navPoints}
  </navMap>
</ncx>`,
    ...chapters(n, 1)
  })
}

console.log('done')
