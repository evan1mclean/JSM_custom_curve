import { useTranslation } from 'react-i18next'

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
  applyLabel,
  cancelLabel,
  pendingMessage,
}: SectionActionsProps) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <button className="secondary-btn" onClick={onApply} disabled={applyDisabled}>
        {applyLabel ?? t('common.applyChanges')}
      </button>
      {hasPendingChanges ? (
        <>
          {onCancel && (
            <button className="secondary-btn" onClick={onCancel}>
              {cancelLabel ?? t('common.cancel')}
            </button>
          )}
          <span className="pill pill--warning">{pendingMessage ?? t('messages.pendingChanges')}</span>
        </>
      ) : statusMessage ? (
        <span className="pill pill--success">{statusMessage}</span>
      ) : null}
    </div>
  )
}
