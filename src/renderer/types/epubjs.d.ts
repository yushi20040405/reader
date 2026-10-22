/**
 * Minimal type declaration for the `epubjs` package (v0.3.x ships no official types).
 * Only the surface actually used by `readerAdapter.ts` is declared.
 */
declare module 'epubjs' {
  export interface EpubLocation {
    start: {
      index: number
      href: string
      cfi: string
      percentage: number
    }
    end: {
      index: number
      href: string
      cfi: string
      percentage: number
    }
    atStart?: boolean
    atEnd?: boolean
  }

  export interface RenditionThemes {
    fontSize(size: string): void
    override(name: string, value: string, priority?: boolean): void
    register(name: string, rules: Record<string, string>): void
    select(name: string): void
  }

  export interface Rendition {
    display(target?: string): Promise<void>
    next(): Promise<void>
    prev(): Promise<void>
    resize(width?: number | string, height?: number | string): void
    on(event: string, cb: (location: EpubLocation) => void): void
    off(event: string, cb: (...args: unknown[]) => void): void
    themes: RenditionThemes
    currentLocation(): EpubLocation | null
    getContents(): Array<{ document: Document }>
    destroy(): void
  }

  export interface Book {
    ready: Promise<void>
    spine: {
      hooks: {
        serialize: {
          register(fn: (output: string, section: unknown) => void): void
        }
      }
    }
    renderTo(element: string | HTMLElement, options?: Record<string, unknown>): Rendition
    destroy(): void
  }

  export default function ePub(
    input: string | ArrayBuffer | Blob,
    options?: Record<string, unknown>
  ): Book
}
