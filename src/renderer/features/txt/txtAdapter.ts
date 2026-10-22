import { BookData, ReaderLocation, ReaderSettings, Theme, TocItem } from '../../../shared/types'
import { ReaderAdapter } from '../reader/readerAdapter'
import { BLOCK_CHARS } from './txtToc'

interface TxtBlock {
  /** First character offset (inclusive) covered by this block. */
  start: number
  el: HTMLDivElement
}

/**
 * Renders decoded TXT text into a scrollable element. The text is grouped into
 * bounded "blocks" of consecutive lines so charOffset -> element mapping stays
 * O(log n) and a huge file never produces an unbounded DOM tree.
 */
export class TxtAdapter implements ReaderAdapter {
  onLocationChange: ((location: ReaderLocation) => void) | null = null

  private container: HTMLElement | null = null
  private scrollEl: HTMLDivElement | null = null
  private totalChars = 0
  private blocks: TxtBlock[] = []
  private starts: number[] = []
  private tops: number[] = []
  private scrollTimer: number | null = null

  async open(data: BookData, element: HTMLElement): Promise<void> {
    const text = data.text ?? ''
    this.container = element
    this.totalChars = text.length

    element.innerHTML = ''
    const scroll = document.createElement('div')
    scroll.className = 'txt-scroll'
    element.appendChild(scroll)
    this.scrollEl = scroll

    this.renderBlocks(scroll, text)
    scroll.addEventListener('scroll', this.handleScroll, { passive: true })
  }

  async goToItem(item: TocItem): Promise<void> {
    if (item.charOffset == null) return
    this.measure()
    this.scrollToChar(item.charOffset)
  }

  async goToLocation(location: ReaderLocation): Promise<void> {
    if (location.charOffset != null) {
      this.measure()
      this.scrollToChar(location.charOffset)
    }
  }

  currentLocation(): ReaderLocation | null {
    if (this.totalChars === 0) return { charOffset: 0, percent: 0 }
    if (!this.scrollEl) return null
    const idx = this.findBlockIndexByTop(this.scrollEl.scrollTop)
    const charOffset = idx >= 0 ? this.blocks[idx].start : 0
    return { charOffset, percent: this.percentAt(charOffset) }
  }

  applyTypography(settings: ReaderSettings): void {
    const scroll = this.scrollEl
    if (!scroll) return
    const prevChar = this.currentLocation()?.charOffset ?? 0
    scroll.style.fontSize = `${settings.fontSize}px`
    scroll.style.lineHeight = String(settings.lineHeight)
    this.measure()
    this.scrollToChar(prevChar)
  }

  /**
   * TXT is rendered directly in the page (not an iframe), so it already reads
   * the theme CSS variables (`--reader-text` / `--reader-bg`). No per-content
   * injection is needed; this exists only to satisfy the {@link ReaderAdapter}
   * contract so the React layer never branches on format.
   */
  applyTheme(_theme: Theme): void {}

  resize(): void {
    const prevChar = this.currentLocation()?.charOffset ?? 0
    this.measure()
    this.scrollToChar(prevChar)
  }

  destroy(): void {
    this.onLocationChange = null
    if (this.scrollTimer != null) window.clearTimeout(this.scrollTimer)
    if (this.scrollEl) this.scrollEl.removeEventListener('scroll', this.handleScroll)
    this.scrollEl = null
    this.container = null
    this.blocks = []
    this.starts = []
    this.tops = []
  }

  private renderBlocks(scroll: HTMLDivElement, text: string): void {
    this.blocks = []
    this.starts = []
    if (text.length === 0) return

    const len = text.length
    let lineStart = 0
    let blockStart = 0
    let buf: string[] = []
    let bufChars = 0

    const flush = (): void => {
      if (buf.length === 0) return
      const div = document.createElement('div')
      div.className = 'txt-block'
      div.textContent = buf.join('\n')
      scroll.appendChild(div)
      this.blocks.push({ start: blockStart, el: div })
      this.starts.push(blockStart)
      buf = []
      bufChars = 0
    }

    while (lineStart <= len) {
      const nl = text.indexOf('\n', lineStart)
      const lineEnd = nl === -1 ? len : nl
      let line = text.slice(lineStart, lineEnd)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      buf.push(line)
      bufChars += line.length

      if (nl === -1) break

      lineStart = nl + 1
      if (bufChars >= BLOCK_CHARS) {
        flush()
        blockStart = lineStart
      }
    }
    flush()
    this.measure()
  }

  private measure(): void {
    this.tops = this.blocks.map((b) => b.el.offsetTop)
  }

  private scrollToChar(charOffset: number): void {
    if (!this.scrollEl || this.starts.length === 0) return
    const idx = this.findBlockIndexByOffset(charOffset)
    if (idx < 0) return
    this.scrollEl.scrollTop = this.tops[idx]
  }

  private findBlockIndexByOffset(charOffset: number): number {
    return this.binarySearch(this.starts, charOffset)
  }

  private findBlockIndexByTop(scrollTop: number): number {
    return this.binarySearch(this.tops, scrollTop)
  }

  private binarySearch(values: number[], target: number): number {
    let lo = 0
    let hi = values.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (values[mid] <= target) {
        ans = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return ans
  }

  private percentAt(charOffset: number): number {
    if (this.totalChars === 0) return 0
    return Math.min(100, Math.round((charOffset / this.totalChars) * 1000) / 10)
  }

  private handleScroll = (): void => {
    if (this.scrollTimer != null) return
    this.scrollTimer = window.setTimeout(() => {
      this.scrollTimer = null
      const loc = this.currentLocation()
      if (loc) this.onLocationChange?.(loc)
    }, 120)
  }
}
