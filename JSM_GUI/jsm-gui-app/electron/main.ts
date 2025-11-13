import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import * as dgram from 'node:dgram'
import { spawn, ChildProcess } from 'node:child_process'
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
let jsmProcess: ChildProcess | null = null
let calibrationTimer: NodeJS.Timeout | null = null

const TELEMETRY_PORT = 8974
const BIN_DIR = path.join(process.env.APP_ROOT, 'bin')
const STARTUP_FILE = path.join(BIN_DIR, 'OnStartUp.txt')
const KEYMAP_FILE = path.join(BIN_DIR, 'keymap_01.txt')
const KEYMAP_COMMAND = 'keymap_01.txt'
const STARTUP_COMMAND = 'OnStartUp.txt'
const JSM_EXECUTABLE = path.join(BIN_DIR, process.platform === 'win32' ? 'JoyShockMapper.exe' : 'JoyShockMapper')
const CONSOLE_INJECTOR = path.join(BIN_DIR, process.platform === 'win32' ? 'jsm-console-injector.exe' : 'jsm-console-injector')
const LOG_FILE = path.join(process.env.APP_ROOT, 'jsm-gui.log')
const WINDOW_STATE_FILE = path.join(process.env.APP_ROOT, 'window-state.json')

async function writeLog(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  try {
    await fs.appendFile(LOG_FILE, line, 'utf8')
  } catch (err) {
    console.error('Failed to write log entry', err)
  }
}

async function ensureRequiredFiles() {
  try {
    await fs.access(STARTUP_FILE)
  } catch {
    await fs.mkdir(BIN_DIR, { recursive: true })
    await fs.writeFile(STARTUP_FILE, '', 'utf8')
  }
  try {
    await fs.access(KEYMAP_FILE)
  } catch {
    await fs.writeFile(KEYMAP_FILE, '', 'utf8')
  }
}

async function loadWindowState() {
  try {
    const contents = await fs.readFile(WINDOW_STATE_FILE, 'utf8')
    const parsed = JSON.parse(contents)
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        width: typeof parsed.width === 'number' ? parsed.width : undefined,
        height: typeof parsed.height === 'number' ? parsed.height : undefined,
        x: typeof parsed.x === 'number' ? parsed.x : undefined,
        y: typeof parsed.y === 'number' ? parsed.y : undefined,
      }
    }
  } catch {
    // ignore
  }
  return {}
}

async function saveWindowState(bounds: Electron.Rectangle) {
  try {
    await fs.writeFile(WINDOW_STATE_FILE, JSON.stringify(bounds), 'utf8')
  } catch (err) {
    console.error('Failed to persist window bounds', err)
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

async function saveKeymapFile(content: string) {
  await ensureRequiredFiles()
  await fs.writeFile(KEYMAP_FILE, content ?? '', 'utf8')
}

async function loadKeymapFile() {
  try {
    await ensureRequiredFiles()
    const data = await fs.readFile(KEYMAP_FILE, 'utf8')
    return data
  } catch {
    return ''
  }
}

async function tryInjectConsoleCommand(command: string) {
  if (process.platform !== 'win32') {
    return false
  }
  if (!jsmProcess || !jsmProcess.pid) {
    return false
  }
  try {
    await fs.access(CONSOLE_INJECTOR)
  } catch {
    await writeLog('Console injector executable not found; cannot inject command.')
    return false
  }

  return new Promise<boolean>(resolve => {
    const injector = spawn(CONSOLE_INJECTOR, [String(jsmProcess!.pid), command], {
      cwd: BIN_DIR,
      windowsHide: true,
      stdio: 'ignore',
    })
    injector.once('error', async err => {
      await writeLog(`Console injector failed to start: ${String(err)}`)
      resolve(false)
    })
    injector.once('exit', async code => {
      if (code === 0) {
        resolve(true)
      } else {
        await writeLog(`Console injector exited with code ${code}`)
        resolve(false)
      }
    })
  })
}

function launchJoyShockMapper(calibrationSeconds = 5) {
  if (jsmProcess) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    try {
      const proc = spawn(JSM_EXECUTABLE, [], {
        cwd: BIN_DIR,
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'ignore'],
      })
      jsmProcess = proc
      proc.once('error', err => {
        if (proc === jsmProcess) {
          jsmProcess = null
        }
        reject(err)
      })
      proc.once('spawn', () => {
        resolve()
      })
      proc.once('exit', () => {
        if (proc === jsmProcess) {
          jsmProcess = null
        }
        if (win && !win.isDestroyed()) {
          win.webContents.send('jsm-exited', '')
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
    const proc = jsmProcess!
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

async function createWindow() {
  const state = await loadWindowState()
  win = new BrowserWindow({
    width: state.width ?? 1200,
    height: state.height ?? 900,
    x: state.x,
    y: state.y,
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

  win.on('close', () => {
    if (!win) {
      return
    }
    const bounds = win.getBounds()
    saveWindowState(bounds)
  })
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
    createWindow().catch(err => console.error('Failed to recreate window', err))
  }
})

app.whenReady().then(async () => {
  await ensureRequiredFiles()
  startTelemetryListener()
  await createWindow()
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

ipcMain.handle('save-keymap', async (_event, text: string) => {
  await saveKeymapFile(text ?? '')
  return true
})

ipcMain.handle('load-keymap', async () => {
  return loadKeymapFile()
})

ipcMain.handle('apply-keymap', async (_event, content: string) => {
  await saveKeymapFile(content ?? '')
  const injected = await tryInjectConsoleCommand(KEYMAP_COMMAND)
  if (injected) {
    return { restarted: false }
  }
  await writeLog('Console injection unavailable; leaving JSM running for debugging.')
  return { restarted: false }
})

ipcMain.handle('recalibrate-gyro', async () => {
  const injected = await tryInjectConsoleCommand(STARTUP_COMMAND)
  if (injected) {
    startCalibrationCountdown(5)
    return { success: true }
  }
  await writeLog('Failed to inject OnStartUp.txt for recalibration.')
  return { success: false }
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
