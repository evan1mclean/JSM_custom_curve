import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card } from './Card'
import {
  BindingSlot,
  ButtonBindingRow,
  getButtonBindingRows,
  getKeymapValue,
  ManualRowState,
  ManualRowInfo,
} from '../utils/keymap'
import { buildModifierOptions, ControllerLayout, ModifierSelectOption } from '../utils/modifierOptions'
import { BindingRow } from './BindingRow'
import { KeymapSection } from './KeymapSection'
import { SectionActions } from './SectionActions'
import { StickSettingsCard } from './StickSettingsCard'

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
  stickModeShiftAssignments?: Record<string, { target: 'LEFT' | 'RIGHT'; mode: string }[]>
  onStickModeShiftChange?: (button: string, target: 'LEFT' | 'RIGHT', mode?: string) => void
}

type ButtonDefinition = {
  command: string
  description: string
  playstation: string
  xbox: string
}

const FACE_BUTTONS: ButtonDefinition[] = [
  { command: 'S', description: 'South / Bottom', playstation: 'Cross', xbox: 'A' },
  { command: 'E', description: 'East / Right', playstation: 'Circle', xbox: 'B' },
  { command: 'N', description: 'North / Top', playstation: 'Triangle', xbox: 'Y' },
  { command: 'W', description: 'West / Left', playstation: 'Square', xbox: 'X' },
]

const DPAD_BUTTONS: ButtonDefinition[] = [
  { command: 'UP', description: 'D-pad Up', playstation: 'Up', xbox: 'Up' },
  { command: 'DOWN', description: 'D-pad Down', playstation: 'Down', xbox: 'Down' },
  { command: 'LEFT', description: 'D-pad Left', playstation: 'Left', xbox: 'Left' },
  { command: 'RIGHT', description: 'D-pad Right', playstation: 'Right', xbox: 'Right' },
]

const BUMPER_BUTTONS: ButtonDefinition[] = [
  { command: 'L', description: 'Left bumper (L1 / LB)', playstation: 'L1', xbox: 'LB' },
  { command: 'R', description: 'Right bumper (R1 / RB)', playstation: 'R1', xbox: 'RB' },
]

const TRIGGER_BUTTONS: ButtonDefinition[] = [
  { command: 'ZL', description: 'Left trigger soft pull', playstation: 'L2', xbox: 'LT' },
  { command: 'ZLF', description: 'Left trigger full pull', playstation: 'L2 Full', xbox: 'LT Full' },
  { command: 'ZR', description: 'Right trigger soft pull', playstation: 'R2', xbox: 'RT' },
  { command: 'ZRF', description: 'Right trigger full pull', playstation: 'R2 Full', xbox: 'RT Full' },
]

const CENTER_BUTTONS: ButtonDefinition[] = [
  { command: '+', description: 'Options / Menu (plus)', playstation: 'Options', xbox: 'Options' },
  { command: '-', description: 'Share / View (minus)', playstation: 'Share', xbox: 'View' },
  { command: 'MIC', description: 'Microphone button', playstation: 'Mic', xbox: 'Mic' },
]

const TOUCH_BUTTONS: ButtonDefinition[] = [
  { command: 'TOUCH', description: 'Touch contact', playstation: 'Touch', xbox: 'Touch' },
  { command: 'CAPTURE', description: 'Touchpad click', playstation: 'Click', xbox: 'Click' },
]

const LEFT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'LUP', description: 'Left stick up direction', playstation: 'LS Up', xbox: 'LS Up' },
  { command: 'LDOWN', description: 'Left stick down direction', playstation: 'LS Down', xbox: 'LS Down' },
  { command: 'LLEFT', description: 'Left stick left direction', playstation: 'LS Left', xbox: 'LS Left' },
  { command: 'LRIGHT', description: 'Left stick right direction', playstation: 'LS Right', xbox: 'LS Right' },
  { command: 'L3', description: 'Left stick click', playstation: 'L3', xbox: 'LS Click' },
  { command: 'LRING', description: 'Left stick ring binding', playstation: 'L-Ring', xbox: 'L-Ring' },
]

const RIGHT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'RUP', description: 'Right stick up direction', playstation: 'RS Up', xbox: 'RS Up' },
  { command: 'RDOWN', description: 'Right stick down direction', playstation: 'RS Down', xbox: 'RS Down' },
  { command: 'RLEFT', description: 'Right stick left direction', playstation: 'RS Left', xbox: 'RS Left' },
  { command: 'RRIGHT', description: 'Right stick right direction', playstation: 'RS Right', xbox: 'RS Right' },
  { command: 'R3', description: 'Right stick click', playstation: 'R3', xbox: 'RS Click' },
  { command: 'RRING', description: 'Right stick ring binding', playstation: 'R-Ring', xbox: 'R-Ring' },
]

const STICK_MODE_VALUES = [
  'NO_MOUSE',
  'AIM',
  'FLICK',
  'FLICK_ONLY',
  'ROTATE_ONLY',
  'MOUSE_RING',
  'MOUSE_AREA',
  'SCROLL_WHEEL',
  'HYBRID_AIM',
  'INNER_RING',
  'OUTER_RING',
] as const

const STICK_MODE_LABELS: Record<string, string> = {
  NO_MOUSE: 'No Mouse',
  AIM: 'Aim',
  FLICK: 'Flick Stick',
  FLICK_ONLY: 'Flick Only',
  ROTATE_ONLY: 'Rotate Only',
  MOUSE_RING: 'Mouse Ring',
  MOUSE_AREA: 'Mouse Area',
  SCROLL_WHEEL: 'Scroll Wheel',
  HYBRID_AIM: 'Hybrid Aim',
  INNER_RING: 'Inner Ring',
  OUTER_RING: 'Outer Ring',
}

const formatStickModeLabel = (mode: string) => {
  const upper = mode?.toUpperCase()
  if (STICK_MODE_LABELS[upper]) return STICK_MODE_LABELS[upper]
  return upper.replace(/_/g, ' ')
}

const buildStickShiftValue = (target: 'LEFT' | 'RIGHT', mode: string) => `STICK_SHIFT:${target}:${mode}`

const STICK_SHIFT_SPECIAL_OPTIONS = STICK_MODE_VALUES.flatMap(mode => [
  {
    value: buildStickShiftValue('LEFT', mode),
    label: `Stick shift — Left → ${formatStickModeLabel(mode)}`,
  },
  {
    value: buildStickShiftValue('RIGHT', mode),
    label: `Stick shift — Right → ${formatStickModeLabel(mode)}`,
  },
])
const STICK_SHIFT_HEADER_OPTION = { value: 'STICK_SHIFT_HEADER', label: '── Stick mode shifts ──', disabled: true }

const parseStickShiftSelection = (value: string) => {
  const match = /^STICK_SHIFT:(LEFT|RIGHT):([A-Z_]+)$/i.exec(value)
  if (!match) return null
  return { target: match[1].toUpperCase() as 'LEFT' | 'RIGHT', mode: match[2].toUpperCase() }
}

const STICK_AIM_DEFAULTS = {
  sens: '360',
  power: '2',
  accelerationRate: '0',
  accelerationCap: '1000000',
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

const EXTRA_BINDING_SLOTS: BindingSlot[] = ['hold', 'double', 'chord', 'simultaneous']
const MODIFIER_SLOT_TYPES: BindingSlot[] = ['chord', 'simultaneous']
const DEFAULT_STICK_DEADZONE_INNER = '0.15'
const DEFAULT_STICK_DEADZONE_OUTER = '0.10'

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
  adaptiveTriggerValue = '',
  onAdaptiveTriggerChange,
}: KeymapControlsProps) {
  const [layout, setLayout] = useState<ControllerLayout>('playstation')
  const [stickView, setStickView] = useState<'bindings' | 'modes'>('bindings')
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null)
  const [suppressKey, setSuppressKey] = useState<string | null>(null)
  const [manualRows, setManualRows] = useState<Record<string, ManualRowState>>({})
  const [stickShiftDisplayModes, setStickShiftDisplayModes] = useState<Record<string, 'tap' | 'extra'>>({})
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

  const [captureLabel, setCaptureLabel] = useState<string>('')
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
    setStickShiftDisplayModes(prev => {
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
  }, [stickModeShiftAssignments])

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

  const updateStickShiftDisplayMode = (buttonKey: string, mode?: 'tap' | 'extra') => {
    setStickShiftDisplayModes(prev => {
      if (!mode) {
        if (!prev[buttonKey]) return prev
        const next = { ...prev }
        delete next[buttonKey]
        return next
      }
      if (prev[buttonKey] === mode) return prev
      return { ...prev, [buttonKey]: mode }
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
  const doublePressInputValue = Number.isFinite(doublePressWindowSeconds) ? doublePressWindowSeconds : holdPressTimeDefault
  const simPressInputValue = Number.isFinite(simPressWindowSeconds) ? simPressWindowSeconds : holdPressTimeDefault
  const renderGlobalRow = (
    title: string,
    caption: string,
    value: number,
    onChange: (value: string) => void
  ) => (
    <div className="global-control-row" data-capture-ignore="true">
      <div className="global-control-text">
        <span className="global-control-title">{title}</span>
        <span className="global-control-caption">{caption}</span>
      </div>
      <div className="global-control-input-group">
        <input type="number" min="0" max="1" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
        <span className="global-control-unit">seconds</span>
      </div>
    </div>
  )

  const renderButtonCard = (button: ButtonDefinition) => {
    const buttonKey = button.command.toUpperCase()
    const rows = bindingRowsByButton[button.command] ?? []
    const specialKey = specialsByButton[button.command] as keyof typeof SPECIAL_LABELS | undefined
    const tapSpecialLabel = specialKey ? SPECIAL_LABELS[specialKey] ?? '' : ''
    const stickShiftEntries = stickModeShiftAssignments?.[buttonKey] ?? []
    const shiftDisplayMode = stickShiftDisplayModes[buttonKey] ?? 'tap'
    const tapStickShiftEntry = shiftDisplayMode === 'tap' ? stickShiftEntries[0] : undefined
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
          <span className="button-meta">{button.description}</span>
        </div>
        <div className="keymap-binding-controls">
          {rows.map(row => {
            const isCapturing = captureTarget?.button === button.command && captureTarget.slot === row.slot
            const hasExtraRows = rows.length > 1
            const isSpecialValue = Boolean(row.binding && SPECIAL_LABELS[row.binding])
            const displayValue = (() => {
              if (row.slot === 'tap') {
                if (row.binding) return row.binding
                if (tapSpecialLabel) return tapSpecialLabel
                if (tapStickShiftEntry) {
                  return `${tapStickShiftEntry.target === 'LEFT' ? 'Left stick' : 'Right stick'} → ${formatStickModeLabel(tapStickShiftEntry.mode)}`
                }
                return ''
              }
              if (isSpecialValue && row.binding) {
                return SPECIAL_LABELS[row.binding]
              }
              return row.binding || ''
            })()
            const showHeader = row.slot !== 'tap' || hasExtraRows
            const headerLabel = row.slot === 'tap' && hasExtraRows ? 'Regular Press' : row.label
            let rowSpecialOptions = MODIFIER_SLOT_TYPES.includes(row.slot as BindingSlot)
              ? SPECIAL_OPTION_MANUAL_LIST
              : SPECIAL_OPTION_LIST
            if (row.slot === 'tap' && onStickModeShiftChange) {
              rowSpecialOptions = [
                ...rowSpecialOptions,
                STICK_SHIFT_HEADER_OPTION,
                ...STICK_SHIFT_SPECIAL_OPTIONS,
              ]
            }
            const specialValue = (() => {
              if (row.slot === 'tap') {
                if (tapStickShiftEntry) {
                  return buildStickShiftValue(tapStickShiftEntry.target, tapStickShiftEntry.mode)
                }
                if (row.binding && SPECIAL_LABELS[row.binding]) {
                  return row.binding
                }
                return specialKey ?? ''
              }
              if (isSpecialValue && row.binding) {
                return row.binding
              }
              return ''
            })()
            const clearTapSpecialBinding = () => {
              if (row.slot !== 'tap') return
              if (row.binding && SPECIAL_LABELS[row.binding]) {
                onBindingChange(button.command, row.slot, null)
              }
            }
            const clearAllStickShiftAssignments = () => {
              if (!stickShiftEntries.length || !onStickModeShiftChange) return
              stickShiftEntries.forEach(entry => onStickModeShiftChange(button.command, entry.target))
              updateStickShiftDisplayMode(buttonKey, undefined)
            }
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
            const isLegacyFileCall = Boolean(row.binding && /"\s*[^"]+\.(txt|cfg|ini)"/i.test(row.binding))
            return (
              <Fragment key={`${button.command}-${row.slot}-wrapper`}>
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
                    } else if (tapStickShiftEntry) {
                      onStickModeShiftChange?.(button.command, tapStickShiftEntry.target)
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
                    ? (selected) => handleModifierSelection(button.command, row.slot, row, selected)
                    : undefined
                }
                onSpecialChange={
                  row.slot === 'tap'
                    ? (selected) => {
                        if (!selected) {
                          if (specialKey) {
                            onClearSpecialAction(specialKey, button.command)
                          }
                          if (tapStickShiftEntry) {
                            clearAllStickShiftAssignments()
                          }
                          clearTapSpecialBinding()
                          return
                        }
                        if (selected === STICK_SHIFT_HEADER_OPTION.value) {
                          return
                        }
                        const parsedShift = parseStickShiftSelection(selected)
                        if (parsedShift && onStickModeShiftChange) {
                          if (specialKey) {
                            onClearSpecialAction(specialKey, button.command)
                          }
                          clearTapSpecialBinding()
                          stickShiftEntries.forEach(entry => onStickModeShiftChange(button.command, entry.target))
                          onStickModeShiftChange(button.command, parsedShift.target, parsedShift.mode)
                          updateStickShiftDisplayMode(buttonKey, 'tap')
                          return
                        }
                        if (tapStickShiftEntry) {
                          clearAllStickShiftAssignments()
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
                {isLegacyFileCall && (
                  <div className="legacy-binding-warning">
                    Legacy script detected — place the referenced file inside <code>JSM_GUI/bin/</code> or clear this row.
                  </div>
                )}
              </Fragment>
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
                  className="app-select"
                  value=""
                  onChange={(event) => {
                    const selectedValue = event.target.value
                    if (selectedValue === STICK_SHIFT_HEADER_OPTION.value) {
                      event.target.value = ''
                      return
                    }
                    const parsedShift = parseStickShiftSelection(selectedValue)
                    if (parsedShift && onStickModeShiftChange) {
                      onStickModeShiftChange(button.command, parsedShift.target, parsedShift.mode)
                      updateStickShiftDisplayMode(buttonKey, 'extra')
                      event.target.value = ''
                      return
                    }
                    const selected = selectedValue as BindingSlot
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
                  {onStickModeShiftChange && (
                    <>
                      <option value={STICK_SHIFT_HEADER_OPTION.value} disabled>
                        Stick mode shifts
                      </option>
                      {STICK_SHIFT_SPECIAL_OPTIONS.map(option => (
                        <option key={`${button.command}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            )
          })()}
          {stickShiftEntries.length > 0 && (
            <div className="stick-shift-rows">
              {stickShiftEntries.map(entry => {
                const tapDisplaysShift =
                  rows.length === 1 &&
                  rows[0].slot === 'tap' &&
                  !rows[0].binding &&
                  !tapSpecialLabel &&
                  stickShiftEntries.length === 1 &&
                  shiftDisplayMode !== 'extra'
                if (tapDisplaysShift) {
                  return null
                }
                const label = entry.target === 'LEFT' ? 'Left stick mode shift' : 'Right stick mode shift'
                const buttonLabel = `${entry.target === 'LEFT' ? 'Left stick' : 'Right stick'} → ${formatStickModeLabel(entry.mode)}`
                return (
                  <div className="binding-row manual-stick-shift" key={`${button.command}-${entry.target}`}>
                    <div className="binding-row-header">
                      <span>{label}</span>
                    </div>
                    <div className="primary-binding-row">
                      <button type="button" className="binding-input" disabled>
                        {buttonLabel}
                      </button>
                      <button
                        type="button"
                        className="clear-binding-btn"
                        onClick={() => {
                          onStickModeShiftChange?.(button.command, entry.target)
                          if (stickShiftEntries.length === 1) {
                            updateStickShiftDisplayMode(buttonKey, undefined)
                          }
                        }}
                        data-capture-ignore="true"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
  }

  const renderSectionActions = () => (
    <SectionActions
      className="keymap-section-actions"
      hasPendingChanges={hasPendingChanges}
      statusMessage={statusMessage}
      onApply={onApply}
      onCancel={onCancel}
      applyDisabled={isCalibrating}
    />
  )

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage="Keymapping locked while JSM calibrates">
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

      {showFullLayout && (
        <>
          <KeymapSection
            title="Global controls"
            description="Timing windows that apply whenever those binding types are in use."
          >
            <div className="global-controls">
              {renderGlobalRow(
                'Tap vs hold press threshold',
                holdPressTimeIsCustom
                  ? 'Custom HOLD_PRESS_TIME saved'
                  : `Using default (${Math.round(holdPressTimeDefault * 1000)} ms)`,
                holdPressTimeInputValue,
                onHoldPressTimeChange
              )}
              {renderGlobalRow(
                'Double press window',
                doublePressWindowIsCustom
                  ? 'Custom DBL_PRESS_WINDOW saved'
                  : `Using default (${Math.round(holdPressTimeDefault * 1000)} ms)`,
                doublePressInputValue,
                onDoublePressWindowChange
              )}
              {renderGlobalRow(
                'Simultaneous press window',
                simPressWindowIsCustom
                  ? 'Custom SIM_PRESS_WINDOW saved'
                  : `Using default (${Math.round(holdPressTimeDefault * 1000)} ms)`,
                simPressInputValue,
                onSimPressWindowChange
              )}
              {renderGlobalRow(
                'Trigger threshold',
                triggerThreshold > 0 ? `Custom TRIGGER_THRESHOLD = ${triggerThreshold.toFixed(2)}` : 'Default (0.00)',
                triggerThreshold,
                onTriggerThresholdChange
              )}
            </div>
          </KeymapSection>
          {renderSectionActions()}

          <KeymapSection
            title="Face Buttons"
            description="Tap / Hold / Double / Chorded / Simultaneous bindings available via Add Extra Binding."
          >
            <div className="keymap-grid">{FACE_BUTTONS.map(renderButtonCard)}</div>
          </KeymapSection>
          {renderSectionActions()}

          <KeymapSection
            title="D-pad"
            description="Directional pad bindings with the same extra slots and special actions."
          >
            <div className="keymap-grid">{DPAD_BUTTONS.map(renderButtonCard)}</div>
          </KeymapSection>
          {renderSectionActions()}

          <KeymapSection title="Bumpers" description="L1/R1 bindings with the usual specials and extra slots.">
            <div className="keymap-grid">{BUMPER_BUTTONS.map(renderButtonCard)}</div>
          </KeymapSection>
          {renderSectionActions()}

          <KeymapSection title="Triggers" description="Soft/full pulls and threshold toggles for L2/R2.">
            <div className="keymap-grid">
              {TRIGGER_BUTTONS.map(renderButtonCard)}
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
            </div>
          </KeymapSection>
          {renderSectionActions()}
        </>
      )}
      {showFullLayout && (
        <>
          <KeymapSection title="Center buttons" description="Options, Share, and Mic bindings.">
            <div className="keymap-grid">{CENTER_BUTTONS.map(renderButtonCard)}</div>
          </KeymapSection>
          {renderSectionActions()}
        </>
      )}

      {showStickLayout && (
        <>
          <div className="mode-toggle stick-subtabs">
            <button className={`pill-tab ${stickView === 'bindings' ? 'active' : ''}`} onClick={() => setStickView('bindings')}>
              Bindings
            </button>
            <button className={`pill-tab ${stickView === 'modes' ? 'active' : ''}`} onClick={() => setStickView('modes')}>
              Modes & Settings
            </button>
          </div>
          {stickView === 'bindings' ? (
            <>
              <KeymapSection
                title="Left stick"
                description="Bind directions, ring, or stick click with the same extra slots available elsewhere."
              >
                <div className="keymap-grid">{LEFT_STICK_BUTTONS.map(renderButtonCard)}</div>
              </KeymapSection>
              {renderSectionActions()}
              <KeymapSection title="Right stick" description="Configure the right stick directions, ring binding, or stick click.">
                <div className="keymap-grid">{RIGHT_STICK_BUTTONS.map(renderButtonCard)}</div>
              </KeymapSection>
              {renderSectionActions()}
            </>
          ) : (
              <>
                <StickSettingsCard
                  title="Left stick"
                  innerValue={leftDeadzoneValues.inner}
                  outerValue={leftDeadzoneValues.outer}
                  defaultInner={deadzoneDefaults.inner}
                  defaultOuter={deadzoneDefaults.outer}
                  modeValue={leftStickModes.mode}
                  ringValue={leftStickModes.ring}
                  onModeChange={(value) => onStickModeChange?.('LEFT', value)}
                  onRingChange={(value) => onRingModeChange?.('LEFT', value)}
                  disabled={isCalibrating}
                  onInnerChange={(value) => onStickDeadzoneChange?.('LEFT', 'INNER', value)}
                  onOuterChange={(value) => onStickDeadzoneChange?.('LEFT', 'OUTER', value)}
                  modeExtras={
                    stickModeSettings?.left.mode === 'AIM' && stickAimSettings && stickAimHandlers ? (
                      <StickAimSettings values={stickAimSettings} handlers={stickAimHandlers} disabled={isCalibrating} />
                    ) : null
                  }
                />
                {renderSectionActions()}
                <StickSettingsCard
                  title="Right stick"
                  innerValue={rightDeadzoneValues.inner}
                  outerValue={rightDeadzoneValues.outer}
                  defaultInner={deadzoneDefaults.inner}
                  defaultOuter={deadzoneDefaults.outer}
                  modeValue={rightStickModes.mode}
                  ringValue={rightStickModes.ring}
                  onModeChange={(value) => onStickModeChange?.('RIGHT', value)}
                  onRingChange={(value) => onRingModeChange?.('RIGHT', value)}
                  disabled={isCalibrating}
                  onInnerChange={(value) => onStickDeadzoneChange?.('RIGHT', 'INNER', value)}
                  onOuterChange={(value) => onStickDeadzoneChange?.('RIGHT', 'OUTER', value)}
                  modeExtras={
                    stickModeSettings?.right.mode === 'AIM' && stickAimSettings && stickAimHandlers ? (
                      <StickAimSettings values={stickAimSettings} handlers={stickAimHandlers} disabled={isCalibrating} />
                    ) : null
                  }
                />
              {renderSectionActions()}
            </>
          )}
        </>
      )}

      {view === 'touchpad' && (
        <>
          <KeymapSection title="Touch and click buttons" description="Bindings for touch contact and pad click.">
            <div className="keymap-grid">{TOUCH_BUTTONS.map(renderButtonCard)}</div>
          </KeymapSection>
          {renderSectionActions()}
          <KeymapSection title="Touchpad mode and grid" description="Adjust mode, grid size, and sensitivity for the touchpad.">
            <div className="touchpad-settings">
              <label>
                Mode
                <select className="app-select" value={touchpadMode} onChange={(event) => onTouchpadModeChange?.(event.target.value)}>
                  <option value="">None selected</option>
                  <option value="GRID_AND_STICK">Grid and Stick</option>
                  <option value="MOUSE">Mouse</option>
                </select>
              </label>
              {touchpadMode === 'GRID_AND_STICK' && (
                <>
                  <div className="grid-size-inputs">
                    <label>
                      Columns
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={gridColumns}
                        onChange={(event) => onGridSizeChange?.(Number(event.target.value) || 1, gridRows)}
                      />
                    </label>
                    <label>
                      Rows
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={gridRows}
                        onChange={(event) => onGridSizeChange?.(gridColumns, Number(event.target.value) || 1)}
                      />
                    </label>
                  </div>
                  <small className="grid-limit-hint">Columns × Rows cannot exceed 25 total regions.</small>
                </>
              )}
              {touchpadMode === 'MOUSE' && (
                <label>
                  Touchpad sensitivity
                  <input
                    type="number"
                    step="0.1"
                    value={touchpadSensitivity ?? ''}
                    onChange={(event) => onTouchpadSensitivityChange?.(event.target.value)}
                    placeholder="Default"
                  />
                </label>
              )}
            </div>
          </KeymapSection>
          {touchpadMode === 'GRID_AND_STICK' && (
            <KeymapSection
              title="Touchpad grid"
              description="This preview mirrors the touchpad. Configure each region using the rows below."
            >
              <div className="touchpad-grid-preview" style={{ gridTemplateColumns: `repeat(${clampedGridCols}, 1fr)` }}>
                {Array.from({ length: clampedGridCells }).map((_, index) => {
                  const rowIndex = Math.floor(index / clampedGridCols)
                  const colIndex = index % clampedGridCols
                  return (
                    <div className="touchpad-grid-cell" key={`cell-${index}`}>
                      <span>T{index + 1}</span>
                      <small>
                        Row {rowIndex + 1}, Col {colIndex + 1}
                      </small>
                    </div>
                  )
                })}
              </div>
              <div
                className="touchpad-binding-list"
                data-touchpad-binding-list
              >
                <div className="keymap-grid">{touchpadGridButtons.map(renderButtonCard)}</div>
              </div>
            </KeymapSection>
          )}
          {renderSectionActions()}
        </>
      )}

    </Card>
  )
}
