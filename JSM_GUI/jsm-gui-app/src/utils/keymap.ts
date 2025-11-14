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

const LINE_REGEX = (key: string) => new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'im')

function parseNumbers(value?: string, limit = Infinity) {
  if (!value) return []
  return value
    .trim()
    .split(/\s+/)
    .slice(0, limit)
    .map(token => parseFloat(token))
    .filter(num => Number.isFinite(num))
}

export function parseSensitivityValues(text: string): SensitivityValues {
  const get = (key: string, limit = Infinity) => {
    const match = text.match(LINE_REGEX(key))
    return parseNumbers(match?.[1], limit)
  }
  const single = (key: string) => get(key, 1)[0]
  const raw = (key: string) => {
    const match = text.match(LINE_REGEX(key))
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
  }
  if (result.gyroSensY !== undefined) {
    result.minSensY = result.minSensY ?? result.gyroSensY
    result.maxSensY = result.maxSensY ?? result.gyroSensY
  }
  if (result.minThreshold === undefined) {
    result.minThreshold = 0
  }
  if (result.maxThreshold === undefined) {
    result.maxThreshold = 0
  }
  if (result.cutoffSpeed === undefined) {
    result.cutoffSpeed = 0
  }
  if (result.cutoffRecovery === undefined) {
    result.cutoffRecovery = 0
  }
  if (result.smoothTime === undefined) {
    result.smoothTime = 0
  }
  if (result.smoothThreshold === undefined) {
    result.smoothThreshold = 0
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
  const index = lines.findIndex(line => line.trim().toUpperCase().startsWith(`${key.toUpperCase()} =`))
  if (index >= 0) {
    lines.splice(index, 1)
  }
  return lines.join('\n')
}

export function getKeymapValue(text: string, key: string) {
  const match = text.match(LINE_REGEX(key))
  return match?.[1]?.trim()
}
