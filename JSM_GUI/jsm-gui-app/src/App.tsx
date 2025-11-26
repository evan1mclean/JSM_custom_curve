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
import { ProfileManager } from './components/ProfileManager'
import { GyroBehaviorControls } from './components/GyroBehaviorControls'
import { NoiseSteadyingControls } from './components/NoiseSteadyingControls'
import { KeymapControls } from './components/KeymapControls'
import { SectionActions } from './components/SectionActions'

type PrimaryTab = 'gyro' | 'keybinds' | 'touchpad' | 'sticks'
type GyroSubTab = 'behavior' | 'sensitivity' | 'noise'
type KeybindsSubTab = 'face' | 'dpad' | 'bumpers' | 'triggers' | 'center'
type TouchpadSubTab = 'mode' | 'grid' | 'bind'
type SticksSubTab = 'bindings' | 'modes'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'
const formatVidPid = (vid?: number, pid?: number) => {
  if (vid === undefined || pid === undefined) return ''
  const toHex = (value: number) => `0x${value.toString(16).padStart(4, '0')}`
  return `${toHex(vid)}:${toHex(pid)}`
}

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
const SENS_MODE_KEYS = [
  'MIN_GYRO_THRESHOLD',
  'MAX_GYRO_THRESHOLD',
  'MIN_GYRO_SENS',
  'MAX_GYRO_SENS',
  'GYRO_SENS',
  'ACCEL_CURVE',
  'ACCEL_NATURAL_VHALF',
  'ACCEL_POWER_VREF',
  'ACCEL_POWER_EXPONENT',
  'ACCEL_SIGMOID_MID',
  'ACCEL_SIGMOID_WIDTH',
  'ACCEL_JUMP_TAU',
] as const
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

const upsertFlagCommand = (text: string, key: string, enabled: boolean) => {
  const lines = text.split(/\r?\n/).filter(line => {
    const trimmed = line.trim().toUpperCase()
    if (!trimmed) return true
    return !(trimmed === key.toUpperCase() || trimmed.startsWith(`${key.toUpperCase()} `) || trimmed.startsWith(`${key.toUpperCase()}=`))
  })
  if (enabled) {
    lines.push(key)
  }
  return lines.join('\n')
}

const hasFlagCommand = (text: string, key: string) => {
  const pattern = new RegExp(`^\\s*${key}\\b`, 'im')
  return pattern.test(text)
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
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('gyro')
  const [gyroSubTab, setGyroSubTab] = useState<GyroSubTab>('behavior')
  const [keybindsSubTab, setKeybindsSubTab] = useState<KeybindsSubTab>('face')
  const [touchpadSubTab, setTouchpadSubTab] = useState<TouchpadSubTab>('mode')
  const [sticksSubTab, setSticksSubTab] = useState<SticksSubTab>('bindings')
  const [sensitivityView, setSensitivityView] = useState<'base' | 'modeshift'>('base')
  const ignoredGyroDevices = useMemo(() => {
    const raw = getKeymapValue(configText, 'IGNORE_GYRO_DEVICES') ?? ''
    return raw
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .map(token => token.toLowerCase())
  }, [configText])
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
          if (base.accelCurve) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_CURVE`, [base.accelCurve])
          }
          if (base.naturalVHalf !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_NATURAL_VHALF`, [base.naturalVHalf])
          }
          if (base.powerVRef !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_POWER_VREF`, [base.powerVRef])
          }
          if (base.powerExponent !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_POWER_EXPONENT`, [base.powerExponent])
          }
          if (base.sigmoidMid !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_SIGMOID_MID`, [base.sigmoidMid])
          }
          if (base.sigmoidWidth !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_SIGMOID_WIDTH`, [base.sigmoidWidth])
          }
          if (base.jumpTau !== undefined) {
            next = updateKeymapEntry(next, `${nextButton},ACCEL_JUMP_TAU`, [base.jumpTau])
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
    if (Number.isNaN(next) || next < 0) return
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
    if (Number.isNaN(next) || next < 0) return
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
    if (Number.isNaN(next) || next < 0) return
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
      ;[
        'MIN_GYRO_SENS',
        'MAX_GYRO_SENS',
        'MIN_GYRO_THRESHOLD',
        'MAX_GYRO_THRESHOLD',
        'ACCEL_CURVE',
        'ACCEL_NATURAL_VHALF',
        'ACCEL_POWER_VREF',
        'ACCEL_POWER_EXPONENT',
        'ACCEL_SIGMOID_MID',
        'ACCEL_SIGMOID_WIDTH',
        'ACCEL_JUMP_TAU',
      ].forEach(
        key => {
        next = removeKeymapEntry(next, prefixedKey(key, prefix))
        }
      )
      return next
    })
  }

  const handleAccelCurveChange = useCallback(
    (value: string) => {
      const upper = value.trim().toUpperCase()
      setConfigText(prev => {
        let next = prev
        if (!upper || upper === 'LINEAR') {
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
          next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_JUMP_TAU'))
          return next
        }
        if (upper === 'NATURAL' || upper === 'POWER' || upper === 'QUADRATIC' || upper === 'SIGMOID' || upper === 'JUMP') {
          next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), [upper])
          if (upper === 'NATURAL') {
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_JUMP_TAU'))
          } else if (upper === 'POWER') {
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_JUMP_TAU'))
          } else if (upper === 'SIGMOID') {
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_JUMP_TAU'))
          } else if (upper === 'JUMP') {
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
          } else {
            // Quadratic and other threshold-based curves
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
            next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_JUMP_TAU'))
          }
        }
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handleNaturalVHalfChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_NATURAL_VHALF')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_NATURAL_VHALF'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['NATURAL'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handlePowerVRefChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_POWER_VREF')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_POWER_VREF'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['POWER'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handlePowerExponentChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_POWER_EXPONENT')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_POWER_EXPONENT'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['POWER'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handleJumpTauChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_JUMP_TAU')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed < 0) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_JUMP_TAU'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['JUMP'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_MID'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handleSigmoidMidChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_SIGMOID_MID')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed)) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_SIGMOID_MID'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['SIGMOID'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

  const handleSigmoidWidthChange = useCallback(
    (value: string) => {
      if (value === '') {
        setConfigText(prev => removeKeymapEntry(prev, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH')))
        return
      }
      const parsed = parseFloat(value)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      setConfigText(prev => {
        let next = updateKeymapEntry(prev, resolveSensitivityKey('ACCEL_SIGMOID_WIDTH'), [parsed])
        next = updateKeymapEntry(next, resolveSensitivityKey('ACCEL_CURVE'), ['SIGMOID'])
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_NATURAL_VHALF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_VREF'))
        next = removeKeymapEntry(next, resolveSensitivityKey('ACCEL_POWER_EXPONENT'))
        return next
      })
    },
    [resolveSensitivityKey]
  )

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
      next = updateKeymapEntry(next, prefixedKey('ACCEL_CURVE', prefix), ['LINEAR'])
      next = removeKeymapEntry(next, prefixedKey('ACCEL_NATURAL_VHALF', prefix))
      next = removeKeymapEntry(next, prefixedKey('ACCEL_POWER_VREF', prefix))
      next = removeKeymapEntry(next, prefixedKey('ACCEL_POWER_EXPONENT', prefix))
      next = removeKeymapEntry(next, prefixedKey('ACCEL_SIGMOID_MID', prefix))
      next = removeKeymapEntry(next, prefixedKey('ACCEL_SIGMOID_WIDTH', prefix))
      next = removeKeymapEntry(next, prefixedKey('ACCEL_JUMP_TAU', prefix))
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
  const counterOsMouseSpeedEnabled = useMemo(() => hasFlagCommand(configText, 'COUNTER_OS_MOUSE_SPEED'), [configText])

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
    setConfigText(prev => upsertFlagCommand(prev, 'COUNTER_OS_MOUSE_SPEED', enabled))
  }, [])

  const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false)
  const [calibrationRestorePath, setCalibrationRestorePath] = useState<string | null>(null)
  const [calibrationCounterOs, setCalibrationCounterOs] = useState<boolean>(counterOsMouseSpeedEnabled)
  const [calibrationInGameSens, setCalibrationInGameSens] = useState<string>(sensitivity.inGameSens?.toString() ?? '')
  const [calibrationText, setCalibrationText] = useState<string>('')
  const [calibrationDirty, setCalibrationDirty] = useState(false)
  const [calibrationLoadMessage, setCalibrationLoadMessage] = useState<string | null>(null)
  const [calibrationOutput, setCalibrationOutput] = useState<string>('')
  useEffect(() => {
    if (!calibrationLoadMessage) return
    const id = setTimeout(() => setCalibrationLoadMessage(null), 4000)
    return () => clearTimeout(id)
  }, [calibrationLoadMessage])
  const resetCalibrationInputs = useCallback(() => {
    const sens = getKeymapValue(calibrationText, 'IN_GAME_SENS') ?? ''
    const counter = hasFlagCommand(calibrationText, 'COUNTER_OS_MOUSE_SPEED')
    setCalibrationInGameSens(sens)
    setCalibrationCounterOs(counter)
    setCalibrationDirty(false)
  }, [calibrationText])

  const handleOpenCalibration = useCallback(async () => {
    setCalibrationOutput('')
    setCalibrationCounterOs(counterOsMouseSpeedEnabled)
    setCalibrationInGameSens(sensitivity.inGameSens?.toString() ?? '')
    setCalibrationModalOpen(true)
    try {
      const result = await window.electronAPI?.loadCalibrationPreset?.()
      if (result?.activeProfile) {
        setCalibrationRestorePath(result.activeProfile)
      }
      setCalibrationLoadMessage(result?.success ? 'Calibration preset loaded.' : 'Failed to load calibration preset.')
      const preset = await window.electronAPI?.readCalibrationPreset?.()
      if (preset?.success && preset.content !== undefined) {
        setCalibrationText(preset.content)
        const presetSens = getKeymapValue(preset.content, 'IN_GAME_SENS') ?? sensitivity.inGameSens?.toString() ?? ''
        const presetCounter = hasFlagCommand(preset.content, 'COUNTER_OS_MOUSE_SPEED')
        setCalibrationInGameSens(presetSens)
        setCalibrationCounterOs(presetCounter)
        setCalibrationDirty(false)
      }
    } catch (err) {
      console.error('Failed to load calibration preset', err)
    }
  }, [counterOsMouseSpeedEnabled, sensitivity.inGameSens])
  const handleCloseCalibration = useCallback(async () => {
    setCalibrationModalOpen(false)
    setCalibrationOutput('')
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

  const buildCalibrationPreset = useCallback(() => {
    let next = calibrationText || ''
    next = upsertFlagCommand(next, 'COUNTER_OS_MOUSE_SPEED', calibrationCounterOs)
    const trimmed = calibrationInGameSens.trim()
    if (!trimmed) {
      next = removeKeymapEntry(next, 'IN_GAME_SENS')
    } else {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        next = updateKeymapEntry(next, 'IN_GAME_SENS', [parsed])
      }
    }
    return next
  }, [calibrationCounterOs, calibrationInGameSens, calibrationText])

  const handleApplyCalibrationPreset = useCallback(async () => {
    const nextText = buildCalibrationPreset()
    setCalibrationText(nextText)
    setCalibrationDirty(false)
    await window.electronAPI?.saveCalibrationPreset?.(nextText)
  }, [buildCalibrationPreset])

  const handleRunCalibration = useCallback(async () => {
    try {
      const result = await window.electronAPI?.runCalibrationCommand?.('CALCULATE_REAL_WORLD_CALIBRATION')
      const output = result && typeof result.output === 'string' ? result.output : ''
      if (output.length > 0) {
        setCalibrationOutput(output)
      } else {
        setCalibrationOutput('No response captured.')
      }
    } catch (err) {
      setCalibrationOutput(`Failed to run calculation: ${String(err)}`)
    }
  }, [])


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

  const handleToggleIgnoreGyroDevice = useCallback((vid: number, pid: number, ignore: boolean) => {
    const id = formatVidPid(vid, pid).toLowerCase()
    if (!id) return
    setConfigText(prev => {
      const current = (getKeymapValue(prev, 'IGNORE_GYRO_DEVICES') ?? '')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => token.toLowerCase())
      const set = new Set(current)
      if (ignore) {
        set.add(id)
      } else {
        set.delete(id)
      }
      const nextList = Array.from(set)
      if (nextList.length === 0) {
        return removeKeymapEntry(prev, 'IGNORE_GYRO_DEVICES')
      }
      return updateKeymapEntry(prev, 'IGNORE_GYRO_DEVICES', nextList)
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
  const calibrationMessage = isCalibrating ? `Calibrating — place controller on a flat surface (${countdown ?? '...'}s)` : ''
  const lockMessage = 'Calibrating — place controller on a flat surface'

  const renderGyroNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${gyroSubTab === 'behavior' ? 'active' : ''}`} onClick={() => setGyroSubTab('behavior')}>
        Gyro Behavior
      </button>
      <button className={`pill-tab ${gyroSubTab === 'sensitivity' ? 'active' : ''}`} onClick={() => setGyroSubTab('sensitivity')}>
        Sensitivity
      </button>
      <button className={`pill-tab ${gyroSubTab === 'noise' ? 'active' : ''}`} onClick={() => setGyroSubTab('noise')}>
        Noise & Steadying
      </button>
    </div>
  )

  const renderKeybindsNav = () => (
    <div className="subnav">
      {(['face', 'dpad', 'bumpers', 'triggers', 'center'] as KeybindsSubTab[]).map(entry => (
        <button key={entry} className={`pill-tab ${keybindsSubTab === entry ? 'active' : ''}`} onClick={() => setKeybindsSubTab(entry)}>
          {entry === 'face' && 'Face'}
          {entry === 'dpad' && 'D-pad'}
          {entry === 'bumpers' && 'Bumpers'}
          {entry === 'triggers' && 'Triggers'}
          {entry === 'center' && 'Center'}
        </button>
      ))}
    </div>
  )

  const renderTouchpadNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${touchpadSubTab === 'mode' ? 'active' : ''}`} onClick={() => setTouchpadSubTab('mode')}>
        Mode
      </button>
      <button className={`pill-tab ${touchpadSubTab === 'grid' ? 'active' : ''}`} onClick={() => setTouchpadSubTab('grid')}>
        Grid
      </button>
      <button className={`pill-tab ${touchpadSubTab === 'bind' ? 'active' : ''}`} onClick={() => setTouchpadSubTab('bind')}>
        Bindings
      </button>
    </div>
  )

  const renderSticksNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${sticksSubTab === 'bindings' ? 'active' : ''}`} onClick={() => setSticksSubTab('bindings')}>
        Bindings
      </button>
      <button className={`pill-tab ${sticksSubTab === 'modes' ? 'active' : ''}`} onClick={() => setSticksSubTab('modes')}>
        Modes & Settings
      </button>
    </div>
  )

  const renderPrimaryContent = () => {
    if (primaryTab === 'gyro') {
      return (
        <>
          {gyroSubTab === 'behavior' && (
            <>
              <GyroBehaviorControls
                sensitivity={sensitivity}
                isCalibrating={isCalibrating}
                statusMessage={statusMessage}
                devices={sample?.devices}
                ignoredDevices={ignoredGyroDevices}
                onToggleIgnoreDevice={handleToggleIgnoreGyroDevice}
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
              lockMessage={lockMessage}
            />
          </>
        )}
        {gyroSubTab === 'sensitivity' && (
          <SensitivityControls
              sensitivity={sensitivity}
              modeshiftSensitivity={modeshiftSensitivity}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              accelCurve={sensitivity.accelCurve}
              naturalVHalf={sensitivity.naturalVHalf}
              powerVRef={sensitivity.powerVRef}
              powerExponent={sensitivity.powerExponent}
              sigmoidMid={sensitivity.sigmoidMid}
              sigmoidWidth={sensitivity.sigmoidWidth}
              jumpTau={sensitivity.jumpTau}
              mode={currentMode}
              sensitivityView={sensitivityView}
              hasPendingChanges={hasPendingChanges}
              sample={sample}
              telemetry={telemetryValues}
              touchpadMode={touchpadModeValue}
              touchpadGridCells={touchpadModeValue === 'GRID_AND_STICK' ? Math.min(25, gridSizeValue.columns * gridSizeValue.rows) : 0}
              onModeChange={(mode) =>
                mode === 'static' ? switchToStaticMode(activeSensitivityPrefix) : switchToAccelMode(activeSensitivityPrefix)
              }
              onSensitivityViewChange={setSensitivityView}
              onApply={applyConfig}
              onCancel={handleCancel}
              onAccelCurveChange={handleAccelCurveChange}
              onNaturalVHalfChange={handleNaturalVHalfChange}
              onPowerVRefChange={handlePowerVRefChange}
              onPowerExponentChange={handlePowerExponentChange}
              onSigmoidMidChange={handleSigmoidMidChange}
              onSigmoidWidthChange={handleSigmoidWidthChange}
              onJumpTauChange={handleJumpTauChange}
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
              lockMessage={lockMessage}
            />
          )}
          {gyroSubTab === 'noise' && (
            <NoiseSteadyingControls
              sensitivity={sensitivity}
              isCalibrating={isCalibrating}
              statusMessage={statusMessage}
              hasPendingChanges={hasPendingChanges}
              onApply={applyConfig}
              onCancel={handleCancel}
              lockMessage={lockMessage}
              onCutoffSpeedChange={handleCutoffSpeedChange}
              onCutoffRecoveryChange={handleCutoffRecoveryChange}
              onSmoothTimeChange={handleSmoothTimeChange}
              onSmoothThresholdChange={handleSmoothThresholdChange}
              telemetry={{ omega: telemetryValues.omega, timestamp: telemetryValues.timestamp }}
            />
          )}
        </>
      )
    }

    if (primaryTab === 'keybinds') {
      return (
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
            lockMessage={lockMessage}
            visibleSections={[keybindsSubTab === 'face' && 'global', keybindsSubTab].filter(Boolean) as string[]}
          />
        </>
      )
    }

    if (primaryTab === 'touchpad') {
      const sections =
        touchpadSubTab === 'bind'
          ? ['touch-bind']
          : touchpadSubTab === 'grid'
            ? ['touch-grid']
            : ['touch-grid']
      return (
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
            lockMessage={lockMessage}
            visibleSections={sections}
          />
        </>
      )
    }

    if (primaryTab === 'sticks') {
      return (
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
            stickForcedView={sticksSubTab}
            showStickViewToggle={false}
            lockMessage={lockMessage}
          />
        </>
      )
    }

    return null
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="nav-brand">JSM Custom Curve</div>
        <div className="nav-group">
          <button className={`nav-item ${primaryTab === 'gyro' ? 'active' : ''}`} onClick={() => setPrimaryTab('gyro')}>
            Gyro & Sensitivity
          </button>
          <button className={`nav-item ${primaryTab === 'keybinds' ? 'active' : ''}`} onClick={() => setPrimaryTab('keybinds')}>
            Keybinds
          </button>
          <button className={`nav-item ${primaryTab === 'touchpad' ? 'active' : ''}`} onClick={() => setPrimaryTab('touchpad')}>
            Touchpad
          </button>
          <button className={`nav-item ${primaryTab === 'sticks' ? 'active' : ''}`} onClick={() => setPrimaryTab('sticks')}>
            Sticks
          </button>
        </div>
      </aside>
      <div className="shell-main">
          <div className="top-bar">
          <div className="top-bar-left">
            {primaryTab === 'gyro' && renderGyroNav()}
            {primaryTab === 'keybinds' && renderKeybindsNav()}
            {primaryTab === 'touchpad' && renderTouchpadNav()}
            {primaryTab === 'sticks' && renderSticksNav()}
          </div>
          <div className="top-bar-right" />
        </div>
        <div className="content-grid">
          <main className="main-pane">{renderPrimaryContent()}</main>
          <aside className="right-rail">
            <div className="recalibrate-card">
              {isCalibrating ? (
                <div className="recalibrate-row">
                  <span className="calibration-pill calibration-pill-inline">
                    Calibrating — ({countdown ?? '…'})
                  </span>
                </div>
              ) : (
                <button className="secondary-btn rail-button" onClick={handleRecalibrate} disabled={recalibrating}>
                  {recalibrating ? 'Recalibrating…' : 'Recalibrate gyro'}
                </button>
              )}
            </div>
            <div className="profile-summary-card">
              <div className="profile-summary-header">
                <div className="profile-summary-title">Profile</div>
                <span className={`status-chip ${hasPendingChanges ? 'warning' : 'success'}`}>
                  {hasPendingChanges ? 'Pending changes' : 'Applied'}
                </span>
              </div>
              <div className="profile-summary-name">{currentLibraryProfile ?? 'Unsaved profile'}</div>
              <label className="profile-summary-select">
                Quick switch
                <select
                  className="app-select"
                  value={currentLibraryProfile ?? ''}
                  onChange={event => {
                    const name = event.target.value
                    if (!name) return
                    handleLoadProfileFromLibrary(name)
                  }}
                >
                  <option value="" disabled>
                    Select profile
                  </option>
                  {(libraryProfiles ?? []).map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-summary-actions">
                <button className="secondary-btn" onClick={() => setProfileModalOpen(true)}>
                  Manage profiles
                </button>
                <button className="secondary-btn" onClick={handleImportProfile} disabled={!window.electronAPI?.saveLibraryProfile}>
                  Import
                </button>
              </div>
            </div>
            <div className="config-editor-desktop">
              <ConfigEditor
                value={configText}
                label={profileFileLabel}
                disabled={isCalibrating}
                hasPendingChanges={hasPendingChanges}
                statusMessage={statusMessage}
                onChange={setConfigText}
                onApply={applyConfig}
                onCancel={handleCancel}
                lockMessage={lockMessage}
              />
            </div>
          </aside>
          <div className="config-editor-mobile">
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={statusMessage}
              onChange={setConfigText}
              onApply={applyConfig}
              onCancel={handleCancel}
              lockMessage={lockMessage}
            />
          </div>
        </div>
      </div>
      {isCalibrationModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Real-world calibration</h3>
              {calibrationLoadMessage && <span className="profile-status inline-flag">{calibrationLoadMessage}</span>}
            </div>
            <p className="modal-description">
              Set your in-game sensitivity and whether to counter OS mouse speed, apply the preset to JSM, then in-game rotate the stick for an exact 360°. Come back here to run the calculation.
            </p>
            <div className="flex-inputs">
              <label>
                In-Game Sensitivity
                <input
                  type="number"
                  step="0.1"
                  value={calibrationInGameSens}
                  onChange={(event) => {
                    setCalibrationInGameSens(event.target.value)
                    setCalibrationDirty(true)
                  }}
                />
              </label>
            </div>
            <div className="flex-inputs">
              <label>
                Counter OS mouse speed
                <p className="field-description">Enable for non-raw-input games when Windows pointer speed isn’t 6/11.</p>
                <select
                  className="app-select"
                  value={calibrationCounterOs ? 'ON' : 'OFF'}
                  onChange={(event) => {
                    setCalibrationCounterOs(event.target.value === 'ON')
                    setCalibrationDirty(true)
                  }}
                >
                  <option value="OFF">Off (default)</option>
                  <option value="ON">On</option>
                </select>
              </label>
            </div>
            <SectionActions
              hasPendingChanges={calibrationDirty}
              statusMessage={statusMessage}
              onApply={() => {
                handleApplyCalibrationPreset()
              }}
              onCancel={resetCalibrationInputs}
              applyDisabled={isCalibrating}
            />
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={handleRunCalibration} disabled={isCalibrating}>
                Run calculation
              </button>
              <button type="button" className="secondary-btn" onClick={handleCloseCalibration}>
                Close
              </button>
            </div>
            {calibrationOutput && (
              <>
                <div className="calibration-output__label">Calculation result</div>
                <div className="calibration-output" data-capture-ignore="true">
                  <pre>{calibrationOutput}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {isProfileModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card profile-modal">
            <div className="modal-header">
              <h3>Profiles</h3>
              <button className="secondary-btn" onClick={() => setProfileModalOpen(false)}>
                Close
              </button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  )
}

export default App
