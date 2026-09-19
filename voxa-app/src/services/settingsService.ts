import type { Settings } from '../types'

const STORAGE_KEY = 'voxa.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  primaryLanguage: 'fr',
  favoriteLanguages: ['fr', 'en'],
  autoPlayback: true,
  slangLevel: 'NATUREL',
  speechRate: 1,
  keepHistory: true,
}

export const settingsService = {
  load(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_SETTINGS
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch {
      return DEFAULT_SETTINGS
    }
  },
  save(settings: Settings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  },
}
