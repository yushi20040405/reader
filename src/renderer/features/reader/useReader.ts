import { useCallback, useEffect, useRef, useState } from 'react'
import { BookData, BookFormat, ReaderLocation, ReaderSettings, Theme, TocItem } from '../../../shared/types'
import { ReaderAdapter } from './readerAdapter'
import { EpubAdapter } from '../epub/epubAdapter'
import { TxtAdapter } from '../txt/txtAdapter'
import { toMessage } from './errors'

export interface ReaderState {
  ready: boolean
  loading: boolean
  error: string | null
}

export interface UseReaderResult {
  containerRef: React.RefObject<HTMLDivElement>
  state: ReaderState
  location: ReaderLocation | null
  goToItem: (item: TocItem) => Promise<void>
  goToLocation: (location: ReaderLocation) => Promise<void>
  resize: () => void
  applyTypography: (settings: ReaderSettings) => void
  applyTheme: (theme: Theme) => void
}

function createAdapter(format: BookFormat): ReaderAdapter {
  return format === 'epub' ? new EpubAdapter() : new TxtAdapter()
}

/**
 * Owns the ReaderAdapter lifecycle for the currently loaded book: creates the
 * right adapter for the format, renders into `containerRef`, forwards location
 * changes and applies typography + theme.
 */
export function useReader(bookData: BookData | null, settings: ReaderSettings, theme: Theme): UseReaderResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<ReaderAdapter | null>(null)
  const [state, setState] = useState<ReaderState>({ ready: false, loading: false, error: null })
  const [location, setLocation] = useState<ReaderLocation | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    if (!bookData) return
    let cancelled = false
    const adapter = createAdapter(bookData.format)
    adapterRef.current = adapter
    setState({ ready: false, loading: true, error: null })
    setLocation(null)

    adapter.onLocationChange = (loc) => {
      if (!cancelled) setLocation(loc)
    }

    void (async () => {
      try {
        const element = containerRef.current
        if (!element) return
        await adapter.open(bookData, element)
        if (cancelled) return
        adapter.applyTypography(settingsRef.current)
        adapter.applyTheme(themeRef.current)
        setState({ ready: true, loading: false, error: null })
        setLocation(adapter.currentLocation())
      } catch (error) {
        if (!cancelled) {
          setState({ ready: false, loading: false, error: toMessage(error) })
        }
      }
    })()

    return () => {
      cancelled = true
      adapter.destroy()
      adapterRef.current = null
    }
  }, [bookData])

  const goToItem = useCallback(async (item: TocItem) => {
    await adapterRef.current?.goToItem(item)
  }, [])

  const goToLocation = useCallback(async (location: ReaderLocation) => {
    await adapterRef.current?.goToLocation(location)
  }, [])

  const resize = useCallback(() => {
    adapterRef.current?.resize()
  }, [])

  const applyTypography = useCallback((s: ReaderSettings) => {
    adapterRef.current?.applyTypography(s)
  }, [])

  const applyTheme = useCallback((t: Theme) => {
    adapterRef.current?.applyTheme(t)
  }, [])

  return { containerRef, state, location, goToItem, goToLocation, resize, applyTypography, applyTheme }
}
