import { ipcRenderer, contextBridge } from 'electron'

const electronAPI = {
  launchJSM: (calibrationSeconds = 5) => ipcRenderer.invoke('launch-jsm', calibrationSeconds),
  terminateJSM: () => ipcRenderer.invoke('terminate-jsm'),
  minimizeTemporarily: () => ipcRenderer.invoke('minimize-temporarily'),
  recalibrateGyro: () => ipcRenderer.invoke('recalibrate-gyro'),
  applyProfile: (profilePath: string, text: string) => ipcRenderer.invoke('apply-profile', profilePath, text),
  getCalibrationSeconds: () => ipcRenderer.invoke('get-calibration-seconds'),
  setCalibrationSeconds: (seconds: number) => ipcRenderer.invoke('set-calibration-seconds', seconds),
  listLibraryProfiles: () => ipcRenderer.invoke('library-list-profiles'),
  createLibraryProfile: (preferredBaseName?: string) => ipcRenderer.invoke('library-create-profile', preferredBaseName),
  saveLibraryProfile: (name: string, content: string) => ipcRenderer.invoke('library-save-profile', name, content),
  renameLibraryProfile: (oldName: string, newName: string) => ipcRenderer.invoke('library-rename-profile', oldName, newName),
  loadLibraryProfile: (name: string) => ipcRenderer.invoke('library-load-profile', name),
  deleteLibraryProfile: (name: string) => ipcRenderer.invoke('library-delete-profile', name),
  copyActiveProfile: () => ipcRenderer.invoke('library-copy-active-profile'),
  getActiveProfile: () => ipcRenderer.invoke('get-active-profile'),
  activateLibraryProfile: (name: string) => ipcRenderer.invoke('activate-library-profile', name),
  loadCalibrationPreset: () => ipcRenderer.invoke('load-calibration-preset'),
  readCalibrationPreset: () => ipcRenderer.invoke('read-calibration-preset'),
  saveCalibrationPreset: (content: string) => ipcRenderer.invoke('save-calibration-preset', content),
  runCalibrationCommand: (command: string) => ipcRenderer.invoke('calibration-run-command', command),
  getBackendChoice: () => ipcRenderer.invoke('get-backend-choice'),
  setBackendChoice: (choice: 'SDL' | 'legacy') => ipcRenderer.invoke('set-backend-choice', choice),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
}

const telemetryListeners = new Set<(payload: unknown) => void>()
ipcRenderer.on('telemetry-sample', (_event, payload) => {
  telemetryListeners.forEach(listener => {
    try {
      listener(payload)
    } catch (err) {
      console.error('[telemetry] renderer listener failed', err)
    }
  })
})

const calibrationListeners = new Set<(payload: { calibrating: boolean; seconds?: number }) => void>()
ipcRenderer.on('calibration-status', (_event, payload) => {
  calibrationListeners.forEach(listener => {
    try {
      listener(payload)
    } catch (err) {
      console.error('[calibration] renderer listener failed', err)
    }
  })
})

const updateAvailableListeners = new Set<(version: string) => void>()
ipcRenderer.on('update-available', (_event, version: string) => {
  updateAvailableListeners.forEach(listener => {
    try {
      listener(version)
    } catch (err) {
      console.error('[updater] update-available listener failed', err)
    }
  })
})

const updateDownloadedListeners = new Set<() => void>()
ipcRenderer.on('update-downloaded', () => {
  updateDownloadedListeners.forEach(listener => {
    try {
      listener()
    } catch (err) {
      console.error('[updater] update-downloaded listener failed', err)
    }
  })
})

const updateProgressListeners = new Set<(percent: number) => void>()
ipcRenderer.on('update-download-progress', (_event, percent: number) => {
  updateProgressListeners.forEach(listener => {
    try {
      listener(percent)
    } catch (err) {
      console.error('[updater] download-progress listener failed', err)
    }
  })
})

const telemetryAPI = {
  onSample: (callback: (payload: unknown) => void) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    telemetryListeners.add(callback)
    return () => telemetryListeners.delete(callback)
  },
}

contextBridge.exposeInMainWorld('electronAPI', {
  ...electronAPI,
  onCalibrationStatus: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    calibrationListeners.add(callback)
    return () => calibrationListeners.delete(callback)
  },
  onUpdateAvailable: (callback: (version: string) => void) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    updateAvailableListeners.add(callback)
    return () => updateAvailableListeners.delete(callback)
  },
  onUpdateDownloaded: (callback: () => void) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    updateDownloadedListeners.add(callback)
    return () => updateDownloadedListeners.delete(callback)
  },
  onUpdateDownloadProgress: (callback: (percent: number) => void) => {
    if (typeof callback !== 'function') {
      return () => {}
    }
    updateProgressListeners.add(callback)
    return () => updateProgressListeners.delete(callback)
  },
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
})
contextBridge.exposeInMainWorld('telemetry', telemetryAPI)
