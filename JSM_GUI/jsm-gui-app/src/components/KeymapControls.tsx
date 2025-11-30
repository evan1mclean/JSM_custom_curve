import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card } from './Card'
import {
  BindingSlot,
  ButtonBindingRow,
  getButtonBindingRows,
  getKeymapValue,
} from '../utils/keymap'
import { buildModifierOptions, ControllerLayout } from '../utils/modifierOptions'
import { DEFAULT_STICK_DEADZONE_INNER, DEFAULT_STICK_DEADZONE_OUTER } from '../constants/defaults'
import {
  BUMPER_BUTTONS,
  CENTER_BUTTONS,
  DPAD_BUTTONS,
  FACE_BUTTONS,
  LEFT_STICK_BUTTONS,
  RIGHT_STICK_BUTTONS,
  SPECIAL_BINDINGS,
  STICK_AIM_DEFAULTS,
  TOUCH_BUTTONS,
  TRIGGER_BUTTONS,
  type ButtonDefinition,
} from '../keymap/schema'
import { useBindingCapture } from '../keymap/useBindingCapture'
import { useButtonRowState } from '../keymap/useButtonRowState'
import { GlobalControlsSection } from './keymap/GlobalControlsSection'
import { ButtonGridSection } from './keymap/ButtonGridSection'
import { StickModesSection } from './keymap/StickModesSection'
import { TouchpadSettingsSection } from './keymap/TouchpadSettingsSection'
import { TouchpadGridSection } from './keymap/TouchpadGridSection'
import { ButtonBindingsCard } from './keymap/ButtonBindingsCard'

type KeymapControlsProps = {
  configText: string
  hasPendingChanges: boolean
  isCalibrating: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  onBindingChange: (button: string, slot: BindingSlot, value: string | null, options?: { modifier?: string }) => void
  onAssignSpecialAction: (special: string, buttonCommand: string) => void
  onClearSpecialAction: (special: string, buttonCommand: string) => void
  trackballDecay: string
  onTrackballDecayChange: (value: string) => void
  holdPressTimeSeconds: number
  onHoldPressTimeChange: (value: string) => void
  holdPressTimeIsCustom: boolean
  holdPressTimeDefault: number
  onModifierChange: (
    button: string,
    slot: BindingSlot,
    previousModifier: string | undefined,
    nextModifier: string,
    binding: string | null
  ) => void
  doublePressWindowSeconds: number
  doublePressWindowIsCustom: boolean
  onDoublePressWindowChange: (value: string) => void
  simPressWindowSeconds: number
  simPressWindowIsCustom: boolean
  onSimPressWindowChange: (value: string) => void
  triggerThreshold: number
  onTriggerThresholdChange: (value: string) => void
  view?: 'full' | 'touchpad' | 'sticks'
  lockMessage?: string
  visibleSections?: string[]
  stickForcedView?: 'bindings' | 'modes'
  showStickViewToggle?: boolean
  touchpadMode?: string
  onTouchpadModeChange?: (value: string) => void
  gridColumns?: number
  gridRows?: number
  onGridSizeChange?: (cols: number, rows: number) => void
  touchpadSensitivity?: number
  onTouchpadSensitivityChange?: (value: string) => void
  stickDeadzoneSettings?: {
    defaults: { inner: string; outer: string }
    left: { inner: string; outer: string }
    right: { inner: string; outer: string }
  }
  onStickDeadzoneChange?: (side: 'LEFT' | 'RIGHT', type: 'INNER' | 'OUTER', value: string) => void
  stickModeSettings?: {
    left: { mode: string; ring: string }
    right: { mode: string; ring: string }
  }
  onStickModeChange?: (side: 'LEFT' | 'RIGHT', mode: string) => void
  onRingModeChange?: (side: 'LEFT' | 'RIGHT', mode: string) => void
  stickAimSettings?: {
    displaySensX: string
    displaySensY: string
    power: string
    accelerationRate: string
    accelerationCap: string
  }
  stickAimHandlers?: {
    onSensXChange: (value: string) => void
    onSensYChange: (value: string) => void
    onPowerChange: (value: string) => void
    onAccelerationRateChange: (value: string) => void
    onAccelerationCapChange: (value: string) => void
  }
  stickFlickSettings?: {
    flickTime: string
    flickTimeExponent: string
    snapMode: string
    snapStrength: string
    deadzoneAngle: string
  }
  stickFlickHandlers?: {
    onFlickTimeChange: (value: string) => void
    onFlickTimeExponentChange: (value: string) => void
    onSnapModeChange: (value: string) => void
    onSnapStrengthChange: (value: string) => void
    onDeadzoneAngleChange: (value: string) => void
  }
  mouseRingRadius?: string
  onMouseRingRadiusChange?: (value: string) => void
  scrollSens?: string
  onScrollSensChange?: (value: string) => void
  stickModeShiftAssignments?: Record<string, { target: 'LEFT' | 'RIGHT'; mode: string }[]>
  onStickModeShiftChange?: (button: string, target: 'LEFT' | 'RIGHT', mode?: string) => void
  adaptiveTriggerValue?: string
  onAdaptiveTriggerChange?: (value: string) => void
}

type StickAimSettingsProps = {
  values: NonNullable<KeymapControlsProps['stickAimSettings']>
  handlers: NonNullable<KeymapControlsProps['stickAimHandlers']>
  disabled?: boolean
}

const StickAimSettings = ({ values, handlers, disabled }: StickAimSettingsProps) => {
  const sensXValue = values.displaySensX
  const sensYValue = values.displaySensY
  const powerValue = values.power ?? ''
  const accelRateValue = values.accelerationRate ?? ''
  const accelCapValue = values.accelerationCap ?? ''
  const formatDefault = (value: string) => `Default (${value})`
  return (
    <div className="stick-aim-settings" data-capture-ignore="true">
      <small>Applies to STICK_SENS / POWER / ACCEL settings when Aim mode is active.</small>
      <div className="stick-aim-grid">
        <label>
          Stick sensitivity (horizontal)
          <input
            type="number"
            step="1"
            value={sensXValue}
            onChange={(event) => handlers.onSensXChange(event.target.value)}
            placeholder={formatDefault(STICK_AIM_DEFAULTS.sens)}
            disabled={disabled}
          />
        </label>
        <label>
          Stick sensitivity (vertical)
          <input
            type="number"
            step="1"
            value={sensYValue}
            onChange={(event) => handlers.onSensYChange(event.target.value)}
            placeholder={formatDefault(STICK_AIM_DEFAULTS.sens)}
            disabled={disabled}
          />
        </label>
        <label>
          Stick power
          <input
            type="number"
            step="0.1"
            value={powerValue}
            onChange={(event) => handlers.onPowerChange(event.target.value)}
            placeholder={formatDefault(STICK_AIM_DEFAULTS.power)}
            disabled={disabled}
          />
        </label>
        <label>
          Acceleration rate
          <input
            type="number"
            step="0.1"
            value={accelRateValue}
            onChange={(event) => handlers.onAccelerationRateChange(event.target.value)}
            placeholder={formatDefault(STICK_AIM_DEFAULTS.accelerationRate)}
            disabled={disabled}
          />
        </label>
        <label>
          Acceleration cap
          <input
            type="number"
            step="0.1"
            value={accelCapValue}
            onChange={(event) => handlers.onAccelerationCapChange(event.target.value)}
            placeholder={formatDefault(STICK_AIM_DEFAULTS.accelerationCap)}
            disabled={disabled}
          />
        </label>
      </div>
    </div>
  )
}

type StickFlickSettingsProps = {
  values: NonNullable<KeymapControlsProps['stickFlickSettings']>
  handlers: NonNullable<KeymapControlsProps['stickFlickHandlers']>
  disabled?: boolean
}

const StickFlickSettings = ({ values, handlers, disabled }: StickFlickSettingsProps) => {
  const snapMode = values.snapMode || ''
  const formatDefault = (value: string) => `Default (${value})`
  return (
    <div className="stick-flick-settings" data-capture-ignore="true">
      <small>Flick stick timing and snapping controls.</small>
      <div className="stick-aim-grid">
        <label>
          Flick time (seconds)
          <input
            type="number"
            step="0.01"
            value={values.flickTime}
            onChange={(event) => handlers.onFlickTimeChange(event.target.value)}
            placeholder={formatDefault('0.1')}
            disabled={disabled}
          />
        </label>
        <label>
          Flick time exponent
          <input
            type="number"
            step="0.1"
            value={values.flickTimeExponent}
            onChange={(event) => handlers.onFlickTimeExponentChange(event.target.value)}
            placeholder={formatDefault('0.0')}
            disabled={disabled}
          />
        </label>
        <label>
          Snap mode
          <select
            className="app-select"
            value={snapMode}
            onChange={(event) => handlers.onSnapModeChange(event.target.value)}
            disabled={disabled}
          >
            <option value="">Default (NONE)</option>
            <option value="4">Snap to 4 directions</option>
            <option value="8">Snap to 8 directions</option>
          </select>
        </label>
        <label>
          Snap strength
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={values.snapStrength}
            onChange={(event) => handlers.onSnapStrengthChange(event.target.value)}
            placeholder={formatDefault('1.0')}
            disabled={disabled}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={Number(values.snapStrength) || 0}
            onChange={(event) => handlers.onSnapStrengthChange(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label>
          Forward deadzone angle
          <input
            type="number"
            step="1"
            min="0"
            max="180"
            value={values.deadzoneAngle}
            onChange={(event) => handlers.onDeadzoneAngleChange(event.target.value)}
            placeholder={formatDefault('0°')}
            disabled={disabled}
          />
          <input
            type="range"
            min="0"
            max="180"
            step="1"
            value={Number(values.deadzoneAngle) || 0}
            onChange={(event) => handlers.onDeadzoneAngleChange(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>
    </div>
  )
}

export function KeymapControls({
  configText,
  hasPendingChanges,
  isCalibrating,
  statusMessage,
  onApply,
  onCancel,
  onBindingChange,
  onAssignSpecialAction,
  onClearSpecialAction,
  trackballDecay,
  onTrackballDecayChange,
  holdPressTimeSeconds,
  onHoldPressTimeChange,
  holdPressTimeIsCustom,
  holdPressTimeDefault,
  onModifierChange,
  doublePressWindowSeconds,
  doublePressWindowIsCustom,
  onDoublePressWindowChange,
  simPressWindowSeconds,
  simPressWindowIsCustom,
  onSimPressWindowChange,
  triggerThreshold,
  onTriggerThresholdChange,
  view = 'full',
  lockMessage,
  visibleSections,
  stickForcedView,
  showStickViewToggle = true,
  touchpadMode: touchpadModeProp = '',
  onTouchpadModeChange,
  gridColumns = 2,
  gridRows = 2,
  onGridSizeChange,
  touchpadSensitivity,
  onTouchpadSensitivityChange,
  stickDeadzoneSettings,
  onStickDeadzoneChange,
  stickModeSettings,
  onStickModeChange,
  onRingModeChange,
  stickModeShiftAssignments,
  onStickModeShiftChange,
  stickAimSettings,
  stickAimHandlers,
  stickFlickSettings,
  stickFlickHandlers,
  mouseRingRadius,
  onMouseRingRadiusChange,
  scrollSens,
  onScrollSensChange,
  adaptiveTriggerValue = '',
  onAdaptiveTriggerChange = () => {},
}: KeymapControlsProps) {
  const [layout, setLayout] = useState<ControllerLayout>('playstation')
  const [stickView, setStickView] = useState<'bindings' | 'modes'>('bindings')
  const {
    manualRows,
    ensureManualRow,
    updateManualRow,
    removeManualRow,
    stickShiftDisplayModes,
    updateStickShiftDisplayMode,
    replaceStickShiftDisplayModes,
  } = useButtonRowState()
  const { captureLabel, beginCapture, cancelCapture, isCapturing } = useBindingCapture(onBindingChange)
  const currentStickView = stickForcedView ?? stickView
  const stickToggleVisible = view === 'sticks' && showStickViewToggle && !stickForcedView
  useEffect(() => {
    if (stickForcedView) {
      setStickView(stickForcedView)
    }
  }, [stickForcedView])

  const isVisible = (section: string) => {
    if (!visibleSections || visibleSections.length === 0) return true
    return visibleSections.includes(section)
  }
  const touchpadMode = useMemo(() => {
    const upper = touchpadModeProp?.toUpperCase()
    if (upper === 'GRID_AND_STICK' || upper === 'MOUSE') return upper
    return ''
  }, [touchpadModeProp])
  const gridActive = touchpadMode === 'GRID_AND_STICK'
  const clampedGridCols = Math.max(1, Math.min(5, gridColumns || 1))
  const clampedGridRows = Math.max(1, Math.min(5, gridRows || 1))
  const clampedGridCells = touchpadMode === 'GRID_AND_STICK' ? Math.min(25, clampedGridCols * clampedGridRows) : 0
  const configuredGridButtons = gridActive ? clampedGridCells : 0
  const modifierOptions = useMemo(() => {
    return buildModifierOptions(layout, gridActive, configuredGridButtons)
  }, [layout, gridActive, configuredGridButtons])

  const touchpadGridButtons = useMemo<ButtonDefinition[]>(() => {
    return Array.from({ length: clampedGridCells }, (_, index) => {
      const rowIndex = Math.floor(index / clampedGridCols)
      const colIndex = index % clampedGridCols
      return {
        command: `T${index + 1}`,
        description: `Row ${rowIndex + 1}, Col ${colIndex + 1}`,
        playstation: `T${index + 1}`,
        xbox: `T${index + 1}`,
      }
    })
  }, [clampedGridCells, clampedGridCols])

  const bindingRowsByButton = useMemo(() => {
    const record: Record<string, ButtonBindingRow[]> = {}
    ;[
      ...FACE_BUTTONS,
      ...DPAD_BUTTONS,
      ...BUMPER_BUTTONS,
      ...TRIGGER_BUTTONS,
      ...CENTER_BUTTONS,
      ...LEFT_STICK_BUTTONS,
      ...RIGHT_STICK_BUTTONS,
      ...TOUCH_BUTTONS,
      ...touchpadGridButtons,
    ].forEach(({ command }) => {
      record[command] = getButtonBindingRows(configText, command, manualRows[command] ?? {})
    })
    return record
  }, [configText, manualRows, touchpadGridButtons])

  const specialsByButton = useMemo(() => {
    const assignments: Record<string, string | undefined> = {}
    SPECIAL_BINDINGS.forEach(binding => {
      if (!binding.value) return
      const assignment = getKeymapValue(configText, binding.value)
      if (!assignment) return
      assignment
        .split(/\s+/)
        .filter(Boolean)
        .forEach(token => {
          assignments[token.toUpperCase()] = binding.value
        })
    })
    return assignments
  }, [configText])

  const showFullLayout = view === 'full'
  const showStickLayout = view === 'sticks'
  const deadzoneDefaults = stickDeadzoneSettings?.defaults ?? {
    inner: DEFAULT_STICK_DEADZONE_INNER,
    outer: DEFAULT_STICK_DEADZONE_OUTER,
  }
  const leftDeadzoneValues = stickDeadzoneSettings?.left ?? { inner: '', outer: '' }
  const rightDeadzoneValues = stickDeadzoneSettings?.right ?? { inner: '', outer: '' }
  const leftStickModes = stickModeSettings?.left ?? { mode: '', ring: '' }
  const rightStickModes = stickModeSettings?.right ?? { mode: '', ring: '' }

  useEffect(() => {
    replaceStickShiftDisplayModes(prev => {
      if (!stickModeShiftAssignments) return {}
      const next: Record<string, 'tap' | 'extra'> = {}
      Object.keys(prev).forEach(button => {
        if (stickModeShiftAssignments[button]?.length) {
          next[button] = prev[button]
        }
      })
      Object.keys(stickModeShiftAssignments).forEach(button => {
        if (stickModeShiftAssignments[button]?.length && !next[button]) {
          next[button] = 'tap'
        }
      })
      return next
    })
  }, [stickModeShiftAssignments, replaceStickShiftDisplayModes])

  const holdPressTimeInputValue = Number.isFinite(holdPressTimeSeconds) ? holdPressTimeSeconds : holdPressTimeDefault
  const doublePressInputValue = Number.isFinite(doublePressWindowSeconds) ? doublePressWindowSeconds : holdPressTimeDefault
  const simPressInputValue = Number.isFinite(simPressWindowSeconds) ? simPressWindowSeconds : holdPressTimeDefault

  const renderButtonCard = (button: ButtonDefinition) => {
    const rows = bindingRowsByButton[button.command] ?? []
    return (
      <ButtonBindingsCard
        button={button}
        layout={layout}
        rows={rows}
        modifierOptions={modifierOptions}
        specialsByButton={specialsByButton}
        stickModeShiftAssignments={stickModeShiftAssignments}
        stickShiftDisplayModes={stickShiftDisplayModes}
        updateStickShiftDisplayMode={updateStickShiftDisplayMode}
        manualRows={manualRows}
        ensureManualRow={ensureManualRow}
        updateManualRow={updateManualRow}
        removeManualRow={removeManualRow}
        captureLabel={captureLabel}
        isCapturing={isCapturing}
        beginCapture={beginCapture}
        cancelCapture={cancelCapture}
        onBindingChange={onBindingChange}
        onModifierChange={onModifierChange}
        onAssignSpecialAction={onAssignSpecialAction}
        onClearSpecialAction={onClearSpecialAction}
        onStickModeShiftChange={onStickModeShiftChange}
        trackballDecay={trackballDecay}
        onTrackballDecayChange={onTrackballDecayChange}
      />
    )
  }

  const resolvedLockMessage = lockMessage ?? 'Calibrating — place controller on a flat surface'
  const actionsProps = {
    hasPendingChanges,
    statusMessage,
    onApply,
    onCancel,
    applyDisabled: isCalibrating,
  }

  const stickModeExtras = (side: 'LEFT' | 'RIGHT') => {
    const mode = side === 'LEFT' ? stickModeSettings?.left.mode ?? '' : stickModeSettings?.right.mode ?? ''
    if ((mode === 'AIM' || (side === 'LEFT' && mode === 'HYBRID_AIM')) && stickAimSettings && stickAimHandlers) {
      return <StickAimSettings values={stickAimSettings} handlers={stickAimHandlers} disabled={isCalibrating} />
    }
    if ((mode === 'FLICK' || mode === 'FLICK_ONLY' || mode === 'ROTATE_ONLY') && stickFlickSettings && stickFlickHandlers) {
      return <StickFlickSettings values={stickFlickSettings} handlers={stickFlickHandlers} disabled={isCalibrating} />
    }
    if (mode === 'MOUSE_AREA' && mouseRingRadius !== undefined && onMouseRingRadiusChange) {
      return (
        <div className="stick-flick-settings" data-capture-ignore="true">
          <small>Mouse area radius (pixels from center).</small>
          <div className="stick-aim-grid">
            <label>
              Mouse area radius
              <input
                type="number"
                min="0"
                step="10"
                value={mouseRingRadius}
                onChange={(event) => onMouseRingRadiusChange(event.target.value)}
                placeholder="Enter radius"
                disabled={isCalibrating}
              />
            </label>
          </div>
        </div>
      )
    }
    if (mode === 'SCROLL_WHEEL' && scrollSens !== undefined && onScrollSensChange) {
      return (
        <div className="stick-flick-settings" data-capture-ignore="true">
          <small>Scroll wheel sensitivity (degrees per pulse). Higher values require larger rotations.</small>
          <div className="stick-aim-grid">
            <label>
              Scroll sensitivity
              <input
                type="number"
                min="0"
                step="1"
                value={scrollSens}
                onChange={(event) => onScrollSensChange(event.target.value)}
                placeholder="Enter degrees"
                disabled={isCalibrating}
              />
            </label>
          </div>
        </div>
      )
    }
    return null
  }

  const renderSections = (sections: { key: string; shouldRender: boolean; node: JSX.Element }[]) =>
    sections
      .filter(section => section.shouldRender)
      .map(section => <Fragment key={section.key}>{section.node}</Fragment>)

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage={resolvedLockMessage}>
      <div className="keymap-card-header">
        <h2>
          {view === 'touchpad' ? 'Touchpad Controls' : view === 'sticks' ? 'Stick Bindings' : 'Keymap Controls'}
        </h2>
        {view === 'full' && (
          <div className="mode-toggle">
            <button className={`pill-tab ${layout === 'playstation' ? 'active' : ''}`} onClick={() => setLayout('playstation')}>
              PlayStation Labels
            </button>
            <button className={`pill-tab ${layout === 'xbox' ? 'active' : ''}`} onClick={() => setLayout('xbox')}>
              Xbox Labels
            </button>
          </div>
        )}
      </div>

      {showFullLayout &&
        renderSections([
          {
            key: 'global',
            shouldRender: isVisible('global'),
            node: (
              <GlobalControlsSection
                holdPressTimeSeconds={holdPressTimeInputValue}
                holdPressTimeIsCustom={holdPressTimeIsCustom}
                holdPressTimeDefault={holdPressTimeDefault}
                onHoldPressTimeChange={onHoldPressTimeChange}
                doublePressWindowSeconds={doublePressInputValue}
                doublePressWindowIsCustom={doublePressWindowIsCustom}
                onDoublePressWindowChange={onDoublePressWindowChange}
                simPressWindowSeconds={simPressInputValue}
                simPressWindowIsCustom={simPressWindowIsCustom}
                onSimPressWindowChange={onSimPressWindowChange}
                triggerThreshold={triggerThreshold}
                onTriggerThresholdChange={onTriggerThresholdChange}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'face',
            shouldRender: isVisible('face'),
            node: (
              <ButtonGridSection
                title="Face Buttons"
                description="Tap / Hold / Double / Chorded / Simultaneous bindings available via Add Extra Binding."
                buttons={FACE_BUTTONS}
                renderButton={renderButtonCard}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'dpad',
            shouldRender: isVisible('dpad'),
            node: (
              <ButtonGridSection
                title="D-pad"
                description="Directional pad bindings with the same extra slots and special actions."
                buttons={DPAD_BUTTONS}
                renderButton={renderButtonCard}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'bumpers',
            shouldRender: isVisible('bumpers'),
            node: (
              <ButtonGridSection
                title="Bumpers"
                description="L1/R1 bindings with the usual specials and extra slots."
                buttons={BUMPER_BUTTONS}
                renderButton={renderButtonCard}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'triggers',
            shouldRender: isVisible('triggers'),
            node: (
              <ButtonGridSection
                title="Triggers"
                description="Soft/full pulls and threshold toggles for L2/R2."
                buttons={TRIGGER_BUTTONS}
                renderButton={renderButtonCard}
                extraContent={
                  <div className="adaptive-toggle" data-capture-ignore="true">
                    <label>
                      Adaptive triggers (DualSense)
                      <select
                        className="app-select"
                        value={adaptiveTriggerValue}
                        onChange={(event) => onAdaptiveTriggerChange?.(event.target.value)}
                        disabled={isCalibrating}
                      >
                        <option value="">Default (ON)</option>
                        <option value="OFF">Off</option>
                      </select>
                    </label>
                  </div>
                }
                {...actionsProps}
              />
            ),
          },
          {
            key: 'center',
            shouldRender: isVisible('center'),
            node: (
              <ButtonGridSection
                title="Center buttons"
                description="Options, Share, and Mic bindings."
                buttons={CENTER_BUTTONS}
                renderButton={renderButtonCard}
                {...actionsProps}
              />
            ),
          },
        ])}

      {showStickLayout && (
        <>
          {stickToggleVisible && (
            <div className="mode-toggle stick-subtabs">
              <button className={`pill-tab ${currentStickView === 'bindings' ? 'active' : ''}`} onClick={() => setStickView('bindings')}>
                Bindings
              </button>
              <button className={`pill-tab ${currentStickView === 'modes' ? 'active' : ''}`} onClick={() => setStickView('modes')}>
                Modes & Settings
              </button>
            </div>
          )}
          {currentStickView === 'bindings' ? (
            renderSections([
              {
                key: 'left-stick-bind',
                shouldRender: true,
                node: (
                  <ButtonGridSection
                    title="Left stick"
                    description="Bind directions, ring, or stick click with the same extra slots available elsewhere."
                    buttons={LEFT_STICK_BUTTONS}
                    renderButton={renderButtonCard}
                    {...actionsProps}
                  />
                ),
              },
              {
                key: 'right-stick-bind',
                shouldRender: true,
                node: (
                  <ButtonGridSection
                    title="Right stick"
                    description="Configure the right stick directions, ring binding, or stick click."
                    buttons={RIGHT_STICK_BUTTONS}
                    renderButton={renderButtonCard}
                    {...actionsProps}
                  />
                ),
              },
            ])
          ) : (
            <StickModesSection
              leftDeadzone={leftDeadzoneValues}
              rightDeadzone={rightDeadzoneValues}
              deadzoneDefaults={deadzoneDefaults}
              leftMode={leftStickModes}
              rightMode={rightStickModes}
              onModeChange={(side, value) => onStickModeChange?.(side, value)}
              onRingChange={(side, value) => onRingModeChange?.(side, value)}
              onDeadzoneChange={(side, type, value) => onStickDeadzoneChange?.(side, type, value)}
              leftExtras={stickModeExtras('LEFT')}
              rightExtras={stickModeExtras('RIGHT')}
              disabled={isCalibrating}
              {...actionsProps}
            />
          )}
        </>
      )}

      {view === 'touchpad' && (
        <>
          {renderSections([
            {
              key: 'touch-bind',
              shouldRender: isVisible('touch-bind'),
              node: (
                <ButtonGridSection
                  title="Touch and click buttons"
                  description="Bindings for touch contact and pad click."
                  buttons={TOUCH_BUTTONS}
                  renderButton={renderButtonCard}
                  {...actionsProps}
                />
              ),
            },
            {
              key: 'touch-grid',
              shouldRender: isVisible('touch-grid'),
              node: (
                <>
                  <TouchpadSettingsSection
                    touchpadMode={touchpadMode}
                    gridColumns={gridColumns}
                    gridRows={gridRows}
                    onTouchpadModeChange={onTouchpadModeChange}
                    onGridSizeChange={onGridSizeChange}
                    touchpadSensitivity={touchpadSensitivity}
                    onTouchpadSensitivityChange={onTouchpadSensitivityChange}
                    {...actionsProps}
                  />
                  {touchpadMode === 'GRID_AND_STICK' && (
                    <TouchpadGridSection
                      gridColumns={clampedGridCols}
                      gridCells={clampedGridCells}
                      renderButton={renderButtonCard}
                      touchpadButtons={touchpadGridButtons}
                      {...actionsProps}
                    />
                  )}
                </>
              ),
            },
          ])}
        </>
      )}

    </Card>
  )
}
