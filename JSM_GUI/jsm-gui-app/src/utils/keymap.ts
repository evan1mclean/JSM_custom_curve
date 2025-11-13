export interface SensitivityValues {
  inGameSens?: number
  realWorldCalibration?: number
  minSensX?: number
  minSensY?: number
  maxSensX?: number
  maxSensY?: number
  minThreshold?: number
  maxThreshold?: number
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
  const minSens = get('MIN_GYRO_SENS', 2)
  const maxSens = get('MAX_GYRO_SENS', 2)

  return {
    inGameSens: single('IN_GAME_SENS'),
    realWorldCalibration: single('REAL_WORLD_CALIBRATION'),
    minSensX: minSens[0],
    minSensY: minSens[1],
    maxSensX: maxSens[0],
    maxSensY: maxSens[1],
    minThreshold: single('MIN_GYRO_THRESHOLD'),
    maxThreshold: single('MAX_GYRO_THRESHOLD'),
  }
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
