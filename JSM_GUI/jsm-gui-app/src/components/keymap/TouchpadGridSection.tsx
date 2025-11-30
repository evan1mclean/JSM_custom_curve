import { ReactNode } from 'react'
import { KeymapSection } from '../KeymapSection'
import { SectionActions } from '../SectionActions'
import { type ButtonDefinition } from '../../keymap/schema'

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
  return (
    <>
      <KeymapSection
        title="Touchpad grid"
        description="This preview mirrors the touchpad. Configure each region using the rows below."
      >
        <div className="touchpad-grid-preview" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
          {Array.from({ length: gridCells }).map((_, index) => {
            const rowIndex = Math.floor(index / gridColumns)
            const colIndex = index % gridColumns
            return (
              <div className="touchpad-grid-cell" key={`cell-${index}`}>
                <span>T{index + 1}</span>
                <small>
                  Row {rowIndex + 1}, Col {colIndex + 1}
                </small>
              </div>
            )
          })}
        </div>
        <div className="touchpad-binding-list" data-touchpad-binding-list>
          <div className="keymap-grid">{touchpadButtons.map(renderButton)}</div>
        </div>
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
