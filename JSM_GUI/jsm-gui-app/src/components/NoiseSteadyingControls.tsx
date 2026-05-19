import { useTranslation } from 'react-i18next'
import { SensitivityValues } from '../utils/keymap'
import { Card } from './Card'
import { SectionActions } from './SectionActions'
import { TelemetryBanner } from './TelemetryBanner'
import telemetryStyles from './Telemetry.module.css'

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
  onSmoothingDecayChange: (value: string) => void
  onOneEuroFilterChange: (value: string) => void
  onOneEuroMinCutoffChange: (value: string) => void
  onOneEuroSpeedCoeffChange: (value: string) => void
  onAngleSnapChange: (value: string) => void
  onAngleSnapSmoothChange: (value: string) => void
  onDecelBrakeStrengthChange: (value: string) => void
  onDecelBrakeThresholdChange: (value: string) => void
  telemetry: {
    omega: string
    timestamp: string
    sampleHz?: string
  }
}

export function NoiseSteadyingControls({
  sensitivity,
  isCalibrating,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  lockMessage,
  onCutoffSpeedChange,
  onCutoffRecoveryChange,
  onSmoothTimeChange,
  onSmoothThresholdChange,
  onSmoothingDecayChange,
  onOneEuroFilterChange,
  onOneEuroMinCutoffChange,
  onOneEuroSpeedCoeffChange,
  onAngleSnapChange,
  onAngleSnapSmoothChange,
  onDecelBrakeStrengthChange,
  onDecelBrakeThresholdChange,
  telemetry,
}: NoiseSteadyingControlsProps) {
  const { t } = useTranslation()

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage={lockMessage ?? t('messages.lockMessage')}>
      <div className="section-header">
        <h2 className="section-title">{t('noise.title')}</h2>
        <p className="section-caption compact">{t('noise.caption')}</p>
      </div>
      <div className={telemetryStyles.telemetryInline}>
        <TelemetryBanner {...telemetry} />
      </div>
      <div className="flex-inputs">
        <label>
          {t('noise.deadzone')}
          <input type="number" step="0.01" min="0" value={sensitivity.cutoffSpeed ?? ''} onChange={(e) => onCutoffSpeedChange(e.target.value)} />
          <input type="range" min="0" max="5" step="0.01" value={sensitivity.cutoffSpeed ?? 0} onChange={(e) => onCutoffSpeedChange(e.target.value)} />
        </label>
        <label>
          {t('noise.steadying')}
          <input type="number" step="0.01" min="0" value={sensitivity.cutoffRecovery ?? ''} onChange={(e) => onCutoffRecoveryChange(e.target.value)} />
          <input type="range" min="0" max="5" step="0.01" value={sensitivity.cutoffRecovery ?? 0} onChange={(e) => onCutoffRecoveryChange(e.target.value)} />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          {t('noise.smoothTime')}
          <input type="number" step="0.001" min="0" value={sensitivity.smoothTime ?? ''} onChange={(e) => onSmoothTimeChange(e.target.value)} />
          <input type="range" min="0" max="0.03" step="0.001" value={sensitivity.smoothTime ?? 0} onChange={(e) => onSmoothTimeChange(e.target.value)} />
        </label>
        <label>
          {t('noise.smoothThreshold')}
          <input type="number" step="1" min="0" value={sensitivity.smoothThreshold ?? ''} onChange={(e) => onSmoothThresholdChange(e.target.value)} />
          <input type="range" min="0" max="50" step="1" value={sensitivity.smoothThreshold ?? 0} onChange={(e) => onSmoothThresholdChange(e.target.value)} />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          {t('noise.smoothingDecay')}
          <select value={sensitivity.smoothingDecay ?? 'OFF'} onChange={(e) => onSmoothingDecayChange(e.target.value)}>
            <option value="OFF">{t('common.off')}</option>
            <option value="ON">{t('common.on')}</option>
          </select>
        </label>
        <label>
          {t('noise.oneEuroFilter')}
          <select value={sensitivity.oneEuroFilter ? 'ON' : 'OFF'} onChange={(e) => onOneEuroFilterChange(e.target.value)}>
            <option value="OFF">{t('common.off')}</option>
            <option value="ON">{t('common.on')}</option>
          </select>
        </label>
      </div>
      {sensitivity.oneEuroFilter && (
        <div className="flex-inputs">
          <label>
            {t('noise.oneEuroMinCutoff')}
            <input type="number" step="0.1" min="0" value={sensitivity.oneEuroMinCutoff ?? ''} onChange={(e) => onOneEuroMinCutoffChange(e.target.value)} />
            <input type="range" min="0" max="20" step="0.1" value={sensitivity.oneEuroMinCutoff ?? 6} onChange={(e) => onOneEuroMinCutoffChange(e.target.value)} />
          </label>
          <label>
            {t('noise.oneEuroSpeedCoeff')}
            <input type="number" step="0.01" min="0" value={sensitivity.oneEuroSpeedCoeff ?? ''} onChange={(e) => onOneEuroSpeedCoeffChange(e.target.value)} />
            <input type="range" min="0" max="2" step="0.01" value={sensitivity.oneEuroSpeedCoeff ?? 0.3} onChange={(e) => onOneEuroSpeedCoeffChange(e.target.value)} />
          </label>
        </div>
      )}
      <div className="flex-inputs">
        <label>
          {t('noise.angleSnapping')}
          <input type="number" step="0.1" min="0" max="45" value={sensitivity.angleSnap ?? ''} onChange={(e) => onAngleSnapChange(e.target.value)} />
          <input type="range" min="0" max="45" step="0.1" value={sensitivity.angleSnap ?? 0} onChange={(e) => onAngleSnapChange(e.target.value)} />
        </label>
        <label>
          {t('noise.easeAngleSnapping')}
          <select value={sensitivity.angleSnapEase ?? 'OFF'} onChange={(e) => onAngleSnapSmoothChange(e.target.value)}>
            <option value="OFF">{t('common.off')}</option>
            <option value="ON">{t('common.on')}</option>
          </select>
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          {t('noise.decelBrakeStrength')}
          <input type="number" step="0.01" min="0" max="1" value={sensitivity.decelBrakeStrength ?? ''} onChange={(e) => onDecelBrakeStrengthChange(e.target.value)} />
          <input type="range" min="0" max="1" step="0.01" value={sensitivity.decelBrakeStrength ?? 0} onChange={(e) => onDecelBrakeStrengthChange(e.target.value)} />
        </label>
        <label>
          {t('noise.decelBrakeThreshold')}
          <input type="number" step="0.1" min="1" max="60" value={sensitivity.decelBrakeThreshold ?? ''} onChange={(e) => onDecelBrakeThresholdChange(e.target.value)} />
          <input type="range" min="1" max="60" step="0.5" value={sensitivity.decelBrakeThreshold ?? 25} onChange={(e) => onDecelBrakeThresholdChange(e.target.value)} />
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
