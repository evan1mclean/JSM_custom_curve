import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import styles from './ProfileManager.module.css'

type ProfileManagerProps = {
  currentProfileName: string | null
  hasPendingChanges: boolean
  isCalibrating: boolean
  profileApplied: boolean
  onImportProfile?: (fileName: string, content: string) => void
  libraryProfiles: string[]
  libraryLoading?: boolean
  editedProfileNames: Record<string, string>
  onProfileNameChange: (originalName: string, value: string) => void
  onRenameProfile: (originalName: string) => void
  onDeleteProfile: (name: string) => void
  onAddProfile: () => void
  onLoadLibraryProfile: (name: string) => void
  lockMessage?: string
  onCopyActiveProfile?: () => void
}

export function ProfileManager({
  currentProfileName,
  hasPendingChanges,
  isCalibrating,
  profileApplied,
  onImportProfile,
  libraryProfiles,
  libraryLoading = false,
  editedProfileNames,
  onProfileNameChange,
  onRenameProfile,
  onDeleteProfile,
  onAddProfile,
  onLoadLibraryProfile,
  lockMessage,
  onCopyActiveProfile,
}: ProfileManagerProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [confirmingProfile, setConfirmingProfile] = useState<string | null>(null)

  useEffect(() => {
    setConfirmingProfile(null)
  }, [libraryProfiles])

  return (
    <Card className={`${styles.profileCard} profile-card`} lockable locked={isCalibrating} lockMessage={lockMessage}>
      {hasPendingChanges && (
        <div className={styles.profileFlags}>
          <span className={styles.profileWarning}>{t('profiles.unsavedChangesWarning')}</span>
        </div>
      )}

      <section className="profile-library">
        <div className={styles.profileLibraryHeader}>
          <div>
            <h3>{t('profiles.libraryTitle')}</h3>
            <p>{t('profiles.libraryDescription')}</p>
          </div>
          {libraryLoading && <span className={styles.profileLibraryLoading}>{t('common.refreshing')}</span>}
        </div>
        {libraryProfiles.length === 0 ? (
          <p className={styles.profileLibraryEmpty}>{t('profiles.empty')}</p>
        ) : (
          <ul className={styles.profileLibraryList}>
            {libraryProfiles.map(profileName => (
              <li
                key={profileName}
                className={`${styles.profileLibraryItem} ${currentProfileName === profileName ? styles.profileLibraryItemActive : ''}`}
              >
                <div className={styles.profileLibraryName}>
                  <input
                    type="text"
                    maxLength={80}
                    value={editedProfileNames[profileName] ?? profileName}
                    onChange={(event) => onProfileNameChange(profileName, event.target.value)}
                  />
                  {currentProfileName === profileName && <span className={styles.profileLibraryActiveBadge}>{t('profiles.active')}</span>}
                </div>
                <div className={styles.profileLibraryButtons}>
                  <button
                    className="secondary-btn"
                    onClick={() => onRenameProfile(profileName)}
                    disabled={
                      !((editedProfileNames[profileName] ?? profileName).trim()) ||
                      (editedProfileNames[profileName] ?? profileName).trim() === profileName
                    }
                  >
                    {t('common.save')}
                  </button>
                  {confirmingProfile === profileName ? (
                    <>
                      <button className="danger-btn" onClick={() => onDeleteProfile(profileName)}>
                        {t('profiles.confirmDelete')}
                      </button>
                      <button className="secondary-btn" onClick={() => setConfirmingProfile(null)}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary-btn" onClick={() => onLoadLibraryProfile(profileName)}>
                        {t('common.load')}
                      </button>
                      <button className="danger-btn" onClick={() => setConfirmingProfile(profileName)}>
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.profileLibraryActionsRow}>
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
                {t('profiles.addExistingConfig')}
              </button>
            )}
          </div>
          {onCopyActiveProfile && (
            <button className="secondary-btn" onClick={onCopyActiveProfile}>
              {t('profiles.copyActiveProfile')}
            </button>
          )}
          <button className="secondary-btn" onClick={onAddProfile}>
            {t('profiles.addProfile')}
          </button>
        </div>
      </section>

      {!profileApplied && <span className={styles.profileNotApplied}>{t('profiles.notRunningYet')}</span>}
    </Card>
  )
}
