export type AppLanguage = 'en' | 'zh-CN'

export const LANGUAGE_STORAGE_KEY = 'jsm-language'
export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en'
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'zh-CN']

export function normalizeAppLanguage(value?: string | null): AppLanguage {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (normalized.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en'
}

export function detectInitialLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored) {
        return normalizeAppLanguage(stored)
      }
    } catch {
      // ignore storage access failures
    }
  }

  if (typeof navigator !== 'undefined') {
    return normalizeAppLanguage(navigator.language)
  }

  return DEFAULT_APP_LANGUAGE
}

export function persistAppLanguage(language: AppLanguage) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // ignore storage access failures
  }
}
