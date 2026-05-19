import { useTranslation } from 'react-i18next'
import { KeymapSection } from '../KeymapSection'
import keymapStyles from '../Keymap.module.css'
import styles from './Touchpad.module.css'
import { SectionActions } from '../SectionActions'

type TouchpadSettingsSectionProps = {
  touchpadMode: string
  gridColumns: number
  gridRows: number
  onTouchpadModeChange?: (value: string) => void
  onGridSizeChange?: (cols: number, rows: number) => void
  touchpadSensitivity?: number
  onTouchpadSensitivityChange?: (value: string) => void
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  applyDisabled?: boolean
}

export function TouchpadSettingsSection({
  touchpadMode,
  gridColumns,
  gridRows,
  onTouchpadModeChange,
  onGridSizeChange,
  touchpadSensitivity,
  onTouchpadSensitivityChange,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled,
}: TouchpadSettingsSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <KeymapSection title={t('keymap.touchpadSettingsTitle')} description={t('keymap.touchpadSettingsDescription')}>
        <div className={styles.touchpadSettings}>
          <label>
            {t('keymap.mode')}
            <select className="app-select" value={touchpadMode} onChange={(event) => onTouchpadModeChange?.(event.target.value)}>
              <option value="">{t('common.noneSelected')}</option>
              <option value="GRID_AND_STICK">{t('keymap.gridAndStick')}</option>
              <option value="MOUSE">{t('keymap.mouse')}</option>
            </select>
          </label>
          {touchpadMode === 'GRID_AND_STICK' && (
            <>
              <div className={styles.gridSizeInputs}>
                <label>
                  {t('keymap.columns')}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={gridColumns}
                    onChange={(event) => onGridSizeChange?.(Number(event.target.value) || 1, gridRows)}
                  />
                </label>
                <label>
                  {t('keymap.rows')}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={gridRows}
                    onChange={(event) => onGridSizeChange?.(gridColumns, Number(event.target.value) || 1)}
                  />
                </label>
              </div>
              <small className={styles.gridLimitHint}>{t('common.rowsColsCannotExceed')}</small>
            </>
          )}
          {touchpadMode === 'MOUSE' && (
            <label>
              {t('keymap.touchpadSensitivity')}
              <input
                type="number"
                step="0.1"
                value={touchpadSensitivity ?? ''}
                onChange={(event) => onTouchpadSensitivityChange?.(event.target.value)}
                placeholder={t('common.defaultPlaceholder')}
              />
            </label>
          )}
        </div>
      </KeymapSection>
      <SectionActions
        className={keymapStyles.keymapSectionActions}
        hasPendingChanges={hasPendingChanges}
        statusMessage={statusMessage}
        onApply={onApply}
        onCancel={onCancel}
        applyDisabled={applyDisabled}
      />
    </>
  )
}
