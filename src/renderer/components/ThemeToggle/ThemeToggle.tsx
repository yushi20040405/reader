import { Theme } from '../../../shared/types'
import { THEME_ICON, THEME_LABEL, THEME_ORDER } from '../../features/theme/themeStore'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

/**
 * Single-button cycler across day -> eye -> night. The label + icon always show
 * the *current* theme; clicking advances to the next one in {@link THEME_ORDER}.
 */
export function ThemeToggle({ theme, onChange }: ThemeToggleProps): JSX.Element {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]

  return (
    <button
      className="btn theme-toggle"
      type="button"
      aria-label={`主题：${THEME_LABEL[theme]}，点击切换到${THEME_LABEL[next]}`}
      title={`当前主题：${THEME_LABEL[theme]}（点击切换）`}
      onClick={() => onChange(next)}
    >
      <span aria-hidden="true">{THEME_ICON[theme]}</span>
      <span className="theme-label">{THEME_LABEL[theme]}</span>
    </button>
  )
}
