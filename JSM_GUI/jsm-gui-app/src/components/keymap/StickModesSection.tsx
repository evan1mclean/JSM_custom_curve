import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { KeymapSection } from '../KeymapSection'
import keymapStyles from '../Keymap.module.css'
import { SectionActions } from '../SectionActions'
import { StickSettingsCard } from '../StickSettingsCard'

type StickModesSectionProps = {
  leftExtras?: ReactNode | null
  rightExtras?: ReactNode | null
  leftDeadzone: { inner: string; outer: string }
  rightDeadzone: { inner: string; outer: string }
  deadzoneDefaults: { inner: string; outer: string }
  leftMode: { mode: string; ring: string }
  rightMode: { mode: string; ring: string }
  onModeChange: (side: 'LEFT' | 'RIGHT', value: string) => void
  onRingChange: (side: 'LEFT' | 'RIGHT', value: string) => void
  onDeadzoneChange: (side: 'LEFT' | 'RIGHT', type: 'INNER' | 'OUTER', value: string) => void
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  disabled?: boolean
  applyDisabled?: boolean
}

export function StickModesSection({
  leftExtras,
  rightExtras,
  leftDeadzone,
  rightDeadzone,
  deadzoneDefaults,
  leftMode,
  rightMode,
  onModeChange,
  onRingChange,
  onDeadzoneChange,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  disabled,
  applyDisabled,
}: StickModesSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <KeymapSection title={t('keymap.leftStickTitle')} description={t('keymap.leftStickModesDescription')}>
        <StickSettingsCard
          title={t('keymap.leftStickTitle')}
          innerValue={leftDeadzone.inner}
          outerValue={leftDeadzone.outer}
          defaultInner={deadzoneDefaults.inner}
          defaultOuter={deadzoneDefaults.outer}
          modeValue={leftMode.mode}
          ringValue={leftMode.ring}
          onModeChange={(value) => onModeChange('LEFT', value)}
          onRingChange={(value) => onRingChange('LEFT', value)}
          disabled={disabled}
          onInnerChange={(value) => onDeadzoneChange('LEFT', 'INNER', value)}
          onOuterChange={(value) => onDeadzoneChange('LEFT', 'OUTER', value)}
          modeExtras={leftExtras}
        />
      </KeymapSection>
      <SectionActions
        className={keymapStyles.keymapSectionActions}
        hasPendingChanges={hasPendingChanges}
        statusMessage={statusMessage}
        onApply={onApply}
        onCancel={onCancel}
        applyDisabled={applyDisabled}
      />
      <KeymapSection title={t('keymap.rightStickTitle')} description={t('keymap.rightStickModesDescription')}>
        <StickSettingsCard
          title={t('keymap.rightStickTitle')}
          innerValue={rightDeadzone.inner}
          outerValue={rightDeadzone.outer}
          defaultInner={deadzoneDefaults.inner}
          defaultOuter={deadzoneDefaults.outer}
          modeValue={rightMode.mode}
          ringValue={rightMode.ring}
          onModeChange={(value) => onModeChange('RIGHT', value)}
          onRingChange={(value) => onRingChange('RIGHT', value)}
          disabled={disabled}
          onInnerChange={(value) => onDeadzoneChange('RIGHT', 'INNER', value)}
          onOuterChange={(value) => onDeadzoneChange('RIGHT', 'OUTER', value)}
          modeExtras={rightExtras}
        />
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
