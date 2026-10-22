import ePub, { Book, EpubLocation, Rendition } from 'epubjs'
import { BookData, ReaderLocation, ReaderSettings, Theme, TocItem } from '../../../shared/types'
import { ReaderAdapter } from '../reader/readerAdapter'
import { READER_THEME_COLORS } from '../theme/themeColors'

/**
 * CSP injected into each rendered section as defense-in-depth. The iframe is
 * already sandboxed without `allow-scripts`, so scripts never run; this blocks
 * them at the CSP layer too while keeping styles/images/fonts available.
 */
const CONTENT_CSP =
  "default-src * data: blob:; style-src 'unsafe-inline' * data: blob:; img-src * data: blob:; font-src * data: blob:; media-src * data: blob:; script-src 'none'; object-src 'none'"

const THEME_STYLE_ID = 'reader-theme'

function injectCspMeta(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_CSP}"/>`
  return html.replace(/<head[^>]*>/i, (match) => match + meta)
}

/** Build the inline CSS that themes the reader body + exposes theme variables. */
function buildThemeStyle(theme: Theme): string {
  const c = READER_THEME_COLORS[theme]
  return (
    `:root{--reader-bg:${c.background};--reader-text:${c.text};--link:${c.link};}` +
    `html,body{background:${c.background} !important;color:${c.text} !important;}`
  )
}

function injectThemeStyleIntoHtml(html: string, theme: Theme): string {
  const style = `<style id="${THEME_STYLE_ID}">${buildThemeStyle(theme)}</style>`
  return html.replace(/<head[^>]*>/i, (match) => match + style)
}

/** Update (or create) the theme `<style>` inside a live iframe document. */
function injectThemeIntoDocument(doc: Document, theme: Theme): void {
  let style = doc.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = THEME_STYLE_ID
    doc.head.appendChild(style)
  }
  style.textContent = buildThemeStyle(theme)
}

/**
 * EPUB implementation of {@link ReaderAdapter}, wrapping an epub.js `Book` +
 * `Rendition` and keeping the epub.js boundary isolated from the React layer.
 */
export class EpubAdapter implements ReaderAdapter {
  onLocationChange: ((location: ReaderLocation) => void) | null = null

  private book: Book | null = null
  private rendition: Rendition | null = null
  private theme: Theme = 'day'

  async open(data: BookData, element: HTMLElement): Promise<void> {
    if (!data.arrayBuffer) throw new Error('缺少 EPUB 数据。')
    const book = ePub(data.arrayBuffer)
    this.book = book
    await book.ready

    // Inject the CSP meta + theme style into each section before it is written
    // to the iframe, so every rendered section is themed and sandboxed.
    try {
      book.spine.hooks.serialize.register((output, section) => {
        // epub.js serialize hooks mutate `section.output` rather than returning.
        const withCsp = injectCspMeta(output)
        ;(section as { output?: string }).output = injectThemeStyleIntoHtml(withCsp, this.theme)
      })
    } catch {
      // Non-fatal: the iframe sandbox already blocks scripts.
    }

    const rendition = book.renderTo(element, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false,
      allowPopups: false
    })
    this.rendition = rendition

    rendition.on('relocated', (location: EpubLocation) => {
      const start = location && location.start
      if (!start || !start.href) return
      this.onLocationChange?.({
        href: start.href,
        cfi: start.cfi,
        percent: typeof start.percentage === 'number' ? start.percentage : 0
      })
    })

    await rendition.display()
  }

  async goToItem(item: TocItem): Promise<void> {
    if (!this.rendition) return
    if (item.href) await this.rendition.display(item.href)
  }

  async goToLocation(location: ReaderLocation): Promise<void> {
    if (!this.rendition) return
    const target = location.cfi ?? location.href
    if (target) await this.rendition.display(target)
  }

  currentLocation(): ReaderLocation | null {
    const location = this.rendition?.currentLocation()
    if (!location || !location.start) return null
    return {
      href: location.start.href,
      cfi: location.start.cfi,
      percent: typeof location.start.percentage === 'number' ? location.start.percentage : 0
    }
  }

  /** Apply font size + line height and re-render the current position so it reflows. */
  applyTypography(settings: ReaderSettings): void {
    const rendition = this.rendition
    if (!rendition) return
    rendition.themes.fontSize(`${settings.fontSize}px`)
    rendition.themes.override('line-height', String(settings.lineHeight))
    const location = rendition.currentLocation()
    if (location && location.start && location.start.cfi) {
      void rendition.display(location.start.cfi)
    }
  }

  /** Re-theme the live iframe without reloading the book or resetting typography. */
  applyTheme(theme: Theme): void {
    this.theme = theme
    const rendition = this.rendition
    if (!rendition) return
    for (const content of rendition.getContents()) {
      injectThemeIntoDocument(content.document, theme)
    }
  }

  /** Re-measure the container (used after the reading area width changes). */
  resize(): void {
    this.rendition?.resize()
  }

  destroy(): void {
    this.onLocationChange = null
    if (this.rendition) {
      this.rendition.destroy()
      this.rendition = null
    }
    if (this.book) {
      this.book.destroy()
      this.book = null
    }
  }
}
