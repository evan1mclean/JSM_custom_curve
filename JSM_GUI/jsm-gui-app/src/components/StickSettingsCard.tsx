import { ReactNode } from 'react'
import { STICK_MODE_VALUES, formatStickModeLabel } from '../constants/sticks'

type StickSettingsCardProps = {
  title: string
  innerValue: string
  outerValue: string
  defaultInner: string
  defaultOuter: string
  modeValue: string
  ringValue: string
  onModeChange: (value: string) => void
  onRingChange: (value: string) => void
  disabled?: boolean
  onInnerChange: (value: string) => void
  onOuterChange: (value: string) => void
  modeExtras?: ReactNode
}

const clamp = (value: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function StickSettingsCard({
  title,
  innerValue,
  outerValue,
  defaultInner,
  defaultOuter,
  modeValue,
  ringValue,
  onModeChange,
  onRingChange,
  disabled = false,
  onInnerChange,
  onOuterChange,
  modeExtras,
}: StickSettingsCardProps) {
  const resolvedInner = clamp(parseFloat(innerValue || defaultInner))
  const resolvedOuter = clamp(parseFloat(outerValue || defaultOuter))

  const selectableStickModes = STICK_MODE_VALUES.filter(mode => mode !== 'NO_MOUSE')

  return (
    <div className="stick-mode-card" data-capture-ignore="true">
      <h3>{title}</h3>
      <label>
        Stick mode
        <select
          className="app-select"
          value={modeValue}
          onChange={(event) => onModeChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">Default ({formatStickModeLabel('NO_MOUSE')})</option>
          {selectableStickModes.map(mode => (
            <option key={mode} value={mode}>
              {formatStickModeLabel(mode)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ring mode
        <select
          className="app-select"
          value={ringValue}
          onChange={(event) => onRingChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">Default (OUTER)</option>
          <option value="INNER">Inner</option>
          <option value="OUTER">Outer</option>
        </select>
      </label>
      <label>
        Inner deadzone {innerValue ? '' : `(default ${defaultInner})`}
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={innerValue}
          placeholder={defaultInner}
          onChange={(event) => onInnerChange(event.target.value)}
          disabled={disabled}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={resolvedInner}
          onChange={(event) => onInnerChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Outer deadzone {outerValue ? '' : `(default ${defaultOuter})`}
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={outerValue}
          placeholder={defaultOuter}
          onChange={(event) => onOuterChange(event.target.value)}
          disabled={disabled}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={resolvedOuter}
          onChange={(event) => onOuterChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      {modeExtras && <div className="stick-mode-extras">{modeExtras}</div>}
    </div>
  )
}
