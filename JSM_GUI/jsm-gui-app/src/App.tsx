import './App.css'
import { version as APP_VERSION } from '../package.json'
import sideNavStyles from './components/SideNav.module.css'
import topBarStyles from './components/TopBar.module.css'
import { ThemeToggle } from './components/ThemeToggle'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useTelemetry } from './hooks/useTelemetry'
import miscStyles from './components/Misc.module.css'
import { SensitivityControls } from './components/SensitivityControls'
import { ConfigEditor } from './components/ConfigEditor'
import { ProfileManager } from './components/ProfileManager'
import { GyroBehaviorControls } from './components/GyroBehaviorControls'
import { NoiseSteadyingControls } from './components/NoiseSteadyingControls'
import { KeymapControls } from './components/KeymapControls'
import { SectionActions } from './components/SectionActions'
import { DEFAULT_HOLD_PRESS_TIME } from './constants/defaults'
import { HelpDocsPage } from './components/HelpDocsPage'
import { useProfileLibrary } from './hooks/useProfileLibrary'
import { useKeymapConfig } from './hooks/useKeymapConfig'
import { useCalibration } from './hooks/useCalibration'
import { ToastHost } from './components/ToastHost'
import { UpdateBanner } from './components/UpdateBanner'
import { RwcGuideModal } from './components/RwcGuideModal'
import { updateKeymapEntry } from './utils/keymap'
import { showToast } from './utils/toast'
import { LanguageSelect } from './components/LanguageSelect'


type PrimaryTab = 'gyro' | 'keybinds' | 'touchpad' | 'sticks' | 'help'
type GyroSubTab = 'behavior' | 'sensitivity' | 'noise'
type KeybindsSubTab = 'global' | 'face' | 'dpad' | 'bumpers' | 'triggers' | 'center' | 'paddles' | 'extra'
type TouchpadSubTab = 'mode' | 'bind'
type SticksSubTab = 'bindings' | 'modes'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'

type PrimaryNavProps = {
  primaryTab: PrimaryTab
  setPrimaryTab: (tab: PrimaryTab) => void
  includeHelp?: boolean
}

const PrimaryNav = ({ primaryTab, setPrimaryTab, includeHelp = false }: PrimaryNavProps) => {
  const { t } = useTranslation()

  return (
    <div className={sideNavStyles.navGroup}>
      <button
        className={`${sideNavStyles.navItem} ${primaryTab === 'gyro' ? sideNavStyles.active : ''}`}
        onClick={() => setPrimaryTab('gyro')}
      >
        {t('app.nav.gyroAndSensitivity')}
      </button>
      <button
        className={`${sideNavStyles.navItem} ${primaryTab === 'keybinds' ? sideNavStyles.active : ''}`}
        onClick={() => setPrimaryTab('keybinds')}
      >
        {t('app.nav.keybinds')}
      </button>
      <button
        className={`${sideNavStyles.navItem} ${primaryTab === 'touchpad' ? sideNavStyles.active : ''}`}
        onClick={() => setPrimaryTab('touchpad')}
      >
        {t('app.nav.touchpad')}
      </button>
      <button
        className={`${sideNavStyles.navItem} ${primaryTab === 'sticks' ? sideNavStyles.active : ''}`}
        onClick={() => setPrimaryTab('sticks')}
      >
        {t('app.nav.sticks')}
      </button>
      {includeHelp && (
        <button
          className={`${sideNavStyles.navItem} ${primaryTab === 'help' ? sideNavStyles.active : ''}`}
          onClick={() => setPrimaryTab('help')}
        >
          {t('app.nav.documentation')}
        </button>
      )}
    </div>
  )
}

type HelpNavButtonProps = {
  primaryTab: PrimaryTab
  setPrimaryTab: (tab: PrimaryTab) => void
}

const HelpNavButton = ({ primaryTab, setPrimaryTab }: HelpNavButtonProps) => {
  const { t } = useTranslation()

  return (
    <button
      className={`${sideNavStyles.navItem} ${primaryTab === 'help' ? sideNavStyles.active : ''}`}
      onClick={() => setPrimaryTab('help')}
    >
      {t('app.nav.documentation')}
    </button>
  )
}

type TopBarContentProps = {
  primaryTab: PrimaryTab
  backendChoice: 'SDL' | 'legacy'
  onBackendChange: (choice: 'SDL' | 'legacy') => void
  renderGyroNav: () => JSX.Element
  renderKeybindsNav: () => JSX.Element
  renderTouchpadNav: () => JSX.Element
  renderSticksNav: () => JSX.Element
}

const TopBarContent = ({
  primaryTab,
  backendChoice,
  onBackendChange,
  renderGyroNav,
  renderKeybindsNav,
  renderTouchpadNav,
  renderSticksNav,
}: TopBarContentProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className={topBarStyles.topBarLeft}>
        {primaryTab === 'gyro' && renderGyroNav()}
        {primaryTab === 'keybinds' && renderKeybindsNav()}
        {primaryTab === 'touchpad' && renderTouchpadNav()}
        {primaryTab === 'sticks' && renderSticksNav()}
      </div>
      <div className={topBarStyles.topBarRight}>
        <LanguageSelect className={topBarStyles.inlineSelect} />
        <label className={topBarStyles.inlineSelect}>
          <span>{t('app.topBar.jsmVersion')}</span>
          <select
            className="app-select"
            value={backendChoice}
            onChange={(e) => onBackendChange(e.target.value as 'SDL' | 'legacy')}
          >
            <option value="SDL">SDL</option>
            <option value="legacy">{t('app.topBar.legacy')}</option>
          </select>
        </label>
      </div>
    </>
  )
}

function App() {
  const { t } = useTranslation()
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [recalibrating, setRecalibrating] = useState(false)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isRwcGuideModalOpen, setIsRwcGuideModalOpen] = useState(false)
  const [calibrationTurns, setCalibrationTurns] = useState('1')
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('gyro')
  const [gyroSubTab, setGyroSubTab] = useState<GyroSubTab>('behavior')
  const [keybindsSubTab, setKeybindsSubTab] = useState<KeybindsSubTab>('global')
  const [touchpadSubTab, setTouchpadSubTab] = useState<TouchpadSubTab>('mode')
  const [sticksSubTab, setSticksSubTab] = useState<SticksSubTab>('bindings')
  const {
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
    finalizePendingValues,
    selectedBaseMode,
    selectedModeshiftMode,
    holdPressTimeSeconds,
    holdPressTimeIsCustom,
    doublePressWindowSeconds,
    doublePressWindowIsCustom,
    simPressWindowSeconds,
    simPressWindowIsCustom,
    lightBarColor,
    handleLightBarChange,
    triggerThresholdValue,
    touchpadModeValue,
    gridSizeValue,
    touchpadSensitivityValue,
    hasPendingChanges,
    handleSensitivityModeshiftButtonChange,
    handleThresholdChange,
    handleCutoffSpeedChange,
    handleCutoffRecoveryChange,
    handleSmoothTimeChange,
    handleSmoothThresholdChange,
    handleSmoothingDecayChange,
    handleOneEuroFilterChange,
    handleOneEuroMinCutoffChange,
    handleOneEuroSpeedCoeffChange,
    handleAngleSnapChange,
    handleAngleSnapSmoothChange,
    handleDecelBrakeStrengthChange,
    handleDecelBrakeThresholdChange,
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
    handleRollContributionChange,
    handleTouchpadModeChange,
    handleGridSizeChange,
    handleTouchpadSensitivityChange,
    handleInGameSensChange,
    handleRealWorldCalibrationChange,
    handleAccelCurveChange,
    handleNaturalVHalfChange,
    handlePowerVRefChange,
    handlePowerExponentChange,
    handleJumpTauChange,
    handleSigmoidMidChange,
    handleSigmoidWidthChange,
    handleModeSelection,
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
    zlModeValue,
    zrModeValue,
    handleZlModeChange,
    handleZrModeChange,
    handleToggleIgnoreGyroDevice,
    scrollSensValue,
    handleScrollSensChange,
    resetPendingSensitivityChanges,
  } = useKeymapConfig()
  const {
    libraryProfiles,
    isLibraryLoading,
    editedLibraryNames,
    currentLibraryProfile,
    applyConfig,
    handleLoadProfileFromLibrary,
    handleLibraryProfileNameChange,
    handleCreateProfile,
    handleRenameProfile,
    handleDeleteLibraryProfile,
    handleImportProfile,
    handleCopyActiveProfile,
    refreshActiveProfile,
  } = useProfileLibrary({
    configText,
    setConfigText,
    setAppliedConfig,
    setStatusMessage,
    resetPendingSensitivityChanges: resetPendingSensitivityChanges,
  })
  const {
    isCalibrationModalOpen,
    calibrationCounterOs,
    calibrationInGameSens,
    calibrationDirty,
    setCalibrationCounterOs,
    setCalibrationInGameSens,
    setCalibrationDirty,
    calibrationLoadMessage,
    calibrationOutput,
    resetCalibrationInputs,
    handleOpenCalibration,
    handleCloseCalibration,
    handleApplyCalibrationPreset,
    handleRunCalibration,
  } = useCalibration({
    configText,
    counterOsMouseSpeedEnabled,
    sensitivityInGame: sensitivity.inGameSens,
  })


  const handleRecalibrate = async () => {
    if (isCalibrating || recalibrating) return
    setRecalibrating(true)
    try {
      const result = await window.electronAPI?.recalibrateGyro?.()
      if (result?.success) {
        setStatusMessage(t('messages.recalibrationStarted'))
      } else {
        setStatusMessage(t('messages.recalibrationFailed'))
      }
    } catch (err) {
      console.error(err)
      setStatusMessage(t('messages.recalibrationFailed'))
    } finally {
      setRecalibrating(false)
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
    return '-'
  }

  const telemetryValues = {
    omega: formatNumber(asNumber(sample?.omega)),
    sensX: formatNumber(asNumber(sample?.sensX)),
    sensY: formatNumber(asNumber(sample?.sensY)),
    sampleHz: formatNumber(asNumber(sample?.sampleHz), 0),
    timestamp: formatTimestamp(sample?.ts),
  }
  const currentMode: 'static' | 'accel' =
    sensitivityView === 'modeshift' && sensitivityModeshiftButton ? selectedModeshiftMode : selectedBaseMode
  const profileLabel = currentLibraryProfile ?? t('app.profileSummary.unsavedProfile')
  const profileFileLabel = `${profileLabel}${profileLabel.endsWith('.txt') ? '' : '.txt'}`
  const lockMessage = t('messages.lockMessage')
  const [backendChoice, setBackendChoice] = useState<'SDL' | 'legacy'>('SDL')

  useEffect(() => {
    window.electronAPI?.getBackendChoice?.().then(choice => {
      if (choice === 'SDL' || choice === 'legacy') {
        setBackendChoice(choice)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      const isTextInput = (el: HTMLInputElement) => {
        const excluded = ['checkbox', 'radio', 'range', 'file', 'color', 'button', 'submit', 'reset']
        return !excluded.includes(el.type)
      }
      if (target instanceof HTMLInputElement) {
        if (target.disabled || target.readOnly || !isTextInput(target)) return
        requestAnimationFrame(() => target.select())
      } else if (target instanceof HTMLTextAreaElement) {
        if (target.disabled || target.readOnly) return
        const skipAutoSelect = target.closest('.config-panel')
        if (skipAutoSelect) return
        requestAnimationFrame(() => target.select())
      }
    }
    window.addEventListener('focusin', handleFocusIn)
    return () => window.removeEventListener('focusin', handleFocusIn)
  }, [])

  useEffect(() => {
    const applyRangeTabIndex = (root: ParentNode | undefined | null) => {
      if (!root) return
      root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(el => {
        if (el.tabIndex !== -1) {
          el.tabIndex = -1
        }
      })
    }
    applyRangeTabIndex(document.body)
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement || node instanceof DocumentFragment) {
            applyRangeTabIndex(node)
          }
        })
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const handleBackendChange = (choice: 'SDL' | 'legacy') => {
    setBackendChoice(choice)
    window.electronAPI?.setBackendChoice?.(choice)
      .then(() => refreshActiveProfile())
      .catch(() => {})
  }

  const handleApplyWithFinalize = () => {
    const nextText = finalizePendingValues ? finalizePendingValues() : undefined
    if (nextText !== undefined) {
      applyConfig({ textOverride: nextText })
    } else {
      applyConfig()
    }
  }

  const renderGyroNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${gyroSubTab === 'behavior' ? 'active' : ''}`} onClick={() => setGyroSubTab('behavior')}>
        {t('app.tabs.gyroBehavior')}
      </button>
      <button className={`pill-tab ${gyroSubTab === 'sensitivity' ? 'active' : ''}`} onClick={() => setGyroSubTab('sensitivity')}>
        {t('app.tabs.sensitivity')}
      </button>
      <button className={`pill-tab ${gyroSubTab === 'noise' ? 'active' : ''}`} onClick={() => setGyroSubTab('noise')}>
        {t('app.tabs.noiseAndSteadying')}
      </button>
    </div>
  )

  const renderKeybindsNav = () => (
    <div className="subnav">
      {(['global', 'face', 'dpad', 'bumpers', 'triggers', 'center', 'paddles', 'extra'] as KeybindsSubTab[]).map(entry => (
        <button key={entry} className={`pill-tab ${keybindsSubTab === entry ? 'active' : ''}`} onClick={() => setKeybindsSubTab(entry)}>
          {entry === 'global' && t('app.tabs.globalSettings')}
          {entry === 'face' && t('app.tabs.face')}
          {entry === 'dpad' && t('app.tabs.dpad')}
          {entry === 'bumpers' && t('app.tabs.bumpers')}
          {entry === 'triggers' && t('app.tabs.triggers')}
          {entry === 'center' && t('app.tabs.center')}
          {entry === 'paddles' && t('app.tabs.paddles')}
          {entry === 'extra' && t('app.tabs.extra')}
        </button>
      ))}
    </div>
  )

  const renderTouchpadNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${touchpadSubTab === 'mode' ? 'active' : ''}`} onClick={() => setTouchpadSubTab('mode')}>
        {t('app.tabs.mode')}
      </button>
      <button className={`pill-tab ${touchpadSubTab === 'bind' ? 'active' : ''}`} onClick={() => setTouchpadSubTab('bind')}>
        {t('app.tabs.bindings')}
      </button>
    </div>
  )

  const renderSticksNav = () => (
    <div className="subnav">
      <button className={`pill-tab ${sticksSubTab === 'bindings' ? 'active' : ''}`} onClick={() => setSticksSubTab('bindings')}>
        {t('app.tabs.bindings')}
      </button>
      <button className={`pill-tab ${sticksSubTab === 'modes' ? 'active' : ''}`} onClick={() => setSticksSubTab('modes')}>
        {t('app.tabs.modesAndSettings')}
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
                onOpenRwcGuide={() => setIsRwcGuideModalOpen(true)}
                hasPendingChanges={hasPendingChanges}
                onApply={handleApplyWithFinalize}
                onCancel={handleCancel}
                lockMessage={lockMessage}
                appliedSampleHz={telemetryValues.sampleHz}
                backendChoice={backendChoice}
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
              onModeChange={(mode) => handleModeSelection(mode, activeSensitivityPrefix)}
              onSensitivityViewChange={setSensitivityView}
              onApply={handleApplyWithFinalize}
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
              onRollContributionChange={handleRollContributionChange}
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
            onApply={handleApplyWithFinalize}
            onCancel={handleCancel}
            lockMessage={lockMessage}
            onCutoffSpeedChange={handleCutoffSpeedChange}
            onCutoffRecoveryChange={handleCutoffRecoveryChange}
            onSmoothTimeChange={handleSmoothTimeChange}
            onSmoothThresholdChange={handleSmoothThresholdChange}
            onSmoothingDecayChange={handleSmoothingDecayChange}
            onOneEuroFilterChange={handleOneEuroFilterChange}
            onOneEuroMinCutoffChange={handleOneEuroMinCutoffChange}
            onOneEuroSpeedCoeffChange={handleOneEuroSpeedCoeffChange}
            onAngleSnapChange={handleAngleSnapChange}
            onAngleSnapSmoothChange={handleAngleSnapSmoothChange}
            onDecelBrakeStrengthChange={handleDecelBrakeStrengthChange}
            onDecelBrakeThresholdChange={handleDecelBrakeThresholdChange}
            telemetry={{ omega: telemetryValues.omega, timestamp: telemetryValues.timestamp, sampleHz: telemetryValues.sampleHz }}
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
            onApply={handleApplyWithFinalize}
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
            lightBarColor={lightBarColor}
            onLightBarChange={handleLightBarChange}
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
            zlModeValue={zlModeValue}
            zrModeValue={zrModeValue}
            onZlModeChange={handleZlModeChange}
            onZrModeChange={handleZrModeChange}
            stickAimSettings={stickAimSettings}
            stickAimHandlers={stickAimHandlers}
            stickFlickSettings={stickFlickSettings}
            stickFlickHandlers={stickFlickHandlers}
            mouseRingRadius={mouseRingRadiusValue}
            onMouseRingRadiusChange={handleMouseRingRadiusChange}
            scrollSens={scrollSensValue}
            onScrollSensChange={handleScrollSensChange}
            lockMessage={lockMessage}
            visibleSections={keybindsSubTab === 'global' ? ['global'] : [keybindsSubTab]}
          />
        </>
      )
    }

    if (primaryTab === 'touchpad') {
      const sections = touchpadSubTab === 'bind' ? ['touch-bind'] : ['touch-grid']
      return (
        <>
          <KeymapControls
            view="touchpad"
            configText={configText}
            hasPendingChanges={hasPendingChanges}
            isCalibrating={isCalibrating}
            statusMessage={statusMessage}
            onApply={handleApplyWithFinalize}
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
            lightBarColor={lightBarColor}
            onLightBarChange={handleLightBarChange}
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
            zlModeValue={zlModeValue}
            zrModeValue={zrModeValue}
            onZlModeChange={handleZlModeChange}
            onZrModeChange={handleZrModeChange}
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
            onApply={handleApplyWithFinalize}
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
            lightBarColor={lightBarColor}
            onLightBarChange={handleLightBarChange}
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

    if (primaryTab === 'help') {
      return <HelpDocsPage />
    }

    return null
  }

  return (
    <div className="app-shell">
      <ToastHost />
      <UpdateBanner />
      {/* Desktop sidebar */}
      <aside className={sideNavStyles.sideNav}>
        <div className={sideNavStyles.navBrand}>{t('common.appName')}</div>
        <PrimaryNav primaryTab={primaryTab} setPrimaryTab={setPrimaryTab} />
        <div className={sideNavStyles.navFooter}>
          <HelpNavButton primaryTab={primaryTab} setPrimaryTab={setPrimaryTab} />
          <ThemeToggle />
          <div className={sideNavStyles.navVersion}>v{APP_VERSION}</div>
        </div>
      </aside>
      {/* Narrow-width sticky header */}
      <div className="responsive-header">
        <div className={sideNavStyles.navHeaderRow}>
          <div>
            <div className={sideNavStyles.navBrand}>{t('common.appName')}</div>
            <PrimaryNav primaryTab={primaryTab} setPrimaryTab={setPrimaryTab} includeHelp />
          </div>
          <div className={sideNavStyles.navToggleFloat}>
            <ThemeToggle compact />
          </div>
        </div>
        <div className="responsive-header-divider" />
        <div className={`${topBarStyles.topBar} ${topBarStyles.responsiveTopBar}`}>
          <TopBarContent
            primaryTab={primaryTab}
            backendChoice={backendChoice}
            onBackendChange={handleBackendChange}
            renderGyroNav={renderGyroNav}
            renderKeybindsNav={renderKeybindsNav}
            renderTouchpadNav={renderTouchpadNav}
            renderSticksNav={renderSticksNav}
          />
        </div>
      </div>
      <div className="shell-main">
        <div className={`${topBarStyles.topBar} ${topBarStyles.desktopTopBar}`}>
          <TopBarContent
            primaryTab={primaryTab}
            backendChoice={backendChoice}
            onBackendChange={handleBackendChange}
            renderGyroNav={renderGyroNav}
            renderKeybindsNav={renderKeybindsNav}
            renderTouchpadNav={renderTouchpadNav}
            renderSticksNav={renderSticksNav}
          />
        </div>
        <div className="shell-scroll"><div className="content-grid">
          <main className="main-pane">{renderPrimaryContent()}</main>
          <aside className="right-rail">
            <div className="recalibrate-card">
              {isCalibrating ? (
                <div className="recalibrate-row">
                  <span className="calibration-pill calibration-pill-inline">
                    {t('app.recalibration.calibratingCountdown', { seconds: countdown ?? '-' })}
                  </span>
                </div>
              ) : (
                <button className="secondary-btn rail-button" onClick={handleRecalibrate} disabled={recalibrating}>
                  {recalibrating ? t('app.recalibration.recalibrating') : t('app.recalibration.recalibrateGyro')}
                </button>
              )}
            </div>
            <div className="profile-summary-card">
              <div className="profile-summary-header">
                <div className="profile-summary-title">{t('app.profileSummary.title')}</div>
              </div>
              <label className="profile-summary-select">
                {t('app.profileSummary.quickSwitch')}
                <select
                  className="app-select"
                  disabled={isCalibrating}
                  value={currentLibraryProfile ?? ''}
                  onChange={event => {
                    const name = event.target.value
                    if (!name) return
                    handleLoadProfileFromLibrary(name)
                  }}
                >
                  <option value="" disabled>
                    {t('app.profileSummary.selectProfile')}
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
                  {t('app.profileSummary.manageProfiles')}
                </button>
              </div>
            </div>
            <div className="config-editor-desktop">
              <ConfigEditor
                value={configText}
                label={profileFileLabel}
                disabled={isCalibrating}
                hasPendingChanges={hasPendingChanges}
                statusMessage={null}
                onChange={setConfigText}
                onApply={handleApplyWithFinalize}
                onCancel={handleCancel}
              />
            </div>
          </aside>
          <div className="config-editor-mobile">
            <ConfigEditor
              value={configText}
              label={profileFileLabel}
              disabled={isCalibrating}
              hasPendingChanges={hasPendingChanges}
              statusMessage={null}
              onChange={setConfigText}
              onApply={handleApplyWithFinalize}
              onCancel={handleCancel}
            />
          </div>
        </div></div>
      </div>
      {isCalibrationModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{t('app.calibrationModal.title')}</h3>
              {calibrationLoadMessage && <span className="profile-status inline-flag">{calibrationLoadMessage}</span>}
            </div>
            <p className="modal-description">
              {t('app.calibrationModal.description')}
            </p>
            <div className="flex-inputs">
              <label>
                {t('app.calibrationModal.inGameSensitivity')}
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
                {t('app.calibrationModal.counterOsMouseSpeed')}
                <p className="field-description">{t('app.calibrationModal.counterOsMouseSpeedHint')}</p>
                <select
                  className="app-select"
                  value={calibrationCounterOs ? 'ON' : 'OFF'}
                  onChange={(event) => {
                    setCalibrationCounterOs(event.target.value === 'ON')
                    setCalibrationDirty(true)
                  }}
                >
                  <option value="OFF">{t('common.offDefault')}</option>
                  <option value="ON">{t('common.on')}</option>
                </select>
              </label>
            </div>
            <div className="flex-inputs">
              <label>
                {t('app.calibrationModal.numberOfTurns')}
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={calibrationTurns}
                  onChange={(e) => setCalibrationTurns(e.target.value)}
                />
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
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleRunCalibration(parseFloat(calibrationTurns) || 1)}
                disabled={isCalibrating}
              >
                {t('app.calibrationModal.runCalculation')}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  handleCloseCalibration()
                  showToast(t('messages.activeProfileToast', { profileName: profileLabel }))
                }}
              >
                {t('common.close')}
              </button>
            </div>
            {calibrationOutput && (
              <>
                <div className={miscStyles.calibrationOutputLabel}>{t('app.calibrationModal.calculationResult')}</div>
                <div className={miscStyles.calibrationOutput} data-capture-ignore="true">
                  <pre>{calibrationOutput}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <RwcGuideModal
        isOpen={isRwcGuideModalOpen}
        inGameSens={String(sensitivity.inGameSens ?? '')}
        onClose={() => setIsRwcGuideModalOpen(false)}
        onApplyRwc={(rwc) => {
          const baseText = finalizePendingValues ? finalizePendingValues() : configText
          const rwcNum = parseFloat(rwc)
          const textWithRwc = updateKeymapEntry(baseText, 'REAL_WORLD_CALIBRATION', [rwcNum])
          applyConfig({ textOverride: textWithRwc })
        }}
      />
      {isProfileModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card profile-modal">
            <div className="modal-header">
              <h3>{t('app.profilesModal.title')}</h3>
              <button className="secondary-btn" onClick={() => setProfileModalOpen(false)}>
                {t('common.close')}
              </button>
            </div>
            <ProfileManager
              currentProfileName={currentLibraryProfile}
              hasPendingChanges={hasPendingChanges}
              isCalibrating={isCalibrating}
              profileApplied={configText === appliedConfig}
              onImportProfile={handleImportProfile}
              libraryProfiles={libraryProfiles}
              libraryLoading={isLibraryLoading}
              editedProfileNames={editedLibraryNames}
              onProfileNameChange={handleLibraryProfileNameChange}
              onRenameProfile={handleRenameProfile}
              onDeleteProfile={handleDeleteLibraryProfile}
              onAddProfile={handleCreateProfile}
              onLoadLibraryProfile={handleLoadProfileFromLibrary}
              onCopyActiveProfile={handleCopyActiveProfile}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
