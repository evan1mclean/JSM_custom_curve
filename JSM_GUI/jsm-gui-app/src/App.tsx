import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import { parseSensitivityValues, updateKeymapEntry } from './utils/keymap'
import { SensitivityGraph } from './components/SensitivityGraph'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'
const displayValue = (value: unknown) =>
  typeof value === 'number' || typeof value === 'string' ? value : '—'

function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [configText, setConfigText] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [recalibrating, setRecalibrating] = useState(false)
  const sensitivity = useMemo(() => parseSensitivityValues(configText), [configText])

  useEffect(() => {
    window.electronAPI?.loadKeymapFile?.().then(text => {
      setConfigText(text ?? '')
    })
  }, [])

  const applyConfig = async () => {
    try {
      const result = await window.electronAPI?.applyKeymap?.(configText)
      setStatusMessage(result?.restarted ? 'Keymap applied (JSM restarted).' : 'Keymap applied live.')
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage('Failed to apply keymap.')
    }
  }

  const handleThresholdChange = (key: 'MIN_GYRO_THRESHOLD' | 'MAX_GYRO_THRESHOLD') => (value: string) => {
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => updateKeymapEntry(prev, key, [next]))
  }

  const handleDualSensChange = (key: 'MIN_GYRO_SENS' | 'MAX_GYRO_SENS', index: 0 | 1) => (value: string) => {
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => {
      const parsed = parseSensitivityValues(prev)
      const current =
        key === 'MIN_GYRO_SENS'
          ? [parsed.minSensX ?? 0, parsed.minSensY ?? parsed.minSensX ?? 0]
          : [parsed.maxSensX ?? 0, parsed.maxSensY ?? parsed.maxSensX ?? 0]
      current[index] = next
      return updateKeymapEntry(prev, key, current)
    })
  }

const handleInGameSensChange = (value: string) => {
  const next = parseFloat(value)
  if (Number.isNaN(next)) return
  setConfigText(prev => updateKeymapEntry(prev, 'IN_GAME_SENS', [next]))
}

const handleRealWorldCalibrationChange = (value: string) => {
  const next = parseFloat(value)
  if (Number.isNaN(next)) return
  setConfigText(prev => updateKeymapEntry(prev, 'REAL_WORLD_CALIBRATION', [next]))
}

  const handleRecalibrate = async () => {
    if (isCalibrating || recalibrating) return
    setRecalibrating(true)
    try {
      const result = await window.electronAPI?.recalibrateGyro?.()
      if (result?.success) {
        setStatusMessage('Recalibration started.')
      } else {
        setStatusMessage('Failed to start recalibration.')
      }
    } catch (err) {
      console.error(err)
      setStatusMessage('Failed to start recalibration.')
    } finally {
      setRecalibrating(false)
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  return (
    <div className="app-frame">
      <div className="App legacy-shell">
        <header>
        <h1>JoyShockMapper Gyro UI</h1>
      </header>

        <section className="calibration-row">
          {isCalibrating ? (
            <div className="calibration-pill">
              Calibrating — hold controller steady ({countdown ?? '...'}s)
            </div>
          ) : (
            <button
              className="recalibrate-btn"
              onClick={handleRecalibrate}
              disabled={recalibrating}
            >
              {recalibrating ? 'Recalibrating...' : 'Recalibrate Gyro'}
            </button>
          )}
        </section>

        <section className={`control-panel lockable ${isCalibrating ? 'locked' : ''}`}>
        <div className="locked-overlay">Controls locked while JSM calibrates</div>
        <h2>Gyro Sensitivity Controls</h2>
        <div className="flex-inputs">
          <label>
            In-Game Sens
            <input
              type="number"
              step="0.1"
              value={sensitivity.inGameSens ?? ''}
              onChange={(e) => handleInGameSensChange(e.target.value)}
            />
          </label>
          <label>
            Real World Calibration
            <input
              type="number"
              step="0.1"
              value={sensitivity.realWorldCalibration ?? ''}
              onChange={(e) => handleRealWorldCalibrationChange(e.target.value)}
            />
          </label>
          <label>
            Min Threshold
            <input
              type="number"
              step="1"
              value={sensitivity.minThreshold ?? ''}
              onChange={(e) => handleThresholdChange('MIN_GYRO_THRESHOLD')(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="500"
              step="1"
              value={sensitivity.minThreshold ?? 0}
              onChange={(e) => handleThresholdChange('MIN_GYRO_THRESHOLD')(e.target.value)}
            />
          </label>
          <label>
            Max Threshold
            <input
              type="number"
              step="1"
              value={sensitivity.maxThreshold ?? ''}
              onChange={(e) => handleThresholdChange('MAX_GYRO_THRESHOLD')(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="500"
              step="1"
              value={sensitivity.maxThreshold ?? 0}
              onChange={(e) => handleThresholdChange('MAX_GYRO_THRESHOLD')(e.target.value)}
            />
          </label>
        </div>
        <div className="flex-inputs">
          <label>
            Min Sens (X)
            <input
              type="number"
              step="0.1"
              value={sensitivity.minSensX ?? ''}
              onChange={(e) => handleDualSensChange('MIN_GYRO_SENS', 0)(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={sensitivity.minSensX ?? 0}
              onChange={(e) => handleDualSensChange('MIN_GYRO_SENS', 0)(e.target.value)}
            />
          </label>
          <label>
            Min Sens (Y)
            <input
              type="number"
              step="0.1"
              value={sensitivity.minSensY ?? ''}
              onChange={(e) => handleDualSensChange('MIN_GYRO_SENS', 1)(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={sensitivity.minSensY ?? 0}
              onChange={(e) => handleDualSensChange('MIN_GYRO_SENS', 1)(e.target.value)}
            />
          </label>
          <label>
            Max Sens (X)
            <input
              type="number"
              step="0.1"
              value={sensitivity.maxSensX ?? ''}
              onChange={(e) => handleDualSensChange('MAX_GYRO_SENS', 0)(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={sensitivity.maxSensX ?? 0}
              onChange={(e) => handleDualSensChange('MAX_GYRO_SENS', 0)(e.target.value)}
            />
          </label>
          <label>
            Max Sens (Y)
            <input
              type="number"
              step="0.1"
              value={sensitivity.maxSensY ?? ''}
              onChange={(e) => handleDualSensChange('MAX_GYRO_SENS', 1)(e.target.value)}
            />
            <input
              type="range"
              min="0"
              max="30"
              step="0.1"
              value={sensitivity.maxSensY ?? 0}
              onChange={(e) => handleDualSensChange('MAX_GYRO_SENS', 1)(e.target.value)}
            />
          </label>
        </div>
        <button onClick={applyConfig}>Apply Changes</button>
      </section>

        <section className="graph-panel">
        <h2>Curve Preview</h2>
        <div className="graph-legend">
          <span><span className="legend-dot sensitivity" /> Sensitivity</span>
          <span><span className="legend-dot velocity" /> Normalized output velocity</span>
        </div>
        <SensitivityGraph
          minThreshold={sensitivity.minThreshold}
          maxThreshold={sensitivity.maxThreshold}
          minSensX={sensitivity.minSensX}
          minSensY={sensitivity.minSensY}
          maxSensX={sensitivity.maxSensX}
          maxSensY={sensitivity.maxSensY}
          normalized={asNumber(sample?.t)}
          currentSensX={asNumber(sample?.sensX)}
          currentSensY={asNumber(sample?.sensY)}
          omega={asNumber(sample?.omega)}
        />
        <small>Live dot follows telemetry t-value using yaw sensitivity.</small>
      </section>

        <section className="telemetry-banner">
        <p className="telemetry-heading">Live packets streaming</p>
        <div className="telemetry-readouts">
          <span>ω: <strong>{formatNumber(asNumber(sample?.omega))}°/s</strong></span>
          <span>t: <strong>{formatNumber(asNumber(sample?.t))}</strong></span>
          <span>Sens X/Y: <strong>{formatNumber(asNumber(sample?.sensX))}/{formatNumber(asNumber(sample?.sensY))}</strong></span>
          <span>Timestamp: <strong>{displayValue(sample?.ts)}</strong></span>
        </div>
      </section>

        <section className="config-panel legacy">
        <label>
          keymap_01.txt
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={12}
          />
        </label>
        <div className="config-actions">
          <button onClick={applyConfig}>Apply Changes</button>
        </div>
        {statusMessage && <p className="status-message">{statusMessage}</p>}
        </section>
      </div>
    </div>
  )
}

export default App
