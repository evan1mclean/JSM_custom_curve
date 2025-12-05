const REQUIRED_HEADER_LINES = [
  { pattern: /^RESET_MAPPINGS\b/i, value: 'RESET_MAPPINGS' },
  { pattern: /^TELEMETRY_ENABLED\b/i, value: 'TELEMETRY_ENABLED = ON' },
  { pattern: /^TELEMETRY_PORT\b/i, value: 'TELEMETRY_PORT = 8974' },
]

const CALIBRATION_PATTERNS = [
  /^RESET_MAPPINGS\b/i,
  /^TELEMETRY_ENABLED\b/i,
  /^TELEMETRY_PORT\b/i,
  /^RESTART_GYRO_CALIBRATION\b/i,
  /^FINISH_GYRO_CALIBRATION\b/i,
  /^SLEEP\b/i,
  /^COUNTER_OS_MOUSE_SPEED\b/i,
]

export const ensureHeaderLines = (text: string) => {
  const lines = text.split(/\r?\n/)
  const remaining: string[] = []
  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) {
      remaining.push(line)
      return
    }
    if (REQUIRED_HEADER_LINES.some(entry => entry.pattern.test(trimmed))) {
      return
    }
    remaining.push(line)
  })
  const header = REQUIRED_HEADER_LINES.map(entry => entry.value)
  const rest = remaining.join('\n').trimStart()
  return rest ? `${header.join('\n')}\n${rest}` : header.join('\n')
}

export const sanitizeImportedConfig = (rawText: string) => {
  const withoutComments = rawText
    .split(/\r?\n/)
    .map(line => {
      const hashIndex = line.indexOf('#')
      const withoutHash = hashIndex >= 0 ? line.slice(0, hashIndex) : line
      return withoutHash.trim()
    })
    .filter(line => line.length > 0 && !CALIBRATION_PATTERNS.some(pattern => pattern.test(line)))
    .join('\n')

  return ensureHeaderLines(withoutComments)
}

export const upsertFlagCommand = (text: string, key: string, enabled: boolean) => {
  const lines = text.split(/\r?\n/).filter(line => {
    const trimmed = line.trim().toUpperCase()
    if (!trimmed) return true
    return !(trimmed === key.toUpperCase() || trimmed.startsWith(`${key.toUpperCase()} `) || trimmed.startsWith(`${key.toUpperCase()}=`))
  })
  if (enabled) {
    lines.push(key)
  }
  return lines.join('\n')
}
