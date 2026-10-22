import { BookData, ReaderLocation, ReaderSettings, Theme, TocItem } from '../../../shared/types'

/**
 * Format-agnostic contract implemented by the EPUB and TXT adapters. The React
 * layer only talks to this interface, so TOC rendering and chapter navigation
 * never branch on format.
 */
export interface ReaderAdapter {
  /** Called whenever the current reading position changes. */
  onLocationChange: ((location: ReaderLocation) => void) | null

  /** Render the book into `element` and report the initial location. */
  open(data: BookData, element: HTMLElement): Promise<void>

  /** Jump to a TOC entry (chapter / section). */
  goToItem(item: TocItem): Promise<void>

  /** Restore a precise location (used for "return to original" and resume). */
  goToLocation(location: ReaderLocation): Promise<void>

  currentLocation(): ReaderLocation | null

  applyTypography(settings: ReaderSettings): void

  /** Apply a theme to the rendered content (iframe for EPUB, no-op for TXT). */
  applyTheme(theme: Theme): void

  resize(): void

  destroy(): void
}
