import { Theme } from '../../../shared/types'

/**
 * Reader-surface colors injected into the EPUB iframe. These mirror the
 * `--reader-bg` / `--reader-text` / `--accent` values in theme.css so the
 * iframe body stays in sync with the external UI.
 */
export interface ReaderThemeColors {
  background: string
  text: string
  link: string
}

export const READER_THEME_COLORS: Record<Theme, ReaderThemeColors> = {
  day: { background: '#ffffff', text: '#1f2328', link: '#2f6fed' },
  eye: { background: '#f6f1e7', text: '#3a352a', link: '#2f6b4f' },
  night: { background: '#16171b', text: '#c9c9cf', link: '#7aa8ff' }
}
