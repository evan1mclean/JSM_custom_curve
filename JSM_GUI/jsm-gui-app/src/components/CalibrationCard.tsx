import { useMemo } from 'react'

type CalibrationCardProps = {
  isCalibrating: boolean
  countdown: number | null
  recalibrating: boolean
  onRecalibrate: () => void
}

export function CalibrationCard({ isCalibrating, countdown, recalibrating, onRecalibrate }: CalibrationCardProps) {
  const message = useMemo(() => {
    if (!isCalibrating) return null
    const seconds = countdown ?? '...'
    return `Calibrating — place controller on a flat surface (${seconds}s)`
  }, [isCalibrating, countdown])

  return (
    <section className="calibration-card">
      {isCalibrating ? (
        <div className="calibration-pill">{message}</div>
      ) : (
        <button className="recalibrate-btn" onClick={onRecalibrate} disabled={recalibrating}>
          {recalibrating ? 'Recalibrating...' : 'Recalibrate Gyro'}
        </button>
      )}
    </section>
  )
}
