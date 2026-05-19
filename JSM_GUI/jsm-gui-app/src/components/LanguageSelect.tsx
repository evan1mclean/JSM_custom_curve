import { useTranslation } from 'react-i18next'
import { useAppLanguage } from '../hooks/useAppLanguage'
import { type AppLanguage } from '../i18n/language'

type LanguageSelectProps = {
  className?: string
}

const LANGUAGE_OPTIONS: AppLanguage[] = ['en', 'zh-CN']

export function LanguageSelect({ className = '' }: LanguageSelectProps) {
  const { t } = useTranslation()
  const { language, setLanguage } = useAppLanguage()

  return (
    <label className={className}>
      <span>{t('language.label')}</span>
      <select
        className="app-select"
        value={language}
        onChange={(event) => {
          void setLanguage(event.target.value as AppLanguage)
        }}
      >
        {LANGUAGE_OPTIONS.map(option => (
          <option key={option} value={option}>
            {option === 'en' ? t('language.english') : t('language.simplifiedChinese')}
          </option>
        ))}
      </select>
    </label>
  )
}
