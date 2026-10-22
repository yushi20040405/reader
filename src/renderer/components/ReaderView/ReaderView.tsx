import { useEffect } from 'react'
import { ReaderLocation, ReaderSettings } from '../../../shared/types'
import { ReaderState } from '../../features/reader/useReader'

interface ReaderViewProps {
  containerRef: React.RefObject<HTMLDivElement>
  state: ReaderState
  settings: ReaderSettings
  returnTarget: ReaderLocation | null
  onReturn: () => void
  onResize: () => void
  onPrev: () => void
  onNext: () => void
  onReselect: () => void
}

export function ReaderView(props: ReaderViewProps): JSX.Element {
  const { containerRef, state, settings, returnTarget, onReturn, onResize, onPrev, onNext, onReselect } = props

  // Re-measure the layout after the reading area width changes.
  useEffect(() => {
    if (!state.ready) return
    const timer = setTimeout(onResize, 160)
    return () => clearTimeout(timer)
  }, [settings.contentWidth, state.ready, onResize])

  return (
    <div className="reader-root">
      <div className="reader-stage" style={{ maxWidth: `${settings.contentWidth}px` }}>
        <div className="reader-frame" ref={containerRef} />
      </div>

      {state.loading && (
        <div className="reader-overlay">
          <div className="reader-message">
            <div className="spinner" />
            正在打开书籍…
          </div>
        </div>
      )}

      {state.error && (
        <div className="reader-overlay">
          <div className="reader-message">
            <div className="reader-message-title">打开失败</div>
            <div>{state.error}</div>
            <button className="btn" onClick={onReselect}>
              重新选择文件
            </button>
          </div>
        </div>
      )}

      {returnTarget && (
        <button className="return-btn" onClick={onReturn}>
          ↩ 返回原处
        </button>
      )}

      {state.ready && (
        <div className="chapter-nav">
          <button onClick={onPrev} aria-label="上一章">
            ◀ 上一章
          </button>
          <button onClick={onNext} aria-label="下一章">
            下一章 ▶
          </button>
        </div>
      )}
    </div>
  )
}
