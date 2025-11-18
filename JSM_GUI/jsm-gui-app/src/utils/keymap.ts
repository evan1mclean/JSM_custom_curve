export interface SensitivityValues {
  inGameSens?: number
  realWorldCalibration?: number
  minSensX?: number
  minSensY?: number
  maxSensX?: number
  maxSensY?: number
  minThreshold?: number
  maxThreshold?: number
  gyroSensX?: number
  gyroSensY?: number
  cutoffSpeed?: number
  cutoffRecovery?: number
  smoothTime?: number
  smoothThreshold?: number
  gyroSpace?: string
  gyroAxisX?: string
  gyroAxisY?: string
  tickTime?: number
}

const escapeKey = (key: string) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const LINE_REGEX = (key: string) => new RegExp(`^\\s*${escapeKey(key)}\\s*=\\s*(.+)$`, 'im')

function parseNumbers(value?: string, limit = Infinity) {
  if (!value) return []
  return value
    .trim()
    .split(/\s+/)
    .slice(0, limit)
    .map(token => parseFloat(token))
    .filter(num => Number.isFinite(num))
}

export function parseSensitivityValues(text: string, options?: { prefix?: string }): SensitivityValues {
  const keyWithPrefix = (key: string) => {
    if (!options?.prefix) return key
    return `${options.prefix}${key}`
  }
  const get = (key: string, limit = Infinity) => {
    const match = text.match(LINE_REGEX(keyWithPrefix(key)))
    return parseNumbers(match?.[1], limit)
  }
  const single = (key: string) => get(key, 1)[0]
  const raw = (key: string) => {
    const match = text.match(LINE_REGEX(keyWithPrefix(key)))
    return match?.[1]?.trim()
  }
  const minSens = get('MIN_GYRO_SENS', 2)
  const maxSens = get('MAX_GYRO_SENS', 2)
  const staticSens = get('GYRO_SENS', 2)

  const result: SensitivityValues = {
    inGameSens: single('IN_GAME_SENS'),
    realWorldCalibration: single('REAL_WORLD_CALIBRATION'),
    minSensX: minSens[0],
    minSensY: minSens[1],
    maxSensX: maxSens[0],
    maxSensY: maxSens[1],
    minThreshold: single('MIN_GYRO_THRESHOLD'),
    maxThreshold: single('MAX_GYRO_THRESHOLD'),
    gyroSensX: staticSens[0],
    gyroSensY: staticSens[1],
    cutoffSpeed: single('GYRO_CUTOFF_SPEED'),
    cutoffRecovery: single('GYRO_CUTOFF_RECOVERY'),
    smoothTime: single('GYRO_SMOOTH_TIME'),
    smoothThreshold: single('GYRO_SMOOTH_THRESHOLD'),
    gyroSpace: raw('GYRO_SPACE'),
    gyroAxisX: raw('GYRO_AXIS_X'),
    gyroAxisY: raw('GYRO_AXIS_Y'),
    tickTime: single('TICK_TIME'),
  }

  if (result.gyroSensX !== undefined) {
    result.minSensX = result.minSensX ?? result.gyroSensX
    result.maxSensX = result.maxSensX ?? result.gyroSensX
    if (result.minThreshold === undefined) {
      result.minThreshold = 0
    }
    if (result.maxThreshold === undefined) {
      result.maxThreshold = 50
    }
  }
  if (result.gyroSensY !== undefined) {
    result.minSensY = result.minSensY ?? result.gyroSensY
    result.maxSensY = result.maxSensY ?? result.gyroSensY
  }
  return result
}

function formatNumber(value: number | undefined, fractionDigits = 4) {
  if (!Number.isFinite(value)) return ''
  const fixed = value!.toFixed(fractionDigits)
  return fixed.replace(/\.?0+$/, '')
}

export function updateKeymapEntry(text: string, key: string, values: Array<number | string>) {
  const formatted = values
    .filter(v => v !== undefined && v !== null && `${v}`.length > 0)
    .map(v => (typeof v === 'number' ? formatNumber(v) : `${v}`.trim()))
    .join(' ')

  const nextLine = `${key} = ${formatted}`
  const lines = text.split(/\r?\n/)
  const index = lines.findIndex(line => line.trim().toUpperCase().startsWith(`${key.toUpperCase()} =`))
  if (index >= 0) {
    lines[index] = nextLine
  } else {
    lines.push(nextLine)
  }
  return lines.join('\n')
}

export function removeKeymapEntry(text: string, key: string) {
  const lines = text.split(/\r?\n/)
  const pattern = new RegExp(`^\\s*${escapeKey(key)}\\s*=`, 'i')
  const index = lines.findIndex(line => pattern.test(line))
  if (index >= 0) {
    lines.splice(index, 1)
  }
  return lines.join('\n')
}

export function getKeymapValue(text: string, key: string) {
  const match = text.match(LINE_REGEX(key))
  return match?.[1]?.trim()
}

export type BindingSlot = 'tap' | 'hold' | 'double' | 'chord' | 'simultaneous'

export type ButtonBindingSet = {
  tap?: string
  hold?: string
  double?: string
}

export type ButtonBindingRow = {
  slot: BindingSlot
  label: string
  binding: string | null
  isManual: boolean
  modifierCommand?: string
}

export type ManualRowInfo = {
  modifierCommand?: string
}

export type ManualRowState = Partial<Record<BindingSlot, ManualRowInfo>>

const SLOT_LABELS: Record<BindingSlot, string> = {
  tap: 'Tap',
  hold: 'Hold (press & hold)',
  double: 'Double Press',
  chord: 'Chorded Press',
  simultaneous: 'Simultaneous Press',
}

const FACE_BUTTONS = ['S', 'E', 'N', 'W'] as const

function parseBaseBinding(value?: string) {
  const tapHold: { tap?: string; hold?: string } = {}
  if (!value) return tapHold
  const parts = value.trim().split(/\s+/)
  if (parts[0] && parts[0].toUpperCase() !== 'NONE') {
    tapHold.tap = parts[0]
  }
  if (parts[1]) {
    tapHold.hold = parts[1]
  }
  return tapHold
}

function writeBaseBinding(text: string, button: string, tap?: string, hold?: string) {
  const values: string[] = []
  if (tap) {
    values.push(tap)
  } else if (hold) {
    values.push('NONE')
  }
  if (hold) values.push(hold)
  if (values.length === 0) {
    return removeKeymapEntry(text, button)
  }
  return updateKeymapEntry(text, button, values)
}

export function getButtonBindingSet(text: string, button: string): ButtonBindingSet {
  const base = parseBaseBinding(getKeymapValue(text, button))
  const doubleValue = getKeymapValue(text, `${button},${button}`)?.split(/\s+/)[0]
  return {
    tap: base.tap,
    hold: base.hold,
    double: doubleValue,
  }
}

export function setTapBinding(text: string, button: string, value?: string | null) {
  const current = getButtonBindingSet(text, button)
  const tapValue = value?.trim() ? value.trim() : undefined
  return writeBaseBinding(text, button, tapValue, current.hold)
}

export function setHoldBinding(text: string, button: string, value?: string | null) {
  const current = getButtonBindingSet(text, button)
  const holdValue = value?.trim() ? value.trim() : undefined
  return writeBaseBinding(text, button, current.tap, holdValue)
}

export function setDoubleBinding(text: string, button: string, value?: string | null) {
  const target = `${button},${button}`
  const trimmed = value?.trim()
  if (!trimmed) {
    return removeKeymapEntry(text, target)
  }
  return updateKeymapEntry(text, target, [trimmed])
}

type ComboBinding = {
  modifier: string
  binding: string
}

function parseComboBinding(text: string, button: string, separator: '+' | ','): ComboBinding | null {
  const target = button.toUpperCase()
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [rawKey, rawValue] = trimmed.split('=')
    if (!rawValue) continue
    const key = rawKey.trim().toUpperCase()
    const value = rawValue.trim()
    const parts = key.split(separator)
    if (parts.length !== 2) continue
    const [left, right] = parts.map(part => part.trim())
    if (right !== target) continue
    const bindingValue = value.split(/\s+/)[0]
    if (!bindingValue) continue
    return { modifier: left, binding: bindingValue }
  }
  return null
}

function setComboBinding(
  text: string,
  button: string,
  modifier: string | undefined,
  separator: '+' | ',',
  value?: string | null
) {
  if (!modifier) return text
  const key = `${modifier}${separator}${button}`
  const trimmed = value?.trim()
  if (!trimmed) {
    return removeKeymapEntry(text, key)
  }
  return updateKeymapEntry(text, key, [trimmed])
}

export function setChordBinding(text: string, button: string, modifier: string | undefined, value?: string | null) {
  return setComboBinding(text, button, modifier, ',', value)
}

export function setSimultaneousBinding(text: string, button: string, modifier: string | undefined, value?: string | null) {
  return setComboBinding(text, button, modifier, '+', value)
}

export function getButtonBindingRows(
  text: string,
  button: string,
  manualState: ManualRowState = {}
): ButtonBindingRow[] {
  const bindings = getButtonBindingSet(text, button)
  const rows: ButtonBindingRow[] = [
    {
      slot: 'tap',
      label: SLOT_LABELS.tap,
      binding: bindings.tap ?? null,
      isManual: false,
    },
  ]
  ;(['hold', 'double'] as BindingSlot[]).forEach(slot => {
    const bindingValue = slot === 'hold' ? bindings.hold : bindings.double
    const manualInfo = manualState[slot]
    if (bindingValue || manualInfo) {
      rows.push({
        slot,
        label: SLOT_LABELS[slot],
        binding: bindingValue ?? null,
        isManual: Boolean(manualInfo),
      })
    }
  })
const chordBinding = parseComboBinding(text, button, ',')
  const chordManual = manualState['chord']
  if (chordBinding || chordManual) {
    rows.push({
      slot: 'chord',
      label: SLOT_LABELS.chord,
      binding: chordBinding?.binding ?? null,
      isManual: Boolean(chordManual),
      modifierCommand: chordBinding?.modifier ?? chordManual?.modifierCommand,
    })
  }
const simultaneousBinding = parseComboBinding(text, button, '+')
  const simultaneousManual = manualState['simultaneous']
  if (simultaneousBinding || simultaneousManual) {
    rows.push({
      slot: 'simultaneous',
      label: SLOT_LABELS.simultaneous,
      binding: simultaneousBinding?.binding ?? null,
      isManual: Boolean(simultaneousManual),
      modifierCommand: simultaneousBinding?.modifier ?? simultaneousManual?.modifierCommand,
    })
  }
  return rows
}

export function isTrackballBindingPresent(text: string) {
  const trackballSpecials = ['GYRO_TRACKBALL', 'GYRO_TRACK_X', 'GYRO_TRACK_Y']
  const hasSpecial = trackballSpecials.some(cmd => Boolean(getKeymapValue(text, cmd)))
  if (hasSpecial) return true
  return FACE_BUTTONS.some(button => {
    const bindings = getButtonBindingSet(text, button)
    return Boolean(bindings.tap?.toUpperCase().includes('TRACK') || bindings.hold?.toUpperCase().includes('TRACK') || bindings.double?.toUpperCase().includes('TRACK'))
  })
}
