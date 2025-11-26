import { useEffect, useRef, useState } from 'react'
import { Card } from './Card'

type ProfileManagerProps = {
  currentProfileName: string | null
  hasPendingChanges: boolean
  isCalibrating: boolean
  profileApplied: boolean
  statusMessage?: string | null
  onImportProfile?: (fileName: string, content: string) => void
  libraryProfiles: string[]
  libraryLoading?: boolean
  editedProfileNames: Record<string, string>
  onProfileNameChange: (originalName: string, value: string) => void
  onRenameProfile: (originalName: string) => void
  onDeleteProfile: (name: string) => void
  onAddProfile: () => void
  onLoadLibraryProfile: (name: string) => void
  onApplyProfile?: () => void
  applyDisabled?: boolean
  lockMessage?: string
}

export function ProfileManager({
  currentProfileName,
  hasPendingChanges,
  isCalibrating,
  profileApplied,
  statusMessage,
  onImportProfile,
  libraryProfiles,
  libraryLoading = false,
  editedProfileNames,
  onProfileNameChange,
  onRenameProfile,
  onDeleteProfile,
  onAddProfile,
  onLoadLibraryProfile,
  onApplyProfile: _onApplyProfile,
  applyDisabled: _applyDisabled = false,
  lockMessage,
}: ProfileManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [confirmingProfile, setConfirmingProfile] = useState<string | null>(null)

  useEffect(() => {
    setConfirmingProfile(null)
  }, [libraryProfiles])

  return (
    <Card className="profile-card" lockable locked={isCalibrating} lockMessage={lockMessage}>
      <h2>
        <span>Profiles</span>
        {(hasPendingChanges || statusMessage) && (
          <div className="profile-flags">
            {statusMessage && <span className="profile-status">{statusMessage}</span>}
            {hasPendingChanges && <span className="profile-warning">Unsaved changes on current profile</span>}
          </div>
        )}
      </h2>

      <section className="profile-library">
        <div className="profile-library-header">
          <div>
            <h3>Library</h3>
            <p>Select a profile to load it into the editor, or rename/delete existing ones.</p>
          </div>
          {libraryLoading && <span className="profile-library-loading">Refreshing…</span>}
        </div>
        {libraryProfiles.length === 0 ? (
          <p className="profile-library-empty">No saved profiles yet. Click Add profile to get started.</p>
        ) : (
          <ul className="profile-library-list">
            {libraryProfiles.map(profileName => (
              <li key={profileName} className={currentProfileName === profileName ? 'active' : ''}>
                <div className="profile-library-name">
                  <input
                    type="text"
                    maxLength={80}
                    value={editedProfileNames[profileName] ?? profileName}
                    onChange={(event) => onProfileNameChange(profileName, event.target.value)}
                  />
                  {currentProfileName === profileName && <span className="profile-library-active-badge">Active</span>}
                </div>
                <div className="profile-library-buttons">
                  <button
                    className="secondary-btn"
                    onClick={() => onRenameProfile(profileName)}
                    disabled={
                      !((editedProfileNames[profileName] ?? profileName).trim()) ||
                      (editedProfileNames[profileName] ?? profileName).trim() === profileName
                    }
                  >
                    Save
                  </button>
                  {confirmingProfile === profileName ? (
                    <>
                      <button className="danger-btn" onClick={() => onDeleteProfile(profileName)}>
                        Confirm delete
                      </button>
                      <button className="secondary-btn" onClick={() => setConfirmingProfile(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary-btn" onClick={() => onLoadLibraryProfile(profileName)}>
                        Load
                      </button>
                      <button className="danger-btn" onClick={() => setConfirmingProfile(profileName)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="profile-library-actions-row">
          <div className="profile-import">
            <input
              type="file"
              accept=".txt,.cfg,.ini,*/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (file && onImportProfile) {
                  const text = await file.text()
                  onImportProfile(file.name, text)
                }
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
            />
            {onImportProfile && (
              <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                Add Existing Config
              </button>
            )}
          </div>
          <button className="secondary-btn" onClick={onAddProfile}>
            Add profile
          </button>
        </div>
      </section>

      {!profileApplied && <span className="profile-not-applied">Not running in JoyShockMapper yet</span>}
    </Card>
  )
}
