import { SensitivityValues } from '../utils/keymap'

type SensitivityControlsProps = {
  sensitivity: SensitivityValues
  isCalibrating: boolean
  hasPendingChanges: boolean
  onApply: () => void
  onInGameSensChange: (value: string) => void
  onRealWorldCalibrationChange: (value: string) => void
  onMinThresholdChange: (value: string) => void
  onMaxThresholdChange: (value: string) => void
  onMinSensXChange: (value: string) => void
  onMinSensYChange: (value: string) => void
  onMaxSensXChange: (value: string) => void
  onMaxSensYChange: (value: string) => void
}

export function SensitivityControls({
  sensitivity,
  isCalibrating,
  hasPendingChanges,
  onApply,
  onInGameSensChange,
  onRealWorldCalibrationChange,
  onMinThresholdChange,
  onMaxThresholdChange,
  onMinSensXChange,
  onMinSensYChange,
  onMaxSensXChange,
  onMaxSensYChange,
}: SensitivityControlsProps) {
  return (
    <section className={`control-panel lockable ${isCalibrating ? 'locked' : ''}`}>
      <div className="locked-overlay">Controls locked while JSM calibrates</div>
      <h2>Gyro Sensitivity Controls</h2>
      <div className="flex-inputs">
        <label>
          In-Game Sens
          <input type="number" step="0.1" value={sensitivity.inGameSens ?? ''} onChange={(e) => onInGameSensChange(e.target.value)} />
        </label>
        <label>
          Real World Calibration
          <input type="number" step="0.1" value={sensitivity.realWorldCalibration ?? ''} onChange={(e) => onRealWorldCalibrationChange(e.target.value)} />
        </label>
        <label>
          Min Threshold
          <input type="number" step="1" value={sensitivity.minThreshold ?? ''} onChange={(e) => onMinThresholdChange(e.target.value)} />
          <input type="range" min="0" max="500" step="1" value={sensitivity.minThreshold ?? 0} onChange={(e) => onMinThresholdChange(e.target.value)} />
        </label>
        <label>
          Max Threshold
          <input type="number" step="1" value={sensitivity.maxThreshold ?? ''} onChange={(e) => onMaxThresholdChange(e.target.value)} />
          <input type="range" min="0" max="500" step="1" value={sensitivity.maxThreshold ?? 0} onChange={(e) => onMaxThresholdChange(e.target.value)} />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Min Sens (X)
          <input type="number" step="0.1" value={sensitivity.minSensX ?? ''} onChange={(e) => onMinSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.minSensX ?? 0} onChange={(e) => onMinSensXChange(e.target.value)} />
        </label>
        <label>
          Min Sens (Y)
          <input type="number" step="0.1" value={sensitivity.minSensY ?? ''} onChange={(e) => onMinSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.minSensY ?? 0} onChange={(e) => onMinSensYChange(e.target.value)} />
        </label>
        <label>
          Max Sens (X)
          <input type="number" step="0.1" value={sensitivity.maxSensX ?? ''} onChange={(e) => onMaxSensXChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.maxSensX ?? 0} onChange={(e) => onMaxSensXChange(e.target.value)} />
        </label>
        <label>
          Max Sens (Y)
          <input type="number" step="0.1" value={sensitivity.maxSensY ?? ''} onChange={(e) => onMaxSensYChange(e.target.value)} />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.maxSensY ?? 0} onChange={(e) => onMaxSensYChange(e.target.value)} />
        </label>
      </div>
      <div className="control-actions">
        <button onClick={onApply}>Apply Changes</button>
        {hasPendingChanges && (
          <span className="pending-banner">Pending changes — click Apply to send to JoyShockMapper.</span>
        )}
      </div>
    </section>
  )
}
