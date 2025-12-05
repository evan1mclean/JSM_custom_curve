import { SensitivityValues } from '../utils/keymap'
import { buildModifierOptions } from '../utils/modifierOptions'
import { StaticSensForm } from './StaticSensForm'
import { AccelSensForm } from './AccelSensForm'
import { Card } from './Card'
import { TelemetrySample } from '../hooks/useTelemetry'
import { CurvePreview } from './CurvePreview'
import { SectionActions } from './SectionActions'
import { LOCK_MESSAGE } from '../constants/messages'

type SensitivityControlsProps = {
  sensitivity: SensitivityValues
  modeshiftSensitivity?: SensitivityValues
  isCalibrating: boolean
  statusMessage?: string | null
  accelCurve?: string
  naturalVHalf?: number
  powerVRef?: number
  powerExponent?: number
  sigmoidMid?: number
  sigmoidWidth?: number
  jumpTau?: number
  mode: 'static' | 'accel'
  sensitivityView: 'base' | 'modeshift'
  hasPendingChanges: boolean
  sample: TelemetrySample | null
  telemetry: {
    omega: string
    sensX: string
    sensY: string
    timestamp: string
  }
  touchpadMode: string
  touchpadGridCells: number
  onModeChange: (mode: 'static' | 'accel') => void
  onSensitivityViewChange: (view: 'base' | 'modeshift') => void
  onApply: () => void
  onCancel: () => void
  onAccelCurveChange: (value: string) => void
  onNaturalVHalfChange: (value: string) => void
  onPowerVRefChange: (value: string) => void
  onPowerExponentChange: (value: string) => void
  onSigmoidMidChange: (value: string) => void
  onSigmoidWidthChange: (value: string) => void
  onJumpTauChange: (value: string) => void
  onMinThresholdChange: (value: string) => void
  onMaxThresholdChange: (value: string) => void
  onMinSensXChange: (value: string) => void
  onMinSensYChange: (value: string) => void
  onMaxSensXChange: (value: string) => void
  onMaxSensYChange: (value: string) => void
  onStaticSensXChange: (value: string) => void
  onStaticSensYChange: (value: string) => void
  modeshiftButton: string | null
  onModeshiftButtonChange: (value: string) => void
  lockMessage?: string
}

export function SensitivityControls({
  sensitivity,
  modeshiftSensitivity,
  isCalibrating,
  statusMessage,
  mode,
  sensitivityView,
  hasPendingChanges,
  sample,
  telemetry,
  touchpadMode,
  touchpadGridCells,
  onModeChange,
  onSensitivityViewChange,
  onApply,
  onCancel,
  onAccelCurveChange,
  onNaturalVHalfChange,
  onPowerVRefChange,
  onPowerExponentChange,
  onSigmoidMidChange,
  onSigmoidWidthChange,
  onJumpTauChange,
  onMinThresholdChange,
  onMaxThresholdChange,
  onMinSensXChange,
  onMinSensYChange,
  onMaxSensXChange,
  onMaxSensYChange,
  onStaticSensXChange,
  onStaticSensYChange,
  modeshiftButton,
  onModeshiftButtonChange,
  lockMessage = LOCK_MESSAGE,
}: SensitivityControlsProps) {
  const displaySensitivity =
    sensitivityView === 'base' || !modeshiftButton ? sensitivity : modeshiftSensitivity ?? sensitivity

  const isTouchpadGridActive = touchpadMode === 'GRID_AND_STICK'
  const modifierOptions = buildModifierOptions('playstation', isTouchpadGridActive, isTouchpadGridActive ? touchpadGridCells : 0)
  const modeshiftOptions = [{ value: '', label: 'No mode shift' }, ...modifierOptions]

  return (
    <Card
      className="control-panel"
      lockable
      locked={isCalibrating}
      lockMessage={lockMessage}
    >
      <h2>Gyro Sensitivity Controls</h2>
      <div className="mode-toggle">
        <button className={`pill-tab ${mode === 'static' ? 'active' : ''}`} onClick={() => onModeChange('static')}>
          Static Sensitivity
        </button>
        <button className={`pill-tab ${mode === 'accel' ? 'active' : ''}`} onClick={() => onModeChange('accel')}>
          Acceleration Curve
        </button>
      </div>
      <div className="sensitivity-shift-row">
        <label>Mode shift button</label>
        <select
          value={modeshiftButton ?? ''}
          onChange={(event) => onModeshiftButtonChange(event.target.value)}
          data-testid="sensitivity-shift-select"
        >
          {modeshiftOptions.map(option => (
            <option key={option.value || 'none'} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {modeshiftButton && (
        <div className="mode-toggle secondary">
          <button
            className={`pill-tab ${sensitivityView === 'base' ? 'active' : ''}`}
            onClick={() => onSensitivityViewChange('base')}
          >
            Base values
          </button>
          <button
            className={`pill-tab ${sensitivityView === 'modeshift' ? 'active' : ''}`}
            onClick={() => onSensitivityViewChange('modeshift')}
          >
            Mode shift
          </button>
        </div>
      )}
      {mode === 'static' ? (
        <StaticSensForm
          sensitivity={displaySensitivity}
          onChangeX={onStaticSensXChange}
          onChangeY={onStaticSensYChange}
        />
      ) : (
        <AccelSensForm
          sensitivity={displaySensitivity}
          onCurveChange={onAccelCurveChange}
          onNaturalVHalfChange={onNaturalVHalfChange}
          onPowerVRefChange={onPowerVRefChange}
          onPowerExponentChange={onPowerExponentChange}
          onSigmoidMidChange={onSigmoidMidChange}
          onSigmoidWidthChange={onSigmoidWidthChange}
          onJumpTauChange={onJumpTauChange}
          onMinThresholdChange={onMinThresholdChange}
          onMaxThresholdChange={onMaxThresholdChange}
          onMinSensXChange={onMinSensXChange}
          onMinSensYChange={onMinSensYChange}
          onMaxSensXChange={onMaxSensXChange}
          onMaxSensYChange={onMaxSensYChange}
        />
      )}
      <SectionActions
        hasPendingChanges={hasPendingChanges}
        statusMessage={statusMessage}
        onApply={onApply}
        onCancel={onCancel}
        applyDisabled={isCalibrating}
        className="control-actions"
      />
      <CurvePreview sensitivity={sensitivity} sample={sample} hasPendingChanges={hasPendingChanges} telemetry={telemetry} />
    </Card>
  )
}
