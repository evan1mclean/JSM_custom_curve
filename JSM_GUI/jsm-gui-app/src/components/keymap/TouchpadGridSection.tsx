import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type ButtonDefinition } from '../../keymap/schema'
import { KeymapSection } from '../KeymapSection'
import keymapStyles from '../Keymap.module.css'
import styles from './Touchpad.module.css'
import { SectionActions } from '../SectionActions'

type TouchpadGridSectionProps = {
  gridColumns: number
  gridCells: number
  renderButton: (button: ButtonDefinition) => ReactNode
  touchpadButtons: ButtonDefinition[]
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  applyDisabled?: boolean
}

export function TouchpadGridSection({
  gridColumns,
  gridCells,
  renderButton,
  touchpadButtons,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled,
}: TouchpadGridSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <KeymapSection title={t('keymap.touchpadGridTitle')} description={t('keymap.touchpadGridDescription')}>
        <div className={styles.touchpadGridPreview} style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {Array.from({ length: gridCells }).map((_, index) => {
            const rowIndex = Math.floor(index / gridColumns)
            const colIndex = index % gridColumns
            return (
              <div className={styles.touchpadGridCell} key={`cell-${index}`}>
                <span>T{index + 1}</span>
                <small>{t('common.rowCol', { row: rowIndex + 1, col: colIndex + 1 })}</small>
              </div>
            )
          })}
        </div>
        <div className={styles.touchpadBindingList} data-touchpad-binding-list>
          <div className={keymapStyles.keymapGrid}>
            {touchpadButtons.map(button => (
              <div key={button.command}>{renderButton(button)}</div>
            ))}
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
