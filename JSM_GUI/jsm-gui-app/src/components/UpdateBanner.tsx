import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './Misc.module.css'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading' }
  | { phase: 'ready' }

export function UpdateBanner() {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const removeAvailable = window.electronAPI?.onUpdateAvailable?.((version) => {
      setUpdate({ phase: 'available', version })
      setDismissed(false)
    })
    const removeProgress = window.electronAPI?.onUpdateDownloadProgress?.((percent) => {
      setProgress(percent)
    })
    const removeDownloaded = window.electronAPI?.onUpdateDownloaded?.(() => {
      setUpdate({ phase: 'ready' })
    })
    return () => {
      removeAvailable?.()
      removeProgress?.()
      removeDownloaded?.()
    }
  }, [])

  if (update.phase === 'idle' || dismissed) return null

  return (
    <div className={styles.updateBanner}>
      {update.phase === 'available' && (
        <>
          <span>{t('update.available', { version: update.version })}</span>
          <div className={styles.updateBannerActions}>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setUpdate({ phase: 'downloading' })
                window.electronAPI?.downloadUpdate?.()
              }}
            >
              {t('update.downloadNow')}
            </button>
            <button type="button" className="secondary-btn" onClick={() => setDismissed(true)}>
              {t('common.later')}
            </button>
          </div>
        </>
      )}
      {update.phase === 'downloading' && <span>{t('update.downloading', { percent: progress })}</span>}
      {update.phase === 'ready' && (
        <>
          <span>{t('update.ready')}</span>
          <button type="button" className="secondary-btn" onClick={() => window.electronAPI?.installUpdate?.()}>
            {t('update.restartNow')}
          </button>
        </>
      )}
    </div>
  )
}
