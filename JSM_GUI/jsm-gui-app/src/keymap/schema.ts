import { BindingSlot } from '../utils/keymap'
import { ModifierSelectOption } from '../utils/modifierOptions'
import { STICK_MODE_VALUES, formatStickModeLabel } from '../constants/sticks'

export type ButtonDefinition = {
  command: string
  description: string
  playstation: string
  xbox: string
}

export const FACE_BUTTONS: ButtonDefinition[] = [
  { command: 'S', description: 'South / Bottom', playstation: 'Cross', xbox: 'A' },
  { command: 'E', description: 'East / Right', playstation: 'Circle', xbox: 'B' },
  { command: 'N', description: 'North / Top', playstation: 'Triangle', xbox: 'Y' },
  { command: 'W', description: 'West / Left', playstation: 'Square', xbox: 'X' },
]

export const DPAD_BUTTONS: ButtonDefinition[] = [
  { command: 'UP', description: 'D-pad Up', playstation: 'Up', xbox: 'Up' },
  { command: 'DOWN', description: 'D-pad Down', playstation: 'Down', xbox: 'Down' },
  { command: 'LEFT', description: 'D-pad Left', playstation: 'Left', xbox: 'Left' },
  { command: 'RIGHT', description: 'D-pad Right', playstation: 'Right', xbox: 'Right' },
]

export const BUMPER_BUTTONS: ButtonDefinition[] = [
  { command: 'L', description: 'Left bumper (L1 / LB)', playstation: 'L1', xbox: 'LB' },
  { command: 'R', description: 'Right bumper (R1 / RB)', playstation: 'R1', xbox: 'RB' },
]

export const TRIGGER_BUTTONS: ButtonDefinition[] = [
  { command: 'ZL', description: 'Left trigger soft pull', playstation: 'L2', xbox: 'LT' },
  { command: 'ZLF', description: 'Left trigger full pull', playstation: 'L2 Full', xbox: 'LT Full' },
  { command: 'ZR', description: 'Right trigger soft pull', playstation: 'R2', xbox: 'RT' },
  { command: 'ZRF', description: 'Right trigger full pull', playstation: 'R2 Full', xbox: 'RT Full' },
]

export const CENTER_BUTTONS: ButtonDefinition[] = [
  { command: '+', description: 'Options / Menu (plus)', playstation: 'Options', xbox: 'Options' },
  { command: '-', description: 'Share / View (minus)', playstation: 'Share', xbox: 'View' },
  { command: 'MIC', description: 'Microphone button', playstation: 'Mic', xbox: 'Mic' },
]

export const TOUCH_BUTTONS: ButtonDefinition[] = [
  { command: 'TOUCH', description: 'Touch contact', playstation: 'Touch', xbox: 'Touch' },
  { command: 'CAPTURE', description: 'Touchpad click', playstation: 'Click', xbox: 'Click' },
]

export const LEFT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'LUP', description: 'Left stick up direction', playstation: 'LS Up', xbox: 'LS Up' },
  { command: 'LDOWN', description: 'Left stick down direction', playstation: 'LS Down', xbox: 'LS Down' },
  { command: 'LLEFT', description: 'Left stick left direction', playstation: 'LS Left', xbox: 'LS Left' },
  { command: 'LRIGHT', description: 'Left stick right direction', playstation: 'LS Right', xbox: 'LS Right' },
  { command: 'L3', description: 'Left stick click', playstation: 'L3', xbox: 'LS Click' },
  { command: 'LRING', description: 'Left stick ring binding', playstation: 'L-Ring', xbox: 'L-Ring' },
]

export const RIGHT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'RUP', description: 'Right stick up direction', playstation: 'RS Up', xbox: 'RS Up' },
  { command: 'RDOWN', description: 'Right stick down direction', playstation: 'RS Down', xbox: 'RS Down' },
  { command: 'RLEFT', description: 'Right stick left direction', playstation: 'RS Left', xbox: 'RS Left' },
  { command: 'RRIGHT', description: 'Right stick right direction', playstation: 'RS Right', xbox: 'RS Right' },
  { command: 'R3', description: 'Right stick click', playstation: 'R3', xbox: 'RS Click' },
  { command: 'RRING', description: 'Right stick ring binding', playstation: 'R-Ring', xbox: 'R-Ring' },
]

export const buildStickShiftValue = (target: 'LEFT' | 'RIGHT', mode: string) => `STICK_SHIFT:${target}:${mode}`

export const STICK_SHIFT_SPECIAL_OPTIONS = STICK_MODE_VALUES.flatMap(mode => [
  {
    value: buildStickShiftValue('LEFT', mode),
    label: `Stick shift — Left → ${formatStickModeLabel(mode)}`,
  },
  {
    value: buildStickShiftValue('RIGHT', mode),
    label: `Stick shift — Right → ${formatStickModeLabel(mode)}`,
  },
])

export const STICK_SHIFT_HEADER_OPTION = { value: 'STICK_SHIFT_HEADER', label: '── Stick mode shifts ──', disabled: true }

export const parseStickShiftSelection = (value: string) => {
  const match = /^STICK_SHIFT:(LEFT|RIGHT):([A-Z_]+)$/i.exec(value)
  if (!match) return null
  return { target: match[1].toUpperCase() as 'LEFT' | 'RIGHT', mode: match[2].toUpperCase() }
}

export const STICK_AIM_DEFAULTS = {
  sens: '360',
  power: '2',
  accelerationRate: '0',
  accelerationCap: '1000000',
}

export const SPECIAL_BINDINGS = [
  { value: '', label: 'Special Binds' },
  { value: 'GYRO_OFF', label: 'Hold to disable gyro' },
  { value: 'GYRO_ON', label: 'Hold to enable gyro' },
  { value: 'GYRO_OFF_ALL', label: 'Hold to disable gyro (all controllers)' },
  { value: 'GYRO_ON_ALL', label: 'Hold to enable gyro (all controllers)' },
  { value: 'GYRO_INVERT', label: 'Invert gyro direction (both axes)' },
  { value: 'GYRO_INV_X', label: 'Invert gyro X axis' },
  { value: 'GYRO_INV_Y', label: 'Invert gyro Y axis' },
  { value: 'GYRO_TRACKBALL', label: 'Trackball mode (hold to engage)' },
  { value: 'GYRO_TRACK_X', label: 'Trackball mode — X axis' },
  { value: 'GYRO_TRACK_Y', label: 'Trackball mode — Y axis' },
]

export const SPECIAL_OPTION_LIST = SPECIAL_BINDINGS.filter(option => option.value)
export const SPECIAL_OPTION_MANUAL_LIST = SPECIAL_BINDINGS.filter(option => option.value && !['GYRO_OFF', 'GYRO_ON'].includes(option.value))

export const SPECIAL_LABELS: Record<string, string> = {
  GYRO_OFF: 'Disable gyro',
  GYRO_ON: 'Enable gyro',
  GYRO_OFF_ALL: 'Disable gyro (all)',
  GYRO_ON_ALL: 'Enable gyro (all)',
  GYRO_INVERT: 'Invert gyro axes',
  GYRO_INV_X: 'Invert gyro X axis',
  GYRO_INV_Y: 'Invert gyro Y axis',
  GYRO_TRACKBALL: 'Trackball mode (XY)',
  GYRO_TRACK_X: 'Trackball mode (X only)',
  GYRO_TRACK_Y: 'Trackball mode (Y only)',
}

export const EXTRA_BINDING_SLOTS: BindingSlot[] = ['hold', 'double', 'chord', 'simultaneous']
export const MODIFIER_SLOT_TYPES: BindingSlot[] = ['chord', 'simultaneous']

export const getDefaultModifierForButton = (button: string, modifierOptions: ModifierSelectOption[]) => {
  const upper = button.toUpperCase()
  const fallback = modifierOptions[0]?.value ?? 'L3'
  const candidate = modifierOptions.find(option => option.value !== upper && !option.disabled)
  return candidate?.value ?? fallback
}
