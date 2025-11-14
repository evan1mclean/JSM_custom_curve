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
    minimizeTemporarily: () => Promise<void>
    getProfiles: () => Promise<{ activeProfile: number; profiles: Array<{ id: number; name: string }> }>
    loadProfile: (profileId?: number) => Promise<string>
    applyProfile: (profileId: number, text: string) => Promise<{ restarted: boolean }>
    setActiveProfile: (profileId: number) => Promise<{ activeProfile: number; profiles: Array<{ id: number; name: string }> }>
    renameProfile: (profileId: number, name: string) => Promise<{ activeProfile: number; profiles: Array<{ id: number; name: string }> }>
    copyProfile: (sourceId: number, targetId: number) => Promise<{ activeProfile: number; profiles: Array<{ id: number; name: string }> }>
    getCalibrationSeconds: () => Promise<number>
    setCalibrationSeconds: (seconds: number) => Promise<number>
    onCalibrationStatus: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => () => void
  }
  telemetry: {
    onSample: (callback: (payload: unknown) => void) => () => void
  }
}
