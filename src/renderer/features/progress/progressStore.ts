import { ReaderLocation, ReaderSettings, ReadingProgress } from '../../../shared/types'

const api = () => window.electronAPI

export function loadSettings(): Promise<ReaderSettings> {
  return api().getSettings()
}

export function persistSettings(settings: ReaderSettings): Promise<void> {
  return api().saveSettings(settings)
}

export function loadProgress(bookId: string): Promise<ReadingProgress | null> {
  return api().getProgress(bookId)
}

export function persistProgress(
  bookId: string,
  location: ReaderLocation,
  title: string
): Promise<void> {
  return api().saveProgress(bookId, {
    cfi: location.cfi,
    charOffset: location.charOffset,
    percent: location.percent,
    title
  })
}
