import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import { parseSensitivityValues, updateKeymapEntry } from './utils/keymap'
import { SensitivityControls } from './components/SensitivityControls'
import { CurvePreview } from './components/CurvePreview'
import { TelemetryBanner } from './components/TelemetryBanner'
import { ConfigEditor } from './components/ConfigEditor'
import { CalibrationCard } from './components/CalibrationCard'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'
const displayValue = (value: unknown) =>
  typeof value === 'number' || typeof value === 'string' ? value : '—'

function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [configText, setConfigText] = useState('')
  const [appliedConfig, setAppliedConfig] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [recalibrating, setRecalibrating] = useState(false)
  const sensitivity = useMemo(() => parseSensitivityValues(configText), [configText])

  useEffect(() => {
    window.electronAPI?.loadKeymapFile?.().then(text => {
      const next = text ?? ''
      setConfigText(next)
      setAppliedConfig(next)
    })
  }, [])

  const applyConfig = async () => {
    try {
      const result = await window.electronAPI?.applyKeymap?.(configText)
      setStatusMessage(result?.restarted ? 'Keymap applied (JSM restarted).' : 'Keymap applied live.')
      setAppliedConfig(configText)
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

  const hasPendingChanges = configText !== appliedConfig

  const telemetryValues = {
    omega: formatNumber(asNumber(sample?.omega)),
    normalized: formatNumber(asNumber(sample?.t)),
    sensX: formatNumber(asNumber(sample?.sensX)),
    sensY: formatNumber(asNumber(sample?.sensY)),
    timestamp: String(displayValue(sample?.ts)),
  }

  return (
    <div className="app-frame">
      <div className="App legacy-shell">
        <header>
          <h1>JoyShockMapper Gyro UI</h1>
        </header>

        <CalibrationCard
          isCalibrating={isCalibrating}
          countdown={countdown}
          recalibrating={recalibrating}
          onRecalibrate={handleRecalibrate}
        />

        <SensitivityControls
          sensitivity={sensitivity}
          isCalibrating={isCalibrating}
          hasPendingChanges={hasPendingChanges}
          onApply={applyConfig}
          onInGameSensChange={handleInGameSensChange}
          onRealWorldCalibrationChange={handleRealWorldCalibrationChange}
          onMinThresholdChange={handleThresholdChange('MIN_GYRO_THRESHOLD')}
          onMaxThresholdChange={handleThresholdChange('MAX_GYRO_THRESHOLD')}
          onMinSensXChange={handleDualSensChange('MIN_GYRO_SENS', 0)}
          onMinSensYChange={handleDualSensChange('MIN_GYRO_SENS', 1)}
          onMaxSensXChange={handleDualSensChange('MAX_GYRO_SENS', 0)}
          onMaxSensYChange={handleDualSensChange('MAX_GYRO_SENS', 1)}
        />

        <CurvePreview sensitivity={sensitivity} sample={sample} hasPendingChanges={hasPendingChanges} />

        <TelemetryBanner {...telemetryValues} />

        <ConfigEditor value={configText} onChange={setConfigText} onApply={applyConfig} statusMessage={statusMessage} />
      </div>
    </div>
  )
}

export default App
