import { useMemo, useState } from 'react'
import { getKeymapValue } from '../utils/keymap'
import { keyName } from '../constants/configKeys'
import { useSensitivityConfig } from './useSensitivityConfig'
import { useTouchpadConfig } from './useTouchpadConfig'
import { useStickConfig } from './useStickConfig'
import { useBindingsConfig } from './useBindingsConfig'

export function useKeymapConfig() {
  const [configText, setConfigText] = useState('')
  const [appliedConfig, setAppliedConfig] = useState('')

  const sensitivityConfig = useSensitivityConfig({ configText, setConfigText })
  const touchpadConfig = useTouchpadConfig({ configText, setConfigText })
  const stickConfig = useStickConfig({ configText, setConfigText })
  const bindingsConfig = useBindingsConfig({ configText, setConfigText })

  const ignoredGyroDevices = useMemo(() => {
    const raw = getKeymapValue(configText, keyName.IGNORE_GYRO_DEVICES) ?? ''
    return raw
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .map(token => token.toLowerCase())
  }, [configText])

  const hasPendingChanges = configText !== appliedConfig
  const handleCancel = () => setConfigText(appliedConfig)

  return {
    configText,
    setConfigText,
    appliedConfig,
    setAppliedConfig,
    hasPendingChanges,
    handleCancel,
    ignoredGyroDevices,
    // Sensitivity slice
    sensitivityView: sensitivityConfig.sensitivityView,
    setSensitivityView: sensitivityConfig.setSensitivityView,
    sensitivityModeshiftButton: sensitivityConfig.sensitivityModeshiftButton,
    sensitivity: sensitivityConfig.sensitivity,
    modeshiftSensitivity: sensitivityConfig.modeshiftSensitivity,
    activeSensitivityPrefix: sensitivityConfig.activeSensitivityPrefix,
    baseMode: sensitivityConfig.baseMode,
    modeshiftMode: sensitivityConfig.modeshiftMode,
    holdPressTimeSeconds: sensitivityConfig.holdPressTimeSeconds,
    holdPressTimeIsCustom: sensitivityConfig.holdPressTimeIsCustom,
    doublePressWindowSeconds: sensitivityConfig.doublePressWindowSeconds,
    doublePressWindowIsCustom: sensitivityConfig.doublePressWindowIsCustom,
    simPressWindowSeconds: sensitivityConfig.simPressWindowSeconds,
    simPressWindowIsCustom: sensitivityConfig.simPressWindowIsCustom,
    triggerThresholdValue: sensitivityConfig.triggerThresholdValue,
    handleSensitivityModeshiftButtonChange: sensitivityConfig.handleSensitivityModeshiftButtonChange,
    handleThresholdChange: sensitivityConfig.handleThresholdChange,
    handleCutoffSpeedChange: sensitivityConfig.handleCutoffSpeedChange,
    handleCutoffRecoveryChange: sensitivityConfig.handleCutoffRecoveryChange,
    handleSmoothTimeChange: sensitivityConfig.handleSmoothTimeChange,
    handleSmoothThresholdChange: sensitivityConfig.handleSmoothThresholdChange,
    handleTickTimeChange: sensitivityConfig.handleTickTimeChange,
    handleHoldPressTimeChange: sensitivityConfig.handleHoldPressTimeChange,
    handleDoublePressWindowChange: sensitivityConfig.handleDoublePressWindowChange,
    handleSimPressWindowChange: sensitivityConfig.handleSimPressWindowChange,
    handleTriggerThresholdChange: sensitivityConfig.handleTriggerThresholdChange,
    handleGyroSpaceChange: sensitivityConfig.handleGyroSpaceChange,
    handleGyroAxisXChange: sensitivityConfig.handleGyroAxisXChange,
    handleGyroAxisYChange: sensitivityConfig.handleGyroAxisYChange,
    handleDualSensChange: sensitivityConfig.handleDualSensChange,
    handleStaticSensChange: sensitivityConfig.handleStaticSensChange,
    handleInGameSensChange: sensitivityConfig.handleInGameSensChange,
    handleRealWorldCalibrationChange: sensitivityConfig.handleRealWorldCalibrationChange,
    switchToStaticMode: sensitivityConfig.switchToStaticMode,
    handleAccelCurveChange: sensitivityConfig.handleAccelCurveChange,
    handleNaturalVHalfChange: sensitivityConfig.handleNaturalVHalfChange,
    handlePowerVRefChange: sensitivityConfig.handlePowerVRefChange,
    handlePowerExponentChange: sensitivityConfig.handlePowerExponentChange,
    handleJumpTauChange: sensitivityConfig.handleJumpTauChange,
    handleSigmoidMidChange: sensitivityConfig.handleSigmoidMidChange,
    handleSigmoidWidthChange: sensitivityConfig.handleSigmoidWidthChange,
    switchToAccelMode: sensitivityConfig.switchToAccelMode,
    // Touchpad slice
    touchpadModeValue: touchpadConfig.touchpadModeValue,
    gridSizeValue: touchpadConfig.gridSizeValue,
    touchpadSensitivityValue: touchpadConfig.touchpadSensitivityValue,
    handleTouchpadModeChange: touchpadConfig.handleTouchpadModeChange,
    handleGridSizeChange: touchpadConfig.handleGridSizeChange,
    handleTouchpadSensitivityChange: touchpadConfig.handleTouchpadSensitivityChange,
    // Stick slice
    handleStickDeadzoneChange: stickConfig.handleStickDeadzoneChange,
    handleStickModeChange: stickConfig.handleStickModeChange,
    handleRingModeChange: stickConfig.handleRingModeChange,
    handleStickModeShiftChange: stickConfig.handleStickModeShiftChange,
    handleAdaptiveTriggerChange: stickConfig.handleAdaptiveTriggerChange,
    stickAimHandlers: stickConfig.stickAimHandlers,
    stickFlickSettings: stickConfig.stickFlickSettings,
    stickFlickHandlers: stickConfig.stickFlickHandlers,
    mouseRingRadiusValue: stickConfig.mouseRingRadiusValue,
    handleMouseRingRadiusChange: stickConfig.handleMouseRingRadiusChange,
    counterOsMouseSpeedEnabled: stickConfig.counterOsMouseSpeedEnabled,
    handleCounterOsMouseSpeedChange: stickConfig.handleCounterOsMouseSpeedChange,
    stickDeadzoneDefaults: stickConfig.stickDeadzoneDefaults,
    leftStickDeadzone: stickConfig.leftStickDeadzone,
    rightStickDeadzone: stickConfig.rightStickDeadzone,
    stickModes: stickConfig.stickModes,
    stickModeShiftAssignments: stickConfig.stickModeShiftAssignments,
    stickAimSettings: stickConfig.stickAimSettings,
    adaptiveTriggerValue: stickConfig.adaptiveTriggerValue,
    handleStickSensChange: stickConfig.handleStickSensChange,
    handleStickPowerChange: stickConfig.handleStickPowerChange,
    handleStickAccelerationRateChange: stickConfig.handleStickAccelerationRateChange,
    handleStickAccelerationCapChange: stickConfig.handleStickAccelerationCapChange,
    handleToggleIgnoreGyroDevice: stickConfig.handleToggleIgnoreGyroDevice,
    scrollSensValue: stickConfig.scrollSensValue,
    handleScrollSensChange: stickConfig.handleScrollSensChange,
    // Bindings slice
    handleFaceButtonBindingChange: bindingsConfig.handleFaceButtonBindingChange,
    handleModifierChange: bindingsConfig.handleModifierChange,
    handleSpecialActionAssignment: bindingsConfig.handleSpecialActionAssignment,
    handleClearSpecialAction: bindingsConfig.handleClearSpecialAction,
    trackballDecayValue: bindingsConfig.trackballDecayValue,
    handleTrackballDecayChange: bindingsConfig.handleTrackballDecayChange,
  }
}
