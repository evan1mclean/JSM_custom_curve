import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import {
  parseSensitivityValues,
  updateKeymapEntry,
  removeKeymapEntry,
  getKeymapValue,
  setTapBinding,
  setHoldBinding,
  setDoubleBinding,
  setChordBinding,
  setSimultaneousBinding,
  isTrackballBindingPresent,
  BindingSlot,
} from './utils/keymap'
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

const TOGGLE_SPECIALS = ['GYRO_ON', 'GYRO_OFF'] as const
const DEFAULT_HOLD_PRESS_TIME = 0.15
const DEFAULT_WINDOW_SECONDS = 0.15
const DEFAULT_STICK_DEADZONE_INNER = '0.15'
const DEFAULT_STICK_DEADZONE_OUTER = '0.10'
const REQUIRED_HEADER_LINES = [
  { pattern: /^RESET_MAPPINGS\b/i, value: 'RESET_MAPPINGS' },
  { pattern: /^TELEMETRY_ENABLED\b/i, value: 'TELEMETRY_ENABLED = ON' },
  { pattern: /^TELEMETRY_PORT\b/i, value: 'TELEMETRY_PORT = 8974' },
]
const SENS_MODE_KEYS = ['MIN_GYRO_THRESHOLD', 'MAX_GYRO_THRESHOLD', 'MIN_GYRO_SENS', 'MAX_GYRO_SENS', 'GYRO_SENS'] as const
const prefixedKey = (key: string, prefix?: string) => (prefix ? `${prefix}${key}` : key)

const ensureHeaderLines = (text: string) => {
  const lines = text.split(/\r?\n/)
  const remaining: string[] = []
  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) {
      remaining.push(line)
      return
    }
    if (REQUIRED_HEADER_LINES.some(entry => entry.pattern.test(trimmed))) {
      return
    }
    remaining.push(line)
  })
  const header = REQUIRED_HEADER_LINES.map(entry => entry.value)
  const rest = remaining.join('\n').trimStart()
  return rest ? `${header.join('\n')}\n${rest}` : header.join('\n')
}

const CALIBRATION_PATTERNS = [
  /^RESET_MAPPINGS\b/i,
  /^TELEMETRY_ENABLED\b/i,
  /^TELEMETRY_PORT\b/i,
  /^RESTART_GYRO_CALIBRATION\b/i,
  /^FINISH_GYRO_CALIBRATION\b/i,
  /^SLEEP\b/i,
  /^COUNTER_OS_MOUSE_SPEED\b/i,
]

const sanitizeImportedConfig = (rawText: string) => {
  const withoutComments = rawText
    .split(/\r?\n/)
    .map(line => {
      const hashIndex = line.indexOf('#')
      const withoutHash = hashIndex >= 0 ? line.slice(0, hashIndex) : line
      return withoutHash.trim()
    })
    .filter(line => line.length > 0 && !CALIBRATION_PATTERNS.some(pattern => pattern.test(line)))
    .join('\n')

  return ensureHeaderLines(withoutComments)
}
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

const removeTrackballDecayIfUnused = (text: string) => {
  return isTrackballBindingPresent(text) ? text : removeKeymapEntry(text, 'TRACKBALL_DECAY')
}

const SPECIAL_COMMANDS = [
  'GYRO_OFF',
  'GYRO_ON',
  'GYRO_INVERT',
  'GYRO_INV_X',
  'GYRO_INV_Y',
  'GYRO_TRACKBALL',
  'GYRO_TRACK_X',
  'GYRO_TRACK_Y',
]

const clearSpecialAssignmentsForButton = (text: string, button: string) => {
  let next = text
  SPECIAL_COMMANDS.forEach(cmd => {
    const assignment = getKeymapValue(next, cmd)
    if (!assignment) return
    const tokens = assignment.split(/\s+/).filter(Boolean)
    const remaining = tokens.filter(token => token.toUpperCase() !== button.toUpperCase())
    if (remaining.length === tokens.length) {
      return
    }
    if (remaining.length === 0) {
      next = removeKeymapEntry(next, cmd)
    } else {
      next = updateKeymapEntry(next, cmd, remaining)
    }
  })
  return next
}

function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [configText, setConfigText] = useState('')
  const [appliedConfig, setAppliedConfig] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [libraryProfiles, setLibraryProfiles] = useState<string[]>([])
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [editedLibraryNames, setEditedLibraryNames] = useState<Record<string, string>>({})
  const [currentLibraryProfile, setCurrentLibraryProfile] = useState<string | null>(null)
  const [activeProfilePath, setActiveProfilePath] = useState<string>('')
  const [recalibrating, setRecalibrating] = useState(false)
  const [activeTab, setActiveTab] = useState<'gyro' | 'keymap' | 'touchpad' | 'sticks'>('gyro')
  const [sensitivityView, setSensitivityView] = useState<'base' | 'modeshift'>('base')
  const sensitivity = useMemo(() => parseSensitivityValues(configText), [configText])
  const holdPressTimeState = useMemo(() => {
    const raw = getKeymapValue(configText, 'HOLD_PRESS_TIME')
    if (raw) {
      const parsed = parseFloat(raw)
      if (Number.isFinite(parsed)) {
        return { value: parsed, isCustom: true }
      }
    }
    return { value: DEFAULT_HOLD_PRESS_TIME, isCustom: false }
  }, [configText])
  const holdPressTimeSeconds = holdPressTimeState.value
  const holdPressTimeIsCustom = holdPressTimeState.isCustom
  const doublePressWindowState = useMemo(() => {
    const raw = getKeymapValue(configText, 'DBL_PRESS_WINDOW')
    if (raw) {
      const parsed = parseFloat(raw)
      if (Number.isFinite(parsed)) {
        return { value: parsed / 1000, isCustom: true }
      }
    }
    return { value: DEFAULT_WINDOW_SECONDS, isCustom: false }
  }, [configText])
  const doublePressWindowSeconds = doublePressWindowState.value
  const doublePressWindowIsCustom = doublePressWindowState.isCustom
  const simPressWindowState = useMemo(() => {
    const raw = getKeymapValue(configText, 'SIM_PRESS_WINDOW')
    if (raw) {
      const parsed = parseFloat(raw)
      if (Number.isFinite(parsed)) {
        return { value: parsed / 1000, isCustom: true }
      }
    }
    return { value: DEFAULT_WINDOW_SECONDS, isCustom: false }
  }, [configText])
const simPressWindowSeconds = simPressWindowState.value
const simPressWindowIsCustom = simPressWindowState.isCustom
  const triggerThresholdValue = useMemo(() => {
    const raw = getKeymapValue(configText, 'TRIGGER_THRESHOLD')
    if (raw) {
      const parsed = parseFloat(raw)
      if (Number.isFinite(parsed)) {
        return Math.min(1, Math.max(0, parsed))
      }
    }
    return 0
  }, [configText])
  const touchpadModeValue = (getKeymapValue(configText, 'TOUCHPAD_MODE') ?? '').toUpperCase()
  const gridSizeRaw = getKeymapValue(configText, 'GRID_SIZE')
  const gridSizeValue = useMemo(() => {
    if (gridSizeRaw) {
      const tokens = gridSizeRaw.split(/\s+/).map(token => Number(token))
      const cols = Number.isFinite(tokens[0]) ? tokens[0] : 2
      const rows = Number.isFinite(tokens[1]) ? tokens[1] : 1
      return { columns: cols, rows: rows }
    }
    return { columns: 2, rows: 1 }
  }, [gridSizeRaw])
  const touchpadSensitivityValue = useMemo(() => {
    const raw = getKeymapValue(configText, 'TOUCHPAD_SENS')
    if (!raw) return undefined
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }, [configText])
  const sensitivityModeshiftButton = useMemo(() => {
    const regex = /^\s*([A-Z0-9+\-_]+)\s*,\s*(GYRO_SENS|MIN_GYRO_SENS|MAX_GYRO_SENS|MIN_GYRO_THRESHOLD|MAX_GYRO_THRESHOLD)\s*=/im
    const match = configText.match(regex)
    return match ? match[1].toUpperCase() : null
  }, [configText])
  useEffect(() => {
    if (!sensitivityModeshiftButton && sensitivityView === 'modeshift') {
      setSensitivityView('base')
    }
  }, [sensitivityModeshiftButton, sensitivityView])
  const modeshiftSensitivity = useMemo(() => {
    if (!sensitivityModeshiftButton) return undefined
    return parseSensitivityValues(configText, { prefix: `${sensitivityModeshiftButton},` })
  }, [configText, sensitivityModeshiftButton])
  const refreshLibraryProfiles = useCallback(async (): Promise<string[]> => {
    if (!window.electronAPI?.listLibraryProfiles) {
      setLibraryProfiles([])
      setEditedLibraryNames({})
      return []
    }
    setIsLibraryLoading(true)
    try {
      const entries = await window.electronAPI.listLibraryProfiles()
      const sorted = entries ?? []
      setLibraryProfiles(sorted)
      setEditedLibraryNames(prev => {
        const next: Record<string, string> = {}
        sorted.forEach(name => {
          next[name] = prev[name] ?? name
        })
        return next
      })
      return sorted
    } catch (err) {
      console.error('Failed to load profile library', err)
      setLibraryProfiles([])
      setEditedLibraryNames({})
      return []
    } finally {
      setIsLibraryLoading(false)
    }
  }, [])

useEffect(() => {
  refreshLibraryProfiles()
}, [refreshLibraryProfiles])

useEffect(() => {
  const loadActiveProfile = async () => {
    if (!window.electronAPI?.getActiveProfile) return
    try {
      const result = await window.electronAPI.getActiveProfile()
      if (result) {
        setConfigText(result.content ?? '')
        setAppliedConfig(result.content ?? '')
        setCurrentLibraryProfile(result.name ?? null)
        setActiveProfilePath(result.path ?? '')
      }
    } catch (err) {
      console.error('Failed to load active profile', err)
    }
  }
  loadActiveProfile()
}, [])

const applyConfig = useCallback(async (options?: { profileNameOverride?: string; textOverride?: string; profilePathOverride?: string }) => {
  const sourceText = options?.textOverride ?? configText
  const sanitizedConfig = ensureHeaderLines(sourceText)
  if (options?.textOverride !== undefined) {
    setConfigText(sanitizedConfig)
  } else if (sanitizedConfig !== configText) {
    setConfigText(sanitizedConfig)
  }
  try {
    const targetPath = options?.profilePathOverride ?? activeProfilePath
    const result = await window.electronAPI?.applyProfile?.(targetPath, sanitizedConfig)
    if (result?.path) {
      setActiveProfilePath(result.path)
    }
    const profileName = options?.profileNameOverride ?? currentLibraryProfile ?? 'Unsaved profile'
    setStatusMessage(
      result?.restarted
        ? `Applied ${profileName} to JoyShockMapper (restarted).`
        : `Applied ${profileName} to JoyShockMapper.`
    )
    setAppliedConfig(sanitizedConfig)
    setTimeout(() => setStatusMessage(null), 3000)
  } catch (err) {
    console.error(err)
    setStatusMessage('Failed to apply keymap.')
  }
}, [activeProfilePath, configText, currentLibraryProfile])

  const activeSensitivityPrefix = useMemo(() => {
    if (sensitivityView === 'modeshift' && sensitivityModeshiftButton) {
      return `${sensitivityModeshiftButton},`
    }
    return undefined
  }, [sensitivityView, sensitivityModeshiftButton])

  const resolveSensitivityKey = useCallback(
    (key: string) => {
      return activeSensitivityPrefix ? `${activeSensitivityPrefix}${key}` : key
    },
    [activeSensitivityPrefix]
  )

  const handleSensitivityModeshiftButtonChange = useCallback((value: string) => {
    const nextButton = value || null
    setConfigText(prev => {
      let next = prev
      if (sensitivityModeshiftButton) {
        SENS_MODE_KEYS.forEach(key => {
          next = removeKeymapEntry(next, `${sensitivityModeshiftButton},${key}`)
        })
      }
      if (nextButton) {
        const base = parseSensitivityValues(next)
        if (base.gyroSensX !== undefined) {
          next = updateKeymapEntry(next, `${nextButton},GYRO_SENS`, [
            base.gyroSensX,
            base.gyroSensY ?? base.gyroSensX,
          ])
        } else {
          if (base.minSensX !== undefined || base.minSensY !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},MIN_GYRO_SENS`, [
              base.minSensX ?? 0,
              base.minSensY ?? base.minSensX ?? 0,
            ])
          }
          if (base.maxSensX !== undefined || base.maxSensY !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},MAX_GYRO_SENS`, [
              base.maxSensX ?? 0,
              base.maxSensY ?? base.maxSensX ?? 0,
            ])
          }
          if (base.minThreshold !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},MIN_GYRO_THRESHOLD`, [base.minThreshold])
          }
          if (base.maxThreshold !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},MAX_GYRO_THRESHOLD`, [base.maxThreshold])
          }
        }
      }
      return next
    })
    if (!nextButton) {
      setSensitivityView('base')
    }
    if (nextButton) {
      setSensitivityView('modeshift')
    }
  }, [sensitivityModeshiftButton])

  const handleThresholdChange = (key: 'MIN_GYRO_THRESHOLD' | 'MAX_GYRO_THRESHOLD') => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey(key)))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => updateKeymapEntry(prev, resolveSensitivityKey(key), [next]))
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
  const handleHoldPressTimeChange = makeScalarHandler('HOLD_PRESS_TIME')
  const makeWindowHandler = (key: 'DBL_PRESS_WINDOW' | 'SIM_PRESS_WINDOW') => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, key))
      return
    }
    const seconds = parseFloat(value)
    if (Number.isNaN(seconds)) return
    const millis = Math.max(0, Math.round(seconds * 1000))
    setConfigText(prev => updateKeymapEntry(prev, key, [millis]))
  }
  const handleDoublePressWindowChange = makeWindowHandler('DBL_PRESS_WINDOW')
  const handleSimPressWindowChange = makeWindowHandler('SIM_PRESS_WINDOW')

  const handleTriggerThresholdChange = useCallback((value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, 'TRIGGER_THRESHOLD'))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    const clamped = Math.min(1, Math.max(0, next))
    setConfigText(prev => updateKeymapEntry(prev, 'TRIGGER_THRESHOLD', [clamped]))
  }, [])

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
      setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey(key)))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => {
      const parsed = parseSensitivityValues(prev, activeSensitivityPrefix ? { prefix: activeSensitivityPrefix } : undefined)
      const current =
        key === 'MIN_GYRO_SENS'
          ? [parsed.minSensX ?? 0, parsed.minSensY ?? parsed.minSensX ?? 0]
          : [parsed.maxSensX ?? 0, parsed.maxSensY ?? parsed.maxSensX ?? 0]
      current[index] = next
      return updateKeymapEntry(prev, resolveSensitivityKey(key), current)
    })
  }

  const handleStaticSensChange = (index: 0 | 1) => (value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('GYRO_SENS')))
      return
    }
    const next = parseFloat(value)
    if (Number.isNaN(next)) return
    setConfigText(prev => {
      const parsed = parseSensitivityValues(prev, activeSensitivityPrefix ? { prefix: activeSensitivityPrefix } : undefined)
      const current: [number, number] = [
        parsed.gyroSensX ?? parsed.minSensX ?? parsed.maxSensX ?? 1,
        parsed.gyroSensY ??
          parsed.minSensY ??
          parsed.minSensX ??
          parsed.maxSensY ??
          parsed.maxSensX ??
          parsed.gyroSensX ??
          1,
      ]
      current[index] = next
      return updateKeymapEntry(prev, resolveSensitivityKey('GYRO_SENS'), current)
    })
  }

  const handleTouchpadModeChange = useCallback((value: string) => {
    const upper = value?.toUpperCase() ?? ''
    setConfigText(prev => {
      let next = prev
      if (upper === '') {
        next = removeKeymapEntry(next, 'TOUCHPAD_MODE')
        return next
      }
      const sanitized = upper === 'MOUSE' ? 'MOUSE' : 'GRID_AND_STICK'
      next = updateKeymapEntry(next, 'TOUCHPAD_MODE', [sanitized])
      if (sanitized === 'GRID_AND_STICK' && !gridSizeRaw) {
        next = updateKeymapEntry(next, 'GRID_SIZE', [gridSizeValue.columns, gridSizeValue.rows])
      }
      return next
    })
  }, [gridSizeRaw, gridSizeValue.columns, gridSizeValue.rows])

  const handleGridSizeChange = useCallback((columns: number, rows: number) => {
    const cols = Math.max(1, Math.min(5, Math.round(columns)))
    const rws = Math.max(1, Math.min(5, Math.round(rows)))
    setConfigText(prev => updateKeymapEntry(prev, 'GRID_SIZE', [cols, rws]))
  }, [])

  const handleTouchpadSensitivityChange = useCallback((value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, 'TOUCHPAD_SENS'))
      return
    }
    const parsed = parseFloat(value)
    if (Number.isNaN(parsed)) return
    setConfigText(prev => updateKeymapEntry(prev, 'TOUCHPAD_SENS', [parsed]))
  }, [])


const handleInGameSensChange = (value: string) => {
  if (value === '') {
    setConfigText(prev => removeKeymapEntry(prev, 'IN_GAME_SENS'))
    return
  }
  const next = parseFloat(value)
  if (Number.isNaN(next)) return
  setConfigText(prev => updateKeymapEntry(prev, 'IN_GAME_SENS', [next]))
}

const handleRealWorldCalibrationChange = (value: string) => {
  if (value === '') {
    setConfigText(prev => removeKeymapEntry(prev, 'REAL_WORLD_CALIBRATION'))
    return
  }
  const next = parseFloat(value)
  if (Number.isNaN(next)) return
  setConfigText(prev => updateKeymapEntry(prev, 'REAL_WORLD_CALIBRATION', [next]))
}

const handleLoadProfileFromLibrary = useCallback(async (name: string): Promise<string | null> => {
  if (!window.electronAPI?.activateLibraryProfile) return null
  try {
    const result = await window.electronAPI.activateLibraryProfile(name)
    if (result?.content !== undefined) {
      const profileContent = result.content ?? ''
      const profileName = result.name ?? name
      const profilePath = result.path ?? ''
      setConfigText(profileContent)
      setAppliedConfig(profileContent)
      setCurrentLibraryProfile(profileName)
      setActiveProfilePath(profilePath)
      await applyConfig({
        profileNameOverride: profileName,
        textOverride: profileContent,
        profilePathOverride: profilePath,
      })
      setStatusMessage(`Loaded "${profileName}" from library and applied it to JoyShockMapper.`)
      setTimeout(() => setStatusMessage(null), 3000)
      return result.content
    }
  } catch (err) {
    console.error('Failed to load profile from library', err)
    setStatusMessage('Failed to load profile from library.')
    setTimeout(() => setStatusMessage(null), 3000)
    refreshLibraryProfiles()
  }
  return null
  }, [applyConfig, refreshLibraryProfiles])

const handleLibraryProfileNameChange = (originalName: string, value: string) => {
  setEditedLibraryNames(prev => ({
    ...prev,
    [originalName]: value,
  }))
}

const handleCreateProfile = async () => {
  if (!window.electronAPI?.createLibraryProfile) return
  try {
    const result = await window.electronAPI.createLibraryProfile()
    if (result) {
      const profileContent = result.content ?? ''
      const profileName = result.name ?? null
      const profilePath = result.path ?? ''
      setConfigText(profileContent)
      setAppliedConfig(profileContent)
      setCurrentLibraryProfile(profileName)
      setActiveProfilePath(profilePath)
      setEditedLibraryNames(prev => ({
        ...prev,
        [profileName ?? '']: profileName ?? '',
      }))
      await applyConfig({
        profileNameOverride: profileName ?? 'Unsaved profile',
        textOverride: profileContent,
        profilePathOverride: profilePath,
      })
      refreshLibraryProfiles()
    }
  } catch (err) {
    console.error('Failed to create profile', err)
    setStatusMessage('Failed to create profile.')
    setTimeout(() => setStatusMessage(null), 3000)
  }
}

const handleRenameProfile = async (originalName: string) => {
  if (!window.electronAPI?.renameLibraryProfile) return
  const pendingName = (editedLibraryNames[originalName] ?? originalName).trim()
  if (!pendingName) {
    setStatusMessage('Profile name cannot be empty.')
    setTimeout(() => setStatusMessage(null), 3000)
    return
  }
  try {
    const result = await window.electronAPI.renameLibraryProfile(originalName, pendingName)
    if (result) {
      if (currentLibraryProfile === originalName) {
        setCurrentLibraryProfile(result.name ?? originalName)
        setActiveProfilePath(result.path ?? activeProfilePath)
        if (result.content !== undefined) {
          setConfigText(result.content)
          setAppliedConfig(result.content)
        }
      }
      setEditedLibraryNames(prev => {
        const next = { ...prev }
        delete next[originalName]
        next[result.name ?? originalName] = result.name ?? originalName
        return next
      })
      refreshLibraryProfiles()
    }
  } catch (err) {
    console.error('Failed to rename profile', err)
    setStatusMessage('Failed to rename profile.')
    setTimeout(() => setStatusMessage(null), 3000)
  }
}

const handleDeleteLibraryProfile = async (name: string) => {
  if (!window.electronAPI?.deleteLibraryProfile) return
  try {
    const response = (await window.electronAPI.deleteLibraryProfile(name)) ?? { success: true }
    const entries = (await refreshLibraryProfiles()) ?? []
    setEditedLibraryNames(prev => {
      const next = { ...prev }
      delete next[name]
      if (response.fallback?.name) {
        next[response.fallback.name] = response.fallback.name
      }
      return next
    })
    if (currentLibraryProfile === name) {
      const fallback = response.fallback
      if (fallback) {
        setCurrentLibraryProfile(fallback.name ?? null)
        setConfigText(fallback.content ?? '')
        setAppliedConfig(fallback.content ?? '')
        setActiveProfilePath(fallback.path ?? '')
        await applyConfig({
          profileNameOverride: fallback.name ?? 'Unsaved profile',
          textOverride: fallback.content ?? '',
          profilePathOverride: fallback.path ?? '',
        })
      } else if (entries.length > 0) {
        const fallbackName = entries[0]
        const content = await handleLoadProfileFromLibrary(fallbackName)
        if (content !== null) {
          const relativePath = `profiles-library/${fallbackName}.txt`
          setCurrentLibraryProfile(fallbackName)
          setActiveProfilePath(relativePath)
          await applyConfig({ profileNameOverride: fallbackName, textOverride: content, profilePathOverride: relativePath })
        }
      } else {
        setCurrentLibraryProfile(null)
        setConfigText('')
        setAppliedConfig('')
        setActiveProfilePath('')
        await applyConfig({ profileNameOverride: 'Unsaved profile', textOverride: '', profilePathOverride: '' })
      }
    }
    setStatusMessage(`Deleted "${name}" from library.`)
    setTimeout(() => setStatusMessage(null), 3000)
  } catch (err) {
    console.error('Failed to delete profile', err)
    setStatusMessage('Failed to delete profile.')
    setTimeout(() => setStatusMessage(null), 3000)
  }
}

  const switchToStaticMode = (prefix?: string) => {
    setConfigText(prev => {
      const values = parseSensitivityValues(prev, prefix ? { prefix } : undefined)
      if (values.gyroSensX !== undefined) {
        return prev
      }
      const defaultX = values.minSensX ?? values.maxSensX ?? 1
      const defaultY = values.minSensY ?? values.minSensX ?? values.maxSensY ?? values.maxSensX ?? defaultX
      let next = updateKeymapEntry(prev, prefixedKey('GYRO_SENS', prefix), [defaultX, defaultY])
      ;['MIN_GYRO_SENS', 'MAX_GYRO_SENS', 'MIN_GYRO_THRESHOLD', 'MAX_GYRO_THRESHOLD'].forEach(key => {
        next = removeKeymapEntry(next, prefixedKey(key, prefix))
      })
      return next
    })
  }

  const switchToAccelMode = (prefix?: string) => {
    setConfigText(prev => {
      const values = parseSensitivityValues(prev, prefix ? { prefix } : undefined)
      if (values.gyroSensX === undefined) {
        return prev
      }
      const defaultX = values.gyroSensX ?? 1
      const defaultY = values.gyroSensY ?? defaultX
      let next = removeKeymapEntry(prev, prefixedKey('GYRO_SENS', prefix))
      next = updateKeymapEntry(next, prefixedKey('MIN_GYRO_SENS', prefix), [
        values.minSensX ?? defaultX,
        values.minSensY ?? defaultY,
      ])
      next = updateKeymapEntry(next, prefixedKey('MAX_GYRO_SENS', prefix), [
        values.maxSensX ?? defaultX,
        values.maxSensY ?? defaultY,
      ])
      next = updateKeymapEntry(next, prefixedKey('MIN_GYRO_THRESHOLD', prefix), [values.minThreshold ?? 0])
      next = updateKeymapEntry(next, prefixedKey('MAX_GYRO_THRESHOLD', prefix), [values.maxThreshold ?? 100])
      return next
    })
  }

  const hasPendingChanges = configText !== appliedConfig

  const handleCancel = () => {
    setConfigText(appliedConfig)
  }

  const handleFaceButtonBindingChange = (
    button: string,
    slot: BindingSlot,
    binding: string | null,
    options?: { modifier?: string }
  ) => {
    setConfigText(prev => {
      let next = clearSpecialAssignmentsForButton(prev, button)
      next = clearToggleAssignments(next, button)
      switch (slot) {
        case 'tap':
          next = setTapBinding(next, button, binding)
          break
        case 'hold':
          next = setHoldBinding(next, button, binding)
          break
        case 'double':
          next = setDoubleBinding(next, button, binding)
          break
        case 'chord':
          next = setChordBinding(next, button, options?.modifier, binding)
          break
        case 'simultaneous':
          next = setSimultaneousBinding(next, button, options?.modifier, binding)
          break
        default:
          break
      }
      return removeTrackballDecayIfUnused(next)
    })
  }

  const handleModifierChange = (
    button: string,
    slot: BindingSlot,
    previousModifier: string | undefined,
    nextModifier: string,
    binding: string | null
  ) => {
    if (!nextModifier || previousModifier === nextModifier) return
    setConfigText(prev => {
      let next = prev
      if (slot === 'chord') {
        if (previousModifier) {
          next = setChordBinding(next, button, previousModifier, null)
        }
        if (binding) {
          next = setChordBinding(next, button, nextModifier, binding)
        }
      } else if (slot === 'simultaneous') {
        if (previousModifier) {
          next = setSimultaneousBinding(next, button, previousModifier, null)
        }
        if (binding) {
          next = setSimultaneousBinding(next, button, nextModifier, binding)
        }
      }
      return next
    })
  }

  const handleSpecialActionAssignment = (specialCommand: string, buttonCommand: string) => {
    setConfigText(prev => {
      let next = clearSpecialAssignmentsForButton(prev, buttonCommand)
      next = removeKeymapEntry(next, buttonCommand)
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

  const handleStickDeadzoneChange = useCallback(
    (side: 'LEFT' | 'RIGHT', type: 'INNER' | 'OUTER', rawValue: string) => {
      const key = `${side}_STICK_DEADZONE_${type}`
      const trimmed = rawValue.trim()
      setConfigText(prev => {
        if (!trimmed) {
          return removeKeymapEntry(prev, key)
        }
        const numeric = Number(trimmed)
        if (Number.isNaN(numeric)) {
          return prev
        }
        const clamped = Math.max(0, Math.min(1, numeric))
        return updateKeymapEntry(prev, key, [clamped])
      })
    },
    []
  )

  const handleStickModeChange = useCallback((side: 'LEFT' | 'RIGHT', mode: string) => {
    const key = `${side}_STICK_MODE`
    setConfigText(prev => {
      if (!mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim()])
    })
  }, [])

  const handleRingModeChange = useCallback((side: 'LEFT' | 'RIGHT', mode: string) => {
    const key = `${side}_RING_MODE`
    setConfigText(prev => {
      if (!mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim()])
    })
  }, [])

  const handleStickModeShiftChange = useCallback((button: string, target: 'LEFT' | 'RIGHT', mode?: string) => {
    const key = `${button.toUpperCase()},${target}_STICK_MODE`
    setConfigText(prev => {
      if (!mode || !mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim().toUpperCase()])
    })
  }, [])

  const handleAdaptiveTriggerChange = useCallback((value: string) => {
    setConfigText(prev => {
      const trimmed = value.trim().toUpperCase()
      if (!trimmed || trimmed === 'ON') {
        return removeKeymapEntry(prev, 'ADAPTIVE_TRIGGER')
      }
      return updateKeymapEntry(prev, 'ADAPTIVE_TRIGGER', [trimmed === 'OFF' ? 'OFF' : trimmed])
    })
  }, [])

  const handleStickSensChange = useCallback(
    (axis: 'X' | 'Y') => (value: string) => {
      const trimmed = value.trim()
      setConfigText(prev => {
        const raw = getKeymapValue(prev, 'STICK_SENS')
        const tokens = raw ? raw.trim().split(/\s+/).filter(Boolean) : []
        const parseNum = (input: string | undefined) => {
          if (!input || !input.trim()) return null
          const parsed = Number(input)
          return Number.isFinite(parsed) ? parsed : null
        }
        const currentX = parseNum(tokens[0])
        const currentY = parseNum(tokens[1])
        if (axis === 'X') {
          if (!trimmed) {
            return removeKeymapEntry(prev, 'STICK_SENS')
          }
          const nextX = parseNum(trimmed)
          if (nextX === null) return prev
          if (currentY === null) {
            return updateKeymapEntry(prev, 'STICK_SENS', [nextX])
          }
          return updateKeymapEntry(prev, 'STICK_SENS', [nextX, currentY])
        }
        // axis === 'Y'
        if (currentX === null) {
          if (!trimmed) {
            return removeKeymapEntry(prev, 'STICK_SENS')
          }
          const inferred = parseNum(trimmed)
          if (inferred === null) return prev
          return updateKeymapEntry(prev, 'STICK_SENS', [inferred])
        }
        if (!trimmed) {
          return updateKeymapEntry(prev, 'STICK_SENS', [currentX])
        }
        const nextY = parseNum(trimmed)
        if (nextY === null) return prev
        return updateKeymapEntry(prev, 'STICK_SENS', [currentX, nextY])
      })
    },
    []
  )

  const handleStickPowerChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, 'STICK_POWER')
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, 'STICK_POWER', [parsed])
    })
  }, [])

  const handleStickAccelerationRateChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, 'STICK_ACCELERATION_RATE')
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, 'STICK_ACCELERATION_RATE', [parsed])
    })
  }, [])

  const handleStickAccelerationCapChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, 'STICK_ACCELERATION_CAP')
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, 'STICK_ACCELERATION_CAP', [parsed])
    })
  }, [])
  const stickAimHandlers = useMemo(
    () => ({
      onSensXChange: handleStickSensChange('X'),
      onSensYChange: handleStickSensChange('Y'),
      onPowerChange: handleStickPowerChange,
      onAccelerationRateChange: handleStickAccelerationRateChange,
      onAccelerationCapChange: handleStickAccelerationCapChange,
    }),
    [
      handleStickSensChange,
      handleStickPowerChange,
      handleStickAccelerationRateChange,
      handleStickAccelerationCapChange,
    ]
  )

  const stickFlickSettings = useMemo(() => {
    const getRaw = (key: string) => getKeymapValue(configText, key) ?? ''
    const formatNumber = (raw: string, fallback: string) => {
      if (!raw.trim()) return ''
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? raw.trim() : fallback
    }
    return {
      flickTime: formatNumber(getRaw('FLICK_TIME'), ''),
      flickTimeExponent: formatNumber(getRaw('FLICK_TIME_EXPONENT'), ''),
      snapMode: getRaw('FLICK_SNAP_MODE').toUpperCase(),
      snapStrength: formatNumber(getRaw('FLICK_SNAP_STRENGTH'), ''),
      deadzoneAngle: formatNumber(getRaw('FLICK_DEADZONE_ANGLE'), ''),
    }
  }, [configText])

  const handleFlickSettingChange = useCallback((key: string, value: string) => {
    setConfigText(prev => {
      const trimmed = value.trim()
      if (!trimmed) {
        return removeKeymapEntry(prev, key)
      }
      if (key === 'FLICK_SNAP_MODE') {
        return updateKeymapEntry(prev, key, [trimmed.toUpperCase()])
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, key, [parsed])
    })
  }, [])

  const stickFlickHandlers = useMemo(
    () => ({
      onFlickTimeChange: (value: string) => handleFlickSettingChange('FLICK_TIME', value),
      onFlickTimeExponentChange: (value: string) => handleFlickSettingChange('FLICK_TIME_EXPONENT', value),
      onSnapModeChange: (value: string) => handleFlickSettingChange('FLICK_SNAP_MODE', value),
      onSnapStrengthChange: (value: string) => handleFlickSettingChange('FLICK_SNAP_STRENGTH', value),
      onDeadzoneAngleChange: (value: string) => handleFlickSettingChange('FLICK_DEADZONE_ANGLE', value),
    }),
    [handleFlickSettingChange]
  )

  const mouseRingRadiusValue = useMemo(() => {
    const raw = getKeymapValue(configText, 'MOUSE_RING_RADIUS')
    if (!raw) return ''
    return raw.trim()
  }, [configText])
  const counterOsMouseSpeedEnabled = useMemo(() => Boolean(getKeymapValue(configText, 'COUNTER_OS_MOUSE_SPEED')), [configText])

  const handleMouseRingRadiusChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, 'MOUSE_RING_RADIUS')
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return prev
      }
      return updateKeymapEntry(prev, 'MOUSE_RING_RADIUS', [parsed])
    })
  }, [])

  const handleCounterOsMouseSpeedChange = useCallback((enabled: boolean) => {
    setConfigText(prev => {
      if (!enabled) {
        return removeKeymapEntry(prev, 'COUNTER_OS_MOUSE_SPEED')
      }
      return updateKeymapEntry(prev, 'COUNTER_OS_MOUSE_SPEED', ['ON'])
    })
  }, [])

  const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false)
  const [calibrationRestorePath, setCalibrationRestorePath] = useState<string | null>(null)
  const handleOpenCalibration = useCallback(async () => {
    setCalibrationModalOpen(true)
    try {
      const result = await window.electronAPI?.loadCalibrationPreset?.()
      if (result?.activeProfile) {
        setCalibrationRestorePath(result.activeProfile)
      }
    } catch (err) {
      console.error('Failed to load calibration preset', err)
    }
  }, [])
  const handleCloseCalibration = useCallback(async () => {
    setCalibrationModalOpen(false)
    if (calibrationRestorePath) {
      try {
        await window.electronAPI?.applyProfile?.(calibrationRestorePath, configText)
      } catch (err) {
        console.error('Failed to restore profile after calibration', err)
      } finally {
        setCalibrationRestorePath(null)
      }
    }
  }, [calibrationRestorePath, configText])

  const scrollSensValue = useMemo(() => {
    const raw = getKeymapValue(configText, 'SCROLL_SENS')
    if (!raw) return ''
    return raw.trim()
  }, [configText])

  const handleScrollSensChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, 'SCROLL_SENS')
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return prev
      }
      return updateKeymapEntry(prev, 'SCROLL_SENS', [parsed])
    })
  }, [])

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

  const handleImportProfile = async (fileName: string, fileContent: string) => {
    if (!fileContent) return
    const baseName = fileName.replace(/\.[^/.]+$/, '') || fileName || 'Imported Profile'
    try {
      const sanitized = sanitizeImportedConfig(fileContent)
      const result = await window.electronAPI?.saveLibraryProfile?.(baseName, sanitized)
      const savedName = result?.name ?? baseName
      await handleLoadProfileFromLibrary(savedName)
      setStatusMessage(`Imported "${savedName}" into the editor. Click Apply to use it.`)
      setTimeout(() => setStatusMessage(null), 3000)
      refreshLibraryProfiles()
    } catch (err) {
      console.error('Failed to import profile', err)
      setStatusMessage('Failed to import profile.')
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
  const stickDeadzoneDefaults = useMemo(() => {
    return {
      inner: getKeymapValue(configText, 'STICK_DEADZONE_INNER') ?? DEFAULT_STICK_DEADZONE_INNER,
      outer: getKeymapValue(configText, 'STICK_DEADZONE_OUTER') ?? DEFAULT_STICK_DEADZONE_OUTER,
    }
  }, [configText])
  const leftStickDeadzone = useMemo(() => {
    return {
      inner: getKeymapValue(configText, 'LEFT_STICK_DEADZONE_INNER') ?? '',
      outer: getKeymapValue(configText, 'LEFT_STICK_DEADZONE_OUTER') ?? '',
    }
  }, [configText])
  const rightStickDeadzone = useMemo(() => {
    return {
      inner: getKeymapValue(configText, 'RIGHT_STICK_DEADZONE_INNER') ?? '',
      outer: getKeymapValue(configText, 'RIGHT_STICK_DEADZONE_OUTER') ?? '',
    }
  }, [configText])
  const stickModes = useMemo(() => {
    return {
      left: {
        mode: getKeymapValue(configText, 'LEFT_STICK_MODE') ?? '',
        ring: getKeymapValue(configText, 'LEFT_RING_MODE') ?? '',
      },
      right: {
        mode: getKeymapValue(configText, 'RIGHT_STICK_MODE') ?? '',
        ring: getKeymapValue(configText, 'RIGHT_RING_MODE') ?? '',
      },
    }
  }, [configText])
  const stickModeShiftAssignments = useMemo(() => {
    const result: Record<string, { target: 'LEFT' | 'RIGHT'; mode: string }[]> = {}
    const lines = configText.split(/\r?\n/)
    lines.forEach(line => {
      const match = line.match(/^\s*([^,]+)\s*,\s*((LEFT|RIGHT)_STICK_MODE)\s*=\s*([^\s#]+)/i)
      if (!match) return
      const button = match[1].trim().toUpperCase()
      const target = match[3].toUpperCase() === 'LEFT' ? 'LEFT' : 'RIGHT'
      const mode = match[4].trim().toUpperCase()
      if (!button || !mode) return
      const existing = result[button] ?? []
      const filtered = existing.filter(entry => entry.target !== target)
      result[button] = [...filtered, { target, mode }]
    })
    return result
  }, [configText])
  const stickAimSettings = useMemo(() => {
    const rawSens = getKeymapValue(configText, 'STICK_SENS')
    const tokens = rawSens ? rawSens.trim().split(/\s+/).filter(Boolean) : []
    const sensX = tokens[0] ?? ''
    const sensY = tokens[1] ?? ''
    const displaySensX = sensX || ''
    const displaySensY = sensY || sensX || ''
    const parseNum = (value: string, fallback: number) => {
      if (!value.trim()) return fallback
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    const sensXNumber = parseNum(sensX, 0)
    const sensYNumber = sensY ? parseNum(sensY, sensXNumber) : sensXNumber
    return {
      sensX,
      sensY,
      displaySensX,
      displaySensY,
      sensXNumber,
      sensYNumber,
      power: getKeymapValue(configText, 'STICK_POWER') ?? '',
      accelerationRate: getKeymapValue(configText, 'STICK_ACCELERATION_RATE') ?? '',
      accelerationCap: getKeymapValue(configText, 'STICK_ACCELERATION_CAP') ?? '',
    }
  }, [configText])
  const adaptiveTriggerValue = useMemo(() => {
    const value = getKeymapValue(configText, 'ADAPTIVE_TRIGGER')
    if (!value) return ''
    return value.trim().toUpperCase() === 'OFF' ? 'OFF' : 'ON'
  }, [configText])

  const baseMode: 'static' | 'accel' = sensitivity.gyroSensX !== undefined ? 'static' : 'accel'
  const modeshiftMode: 'static' | 'accel' = modeshiftSensitivity?.gyroSensX !== undefined ? 'static' : 'accel'
  const currentMode: 'static' | 'accel' =
    sensitivityView === 'modeshift' && sensitivityModeshiftButton ? modeshiftMode : baseMode
  const profileLabel = currentLibraryProfile ?? 'Unsaved profile'
  const activeProfileFile = activeProfilePath || 'No active profile'
  const profileFileLabel = `${activeProfileFile} — ${profileLabel}`

  return (
    <div className="app-frame">
      <div className="App legacy-shell">
        <header>
          <h1>JoyShockMapper Gyro UI</h1>
        </header>

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
          <button
            className={`pill-tab tab-button ${activeTab === 'touchpad' ? 'active' : ''}`}
            onClick={() => setActiveTab('touchpad')}
          >
            Touchpad
          </button>
          <button
            className={`pill-tab tab-button ${activeTab === 'sticks' ? 'active' : ''}`}
            onClick={() => setActiveTab('sticks')}
          >
            Sticks
          </button>
        </div>

        <CalibrationCard
          isCalibrating={isCalibrating}
          countdown={countdown}
          recalibrating={recalibrating}
          onRecalibrate={handleRecalibrate}
        />

        <ProfileManager
          currentProfileName={currentLibraryProfile}
          hasPendingChanges={hasPendingChanges}
          isCalibrating={isCalibrating}
          profileApplied={configText === appliedConfig}
          statusMessage={statusMessage}
          onApplyProfile={applyConfig}
          applyDisabled={isCalibrating}
          onImportProfile={handleImportProfile}
          libraryProfiles={libraryProfiles}
          libraryLoading={isLibraryLoading}
          editedProfileNames={editedLibraryNames}
          onProfileNameChange={handleLibraryProfileNameChange}
          onRenameProfile={handleRenameProfile}
          onDeleteProfile={handleDeleteLibraryProfile}
          onAddProfile={handleCreateProfile}
          onLoadLibraryProfile={handleLoadProfileFromLibrary}
        />

        {activeTab === 'gyro' && (
          <>
            <GyroBehaviorControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              onInGameSensChange={handleInGameSensChange}
              onRealWorldCalibrationChange={handleRealWorldCalibrationChange}
              onTickTimeChange={handleTickTimeChange}
              onGyroSpaceChange={handleGyroSpaceChange}
              onGyroAxisXChange={handleGyroAxisXChange}
              onGyroAxisYChange={handleGyroAxisYChange}
              counterOsMouseSpeed={counterOsMouseSpeedEnabled}
              onCounterOsMouseSpeedChange={handleCounterOsMouseSpeedChange}
              onOpenCalibration={handleOpenCalibration}
              hasPendingChanges={hasPendingChanges}
              onApply={applyConfig}
              onCancel={handleCancel}
            />

            <SensitivityControls
              sensitivity={sensitivity}
              modeshiftSensitivity={modeshiftSensitivity}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              mode={currentMode}
              sensitivityView={sensitivityView}
              hasPendingChanges={hasPendingChanges}
              sample={sample}
              telemetry={telemetryValues}
              touchpadMode={touchpadModeValue}
              touchpadGridCells={touchpadModeValue === 'GRID_AND_STICK' ? Math.min(25, gridSizeValue.columns * gridSizeValue.rows) : 0}
              onModeChange={(mode) =>
                mode === 'static'
                  ? switchToStaticMode(activeSensitivityPrefix)
                  : switchToAccelMode(activeSensitivityPrefix)
              }
              onSensitivityViewChange={setSensitivityView}
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
              modeshiftButton={sensitivityModeshiftButton}
              onModeshiftButtonChange={handleSensitivityModeshiftButtonChange}
            />

            <NoiseSteadyingControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
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
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={statusMessage}
              onChange={setConfigText}
              onApply={applyConfig}
              onCancel={handleCancel}
            />
          </>
        )}

        {activeTab === 'keymap' && (
          <>
            <KeymapControls
              configText={configText}
              hasPendingChanges={hasPendingChanges}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              onApply={applyConfig}
              onCancel={handleCancel}
              onBindingChange={handleFaceButtonBindingChange}
              onAssignSpecialAction={handleSpecialActionAssignment}
              onClearSpecialAction={handleClearSpecialAction}
              trackballDecay={trackballDecayValue}
              onTrackballDecayChange={handleTrackballDecayChange}
              holdPressTimeSeconds={holdPressTimeSeconds}
              holdPressTimeIsCustom={holdPressTimeIsCustom}
              holdPressTimeDefault={DEFAULT_HOLD_PRESS_TIME}
              onHoldPressTimeChange={handleHoldPressTimeChange}
              doublePressWindowSeconds={doublePressWindowSeconds}
              doublePressWindowIsCustom={doublePressWindowIsCustom}
              onDoublePressWindowChange={handleDoublePressWindowChange}
              simPressWindowSeconds={simPressWindowSeconds}
              simPressWindowIsCustom={simPressWindowIsCustom}
              onSimPressWindowChange={handleSimPressWindowChange}
              triggerThreshold={triggerThresholdValue}
              onTriggerThresholdChange={handleTriggerThresholdChange}
              onModifierChange={handleModifierChange}
              touchpadMode={touchpadModeValue}
              gridColumns={gridSizeValue.columns}
              gridRows={gridSizeValue.rows}
              stickDeadzoneSettings={{
                defaults: stickDeadzoneDefaults,
                left: leftStickDeadzone,
                right: rightStickDeadzone,
              }}
              stickModeSettings={stickModes}
              onStickDeadzoneChange={handleStickDeadzoneChange}
              onStickModeChange={handleStickModeChange}
              onRingModeChange={handleRingModeChange}
              stickModeShiftAssignments={stickModeShiftAssignments}
              onStickModeShiftChange={handleStickModeShiftChange}
              adaptiveTriggerValue={adaptiveTriggerValue}
              onAdaptiveTriggerChange={handleAdaptiveTriggerChange}
              stickAimSettings={stickAimSettings}
              stickAimHandlers={stickAimHandlers}
              stickFlickSettings={stickFlickSettings}
              stickFlickHandlers={stickFlickHandlers}
              mouseRingRadius={mouseRingRadiusValue}
              onMouseRingRadiusChange={handleMouseRingRadiusChange}
              scrollSens={scrollSensValue}
              onScrollSensChange={handleScrollSensChange}
            />
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={statusMessage}
              onChange={setConfigText}
              onApply={applyConfig}
              onCancel={handleCancel}
            />
          </>
        )}
        {activeTab === 'touchpad' && (
          <>
            <KeymapControls
              view="touchpad"
              configText={configText}
              hasPendingChanges={hasPendingChanges}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              onApply={applyConfig}
              onCancel={handleCancel}
              onBindingChange={handleFaceButtonBindingChange}
              onAssignSpecialAction={handleSpecialActionAssignment}
              onClearSpecialAction={handleClearSpecialAction}
              trackballDecay={trackballDecayValue}
              onTrackballDecayChange={handleTrackballDecayChange}
              holdPressTimeSeconds={holdPressTimeSeconds}
              holdPressTimeIsCustom={holdPressTimeIsCustom}
              holdPressTimeDefault={DEFAULT_HOLD_PRESS_TIME}
              onHoldPressTimeChange={handleHoldPressTimeChange}
              doublePressWindowSeconds={doublePressWindowSeconds}
              doublePressWindowIsCustom={doublePressWindowIsCustom}
              onDoublePressWindowChange={handleDoublePressWindowChange}
              simPressWindowSeconds={simPressWindowSeconds}
              simPressWindowIsCustom={simPressWindowIsCustom}
              onSimPressWindowChange={handleSimPressWindowChange}
              triggerThreshold={triggerThresholdValue}
              onTriggerThresholdChange={handleTriggerThresholdChange}
              onModifierChange={handleModifierChange}
              touchpadMode={touchpadModeValue}
              onTouchpadModeChange={handleTouchpadModeChange}
              gridColumns={gridSizeValue.columns}
              gridRows={gridSizeValue.rows}
              onGridSizeChange={handleGridSizeChange}
              touchpadSensitivity={touchpadSensitivityValue}
              onTouchpadSensitivityChange={handleTouchpadSensitivityChange}
              stickDeadzoneSettings={{
                defaults: stickDeadzoneDefaults,
                left: leftStickDeadzone,
                right: rightStickDeadzone,
              }}
              stickModeSettings={stickModes}
              onStickDeadzoneChange={handleStickDeadzoneChange}
              onStickModeChange={handleStickModeChange}
              onRingModeChange={handleRingModeChange}
              stickModeShiftAssignments={stickModeShiftAssignments}
              onStickModeShiftChange={handleStickModeShiftChange}
              adaptiveTriggerValue={adaptiveTriggerValue}
              onAdaptiveTriggerChange={handleAdaptiveTriggerChange}
              stickAimSettings={stickAimSettings}
              stickAimHandlers={stickAimHandlers}
            />
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={statusMessage}
              onChange={setConfigText}
              onApply={applyConfig}
              onCancel={handleCancel}
            />
          </>
        )}
        {activeTab === 'sticks' && (
          <>
            <KeymapControls
              view="sticks"
              configText={configText}
              hasPendingChanges={hasPendingChanges}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              onApply={applyConfig}
              onCancel={handleCancel}
              onBindingChange={handleFaceButtonBindingChange}
              onAssignSpecialAction={handleSpecialActionAssignment}
              onClearSpecialAction={handleClearSpecialAction}
              trackballDecay={trackballDecayValue}
              onTrackballDecayChange={handleTrackballDecayChange}
              holdPressTimeSeconds={holdPressTimeSeconds}
              holdPressTimeIsCustom={holdPressTimeIsCustom}
              holdPressTimeDefault={DEFAULT_HOLD_PRESS_TIME}
              onHoldPressTimeChange={handleHoldPressTimeChange}
              doublePressWindowSeconds={doublePressWindowSeconds}
              doublePressWindowIsCustom={doublePressWindowIsCustom}
              onDoublePressWindowChange={handleDoublePressWindowChange}
              simPressWindowSeconds={simPressWindowSeconds}
              simPressWindowIsCustom={simPressWindowIsCustom}
              onSimPressWindowChange={handleSimPressWindowChange}
              triggerThreshold={triggerThresholdValue}
              onTriggerThresholdChange={handleTriggerThresholdChange}
              onModifierChange={handleModifierChange}
              touchpadMode={touchpadModeValue}
              gridColumns={gridSizeValue.columns}
              gridRows={gridSizeValue.rows}
              stickDeadzoneSettings={{
                defaults: stickDeadzoneDefaults,
                left: leftStickDeadzone,
                right: rightStickDeadzone,
              }}
              onStickDeadzoneChange={handleStickDeadzoneChange}
              stickModeSettings={stickModes}
              onStickModeChange={handleStickModeChange}
              onRingModeChange={handleRingModeChange}
              stickModeShiftAssignments={stickModeShiftAssignments}
              onStickModeShiftChange={handleStickModeShiftChange}
              stickAimSettings={stickAimSettings}
              stickAimHandlers={stickAimHandlers}
              stickFlickSettings={stickFlickSettings}
              stickFlickHandlers={stickFlickHandlers}
              scrollSens={scrollSensValue}
              onScrollSensChange={handleScrollSensChange}
              mouseRingRadius={mouseRingRadiusValue}
              onMouseRingRadiusChange={handleMouseRingRadiusChange}
            />
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={statusMessage}
              onChange={setConfigText}
              onApply={applyConfig}
              onCancel={handleCancel}
            />
          </>
        )}
      </div>
      {isCalibrationModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Real-world calibration</h3>
            <p className="modal-description">
              Loaded the calibration preset. In-game, rotate the stick for a full turn, return here, and run the calculation.
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={handleCloseCalibration}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
