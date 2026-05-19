import { useTranslation } from 'react-i18next'
import styles from './Telemetry.module.css'

type TelemetryBannerProps = {
  omega: string
  timestamp: string
  sampleHz?: string
}

export function TelemetryBanner({ omega, timestamp, sampleHz }: TelemetryBannerProps) {
  const { t } = useTranslation()

  return (
    <section className={styles.telemetryBanner}>
      <p className={styles.telemetryHeading}>{t('telemetry.livePacketsStreaming')}</p>
      <div className={styles.telemetryReadouts}>
        <div className={styles.telemetryNode}>
          <span className={styles.telemetryLabel}>{t('telemetry.gyroSpeed')}</span>
          <strong className={styles.telemetryValue}>{omega} deg/s</strong>
        </div>
        <div className={styles.telemetryNode}>
          <span className={styles.telemetryLabel}>{t('telemetry.timestamp')}</span>
          <strong className={styles.telemetryValue}>{timestamp}</strong>
        </div>
        {sampleHz !== undefined && (
          <div className={styles.telemetryNode}>
            <span className={styles.telemetryLabel}>{t('telemetry.sampleRate')}</span>
            <strong className={styles.telemetryValue}>{sampleHz} Hz</strong>
          </div>
        )}
      </div>
    </section>
  )
}
