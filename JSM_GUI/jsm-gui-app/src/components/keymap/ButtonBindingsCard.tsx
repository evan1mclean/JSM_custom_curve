import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BindingSlot,
  ButtonBindingRow,
  ManualRowInfo,
  ManualRowState,
} from '../../utils/keymap'
import { formatStickModeLabel } from '../../constants/sticks'
import { BindingRow } from '../BindingRow'
import keymapStyles from '../Keymap.module.css'
import stickStyles from '../Sticks.module.css'
import {
  EXTRA_BINDING_SLOTS,
  MODIFIER_SLOT_TYPES,
  buildStickShiftValue,
  getAllSpecialLabelKeys,
  getButtonDescription,
  getDefaultModifierForButton,
  getSpecialLabel,
  getSpecialOptionList,
  getSpecialOptionManualList,
  getStickShiftHeaderOption,
  getStickShiftLeftHeader,
  getStickShiftRightHeader,
  getStickShiftSpecialOptions,
  parseStickShiftSelection,
  type ButtonDefinition,
} from '../../keymap/schema'

type ButtonBindingsCardProps = {
  button: ButtonDefinition
  rows: ButtonBindingRow[]
  modifierOptions: { value: string; label: string; disabled?: boolean }[]
  specialsByButton: Record<string, string | undefined>
  stickModeShiftAssignments?: Record<string, { target: 'LEFT' | 'RIGHT'; mode: string }[]>
  stickShiftDisplayModes: Record<string, 'tap' | 'extra'>
  updateStickShiftDisplayMode: (buttonKey: string, mode?: 'tap' | 'extra') => void
  manualRows: Record<string, ManualRowState>
  ensureManualRow: (button: string, slot: BindingSlot, defaults?: Partial<ManualRowInfo>) => string
  updateManualRow: (button: string, slot: BindingSlot, rowId: string, info: Omit<ManualRowInfo, 'id'>) => void
  removeManualRow: (button: string, slot: BindingSlot, rowId?: string) => void
  captureLabel: string
  isCapturing: (button: string, slot: BindingSlot, rowId?: string) => boolean
  beginCapture: (button: string, slot: BindingSlot, rowId: string, label: string, modifier?: string) => void
  cancelCapture: () => void
  onBindingChange: (
    button: string,
    slot: BindingSlot,
    rowId: string,
    value: string | null,
    options?: { modifier?: string }
  ) => void
  onModifierChange: (
    button: string,
    slot: BindingSlot,
    rowId: string,
    previousModifier: string | undefined,
    nextModifier: string,
    binding: string | null
  ) => void
  onAssignSpecialAction: (special: string, buttonCommand: string) => void
  onClearSpecialAction: (special: string, buttonCommand: string) => void
  onStickModeShiftChange?: (button: string, target: 'LEFT' | 'RIGHT', mode?: string) => void
  trackballDecay: string
  onTrackballDecayChange: (value: string) => void
}

export const ButtonBindingsCard = ({
  button,
  rows,
  modifierOptions,
  specialsByButton,
  stickModeShiftAssignments,
  stickShiftDisplayModes,
  updateStickShiftDisplayMode,
  manualRows,
  ensureManualRow,
  updateManualRow,
  removeManualRow,
  captureLabel,
  isCapturing,
  beginCapture,
  cancelCapture,
  onBindingChange,
  onModifierChange,
  onAssignSpecialAction,
  onClearSpecialAction,
  onStickModeShiftChange,
  trackballDecay,
  onTrackballDecayChange,
}: ButtonBindingsCardProps) => {
  const { t } = useTranslation()
  const specialLabelKeys = getAllSpecialLabelKeys()
  const specialOptionList = getSpecialOptionList(t)
  const specialOptionManualList = getSpecialOptionManualList(t)
  const stickShiftHeaderOption = getStickShiftHeaderOption(t)
  const stickShiftLeftHeader = getStickShiftLeftHeader(t)
  const stickShiftRightHeader = getStickShiftRightHeader(t)
  const stickShiftSpecialOptions = getStickShiftSpecialOptions(t)

  const buttonKey = button.command.toUpperCase()
  const specialKey = specialsByButton[button.command]
  const tapSpecialLabel = specialKey ? getSpecialLabel(specialKey, t) : ''
  const stickShiftEntries = stickModeShiftAssignments?.[buttonKey] ?? []
  const shiftDisplayMode = stickShiftDisplayModes[buttonKey] ?? 'tap'
  const tapStickShiftEntry = shiftDisplayMode === 'tap' ? stickShiftEntries[0] : undefined
  const buttonHasTrackball = Boolean(
    rows.some(row => {
      const binding = row.binding?.toUpperCase()
      return binding ? binding.includes('TRACK') : false
    }) || (specialKey && new Set(['GYRO_TRACKBALL', 'GYRO_TRACK_X', 'GYRO_TRACK_Y']).has(specialKey))
  )
  const trackballSliderValue = trackballDecay && !Number.isNaN(Number(trackballDecay)) ? Number(trackballDecay) : 1

  const rowCapturing = rows.some(row => isCapturing(button.command, row.slot, row.id))

  return (
    <div className={`${keymapStyles.keymapRow} ${rowCapturing ? keymapStyles.keymapRowCapturing : ''}`} key={button.command}>
      <div className={keymapStyles.keymapLabel}>
        <span className={keymapStyles.buttonName}>
          {button.playstation === button.xbox ? button.playstation : `${button.playstation} / ${button.xbox}`}
        </span>
        <span className={keymapStyles.buttonMeta}>{getButtonDescription(button, t)}</span>
      </div>
      <div className={keymapStyles.keymapBindingControls}>
        {rows.map(row => {
          const isRowCapturing = isCapturing(button.command, row.slot, row.id)
          const hasExtraRows = rows.length > 1
          const isSpecialValue = Boolean(row.binding && specialLabelKeys[row.binding])
          const displayValue = (() => {
            if (row.slot === 'tap') {
              if (row.binding) return row.binding
              if (tapSpecialLabel) return tapSpecialLabel
              if (tapStickShiftEntry) {
                return tapStickShiftEntry.target === 'LEFT'
                  ? t('keymap.leftStickArrow', { mode: formatStickModeLabel(tapStickShiftEntry.mode, t) })
                  : t('keymap.rightStickArrow', { mode: formatStickModeLabel(tapStickShiftEntry.mode, t) })
              }
              return ''
            }
            if (isSpecialValue && row.binding) {
              return getSpecialLabel(row.binding, t)
            }
            return row.binding || ''
          })()
          const showHeader = row.slot !== 'tap' || hasExtraRows
          const headerLabel = row.slot === 'tap' && hasExtraRows ? t('keymap.buttonRegularPress') : row.label
          let rowSpecialOptions = MODIFIER_SLOT_TYPES.includes(row.slot as BindingSlot) ? specialOptionManualList : specialOptionList
          if (row.slot === 'tap' && onStickModeShiftChange) {
            rowSpecialOptions = [
              ...rowSpecialOptions,
              stickShiftHeaderOption,
              stickShiftRightHeader,
              ...stickShiftSpecialOptions.filter(o => o.value.includes(':RIGHT:')),
              stickShiftLeftHeader,
              ...stickShiftSpecialOptions.filter(o => o.value.includes(':LEFT:')),
            ]
          }
          const specialValue = (() => {
            if (row.slot === 'tap') {
              if (tapStickShiftEntry) {
                return buildStickShiftValue(tapStickShiftEntry.target, tapStickShiftEntry.mode)
              }
              if (row.binding && specialLabelKeys[row.binding]) {
                return row.binding
              }
              return specialKey ?? ''
            }
            if (isSpecialValue && row.binding) {
              return row.binding
            }
            return ''
          })()
          const clearTapSpecialBinding = () => {
            if (row.slot !== 'tap') return
            if (row.binding && specialLabelKeys[row.binding]) {
              onBindingChange(button.command, row.slot, row.id, null)
            }
          }
          const clearAllStickShiftAssignments = () => {
            if (!stickShiftEntries.length || !onStickModeShiftChange) return
            stickShiftEntries.forEach(entry => onStickModeShiftChange(button.command, entry.target))
            updateStickShiftDisplayMode(buttonKey, undefined)
          }
          const needsModifier = MODIFIER_SLOT_TYPES.includes(row.slot as BindingSlot)
          const manualEntries = manualRows[button.command]?.[row.slot] ?? []
          const manualInfo = manualEntries.find(entry => entry.id === row.id)
          const modifierValue = needsModifier
            ? row.modifierCommand ?? manualInfo?.modifierCommand ?? getDefaultModifierForButton(button.command, modifierOptions)
            : undefined
          const modifierLabel =
            row.slot === 'simultaneous'
              ? t('keymap.combineWith')
              : row.slot === 'diagonal'
                ? t('keymap.diagonalWith')
                : t('keymap.modifierButton')
          let rowModifierOptions = modifierOptions
          if (needsModifier && modifierValue && !modifierOptions.some(option => option.value === modifierValue)) {
            rowModifierOptions = [...modifierOptions, { value: modifierValue, label: modifierValue }]
          }
          const isLegacyFileCall = Boolean(row.binding && /"\s*[^"]+\.(txt|cfg|ini)"/i.test(row.binding))

          return (
            <Fragment key={`${button.command}-${row.slot}-${row.id}-wrapper`}>
              <BindingRow
                key={row.id}
                label={headerLabel}
                showHeader={showHeader}
                displayValue={displayValue}
                isManual={row.isManual}
                isCapturing={isRowCapturing}
                captureLabel={captureLabel}
                onBeginCapture={() =>
                  beginCapture(
                    button.command,
                    row.slot,
                    row.id,
                    row.slot === 'hold' ? t('keymap.holdBindingPrompt') : t('keymap.anyBindingPrompt'),
                    needsModifier ? modifierValue : undefined
                  )
                }
                onCancelCapture={cancelCapture}
                onClear={() => {
                  if (row.slot === 'tap') {
                    if (row.binding) {
                      onBindingChange(button.command, row.slot, row.id, null)
                    } else if (specialKey) {
                      onClearSpecialAction(specialKey, button.command)
                    } else if (tapStickShiftEntry) {
                      onStickModeShiftChange?.(button.command, tapStickShiftEntry.target)
                    }
                  } else {
                    const options = needsModifier ? { modifier: modifierValue } : undefined
                    onBindingChange(button.command, row.slot, row.id, null, options)
                  }
                }}
                onRemoveRow={row.isManual ? () => removeManualRow(button.command, row.slot, row.id) : undefined}
                disableClear={!displayValue && !row.isManual}
                specialOptions={rowSpecialOptions}
                specialValue={specialValue}
                modifierOptions={needsModifier ? rowModifierOptions : undefined}
                modifierValue={modifierValue}
                modifierLabel={needsModifier ? modifierLabel : undefined}
                onModifierChange={
                  needsModifier
                    ? (selected) => {
                        if (!selected) return
                        if (row.isManual) {
                          updateManualRow(button.command, row.slot, row.id, { modifierCommand: selected })
                        }
                        onModifierChange(button.command, row.slot, row.id, row.modifierCommand, selected, row.binding ?? null)
                      }
                    : undefined
                }
                onSpecialChange={
                  row.slot === 'tap'
                    ? (selected) => {
                        if (!selected) {
                          if (specialKey) {
                            onClearSpecialAction(specialKey, button.command)
                          }
                          if (tapStickShiftEntry) {
                            clearAllStickShiftAssignments()
                          }
                          clearTapSpecialBinding()
                          return
                        }
                        if (selected === stickShiftHeaderOption.value) {
                          return
                        }
                        const parsedShift = parseStickShiftSelection(selected)
                        if (parsedShift && onStickModeShiftChange) {
                          if (specialKey) {
                            onClearSpecialAction(specialKey, button.command)
                          }
                          clearTapSpecialBinding()
                          stickShiftEntries.forEach(entry => onStickModeShiftChange(button.command, entry.target))
                          onStickModeShiftChange(button.command, parsedShift.target, parsedShift.mode)
                          updateStickShiftDisplayMode(buttonKey, 'tap')
                          return
                        }
                        if (tapStickShiftEntry) {
                          clearAllStickShiftAssignments()
                        }
                        onAssignSpecialAction(selected, button.command)
                      }
                    : (selected) => {
                        if (!selected) {
                          if (isSpecialValue) {
                            const options = needsModifier ? { modifier: modifierValue } : undefined
                            onBindingChange(button.command, row.slot, row.id, null, options)
                          }
                          return
                        }
                        onBindingChange(button.command, row.slot, row.id, selected, needsModifier ? { modifier: modifierValue } : undefined)
                        if (row.isManual) {
                          removeManualRow(button.command, row.slot, row.id)
                        }
                      }
                }
              />
              {isLegacyFileCall && <div className="legacy-binding-warning">{t('keymap.legacyScriptDetected')}</div>}
            </Fragment>
          )
        })}
        {(() => {
          const hasHold = rows.some(row => row.slot === 'hold')
          const hasDouble = rows.some(row => row.slot === 'double')
          const availableSlots = EXTRA_BINDING_SLOTS.filter(slot => {
            if (slot === 'hold') return !hasHold
            if (slot === 'double') return !hasDouble
            return true
          })
          return (
            <div className={`${keymapStyles.bindingRow} ${keymapStyles.addBindingRow}`} data-capture-ignore="true">
              <select
                className="app-select"
                value=""
                onChange={(event) => {
                  const selectedValue = event.target.value
                  if (selectedValue === stickShiftHeaderOption.value) {
                    event.target.value = ''
                    return
                  }
                  const parsedShift = parseStickShiftSelection(selectedValue)
                  if (parsedShift && onStickModeShiftChange) {
                    onStickModeShiftChange(button.command, parsedShift.target, parsedShift.mode)
                    updateStickShiftDisplayMode(buttonKey, 'extra')
                    event.target.value = ''
                    return
                  }
                  const selected = selectedValue as BindingSlot
                  if (selected) {
                    const isComboSlot = MODIFIER_SLOT_TYPES.includes(selected)
                    if (isComboSlot) {
                      ensureManualRow(button.command, selected, {
                        modifierCommand: getDefaultModifierForButton(button.command, modifierOptions),
                      })
                    } else {
                      ensureManualRow(button.command, selected)
                    }
                  }
                  event.target.value = ''
                }}
              >
                <option value="">{t('keymap.addExtraBinding')}</option>
                {availableSlots.map(slot => (
                  <option key={`${button.command}-${slot}-opt`} value={slot}>
                    {slot === 'hold'
                      ? t('keymap.holdPressAndHold')
                      : slot === 'double'
                        ? t('keymap.doublePress')
                        : slot === 'chord'
                          ? t('keymap.chordedPress')
                          : slot === 'simultaneous'
                            ? t('keymap.simultaneousPress')
                            : t('keymap.diagonalPress')}
                  </option>
                ))}
                {onStickModeShiftChange && (
                  <>
                    <option value={stickShiftHeaderOption.value} disabled>
                      {t('keymap.stickModeShifts')}
                    </option>
                    <option value={stickShiftRightHeader.value} disabled>
                      {stickShiftRightHeader.label}
                    </option>
                    {stickShiftSpecialOptions.filter(o => o.value.includes(':RIGHT:')).map(option => (
                      <option key={`${button.command}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value={stickShiftLeftHeader.value} disabled>
                      {stickShiftLeftHeader.label}
                    </option>
                    {stickShiftSpecialOptions.filter(o => o.value.includes(':LEFT:')).map(option => (
                      <option key={`${button.command}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          )
        })()}
        {stickShiftEntries.length > 0 && (
          <div className={stickStyles.stickShiftRows}>
            {stickShiftEntries.map(entry => {
              const tapDisplaysShift =
                rows.length === 1 &&
                rows[0].slot === 'tap' &&
                !rows[0].binding &&
                !tapSpecialLabel &&
                stickShiftEntries.length === 1 &&
                shiftDisplayMode !== 'extra'
              if (tapDisplaysShift) {
                return null
              }
              const label = entry.target === 'LEFT' ? t('keymap.leftStickModeShift') : t('keymap.rightStickModeShift')
              const buttonLabel =
                entry.target === 'LEFT'
                  ? t('keymap.leftStickArrow', { mode: formatStickModeLabel(entry.mode, t) })
                  : t('keymap.rightStickArrow', { mode: formatStickModeLabel(entry.mode, t) })
              return (
                <div className={`${keymapStyles.bindingRow} ${keymapStyles.manualStickShift}`} key={`${button.command}-${entry.target}`}>
                  <div className={keymapStyles.bindingRowHeader}>
                    <span>{label}</span>
                  </div>
                  <div className={keymapStyles.primaryBindingRow}>
                    <button type="button" className={keymapStyles.bindingInput} disabled>
                      {buttonLabel}
                    </button>
                    <button
                      type="button"
                      className={keymapStyles.clearBindingBtn}
                      onClick={() => {
                        onStickModeShiftChange?.(button.command, entry.target)
                        if (stickShiftEntries.length === 1) {
                          updateStickShiftDisplayMode(buttonKey, undefined)
                        }
                      }}
                      data-capture-ignore="true"
                    >
                      {t('keymap.clearBinding')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {buttonHasTrackball && (
          <div className={keymapStyles.trackballInline} data-capture-ignore="true">
            <label>
              {t('keymap.trackballDecay')}
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={trackballDecay}
                onChange={(event) => onTrackballDecayChange(event.target.value)}
                placeholder={t('common.defaultValue', { value: '1.0' })}
              />
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={trackballSliderValue}
              onChange={(event) => onTrackballDecayChange(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
