import { useTranslation } from 'react-i18next'
import styles from './ThemeToggle.module.css'
import { useTheme } from '../hooks/useTheme'

type ThemeToggleProps = {
  compact?: boolean
  className?: string
}

export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { t } = useTranslation()
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'
  const label = isLight ? t('theme.switchToDarkMode') : t('theme.switchToLightMode')
  const iconChar = isLight ? '☀' : '☾'

  return (
    <button
      type="button"
      className={`${styles.themeToggle} ${isLight ? styles.on : ''} ${compact ? styles.compact : ''} ${className}`.trim()}
      aria-pressed={isLight}
      aria-label={label}
      onClick={toggle}
    >
      <span className={styles.labelGroup}>
        <span className={styles.icon} aria-hidden="true">
          {iconChar}
        </span>
        {!compact && <span className={styles.text}>{isLight ? t('theme.light') : t('theme.dark')}</span>}
      </span>
      <span className={styles.switch} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  )
}
