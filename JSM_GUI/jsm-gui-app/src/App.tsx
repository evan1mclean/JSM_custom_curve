import './App.css'
import { useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import { SensitivityControls } from './components/SensitivityControls'
import { ConfigEditor } from './components/ConfigEditor'
import { ProfileManager } from './components/ProfileManager'
import { GyroBehaviorControls } from './components/GyroBehaviorControls'
import { NoiseSteadyingControls } from './components/NoiseSteadyingControls'
import { KeymapControls } from './components/KeymapControls'
import { SectionActions } from './components/SectionActions'
import { LOCK_MESSAGE } from './constants/messages'
import { DEFAULT_HOLD_PRESS_TIME } from './constants/defaults'
import { useProfileLibrary } from './hooks/useProfileLibrary'
import { useKeymapConfig } from './hooks/useKeymapConfig'
import { useCalibration } from './hooks/useCalibration'

type PrimaryTab = 'gyro' | 'keybinds' | 'touchpad' | 'sticks'
type GyroSubTab = 'behavior' | 'sensitivity' | 'noise'
type KeybindsSubTab = 'face' | 'dpad' | 'bumpers' | 'triggers' | 'center'
type TouchpadSubTab = 'mode' | 'grid' | 'bind'
type SticksSubTab = 'bindings' | 'modes'

const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
const formatNumber = (value: number | undefined, digits = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '0.00'
function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [recalibrating, setRecalibrating] = useState(false)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('gyro')
  const [gyroSubTab, setGyroSubTab] = useState<GyroSubTab>('behavior')
  const [keybindsSubTab, setKeybindsSubTab] = useState<KeybindsSubTab>('face')
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
    handleToggleIgnoreGyroDevice,
    scrollSensValue,
    handleScrollSensChange,
  } = useKeymapConfig()
  const {
    libraryProfiles,
    isLibraryLoading,
    editedLibraryNames,
    currentLibraryProfile,
    activeProfilePath,
    applyConfig,
    handleLoadProfileFromLibrary,
    handleLibraryProfileNameChange,
    handleCreateProfile,
    handleRenameProfile,
    handleDeleteLibraryProfile,
    handleImportProfile,
  } = useProfileLibrary({
    configText,
    setConfigText,
    setAppliedConfig,
    setStatusMessage,
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
  const currentMode: 'static' | 'accel' =
    sensitivityView === 'modeshift' && sensitivityModeshiftButton ? modeshiftMode : baseMode
  const profileLabel = currentLibraryProfile ?? 'Unsaved profile'
  const activeProfileFile = activeProfilePath || 'No active profile'
  const profileFileLabel = `${activeProfileFile} — ${profileLabel}`
  const lockMessage = LOCK_MESSAGE

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
