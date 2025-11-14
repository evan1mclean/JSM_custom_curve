import { useEffect, useMemo, useState } from 'react'
import { Card } from './Card'
import { getKeymapValue } from '../utils/keymap'

type ControllerLayout = 'playstation' | 'xbox'

type KeymapControlsProps = {
  configText: string
  hasPendingChanges: boolean
  isCalibrating: boolean
  onApply: () => void
  onCancel: () => void
  onUpdateBinding: (command: string, binding: string) => void
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

const SPECIAL_BINDINGS = [
  { value: '', label: 'Special actions…' },
  { value: 'GYRO_OFF', label: 'Hold to disable gyro' },
  { value: 'GYRO_ON', label: 'Hold to enable gyro' },
  { value: 'GYRO_INVERT', label: 'Invert gyro direction (both axes)' },
  { value: 'GYRO_INV_X', label: 'Invert gyro X axis' },
  { value: 'GYRO_INV_Y', label: 'Invert gyro Y axis' },
  { value: 'GYRO_TRACKBALL', label: 'Trackball mode (hold to engage)' },
  { value: 'GYRO_TRACK_X', label: 'Trackball mode — X axis' },
  { value: 'GYRO_TRACK_Y', label: 'Trackball mode — Y axis' },
]

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
const SPECIAL_COMMAND_KEYS = SPECIAL_BINDINGS.map(option => option.value).filter(Boolean) as string[]
type BindingState = { display: string; source: 'direct' | 'special' | 'none'; specialCommand?: string }

export function KeymapControls({
  configText,
  hasPendingChanges,
  isCalibrating,
  onApply,
  onCancel,
  onUpdateBinding,
  onAssignSpecialAction,
  onClearSpecialAction,
  trackballDecay,
  onTrackballDecayChange,
}: KeymapControlsProps) {
  const [layout, setLayout] = useState<ControllerLayout>('playstation')
  const [capturingCommand, setCapturingCommand] = useState<string | null>(null)
  const [suppressClickFor, setSuppressClickFor] = useState<string | null>(null)

  const faceBindings = useMemo(() => {
    const values: Record<string, BindingState> = {}
    FACE_BUTTONS.forEach(button => {
      const direct = getKeymapValue(configText, button.command)
      if (direct) {
        values[button.command] = { display: direct, source: 'direct' }
        return
      }
      const special = SPECIAL_COMMAND_KEYS.find(key => {
        const assignment = getKeymapValue(configText, key)
        if (!assignment) return false
        return assignment
          .split(/\s+/)
          .filter(Boolean)
          .some(token => token.toUpperCase() === button.command.toUpperCase())
      })
      if (special) {
        values[button.command] = {
          display: SPECIAL_LABELS[special] ?? special,
          source: 'special',
          specialCommand: special,
        }
        return
      }
      values[button.command] = { display: '', source: 'none' }
    })
    return values
  }, [configText])

  const trackballBinding = useMemo(() => {
    const special = SPECIAL_COMMAND_KEYS.find(key => key.startsWith('GYRO_TRACK') && getKeymapValue(configText, key))
    if (special) {
      return special
    }
    return FACE_BUTTONS.find(button => {
      const direct = getKeymapValue(configText, button.command)
      return direct?.toUpperCase().includes('TRACK') ?? false
    })?.command
  }, [configText])

  useEffect(() => {
    if (!capturingCommand) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreCapture(event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const binding = keyboardEventToBinding(event)
      if (binding) {
        onUpdateBinding(capturingCommand, binding)
        setCapturingCommand(null)
        setSuppressClickFor(null)
      }
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (shouldIgnoreCapture(event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const binding = mouseButtonToBinding(event.button)
      if (binding) {
        onUpdateBinding(capturingCommand, binding)
        setCapturingCommand(null)
        setSuppressClickFor(capturingCommand)
      }
    }
    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnoreCapture(event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const binding = wheelEventToBinding(event.deltaY)
      if (binding) {
        onUpdateBinding(capturingCommand, binding)
        setCapturingCommand(null)
        setSuppressClickFor(null)
      }
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
  }, [capturingCommand, onUpdateBinding])

  const beginCapture = (command: string) => {
    if (capturingCommand === command) return
    setSuppressClickFor(null)
    setCapturingCommand(command)
  }

  const cancelCapture = () => {
    setCapturingCommand(null)
    setSuppressClickFor(null)
  }

  const handleBindingButtonClick = (command: string) => {
    if (suppressClickFor === command) {
      setSuppressClickFor(null)
      return
    }
    beginCapture(command)
  }

  const trackballSliderValue =
    trackballDecay && !Number.isNaN(Number(trackballDecay)) ? Number(trackballDecay) : 1

  return (
    <Card className="control-panel" lockable locked={isCalibrating} lockMessage="Keymapping locked while JSM calibrates">
      <div className="keymap-card-header">
        <h2>Keymap Controls</h2>
        <div className="mode-toggle">
          <button
            className={`pill-tab ${layout === 'playstation' ? 'active' : ''}`}
            onClick={() => setLayout('playstation')}
          >
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
            <p>Map the primary face buttons to keyboard/mouse bindings.</p>
          </div>
        </div>
        <div className="keymap-grid">
          {FACE_BUTTONS.map(button => {
            const label = layout === 'playstation' ? button.playstation : button.xbox
            const isCapturing = capturingCommand === button.command
            const bindingState = faceBindings[button.command] ?? { display: '', source: 'none' }
            const value = bindingState.display
            const hasBinding = bindingState.source !== 'none'
            const showTrackballControls = Boolean(
              (trackballBinding &&
                bindingState.source === 'special' &&
                bindingState.specialCommand?.startsWith('GYRO_TRACK')) ||
                trackballBinding === button.command
            )
            return (
              <div className={`keymap-row ${isCapturing ? 'capturing' : ''}`} key={button.command}>
                <div className="keymap-label">
                  <span className="button-name">{label}</span>
                  <span className="button-meta">{button.description} · Command {button.command}</span>
                </div>
                <div className="keymap-binding-controls">
                  <div className="binding-actions" data-capture-ignore="true">
                    <div className="binding-actions-group">
                      <select
                        value=""
                        onChange={(event) => {
                          const select = event.target as HTMLSelectElement
                          const special = select.value
                          if (special) {
                            onAssignSpecialAction(special, button.command)
                          }
                          select.value = ''
                        }}
                      >
                        {SPECIAL_BINDINGS.map(option => (
                          <option key={option.value || 'placeholder'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {isCapturing && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={cancelCapture}
                          data-capture-ignore="true"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="primary-binding-row">
                    <button
                      type="button"
                      className={`binding-input ${isCapturing ? 'recording' : ''}`}
                      onClick={() => handleBindingButtonClick(button.command)}
                    >
                      {isCapturing ? 'Press any key or mouse button…' : value || 'Click to set binding'}
                    </button>
                    <button
                      type="button"
                      className="clear-binding-btn"
                      onClick={() => {
                        if (bindingState.source === 'special' && bindingState.specialCommand) {
                          onClearSpecialAction(bindingState.specialCommand, button.command)
                        } else {
                          onUpdateBinding(button.command, '')
                        }
                      }}
                      disabled={!hasBinding}
                      data-capture-ignore="true"
                    >
                      Clear Binding
                    </button>
                  </div>
                  {showTrackballControls && (
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
