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
  devices?: {
    handle: number
    type: number
    split?: number
    vid?: number
    pid?: number
  }[]
  ignoredDevices?: string[]
  onToggleIgnoreDevice?: (vid: number, pid: number, ignore: boolean) => void
  onInGameSensChange: (value: string) => void
  onRealWorldCalibrationChange: (value: string) => void
  onTickTimeChange: (value: string) => void
  onGyroSpaceChange: (value: string) => void
  onGyroAxisXChange: (value: string) => void
  onGyroAxisYChange: (value: string) => void
  counterOsMouseSpeed: boolean
  onCounterOsMouseSpeedChange: (enabled: boolean) => void
  onOpenCalibration?: () => void
  hasPendingChanges: boolean
  onApply: () => void
  onCancel: () => void
  lockMessage?: string
}

export function GyroBehaviorControls({
  sensitivity,
  isCalibrating,
  statusMessage,
  devices,
  ignoredDevices,
  onToggleIgnoreDevice,
  onInGameSensChange,
  onRealWorldCalibrationChange,
  onTickTimeChange,
  onGyroSpaceChange,
  onGyroAxisXChange,
  onGyroAxisYChange,
  counterOsMouseSpeed,
  onCounterOsMouseSpeedChange,
  onOpenCalibration,
  hasPendingChanges,
  onApply,
  onCancel,
  lockMessage = 'Calibrating — place controller on a flat surface',
}: GyroBehaviorControlsProps) {
  const controllerLabel = (type?: number) => {
    switch (type) {
      case 1:
        return 'Joy-Con (Left)'
      case 2:
        return 'Joy-Con (Right)'
      case 3:
        return 'Switch Pro'
      case 4:
        return 'DualShock 4'
      case 5:
        return 'DualSense'
      case 6:
        return 'Xbox One'
      case 7:
        return 'Xbox Elite'
      case 8:
        return 'Xbox Series'
      default:
        return 'Unknown'
    }
  }
  const formatVidPid = (vid?: number, pid?: number) => {
    const v = typeof vid === 'number' ? vid : undefined
    const p = typeof pid === 'number' ? pid : undefined
    if (v === undefined && p === undefined) return ''
    const toHex = (value: number) => `0x${value.toString(16).padStart(4, '0')}`
    if (v !== undefined && p !== undefined) return `${toHex(v)}:${toHex(p)}`
    if (v !== undefined) return toHex(v)
    return toHex(p!)
  }

  return (
    <Card
      className="control-panel"
      lockable
      locked={isCalibrating}
      lockMessage={lockMessage}
    >
      <h2>Gyro Behavior</h2>
      {onOpenCalibration && (
        <div className="flex-inputs">
          <button type="button" className="secondary-btn full-width-btn" onClick={onOpenCalibration} disabled={isCalibrating}>
            Calculate real world calibration
          </button>
        </div>
      )}
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
      {devices && devices.length > 0 && (
        <div className="flex-inputs">
          <label>
            Connected controllers
            <p className="field-description">Controller type and VID:PID detected by JSM. Toggle to ignore gyro output per device.</p>
            <div className="controller-list">
              {devices.map(dev => {
                const id = formatVidPid(dev.vid, dev.pid)
                const isIgnored = id ? ignoredDevices?.includes(id.toLowerCase()) : false
                const disabled = !dev.vid || !dev.pid
                return (
                  <div key={dev.handle} className="controller-card">
                    <div className="controller-entry">
                      {controllerLabel(dev.type)}
                      {id && <span className="controller-vidpid">: {id}</span>}
                    </div>
                    <label className="toggle-switch">
                      <span className="toggle-label">Ignore gyro output</span>
                      <div className="toggle-wrapper">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={Boolean(isIgnored)}
                          onChange={(event) => {
                            if (!dev.vid || !dev.pid) return
                            onToggleIgnoreDevice?.(dev.vid, dev.pid, event.target.checked)
                          }}
                        />
                        <span className="toggle-slider" />
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>
          </label>
        </div>
      )}
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
