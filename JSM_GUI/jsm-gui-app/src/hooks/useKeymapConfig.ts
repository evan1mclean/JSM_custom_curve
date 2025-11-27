import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BindingSlot,
  getKeymapValue,
  isTrackballBindingPresent,
  parseSensitivityValues,
  removeKeymapEntry,
  setChordBinding,
  setDoubleBinding,
  setHoldBinding,
  setSimultaneousBinding,
  setTapBinding,
  updateKeymapEntry,
} from '../utils/keymap'
import { DEFAULT_HOLD_PRESS_TIME, DEFAULT_STICK_DEADZONE_INNER, DEFAULT_STICK_DEADZONE_OUTER, DEFAULT_WINDOW_SECONDS } from '../constants/defaults'
import { formatVidPid } from '../utils/controllers'

const TOGGLE_SPECIALS = ['GYRO_ON', 'GYRO_OFF'] as const
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

const prefixedKey = (key: string, prefix?: string) => (prefix ? `${prefix}${key}` : key)

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

export function useKeymapConfig() {
  const [configText, setConfigText] = useState('')
  const [appliedConfig, setAppliedConfig] = useState('')
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

  const handleSensitivityModeshiftButtonChange = useCallback(
    (value: string) => {
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
    },
    [sensitivityModeshiftButton]
  )

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

  const handleTouchpadModeChange = useCallback(
    (value: string) => {
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
    },
    [gridSizeRaw, gridSizeValue.columns, gridSizeValue.rows]
  )

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
      ].forEach(key => {
        next = removeKeymapEntry(next, prefixedKey(key, prefix))
      })
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
  const handleCancel = () => setConfigText(appliedConfig)

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

  return {
    configText,
    setConfigText,
    appliedConfig,
    setAppliedConfig,
    sensitivityView,
    setSensitivityView,
    sensitivityModeshiftButton,
    sensitivity,
    modeshiftSensitivity,
    activeSensitivityPrefix,
    ignoredGyroDevices,
    holdPressTimeSeconds,
    holdPressTimeIsCustom,
    doublePressWindowSeconds,
    doublePressWindowIsCustom,
    simPressWindowSeconds,
    simPressWindowIsCustom,
    triggerThresholdValue,
    touchpadModeValue,
    gridSizeValue,
    touchpadSensitivityValue,
    hasPendingChanges,
    baseMode,
    modeshiftMode,
    handleSensitivityModeshiftButtonChange,
    handleThresholdChange,
    handleCutoffSpeedChange,
    handleCutoffRecoveryChange,
    handleSmoothTimeChange,
    handleSmoothThresholdChange,
    handleTickTimeChange,
    handleHoldPressTimeChange,
    handleDoublePressWindowChange,
    handleSimPressWindowChange,
    handleTriggerThresholdChange,
    handleGyroSpaceChange,
    handleGyroAxisXChange,
    handleGyroAxisYChange,
    handleDualSensChange,
    handleStaticSensChange,
    handleTouchpadModeChange,
    handleGridSizeChange,
    handleTouchpadSensitivityChange,
    handleInGameSensChange,
    handleRealWorldCalibrationChange,
    switchToStaticMode,
    handleAccelCurveChange,
    handleNaturalVHalfChange,
    handlePowerVRefChange,
    handlePowerExponentChange,
    handleJumpTauChange,
    handleSigmoidMidChange,
    handleSigmoidWidthChange,
    switchToAccelMode,
    handleCancel,
    handleFaceButtonBindingChange,
    handleModifierChange,
    handleSpecialActionAssignment,
    handleClearSpecialAction,
    trackballDecayValue,
    handleTrackballDecayChange,
    handleStickDeadzoneChange,
    handleStickModeChange,
    handleRingModeChange,
    handleStickModeShiftChange,
    handleAdaptiveTriggerChange,
    stickAimHandlers,
    stickFlickSettings,
    stickFlickHandlers,
    mouseRingRadiusValue,
    handleMouseRingRadiusChange,
    counterOsMouseSpeedEnabled,
    handleCounterOsMouseSpeedChange,
    stickDeadzoneDefaults,
    leftStickDeadzone,
    rightStickDeadzone,
    stickModes,
    stickModeShiftAssignments,
    stickAimSettings,
    adaptiveTriggerValue,
    handleStickSensChange,
    handleStickPowerChange,
    handleStickAccelerationRateChange,
    handleStickAccelerationCapChange,
    handleToggleIgnoreGyroDevice,
    scrollSensValue,
    handleScrollSensChange,
  }
}
