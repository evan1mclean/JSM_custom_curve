import { useEffect, useMemo, useState } from 'react'
import { Card } from './Card'
import { BindingSlot, ButtonBindingRow, getButtonBindingRows, getKeymapValue } from '../utils/keymap'
import { BindingRow } from './BindingRow'

type ControllerLayout = 'playstation' | 'xbox'

type KeymapControlsProps = {
  configText: string
  hasPendingChanges: boolean
  isCalibrating: boolean
  onApply: () => void
  onCancel: () => void
  onBindingChange: (button: string, slot: BindingSlot, value: string | null) => void
  onAssignSpecialAction: (special: string, buttonCommand: string) => void
  onClearSpecialAction: (special: string, buttonCommand: string) => void
  trackballDecay: string
  onTrackballDecayChange: (value: string) => void
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

type CaptureTarget = { button: string; slot: BindingSlot }

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
}: KeymapControlsProps) {
  const [layout, setLayout] = useState<ControllerLayout>('playstation')
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null)
  const [suppressKey, setSuppressKey] = useState<string | null>(null)
  const [manualRows, setManualRows] = useState<Record<string, BindingSlot[]>>({})

  const bindingRowsByButton = useMemo(() => {
    const record: Record<string, ButtonBindingRow[]> = {}
    FACE_BUTTONS.forEach(({ command }) => {
      record[command] = getButtonBindingRows(configText, command, manualRows[command] ?? [])
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
        onBindingChange(captureTarget.button, captureTarget.slot, value)
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

  const beginCapture = (button: string, slot: BindingSlot) => {
    const key = `${button}-${slot}`
    if (suppressKey === key) {
      setSuppressKey(null)
      return
    }
    setCaptureLabel(slot === 'hold' ? 'Press and hold binding…' : 'Press any key or mouse button…')
    setCaptureTarget({ button, slot })
  }

  const cancelCapture = () => {
    setCaptureTarget(null)
    setSuppressKey(null)
  }

  const ensureManualRow = (button: string, slot: BindingSlot) => {
    setManualRows(prev => {
      const existing = new Set(prev[button] ?? [])
      if (existing.has(slot)) return prev
      existing.add(slot)
      return { ...prev, [button]: Array.from(existing) }
    })
  }

  const removeManualRow = (button: string, slot: BindingSlot) => {
    setManualRows(prev => {
      const existing = new Set(prev[button] ?? [])
      if (!existing.has(slot)) return prev
      existing.delete(slot)
      if (existing.size === 0) {
        const next = { ...prev }
        delete next[button]
        return next
      }
      return { ...prev, [button]: Array.from(existing) }
    })
  }

  const trackballSliderValue = trackballDecay && !Number.isNaN(Number(trackballDecay)) ? Number(trackballDecay) : 1

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
                    const rowSpecialOptions = SPECIAL_OPTION_LIST
                    const specialValue =
                      row.slot === 'tap'
                        ? specialKey ?? ''
                        : isSpecialValue && row.binding
                          ? row.binding
                          : ''
                    return (
                      <BindingRow
                        key={`${button.command}-${row.slot}`}
                        label={headerLabel}
                        showHeader={showHeader}
                        displayValue={displayValue}
                        isManual={row.isManual}
                        isCapturing={isCapturing}
                        captureLabel={captureLabel}
                        onBeginCapture={() => beginCapture(button.command, row.slot)}
                        onCancelCapture={cancelCapture}
                        onClear={() => {
                          if (row.slot === 'tap') {
                            if (row.binding) {
                              onBindingChange(button.command, row.slot, null)
                            } else if (specialKey) {
                              onClearSpecialAction(specialKey, button.command)
                            }
                          } else {
                            onBindingChange(button.command, row.slot, null)
                          }
                        }}
                        onRemoveRow={row.isManual ? () => removeManualRow(button.command, row.slot) : undefined}
                        disableClear={!displayValue}
                        specialOptions={rowSpecialOptions}
                        specialValue={specialValue}
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
                                    onBindingChange(button.command, row.slot, null)
                                  }
                                  return
                                }
                                onBindingChange(button.command, row.slot, selected)
                                ensureManualRow(button.command, row.slot)
                              }
                        }
                      />
                    )
                  })}
                  {(() => {
                    const availableSlots = (['hold', 'double'] as BindingSlot[]).filter(slot => !existingSlots.has(slot))
                    if (rows.length > 1 || availableSlots.length === 0) {
                      return null
                    }
                    return (
                      <div className="binding-row add-binding-row" data-capture-ignore="true">
                        <select
                          value=""
                          onChange={(event) => {
                            const selected = event.target.value as BindingSlot
                            if (selected) {
                              ensureManualRow(button.command, selected)
                            }
                            event.target.value = ''
                          }}
                        >
                          <option value="">Add extra binding</option>
                          {availableSlots.map(slot => (
                            <option key={`${button.command}-${slot}-opt`} value={slot}>
                              {slot === 'hold' ? 'Hold (press & hold)' : 'Double press'}
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
