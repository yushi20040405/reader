import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  DEFAULT_READER_SETTINGS,
  ReaderSettings,
  ReadingProgress,
  RecentFile,
  Theme
} from '../../shared/types'

type ProgressMap = Record<string, ReadingProgress>

const dataDir = () => app.getPath('userData')
const filePath = (name: string) => join(dataDir(), name)

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  return readJson<RecentFile[]>(filePath('recent-files.json'), [])
}

export async function setRecentFiles(list: RecentFile[]): Promise<void> {
  await writeJson(filePath('recent-files.json'), list)
}

export async function getProgressMap(): Promise<ProgressMap> {
  return readJson<ProgressMap>(filePath('progress.json'), {})
}

export async function setProgressMap(map: ProgressMap): Promise<void> {
  await writeJson(filePath('progress.json'), map)
}

export async function getSettings(): Promise<ReaderSettings> {
  const stored = await readJson<Partial<ReaderSettings>>(filePath('settings.json'), {})
  return { ...DEFAULT_READER_SETTINGS, ...stored }
}

export async function setSettings(settings: ReaderSettings): Promise<void> {
  await writeJson(filePath('settings.json'), settings)
}

const THEMES: Theme[] = ['day', 'eye', 'night']

export async function getTheme(): Promise<Theme> {
  const stored = await readJson<string>(filePath('theme.json'), 'day')
  return THEMES.includes(stored as Theme) ? (stored as Theme) : 'day'
}

export async function setTheme(theme: Theme): Promise<void> {
  await writeJson(filePath('theme.json'), theme)
}
