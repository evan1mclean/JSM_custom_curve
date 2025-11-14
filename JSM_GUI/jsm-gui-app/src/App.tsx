import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import { parseSensitivityValues, updateKeymapEntry, removeKeymapEntry, getKeymapValue } from './utils/keymap'
import { SensitivityControls } from './components/SensitivityControls'
import { ConfigEditor } from './components/ConfigEditor'
import { CalibrationCard } from './components/CalibrationCard'
import { ProfileManager } from './components/ProfileManager'
import { GyroBehaviorControls } from './components/GyroBehaviorControls'
import { NoiseSteadyingControls } from './components/NoiseSteadyingControls'
import { KeymapControls } from './components/KeymapControls'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'

type ProfileInfo = { id: number; name: string }
const TOGGLE_SPECIALS = ['GYRO_ON', 'GYRO_OFF'] as const
const clearToggleAssignments = (text: string, command: string) => {
  let next = text
  TOGGLE_SPECIALS.forEach(toggle => {
    const assigned = getKeymapValue(next, toggle)
    if (assigned) {
      const matches = assigned
        .split(/\s+/)
        .filter(Boolean)
        .some(token => token.toUpperCase() === command.toUpperCase())
      if (matches) {
        next = removeKeymapEntry(next, toggle)
      }
    }
  })
  return next
}

function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [configText, setConfigText] = useState('')
  const [appliedConfig, setAppliedConfig] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [recalibrating, setRecalibrating] = useState(false)
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null)
  const [lastAppliedProfileId, setLastAppliedProfileId] = useState<number | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [profileCopyStatus, setProfileCopyStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'gyro' | 'keymap'>('gyro')
  const sensitivity = useMemo(() => parseSensitivityValues(configText), [configText])
  const loadProfileContent = useCallback(async (profileId: number) => {
    if (!profileId) return
    setIsLoadingProfile(true)
    try {
      const text = await window.electronAPI?.loadProfile?.(profileId)
      const next = text ?? ''
      setConfigText(next)
      setAppliedConfig(next)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [])

  const refreshProfiles = useCallback(async () => {
    const state = await window.electronAPI?.getProfiles?.()
    if (state) {
      setProfiles(state.profiles)
      setActiveProfileId(state.activeProfile)
    }
    return state
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      const state = await refreshProfiles()
      const initialProfileId = state?.activeProfile ?? 1
      setActiveProfileId(initialProfileId)
      await loadProfileContent(initialProfileId)
      setLastAppliedProfileId(initialProfileId)
    }
    bootstrap()
  }, [loadProfileContent, refreshProfiles])

  const applyConfig = async () => {
    if (!activeProfileId) {
      return
    }
    try {
      const result = await window.electronAPI?.applyProfile?.(activeProfileId, configText)
      const profileName = profiles.find(profile => profile.id === activeProfileId)?.name ?? `Profile ${activeProfileId}`
      setStatusMessage(
        result?.restarted ? `Applied ${profileName} (JSM restarted).` : `Applied ${profileName} without restart.`
      )
      setAppliedConfig(configText)
      setLastAppliedProfileId(activeProfileId)
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage('Failed to apply keymap.')
    }
  }

  const handleThresholdChange = (key: 'MIN_GYRO_THRESHOLD' | 'MAX_GYRO_THRESHOLD') => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, key))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => updateKeymapEntry(prev, key, [next]))
  }

  const makeScalarHandler = (key: string) => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, key))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => updateKeymapEntry(prev, key, [next]))
  }

  const handleCutoffSpeedChange = makeScalarHandler('GYRO_CUTOFF_SPEED')
  const handleCutoffRecoveryChange = makeScalarHandler('GYRO_CUTOFF_RECOVERY')
  const handleSmoothTimeChange = makeScalarHandler('GYRO_SMOOTH_TIME')
  const handleSmoothThresholdChange = makeScalarHandler('GYRO_SMOOTH_THRESHOLD')
  const handleTickTimeChange = makeScalarHandler('TICK_TIME')

  const makeStringHandler = (key: string) => (value: string) => {
    if (!value) {
      setConfigText(prev => removeKeymapEntry(prev, key))
      return
    }
    setConfigText(prev => updateKeymapEntry(prev, key, [value]))
  }

  const handleGyroSpaceChange = makeStringHandler('GYRO_SPACE')
  const handleGyroAxisXChange = (value: string) => {
    if (!value) {
      setConfigText(prev => removeKeymapEntry(prev, 'GYRO_AXIS_X'))
      return
    }
    setConfigText(prev => updateKeymapEntry(prev, 'GYRO_AXIS_X', [value]))
  }
  const handleGyroAxisYChange = (value: string) => {
    if (!value) {
      setConfigText(prev => removeKeymapEntry(prev, 'GYRO_AXIS_Y'))
      return
    }
    setConfigText(prev => updateKeymapEntry(prev, 'GYRO_AXIS_Y', [value]))
  }

  const handleDualSensChange = (key: 'MIN_GYRO_SENS' | 'MAX_GYRO_SENS', index: 0 | 1) => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, key))
      return
    }
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

  const handleStaticSensChange = (index: 0 | 1) => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, 'GYRO_SENS'))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => {
      const parsed = parseSensitivityValues(prev)
      const current: [number, number] = [
        parsed.gyroSensX ?? parsed.minSensX ?? parsed.maxSensX ?? 1,
        parsed.gyroSensY ?? parsed.minSensY ?? parsed.maxSensY ?? parsed.gyroSensX ?? 1,
      ]
      current[index] = next
      return updateKeymapEntry(prev, 'GYRO_SENS', current)
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

  const switchToStaticMode = () => {
    const mode = sensitivity.gyroSensX !== undefined ? 'static' : 'accel'
    if (mode === 'static') return
    const defaultX = sensitivity.minSensX ?? sensitivity.maxSensX ?? 1
    const defaultY = sensitivity.minSensY ?? sensitivity.maxSensY ?? defaultX
    setConfigText(prev => {
      let next = updateKeymapEntry(prev, 'GYRO_SENS', [defaultX, defaultY])
      ;['MIN_GYRO_SENS', 'MAX_GYRO_SENS', 'MIN_GYRO_THRESHOLD', 'MAX_GYRO_THRESHOLD'].forEach(key => {
        next = removeKeymapEntry(next, key)
      })
      return next
    })
  }

  const switchToAccelMode = () => {
    const mode = sensitivity.gyroSensX !== undefined ? 'static' : 'accel'
    if (mode === 'accel') return
    const defaultX = sensitivity.gyroSensX ?? 1
    const defaultY = sensitivity.gyroSensY ?? defaultX
    setConfigText(prev => {
      let next = removeKeymapEntry(prev, 'GYRO_SENS')
      next = updateKeymapEntry(next, 'MIN_GYRO_SENS', [sensitivity.minSensX ?? defaultX, sensitivity.minSensY ?? defaultY])
      next = updateKeymapEntry(next, 'MAX_GYRO_SENS', [sensitivity.maxSensX ?? defaultX, sensitivity.maxSensY ?? defaultY])
      next = updateKeymapEntry(next, 'MIN_GYRO_THRESHOLD', [sensitivity.minThreshold ?? 0])
      next = updateKeymapEntry(next, 'MAX_GYRO_THRESHOLD', [sensitivity.maxThreshold ?? 100])
      return next
    })
  }

  const hasPendingChanges = Boolean(activeProfileId && configText !== appliedConfig)
  const activeProfileApplied = Boolean(activeProfileId && lastAppliedProfileId === activeProfileId)

  const handleCancel = () => {
    setConfigText(appliedConfig)
  }

  const handleProfileSwitch = async (profileId: number) => {
    if (profileId === activeProfileId) return
    if (hasPendingChanges) {
      const shouldSwitch = window.confirm('You have unsaved changes on this profile. Switch anyway?')
      if (!shouldSwitch) return
    }
    try {
      const nextState = await window.electronAPI?.setActiveProfile?.(profileId)
      if (nextState) {
        setProfiles(nextState.profiles)
        setActiveProfileId(nextState.activeProfile)
        await loadProfileContent(nextState.activeProfile)
      } else {
        setActiveProfileId(profileId)
        await loadProfileContent(profileId)
      }
      setStatusMessage(null)
    } catch (err) {
      console.error('Failed to switch profiles', err)
    }
  }

  const handleProfileRename = async (profileId: number, name: string) => {
    try {
      const nextState = await window.electronAPI?.renameProfile?.(profileId, name)
      if (nextState) {
        setProfiles(nextState.profiles)
      }
    } catch (err) {
      console.error('Failed to rename profile', err)
    }
  }

  const handleKeyBindingChange = (command: string, binding: string) => {
    setConfigText(prev => {
      const next = clearToggleAssignments(prev, command)
      const value = binding.trim()
      if (!value) {
        const removed = removeKeymapEntry(next, command)
        return removeTrackballDecayIfUnused(removed)
      }
      return updateKeymapEntry(next, command, [value])
    })
  }

  const TRACKBALL_SPECIALS = ['GYRO_TRACKBALL', 'GYRO_TRACK_X', 'GYRO_TRACK_Y'] as const

  const removeTrackballDecayIfUnused = (text: string) => {
    const hasSpecial = TRACKBALL_SPECIALS.some(cmd => Boolean(getKeymapValue(text, cmd)))
    if (hasSpecial) return text
    const hasDirect = ['S', 'E', 'N', 'W'].some(command => getKeymapValue(text, command)?.toUpperCase().includes('TRACK'))
    if (hasDirect) return text
    return removeKeymapEntry(text, 'TRACKBALL_DECAY')
  }

  const handleSpecialActionAssignment = (specialCommand: string, buttonCommand: string) => {
    setConfigText(prev => {
      let next = removeKeymapEntry(prev, buttonCommand)
      next = clearToggleAssignments(next, buttonCommand)
      if (TOGGLE_SPECIALS.includes(specialCommand as (typeof TOGGLE_SPECIALS)[number])) {
        return removeTrackballDecayIfUnused(updateKeymapEntry(next, specialCommand, [buttonCommand]))
      }
      next = updateKeymapEntry(next, buttonCommand, [specialCommand])
      return removeTrackballDecayIfUnused(next)
    })
  }

  const handleClearSpecialAction = (specialCommand: string, buttonCommand: string) => {
    setConfigText(prev => {
      const assignment = getKeymapValue(prev, specialCommand)
      if (assignment) {
        const matches = assignment
          .split(/\s+/)
          .filter(Boolean)
          .some(token => token.toUpperCase() === buttonCommand.toUpperCase())
        if (matches) {
          const updated = removeKeymapEntry(prev, specialCommand)
          return removeTrackballDecayIfUnused(updated)
        }
      }
      return prev
    })
  }

  const handleTrackballDecayChange = (value: string) => {
    const nextValue = value.trim()
    setConfigText(prev => {
      if (!nextValue) {
        return removeKeymapEntry(prev, 'TRACKBALL_DECAY')
      }
      const numeric = Number(nextValue)
      if (Number.isNaN(numeric)) {
        return prev
      }
      return updateKeymapEntry(prev, 'TRACKBALL_DECAY', [numeric])
    })
  }

  const handleProfileCopy = async (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return
    try {
      const updated = await window.electronAPI?.copyProfile?.(sourceId, targetId)
      if (updated) {
        setProfiles(updated.profiles)
      }
      if (targetId === activeProfileId) {
        await loadProfileContent(targetId)
        setLastAppliedProfileId(prev => (prev === targetId ? null : prev))
      }
      const sourceName = profiles.find(profile => profile.id === sourceId)?.name ?? `Profile ${sourceId}`
      const targetName = profiles.find(profile => profile.id === targetId)?.name ?? `Profile ${targetId}`
      setProfileCopyStatus(`Copied ${sourceName} into ${targetName}`)
      setTimeout(() => setProfileCopyStatus(null), 2500)
    } catch (err) {
      console.error('Failed to copy profile', err)
      setProfileCopyStatus('Failed to copy profile')
      setTimeout(() => setProfileCopyStatus(null), 2500)
    }
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

  const handleImportProfile = async (fileContent: string) => {
    if (!activeProfileId || !fileContent) return
    try {
      const result = await window.electronAPI?.importProfileConfig?.(activeProfileId, fileContent)
      if (result?.success) {
        await loadProfileContent(activeProfileId)
        setLastAppliedProfileId(prev => (prev === activeProfileId ? null : prev))
        setStatusMessage('Profile imported successfully.')
      } else {
        setStatusMessage('Failed to import profile.')
      }
    } catch (err) {
      console.error('Failed to import profile', err)
      setStatusMessage('Failed to import profile.')
    } finally {
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  const formatTimestamp = (value: unknown) => {
    if (typeof value === 'number') {
      const date = new Date(value)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      const ms = String(date.getMilliseconds()).padStart(3, '0')
      return `${hours}:${minutes}:${seconds}.${ms}`
    }
    if (typeof value === 'string') {
      return value
    }
    return '—'
  }

  const telemetryValues = {
    omega: formatNumber(asNumber(sample?.omega)),
    sensX: formatNumber(asNumber(sample?.sensX)),
    sensY: formatNumber(asNumber(sample?.sensY)),
    timestamp: formatTimestamp(sample?.ts),
  }
  const trackballDecayValue = useMemo(() => getKeymapValue(configText, 'TRACKBALL_DECAY') ?? '', [configText])

  const currentMode: 'static' | 'accel' = sensitivity.gyroSensX !== undefined ? 'static' : 'accel'
  const activeProfileName = profiles.find(profile => profile.id === activeProfileId)?.name
  const activeProfileFile = activeProfileId ? `keymap_0${activeProfileId}.txt` : null
  const profileFileLabel = activeProfileFile
    ? `${activeProfileFile} — ${activeProfileName ?? `Profile ${activeProfileId}`}`
    : 'Select a profile to begin'

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

        <ProfileManager
          profiles={profiles}
          activeProfileId={activeProfileId}
          hasPendingChanges={hasPendingChanges}
          isCalibrating={isCalibrating}
          profileApplied={activeProfileApplied}
          copyStatus={profileCopyStatus}
          onSelectProfile={handleProfileSwitch}
          onRenameProfile={handleProfileRename}
          onCopyProfile={handleProfileCopy}
          onApplyProfile={applyConfig}
          applyDisabled={!activeProfileId || isLoadingProfile}
          onImportProfile={handleImportProfile}
        />

        <div className="tab-bar">
          <button
            className={`pill-tab tab-button ${activeTab === 'gyro' ? 'active' : ''}`}
            onClick={() => setActiveTab('gyro')}
          >
            Gyro & Sensitivity
          </button>
          <button
            className={`pill-tab tab-button ${activeTab === 'keymap' ? 'active' : ''}`}
            onClick={() => setActiveTab('keymap')}
          >
            Keymap
          </button>
        </div>

        {activeTab === 'gyro' && (
          <>
            <GyroBehaviorControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              onInGameSensChange={handleInGameSensChange}
              onRealWorldCalibrationChange={handleRealWorldCalibrationChange}
              onTickTimeChange={handleTickTimeChange}
              onGyroSpaceChange={handleGyroSpaceChange}
              onGyroAxisXChange={handleGyroAxisXChange}
              onGyroAxisYChange={handleGyroAxisYChange}
              hasPendingChanges={hasPendingChanges}
              onApply={applyConfig}
              onCancel={handleCancel}
            />

            <SensitivityControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              mode={currentMode}
              hasPendingChanges={hasPendingChanges}
              sample={sample}
              telemetry={telemetryValues}
              onModeChange={(mode) => (mode === 'static' ? switchToStaticMode() : switchToAccelMode())}
              onApply={applyConfig}
              onCancel={handleCancel}
              onMinThresholdChange={handleThresholdChange('MIN_GYRO_THRESHOLD')}
              onMaxThresholdChange={handleThresholdChange('MAX_GYRO_THRESHOLD')}
              onMinSensXChange={handleDualSensChange('MIN_GYRO_SENS', 0)}
              onMinSensYChange={handleDualSensChange('MIN_GYRO_SENS', 1)}
              onMaxSensXChange={handleDualSensChange('MAX_GYRO_SENS', 0)}
              onMaxSensYChange={handleDualSensChange('MAX_GYRO_SENS', 1)}
              onStaticSensXChange={handleStaticSensChange(0)}
              onStaticSensYChange={handleStaticSensChange(1)}
            />

            <NoiseSteadyingControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              onApply={applyConfig}
              onCancel={handleCancel}
              onCutoffSpeedChange={handleCutoffSpeedChange}
              onCutoffRecoveryChange={handleCutoffRecoveryChange}
              onSmoothTimeChange={handleSmoothTimeChange}
              onSmoothThresholdChange={handleSmoothThresholdChange}
              telemetry={{ omega: telemetryValues.omega, timestamp: telemetryValues.timestamp }}
            />

            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={!activeProfileId || isLoadingProfile}
              onChange={setConfigText}
              onApply={applyConfig}
              statusMessage={statusMessage}
            />
          </>
        )}

        {activeTab === 'keymap' && (
          <>
            <KeymapControls
              configText={configText}
              hasPendingChanges={hasPendingChanges}
              isCalibrating={isCalibrating}
              onApply={applyConfig}
              onCancel={handleCancel}
              onUpdateBinding={handleKeyBindingChange}
              onAssignSpecialAction={handleSpecialActionAssignment}
              onClearSpecialAction={handleClearSpecialAction}
              trackballDecay={trackballDecayValue}
              onTrackballDecayChange={handleTrackballDecayChange}
            />
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={!activeProfileId || isLoadingProfile}
              onChange={setConfigText}
              onApply={applyConfig}
              statusMessage={statusMessage}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default App
