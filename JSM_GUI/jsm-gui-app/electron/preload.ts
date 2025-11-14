import { ipcRenderer, contextBridge } from 'electron'

const electronAPI = {
  launchJSM: (calibrationSeconds = 5) => ipcRenderer.invoke('launch-jsm', calibrationSeconds),
  terminateJSM: () => ipcRenderer.invoke('terminate-jsm'),
  minimizeTemporarily: () => ipcRenderer.invoke('minimize-temporarily'),
  recalibrateGyro: () => ipcRenderer.invoke('recalibrate-gyro'),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  loadProfile: (profileId?: number) => ipcRenderer.invoke('load-profile', profileId),
  applyProfile: (profileId: number, text: string) => ipcRenderer.invoke('apply-profile', profileId, text),
  setActiveProfile: (profileId: number) => ipcRenderer.invoke('set-active-profile', profileId),
  renameProfile: (profileId: number, name: string) => ipcRenderer.invoke('rename-profile', profileId, name),
  copyProfile: (sourceId: number, targetId: number) => ipcRenderer.invoke('copy-profile', sourceId, targetId),
  getCalibrationSeconds: () => ipcRenderer.invoke('get-calibration-seconds'),
  setCalibrationSeconds: (seconds: number) => ipcRenderer.invoke('set-calibration-seconds', seconds),
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
})
contextBridge.exposeInMainWorld('telemetry', telemetryAPI)
