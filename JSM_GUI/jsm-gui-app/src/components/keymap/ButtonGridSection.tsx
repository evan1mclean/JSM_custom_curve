import { ReactNode } from 'react'
import { KeymapSection } from '../KeymapSection'
import { SectionActions } from '../SectionActions'
import { type ButtonDefinition } from '../../keymap/schema'

type ButtonGridSectionProps = {
  title: string
  description: string
  buttons: ButtonDefinition[]
  renderButton: (button: ButtonDefinition) => ReactNode
  extraContent?: ReactNode
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel: () => void
  applyDisabled?: boolean
}

export function ButtonGridSection({
  title,
  description,
  buttons,
  renderButton,
  extraContent,
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled,
}: ButtonGridSectionProps) {
  return (
    <>
      <KeymapSection title={title} description={description}>
        <div className="keymap-grid">{buttons.map(renderButton)}</div>
        {extraContent}
      </KeymapSection>
      <SectionActions
        className="keymap-section-actions"
        hasPendingChanges={hasPendingChanges}
        statusMessage={statusMessage}
        onApply={onApply}
        onCancel={onCancel}
        applyDisabled={applyDisabled}
      />
    </>
  )
}
