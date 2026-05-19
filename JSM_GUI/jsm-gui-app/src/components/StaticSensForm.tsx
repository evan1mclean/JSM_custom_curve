import { useTranslation } from 'react-i18next'
import { SensitivityValues } from '../utils/keymap'

type StaticSensFormProps = {
  sensitivity: SensitivityValues
  onChangeX: (value: string) => void
  onChangeY: (value: string) => void
  onRollContributionChange: (value: string) => void
}

export function StaticSensForm({ sensitivity, onChangeX, onChangeY, onRollContributionChange }: StaticSensFormProps) {
  const { t } = useTranslation()

  const selectAllOnFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select()
  }

  const showRollContribution = sensitivity.gyroSpace?.trim().toUpperCase() === 'YAW_PLUS_ROLL'

  return (
    <>
      <div className="flex-inputs">
        <label>
          {t('sensitivity.staticSensX')}
          <input
            type="number"
            step="0.1"
            min="0"
            value={sensitivity.gyroSensX ?? ''}
            onChange={(e) => onChangeX(e.target.value)}
            onFocus={selectAllOnFocus}
          />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.gyroSensX ?? 0} onChange={(e) => onChangeX(e.target.value)} />
        </label>
        <label>
          {t('sensitivity.staticSensY')}
          <input
            type="number"
            step="0.1"
            min="0"
            value={sensitivity.gyroSensY ?? ''}
            onChange={(e) => onChangeY(e.target.value)}
            onFocus={selectAllOnFocus}
          />
          <input type="range" min="0" max="30" step="0.1" value={sensitivity.gyroSensY ?? 0} onChange={(e) => onChangeY(e.target.value)} />
        </label>
      </div>
      {showRollContribution && (
        <div className="flex-inputs">
          <label>
            {t('sensitivity.rollContribution')}
            <input
              type="number"
              step="1"
              min="-100"
              max="100"
              value={sensitivity.rollContribution ?? ''}
              onChange={(e) => onRollContributionChange(e.target.value)}
              onFocus={selectAllOnFocus}
            />
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={sensitivity.rollContribution ?? 0}
              onChange={(e) => onRollContributionChange(e.target.value)}
            />
          </label>
        </div>
      )}
    </>
  )
}
