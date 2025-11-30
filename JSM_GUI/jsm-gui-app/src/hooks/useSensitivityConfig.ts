import { useCallback, useEffect, useMemo, useState } from 'react'
import { getKeymapValue, parseSensitivityValues, removeKeymapEntry, updateKeymapEntry } from '../utils/keymap'
import { DEFAULT_HOLD_PRESS_TIME, DEFAULT_WINDOW_SECONDS } from '../constants/defaults'

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

type SensitivityArgs = {
  configText: string
  setConfigText: React.Dispatch<React.SetStateAction<string>>
}

export function useSensitivityConfig({ configText, setConfigText }: SensitivityArgs) {
  const [sensitivityView, setSensitivityView] = useState<'base' | 'modeshift'>('base')

  const sensitivity = useMemo(() => parseSensitivityValues(configText), [configText])
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
    [sensitivityModeshiftButton, setConfigText]
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
  }, [setConfigText])

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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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
    [resolveSensitivityKey, setConfigText]
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

  const baseMode: 'static' | 'accel' = sensitivity.gyroSensX !== undefined ? 'static' : 'accel'
  const modeshiftMode: 'static' | 'accel' = modeshiftSensitivity?.gyroSensX !== undefined ? 'static' : 'accel'

  return {
    sensitivityView,
    setSensitivityView,
    sensitivity,
    sensitivityModeshiftButton,
    modeshiftSensitivity,
    activeSensitivityPrefix,
    baseMode,
    modeshiftMode,
    holdPressTimeSeconds,
    holdPressTimeIsCustom,
    doublePressWindowSeconds,
    doublePressWindowIsCustom,
    simPressWindowSeconds,
    simPressWindowIsCustom,
    triggerThresholdValue,
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
  }
}
