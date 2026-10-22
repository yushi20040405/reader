import JSZip from 'jszip'
import { buildToc, TocResult } from './toc'

export interface LoadedEpub {
  title: string
  toc: TocResult
}

/**
 * Parse the raw epub bytes into metadata + TOC. This runs in the renderer and
 * is the single place that validates the file is a readable, non-encrypted EPUB.
 */
export async function loadEpub(arrayBuffer: ArrayBuffer): Promise<LoadedEpub> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch {
    throw new Error('文件损坏或不是有效的 EPUB（无法解压）。')
  }

  if (!zip.file('META-INF/container.xml')) {
    throw new Error('不是有效的 EPUB：缺少 META-INF/container.xml。')
  }

  if (zip.file('META-INF/encryption.xml') || zip.file('encryption.xml')) {
    throw new Error('该 EPUB 使用了加密（DRM），暂不支持打开。')
  }

  const toc = await buildToc(zip)
  return { title: toc.title, toc }
}
