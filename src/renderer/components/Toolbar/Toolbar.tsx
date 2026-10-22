import { ReaderSettings, Theme } from '../../../shared/types'
import { ThemeToggle } from '../ThemeToggle/ThemeToggle'

interface ToolbarProps {
  title: string
  hasBook: boolean
  tocOpen: boolean
  onToggleToc: () => void
  onOpenFile: () => void
  settings: ReaderSettings
  onSettingsChange: (settings: ReaderSettings) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function Toolbar(props: ToolbarProps): JSX.Element {
  const { title, hasBook, tocOpen, onToggleToc, onOpenFile, settings, onSettingsChange, theme, onThemeChange } = props

  const patch = (partial: Partial<ReaderSettings>): void =>
    onSettingsChange({ ...settings, ...partial })

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="btn" onClick={onOpenFile}>
          打开文件
        </button>
        {hasBook && (
          <button className="btn" onClick={onToggleToc} aria-pressed={tocOpen}>
            ☰ 目录
          </button>
        )}
      </div>

      <div className="toolbar-title">{title || '桌面阅读器'}</div>

      <div className="toolbar-right">
        {hasBook && (
          <>
            <div className="control-group">
              <span className="control-label">字号</span>
              <button
                className="btn icon"
                aria-label="减小字号"
                onClick={() => patch({ fontSize: clamp(settings.fontSize - 1, 12, 32) })}
              >
                A−
              </button>
              <span className="control-value">{settings.fontSize}</span>
              <button
                className="btn icon"
                aria-label="增大字号"
                onClick={() => patch({ fontSize: clamp(settings.fontSize + 1, 12, 32) })}
              >
                A+
              </button>
            </div>

            <div className="control-group">
              <span className="control-label">行距</span>
              <button
                className="btn icon"
                aria-label="减小行距"
                onClick={() => patch({ lineHeight: clamp(round1(settings.lineHeight - 0.1), 1.2, 3) })}
              >
                −
              </button>
              <span className="control-value">{settings.lineHeight.toFixed(1)}</span>
              <button
                className="btn icon"
                aria-label="增大行距"
                onClick={() => patch({ lineHeight: clamp(round1(settings.lineHeight + 0.1), 1.2, 3) })}
              >
                +
              </button>
            </div>

            <div className="control-group">
              <span className="control-label">宽度</span>
              <button
                className="btn icon"
                aria-label="减小阅读宽度"
                onClick={() => patch({ contentWidth: clamp(settings.contentWidth - 40, 480, 1200) })}
              >
                −
              </button>
              <span className="control-value">{settings.contentWidth}</span>
              <button
                className="btn icon"
                aria-label="增大阅读宽度"
                onClick={() => patch({ contentWidth: clamp(settings.contentWidth + 40, 480, 1200) })}
              >
                +
              </button>
            </div>
          </>
        )}

        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </div>
  )
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
