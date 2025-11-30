import { useCallback, useEffect, useState } from 'react'
import { getKeymapValue, removeKeymapEntry, updateKeymapEntry } from '../utils/keymap'
import { upsertFlagCommand } from '../utils/config'
import { keyName } from '../constants/configKeys'

type UseCalibrationParams = {
  configText: string
  counterOsMouseSpeedEnabled: boolean
  sensitivityInGame?: number
}

export function useCalibration({ configText, counterOsMouseSpeedEnabled, sensitivityInGame }: UseCalibrationParams) {
  const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false)
  const [calibrationRestorePath, setCalibrationRestorePath] = useState<string | null>(null)
  const [calibrationCounterOs, setCalibrationCounterOs] = useState<boolean>(counterOsMouseSpeedEnabled)
  const [calibrationInGameSens, setCalibrationInGameSens] = useState<string>(sensitivityInGame?.toString() ?? '')
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
    const sens = getKeymapValue(calibrationText, keyName.IN_GAME_SENS) ?? ''
    const counter = Boolean(calibrationText && new RegExp(`(^|\\s)${keyName.COUNTER_OS_MOUSE_SPEED}\\b`, 'i').test(calibrationText))
    setCalibrationInGameSens(sens)
    setCalibrationCounterOs(counter)
    setCalibrationDirty(false)
  }, [calibrationText])

  const handleOpenCalibration = useCallback(async () => {
    setCalibrationOutput('')
    setCalibrationCounterOs(counterOsMouseSpeedEnabled)
    setCalibrationInGameSens(sensitivityInGame?.toString() ?? '')
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
        const presetSens = getKeymapValue(preset.content, keyName.IN_GAME_SENS) ?? sensitivityInGame?.toString() ?? ''
        const presetCounter = new RegExp(`(^|\\s)${keyName.COUNTER_OS_MOUSE_SPEED}\\b`, 'i').test(preset.content)
        setCalibrationInGameSens(presetSens)
        setCalibrationCounterOs(presetCounter)
        setCalibrationDirty(false)
      }
    } catch (err) {
      console.error('Failed to load calibration preset', err)
    }
  }, [counterOsMouseSpeedEnabled, sensitivityInGame])

  const handleCloseCalibration = useCallback(
    async () => {
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
    },
    [calibrationRestorePath, configText]
  )

  const buildCalibrationPreset = useCallback(() => {
    let next = calibrationText || ''
    next = upsertFlagCommand(next, keyName.COUNTER_OS_MOUSE_SPEED, calibrationCounterOs)
    const trimmed = calibrationInGameSens.trim()
    if (!trimmed) {
      next = removeKeymapEntry(next, keyName.IN_GAME_SENS)
    } else {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        next = updateKeymapEntry(next, keyName.IN_GAME_SENS, [parsed])
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

  return {
    isCalibrationModalOpen,
    setCalibrationModalOpen,
    calibrationRestorePath,
    setCalibrationRestorePath,
    calibrationCounterOs,
    setCalibrationCounterOs,
    calibrationInGameSens,
    setCalibrationInGameSens,
    calibrationText,
    setCalibrationText,
    calibrationDirty,
    setCalibrationDirty,
    calibrationLoadMessage,
    calibrationOutput,
    resetCalibrationInputs,
    handleOpenCalibration,
    handleCloseCalibration,
    buildCalibrationPreset,
    handleApplyCalibrationPreset,
    handleRunCalibration,
  }
}
