import type { TFunction } from 'i18next'

const CONTROLLER_LABEL_KEYS: Record<number, string> = {
  1: 'controllers.joyConLeft',
  2: 'controllers.joyConRight',
  3: 'controllers.switchPro',
  4: 'controllers.dualShock4',
  5: 'controllers.dualSense',
  6: 'controllers.xboxOne',
  7: 'controllers.xboxElite',
  8: 'controllers.xboxSeries',
}

export const controllerLabelKey = (type?: number) => CONTROLLER_LABEL_KEYS[type ?? -1] ?? 'controllers.unknown'

export const controllerLabel = (type: number | undefined, t: TFunction) => t(controllerLabelKey(type))

export const formatVidPid = (vid?: number, pid?: number) => {
  const v = typeof vid === 'number' ? vid : undefined
  const p = typeof pid === 'number' ? pid : undefined
  if (v === undefined && p === undefined) return ''
  const toHex = (value: number) => `0x${value.toString(16).padStart(4, '0')}`
  if (v !== undefined && p !== undefined) return `${toHex(v)}:${toHex(p)}`
  if (v !== undefined) return toHex(v)
  return toHex(p!)
}
