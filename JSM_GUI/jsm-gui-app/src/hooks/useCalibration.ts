import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keyName } from '../constants/configKeys'
import { upsertFlagCommand } from '../utils/config'
import { getKeymapValue, removeKeymapEntry, updateKeymapEntry } from '../utils/keymap'

type UseCalibrationParams = {
  configText: string
  counterOsMouseSpeedEnabled: boolean
  sensitivityInGame?: number
}

export function useCalibration({ configText, counterOsMouseSpeedEnabled, sensitivityInGame }: UseCalibrationParams) {
  const { t } = useTranslation()
  const [isCalibrationModalOpen, setCalibrationModalOpen] = useState(false)
  const [calibrationRestorePath, setCalibrationRestorePath] = useState<string | null>(null)
  const [calibrationCounterOs, setCalibrationCounterOs] = useState<boolean>(false)
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
    const nonCommentText = calibrationText.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
    const counter = Boolean(nonCommentText && new RegExp(`(^|\\s)${keyName.COUNTER_OS_MOUSE_SPEED}\\b`, 'i').test(nonCommentText))
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
      setCalibrationLoadMessage(result?.success ? t('messages.calibrationPresetLoaded') : t('messages.calibrationPresetFailed'))
      const preset = await window.electronAPI?.readCalibrationPreset?.()
      if (preset?.success && preset.content !== undefined) {
        setCalibrationText(preset.content)
        const presetSens = getKeymapValue(preset.content, keyName.IN_GAME_SENS) ?? sensitivityInGame?.toString() ?? ''
        const nonCommentPreset = preset.content.split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
        const presetCounter = new RegExp(`(^|\\s)${keyName.COUNTER_OS_MOUSE_SPEED}\\b`, 'i').test(nonCommentPreset)
        setCalibrationInGameSens(presetSens)
        setCalibrationCounterOs(presetCounter)
        setCalibrationDirty(false)
      }
    } catch (err) {
      console.error('Failed to load calibration preset', err)
      setCalibrationLoadMessage(t('messages.calibrationPresetFailed'))
    }
  }, [counterOsMouseSpeedEnabled, sensitivityInGame, t])

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

  const handleRunCalibration = useCallback(
    async (turns: number) => {
      try {
        const command = turns !== 1 ? `CALCULATE_REAL_WORLD_CALIBRATION ${turns}` : 'CALCULATE_REAL_WORLD_CALIBRATION'
        const result = await window.electronAPI?.runCalibrationCommand?.(command)
        const output = result && typeof result.output === 'string' ? result.output : ''
        if (output.length > 0) {
          setCalibrationOutput(output)
        } else {
          setCalibrationOutput(t('messages.calibrationNoResponse'))
        }
      } catch (err) {
        setCalibrationOutput(t('messages.calibrationRunFailed', { error: String(err) }))
      }
    },
    [t]
  )

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
