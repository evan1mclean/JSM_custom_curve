import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import rwcGuideImage from '../assets/docs/mouse-sensitivity_guide.png'
import { SectionActions } from './SectionActions'

const MOUSE_SENSITIVITY_URL = 'https://www.mouse-sensitivity.com'

type RwcGuideModalProps = {
  isOpen: boolean
  inGameSens: string
  onClose: () => void
  onApplyRwc: (rwc: string) => void
}

export function RwcGuideModal({ isOpen, inGameSens, onClose, onApplyRwc }: RwcGuideModalProps) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState('')
  const [sens, setSens] = useState('')

  if (!isOpen) return null

  const effectiveSens = sens !== '' ? sens : inGameSens
  const countsNum = parseFloat(counts)
  const sensNum = parseFloat(effectiveSens)
  const computed = !isNaN(countsNum) && !isNaN(sensNum) && countsNum > 0 && sensNum > 0 ? sensNum / (360 / countsNum) : null

  function handleApply() {
    if (computed !== null) {
      onApplyRwc(computed.toFixed(4))
      setCounts('')
      setSens('')
      onClose()
    }
  }

  function handleCancel() {
    setCounts('')
    setSens('')
    onClose()
  }

  function handleLinkClick(e: React.MouseEvent) {
    e.preventDefault()
    window.electronAPI?.openExternal?.(MOUSE_SENSITIVITY_URL)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{t('rwcGuide.title')}</h3>
          <button className="secondary-btn" onClick={handleCancel}>
            {t('common.close')}
          </button>
        </div>
        <p className="modal-description">
          {t('rwcGuide.description', { site: 'mouse-sensitivity.com' }).split('mouse-sensitivity.com')[0]}
          <a href={MOUSE_SENSITIVITY_URL} onClick={handleLinkClick}>
            mouse-sensitivity.com
          </a>
          {t('rwcGuide.description', { site: 'mouse-sensitivity.com' }).split('mouse-sensitivity.com').slice(1).join('mouse-sensitivity.com')}
        </p>
        <ol className="modal-description">
          <li>{t('rwcGuide.step1')}</li>
          <li>{t('rwcGuide.step2')}</li>
          <li>{t('rwcGuide.step3')}</li>
          <li>{t('rwcGuide.step4')}</li>
          <li>
            {t('rwcGuide.step5')}
            <br />
            <code>RWC = sensitivity / (360 / counts)</code>
          </li>
        </ol>
        <img
          src={rwcGuideImage}
          alt={t('rwcGuide.imageAlt')}
          style={{ width: '100%', borderRadius: 6, marginTop: 8, marginBottom: 8 }}
        />
        <div className="flex-inputs">
          <label>
            {t('rwcGuide.inGameSensitivity')}
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder={inGameSens || t('rwcGuide.exampleSensitivity')}
              value={sens}
              onChange={(e) => setSens(e.target.value)}
            />
          </label>
          <label>
            {t('rwcGuide.counts')}
            <input
              type="number"
              step="1"
              min="1"
              placeholder={t('rwcGuide.exampleCounts')}
              value={counts}
              onChange={(e) => setCounts(e.target.value)}
            />
          </label>
        </div>
        {computed !== null && (
          <div className="flex-inputs">
            <label>
              {t('rwcGuide.computedRwc')}
              <input type="number" readOnly value={computed.toFixed(4)} />
            </label>
          </div>
        )}
        <SectionActions
          hasPendingChanges={counts !== '' || sens !== ''}
          statusMessage={null}
          applyDisabled={computed === null}
          onApply={handleApply}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
