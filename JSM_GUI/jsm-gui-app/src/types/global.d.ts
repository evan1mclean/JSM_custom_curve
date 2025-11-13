declare interface Window {
  electronAPI?: {
    launchJSM: (calibrationSeconds?: number) => Promise<void>
    terminateJSM: () => Promise<void>
    saveKeymapFile?: (text: string) => Promise<void>
    loadKeymapFile?: () => Promise<string>
    minimizeTemporarily: () => Promise<void>
    applyKeymap?: (text: string) => Promise<{ restarted: boolean }>
    recalibrateGyro?: () => Promise<{ success: boolean }>
    onCalibrationStatus?: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => () => void
  }
  telemetry?: {
    onSample?: (callback: (payload: unknown) => void) => () => void
  }
}
