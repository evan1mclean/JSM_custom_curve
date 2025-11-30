export const LOCK_MESSAGE = 'Calibrating — place controller on a flat surface'
export const PENDING_MESSAGE = 'Pending changes — click Apply to send to JoyShockMapper.'

export const APPLY_KEYMAP_FAILED = 'Failed to apply keymap.'
export const LOAD_PROFILE_FAILED = 'Failed to load profile from library.'
export const CREATE_PROFILE_FAILED = 'Failed to create profile.'
export const RENAME_PROFILE_FAILED = 'Failed to rename profile.'
export const DELETE_PROFILE_FAILED = 'Failed to delete profile.'
export const IMPORT_PROFILE_FAILED = 'Failed to import profile.'
export const EMPTY_PROFILE_NAME = 'Profile name cannot be empty.'

export const formatAppliedProfileMessage = (profileName: string, restarted: boolean) =>
  restarted
    ? `Applied ${profileName} to JoyShockMapper (restarted).`
    : `Applied ${profileName} to JoyShockMapper.`

export const formatLoadedProfileMessage = (profileName: string) =>
  `Loaded "${profileName}" from library and applied it to JoyShockMapper.`

export const formatDeletedProfileMessage = (profileName: string) => `Deleted "${profileName}" from library.`

export const formatImportedProfileMessage = (profileName: string) =>
  `Imported "${profileName}" into the editor. Click Apply to use it.`

// Calibration
export const CALIBRATION_PRESET_LOADED = 'Calibration preset loaded.'
export const CALIBRATION_PRESET_FAILED = 'Failed to load calibration preset.'
export const CALIBRATION_NO_RESPONSE = 'No response captured.'
export const formatCalibrationRunFailed = (err: unknown) => `Failed to run calculation: ${String(err)}`
