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
  const buttonLabel = isCapturing ? captureLabel : displayValue || 'Click to set binding'
  const clearLabel = isManual ? 'Remove Row' : 'Clear'
  const handleClear = () => {
    onClear()
    if (isManual) {
      onRemoveRow?.()
    }
  }
  return (
    <div className="binding-row">
      {showHeader && (
        <div className="binding-row-header">
          <span>{label}</span>
        </div>
      )}
      {modifierOptions && modifierOptions.length > 0 && (
        <div className="row-modifier-select" data-capture-ignore="true">
          <label>{modifierLabel ?? 'Modifier button'}</label>
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
        <div className="row-special-select-wrapper" data-capture-ignore="true">
          <select
            className="row-special-select app-select"
            value={specialValue ?? ''}
            onChange={(event) => onSpecialChange?.(event.target.value)}
          >
            <option value="">Special Binds</option>
            {specialOptions.map(option => (
              <option key={option.value || 'placeholder'} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="primary-binding-row">
        <button type="button" className={`binding-input ${isCapturing ? 'recording' : ''}`} onClick={onBeginCapture}>
          {buttonLabel}
        </button>
        <button
          type="button"
          className="clear-binding-btn"
          onClick={handleClear}
          disabled={!isManual && disableClear}
          data-capture-ignore="true"
        >
          {clearLabel}
        </button>
        {isCapturing && (
          <button type="button" className="link-btn" onClick={onCancelCapture} data-capture-ignore="true">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
