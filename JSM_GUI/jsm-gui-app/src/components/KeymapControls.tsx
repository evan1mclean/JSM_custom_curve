import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_STICK_DEADZONE_INNER, DEFAULT_STICK_DEADZONE_OUTER } from '../constants/defaults'
import {
  BindingSlot,
  ButtonBindingRow,
  getButtonBindingRows,
  getKeymapValue,
} from '../utils/keymap'
import { buildModifierOptions, resolveModifierOptionLabel } from '../utils/modifierOptions'
import {
  BUMPER_BUTTONS,
  CENTER_BUTTONS,
  DPAD_BUTTONS,
  FACE_BUTTONS,
  LEFT_STICK_BUTTONS,
  MINI_BUTTONS,
  MISC_BUTTONS,
  PADDLE_BUTTONS,
  RIGHT_STICK_BUTTONS,
  STICK_AIM_DEFAULTS,
  TOUCH_BUTTONS,
  TRIGGER_BUTTONS,
  buildTouchpadGridButton,
  getSpecialOptionList,
  type ButtonDefinition,
} from '../keymap/schema'
import { useBindingCapture } from '../keymap/useBindingCapture'
import { useButtonRowState } from '../keymap/useButtonRowState'
import { ButtonBindingsCard } from './keymap/ButtonBindingsCard'
import { ButtonGridSection } from './keymap/ButtonGridSection'
import { Card } from './Card'
import keymapStyles from './Keymap.module.css'
import { KeymapSection } from './KeymapSection'
import { GlobalControlsSection } from './keymap/GlobalControlsSection'
import { StickModesSection } from './keymap/StickModesSection'
import stickStyles from './Sticks.module.css'
import { TouchpadGridSection } from './keymap/TouchpadGridSection'
import { TouchpadSettingsSection } from './keymap/TouchpadSettingsSection'
import { TriggerControlsSection } from './keymap/TriggerControlsSection'
import { SectionActions } from './SectionActions'

type KeymapControlsProps = {
  configText: string
  hasPendingChanges: boolean
  isCalibrating: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  onBindingChange: (
    button: string,
    slot: BindingSlot,
    rowId: string,
    value: string | null,
    options?: { modifier?: string }
  ) => void
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
    rowId: string,
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
  lightBarColor: string | null
  onLightBarChange: (color: string | null) => void
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
  zlModeValue?: string
  zrModeValue?: string
  onZlModeChange?: (value: string) => void
  onZrModeChange?: (value: string) => void
}

type StickAimSettingsProps = {
  values: NonNullable<KeymapControlsProps['stickAimSettings']>
  handlers: NonNullable<KeymapControlsProps['stickAimHandlers']>
  disabled?: boolean
}

const StickAimSettings = ({ values, handlers, disabled }: StickAimSettingsProps) => {
  const { t } = useTranslation()
  const sensXValue = values.displaySensX
  const sensYValue = values.displaySensY
  const powerValue = values.power ?? ''
  const accelRateValue = values.accelerationRate ?? ''
  const accelCapValue = values.accelerationCap ?? ''
  const formatDefault = (value: string) => t('common.defaultValue', { value })

  return (
    <div className={stickStyles.stickAimSettings} data-capture-ignore="true">
      <small>{t('keymap.stickAimNote')}</small>
      <div className={stickStyles.stickAimGrid}>
        <label>
          {t('keymap.stickSensitivityHorizontal')}
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
          {t('keymap.stickSensitivityVertical')}
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
          {t('keymap.stickPower')}
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
          {t('keymap.accelerationRate')}
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
          {t('keymap.accelerationCap')}
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
  const { t } = useTranslation()
  const snapMode = values.snapMode || ''
  const formatDefault = (value: string) => t('common.defaultValue', { value })

  return (
    <div className="stick-flick-settings" data-capture-ignore="true">
      <small>{t('keymap.stickFlickNote')}</small>
      <div className={stickStyles.stickAimGrid}>
        <label>
          {t('keymap.flickTime')}
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
          {t('keymap.flickTimeExponent')}
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
          {t('keymap.snapMode')}
          <select className="app-select" value={snapMode} onChange={(event) => handlers.onSnapModeChange(event.target.value)} disabled={disabled}>
            <option value="">{t('common.defaultValue', { value: 'NONE' })}</option>
            <option value="4">{t('keymap.snapToFour')}</option>
            <option value="8">{t('keymap.snapToEight')}</option>
          </select>
        </label>
        <label>
          {t('keymap.snapStrength')}
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
          {t('keymap.forwardDeadzoneAngle')}
          <input
            type="number"
            step="1"
            min="0"
            max="180"
            value={values.deadzoneAngle}
            onChange={(event) => handlers.onDeadzoneAngleChange(event.target.value)}
            placeholder={formatDefault('0')}
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
  lightBarColor,
  onLightBarChange,
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
  zlModeValue = '',
  zrModeValue = '',
  onZlModeChange = () => {},
  onZrModeChange = () => {},
}: KeymapControlsProps) {
  const { t } = useTranslation()
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
  const { captureLabel, beginCapture, cancelCapture, isCapturing } = useBindingCapture((button, slot, rowId, value, options) => {
    onBindingChange(button, slot, rowId, value, options)
    const isComboSlot = slot === 'chord' || slot === 'simultaneous' || slot === 'diagonal'
    if (value && isComboSlot && manualRows[button]?.[slot]?.some(entry => entry.id === rowId)) {
      removeManualRow(button, slot, rowId)
    }
  })

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
    return buildModifierOptions(gridActive, configuredGridButtons).map(option => ({
      value: option.value,
      label: resolveModifierOptionLabel(option, t),
      disabled: option.disabled,
    }))
  }, [configuredGridButtons, gridActive, t])

  const touchpadGridButtons = useMemo<ButtonDefinition[]>(() => {
    return Array.from({ length: clampedGridCells }, (_, index) => {
      const rowIndex = Math.floor(index / clampedGridCols) + 1
      const colIndex = (index % clampedGridCols) + 1
      return buildTouchpadGridButton(index + 1, rowIndex, colIndex)
    })
  }, [clampedGridCells, clampedGridCols])

  const bindingRowsByButton = useMemo(() => {
    const record: Record<string, ButtonBindingRow[]> = {}
    ;[
      ...FACE_BUTTONS,
      ...DPAD_BUTTONS,
      ...BUMPER_BUTTONS,
      ...MINI_BUTTONS,
      ...TRIGGER_BUTTONS,
      ...CENTER_BUTTONS,
      ...PADDLE_BUTTONS,
      ...LEFT_STICK_BUTTONS,
      ...RIGHT_STICK_BUTTONS,
      ...TOUCH_BUTTONS,
      ...MISC_BUTTONS,
      ...touchpadGridButtons,
    ].forEach(({ command }) => {
      record[command] = getButtonBindingRows(configText, command, manualRows[command] ?? {})
    })
    return record
  }, [configText, manualRows, touchpadGridButtons])

  const specialsByButton = useMemo(() => {
    const assignments: Record<string, string | undefined> = {}
    getSpecialOptionList(t).forEach(binding => {
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
  }, [configText, t])

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
  }, [replaceStickShiftDisplayModes, stickModeShiftAssignments])

  const holdPressTimeInputValue = Number.isFinite(holdPressTimeSeconds) ? holdPressTimeSeconds : holdPressTimeDefault
  const doublePressInputValue = Number.isFinite(doublePressWindowSeconds) ? doublePressWindowSeconds : holdPressTimeDefault
  const simPressInputValue = Number.isFinite(simPressWindowSeconds) ? simPressWindowSeconds : holdPressTimeDefault

  const renderButtonCard = (button: ButtonDefinition) => {
    const rows = bindingRowsByButton[button.command] ?? []
    return (
      <ButtonBindingsCard
        button={button}
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
        <div className={stickStyles.stickFlickSettings} data-capture-ignore="true">
          <small>{t('keymap.mouseAreaRadiusNote')}</small>
          <div className={stickStyles.stickAimGrid}>
            <label>
              {t('keymap.mouseAreaRadius')}
              <input
                type="number"
                min="0"
                step="10"
                value={mouseRingRadius}
                onChange={(event) => onMouseRingRadiusChange(event.target.value)}
                placeholder={t('common.enterRadius')}
                disabled={isCalibrating}
              />
            </label>
          </div>
        </div>
      )
    }
    if (mode === 'SCROLL_WHEEL' && scrollSens !== undefined && onScrollSensChange) {
      return (
        <div className={stickStyles.stickFlickSettings} data-capture-ignore="true">
          <small>{t('keymap.scrollSensitivityNote')}</small>
          <div className={stickStyles.stickAimGrid}>
            <label>
              {t('keymap.scrollSensitivity')}
              <input
                type="number"
                min="0"
                step="1"
                value={scrollSens}
                onChange={(event) => onScrollSensChange(event.target.value)}
                placeholder={t('common.enterDegrees')}
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
    sections.filter(section => section.shouldRender).map(section => <Fragment key={section.key}>{section.node}</Fragment>)

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage={lockMessage ?? t('messages.lockMessage')}>
      <div className={keymapStyles.keymapCardHeader}>
        <h2>
          {view === 'touchpad'
            ? t('keymap.touchpadControlsTitle')
            : view === 'sticks'
              ? t('keymap.stickBindingsTitle')
              : t('keymap.controlsTitle')}
        </h2>
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
                lightBarColor={lightBarColor}
                onLightBarChange={onLightBarChange}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'face',
            shouldRender: isVisible('face'),
            node: (
              <ButtonGridSection
                title={t('keymap.faceButtonsTitle')}
                description={t('keymap.faceButtonsDescription')}
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
                title={t('keymap.dpadTitle')}
                description={t('keymap.dpadDescription')}
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
                title={t('keymap.bumpersTitle')}
                description={t('keymap.bumpersDescription')}
                buttons={[...BUMPER_BUTTONS, ...MINI_BUTTONS]}
                renderButton={renderButtonCard}
                extraContent={<small className={keymapStyles.paddleNote}>{t('keymap.bumpersNote')}</small>}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'trigger-controls',
            shouldRender: isVisible('triggers'),
            node: (
              <TriggerControlsSection
                adaptiveTriggerValue={adaptiveTriggerValue}
                onAdaptiveTriggerChange={onAdaptiveTriggerChange}
                triggerThreshold={triggerThreshold}
                onTriggerThresholdChange={onTriggerThresholdChange}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'triggers',
            shouldRender: isVisible('triggers'),
            node: (() => {
              const zlActive = !!zlModeValue && zlModeValue !== 'NO_FULL'
              const zrActive = !!zrModeValue && zrModeValue !== 'NO_FULL'
              const modeOptions = ['NO_FULL', 'NO_SKIP', 'NO_SKIP_EXCLUSIVE', 'MUST_SKIP', 'MAY_SKIP', 'MUST_SKIP_R', 'MAY_SKIP_R']
              return (
                <>
                  <KeymapSection title={t('keymap.triggersTitle')} description={t('keymap.triggersDescription')}>
                    <div className={keymapStyles.keymapGrid}>
                      {TRIGGER_BUTTONS.filter(b => b.command === 'ZL').map(b => <div key={b.command}>{renderButtonCard(b)}</div>)}
                      <div className={keymapStyles.globalControlRow} data-capture-ignore="true">
                        <span className={keymapStyles.globalControlTitle}>{t('keymap.l2FullPullMode')}</span>
                        <select className="app-select" value={zlModeValue || 'NO_FULL'} onChange={e => onZlModeChange(e.target.value)} disabled={actionsProps.applyDisabled}>
                          {modeOptions.map(m => (
                            <option key={m} value={m}>
                              {m === 'NO_FULL' ? t('common.defaultValue', { value: m }) : m}
                            </option>
                          ))}
                        </select>
                      </div>
                      {zlActive && TRIGGER_BUTTONS.filter(b => b.command === 'ZLF').map(b => <div key={b.command}>{renderButtonCard(b)}</div>)}
                      {TRIGGER_BUTTONS.filter(b => b.command === 'ZR').map(b => <div key={b.command}>{renderButtonCard(b)}</div>)}
                      <div className={keymapStyles.globalControlRow} data-capture-ignore="true">
                        <span className={keymapStyles.globalControlTitle}>{t('keymap.r2FullPullMode')}</span>
                        <select className="app-select" value={zrModeValue || 'NO_FULL'} onChange={e => onZrModeChange(e.target.value)} disabled={actionsProps.applyDisabled}>
                          {modeOptions.map(m => (
                            <option key={m} value={m}>
                              {m === 'NO_FULL' ? t('common.defaultValue', { value: m }) : m}
                            </option>
                          ))}
                        </select>
                      </div>
                      {zrActive && TRIGGER_BUTTONS.filter(b => b.command === 'ZRF').map(b => <div key={b.command}>{renderButtonCard(b)}</div>)}
                    </div>
                  </KeymapSection>
                  <SectionActions className={keymapStyles.keymapSectionActions} {...actionsProps} />
                </>
              )
            })(),
          },
          {
            key: 'center',
            shouldRender: isVisible('center'),
            node: (
              <ButtonGridSection
                title={t('keymap.centerButtonsTitle')}
                description={t('keymap.centerButtonsDescription')}
                buttons={CENTER_BUTTONS}
                renderButton={renderButtonCard}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'paddles',
            shouldRender: isVisible('paddles'),
            node: (
              <ButtonGridSection
                title={t('keymap.paddlesTitle')}
                description={t('keymap.paddlesDescription')}
                buttons={PADDLE_BUTTONS}
                renderButton={renderButtonCard}
                extraContent={<small className={keymapStyles.paddleNote}>{t('keymap.paddlesNote')}</small>}
                {...actionsProps}
              />
            ),
          },
          {
            key: 'extra',
            shouldRender: isVisible('extra'),
            node: (
              <ButtonGridSection
                title={t('keymap.extraButtonsTitle')}
                description={t('keymap.extraButtonsDescription')}
                buttons={MISC_BUTTONS}
                renderButton={renderButtonCard}
                extraContent={<small className={keymapStyles.paddleNote}>{t('keymap.extraButtonsNote')}</small>}
                {...actionsProps}
              />
            ),
          },
        ])}

      {showStickLayout && (
        <>
          {stickToggleVisible && (
            <div className={`mode-toggle ${stickStyles.stickSubtabs}`}>
              <button className={`pill-tab ${currentStickView === 'bindings' ? 'active' : ''}`} onClick={() => setStickView('bindings')}>
                {t('keymap.bindings')}
              </button>
              <button className={`pill-tab ${currentStickView === 'modes' ? 'active' : ''}`} onClick={() => setStickView('modes')}>
                {t('keymap.modesAndSettings')}
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
                    title={t('keymap.leftStickTitle')}
                    description={t('keymap.leftStickDescription')}
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
                    title={t('keymap.rightStickTitle')}
                    description={t('keymap.rightStickDescription')}
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
                  title={t('keymap.touchButtonsTitle')}
                  description={t('keymap.touchButtonsDescription')}
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
