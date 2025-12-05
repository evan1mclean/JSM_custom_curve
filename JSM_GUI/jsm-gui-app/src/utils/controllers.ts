export const controllerLabel = (type?: number) => {
  switch (type) {
    case 1:
      return 'Joy-Con (Left)'
    case 2:
      return 'Joy-Con (Right)'
    case 3:
      return 'Switch Pro'
    case 4:
      return 'DualShock 4'
    case 5:
      return 'DualSense'
    case 6:
      return 'Xbox One'
    case 7:
      return 'Xbox Elite'
    case 8:
      return 'Xbox Series'
    default:
      return 'Unknown'
  }
}

export const formatVidPid = (vid?: number, pid?: number) => {
  const v = typeof vid === 'number' ? vid : undefined
  const p = typeof pid === 'number' ? pid : undefined
  if (v === undefined && p === undefined) return ''
  const toHex = (value: number) => `0x${value.toString(16).padStart(4, '0')}`
  if (v !== undefined && p !== undefined) return `${toHex(v)}:${toHex(p)}`
  if (v !== undefined) return toHex(v)
  return toHex(p!)
}
