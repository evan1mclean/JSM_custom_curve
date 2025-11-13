declare interface Window {
  electronAPI?: {
    launchJSM: (calibrationSeconds?: number) => Promise<void>
    terminateJSM: () => Promise<void>
    saveStartupFile: (text: string) => Promise<void>
    loadStartupFile: () => Promise<string>
    minimizeTemporarily: () => Promise<void>
    onCalibrationStatus?: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => () => void
  }
  telemetry?: {
    onSample?: (callback: (payload: unknown) => void) => () => void
  }
}
