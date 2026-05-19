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
    applyProfile: (profilePath: string, text: string) => Promise<{ restarted: boolean; path?: string }>
    getCalibrationSeconds: () => Promise<number>
    setCalibrationSeconds: (seconds: number) => Promise<number>
    getActiveProfile: () => Promise<{ path: string; name: string; content: string }>
    activateLibraryProfile: (name: string) => Promise<{ path: string; name: string; content: string }>
    createLibraryProfile: (preferredBaseName?: string) => Promise<{ path: string; name: string; content: string }>
    copyActiveProfile: () => Promise<{ path: string; name: string; content: string }>
    renameLibraryProfile: (oldName: string, newName: string) => Promise<{ path: string; name: string; content: string }>
    deleteLibraryProfile: (name: string) => Promise<{ success: boolean; fallback?: { path: string; name: string; content: string } }>
    onCalibrationStatus: (callback: (payload: { calibrating: boolean; seconds?: number }) => void) => () => void
  }
  telemetry: {
    onSample: (callback: (payload: unknown) => void) => () => void
  }
}
