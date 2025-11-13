type ConfigEditorProps = {
  value: string
  onChange: (value: string) => void
  onApply: () => void
  statusMessage: string | null
}

export function ConfigEditor({ value, onChange, onApply, statusMessage }: ConfigEditorProps) {
  return (
    <section className="config-panel legacy">
      <label>
        keymap_01.txt
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={12} />
      </label>
      <div className="config-actions">
        <button onClick={onApply}>Apply Changes</button>
      </div>
      {statusMessage && <p className="status-message">{statusMessage}</p>}
    </section>
  )
}
