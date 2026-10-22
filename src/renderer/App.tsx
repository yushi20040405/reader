import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookData,
  DEFAULT_READER_SETTINGS,
  ReaderLocation,
  ReaderSettings,
  RecentFile,
  Theme,
  TocItem
} from '../shared/types'
import { Layout } from './components/Layout/Layout'
import { Toolbar } from './components/Toolbar/Toolbar'
import { TocPanel } from './components/TocPanel/TocPanel'
import { ReaderView } from './components/ReaderView/ReaderView'
import { loadEpub } from './features/epub/epubLoader'
import { TocSource } from './features/epub/toc'
import { buildTxtToc } from './features/txt/txtToc'
import { findCurrentPath, nextItem, prevItem } from './features/reader/chapterNavigation'
import { useReader } from './features/reader/useReader'
import { toMessage } from './features/reader/errors'
import { loadProgress, loadSettings, persistProgress, persistSettings } from './features/progress/progressStore'
import { applyTheme } from './features/theme/themeStore'

const TOC_SOURCE_LABEL: Record<TocSource, string> = {
  nav: '(EPUB3 nav)',
  ncx: '(EPUB2 NCX)',
  headings: '(正文标题)'
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return ''
  }
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [tocOpen, setTocOpen] = useState(true)
  const [theme, setTheme] = useState<Theme>('day')

  const [bookData, setBookData] = useState<BookData | null>(null)
  const [title, setTitle] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocLabel, setTocLabel] = useState('')
  const [tocNote, setTocNote] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [returnTarget, setReturnTarget] = useState<ReaderLocation | null>(null)
  const pendingLocationRef = useRef<ReaderLocation | null>(null)

  const reader = useReader(bookData, settings, theme)

  // Load persisted settings + recent files + theme once on startup.
  useEffect(() => {
    loadSettings().then(setSettings)
    window.electronAPI.getRecentFiles().then(setRecentFiles)
    window.electronAPI.getTheme().then(setTheme)
  }, [])

  // Apply the current theme to the app shell and the open book's content.
  useEffect(() => {
    applyTheme(theme)
    reader.applyTheme(theme)
  }, [theme, reader.applyTheme])

  const changeTheme = useCallback((next: Theme) => {
    setTheme(next)
    void window.electronAPI.saveTheme(next)
  }, [])

  // Persist settings (debounced).
  useEffect(() => {
    const timer = setTimeout(() => void persistSettings(settings), 300)
    return () => clearTimeout(timer)
  }, [settings])

  // Apply typography changes to the open book (debounced).
  useEffect(() => {
    if (!reader.state.ready) return
    const timer = setTimeout(() => reader.applyTypography(settings), 120)
    return () => clearTimeout(timer)
  }, [settings.fontSize, settings.lineHeight, reader.state.ready, reader.applyTypography])

  // Restore the last reading position once the book is ready.
  useEffect(() => {
    if (!reader.state.ready || !pendingLocationRef.current) return
    const loc = pendingLocationRef.current
    pendingLocationRef.current = null
    void reader.goToLocation(loc)
  }, [reader.state.ready, reader.goToLocation])

  // Persist reading progress (throttled).
  useEffect(() => {
    if (!bookData || !reader.location) return
    const timer = setTimeout(() => {
      void persistProgress(bookData.bookId, reader.location as ReaderLocation, title || bookData.name)
    }, 800)
    return () => clearTimeout(timer)
  }, [reader.location, bookData, title])

  const openBook = useCallback(async (data: BookData) => {
    setError(null)
    setReturnTarget(null)
    let finalTitle = data.name

    if (data.format === 'epub') {
      try {
        const meta = await loadEpub(data.arrayBuffer as ArrayBuffer)
        setToc(meta.toc.items)
        setTocLabel(TOC_SOURCE_LABEL[meta.toc.source])
        finalTitle = meta.title || data.name
        setTocNote(meta.toc.items.length === 0 ? '未能提取到目录（已尝试 NCX / nav / 正文标题）。' : null)
      } catch (e) {
        setError(toMessage(e))
        return
      }
    } else {
      const result = buildTxtToc(data.text ?? '')
      setToc(result.items)
      setTocLabel(result.mode === 'chapters' ? '(自动识别)' : '(固定分节)')
      finalTitle = data.name.replace(/\.txt$/i, '')
      setTocNote(
        result.items.length === 0
          ? '未能识别到任何内容，请检查文件是否为空。'
          : result.mode === 'fallback'
            ? '未识别到章节标题，已按固定长度分节。'
            : null
      )
    }

    setTitle(finalTitle)
    setBookData(data)

    try {
      const saved = await loadProgress(data.bookId)
      if (saved && (saved.cfi || saved.charOffset != null)) {
        pendingLocationRef.current = {
          cfi: saved.cfi,
          charOffset: saved.charOffset,
          percent: typeof saved.percent === 'number' ? saved.percent : 0
        }
      } else {
        pendingLocationRef.current = null
      }
    } catch {
      pendingLocationRef.current = null
    }

    const entry: RecentFile = {
      bookId: data.bookId,
      path: data.path,
      name: data.name,
      title: finalTitle,
      format: data.format,
      lastReadAt: Date.now()
    }
    await window.electronAPI.saveRecentFile(entry)
    setRecentFiles(await window.electronAPI.getRecentFiles())
  }, [])

  const handleOpenDialog = useCallback(async () => {
    const data = await window.electronAPI.openBookFile()
    if (data) await openBook(data)
  }, [openBook])

  const handleOpenRecent = useCallback(
    async (path: string) => {
      const data = await window.electronAPI.readBookFile(path)
      if (data) await openBook(data)
      else setError('无法打开该文件，文件可能已被移动、删除或格式不受支持。')
    },
    [openBook]
  )

  // Drag & drop of .epub / .txt files onto the window.
  useEffect(() => {
    const onDragOver = (event: DragEvent): void => event.preventDefault()
    const onDrop = async (event: DragEvent): Promise<void> => {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      const name = file.name.toLowerCase()
      if (!name.endsWith('.epub') && !name.endsWith('.txt')) {
        setError('请拖入 .epub 或 .txt 文件。')
        return
      }
      try {
        const path = window.electronAPI.getPathForFile(file)
        const data = await window.electronAPI.readBookFile(path)
        if (data) await openBook(data)
        else setError('无法读取拖入的文件。')
      } catch {
        setError('无法读取拖入的文件。')
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openBook])

  const activePath = useMemo(() => findCurrentPath(toc, reader.location), [toc, reader.location])

  // Chapter start-progress hint. Only TXT exposes a genuine per-chapter offset;
  // EPUB returns null so nothing is fabricated.
  const itemProgress = useCallback(
    (item: TocItem): number | null => {
      if (!bookData || bookData.format !== 'txt') return null
      const total = (bookData.text ?? '').length
      if (total === 0 || item.charOffset == null) return null
      return Math.min(100, Math.round((item.charOffset / total) * 100))
    },
    [bookData]
  )

  const recordReturnTarget = useCallback(() => {
    if (reader.location) setReturnTarget(reader.location)
  }, [reader.location])

  const handleTocJump = useCallback(
    (item: TocItem) => {
      recordReturnTarget()
      void reader.goToItem(item)
    },
    [recordReturnTarget, reader.goToItem]
  )

  const handleReturn = useCallback(() => {
    if (returnTarget) {
      void reader.goToLocation(returnTarget)
      setReturnTarget(null)
    }
  }, [returnTarget, reader.goToLocation])

  const handlePrev = useCallback(() => {
    const item = prevItem(toc, reader.location)
    if (!item) return
    recordReturnTarget()
    void reader.goToItem(item)
  }, [toc, reader.location, recordReturnTarget, reader.goToItem])

  const handleNext = useCallback(() => {
    const item = nextItem(toc, reader.location)
    if (!item) return
    recordReturnTarget()
    void reader.goToItem(item)
  }, [toc, reader.location, recordReturnTarget, reader.goToItem])

  const updateSettings = useCallback((next: ReaderSettings) => setSettings(next), [])

  const hasBook = bookData !== null

  const sidebar = (
    <>
      <section className="sidebar-section">
        <h2>最近阅读</h2>
        {recentFiles.length === 0 ? (
          <p className="muted">暂无记录</p>
        ) : (
          <ul className="recent-list">
            {recentFiles.map((file) => (
              <li key={file.bookId}>
                <button className="recent-item" onClick={() => void handleOpenRecent(file.path)} title={file.path}>
                  <span className="recent-title">{file.title || file.name}</span>
                  <span className="recent-meta">
                    <span className="format-badge">{file.format.toUpperCase()}</span>
                    <span className="recent-time">{formatTime(file.lastReadAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasBook && (
        <section className="sidebar-section">
          <h2>目录 {tocLabel}</h2>
          {tocNote && <p className="muted">{tocNote}</p>}
          {toc.length > 0 ? (
            <TocPanel items={toc} activePath={activePath} onJump={handleTocJump} itemProgress={itemProgress} />
          ) : (
            <p className="muted">暂无目录</p>
          )}
        </section>
      )}
    </>
  )

  const content = hasBook ? (
    <ReaderView
      containerRef={reader.containerRef}
      state={reader.state}
      settings={settings}
      returnTarget={returnTarget}
      onReturn={handleReturn}
      onResize={reader.resize}
      onPrev={handlePrev}
      onNext={handleNext}
      onReselect={() => void handleOpenDialog()}
    />
  ) : (
    <div className="welcome">
      <h1>桌面阅读器</h1>
      <button className="btn" onClick={() => void handleOpenDialog()}>
        打开电子书
      </button>
      <p className="drop-hint">支持 .epub 与 .txt，也可以直接拖入窗口打开</p>
    </div>
  )

  return (
    <Layout
      toolbar={
        <Toolbar
          title={title}
          hasBook={hasBook}
          tocOpen={tocOpen}
          onToggleToc={() => setTocOpen((v) => !v)}
          onOpenFile={() => void handleOpenDialog()}
          settings={settings}
          onSettingsChange={updateSettings}
          theme={theme}
          onThemeChange={changeTheme}
        />
      }
      sidebar={sidebar}
      sidebarOpen={tocOpen}
      content={
        <>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <div className="error-actions">
                <button className="error-reselect" onClick={() => void handleOpenDialog()}>
                  重新选择文件
                </button>
                <button onClick={() => setError(null)} aria-label="关闭">
                  ✕
                </button>
              </div>
            </div>
          )}
          {content}
        </>
      }
    />
  )
}
