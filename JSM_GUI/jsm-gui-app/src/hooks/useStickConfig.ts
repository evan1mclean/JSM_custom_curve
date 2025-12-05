import { useCallback, useMemo } from 'react'
import { getKeymapValue, removeKeymapEntry, updateKeymapEntry } from '../utils/keymap'
import { DEFAULT_STICK_DEADZONE_INNER, DEFAULT_STICK_DEADZONE_OUTER } from '../constants/defaults'
import { formatVidPid } from '../utils/controllers'
import { keyName } from '../constants/configKeys'

type StickArgs = {
  configText: string
  setConfigText: React.Dispatch<React.SetStateAction<string>>
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

export function useStickConfig({ configText, setConfigText }: StickArgs) {
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
    [setConfigText]
  )

  const handleStickModeChange = useCallback((side: 'LEFT' | 'RIGHT', mode: string) => {
    const key = `${side}_STICK_MODE`
    setConfigText(prev => {
      if (!mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim()])
    })
  }, [setConfigText])

  const handleRingModeChange = useCallback((side: 'LEFT' | 'RIGHT', mode: string) => {
    const key = `${side}_RING_MODE`
    setConfigText(prev => {
      if (!mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim()])
    })
  }, [setConfigText])

  const handleStickModeShiftChange = useCallback((button: string, target: 'LEFT' | 'RIGHT', mode?: string) => {
    const key = `${button.toUpperCase()},${target}_STICK_MODE`
    setConfigText(prev => {
      if (!mode || !mode.trim()) {
        return removeKeymapEntry(prev, key)
      }
      return updateKeymapEntry(prev, key, [mode.trim().toUpperCase()])
    })
  }, [setConfigText])

  const handleAdaptiveTriggerChange = useCallback((value: string) => {
    setConfigText(prev => {
      const trimmed = value.trim().toUpperCase()
      if (!trimmed || trimmed === 'ON') {
        return removeKeymapEntry(prev, keyName.ADAPTIVE_TRIGGER)
      }
      return updateKeymapEntry(prev, keyName.ADAPTIVE_TRIGGER, [trimmed === 'OFF' ? 'OFF' : trimmed])
    })
  }, [setConfigText])

  const handleStickSensChange = useCallback(
    (axis: 'X' | 'Y') => (value: string) => {
      const trimmed = value.trim()
      setConfigText(prev => {
        const raw = getKeymapValue(prev, keyName.STICK_SENS)
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
            return removeKeymapEntry(prev, keyName.STICK_SENS)
          }
          const nextX = parseNum(trimmed)
          if (nextX === null) return prev
          if (currentY === null) {
            return updateKeymapEntry(prev, keyName.STICK_SENS, [nextX])
          }
          return updateKeymapEntry(prev, keyName.STICK_SENS, [nextX, currentY])
        }
        if (currentX === null) {
          if (!trimmed) {
            return removeKeymapEntry(prev, keyName.STICK_SENS)
          }
          const inferred = parseNum(trimmed)
          if (inferred === null) return prev
          return updateKeymapEntry(prev, keyName.STICK_SENS, [inferred])
        }
        if (!trimmed) {
          return updateKeymapEntry(prev, keyName.STICK_SENS, [currentX])
        }
        const nextY = parseNum(trimmed)
        if (nextY === null) return prev
        return updateKeymapEntry(prev, keyName.STICK_SENS, [currentX, nextY])
      })
    },
    [setConfigText]
  )

  const handleStickPowerChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, keyName.STICK_POWER)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, keyName.STICK_POWER, [parsed])
    })
  }, [setConfigText])

  const handleStickAccelerationRateChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, keyName.STICK_ACCELERATION_RATE)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, keyName.STICK_ACCELERATION_RATE, [parsed])
    })
  }, [setConfigText])

  const handleStickAccelerationCapChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, keyName.STICK_ACCELERATION_CAP)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, keyName.STICK_ACCELERATION_CAP, [parsed])
    })
  }, [setConfigText])

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
      flickTime: formatNumber(getRaw(keyName.FLICK_TIME), ''),
      flickTimeExponent: formatNumber(getRaw(keyName.FLICK_TIME_EXPONENT), ''),
      snapMode: getRaw(keyName.FLICK_SNAP_MODE).toUpperCase(),
      snapStrength: formatNumber(getRaw(keyName.FLICK_SNAP_STRENGTH), ''),
      deadzoneAngle: formatNumber(getRaw(keyName.FLICK_DEADZONE_ANGLE), ''),
    }
  }, [configText])

  const handleFlickSettingChange = useCallback((key: string, value: string) => {
    setConfigText(prev => {
      const trimmed = value.trim()
      if (!trimmed) {
        return removeKeymapEntry(prev, key)
      }
      if (key === keyName.FLICK_SNAP_MODE) {
        return updateKeymapEntry(prev, key, [trimmed.toUpperCase()])
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed)) return prev
      return updateKeymapEntry(prev, key, [parsed])
    })
  }, [setConfigText])

  const stickFlickHandlers = useMemo(
    () => ({
      onFlickTimeChange: (value: string) => handleFlickSettingChange(keyName.FLICK_TIME, value),
      onFlickTimeExponentChange: (value: string) => handleFlickSettingChange(keyName.FLICK_TIME_EXPONENT, value),
      onSnapModeChange: (value: string) => handleFlickSettingChange(keyName.FLICK_SNAP_MODE, value),
      onSnapStrengthChange: (value: string) => handleFlickSettingChange(keyName.FLICK_SNAP_STRENGTH, value),
      onDeadzoneAngleChange: (value: string) => handleFlickSettingChange(keyName.FLICK_DEADZONE_ANGLE, value),
    }),
    [handleFlickSettingChange]
  )

  const mouseRingRadiusValue = useMemo(() => {
    const raw = getKeymapValue(configText, keyName.MOUSE_RING_RADIUS)
    if (!raw) return ''
    return raw.trim()
  }, [configText])

  const handleMouseRingRadiusChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, keyName.MOUSE_RING_RADIUS)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return prev
      }
      return updateKeymapEntry(prev, keyName.MOUSE_RING_RADIUS, [parsed])
    })
  }, [setConfigText])

  const counterOsMouseSpeedEnabled = useMemo(() => hasFlagCommand(configText, keyName.COUNTER_OS_MOUSE_SPEED), [configText])

  const handleCounterOsMouseSpeedChange = useCallback((enabled: boolean) => {
    setConfigText(prev => upsertFlagCommand(prev, keyName.COUNTER_OS_MOUSE_SPEED, enabled))
  }, [setConfigText])

  const stickDeadzoneDefaults = useMemo(() => {
    return {
      inner: getKeymapValue(configText, keyName.STICK_DEADZONE_INNER) ?? DEFAULT_STICK_DEADZONE_INNER,
      outer: getKeymapValue(configText, keyName.STICK_DEADZONE_OUTER) ?? DEFAULT_STICK_DEADZONE_OUTER,
    }
  }, [configText])
  const leftStickDeadzone = useMemo(() => {
    return {
      inner: getKeymapValue(configText, keyName.LEFT_STICK_DEADZONE_INNER) ?? '',
      outer: getKeymapValue(configText, keyName.LEFT_STICK_DEADZONE_OUTER) ?? '',
    }
  }, [configText])
  const rightStickDeadzone = useMemo(() => {
    return {
      inner: getKeymapValue(configText, keyName.RIGHT_STICK_DEADZONE_INNER) ?? '',
      outer: getKeymapValue(configText, keyName.RIGHT_STICK_DEADZONE_OUTER) ?? '',
    }
  }, [configText])
  const stickModes = useMemo(() => {
    return {
      left: {
        mode: getKeymapValue(configText, keyName.LEFT_STICK_MODE) ?? '',
        ring: getKeymapValue(configText, keyName.LEFT_RING_MODE) ?? '',
      },
      right: {
        mode: getKeymapValue(configText, keyName.RIGHT_STICK_MODE) ?? '',
        ring: getKeymapValue(configText, keyName.RIGHT_RING_MODE) ?? '',
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
    const rawSens = getKeymapValue(configText, keyName.STICK_SENS)
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
      power: getKeymapValue(configText, keyName.STICK_POWER) ?? '',
      accelerationRate: getKeymapValue(configText, keyName.STICK_ACCELERATION_RATE) ?? '',
      accelerationCap: getKeymapValue(configText, keyName.STICK_ACCELERATION_CAP) ?? '',
    }
  }, [configText])

  const adaptiveTriggerValue = useMemo(() => {
    const value = getKeymapValue(configText, keyName.ADAPTIVE_TRIGGER)
    if (!value) return ''
    return value.trim().toUpperCase() === 'OFF' ? 'OFF' : 'ON'
  }, [configText])

  const handleToggleIgnoreGyroDevice = useCallback((vid: number, pid: number, ignore: boolean) => {
    const id = formatVidPid(vid, pid).toLowerCase()
    if (!id) return
    setConfigText(prev => {
      const current = (getKeymapValue(prev, keyName.IGNORE_GYRO_DEVICES) ?? '')
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
        return removeKeymapEntry(prev, keyName.IGNORE_GYRO_DEVICES)
      }
      return updateKeymapEntry(prev, keyName.IGNORE_GYRO_DEVICES, nextList)
    })
  }, [setConfigText])

  const scrollSensValue = useMemo(() => {
    const raw = getKeymapValue(configText, keyName.SCROLL_SENS)
    if (!raw) return ''
    return raw.trim()
  }, [configText])

  const handleScrollSensChange = useCallback((value: string) => {
    const trimmed = value.trim()
    setConfigText(prev => {
      if (!trimmed) {
        return removeKeymapEntry(prev, keyName.SCROLL_SENS)
      }
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 0) {
        return prev
      }
      return updateKeymapEntry(prev, keyName.SCROLL_SENS, [parsed])
    })
  }, [setConfigText])

  return {
    handleStickDeadzoneChange,
    handleStickModeChange,
    handleRingModeChange,
    handleStickModeShiftChange,
    handleAdaptiveTriggerChange,
    handleStickSensChange,
    handleStickPowerChange,
    handleStickAccelerationRateChange,
    handleStickAccelerationCapChange,
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
    handleToggleIgnoreGyroDevice,
    scrollSensValue,
    handleScrollSensChange,
  }
}
