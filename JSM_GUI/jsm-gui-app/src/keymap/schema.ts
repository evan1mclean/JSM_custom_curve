import type { TFunction } from 'i18next'
import { STICK_MODE_VALUES, formatStickModeLabel } from '../constants/sticks'
import { BindingSlot } from '../utils/keymap'

export type ButtonDefinition = {
  command: string
  descriptionKey: string
  descriptionParams?: Record<string, number | string>
  playstation: string
  xbox: string
}

type KeyedOption = {
  value: string
  labelKey: string
  labelParams?: Record<string, number | string>
  disabled?: boolean
}

export const FACE_BUTTONS: ButtonDefinition[] = [
  { command: 'N', descriptionKey: 'buttons.descriptions.northTop', playstation: '△', xbox: 'Y' },
  { command: 'E', descriptionKey: 'buttons.descriptions.eastRight', playstation: '○', xbox: 'B' },
  { command: 'S', descriptionKey: 'buttons.descriptions.southBottom', playstation: '✕', xbox: 'A' },
  { command: 'W', descriptionKey: 'buttons.descriptions.westLeft', playstation: '□', xbox: 'X' },
]

export const DPAD_BUTTONS: ButtonDefinition[] = [
  { command: 'UP', descriptionKey: 'buttons.descriptions.dpadUp', playstation: 'Up', xbox: 'Up' },
  { command: 'RIGHT', descriptionKey: 'buttons.descriptions.dpadRight', playstation: 'Right', xbox: 'Right' },
  { command: 'DOWN', descriptionKey: 'buttons.descriptions.dpadDown', playstation: 'Down', xbox: 'Down' },
  { command: 'LEFT', descriptionKey: 'buttons.descriptions.dpadLeft', playstation: 'Left', xbox: 'Left' },
]

export const BUMPER_BUTTONS: ButtonDefinition[] = [
  { command: 'L', descriptionKey: 'buttons.descriptions.leftBumper', playstation: 'L1', xbox: 'LB' },
  { command: 'R', descriptionKey: 'buttons.descriptions.rightBumper', playstation: 'R1', xbox: 'RB' },
]

export const TRIGGER_BUTTONS: ButtonDefinition[] = [
  { command: 'ZL', descriptionKey: 'buttons.descriptions.leftTriggerSoftPull', playstation: 'L2', xbox: 'LT' },
  { command: 'ZLF', descriptionKey: 'buttons.descriptions.leftTriggerFullPull', playstation: 'L2 Full', xbox: 'LT Full' },
  { command: 'ZR', descriptionKey: 'buttons.descriptions.rightTriggerSoftPull', playstation: 'R2', xbox: 'RT' },
  { command: 'ZRF', descriptionKey: 'buttons.descriptions.rightTriggerFullPull', playstation: 'R2 Full', xbox: 'RT Full' },
]

export const CENTER_BUTTONS: ButtonDefinition[] = [
  { command: '+', descriptionKey: 'buttons.descriptions.optionsMenuPlus', playstation: 'Options', xbox: 'Menu' },
  { command: '-', descriptionKey: 'buttons.descriptions.shareViewMinus', playstation: 'Share', xbox: 'View' },
  { command: 'MIC', descriptionKey: 'buttons.descriptions.microphoneButton', playstation: 'Mic', xbox: 'Mic' },
  { command: 'HOME', descriptionKey: 'buttons.descriptions.homeGuide', playstation: 'PS', xbox: 'Guide' },
]

export const PADDLE_BUTTONS: ButtonDefinition[] = [
  { command: 'LSL', descriptionKey: 'buttons.descriptions.primaryLeftBackPaddle', playstation: 'L Paddle 1', xbox: 'L SL' },
  { command: 'RSR', descriptionKey: 'buttons.descriptions.primaryRightBackPaddle', playstation: 'R Paddle 1', xbox: 'R SR' },
  { command: 'LSR', descriptionKey: 'buttons.descriptions.secondaryLeftBackPaddle', playstation: 'L Paddle 2', xbox: 'L SR' },
  { command: 'RSL', descriptionKey: 'buttons.descriptions.secondaryRightBackPaddle', playstation: 'R Paddle 2', xbox: 'R SL' },
]

export const MINI_BUTTONS: ButtonDefinition[] = [
  { command: 'LMINI', descriptionKey: 'buttons.descriptions.leftMiniShoulder', playstation: 'L Mini', xbox: 'L Mini' },
  { command: 'RMINI', descriptionKey: 'buttons.descriptions.rightMiniShoulder', playstation: 'R Mini', xbox: 'R Mini' },
]

export const TOUCH_BUTTONS: ButtonDefinition[] = [
  { command: 'TOUCH', descriptionKey: 'buttons.descriptions.touchContact', playstation: 'Touch', xbox: 'Touch' },
  { command: 'CAPTURE', descriptionKey: 'buttons.descriptions.touchpadClick', playstation: 'Click', xbox: 'Click' },
]

export const LEFT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'LUP', descriptionKey: 'buttons.descriptions.leftStickUp', playstation: 'LS Up', xbox: 'LS Up' },
  { command: 'LDOWN', descriptionKey: 'buttons.descriptions.leftStickDown', playstation: 'LS Down', xbox: 'LS Down' },
  { command: 'LLEFT', descriptionKey: 'buttons.descriptions.leftStickLeft', playstation: 'LS Left', xbox: 'LS Left' },
  { command: 'LRIGHT', descriptionKey: 'buttons.descriptions.leftStickRight', playstation: 'LS Right', xbox: 'LS Right' },
  { command: 'L3', descriptionKey: 'buttons.descriptions.leftStickClick', playstation: 'L3', xbox: 'LS Click' },
  { command: 'LRING', descriptionKey: 'buttons.descriptions.leftStickRing', playstation: 'L-Ring', xbox: 'L-Ring' },
  { command: 'LTOUCH', descriptionKey: 'buttons.descriptions.leftStickTouch', playstation: 'LS Touch', xbox: 'LS Touch' },
]

export const RIGHT_STICK_BUTTONS: ButtonDefinition[] = [
  { command: 'RUP', descriptionKey: 'buttons.descriptions.rightStickUp', playstation: 'RS Up', xbox: 'RS Up' },
  { command: 'RDOWN', descriptionKey: 'buttons.descriptions.rightStickDown', playstation: 'RS Down', xbox: 'RS Down' },
  { command: 'RLEFT', descriptionKey: 'buttons.descriptions.rightStickLeft', playstation: 'RS Left', xbox: 'RS Left' },
  { command: 'RRIGHT', descriptionKey: 'buttons.descriptions.rightStickRight', playstation: 'RS Right', xbox: 'RS Right' },
  { command: 'R3', descriptionKey: 'buttons.descriptions.rightStickClick', playstation: 'R3', xbox: 'RS Click' },
  { command: 'RRING', descriptionKey: 'buttons.descriptions.rightStickRing', playstation: 'R-Ring', xbox: 'R-Ring' },
  { command: 'RTOUCH', descriptionKey: 'buttons.descriptions.rightStickTouch', playstation: 'RS Touch', xbox: 'RS Touch' },
]

export const MISC_BUTTONS: ButtonDefinition[] = [
  { command: 'MISC1', descriptionKey: 'buttons.descriptions.extraButton1', playstation: 'Misc 1', xbox: 'Misc 1' },
  { command: 'MISC2', descriptionKey: 'buttons.descriptions.extraButton2', playstation: 'Misc 2', xbox: 'Misc 2' },
  { command: 'MISC3', descriptionKey: 'buttons.descriptions.extraButton3', playstation: 'Misc 3', xbox: 'Misc 3' },
  { command: 'MISC4', descriptionKey: 'buttons.descriptions.extraButton4', playstation: 'Misc 4', xbox: 'Misc 4' },
  { command: 'MISC5', descriptionKey: 'buttons.descriptions.extraButton5', playstation: 'Misc 5', xbox: 'Misc 5' },
  { command: 'MISC6', descriptionKey: 'buttons.descriptions.extraButton6', playstation: 'Misc 6', xbox: 'Misc 6' },
]

export const buildTouchpadGridButton = (index: number, row: number, col: number): ButtonDefinition => ({
  command: `T${index}`,
  descriptionKey: 'buttons.descriptions.touchpadGridRegion',
  descriptionParams: { row, col },
  playstation: `T${index}`,
  xbox: `T${index}`,
})

export const getButtonDescription = (button: ButtonDefinition, t: TFunction) =>
  t(button.descriptionKey, button.descriptionParams)

export const buildStickShiftValue = (target: 'LEFT' | 'RIGHT', mode: string) => `STICK_SHIFT:${target}:${mode}`

const SPECIAL_BINDING_DEFS: KeyedOption[] = [
  { value: 'GYRO_OFF', labelKey: 'specialBindings.holdToDisableGyro' },
  { value: 'GYRO_ON', labelKey: 'specialBindings.holdToEnableGyro' },
  { value: 'GYRO_OFF_ALL', labelKey: 'specialBindings.holdToDisableGyroAll' },
  { value: 'GYRO_ON_ALL', labelKey: 'specialBindings.holdToEnableGyroAll' },
  { value: 'GYRO_INVERT', labelKey: 'specialBindings.invertGyroDirection' },
  { value: 'GYRO_INV_X', labelKey: 'specialBindings.invertGyroX' },
  { value: 'GYRO_INV_Y', labelKey: 'specialBindings.invertGyroY' },
  { value: 'GYRO_TRACKBALL', labelKey: 'specialBindings.trackballHold' },
  { value: 'GYRO_TRACK_X', labelKey: 'specialBindings.trackballX' },
  { value: 'GYRO_TRACK_Y', labelKey: 'specialBindings.trackballY' },
]

const SPECIAL_LABEL_KEYS: Record<string, string> = {
  GYRO_OFF: 'specialBindings.disableGyro',
  GYRO_ON: 'specialBindings.enableGyro',
  GYRO_OFF_ALL: 'specialBindings.disableGyroAll',
  GYRO_ON_ALL: 'specialBindings.enableGyroAll',
  GYRO_INVERT: 'specialBindings.invertGyroAxes',
  GYRO_INV_X: 'specialBindings.invertGyroX',
  GYRO_INV_Y: 'specialBindings.invertGyroY',
  GYRO_TRACKBALL: 'specialBindings.trackballModeXY',
  GYRO_TRACK_X: 'specialBindings.trackballModeXOnly',
  GYRO_TRACK_Y: 'specialBindings.trackballModeYOnly',
}

export const getSpecialBindings = (t: TFunction) => [
  { value: '', label: t('keymap.specialBinds') },
  ...SPECIAL_BINDING_DEFS.map(option => ({
    value: option.value,
    label: t(option.labelKey, option.labelParams),
  })),
]

export const getSpecialOptionList = (t: TFunction) => getSpecialBindings(t).filter(option => option.value)

export const getSpecialOptionManualList = (t: TFunction) =>
  getSpecialOptionList(t).filter(option => !['GYRO_OFF', 'GYRO_ON'].includes(option.value))

export const getSpecialLabel = (value: string, t: TFunction) => {
  const key = SPECIAL_LABEL_KEYS[value]
  return key ? t(key) : value
}

export const getAllSpecialLabelKeys = () => SPECIAL_LABEL_KEYS

export const getStickShiftSpecialOptions = (t: TFunction) => [
  ...STICK_MODE_VALUES.map(mode => ({
    value: buildStickShiftValue('RIGHT', mode),
    label: t('specialBindings.stickShiftRight', { mode: formatStickModeLabel(mode, t) }),
  })),
  ...STICK_MODE_VALUES.map(mode => ({
    value: buildStickShiftValue('LEFT', mode),
    label: t('specialBindings.stickShiftLeft', { mode: formatStickModeLabel(mode, t) }),
  })),
]

export const getStickShiftHeaderOption = (t: TFunction) => ({
  value: 'STICK_SHIFT_HEADER',
  label: t('keymap.stickModeShifts'),
  disabled: true,
})

export const getStickShiftLeftHeader = (t: TFunction) => ({
  value: 'STICK_SHIFT_LEFT_HEADER',
  label: t('keymap.leftStickHeader'),
  disabled: true,
})

export const getStickShiftRightHeader = (t: TFunction) => ({
  value: 'STICK_SHIFT_RIGHT_HEADER',
  label: t('keymap.rightStickHeader'),
  disabled: true,
})

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

export const EXTRA_BINDING_SLOTS: BindingSlot[] = ['hold', 'double', 'chord', 'simultaneous', 'diagonal']
export const MODIFIER_SLOT_TYPES: BindingSlot[] = ['chord', 'simultaneous', 'diagonal']

export const getDefaultModifierForButton = (
  button: string,
  modifierOptions: Array<{ value: string; disabled?: boolean }>
) => {
  const upper = button.toUpperCase()
  const fallback = modifierOptions[0]?.value ?? 'L3'
  const candidate = modifierOptions.find(option => option.value !== upper && !option.disabled)
  return candidate?.value ?? fallback
}
