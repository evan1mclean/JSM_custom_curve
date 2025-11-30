import { KeymapSection } from '../KeymapSection'
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
  return (
    <>
      <KeymapSection title="Touchpad mode and grid" description="Adjust mode, grid size, and sensitivity for the touchpad.">
        <div className="touchpad-settings">
          <label>
            Mode
            <select className="app-select" value={touchpadMode} onChange={(event) => onTouchpadModeChange?.(event.target.value)}>
              <option value="">None selected</option>
              <option value="GRID_AND_STICK">Grid and Stick</option>
              <option value="MOUSE">Mouse</option>
            </select>
          </label>
          {touchpadMode === 'GRID_AND_STICK' && (
            <>
              <div className="grid-size-inputs">
                <label>
                  Columns
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={gridColumns}
                    onChange={(event) => onGridSizeChange?.(Number(event.target.value) || 1, gridRows)}
                  />
                </label>
                <label>
                  Rows
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={gridRows}
                    onChange={(event) => onGridSizeChange?.(gridColumns, Number(event.target.value) || 1)}
                  />
                </label>
              </div>
              <small className="grid-limit-hint">Columns × Rows cannot exceed 25 total regions.</small>
            </>
          )}
          {touchpadMode === 'MOUSE' && (
            <label>
              Touchpad sensitivity
              <input
                type="number"
                step="0.1"
                value={touchpadSensitivity ?? ''}
                onChange={(event) => onTouchpadSensitivityChange?.(event.target.value)}
                placeholder="Default"
              />
            </label>
          )}
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
