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

export const STICK_MODE_LABELS: Record<StickMode, string> = {
  NO_MOUSE: 'No Mouse',
  AIM: 'Aim',
  FLICK: 'Flick Stick',
  FLICK_ONLY: 'Flick Only',
  ROTATE_ONLY: 'Rotate Only',
  MOUSE_AREA: 'Mouse Area',
  SCROLL_WHEEL: 'Scroll Wheel',
  HYBRID_AIM: 'Hybrid Aim',
  INNER_RING: 'Inner Ring',
  OUTER_RING: 'Outer Ring',
}

export const formatStickModeLabel = (mode: string) => {
  const upper = mode?.toUpperCase()
  if (STICK_MODE_LABELS[upper as StickMode]) return STICK_MODE_LABELS[upper as StickMode]
  return upper ? upper.replace(/_/g, ' ') : ''
}
