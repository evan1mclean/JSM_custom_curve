import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { buildModifierOptions, resolveModifierOptionLabel } from '../utils/modifierOptions'
import { StaticSensForm } from './StaticSensForm'
import { AccelSensForm } from './AccelSensForm'
import { Card } from './Card'
import { TelemetrySample } from '../hooks/useTelemetry'
import { CurvePreview } from './CurvePreview'
import { SectionActions } from './SectionActions'
import { SensitivityValues } from '../utils/keymap'

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
  onRollContributionChange: (value: string) => void
  modeshiftButton: string | null
  onModeshiftButtonChange: (value: string) => void
  lockMessage?: string
}

export function SensitivityControls({
  sensitivity,
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
  onRollContributionChange,
  modeshiftButton,
  onModeshiftButtonChange,
  lockMessage,
}: SensitivityControlsProps) {
  const { t } = useTranslation()
  const displaySensitivity = sensitivity

  const isTouchpadGridActive = touchpadMode === 'GRID_AND_STICK'
  const modifierOptions = useMemo(() => {
    return buildModifierOptions(isTouchpadGridActive, isTouchpadGridActive ? touchpadGridCells : 0).map(option => ({
      value: option.value,
      label: resolveModifierOptionLabel(option, t),
      disabled: option.disabled,
    }))
  }, [isTouchpadGridActive, t, touchpadGridCells])

  const modeshiftOptions = useMemo(
    () => [{ value: '', label: t('common.noModeShift'), disabled: false }, ...modifierOptions],
    [modifierOptions, t]
  )

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage={lockMessage ?? t('messages.lockMessage')}>
      <h2>{t('sensitivity.title')}</h2>
      <div className="mode-toggle">
        <button className={`pill-tab ${mode === 'static' ? 'active' : ''}`} onClick={() => onModeChange('static')}>
          {t('sensitivity.staticSensitivity')}
        </button>
        <button className={`pill-tab ${mode === 'accel' ? 'active' : ''}`} onClick={() => onModeChange('accel')}>
          {t('sensitivity.accelerationCurve')}
        </button>
      </div>
      <div className="sensitivity-shift-row">
        <label>{t('sensitivity.modeShiftButton')}</label>
        <select value={modeshiftButton ?? ''} onChange={(event) => onModeshiftButtonChange(event.target.value)} data-testid="sensitivity-shift-select">
          {modeshiftOptions.map(option => (
            <option key={option.value || 'none'} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {modeshiftButton && (
        <div className="mode-toggle secondary">
          <button className={`pill-tab ${sensitivityView === 'base' ? 'active' : ''}`} onClick={() => onSensitivityViewChange('base')}>
            {t('sensitivity.baseValues')}
          </button>
          <button className={`pill-tab ${sensitivityView === 'modeshift' ? 'active' : ''}`} onClick={() => onSensitivityViewChange('modeshift')}>
            {t('sensitivity.modeShift')}
          </button>
        </div>
      )}
      {mode === 'static' ? (
        <StaticSensForm
          sensitivity={displaySensitivity}
          onChangeX={onStaticSensXChange}
          onChangeY={onStaticSensYChange}
          onRollContributionChange={onRollContributionChange}
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
          onRollContributionChange={onRollContributionChange}
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
