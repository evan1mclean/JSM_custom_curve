/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    launchJSM: (calibrationSeconds?: number) => Promise<void>
    terminateJSM: () => Promise<void>
    saveStartupFile: (text: string) => Promise<void>
    loadStartupFile: () => Promise<string>
    minimizeTemporarily: () => Promise<void>
    onCalibrationStatus: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => () => void
  }
  telemetry: {
    onSample: (callback: (payload: unknown) => void) => () => void
  }
}
