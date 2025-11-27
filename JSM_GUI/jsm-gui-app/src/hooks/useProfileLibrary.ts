import { useCallback, useEffect, useState } from 'react'
import { ensureHeaderLines, sanitizeImportedConfig } from '../utils/config'

type ApplyConfigOptions = {
  profileNameOverride?: string
  textOverride?: string
  profilePathOverride?: string
}

type UseProfileLibraryParams = {
  configText: string
  setConfigText: (value: string) => void
  setAppliedConfig: (value: string) => void
  setStatusMessage: (value: string | null) => void
}

export function useProfileLibrary({
  configText,
  setConfigText,
  setAppliedConfig,
  setStatusMessage,
}: UseProfileLibraryParams) {
  const [libraryProfiles, setLibraryProfiles] = useState<string[]>([])
  const [isLibraryLoading, setIsLibraryLoading] = useState(false)
  const [editedLibraryNames, setEditedLibraryNames] = useState<Record<string, string>>({})
  const [currentLibraryProfile, setCurrentLibraryProfile] = useState<string | null>(null)
  const [activeProfilePath, setActiveProfilePath] = useState<string>('')

  const refreshLibraryProfiles = useCallback(async (): Promise<string[]> => {
    if (!window.electronAPI?.listLibraryProfiles) {
      setLibraryProfiles([])
      setEditedLibraryNames({})
      return []
    }
    setIsLibraryLoading(true)
    try {
      const entries = await window.electronAPI.listLibraryProfiles()
      const sorted = entries ?? []
      setLibraryProfiles(sorted)
      setEditedLibraryNames(prev => {
        const next: Record<string, string> = {}
        sorted.forEach(name => {
          next[name] = prev[name] ?? name
        })
        return next
      })
      return sorted
    } catch (err) {
      console.error('Failed to load profile library', err)
      setLibraryProfiles([])
      setEditedLibraryNames({})
      return []
    } finally {
      setIsLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshLibraryProfiles()
  }, [refreshLibraryProfiles])

  useEffect(() => {
    const loadActiveProfile = async () => {
      if (!window.electronAPI?.getActiveProfile) return
      try {
        const result = await window.electronAPI.getActiveProfile()
        if (result) {
          setConfigText(result.content ?? '')
          setAppliedConfig(result.content ?? '')
          setCurrentLibraryProfile(result.name ?? null)
          setActiveProfilePath(result.path ?? '')
        }
      } catch (err) {
        console.error('Failed to load active profile', err)
      }
    }
    loadActiveProfile()
  }, [setAppliedConfig, setConfigText])

  const applyConfig = useCallback(
    async (options?: ApplyConfigOptions) => {
      const sourceText = options?.textOverride ?? configText
      const sanitizedConfig = ensureHeaderLines(sourceText)
      if (options?.textOverride !== undefined) {
        setConfigText(sanitizedConfig)
      } else if (sanitizedConfig !== configText) {
        setConfigText(sanitizedConfig)
      }
      try {
        const targetPath = options?.profilePathOverride ?? activeProfilePath
        const result = await window.electronAPI?.applyProfile?.(targetPath, sanitizedConfig)
        if (result?.path) {
          setActiveProfilePath(result.path)
        }
        const profileName = options?.profileNameOverride ?? currentLibraryProfile ?? 'Unsaved profile'
        setStatusMessage(
          result?.restarted
            ? `Applied ${profileName} to JoyShockMapper (restarted).`
            : `Applied ${profileName} to JoyShockMapper.`
        )
        setAppliedConfig(sanitizedConfig)
        setTimeout(() => setStatusMessage(null), 3000)
      } catch (err) {
        console.error(err)
        setStatusMessage('Failed to apply keymap.')
      }
    },
    [activeProfilePath, configText, currentLibraryProfile, setAppliedConfig, setConfigText, setStatusMessage]
  )

  const handleLoadProfileFromLibrary = useCallback(
    async (name: string): Promise<string | null> => {
      if (!window.electronAPI?.activateLibraryProfile) return null
      try {
        const result = await window.electronAPI.activateLibraryProfile(name)
        if (result?.content !== undefined) {
          const profileContent = result.content ?? ''
          const profileName = result.name ?? name
          const profilePath = result.path ?? ''
          setConfigText(profileContent)
          setAppliedConfig(profileContent)
          setCurrentLibraryProfile(profileName)
          setActiveProfilePath(profilePath)
          await applyConfig({
            profileNameOverride: profileName,
            textOverride: profileContent,
            profilePathOverride: profilePath,
          })
          setStatusMessage(`Loaded "${profileName}" from library and applied it to JoyShockMapper.`)
          setTimeout(() => setStatusMessage(null), 3000)
          return result.content
        }
      } catch (err) {
        console.error('Failed to load profile from library', err)
        setStatusMessage('Failed to load profile from library.')
        setTimeout(() => setStatusMessage(null), 3000)
        refreshLibraryProfiles()
      }
      return null
    },
    [applyConfig, refreshLibraryProfiles, setAppliedConfig, setConfigText, setStatusMessage]
  )

  const handleLibraryProfileNameChange = useCallback((originalName: string, value: string) => {
    setEditedLibraryNames(prev => ({
      ...prev,
      [originalName]: value,
    }))
  }, [])

  const handleCreateProfile = useCallback(async () => {
    if (!window.electronAPI?.createLibraryProfile) return
    try {
      const result = await window.electronAPI.createLibraryProfile()
      if (result) {
        const profileContent = result.content ?? ''
        const profileName = result.name ?? null
        const profilePath = result.path ?? ''
        setConfigText(profileContent)
        setAppliedConfig(profileContent)
        setCurrentLibraryProfile(profileName)
        setActiveProfilePath(profilePath)
        setEditedLibraryNames(prev => ({
          ...prev,
          [profileName ?? '']: profileName ?? '',
        }))
        await applyConfig({
          profileNameOverride: profileName ?? 'Unsaved profile',
          textOverride: profileContent,
          profilePathOverride: profilePath,
        })
        refreshLibraryProfiles()
      }
    } catch (err) {
      console.error('Failed to create profile', err)
      setStatusMessage('Failed to create profile.')
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }, [applyConfig, refreshLibraryProfiles, setAppliedConfig, setConfigText, setStatusMessage])

  const handleRenameProfile = useCallback(
    async (originalName: string) => {
      if (!window.electronAPI?.renameLibraryProfile) return
      const pendingName = (editedLibraryNames[originalName] ?? originalName).trim()
      if (!pendingName) {
        setStatusMessage('Profile name cannot be empty.')
        setTimeout(() => setStatusMessage(null), 3000)
        return
      }
      try {
        const result = await window.electronAPI.renameLibraryProfile(originalName, pendingName)
        if (result) {
          if (currentLibraryProfile === originalName) {
            setCurrentLibraryProfile(result.name ?? originalName)
            setActiveProfilePath(result.path ?? activeProfilePath)
            if (result.content !== undefined) {
              setConfigText(result.content)
              setAppliedConfig(result.content)
            }
          }
          setEditedLibraryNames(prev => {
            const next = { ...prev }
            delete next[originalName]
            next[result.name ?? originalName] = result.name ?? originalName
            return next
          })
          refreshLibraryProfiles()
        }
      } catch (err) {
        console.error('Failed to rename profile', err)
        setStatusMessage('Failed to rename profile.')
        setTimeout(() => setStatusMessage(null), 3000)
      }
    },
    [
      activeProfilePath,
      currentLibraryProfile,
      editedLibraryNames,
      refreshLibraryProfiles,
      setAppliedConfig,
      setConfigText,
      setStatusMessage,
    ]
  )

  const handleDeleteLibraryProfile = useCallback(
    async (name: string) => {
      if (!window.electronAPI?.deleteLibraryProfile) return
      try {
        const response = (await window.electronAPI.deleteLibraryProfile(name)) ?? { success: true }
        const entries = (await refreshLibraryProfiles()) ?? []
        setEditedLibraryNames(prev => {
          const next = { ...prev }
          delete next[name]
          if (response.fallback?.name) {
            next[response.fallback.name] = response.fallback.name
          }
          return next
        })
        if (currentLibraryProfile === name) {
          const fallback = response.fallback
          if (fallback) {
            setCurrentLibraryProfile(fallback.name ?? null)
            setConfigText(fallback.content ?? '')
            setAppliedConfig(fallback.content ?? '')
            setActiveProfilePath(fallback.path ?? '')
            await applyConfig({
              profileNameOverride: fallback.name ?? 'Unsaved profile',
              textOverride: fallback.content ?? '',
              profilePathOverride: fallback.path ?? '',
            })
          } else if (entries.length > 0) {
            const fallbackName = entries[0]
            const content = await handleLoadProfileFromLibrary(fallbackName)
            if (content !== null) {
              const relativePath = `profiles-library/${fallbackName}.txt`
              setCurrentLibraryProfile(fallbackName)
              setActiveProfilePath(relativePath)
              await applyConfig({
                profileNameOverride: fallbackName,
                textOverride: content,
                profilePathOverride: relativePath,
              })
            }
          } else {
            setCurrentLibraryProfile(null)
            setConfigText('')
            setAppliedConfig('')
            setActiveProfilePath('')
            await applyConfig({ profileNameOverride: 'Unsaved profile', textOverride: '', profilePathOverride: '' })
          }
        }
        setStatusMessage(`Deleted "${name}" from library.`)
        setTimeout(() => setStatusMessage(null), 3000)
      } catch (err) {
        console.error('Failed to delete profile', err)
        setStatusMessage('Failed to delete profile.')
        setTimeout(() => setStatusMessage(null), 3000)
      }
    },
    [
      applyConfig,
      currentLibraryProfile,
      handleLoadProfileFromLibrary,
      refreshLibraryProfiles,
      setAppliedConfig,
      setConfigText,
      setStatusMessage,
    ]
  )

  const handleImportProfile = useCallback(
    async (fileName: string, fileContent: string) => {
      if (!fileContent) return
      const baseName = fileName.replace(/\.[^/.]+$/, '') || fileName || 'Imported Profile'
      try {
        const sanitized = sanitizeImportedConfig(fileContent)
        const result = await window.electronAPI?.saveLibraryProfile?.(baseName, sanitized)
        const savedName = result?.name ?? baseName
        await handleLoadProfileFromLibrary(savedName)
        setStatusMessage(`Imported "${savedName}" into the editor. Click Apply to use it.`)
        setTimeout(() => setStatusMessage(null), 3000)
        refreshLibraryProfiles()
      } catch (err) {
        console.error('Failed to import profile', err)
        setStatusMessage('Failed to import profile.')
        setTimeout(() => setStatusMessage(null), 3000)
      }
    },
    [handleLoadProfileFromLibrary, refreshLibraryProfiles, setStatusMessage]
  )

  return {
    libraryProfiles,
    isLibraryLoading,
    editedLibraryNames,
    currentLibraryProfile,
    activeProfilePath,
    setCurrentLibraryProfile,
    setActiveProfilePath,
    refreshLibraryProfiles,
    applyConfig,
    handleLoadProfileFromLibrary,
    handleLibraryProfileNameChange,
    handleCreateProfile,
    handleRenameProfile,
    handleDeleteLibraryProfile,
    handleImportProfile,
    setEditedLibraryNames,
  }
}
