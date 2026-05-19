import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '../i18n'
import { normalizeAppLanguage, type AppLanguage } from '../i18n/language'

export function useAppLanguage() {
  const { i18n } = useTranslation()
  const [language, setLanguageState] = useState<AppLanguage>(normalizeAppLanguage(i18n.language))

  useEffect(() => {
    const handleLanguageChange = (nextLanguage: string) => {
      setLanguageState(normalizeAppLanguage(nextLanguage))
    }

    handleLanguageChange(i18n.language)
    i18n.on('languageChanged', handleLanguageChange)

    return () => {
      i18n.off('languageChanged', handleLanguageChange)
    }
  }, [i18n])

  const updateLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    await setAppLanguage(nextLanguage)
  }, [])

  return { language, setLanguage: updateLanguage }
}
