import { useEffect, useMemo, useState } from 'react'
import { Card } from './Card'
import {
  BindingSlot,
  ButtonBindingRow,
  getButtonBindingRows,
  getKeymapValue,
  ManualRowState,
  ManualRowInfo,
} from '../utils/keymap'
import { BindingRow } from './BindingRow'

type ControllerLayout = 'playstation' | 'xbox'

type KeymapControlsProps = {
  configText: string
  hasPendingChanges: boolean
  isCalibrating: boolean
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
}

type FaceButtonDefinition = {
  command: string
  description: string
  playstation: string
  xbox: string
}

const FACE_BUTTONS: FaceButtonDefinition[] = [
  { command: 'S', description: 'South / Bottom', playstation: 'Cross', xbox: 'A' },
  { command: 'E', description: 'East / Right', playstation: 'Circle', xbox: 'B' },
  { command: 'N', description: 'North / Top', playstation: 'Triangle', xbox: 'Y' },
  { command: 'W', description: 'West / Left', playstation: 'Square', xbox: 'X' },
]

const SPECIAL_BINDINGS = [
  { value: '', label: 'Special Binds' },
  { value: 'GYRO_OFF', label: 'Hold to disable gyro' },
  { value: 'GYRO_ON', label: 'Hold to enable gyro' },
  { value: 'GYRO_INVERT', label: 'Invert gyro direction (both axes)' },
  { value: 'GYRO_INV_X', label: 'Invert gyro X axis' },
  { value: 'GYRO_INV_Y', label: 'Invert gyro Y axis' },
  { value: 'GYRO_TRACKBALL', label: 'Trackball mode (hold to engage)' },
  { value: 'GYRO_TRACK_X', label: 'Trackball mode — X axis' },
  { value: 'GYRO_TRACK_Y', label: 'Trackball mode — Y axis' },
]

const SPECIAL_OPTION_LIST = SPECIAL_BINDINGS.filter(option => option.value)
const SPECIAL_OPTION_MANUAL_LIST = SPECIAL_BINDINGS.filter(option => option.value && !['GYRO_OFF', 'GYRO_ON'].includes(option.value))

const SPECIAL_LABELS: Record<string, string> = {
  GYRO_OFF: 'Disable gyro',
  GYRO_ON: 'Enable gyro',
  GYRO_INVERT: 'Invert gyro axes',
  GYRO_INV_X: 'Invert gyro X axis',
  GYRO_INV_Y: 'Invert gyro Y axis',
  GYRO_TRACKBALL: 'Trackball mode (XY)',
  GYRO_TRACK_X: 'Trackball mode (X only)',
  GYRO_TRACK_Y: 'Trackball mode (Y only)',
}

type ModifierSelectOption = { value: string; label: string; disabled?: boolean }

const BASE_MODIFIER_OPTIONS: ModifierSelectOption[] = [
  { value: 'UP', label: 'UP – D-pad up' },
  { value: 'DOWN', label: 'DOWN – D-pad down' },
  { value: 'LEFT', label: 'LEFT – D-pad left' },
  { value: 'RIGHT', label: 'RIGHT – D-pad right' },
  { value: 'L', label: 'L – top-left bumper (L1 / LB)' },
  { value: 'ZL', label: 'ZL – left trigger soft pull (L2 / LT)' },
  { value: 'ZLF', label: 'ZLF – left trigger full pull' },
  { value: 'R', label: 'R – top-right bumper (R1 / RB)' },
  { value: 'ZR', label: 'ZR – right trigger soft pull (R2 / RT)' },
  { value: 'ZRF', label: 'ZRF – right trigger full pull' },
  { value: '-', label: '- – Minus / Share button' },
  { value: '+', label: '+ – Plus / Options button' },
  { value: 'HOME', label: 'HOME – PS / Guide button' },
  { value: 'CAPTURE', label: 'CAPTURE – Touchpad click / Capture' },
  { value: 'LSL', label: 'LSL – Joy-Con paddle (left side)' },
  { value: 'LSR', label: 'LSR – Joy-Con paddle (left side)' },
  { value: 'RSL', label: 'RSL – Joy-Con paddle (right side)' },
  { value: 'RSR', label: 'RSR – Joy-Con paddle (right side)' },
  { value: 'L3', label: 'L3 – left stick click' },
  { value: 'R3', label: 'R3 – right stick click' },
  { value: 'N', label: 'N – North face button (Triangle / Y)' },
  { value: 'E', label: 'E – East face button (Circle / B)' },
  { value: 'S', label: 'S – South face button (Cross / A)' },
  { value: 'W', label: 'W – West face button (Square / X)' },
  { value: 'LUP', label: 'LUP – left stick up' },
  { value: 'LDOWN', label: 'LDOWN – left stick down' },
  { value: 'LLEFT', label: 'LLEFT – left stick left' },
  { value: 'LRIGHT', label: 'LRIGHT – left stick right' },
  { value: 'LRING', label: 'LRING – left stick ring binding' },
  { value: 'RUP', label: 'RUP – right stick up' },
  { value: 'RDOWN', label: 'RDOWN – right stick down' },
  { value: 'RLEFT', label: 'RLEFT – right stick left' },
  { value: 'RRIGHT', label: 'RRIGHT – right stick right' },
  { value: 'RRING', label: 'RRING – right stick ring binding' },
  { value: 'MUP', label: 'MUP – motion stick up' },
  { value: 'MDOWN', label: 'MDOWN – motion stick down' },
  { value: 'MLEFT', label: 'MLEFT – motion stick left' },
  { value: 'MRIGHT', label: 'MRIGHT – motion stick right' },
  { value: 'MRING', label: 'MRING – motion ring binding' },
  { value: 'LEAN_LEFT', label: 'LEAN_LEFT – tilt controller left' },
  { value: 'LEAN_RIGHT', label: 'LEAN_RIGHT – tilt controller right' },
  { value: 'MIC', label: 'MIC – DualSense microphone button' },
]

const TOUCHPAD_CORE_OPTIONS: ModifierSelectOption[] = [{ value: 'TOUCH', label: 'Touchpad touch' }]

const TOUCHPAD_STICK_OPTIONS: ModifierSelectOption[] = [
  { value: 'TUP', label: 'Touch stick up' },
  { value: 'TDOWN', label: 'Touch stick down' },
  { value: 'TLEFT', label: 'Touch stick left' },
  { value: 'TRIGHT', label: 'Touch stick right' },
  { value: 'TRING', label: 'Touch stick ring' },
]

const TOUCHPAD_GRID_PREVIEW_COUNT = 6

const EXTRA_BINDING_SLOTS: BindingSlot[] = ['hold', 'double', 'chord', 'simultaneous']
const MODIFIER_SLOT_TYPES: BindingSlot[] = ['chord', 'simultaneous']

const clampGridButtons = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(Math.max(Math.floor(value), 1), 25)
}

const buildModifierOptions = (
  layout: ControllerLayout,
  gridActive: boolean,
  configuredGridButtons: number
): { options: ModifierSelectOption[]; hint?: string } => {
  const options: ModifierSelectOption[] = [...BASE_MODIFIER_OPTIONS]
  let hint: string | undefined
  if (layout === 'playstation') {
    options.push(...TOUCHPAD_CORE_OPTIONS)
    if (gridActive) {
      const count = clampGridButtons(configuredGridButtons || 1)
      for (let index = 1; index <= count; index += 1) {
        options.push({ value: `T${index}`, label: `Touch grid T${index}` })
      }
      options.push(...TOUCHPAD_STICK_OPTIONS)
    } else {
      for (let index = 1; index <= TOUCHPAD_GRID_PREVIEW_COUNT; index += 1) {
        options.push({
          value: `T${index}`,
          label: `Touch grid T${index} (enable grid to use)`,
          disabled: true,
        })
      }
      hint = 'Enable touchpad grid in JoyShockMapper to unlock T1–Tn bindings.'
    }
  }
  return { options, hint }
}

const getDefaultModifierForButton = (button: string, modifierOptions: ModifierSelectOption[]) => {
  const upper = button.toUpperCase()
  const fallback = modifierOptions[0]?.value ?? 'L3'
  const candidate = modifierOptions.find(option => option.value !== upper && !option.disabled)
  return candidate?.value ?? fallback
}

type CaptureTarget = { button: string; slot: BindingSlot; modifier?: string }

const KEY_CODE_MAP: Record<string, string> = {
  Escape: 'ESC',
  Tab: 'TAB',
  Backspace: 'BACKSPACE',
  Enter: 'ENTER',
  Space: 'SPACE',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Insert: 'INSERT',
  Delete: 'DELETE',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PAGEUP',
  PageDown: 'PAGEDOWN',
  CapsLock: 'CAPS_LOCK',
  ScrollLock: 'SCROLL_LOCK',
  NumLock: 'NUM_LOCK',
  Pause: 'PAUSE',
  PrintScreen: 'SCREENSHOT',
  ContextMenu: 'CONTEXT',
}

const PUNCTUATION_MAP: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
}

const FUNCTION_KEYS = new Set(Array.from({ length: 29 }, (_, index) => `F${index + 1}`))

function keyboardEventToBinding(event: KeyboardEvent): string | null {
  const { code, key } = event
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5)
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return `N${code.slice(6)}`
  }
  if (code.startsWith('Shift')) {
    return code === 'ShiftRight' ? 'RSHIFT' : 'LSHIFT'
  }
  if (code.startsWith('Control')) {
    return code === 'ControlRight' ? 'RCONTROL' : 'LCONTROL'
  }
  if (code.startsWith('Alt')) {
    return code === 'AltRight' ? 'RALT' : 'LALT'
  }
  if (code === 'MetaLeft') {
    return 'LWINDOWS'
  }
  if (code === 'MetaRight') {
    return 'RWINDOWS'
  }
  if (FUNCTION_KEYS.has(code)) {
    return code
  }
  if (PUNCTUATION_MAP[code]) {
    return PUNCTUATION_MAP[code]
  }
  if (KEY_CODE_MAP[key]) {
    return KEY_CODE_MAP[key]
  }
  if (key && key.length === 1) {
    if (key === ' ') return 'SPACE'
    return key.toUpperCase()
  }
  return null
}

function mouseButtonToBinding(button: number): string | null {
  switch (button) {
    case 0:
      return 'LMOUSE'
    case 1:
      return 'MMOUSE'
    case 2:
      return 'RMOUSE'
    case 3:
      return 'BMOUSE'
    case 4:
      return 'FMOUSE'
    default:
      return null
  }
}

function wheelEventToBinding(deltaY: number): string | null {
  if (deltaY < 0) return 'SCROLLUP'
  if (deltaY > 0) return 'SCROLLDOWN'
  return null
}

const shouldIgnoreCapture = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target) return false
  return Boolean(target.closest('[data-capture-ignore="true"]'))
}

const TRACKBALL_SPECIALS = new Set(['GYRO_TRACKBALL', 'GYRO_TRACK_X', 'GYRO_TRACK_Y'])

export function KeymapControls({
  configText,
  hasPendingChanges,
  isCalibrating,
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
}: KeymapControlsProps) {
  const [layout, setLayout] = useState<ControllerLayout>('playstation')
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null)
  const [suppressKey, setSuppressKey] = useState<string | null>(null)
  const [manualRows, setManualRows] = useState<Record<string, ManualRowState>>({})
  const touchpadMode = useMemo(
    () => getKeymapValue(configText, 'TOUCHPAD_MODE')?.trim().toUpperCase() ?? 'MOUSE',
    [configText]
  )
  const gridSizeRaw = useMemo(() => getKeymapValue(configText, 'GRID_SIZE'), [configText])
  const configuredGridButtons = useMemo(() => {
    if (touchpadMode !== 'GRID_AND_STICK') return 0
    if (!gridSizeRaw) return 2
    const tokens = gridSizeRaw.split(/\s+/).map(token => Number(token))
    if (tokens.length >= 2) {
      const product = tokens[0] * tokens[1]
      return clampGridButtons(product)
    }
    return 2
  }, [gridSizeRaw, touchpadMode])
  const gridActive = touchpadMode === 'GRID_AND_STICK'
  const { options: modifierOptions, hint: touchpadHint } = useMemo(() => {
    return buildModifierOptions(layout, gridActive, configuredGridButtons)
  }, [layout, gridActive, configuredGridButtons])

  const bindingRowsByButton = useMemo(() => {
    const record: Record<string, ButtonBindingRow[]> = {}
    FACE_BUTTONS.forEach(({ command }) => {
      record[command] = getButtonBindingRows(configText, command, manualRows[command] ?? {})
    })
    return record
  }, [configText, manualRows])

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

  const [captureLabel, setCaptureLabel] = useState<string>('')

  useEffect(() => {
    if (!captureTarget) return
    const handleBinding = (value: string | null, suppress: boolean) => {
      if (value) {
        onBindingChange(captureTarget.button, captureTarget.slot, value, { modifier: captureTarget.modifier })
        if (suppress) {
          setSuppressKey(`${captureTarget.button}-${captureTarget.slot}`)
        } else {
          setSuppressKey(null)
        }
        setCaptureTarget(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = keyboardEventToBinding(event)
      handleBinding(binding, false)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = mouseButtonToBinding(event.button)
      handleBinding(binding, true)
    }

    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = wheelEventToBinding(event.deltaY)
      handleBinding(binding, false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    const wheelListenerOptions: AddEventListenerOptions = { passive: false, capture: true }
    window.addEventListener('wheel', handleWheel, wheelListenerOptions)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('wheel', handleWheel, wheelListenerOptions)
    }
  }, [captureTarget, onBindingChange])

  const beginCapture = (button: string, slot: BindingSlot, modifier?: string) => {
    const key = `${button}-${slot}`
    if (suppressKey === key) {
      setSuppressKey(null)
      return
    }
    setCaptureLabel(slot === 'hold' ? 'Press and hold binding…' : 'Press any key or mouse button…')
    setCaptureTarget({ button, slot, modifier })
  }

  const cancelCapture = () => {
    setCaptureTarget(null)
    setSuppressKey(null)
  }

  const ensureManualRow = (button: string, slot: BindingSlot, defaults?: ManualRowInfo) => {
    setManualRows(prev => {
      const existing = prev[button] ? { ...prev[button] } : {}
      if (existing[slot]) return prev
      existing[slot] = { ...(defaults ?? {}) }
      return { ...prev, [button]: existing }
    })
  }

  const updateManualRow = (button: string, slot: BindingSlot, info: ManualRowInfo) => {
    setManualRows(prev => {
      const existing = prev[button] ? { ...prev[button] } : {}
      existing[slot] = { ...(existing[slot] ?? {}), ...info }
      return { ...prev, [button]: existing }
    })
  }

  const removeManualRow = (button: string, slot: BindingSlot) => {
    setManualRows(prev => {
      const existing = prev[button]
      if (!existing || !existing[slot]) return prev
      const nextExisting = { ...existing }
      delete nextExisting[slot]
      const next = { ...prev }
      if (Object.keys(nextExisting).length === 0) {
        delete next[button]
      } else {
        next[button] = nextExisting
      }
      return next
    })
  }

  const handleModifierSelection = (button: string, slot: BindingSlot, row: ButtonBindingRow, nextModifier: string) => {
    if (!nextModifier) return
    if (row.isManual) {
      updateManualRow(button, slot, { modifierCommand: nextModifier })
    }
    if (row.binding) {
      onModifierChange(button, slot, row.modifierCommand, nextModifier, row.binding)
    }
  }

  const trackballSliderValue = trackballDecay && !Number.isNaN(Number(trackballDecay)) ? Number(trackballDecay) : 1
  const holdPressTimeInputValue = Number.isFinite(holdPressTimeSeconds) ? holdPressTimeSeconds : holdPressTimeDefault

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage="Keymapping locked while JSM calibrates">
      <div className="keymap-card-header">
        <h2>Keymap Controls</h2>
        <div className="mode-toggle">
          <button className={`pill-tab ${layout === 'playstation' ? 'active' : ''}`} onClick={() => setLayout('playstation')}>
            PlayStation Labels
          </button>
          <button className={`pill-tab ${layout === 'xbox' ? 'active' : ''}`} onClick={() => setLayout('xbox')}>
            Xbox Labels
          </button>
        </div>
      </div>

      <div className="tap-time-control" data-capture-ignore="true">
        <div className="tap-time-text">
          <span className="tap-time-title">Hold press threshold</span>
          <span className="tap-time-caption">
            {holdPressTimeIsCustom
              ? 'Custom HOLD_PRESS_TIME saved'
              : `Using default (${Math.round(holdPressTimeDefault * 1000)} ms)`}
          </span>
        </div>
        <div className="tap-time-input-group">
          <input
            id="tap-time-input"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={holdPressTimeInputValue}
            onChange={(event) => onHoldPressTimeChange(event.target.value)}
          />
          <span className="tap-time-unit">seconds</span>
        </div>
      </div>
      {layout === 'playstation' && touchpadHint && <div className="touchpad-grid-hint">{touchpadHint}</div>}

      <div className="keymap-section">
        <div className="keymap-section-header">
          <div>
            <h3>Face Buttons</h3>
            <p>Tap/hold/double bindings with optional gyro actions.</p>
          </div>
        </div>
        <div className="keymap-grid">
          {FACE_BUTTONS.map(button => {
            const rows = bindingRowsByButton[button.command] ?? []
            const specialKey = specialsByButton[button.command] as keyof typeof SPECIAL_LABELS | undefined
            const tapSpecialLabel = specialKey ? SPECIAL_LABELS[specialKey] ?? '' : ''
            const buttonHasTrackball = Boolean(
              rows.some(row => {
                const binding = row.binding?.toUpperCase()
                return binding ? binding.includes('TRACK') : false
              }) || (specialKey && TRACKBALL_SPECIALS.has(specialKey))
            )
            const existingSlots = new Set(rows.map(row => row.slot))
            return (
              <div className="keymap-row" key={button.command}>
                <div className="keymap-label">
                  <span className="button-name">{layout === 'playstation' ? button.playstation : button.xbox}</span>
                  <span className="button-meta">{button.description} · Command {button.command}</span>
                </div>
                <div className="keymap-binding-controls">
                  {rows.map(row => {
                    const isCapturing = captureTarget?.button === button.command && captureTarget.slot === row.slot
                    const hasExtraRows = rows.length > 1
                    const isSpecialValue = Boolean(row.binding && SPECIAL_LABELS[row.binding])
                    const displayValue = (() => {
                      if (row.slot === 'tap') {
                        if (row.binding) return row.binding
                        return tapSpecialLabel
                      }
                      if (isSpecialValue && row.binding) {
                        return SPECIAL_LABELS[row.binding]
                      }
                      return row.binding || ''
                    })()
                    const showHeader = row.slot !== 'tap' || hasExtraRows
                    const headerLabel = row.slot === 'tap' && hasExtraRows ? 'Regular Press' : row.label
                    const rowSpecialOptions = MODIFIER_SLOT_TYPES.includes(row.slot as BindingSlot)
                      ? SPECIAL_OPTION_MANUAL_LIST
                      : SPECIAL_OPTION_LIST
                    const specialValue =
                      row.slot === 'tap'
                        ? specialKey ?? ''
                        : isSpecialValue && row.binding
                          ? row.binding
                          : ''
                    const needsModifier = MODIFIER_SLOT_TYPES.includes(row.slot as BindingSlot)
                    const modifierValue = needsModifier
                      ? row.modifierCommand ??
                        manualRows[button.command]?.[row.slot]?.modifierCommand ??
                        getDefaultModifierForButton(button.command, modifierOptions)
                      : undefined
                    const modifierLabel = row.slot === 'simultaneous' ? 'Combine with' : 'Modifier button'
                    let rowModifierOptions = modifierOptions
                    if (
                      needsModifier &&
                      modifierValue &&
                      !modifierOptions.some(option => option.value === modifierValue)
                    ) {
                      rowModifierOptions = [...modifierOptions, { value: modifierValue, label: modifierValue }]
                    }
                    return (
                      <BindingRow
                        key={`${button.command}-${row.slot}`}
                        label={headerLabel}
                        showHeader={showHeader}
                        displayValue={displayValue}
                        isManual={row.isManual}
                        isCapturing={isCapturing}
                        captureLabel={captureLabel}
                        onBeginCapture={() => beginCapture(button.command, row.slot, needsModifier ? modifierValue : undefined)}
                        onCancelCapture={cancelCapture}
                        onClear={() => {
                          if (row.slot === 'tap') {
                            if (row.binding) {
                              onBindingChange(button.command, row.slot, null)
                            } else if (specialKey) {
                              onClearSpecialAction(specialKey, button.command)
                            }
                          } else {
                            const options = needsModifier ? { modifier: modifierValue } : undefined
                            onBindingChange(button.command, row.slot, null, options)
                          }
                        }}
                        onRemoveRow={row.isManual ? () => removeManualRow(button.command, row.slot) : undefined}
                        disableClear={!displayValue}
                        specialOptions={rowSpecialOptions}
                        specialValue={specialValue}
                        modifierOptions={needsModifier ? rowModifierOptions : undefined}
                        modifierValue={modifierValue}
                        modifierLabel={needsModifier ? modifierLabel : undefined}
                        onModifierChange={
                          needsModifier
                            ? (selected) =>
                                handleModifierSelection(button.command, row.slot, row, selected)
                            : undefined
                        }
                        onSpecialChange={
                          row.slot === 'tap'
                            ? (selected) => {
                                if (!selected) {
                                  if (specialKey) {
                                    onClearSpecialAction(specialKey, button.command)
                                  }
                                  return
                                }
                                onAssignSpecialAction(selected, button.command)
                              }
                            : (selected) => {
                                if (!selected) {
                                  if (isSpecialValue) {
                                    const options = needsModifier ? { modifier: modifierValue } : undefined
                                    onBindingChange(button.command, row.slot, null, options)
                                  }
                                  return
                                }
                                onBindingChange(button.command, row.slot, selected, needsModifier ? { modifier: modifierValue } : undefined)
                                ensureManualRow(button.command, row.slot)
                              }
                        }
                      />
                    )
                  })}
                  {(() => {
                    const hasExtraRow = rows.length > 1
                    if (hasExtraRow) {
                      return null
                    }
                    const availableSlots = EXTRA_BINDING_SLOTS.filter(slot => !existingSlots.has(slot))
                    if (availableSlots.length === 0) {
                      return null
                    }
                    return (
                      <div className="binding-row add-binding-row" data-capture-ignore="true">
                        <select
                          value=""
                          onChange={(event) => {
                            const selected = event.target.value as BindingSlot
                            if (selected) {
                              if (MODIFIER_SLOT_TYPES.includes(selected)) {
                                ensureManualRow(button.command, selected, {
                                  modifierCommand: getDefaultModifierForButton(button.command, modifierOptions),
                                })
                              } else {
                                ensureManualRow(button.command, selected)
                              }
                            }
                            event.target.value = ''
                          }}
                        >
                          <option value="">Add extra binding</option>
                          {availableSlots.map(slot => (
                            <option key={`${button.command}-${slot}-opt`} value={slot}>
                              {slot === 'hold'
                                ? 'Hold (press & hold)'
                                : slot === 'double'
                                  ? 'Double press'
                                  : slot === 'chord'
                                    ? 'Chorded press'
                                    : 'Simultaneous press'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                  {buttonHasTrackball && (
                    <div className="trackball-inline" data-capture-ignore="true">
                      <label>
                        Trackball decay
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={trackballDecay}
                          onChange={(event) => onTrackballDecayChange(event.target.value)}
                          placeholder="Default (1.0)"
                        />
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={trackballSliderValue}
                        onChange={(event) => onTrackballDecayChange(event.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="control-actions">
        <button onClick={onApply}>Apply Changes</button>
        {hasPendingChanges && (
          <button className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        {hasPendingChanges && (
          <span className="pending-banner">Pending changes — click Apply to send to JoyShockMapper.</span>
        )}
      </div>
    </Card>
  )
}
