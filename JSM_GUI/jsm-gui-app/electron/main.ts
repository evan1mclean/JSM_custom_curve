import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import * as dgram from 'node:dgram'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let telemetrySocket: dgram.Socket | null = null
let latestTelemetryPacket: Record<string, unknown> | null = null
let jsmProcess: ChildProcessWithoutNullStreams | null = null
let calibrationTimer: NodeJS.Timeout | null = null

const TELEMETRY_PORT = 8974
const BIN_DIR = path.join(process.env.APP_ROOT, 'bin')
const STARTUP_FILE = path.join(BIN_DIR, 'OnStartUp.txt')
const JSM_EXECUTABLE = path.join(BIN_DIR, process.platform === 'win32' ? 'JoyShockMapper.exe' : 'JoyShockMapper')

async function ensureStartupFileExists() {
  try {
    await fs.access(STARTUP_FILE)
  } catch {
    await fs.mkdir(BIN_DIR, { recursive: true })
    await fs.writeFile(STARTUP_FILE, '', 'utf8')
  }
}

function startTelemetryListener() {
  if (telemetrySocket) {
    return
  }
  telemetrySocket = dgram.createSocket('udp4')
  telemetrySocket.on('error', err => {
    console.warn('[telemetry] socket error', err)
  })
  telemetrySocket.on('message', msg => {
    try {
      latestTelemetryPacket = JSON.parse(msg.toString('utf8'))
      if (win && !win.isDestroyed()) {
        win.webContents.send('telemetry-sample', latestTelemetryPacket)
      }
    } catch (err) {
      console.warn('[telemetry] failed to parse payload', err)
    }
  })
  telemetrySocket.bind(TELEMETRY_PORT, '127.0.0.1', () => {
    console.log(`[telemetry] listening on udp://127.0.0.1:${TELEMETRY_PORT}`)
  })
}

function broadcastCalibrationStatus(calibrating: boolean, seconds?: number) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('calibration-status', { calibrating, seconds })
  }
}

function startCalibrationCountdown(seconds: number) {
  if (calibrationTimer) {
    clearInterval(calibrationTimer)
    calibrationTimer = null
  }
  if (seconds <= 0) {
    broadcastCalibrationStatus(false)
    return
  }
  let remaining = seconds
  broadcastCalibrationStatus(true, remaining)
  calibrationTimer = setInterval(() => {
    remaining -= 1
    if (remaining > 0) {
      broadcastCalibrationStatus(true, remaining)
    } else {
      clearInterval(calibrationTimer!)
      calibrationTimer = null
      broadcastCalibrationStatus(false)
    }
  }, 1000)
}

function stopTelemetryListener() {
  if (telemetrySocket) {
    telemetrySocket.close()
    telemetrySocket = null
  }
}

async function saveStartupFile(content: string) {
  await ensureStartupFileExists()
  await fs.writeFile(STARTUP_FILE, content ?? '', 'utf8')
}

async function loadStartupFile() {
  try {
    await ensureStartupFileExists()
    const data = await fs.readFile(STARTUP_FILE, 'utf8')
    return data
  } catch {
    return ''
  }
}

function launchJoyShockMapper(calibrationSeconds = 5) {
  if (jsmProcess) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    try {
      jsmProcess = spawn(JSM_EXECUTABLE, [], {
        cwd: BIN_DIR,
        windowsHide: true,
        stdio: 'ignore',
      })
      jsmProcess.once('error', err => {
        jsmProcess = null
        reject(err)
      })
      jsmProcess.once('spawn', () => {
        resolve()
      })
      jsmProcess.once('exit', () => {
        jsmProcess = null
        const countdownElMessage = ''
        if (win && !win.isDestroyed()) {
          win.webContents.send('jsm-exited', countdownElMessage)
        }
      })
      if (calibrationSeconds > 0) {
        startCalibrationCountdown(calibrationSeconds)
      } else {
        broadcastCalibrationStatus(false)
      }

      if (win) {
        setTimeout(() => {
          if (!win) return
          if (win.isMinimized()) {
            win.restore()
          }
          win.focus()
        }, 500)
      }
    } catch (err) {
      jsmProcess = null
      reject(err)
    }
  })
}

function terminateJoyShockMapper() {
  if (!jsmProcess) {
    broadcastCalibrationStatus(false)
    return Promise.resolve()
  }
  return new Promise<void>(resolve => {
    const proc = jsmProcess
    const cleanup = () => {
      if (proc === jsmProcess) {
        jsmProcess = null
      }
      if (calibrationTimer) {
        clearInterval(calibrationTimer)
        calibrationTimer = null
      }
      broadcastCalibrationStatus(false)
      resolve()
    }
    proc.once('exit', cleanup)
    proc.kill()
  })
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    if (latestTelemetryPacket) {
      win?.webContents.send('telemetry-sample', latestTelemetryPacket)
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    terminateJoyShockMapper().finally(() => {
      app.quit()
      win = null
    })
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  await ensureStartupFileExists()
  startTelemetryListener()
  createWindow()
  setTimeout(() => {
    launchJoyShockMapper().catch(err => console.error('Auto-launch failed', err))
  }, 500)
})

app.on('will-quit', () => {
  stopTelemetryListener()
  if (jsmProcess) {
    jsmProcess.kill()
  }
})

ipcMain.handle('save-startup', async (_event, text: string) => {
  await saveStartupFile(text ?? '')
  return true
})

ipcMain.handle('load-startup', async () => {
  return loadStartupFile()
})

ipcMain.handle('launch-jsm', async (_event, calibrationSeconds = 5) => {
  await launchJoyShockMapper(calibrationSeconds)
})

ipcMain.handle('terminate-jsm', async () => {
  await terminateJoyShockMapper()
})

ipcMain.handle('minimize-temporarily', () => {
  if (!win) return
  win.minimize()
  setTimeout(() => {
    if (!win) return
    win.restore()
    win.focus()
  }, 2500)
})
