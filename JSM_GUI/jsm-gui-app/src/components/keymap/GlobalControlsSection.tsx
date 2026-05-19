import { useTranslation } from 'react-i18next'
import { KeymapSection } from '../KeymapSection'
import keymapStyles from '../Keymap.module.css'
import { SectionActions } from '../SectionActions'

type GlobalControlsSectionProps = {
  holdPressTimeSeconds: number
  holdPressTimeIsCustom: boolean
  holdPressTimeDefault: number
  onHoldPressTimeChange: (value: string) => void
  doublePressWindowSeconds: number
  doublePressWindowIsCustom: boolean
  onDoublePressWindowChange: (value: string) => void
  simPressWindowSeconds: number
  simPressWindowIsCustom: boolean
  onSimPressWindowChange: (value: string) => void
  lightBarColor: string | null
  onLightBarChange: (color: string | null) => void
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  applyDisabled?: boolean
}

export function GlobalControlsSection({
  holdPressTimeSeconds,
  holdPressTimeIsCustom,
  holdPressTimeDefault,
  onHoldPressTimeChange,
  doublePressWindowSeconds,
  doublePressWindowIsCustom,
  onDoublePressWindowChange,
  simPressWindowSeconds,
  simPressWindowIsCustom,
  onSimPressWindowChange,
  lightBarColor,
  onLightBarChange,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled,
}: GlobalControlsSectionProps) {
  const { t } = useTranslation()

  const renderRow = (title: string, caption: string, value: number, onChange: (value: string) => void) => (
    <div className={keymapStyles.globalControlRow} data-capture-ignore="true">
      <div className={keymapStyles.globalControlText}>
        <span className={keymapStyles.globalControlTitle}>{title}</span>
        <span className={keymapStyles.globalControlCaption}>{caption}</span>
      </div>
      <div className={keymapStyles.globalControlInputGroup}>
        <input type="number" min="0" max="1" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
        <span className={keymapStyles.globalControlUnit}>{t('common.seconds')}</span>
      </div>
    </div>
  )

  return (
    <>
      <KeymapSection title={t('keymap.globalControlsTitle')} description={t('keymap.globalControlsDescription')}>
        <div className={keymapStyles.globalControls}>
          {renderRow(
            t('keymap.tapVsHoldPressThreshold'),
            holdPressTimeIsCustom ? t('keymap.customHoldPressTimeSaved') : t('keymap.usingDefaultMs', { ms: Math.round(holdPressTimeDefault * 1000) }),
            holdPressTimeSeconds,
            onHoldPressTimeChange
          )}
          {renderRow(
            t('keymap.doublePressWindow'),
            doublePressWindowIsCustom ? t('keymap.customDoublePressWindowSaved') : t('keymap.usingDefaultMs', { ms: Math.round(holdPressTimeDefault * 1000) }),
            doublePressWindowSeconds,
            onDoublePressWindowChange
          )}
          {renderRow(
            t('keymap.simultaneousPressWindow'),
            simPressWindowIsCustom ? t('keymap.customSimPressWindowSaved') : t('keymap.usingDefaultMs', { ms: Math.round(holdPressTimeDefault * 1000) }),
            simPressWindowSeconds,
            onSimPressWindowChange
          )}
          <div className={keymapStyles.globalControlRow} data-capture-ignore="true">
            <div className={keymapStyles.globalControlText}>
              <span className={keymapStyles.globalControlTitle}>{t('keymap.lightBarColor')}</span>
              <span className={keymapStyles.globalControlCaption}>
                {lightBarColor ? t('keymap.lightBarColorSet', { value: lightBarColor.slice(1).toLowerCase() }) : t('keymap.lightBarColorDefault')}
              </span>
            </div>
            <div className={keymapStyles.globalControlInputGroup}>
              <input
                type="color"
                value={lightBarColor ?? '#ffffff'}
                onChange={(e) => onLightBarChange(e.target.value)}
                className={keymapStyles.lightBarColorPicker}
              />
              {lightBarColor && (
                <button type="button" className={keymapStyles.lightBarClearBtn} onClick={() => onLightBarChange(null)}>
                  {t('common.clear')}
                </button>
              )}
            </div>
          </div>
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
