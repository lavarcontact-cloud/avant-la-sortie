import type { Language, LanguageCode } from '../types'

// Central language registry. Add a language by adding one entry here —
// every screen (setup, settings, detection) reads from this list.
export const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', bcp47: 'fr-FR' },
  { code: 'en', name: 'English', flag: '🇬🇧', bcp47: 'en-US' },
  { code: 'es', name: 'Español', flag: '🇪🇸', bcp47: 'es-ES' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', bcp47: 'pt-PT' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', bcp47: 'ar-SA' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', bcp47: 'de-DE' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', bcp47: 'it-IT' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱', bcp47: 'nl-NL' },
]

export const AUTO_DETECT: Language = {
  code: 'auto',
  name: 'Détection automatique',
  flag: '✨',
  bcp47: '',
}

export function getLanguage(code: LanguageCode): Language {
  if (code === 'auto') return AUTO_DETECT
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

export function languageName(code: LanguageCode): string {
  return getLanguage(code).name
}
