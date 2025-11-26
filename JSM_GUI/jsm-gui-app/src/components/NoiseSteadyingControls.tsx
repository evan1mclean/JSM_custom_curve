import { Card } from './Card'
import { SensitivityValues } from '../utils/keymap'
import { TelemetryBanner } from './TelemetryBanner'
import { SectionActions } from './SectionActions'

type NoiseSteadyingControlsProps = {
  sensitivity: SensitivityValues
  isCalibrating: boolean
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  lockMessage?: string
  onCutoffSpeedChange: (value: string) => void
  onCutoffRecoveryChange: (value: string) => void
  onSmoothTimeChange: (value: string) => void
  onSmoothThresholdChange: (value: string) => void
  telemetry: {
    omega: string
    timestamp: string
  }
}

export function NoiseSteadyingControls({
  sensitivity,
  isCalibrating,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  lockMessage = 'Calibrating — place controller on a flat surface',
  onCutoffSpeedChange,
  onCutoffRecoveryChange,
  onSmoothTimeChange,
  onSmoothThresholdChange,
  telemetry,
}: NoiseSteadyingControlsProps) {
  return (
    <Card
      className="control-panel"
      lockable
      locked={isCalibrating}
      lockMessage={lockMessage}
    >
      <div className="section-header">
        <h2 className="section-title">Noise & Steadying</h2>
        <p className="section-caption compact">
          Increase deadzone/steadying to damp the live gyro noise shown below; higher values reduce tiny movements when the
          controller is at rest.
        </p>
      </div>
      <div className="telemetry-inline">
        <TelemetryBanner {...telemetry} />
      </div>
      <div className="flex-inputs">
        <label>
          Deadzone (°/s)
          <input
            type="number"
            step="0.01"
            min="0"
            value={sensitivity.cutoffSpeed ?? ''}
            onChange={(e) => onCutoffSpeedChange(e.target.value)}
          />
          <input
            type="range"
            min="0"
            max="5"
            step="0.01"
            value={sensitivity.cutoffSpeed ?? 0}
            onChange={(e) => onCutoffSpeedChange(e.target.value)}
          />
        </label>
        <label>
          Steadying (°/s)
          <input
            type="number"
            step="0.01"
            min="0"
            value={sensitivity.cutoffRecovery ?? ''}
            onChange={(e) => onCutoffRecoveryChange(e.target.value)}
          />
          <input
            type="range"
            min="0"
            max="5"
            step="0.01"
            value={sensitivity.cutoffRecovery ?? 0}
            onChange={(e) => onCutoffRecoveryChange(e.target.value)}
          />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Gyro Smooth Time (sec)
          <input
            type="number"
            step="0.001"
            min="0"
            value={sensitivity.smoothTime ?? ''}
            onChange={(e) => onSmoothTimeChange(e.target.value)}
          />
          <input
            type="range"
            min="0"
            max="0.03"
            step="0.001"
            value={sensitivity.smoothTime ?? 0}
            onChange={(e) => onSmoothTimeChange(e.target.value)}
          />
        </label>
        <label>
          Gyro Smooth Threshold (RWS)
          <input
            type="number"
            step="1"
            min="0"
            value={sensitivity.smoothThreshold ?? ''}
            onChange={(e) => onSmoothThresholdChange(e.target.value)}
          />
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={sensitivity.smoothThreshold ?? 0}
            onChange={(e) => onSmoothThresholdChange(e.target.value)}
          />
        </label>
      </div>
      <SectionActions
        hasPendingChanges={hasPendingChanges}
        statusMessage={statusMessage}
        onApply={onApply}
        onCancel={onCancel}
        applyDisabled={isCalibrating}
        className="control-actions"
      />
    </Card>
  )
}
