import { PENDING_MESSAGE } from '../constants/messages'

type SectionActionsProps = {
  className?: string
  hasPendingChanges: boolean
  statusMessage?: string | null
  onApply: () => void
  onCancel?: () => void
  applyDisabled?: boolean
  applyLabel?: string
  cancelLabel?: string
  pendingMessage?: string
}

export function SectionActions({
  className = 'control-actions',
  hasPendingChanges,
  statusMessage,
  onApply,
  onCancel,
  applyDisabled = false,
  applyLabel = 'Apply Changes',
  cancelLabel = 'Cancel',
  pendingMessage = PENDING_MESSAGE,
}: SectionActionsProps) {
  return (
    <div className={className}>
      <button className="secondary-btn" onClick={onApply} disabled={applyDisabled}>
        {applyLabel}
      </button>
      {hasPendingChanges ? (
        <>
          {onCancel && (
            <button className="secondary-btn" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <span className="pending-banner">{pendingMessage}</span>
        </>
      ) : statusMessage ? (
        <span className="pending-banner success">{statusMessage}</span>
      ) : null}
    </div>
  )
}
