import type { TFunction } from 'i18next'

export const STICK_MODE_VALUES = [
  'NO_MOUSE',
  'AIM',
  'FLICK',
  'FLICK_ONLY',
  'ROTATE_ONLY',
  'MOUSE_AREA',
  'SCROLL_WHEEL',
  'HYBRID_AIM',
  'INNER_RING',
  'OUTER_RING',
] as const

export type StickMode = (typeof STICK_MODE_VALUES)[number]

const STICK_MODE_LABEL_KEYS: Record<StickMode, string> = {
  NO_MOUSE: 'stickModes.NO_MOUSE',
  AIM: 'stickModes.AIM',
  FLICK: 'stickModes.FLICK',
  FLICK_ONLY: 'stickModes.FLICK_ONLY',
  ROTATE_ONLY: 'stickModes.ROTATE_ONLY',
  MOUSE_AREA: 'stickModes.MOUSE_AREA',
  SCROLL_WHEEL: 'stickModes.SCROLL_WHEEL',
  HYBRID_AIM: 'stickModes.HYBRID_AIM',
  INNER_RING: 'stickModes.INNER_RING',
  OUTER_RING: 'stickModes.OUTER_RING',
}

export const getStickModeLabelKey = (mode: string) => {
  const upper = mode?.toUpperCase() as StickMode
  return STICK_MODE_LABEL_KEYS[upper]
}

export const formatStickModeLabel = (mode: string, t: TFunction) => {
  const key = getStickModeLabelKey(mode)
  if (key) return t(key)
  const upper = mode?.toUpperCase()
  return upper ? upper.replace(/_/g, ' ') : ''
}
