// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getTheme, THEME_LABEL, THEME_ORDER } from './themeStore'
import { READER_THEME_COLORS } from './themeColors'

describe('themeStore', () => {
  beforeEach(() => applyTheme('day'))

  it('exposes exactly the three supported themes in order', () => {
    expect(THEME_ORDER).toEqual(['day', 'eye', 'night'])
  })

  it('labels every theme', () => {
    for (const theme of THEME_ORDER) {
      expect(THEME_LABEL[theme]).toBeTruthy()
    }
  })

  it('applyTheme sets the root data-theme and getTheme reflects it', () => {
    applyTheme('night')
    expect(getTheme()).toBe('night')
    expect(document.documentElement.dataset.theme).toBe('night')
  })

  it('every theme provides reader colors', () => {
    for (const theme of THEME_ORDER) {
      const c = READER_THEME_COLORS[theme]
      expect(c.background).toMatch(/^#/)
      expect(c.text).toMatch(/^#/)
      expect(c.link).toMatch(/^#/)
    }
  })
})
