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

export function keyboardEventToBinding(event: KeyboardEvent): string | null {
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

export function mouseButtonToBinding(button: number): string | null {
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

export function wheelEventToBinding(deltaY: number): string | null {
  if (deltaY < 0) return 'SCROLLUP'
  if (deltaY > 0) return 'SCROLLDOWN'
  return null
}

export const shouldIgnoreCapture = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target) return false
  return Boolean(target.closest('[data-capture-ignore="true"]'))
}

export const TRACKBALL_SPECIALS = new Set(['GYRO_TRACKBALL', 'GYRO_TRACK_X', 'GYRO_TRACK_Y'])
