import { useTranslation } from 'react-i18next'
import { SensitivityValues } from '../utils/keymap'

type AccelSensFormProps = {
  sensitivity: SensitivityValues
  onCurveChange: (value: string) => void
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
  onRollContributionChange: (value: string) => void
}

export function AccelSensForm({
  sensitivity,
  onCurveChange,
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
  onRollContributionChange,
}: AccelSensFormProps) {
  const { t } = useTranslation()

  const curveValue = (sensitivity.accelCurve ?? 'LINEAR').toUpperCase()
  const isNatural = curveValue === 'NATURAL'
  const isPower = curveValue === 'POWER'
  const isSigmoid = curveValue === 'SIGMOID'
  const isJump = curveValue === 'JUMP'
  const vHalfValue = sensitivity.naturalVHalf ?? ''
  const powerVRefValue = sensitivity.powerVRef ?? ''
  const powerExponentValue = sensitivity.powerExponent ?? ''
  const sigmoidMidValue = sensitivity.sigmoidMid ?? ''
  const sigmoidWidthValue = sensitivity.sigmoidWidth ?? ''
  const jumpTauValue = sensitivity.jumpTau ?? ''

  const minSensXValue = sensitivity.minSensX ?? ''
  const minSensYValue = sensitivity.minSensY ?? ''
  const maxSensXValue = sensitivity.maxSensX ?? ''
  const maxSensYValue = sensitivity.maxSensY ?? ''
  const minSensXRange = sensitivity.minSensX ?? 0
  const minSensYRange = sensitivity.minSensY ?? 0
  const maxSensXRange = sensitivity.maxSensX ?? 0
  const maxSensYRange = sensitivity.maxSensY ?? 0
  const showRollContribution = sensitivity.gyroSpace?.trim().toUpperCase() === 'YAW_PLUS_ROLL'

  const selectAllOnFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select()
  }

  return (
    <>
      <div className="flex-inputs">
        <label>
          {t('sensitivity.accelerationCurveLabel')}
          <select value={curveValue} onChange={(e) => onCurveChange(e.target.value)}>
            <option value="LINEAR">{t('sensitivity.curves.linear')}</option>
            <option value="NATURAL">{t('sensitivity.curves.natural')}</option>
            <option value="POWER">{t('sensitivity.curves.power')}</option>
            <option value="SIGMOID">{t('sensitivity.curves.sigmoid')}</option>
            <option value="QUADRATIC">{t('sensitivity.curves.quadratic')}</option>
            <option value="JUMP">{t('sensitivity.curves.jump')}</option>
          </select>
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          {t('sensitivity.minSensX')}
          <input type="number" step="0.1" min="0" value={minSensXValue} onChange={(e) => onMinSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={minSensXRange} onChange={(e) => onMinSensXChange(e.target.value)} />
        </label>
        <label>
          {t('sensitivity.minSensY')}
          <input type="number" step="0.1" min="0" value={minSensYValue} onChange={(e) => onMinSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={minSensYRange} onChange={(e) => onMinSensYChange(e.target.value)} />
        </label>
        <label>
          {t('sensitivity.maxSensX')}
          <input type="number" step="0.1" min="0" value={maxSensXValue} onChange={(e) => onMaxSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={maxSensXRange} onChange={(e) => onMaxSensXChange(e.target.value)} />
        </label>
        <label>
          {t('sensitivity.maxSensY')}
          <input type="number" step="0.1" min="0" value={maxSensYValue} onChange={(e) => onMaxSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={maxSensYRange} onChange={(e) => onMaxSensYChange(e.target.value)} />
        </label>
      </div>
      {showRollContribution && (
        <div className="flex-inputs">
          <label>
            {t('sensitivity.rollContribution')}
            <input
              type="number"
              step="1"
              min="-100"
              max="100"
              value={sensitivity.rollContribution ?? ''}
              onChange={(e) => onRollContributionChange(e.target.value)}
              onFocus={selectAllOnFocus}
            />
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={sensitivity.rollContribution ?? 0}
              onChange={(e) => onRollContributionChange(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="flex-inputs">
        <label>
          {t('sensitivity.minThreshold')}
          <input type="number" step="1" min="0" value={sensitivity.minThreshold ?? ''} onChange={(e) => onMinThresholdChange(e.target.value)} />
          <input type="range" min="0" max="500" step="1" value={sensitivity.minThreshold ?? 0} onChange={(e) => onMinThresholdChange(e.target.value)} />
        </label>
        {isNatural ? (
          <label>
            {t('sensitivity.naturalMidpoint')}
            <input
              type="number"
              step="1"
              min="0"
              value={vHalfValue}
              onChange={(e) => onNaturalVHalfChange(e.target.value)}
              placeholder={t('sensitivity.degPerSecondPlaceholder')}
            />
            <input type="range" min="1" max="500" step="1" value={vHalfValue || 0} onChange={(e) => onNaturalVHalfChange(e.target.value)} />
          </label>
        ) : isSigmoid ? (
          <>
            <label>
              {t('sensitivity.sigmoidMidpoint')}
              <input
                type="number"
                step="1"
                min="0"
                value={sigmoidMidValue}
                onChange={(e) => onSigmoidMidChange(e.target.value)}
                placeholder={t('sensitivity.degPerSecondPlaceholder')}
              />
              <input type="range" min="0" max="1000" step="1" value={sigmoidMidValue || 0} onChange={(e) => onSigmoidMidChange(e.target.value)} />
            </label>
            <label>
              {t('sensitivity.sigmoidWidth')}
              <input type="number" step="0.1" min="0" value={sigmoidWidthValue} onChange={(e) => onSigmoidWidthChange(e.target.value)} />
              <input type="range" min="0.1" max="500" step="0.1" value={sigmoidWidthValue || 0} onChange={(e) => onSigmoidWidthChange(e.target.value)} />
            </label>
          </>
        ) : isJump ? (
          <>
            <label>
              {t('sensitivity.jumpTau')}
              <input type="number" step="0.1" min="0" value={jumpTauValue} onChange={(e) => onJumpTauChange(e.target.value)} />
              <input type="range" min="0" max="500" step="0.1" value={jumpTauValue || 0} onChange={(e) => onJumpTauChange(e.target.value)} />
            </label>
            <label>
              {t('sensitivity.maxThresholdJumpPoint')}
              <input type="number" step="1" min="0" value={sensitivity.maxThreshold ?? ''} onChange={(e) => onMaxThresholdChange(e.target.value)} />
              <input type="range" min="0" max="500" step="1" value={sensitivity.maxThreshold ?? 0} onChange={(e) => onMaxThresholdChange(e.target.value)} />
            </label>
          </>
        ) : isPower ? (
          <>
            <label>
              {t('sensitivity.powerVRef')}
              <input
                type="number"
                step="1"
                min="0"
                value={powerVRefValue}
                onChange={(e) => onPowerVRefChange(e.target.value)}
                placeholder={t('sensitivity.degPerSecondPlaceholder')}
              />
              <input type="range" min="1" max="1000" step="1" value={powerVRefValue || 0} onChange={(e) => onPowerVRefChange(e.target.value)} />
            </label>
            <label>
              {t('sensitivity.powerExponent')}
              <input type="number" step="0.1" min="0" value={powerExponentValue} onChange={(e) => onPowerExponentChange(e.target.value)} />
              <input type="range" min="0.1" max="5" step="0.1" value={powerExponentValue || 0} onChange={(e) => onPowerExponentChange(e.target.value)} />
            </label>
          </>
        ) : (
          <label>
            {t('sensitivity.maxThreshold')}
            <input type="number" step="1" min="0" value={sensitivity.maxThreshold ?? ''} onChange={(e) => onMaxThresholdChange(e.target.value)} />
            <input type="range" min="0" max="500" step="1" value={sensitivity.maxThreshold ?? 0} onChange={(e) => onMaxThresholdChange(e.target.value)} />
          </label>
        )}
      </div>
    </>
  )
}
