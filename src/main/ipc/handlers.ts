import { BrowserWindow, dialog, ipcMain } from 'electron'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { BookData, BookFormat, ReadingProgress, RecentFile, ReaderSettings, Theme } from '../../shared/types'
import {
  getProgressMap,
  getRecentFiles,
  getSettings,
  getTheme,
  setProgressMap,
  setRecentFiles,
  setSettings,
  setTheme
} from './store'
import { decodeTxtBuffer } from '../txt/decodeTxt'

function detectFormat(path: string): BookFormat | null {
  const ext = extname(path).toLowerCase()
  if (ext === '.epub') return 'epub'
  if (ext === '.txt') return 'txt'
  return null
}

async function readBookFile(path: string): Promise<BookData | null> {
  try {
    const format = detectFormat(path)
    if (!format) return null

    const data = await fs.readFile(path)
    const bookId = createHash('sha256').update(data).digest('hex')
    const base: BookData = {
      path,
      name: basename(path),
      size: data.byteLength,
      bookId,
      format
    }

    if (format === 'epub') {
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      return { ...base, arrayBuffer }
    }

    const decoded = decodeTxtBuffer(data)
    return { ...base, text: decoded.text }
  } catch {
    return null
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('open-book-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: '打开电子书',
      filters: [{ name: '电子书 (EPUB / TXT)', extensions: ['epub', 'txt'] }],
      properties: ['openFile' as const]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return readBookFile(result.filePaths[0])
  })

  ipcMain.handle('read-book-file', async (_event, path: string) => {
    if (typeof path !== 'string' || path.length === 0) return null
    return readBookFile(path)
  })

  ipcMain.handle('get-recent-files', async () => getRecentFiles())

  ipcMain.handle('save-recent-file', async (_event, entry: RecentFile) => {
    const list = await getRecentFiles()
    const filtered = list.filter((f) => f.bookId !== entry.bookId)
    filtered.unshift(entry)
    await setRecentFiles(filtered.slice(0, 50))
  })

  ipcMain.handle('get-progress', async (_event, bookId: string) => {
    const map = await getProgressMap()
    return map[bookId] ?? null
  })

  ipcMain.handle('save-progress', async (_event, bookId: string, progress: Omit<ReadingProgress, 'updatedAt'>) => {
    const map = await getProgressMap()
    map[bookId] = { ...progress, updatedAt: Date.now() }
    await setProgressMap(map)
  })

  ipcMain.handle('get-settings', async () => getSettings())

  ipcMain.handle('save-settings', async (_event, settings: ReaderSettings) => {
    await setSettings(settings)
  })

  ipcMain.handle('get-theme', async () => getTheme())

  ipcMain.handle('save-theme', async (_event, theme: Theme) => {
    await setTheme(theme)
  })
}
