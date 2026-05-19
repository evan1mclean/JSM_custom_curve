import { useTranslation } from 'react-i18next'
import styles from './Keymap.module.css'

type SpecialOption = { value: string; label: string; disabled?: boolean }

type ModifierOption = {
  value: string
  label: string
  disabled?: boolean
}

type BindingRowProps = {
  label: string
  showHeader: boolean
  displayValue: string
  isManual: boolean
  isCapturing: boolean
  captureLabel: string
  onBeginCapture: () => void
  onCancelCapture: () => void
  onClear: () => void
  onRemoveRow?: () => void
  disableClear?: boolean
  specialOptions?: SpecialOption[]
  specialValue?: string
  onSpecialChange?: (value: string) => void
  modifierLabel?: string
  modifierOptions?: ModifierOption[]
  modifierValue?: string
  onModifierChange?: (value: string) => void
}

export function BindingRow({
  label,
  showHeader,
  displayValue,
  isManual,
  isCapturing,
  captureLabel,
  onBeginCapture,
  onCancelCapture,
  onClear,
  onRemoveRow,
  disableClear,
  specialOptions,
  specialValue,
  onSpecialChange,
  modifierLabel,
  modifierOptions,
  modifierValue,
  onModifierChange,
}: BindingRowProps) {
  const { t } = useTranslation()
  const buttonLabel = isCapturing ? captureLabel : displayValue || t('keymap.clickToSetBinding')
  const clearLabel = isManual ? t('keymap.removeRow') : t('keymap.clearBinding')

  const handleClear = () => {
    onClear()
    if (isManual) {
      onRemoveRow?.()
    }
  }

  return (
    <div className={styles.bindingRow}>
      {showHeader && (
        <div className={styles.bindingRowHeader}>
          <span>{label}</span>
        </div>
      )}
      {modifierOptions && modifierOptions.length > 0 && (
        <div className={styles.rowModifierSelect} data-capture-ignore="true">
          <label>{modifierLabel ?? t('keymap.modifierButton')}</label>
          <select className="app-select" value={modifierValue ?? ''} onChange={(event) => onModifierChange?.(event.target.value)}>
            {modifierOptions.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {specialOptions && specialOptions.length > 0 && (
        <div className={styles.rowSpecialSelectWrapper} data-capture-ignore="true">
          <select
            className={`${styles.rowSpecialSelect} app-select`}
            value={specialValue ?? ''}
            onChange={(event) => onSpecialChange?.(event.target.value)}
          >
            <option value="">{t('keymap.specialBinds')}</option>
            {specialOptions.map(option => (
              <option key={option.value || 'placeholder'} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.primaryBindingRow}>
        <button
          type="button"
          className={`${styles.bindingInput} ${isCapturing ? styles.bindingInputRecording : ''}`}
          onClick={onBeginCapture}
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          className={`${styles.clearBindingBtn}`}
          onClick={handleClear}
          disabled={!isManual && disableClear}
          data-capture-ignore="true"
        >
          {clearLabel}
        </button>
        {isCapturing && (
          <button type="button" className="link-btn" onClick={onCancelCapture} data-capture-ignore="true">
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
