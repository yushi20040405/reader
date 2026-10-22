import { TocItem } from '../../../shared/types'

/**
 * Character offsets in the decoded text are resolved against a block index.
 * A "block" is a group of consecutive lines kept under a fixed size so that a
 * very large TXT never explodes into hundreds of thousands of DOM nodes.
 */
export interface TxtTocResult {
  items: TocItem[]
  /** How the TOC was produced. */
  mode: 'chapters' | 'fallback'
}

/** Characters to accumulate before starting a new rendered block. */
export const BLOCK_CHARS = 4000

export function buildTxtToc(text: string): TxtTocResult {
  const chapters = extractChapters(text)
  if (chapters.length >= 2) {
    return {
      mode: 'chapters',
      items: chapters.map((c, i) => ({
        id: `txt-${i}`,
        label: c.label,
        level: 0,
        charOffset: c.charOffset,
        children: []
      }))
    }
  }
  return { mode: 'fallback', items: buildFallbackToc(text) }
}

interface TxtChapter {
  label: string
  charOffset: number
}

const MAX_HEADING_LENGTH = 40

/** Matches the common Chinese chapter-title conventions. */
const NUMBERED_HEADING = /^第\s*[0-9０-９一二三四五六七八九十百千万零两〇]+\s*[章卷节回部篇集]/
const NAMED_HEADING = /^(序章|序言|前言|楔子|引子|卷首语|后记|尾声|终章|番外|结语)(\s*[:：]|$)/

/** Return the trimmed heading text if `line` looks like a chapter title, else null. */
export function matchHeading(line: string): string | null {
  const t = line.trim()
  if (!t || t.length > MAX_HEADING_LENGTH) return null
  if (NUMBERED_HEADING.test(t)) return t
  if (NAMED_HEADING.test(t)) return t
  return null
}

/** Scan the text line-by-line and return recognized chapter headings with char offsets. */
export function extractChapters(text: string): TxtChapter[] {
  const chapters: TxtChapter[] = []
  const len = text.length
  let lineStart = 0

  while (lineStart <= len) {
    const nl = text.indexOf('\n', lineStart)
    const lineEnd = nl === -1 ? len : nl
    let line = text.slice(lineStart, lineEnd)
    if (line.endsWith('\r')) line = line.slice(0, -1)

    const label = matchHeading(line)
    if (label) chapters.push({ label, charOffset: lineStart })

    if (nl === -1) break
    lineStart = nl + 1
  }

  return chapters
}

const FALLBACK_CHUNK_CHARS = 5000

/** When no chapters are recognized, split the text into fixed-size sections. */
export function buildFallbackToc(text: string): TocItem[] {
  if (text.length === 0) return []
  const items: TocItem[] = []
  let idx = 0
  for (let offset = 0; offset < text.length; offset += FALLBACK_CHUNK_CHARS) {
    items.push({
      id: `txt-${idx}`,
      label: `第 ${idx + 1} 节`,
      level: 0,
      charOffset: offset,
      children: []
    })
    idx++
  }
  return items
}
