import { ReactNode } from 'react'

type KeymapSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

export function KeymapSection({ title, description, children }: KeymapSectionProps) {
  return (
    <section className="keymap-section">
      <div className="keymap-section-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

