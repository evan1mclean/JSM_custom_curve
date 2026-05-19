import { useTranslation } from 'react-i18next'
import { KeymapSection } from '../KeymapSection'
import keymapStyles from '../Keymap.module.css'
import { SectionActions } from '../SectionActions'

type TriggerControlsSectionProps = {
  adaptiveTriggerValue: string
  onAdaptiveTriggerChange: (value: string) => void
  triggerThreshold: number
  onTriggerThresholdChange: (value: string) => void
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  applyDisabled?: boolean
}

export function TriggerControlsSection({
  adaptiveTriggerValue,
  onAdaptiveTriggerChange,
  triggerThreshold,
  onTriggerThresholdChange,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled,
}: TriggerControlsSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <KeymapSection title={t('keymap.triggerControlsTitle')} description={t('keymap.triggerControlsDescription')}>
        <div className={keymapStyles.globalControls} data-capture-ignore="true">
          <div className={keymapStyles.globalControlRow}>
            <div className={keymapStyles.globalControlText}>
              <span className={keymapStyles.globalControlTitle}>{t('keymap.adaptiveTriggers')}</span>
            </div>
            <div className={keymapStyles.globalControlInputGroup}>
              <select
                className="app-select"
                value={adaptiveTriggerValue}
                onChange={(event) => onAdaptiveTriggerChange(event.target.value)}
                disabled={applyDisabled}
              >
                <option value="">{t('common.defaultValue', { value: 'ON' })}</option>
                <option value="OFF">{t('common.off')}</option>
              </select>
            </div>
          </div>
          <div className={keymapStyles.globalControlRow}>
            <div className={keymapStyles.globalControlText}>
              <span className={keymapStyles.globalControlTitle}>{t('keymap.triggerThreshold')}</span>
              <span className={keymapStyles.globalControlCaption}>
                {triggerThreshold > 0
                  ? t('keymap.triggerThresholdCustom', { value: triggerThreshold.toFixed(2) })
                  : t('keymap.triggerThresholdDefault')}
              </span>
            </div>
            <div className={keymapStyles.globalControlInputGroup}>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={triggerThreshold}
                onChange={(event) => onTriggerThresholdChange(event.target.value)}
                disabled={applyDisabled}
              />
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
