import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { detectInitialLanguage, normalizeAppLanguage, persistAppLanguage, type AppLanguage } from './language'
import { en } from './resources/en'
import { zhCN } from './resources/zh-CN'

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
}

function syncDocumentMetadata(language: AppLanguage) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.title = i18n.t('common.appName')
}

export async function initI18n() {
  if (i18n.isInitialized) return i18n

  await i18n.use(initReactI18next).init({
    resources,
    lng: detectInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh-CN'],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })

  syncDocumentMetadata(normalizeAppLanguage(i18n.language))

  i18n.on('languageChanged', language => {
    const normalized = normalizeAppLanguage(language)
    persistAppLanguage(normalized)
    syncDocumentMetadata(normalized)
  })

  return i18n
}

export async function setAppLanguage(language: AppLanguage) {
  const normalized = normalizeAppLanguage(language)
  persistAppLanguage(normalized)
  if (!i18n.isInitialized) {
    await initI18n()
  }
  await i18n.changeLanguage(normalized)
}

export { i18n }
