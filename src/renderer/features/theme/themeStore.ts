import { Theme } from '../../../shared/types'

/** Current theme, tracked as the single source of truth for the UI. */
let current: Theme = 'day'

export function getTheme(): Theme {
  return current
}

/** Apply a theme to the document root; external UI reads it via CSS variables. */
export function applyTheme(theme: Theme): void {
  current = theme
  document.documentElement.dataset.theme = theme
}

export const THEME_ORDER: Theme[] = ['day', 'eye', 'night']

export const THEME_LABEL: Record<Theme, string> = {
  day: '日间',
  eye: '护眼',
  night: '夜间'
}

export const THEME_ICON: Record<Theme, string> = {
  day: '☀️',
  eye: '🍃',
  night: '🌙'
}

// Apply the default (day) theme on first import to avoid an unstyled flash.
applyTheme('day')
