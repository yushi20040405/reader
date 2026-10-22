/**
 * Types shared between the main process, preload script and renderer.
 * These must stay free of any Node / DOM specific imports so both TS projects can include them.
 */

export type BookFormat = 'epub' | 'txt'

export type Theme = 'day' | 'eye' | 'night'

/** Stable, format-agnostic description of an opened book. */
export interface Book {
  /** Stable identifier derived from the file content (sha256). */
  id: string
  title: string
  format: BookFormat
  filePath: string
  name: string
  size: number
  createdAt: number
  lastReadAt: number
}

/**
 * Unified table-of-contents node. EPUB items carry `href`, TXT items carry
 * `charOffset`; both flow through the same TocPanel and chapter navigation.
 */
export interface TocItem {
  id: string
  label: string
  /** Nesting depth (0 = top level). */
  level: number
  /** EPUB target: manifest href, optionally with a `#fragment`. */
  href?: string
  /** TXT target: character offset into the decoded UTF-8 text. */
  charOffset?: number
  children: TocItem[]
}

/** Persisted reading position, keyed by book id in the main process. */
export interface ReadingProgress {
  cfi?: string
  charOffset?: number
  /** 0 - 100 */
  percent: number
  title: string
  updatedAt: number
}

/** Live reading position reported by a {@link ReaderAdapter}. */
export interface ReaderLocation {
  /** EPUB section href (used for TOC highlighting). */
  href?: string
  /** EPUB precise position. */
  cfi?: string
  /** TXT character offset. */
  charOffset?: number
  /** 0 - 100 */
  percent: number
}

/**
 * Raw book payload handed from the main process to the renderer. EPUB books
 * carry the raw zip bytes, TXT books carry the already-decoded UTF-8 text.
 */
export interface BookData {
  path: string
  name: string
  size: number
  bookId: string
  format: BookFormat
  arrayBuffer?: ArrayBuffer
  text?: string
}

export interface RecentFile {
  bookId: string
  path: string
  name: string
  title: string
  format: BookFormat
  lastReadAt: number
}

export interface ReaderSettings {
  /** Body font size in px. */
  fontSize: number
  /** Line height as a unitless multiplier. */
  lineHeight: number
  /** Max width of the reading area in px. */
  contentWidth: number
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 16,
  lineHeight: 1.8,
  contentWidth: 720
}

export interface ElectronAPI {
  /** Open a native file dialog and return the selected epub/txt book. */
  openBookFile(): Promise<BookData | null>
  /** Read an epub/txt book from disk by path. */
  readBookFile(path: string): Promise<BookData | null>
  /** Resolve the absolute path of a dropped File (used for drag & drop). */
  getPathForFile(file: File): string
  getRecentFiles(): Promise<RecentFile[]>
  saveRecentFile(entry: RecentFile): Promise<void>
  getProgress(bookId: string): Promise<ReadingProgress | null>
  saveProgress(bookId: string, progress: Omit<ReadingProgress, 'updatedAt'>): Promise<void>
  getSettings(): Promise<ReaderSettings>
  saveSettings(settings: ReaderSettings): Promise<void>
  getTheme(): Promise<Theme>
  saveTheme(theme: Theme): Promise<void>
}
