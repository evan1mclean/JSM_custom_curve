import { SensitivityValues } from '../utils/keymap'
import { Card } from './Card'
import { SectionActions } from './SectionActions'

const TICK_TIME_OPTIONS = [
  { value: '1', label: '500 Hz (1 ms)' },
  { value: '2', label: '333 Hz (2 ms)' },
  { value: '3', label: '250 Hz (3 ms)' },
]

const GYRO_SPACE_OPTIONS = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'PLAYER_TURN', label: 'Player Turn' },
  { value: 'WORLD_TURN', label: 'World Turn' },
]

type GyroBehaviorControlsProps = {
  sensitivity: SensitivityValues
  isCalibrating: boolean
  statusMessage?: string | null
  onInGameSensChange: (value: string) => void
  onRealWorldCalibrationChange: (value: string) => void
  onTickTimeChange: (value: string) => void
  onGyroSpaceChange: (value: string) => void
  onGyroAxisXChange: (value: string) => void
  onGyroAxisYChange: (value: string) => void
  counterOsMouseSpeed: boolean
  onCounterOsMouseSpeedChange: (enabled: boolean) => void
  hasPendingChanges: boolean
  onApply: () => void
  onCancel: () => void
}

export function GyroBehaviorControls({
  sensitivity,
  isCalibrating,
  statusMessage,
  onInGameSensChange,
  onRealWorldCalibrationChange,
  onTickTimeChange,
  onGyroSpaceChange,
  onGyroAxisXChange,
  onGyroAxisYChange,
  counterOsMouseSpeed,
  onCounterOsMouseSpeedChange,
  hasPendingChanges,
  onApply,
  onCancel,
}: GyroBehaviorControlsProps) {
  return (
    <Card
      className="control-panel"
      lockable
      locked={isCalibrating}
      lockMessage="Controls locked while JSM calibrates"
    >
      <h2>Gyro Behavior</h2>
      <div className="flex-inputs">
        <label>
          Real World Calibration
          <input
            type="number"
            step="0.1"
            value={sensitivity.realWorldCalibration ?? ''}
            onChange={(e) => onRealWorldCalibrationChange(e.target.value)}
          />
        </label>
        <label>
          In-Game Sensitivity
          <input
            type="number"
            step="0.1"
            value={sensitivity.inGameSens ?? ''}
            onChange={(e) => onInGameSensChange(e.target.value)}
          />
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Polling Tick Time
          <select
            value={sensitivity.tickTime?.toString() ?? ''}
            onChange={(e) => onTickTimeChange(e.target.value)}
          >
            <option value="">Use default</option>
            {TICK_TIME_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gyro Space
          <select
            value={sensitivity.gyroSpace ?? ''}
            onChange={(e) => onGyroSpaceChange(e.target.value)}
          >
            <option value="">Use default</option>
            {GYRO_SPACE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Gyro Axis X
          <select
            value={sensitivity.gyroAxisX ?? ''}
            onChange={(e) => onGyroAxisXChange(e.target.value)}
          >
            <option value="">Default</option>
            <option value="INVERTED">Inverted</option>
          </select>
        </label>
        <label>
          Gyro Axis Y
          <select
            value={sensitivity.gyroAxisY ?? ''}
            onChange={(e) => onGyroAxisYChange(e.target.value)}
          >
            <option value="">Default</option>
            <option value="INVERTED">Inverted</option>
          </select>
        </label>
      </div>
      <div className="flex-inputs">
        <label>
          Counter OS mouse speed
          <p className="field-description">Enable for non-raw-input games when Windows pointer speed isn’t 6/11.</p>
          <select
            className="app-select"
            value={counterOsMouseSpeed ? 'ON' : 'OFF'}
            onChange={(event) => onCounterOsMouseSpeedChange(event.target.value === 'ON')}
            disabled={isCalibrating}
          >
            <option value="OFF">Off (default)</option>
            <option value="ON">On</option>
          </select>
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
