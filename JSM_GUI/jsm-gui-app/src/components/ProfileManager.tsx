import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from './Card'

type ProfileInfo = {
  id: number
  name: string
}

type ProfileManagerProps = {
  profiles: ProfileInfo[]
  activeProfileId: number | null
  hasPendingChanges: boolean
  isCalibrating: boolean
  onSelectProfile: (profileId: number) => void
  onRenameProfile: (profileId: number, name: string) => void
  onCopyProfile: (sourceProfileId: number, targetProfileId: number) => void
  profileApplied: boolean
  copyStatus: string | null
  onApplyProfile: () => void
  applyDisabled?: boolean
  onImportProfile?: (fileContent: string) => void
}

export function ProfileManager({
  profiles,
  activeProfileId,
  hasPendingChanges,
  isCalibrating,
  onSelectProfile,
  onRenameProfile,
  onCopyProfile,
  profileApplied,
  copyStatus,
  onApplyProfile,
  applyDisabled = false,
  onImportProfile,
}: ProfileManagerProps) {
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({})
  const profileIds = useMemo(() => profiles.map(profile => profile.id), [profiles])
  const [copySource, setCopySource] = useState<number>(() => profileIds[0] ?? 1)
  const [copyTarget, setCopyTarget] = useState<number>(() => profileIds[1] ?? 2)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const drafts: Record<number, string> = {}
    profiles.forEach(profile => {
      drafts[profile.id] = profile.name
    })
    setNameDrafts(drafts)
    if (!profileIds.includes(copySource) && profileIds.length > 0) {
      setCopySource(profileIds[0])
    }
    if (!profileIds.includes(copyTarget) && profileIds.length > 1) {
      setCopyTarget(profileIds[1])
    }
  }, [profiles, profileIds, copySource, copyTarget])

  const handleRenameBlur = () => {
    if (!activeProfileId) return
    const draft = nameDrafts[activeProfileId]?.trim()
    if (!draft) {
      onRenameProfile(activeProfileId, `Profile ${activeProfileId}`)
      return
    }
    onRenameProfile(activeProfileId, draft)
  }

  return (
    <Card
      className="profile-card"
      lockable
      locked={isCalibrating}
      lockMessage="Profiles locked while JSM calibrates"
    >
      <div className="profile-card-header">
        <h2>Profiles</h2>
        {hasPendingChanges && <span className="profile-warning">Unsaved changes on current profile</span>}
      </div>
      <div className="profile-tabs">
        {profiles.map(profile => (
          <button
            key={profile.id}
            className={`pill-tab profile-tab ${profile.id === activeProfileId ? 'active' : ''}`}
            onClick={() => onSelectProfile(profile.id)}
          >
            {profile.name || `Profile ${profile.id}`}
          </button>
        ))}
      </div>
      {activeProfileId && (
        <label className="profile-name-edit">
          Profile Name
          <input
            type="text"
            maxLength={50}
            value={nameDrafts[activeProfileId] ?? ''}
            onChange={(event) =>
              setNameDrafts(prev => ({ ...prev, [activeProfileId]: event.target.value }))
            }
            onBlur={handleRenameBlur}
          />
        </label>
      )}
      <div className="profile-copy-row">
        <label>
          Copy from
          <select value={copySource} onChange={event => setCopySource(Number(event.target.value))}>
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name || `Profile ${profile.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Into slot
          <select value={copyTarget} onChange={event => setCopyTarget(Number(event.target.value))}>
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>
                {profile.name || `Profile ${profile.id}`}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary-btn"
          onClick={() => onCopyProfile(copySource, copyTarget)}
          disabled={copySource === copyTarget}
        >
          Copy Profile
        </button>
      </div>
      {copyStatus && <p className="profile-copy-status">{copyStatus}</p>}
      <div className="profile-actions">
        <input
          type="file"
          accept=".txt,.cfg,.ini,*/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (file && onImportProfile) {
              const text = await file.text()
              onImportProfile(text)
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
        />
        {onImportProfile && (
          <button className="primary-btn import-config-btn" onClick={() => fileInputRef.current?.click()}>
            Import Existing Config
          </button>
        )}
        {!profileApplied && activeProfileId && (
          <span className="profile-not-applied">Not running in JoyShockMapper yet</span>
        )}
        <button
          className="primary-btn apply-profile-btn"
          onClick={onApplyProfile}
          disabled={!activeProfileId || applyDisabled}
        >
          Apply Selected Profile
        </button>
      </div>
    </Card>
  )
}
