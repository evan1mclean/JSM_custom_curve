import { SensitivityValues } from '../utils/keymap'

type AccelSensFormProps = {
  sensitivity: SensitivityValues
  onCurveChange: (value: string) => void
  onNaturalVHalfChange: (value: string) => void
  onPowerVRefChange: (value: string) => void
  onPowerExponentChange: (value: string) => void
  onMinThresholdChange: (value: string) => void
  onMaxThresholdChange: (value: string) => void
  onMinSensXChange: (value: string) => void
  onMinSensYChange: (value: string) => void
  onMaxSensXChange: (value: string) => void
  onMaxSensYChange: (value: string) => void
}

export function AccelSensForm({
  sensitivity,
  onCurveChange,
  onNaturalVHalfChange,
  onPowerVRefChange,
  onPowerExponentChange,
  onMinThresholdChange,
  onMaxThresholdChange,
  onMinSensXChange,
  onMinSensYChange,
  onMaxSensXChange,
  onMaxSensYChange,
}: AccelSensFormProps) {
  const curveValue = (sensitivity.accelCurve ?? 'LINEAR').toUpperCase()
  const isNatural = curveValue === 'NATURAL'
  const isPower = curveValue === 'POWER'
  const vHalfValue = sensitivity.naturalVHalf ?? ''
  const powerVRefValue = sensitivity.powerVRef ?? ''
  const powerExponentValue = sensitivity.powerExponent ?? ''

  const minSensXValue = sensitivity.minSensX ?? ''
  const minSensYValue = sensitivity.minSensY ?? sensitivity.minSensX ?? ''
  const maxSensXValue = sensitivity.maxSensX ?? ''
  const maxSensYValue = sensitivity.maxSensY ?? sensitivity.maxSensX ?? ''
  const minSensXRange = sensitivity.minSensX ?? 0
  const minSensYRange = sensitivity.minSensY ?? sensitivity.minSensX ?? 0
  const maxSensXRange = sensitivity.maxSensX ?? 0
  const maxSensYRange = sensitivity.maxSensY ?? sensitivity.maxSensX ?? 0
  return (
    <>
      <div className="flex-inputs">
        <label>
          Acceleration curve
          <select value={curveValue} onChange={(e) => onCurveChange(e.target.value)}>
            <option value="LINEAR">Linear</option>
            <option value="NATURAL">Natural</option>
            <option value="POWER">Power</option>
          </select>
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Min Sens (X)
          <input type="number" step="0.1" value={minSensXValue} onChange={(e) => onMinSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={minSensXRange} onChange={(e) => onMinSensXChange(e.target.value)} />
        </label>
        <label>
          Min Sens (Y)
          <input type="number" step="0.1" value={minSensYValue} onChange={(e) => onMinSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={minSensYRange} onChange={(e) => onMinSensYChange(e.target.value)} />
        </label>
        <label>
          Max Sens (X)
          <input type="number" step="0.1" value={maxSensXValue} onChange={(e) => onMaxSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={maxSensXRange} onChange={(e) => onMaxSensXChange(e.target.value)} />
        </label>
        <label>
          Max Sens (Y)
          <input type="number" step="0.1" value={maxSensYValue} onChange={(e) => onMaxSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={maxSensYRange} onChange={(e) => onMaxSensYChange(e.target.value)} />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Min Threshold
          <input type="number" step="1" value={sensitivity.minThreshold ?? ''} onChange={(e) => onMinThresholdChange(e.target.value)} />
          <input type="range" min="0" max="500" step="1" value={sensitivity.minThreshold ?? 0} onChange={(e) => onMinThresholdChange(e.target.value)} />
        </label>
        {isNatural ? (
          <label>
            Natural midpoint (vHalf)
            <input
              type="number"
              step="1"
              min="0"
              value={vHalfValue}
              onChange={(e) => onNaturalVHalfChange(e.target.value)}
              placeholder="deg/sec"
            />
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={vHalfValue || 0}
              onChange={(e) => onNaturalVHalfChange(e.target.value)}
            />
          </label>
        ) : isPower ? (
          <>
            <label>
              Power vRef
              <input
                type="number"
                step="1"
                min="0"
                value={powerVRefValue}
                onChange={(e) => onPowerVRefChange(e.target.value)}
                placeholder="deg/sec"
              />
              <input
                type="range"
                min="1"
                max="1000"
                step="1"
                value={powerVRefValue || 0}
                onChange={(e) => onPowerVRefChange(e.target.value)}
              />
            </label>
            <label>
              Power exponent
              <input
                type="number"
                step="0.1"
                min="0"
                value={powerExponentValue}
                onChange={(e) => onPowerExponentChange(e.target.value)}
              />
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={powerExponentValue || 0}
                onChange={(e) => onPowerExponentChange(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Max Threshold
            <input type="number" step="1" value={sensitivity.maxThreshold ?? ''} onChange={(e) => onMaxThresholdChange(e.target.value)} />
            <input type="range" min="0" max="500" step="1" value={sensitivity.maxThreshold ?? 0} onChange={(e) => onMaxThresholdChange(e.target.value)} />
          </label>
        )}
      </div>
    </>
  )
}
