import JSZip from 'jszip'
import { TocItem } from '../../../shared/types'

export type TocSource = 'ncx' | 'nav' | 'headings'

export interface TocResult {
  items: TocItem[]
  source: TocSource
  title: string
  /** Ordered linear spine hrefs (raw manifest hrefs). */
  spineHrefs: string[]
}

interface ManifestItem {
  href: string
  mediaType: string
  properties: string
}

interface OpfInfo {
  version: string
  title: string
  manifest: Map<string, ManifestItem>
  spine: string[]
  ncxHref: string | null
  navHref: string | null
}

export const EMPTY_LABEL = '(无标题)'

function parser(xml: string, type: DOMParserSupportedType): Document {
  return new DOMParser().parseFromString(xml, type)
}

function isXmlParseError(doc: Document): boolean {
  return doc.getElementsByTagName('parsererror').length > 0
}

/**
 * Find elements by their local name, ignoring any XML namespace prefix
 * (e.g. matches both `<navPoint>` and `<ncx:navPoint>`).
 */
function byLocalName(root: Element | Document, localName: string): Element[] {
  const start: Element | null =
    root.nodeType === 9 ? (root as Document).documentElement : (root as Element)
  if (!start) return []
  const result: Element[] = []
  const stack: Element[] = [start]
  while (stack.length > 0) {
    const el = stack.pop() as Element
    if (el.localName === localName) result.push(el)
    for (let i = el.children.length - 1; i >= 0; i--) stack.push(el.children[i])
  }
  return result
}

function directChildrenByLocalName(el: Element, localName: string): Element[] {
  const lower = localName.toLowerCase()
  return Array.from(el.children).filter((c) => c.localName === localName || c.localName.toLowerCase() === lower)
}

export function normalizePath(path: string): string {
  const parts: string[] = []
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      parts.pop()
      continue
    }
    parts.push(seg)
  }
  return parts.join('/')
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

function splitFragment(href: string): [string, string] {
  const i = href.indexOf('#')
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i)]
}

/** Join an href relative to `baseDir` (both use forward slashes) and normalize. */
export function joinHref(baseDir: string, href: string): string {
  const [pathPart, fragment] = splitFragment(href)
  let p = pathPart
  if (p.startsWith('/')) p = p.slice(1)
  const full = baseDir ? `${baseDir}/${p}` : p
  return normalizePath(full) + fragment
}

/** Resolve a manifest href to a zip entry path, given the OPF path. */
export function resolveZipPath(opfPath: string, href: string): string {
  const [pathPart] = splitFragment(href)
  const baseDir = dirname(opfPath)
  return normalizePath(baseDir ? `${baseDir}/${pathPart}` : pathPart)
}

/** Parse `META-INF/container.xml` and return the OPF full-path. */
export function parseContainerXml(xml: string): string {
  const doc = parser(xml, 'application/xml')
  const rootfiles = byLocalName(doc, 'rootfile')
  for (const el of rootfiles) {
    const mediaType = el.getAttribute('media-type') || ''
    const fullPath = el.getAttribute('full-path')
    if (fullPath && (mediaType === 'application/oebps-package+xml' || mediaType === '')) {
      return fullPath.trim()
    }
  }
  const first = rootfiles[0]?.getAttribute('full-path')
  if (first) return first.trim()
  throw new Error('container.xml 中未找到 OPF 文件路径')
}

/** Parse the OPF (package document) into spine / manifest / ncx / nav info. */
export function parseOpf(xml: string): OpfInfo {
  const doc = parser(xml, 'application/xml')
  if (isXmlParseError(doc)) throw new Error('OPF 文件格式错误')

  const root = doc.documentElement
  const version = root.getAttribute('version') || '2.0'
  const title = byLocalName(doc, 'title')[0]?.textContent?.trim() || ''

  const manifest = new Map<string, ManifestItem>()
  const manifestEl = byLocalName(doc, 'manifest')[0]
  if (manifestEl) {
    for (const it of byLocalName(manifestEl, 'item')) {
      const id = it.getAttribute('id') || ''
      manifest.set(id, {
        href: it.getAttribute('href') || '',
        mediaType: it.getAttribute('media-type') || '',
        properties: it.getAttribute('properties') || ''
      })
    }
  }

  const spine: string[] = []
  let ncxHref: string | null = null
  const spineEl = byLocalName(doc, 'spine')[0]
  if (spineEl) {
    const tocId = spineEl.getAttribute('toc')
    for (const itemref of byLocalName(spineEl, 'itemref')) {
      const idref = itemref.getAttribute('idref') || ''
      const mi = manifest.get(idref)
      if (mi && mi.href) spine.push(mi.href)
    }
    if (tocId) {
      const mi = manifest.get(tocId)
      if (mi) ncxHref = mi.href
    }
  }

  let navHref: string | null = null
  for (const mi of manifest.values()) {
    if (mi.properties && mi.properties.split(/\s+/).includes('nav')) {
      navHref = mi.href
      break
    }
  }
  if (!ncxHref) {
    for (const mi of manifest.values()) {
      if (mi.mediaType === 'application/x-dtbncx+xml') {
        ncxHref = mi.href
        break
      }
    }
  }

  return { version, title, manifest, spine, ncxHref, navHref }
}

function parseNavPoint(el: Element, level: number, counter: { value: number }): TocItem | null {
  const navLabel = byLocalName(el, 'navLabel')[0]
  const text = navLabel ? byLocalName(navLabel, 'text')[0] : undefined
  const label = text?.textContent?.trim() || ''
  const content = byLocalName(el, 'content')[0]
  const src = content?.getAttribute('src') || ''
  if (!src) return null
  const rawId = el.getAttribute('id') || ''
  const id = rawId || `ncx-${counter.value++}`
  const children: TocItem[] = []
  for (const child of directChildrenByLocalName(el, 'navPoint')) {
    const item = parseNavPoint(child, level + 1, counter)
    if (item) children.push(item)
  }
  return { id, label: label || EMPTY_LABEL, level, href: src, children }
}

/** Parse an EPUB2 NCX document (navMap -> navPoint tree). */
export function parseNcx(xml: string): TocItem[] {
  const doc = parser(xml, 'application/xml')
  if (isXmlParseError(doc)) return []
  const navMap = byLocalName(doc, 'navMap')[0]
  if (!navMap) return []
  const items: TocItem[] = []
  const counter = { value: 0 }
  for (const child of directChildrenByLocalName(navMap, 'navPoint')) {
    const item = parseNavPoint(child, 0, counter)
    if (item) items.push(item)
  }
  return items
}

function parseNavList(ol: Element, level: number, counter: { value: number }): TocItem[] {
  const items: TocItem[] = []
  for (const li of directChildrenByLocalName(ol, 'li')) {
    const a = byLocalName(li, 'a')[0]
    const href = a?.getAttribute('href') || ''
    const label = a?.textContent?.trim() || ''
    const rawId = a?.getAttribute('id') || ''
    const id = rawId || `nav-${counter.value++}`
    const childOl = directChildrenByLocalName(li, 'ol')[0]
    items.push({
      id,
      label: label || EMPTY_LABEL,
      level,
      href,
      children: childOl ? parseNavList(childOl, level + 1, counter) : []
    })
  }
  return items
}

/** Parse an EPUB3 nav.xhtml document and extract the TOC `nav` list. */
export function parseNavDocument(xml: string): TocItem[] {
  const doc = parser(xml, 'text/html')
  const navs = byLocalName(doc, 'nav')
  let nav = navs.find((n) => {
    const epubType = n.getAttribute('epub:type') || ''
    return epubType.split(/\s+/).includes('toc') || n.getAttribute('role') === 'doc-toc'
  })
  if (!nav) nav = navs[0]
  if (!nav) return []
  const ol = directChildrenByLocalName(nav, 'ol')[0]
  if (!ol) return []
  return parseNavList(ol, 0, { value: 0 })
}

/** Extract h1-h3 headings from an XHTML spine document. */
export function extractHeadings(html: string): Array<{ label: string; fragment: string }> {
  const doc = parser(html, 'text/html')
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))
  return headings.map((h) => ({
    label: h.textContent?.trim() || EMPTY_LABEL,
    fragment: h.id ? `#${h.id}` : ''
  }))
}

async function readZipEntry(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path)
  if (!file) return null
  try {
    return await file.async('string')
  } catch {
    return null
  }
}

function mapTocHrefs(
  items: TocItem[],
  baseDir: string,
  resolve: (resolved: string) => string
): TocItem[] {
  return items
    .map((item) => {
      if (!item.href) {
        return { ...item, children: mapTocHrefs(item.children, baseDir, resolve) }
      }
      const resolved = joinHref(baseDir, item.href)
      return {
        ...item,
        href: resolve(resolved),
        children: mapTocHrefs(item.children, baseDir, resolve)
      }
    })
    .filter((item) => (item.href ?? '').length > 0)
}

async function buildHeadingsToc(zip: JSZip, opfPath: string, opf: OpfInfo): Promise<TocItem[]> {
  const items: TocItem[] = []
  for (const href of opf.spine) {
    const html = await readZipEntry(zip, resolveZipPath(opfPath, href))
    if (html == null) continue
    for (const h of extractHeadings(html)) {
      items.push({
        id: `heading-${items.length}`,
        label: h.label,
        level: 0,
        href: h.fragment ? `${href}${h.fragment}` : href,
        children: []
      })
    }
  }
  return items
}

/**
 * Build the full TOC for an opened EPUB zip.
 * Preference order: EPUB3 nav.xhtml -> EPUB2 NCX -> headings extracted from spine.
 */
export async function buildToc(zip: JSZip): Promise<TocResult> {
  const containerXml = await readZipEntry(zip, 'META-INF/container.xml')
  if (containerXml == null) {
    throw new Error('不是有效的 EPUB：缺少 META-INF/container.xml')
  }
  const opfPath = parseContainerXml(containerXml)
  const opfXml = await readZipEntry(zip, opfPath)
  if (opfXml == null) throw new Error(`EPUB 中的 OPF 文件缺失：${opfPath}`)
  const opf = parseOpf(opfXml)

  const manifestByNorm = new Map<string, string>()
  for (const mi of opf.manifest.values()) {
    const norm = normalizePath(mi.href)
    if (!manifestByNorm.has(norm)) manifestByNorm.set(norm, mi.href)
  }

  const resolve = (resolved: string): string => {
    const [pathPart, fragment] = splitFragment(resolved)
    const raw = manifestByNorm.get(normalizePath(pathPart))
    if (raw != null) return fragment ? `${raw}${fragment}` : raw
    return resolved
  }

  if (opf.navHref) {
    const navXml = await readZipEntry(zip, resolveZipPath(opfPath, opf.navHref))
    if (navXml != null) {
      const items = mapTocHrefs(parseNavDocument(navXml), dirname(opf.navHref), resolve)
      if (items.length > 0) {
        return { items, source: 'nav', title: opf.title, spineHrefs: opf.spine }
      }
    }
  }

  if (opf.ncxHref) {
    const ncxXml = await readZipEntry(zip, resolveZipPath(opfPath, opf.ncxHref))
    if (ncxXml != null) {
      const items = mapTocHrefs(parseNcx(ncxXml), dirname(opf.ncxHref), resolve)
      if (items.length > 0) {
        return { items, source: 'ncx', title: opf.title, spineHrefs: opf.spine }
      }
    }
  }

  const items = await buildHeadingsToc(zip, opfPath, opf)
  return { items, source: 'headings', title: opf.title, spineHrefs: opf.spine }
}

function hrefPath(href: string): string {
  return href.split('#')[0]
}

/** Find the TOC path (array of child indices) that matches the current section href. */
export function findCurrentTocPath(items: TocItem[], currentHref: string): number[] | null {
  if (!currentHref) return null
  const currentPath = hrefPath(currentHref)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.href && hrefPath(item.href) === currentPath) return [i]
    if (item.children.length > 0) {
      const childPath = findCurrentTocPath(item.children, currentHref)
      if (childPath) return [i, ...childPath]
    }
  }
  return null
}
