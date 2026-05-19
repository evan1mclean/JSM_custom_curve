import type { TFunction } from 'i18next'

export type ModifierSelectOption = {
  value: string
  labelKey: string
  labelParams?: Record<string, number | string>
  disabled?: boolean
}

const BASE_MODIFIER_OPTIONS: ModifierSelectOption[] = [
  { value: 'UP', labelKey: 'modifiers.up' },
  { value: 'DOWN', labelKey: 'modifiers.down' },
  { value: 'LEFT', labelKey: 'modifiers.left' },
  { value: 'RIGHT', labelKey: 'modifiers.right' },
  { value: 'L', labelKey: 'modifiers.l' },
  { value: 'ZL', labelKey: 'modifiers.zl' },
  { value: 'ZLF', labelKey: 'modifiers.zlf' },
  { value: 'R', labelKey: 'modifiers.r' },
  { value: 'ZR', labelKey: 'modifiers.zr' },
  { value: 'ZRF', labelKey: 'modifiers.zrf' },
  { value: '-', labelKey: 'modifiers.minus' },
  { value: '+', labelKey: 'modifiers.plus' },
  { value: 'HOME', labelKey: 'modifiers.home' },
  { value: 'CAPTURE', labelKey: 'modifiers.capture' },
  { value: 'LSL', labelKey: 'modifiers.lsl' },
  { value: 'RSR', labelKey: 'modifiers.rsr' },
  { value: 'LSR', labelKey: 'modifiers.lsr' },
  { value: 'RSL', labelKey: 'modifiers.rsl' },
  { value: 'L3', labelKey: 'modifiers.l3' },
  { value: 'R3', labelKey: 'modifiers.r3' },
  { value: 'N', labelKey: 'modifiers.n' },
  { value: 'E', labelKey: 'modifiers.e' },
  { value: 'S', labelKey: 'modifiers.s' },
  { value: 'W', labelKey: 'modifiers.w' },
  { value: 'LUP', labelKey: 'modifiers.lup' },
  { value: 'LDOWN', labelKey: 'modifiers.ldown' },
  { value: 'LLEFT', labelKey: 'modifiers.lleft' },
  { value: 'LRIGHT', labelKey: 'modifiers.lright' },
  { value: 'LRING', labelKey: 'modifiers.lring' },
  { value: 'RUP', labelKey: 'modifiers.rup' },
  { value: 'RDOWN', labelKey: 'modifiers.rdown' },
  { value: 'RLEFT', labelKey: 'modifiers.rleft' },
  { value: 'RRIGHT', labelKey: 'modifiers.rright' },
  { value: 'RRING', labelKey: 'modifiers.rring' },
  { value: 'LEAN_LEFT', labelKey: 'modifiers.leanLeft' },
  { value: 'LEAN_RIGHT', labelKey: 'modifiers.leanRight' },
  { value: 'MIC', labelKey: 'modifiers.mic' },
  { value: 'LMINI', labelKey: 'modifiers.lmini' },
  { value: 'RMINI', labelKey: 'modifiers.rmini' },
  { value: 'LTOUCH', labelKey: 'modifiers.ltouch' },
  { value: 'RTOUCH', labelKey: 'modifiers.rtouch' },
  { value: 'MISC1', labelKey: 'modifiers.misc1' },
  { value: 'MISC2', labelKey: 'modifiers.misc2' },
  { value: 'MISC3', labelKey: 'modifiers.misc3' },
  { value: 'MISC4', labelKey: 'modifiers.misc4' },
  { value: 'MISC5', labelKey: 'modifiers.misc5' },
  { value: 'MISC6', labelKey: 'modifiers.misc6' },
]

const TOUCHPAD_CORE_OPTIONS: ModifierSelectOption[] = [{ value: 'TOUCH', labelKey: 'modifiers.touch' }]

const TOUCHPAD_GRID_PREVIEW_COUNT = 6

const clampGridButtons = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(Math.max(Math.floor(value), 1), 25)
}

export const resolveModifierOptionLabel = (option: ModifierSelectOption, t: TFunction) =>
  t(option.labelKey, option.labelParams)

export const buildModifierOptions = (gridActive: boolean, configuredGridButtons: number) => {
  const options: ModifierSelectOption[] = [...BASE_MODIFIER_OPTIONS, ...TOUCHPAD_CORE_OPTIONS]
  if (gridActive) {
    const count = clampGridButtons(configuredGridButtons || 1)
    for (let index = 1; index <= count; index += 1) {
      options.push({
        value: `T${index}`,
        labelKey: 'modifiers.touchGridRegion',
        labelParams: { index },
      })
    }
  } else {
    const previewCount = Math.min(TOUCHPAD_GRID_PREVIEW_COUNT, Math.max(configuredGridButtons, 2) || 2)
    for (let index = 1; index <= previewCount; index += 1) {
      options.push({
        value: `T${index}`,
        labelKey: 'modifiers.touchGridRegionDisabled',
        labelParams: { index },
        disabled: true,
      })
    }
  }
  return options
}
