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
const APP_ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..')
process.env.APP_ROOT = APP_ROOT

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
const DATA_DIR = app.getPath('userData')

let win: BrowserWindow | null
let telemetrySocket: dgram.Socket | null = null
let latestTelemetryPacket: Record<string, unknown> | null = null
let jsmProcess: ChildProcess | null = null
let calibrationTimer: NodeJS.Timeout | null = null
let calibrationSecondsSetting = 5

const TELEMETRY_PORT = 8974
const BIN_DIR = app.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(APP_ROOT, 'bin')
const STARTUP_FILE = path.join(BIN_DIR, 'OnStartUp.txt')
const STARTUP_COMMAND = 'OnStartUp.txt'
const JSM_EXECUTABLE = path.join(BIN_DIR, process.platform === 'win32' ? 'JoyShockMapper.exe' : 'JoyShockMapper')
const CONSOLE_INJECTOR = path.join(BIN_DIR, process.platform === 'win32' ? 'jsm-console-injector.exe' : 'jsm-console-injector')
const LOG_FILE = path.join(DATA_DIR, 'jsm-gui.log')
const WINDOW_STATE_FILE = path.join(DATA_DIR, 'window-state.json')

const PROFILE_LIBRARY_DIR = path.join(BIN_DIR, 'profiles-library')
const DEFAULT_PROFILE_NAME = 'Profile 1'
const DEFAULT_PROFILE_RELATIVE = `profiles-library/${DEFAULT_PROFILE_NAME}.txt`
const PROFILE_TEMPLATE_LINES = ['RESET_MAPPINGS', 'TELEMETRY_ENABLED = ON', 'TELEMETRY_PORT = 8974']
const getStartupHeaderLines = () => [
  'TELEMETRY_ENABLED = ON',
  'TELEMETRY_PORT = 8974',
  'RESTART_GYRO_CALIBRATION',
  `SLEEP ${calibrationSecondsSetting}`,
  'FINISH_GYRO_CALIBRATION',
]

async function writeLog(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  try {
    await fs.appendFile(LOG_FILE, line, 'utf8')
  } catch (err) {
    console.error('Failed to write log entry', err)
  }
}

async function ensureFileExists(filePath: string, defaultContent = '') {
  try {
    await fs.access(filePath)
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, defaultContent, 'utf8')
  }
}

async function ensureRequiredFiles() {
  await fs.mkdir(BIN_DIR, { recursive: true })
  await ensureLibraryDir()
  await ensureActiveProfileExists()
}

async function ensureLibraryDir() {
  await fs.mkdir(PROFILE_LIBRARY_DIR, { recursive: true })
}

const sanitizeProfileName = (rawName: string) => {
  const trimmed = rawName?.trim() ?? ''
  const cleaned = trimmed.replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 80)
  return cleaned.length > 0 ? cleaned : 'Profile'
}

const relativeProfilePathFromName = (name: string) => `profiles-library/${name}.txt`
const absoluteProfilePath = (relativePath: string) =>
  path.join(BIN_DIR, relativePath.replace(/\//g, path.sep))

async function generateUniqueProfileName(preferred?: string) {
  const existing = await listLibraryProfiles()
  const used = new Set(existing.map(name => name.toLowerCase()))
  let base = sanitizeProfileName(preferred ?? DEFAULT_PROFILE_NAME)
  if (!base) {
    base = DEFAULT_PROFILE_NAME
  }

  const match = base.match(/^(.*?)(\d+)$/)
  let prefix: string
  let counter: number

  if (match) {
    prefix = match[1].trim() || DEFAULT_PROFILE_NAME.replace(/\d+$/, '').trim()
    counter = parseInt(match[2], 10)
  } else {
    prefix = base.trim()
    counter = 1
  }

  let candidate = base
  while (used.has(candidate.toLowerCase())) {
    counter += 1
    candidate = `${prefix} ${counter}`.trim()
  }
  return candidate
}

async function getStartupProfilePath() {
  try {
    const data = await fs.readFile(STARTUP_FILE, 'utf8')
    const lines = data.split(/\r?\n/).map(line => line.trim())
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]
      if (line && line.toLowerCase().endsWith('.txt')) {
        return line
      }
    }
  } catch (err) {
    console.error('Failed to read startup profile path', err)
  }
  return null
}

async function setStartupProfilePath(relativePath: string) {
  try {
    await writeStartupFile(relativePath)
  } catch (err) {
    console.error('Failed to update startup profile path', err)
    throw err
  }
}

async function ensureStartupCalibrationBlock() {
  let relative = await getStartupProfilePath()
  if (!relative) {
    relative = DEFAULT_PROFILE_RELATIVE
  }
  await writeStartupFile(relative)
  return relative
}

async function ensureActiveProfileExists() {
  const relative = await ensureStartupCalibrationBlock()
  await ensureFileExists(absoluteProfilePath(relative), `${PROFILE_TEMPLATE_LINES.join('\n')}\n`)
  return relative
}

const libraryProfilePath = (name: string) => path.join(PROFILE_LIBRARY_DIR, `${name}.txt`)

async function writeStartupFile(profileRelativePath: string) {
  const data = [...getStartupHeaderLines(), profileRelativePath].join('\n') + '\n'
  await fs.writeFile(STARTUP_FILE, data, 'utf8')
}

async function listLibraryProfiles() {
  await ensureLibraryDir()
  const files = await fs.readdir(PROFILE_LIBRARY_DIR).catch(() => [])
  return files
    .filter(file => file.toLowerCase().endsWith('.txt'))
    .map(file => file.replace(/\.txt$/i, ''))
    .sort((a, b) => a.localeCompare(b))
}

async function saveLibraryProfile(name: string, content: string) {
  await ensureLibraryDir()
  const safeName = sanitizeProfileName(name)
  await fs.writeFile(libraryProfilePath(safeName), content ?? '', 'utf8')
  return safeName
}

async function loadLibraryProfile(name: string) {
  await ensureLibraryDir()
  const safeName = sanitizeProfileName(name)
  return fs.readFile(libraryProfilePath(safeName), 'utf8')
}

async function deleteLibraryProfile(name: string) {
  await ensureLibraryDir()
  const safeName = sanitizeProfileName(name)
  const relative = relativeProfilePathFromName(safeName)
  const absolute = absoluteProfilePath(relative)
  await fs.unlink(absolute).catch(() => {})
  const active = await getStartupProfilePath()
  if (active && active.toLowerCase() === relative.toLowerCase()) {
    const remaining = await listLibraryProfiles()
    if (remaining.length > 0) {
      const fallbackName = remaining[0]
      const fallback = relativeProfilePathFromName(fallbackName)
      await setStartupProfilePath(fallback)
      const fallbackContent = await fs.readFile(absoluteProfilePath(fallback), 'utf8')
      return { name: fallbackName, path: fallback, content: fallbackContent }
    } else {
      await setStartupProfilePath(DEFAULT_PROFILE_RELATIVE)
      await ensureFileExists(absoluteProfilePath(DEFAULT_PROFILE_RELATIVE), '')
      return { name: DEFAULT_PROFILE_NAME, path: DEFAULT_PROFILE_RELATIVE, content: '' }
    }
  }
  return null
}

async function loadCalibrationSecondsFromStartup() {
  try {
    const data = await fs.readFile(STARTUP_FILE, 'utf8')
    const match = data.match(/SLEEP\s+(\d+)/i)
    if (match) {
      const value = parseInt(match[1], 10)
      if (Number.isFinite(value) && value >= 0) {
        calibrationSecondsSetting = value
        return
      }
    }
  } catch {
    // ignore
  }
  calibrationSecondsSetting = 5
}

async function writeCalibrationSecondsToStartup(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  calibrationSecondsSetting = safe
  try {
    let data = await fs.readFile(STARTUP_FILE, 'utf8')
    if (/SLEEP\s+\d+/i.test(data)) {
      data = data.replace(/SLEEP\s+\d+/i, `SLEEP ${safe}`)
    } else if (/RESTART_GYRO_CALIBRATION/i.test(data)) {
      data = data.replace(/RESTART_GYRO_CALIBRATION/i, match => `${match}\nSLEEP ${safe}`)
    } else if (/FINISH_GYRO_CALIBRATION/i.test(data)) {
      data = data.replace(/FINISH_GYRO_CALIBRATION/i, match => `SLEEP ${safe}\n${match}`)
    } else {
      data += `\nSLEEP ${safe}\nFINISH_GYRO_CALIBRATION`
    }
    await fs.writeFile(STARTUP_FILE, data, 'utf8')
  } catch (err) {
    console.error('Failed to update calibration seconds', err)
    throw err
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

async function runConsoleCommandWithOutput(command: string) {
  if (process.platform !== 'win32') {
    return { success: false, output: '' }
  }
  if (!jsmProcess || !jsmProcess.pid) {
    return { success: false, output: '' }
  }
  try {
    await fs.access(CONSOLE_INJECTOR)
  } catch {
    await writeLog('Console injector executable not found; cannot inject command for capture.')
    return { success: false, output: '' }
  }
  return new Promise<{ success: boolean; output: string }>(resolve => {
    const injector = spawn(CONSOLE_INJECTOR, [String(jsmProcess!.pid), command, '--capture'], {
      cwd: BIN_DIR,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    injector.stdout?.on('data', chunk => {
      output += chunk.toString()
    })
    injector.stderr?.on('data', chunk => {
      output += chunk.toString()
    })
    injector.once('error', async err => {
      await writeLog(`Console injector failed to start: ${String(err)}`)
      resolve({ success: false, output })
    })
    injector.once('exit', async code => {
      if (code === 0) {
        resolve({ success: true, output })
      } else {
        await writeLog(`Console injector exited with code ${code}`)
        resolve({ success: false, output })
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
    icon: path.join(process.env.VITE_PUBLIC, 'gyro-icon.ico'),
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
  await loadCalibrationSecondsFromStartup()
  startTelemetryListener()
  await createWindow()
  setTimeout(() => {
    launchJoyShockMapper(calibrationSecondsSetting).catch(err => console.error('Auto-launch failed', err))
  }, 500)
})

app.on('will-quit', () => {
  stopTelemetryListener()
  if (jsmProcess) {
    jsmProcess.kill()
  }
})

const normalizeRelativeProfilePath = (input?: string | null) => {
  if (!input) return null
  const normalized = input.replace(/\\/g, '/')
  if (!normalized.startsWith('profiles-library/')) {
    return null
  }
  if (normalized.includes('..')) {
    return null
  }
  return normalized
}

ipcMain.handle('apply-profile', async (_event, profileRelativePath: string | undefined, content: string) => {
  await ensureRequiredFiles()
  let relative = normalizeRelativeProfilePath(profileRelativePath)
  if (!relative) {
    relative = await ensureActiveProfileExists()
  }
  const absolute = absoluteProfilePath(relative)
  await ensureFileExists(absolute, '')
  await fs.writeFile(absolute, content ?? '', 'utf8')
  await setStartupProfilePath(relative)
  const injected = await tryInjectConsoleCommand(relative)
  if (!injected) {
    await writeLog(`Console injection unavailable; leaving ${relative} pending.`)
  }
  return { restarted: false, path: relative }
})

ipcMain.handle('get-active-profile', async () => {
  await ensureRequiredFiles()
  const relative = await ensureActiveProfileExists()
  const absolute = absoluteProfilePath(relative)
  const content = await fs.readFile(absolute, 'utf8')
  const name = path.basename(relative, path.extname(relative))
  return { path: relative, name, content }
})

ipcMain.handle('activate-library-profile', async (_event, name: string) => {
  const safeName = sanitizeProfileName(name)
  const relative = relativeProfilePathFromName(safeName)
  const absolute = absoluteProfilePath(relative)
  await ensureFileExists(absolute, '')
  await setStartupProfilePath(relative)
  const content = await fs.readFile(absolute, 'utf8')
  return { path: relative, name: safeName, content }
})

ipcMain.handle('library-list-profiles', async () => {
  return listLibraryProfiles()
})

ipcMain.handle('library-create-profile', async () => {
  await ensureRequiredFiles()
  const name = await generateUniqueProfileName()
  const relative = relativeProfilePathFromName(name)
  const absolute = absoluteProfilePath(relative)
  await fs.writeFile(absolute, `${PROFILE_TEMPLATE_LINES.join('\n')}\n`, 'utf8')
  await setStartupProfilePath(relative)
  return { name, path: relative, content: `${PROFILE_TEMPLATE_LINES.join('\n')}\n` }
})

ipcMain.handle('library-save-profile', async (_event, name: string, content: string) => {
  const savedName = await saveLibraryProfile(name, content)
  return { name: savedName }
})

ipcMain.handle('library-rename-profile', async (_event, oldName: string, newName: string) => {
  await ensureRequiredFiles()
  const safeOld = sanitizeProfileName(oldName)
  let safeNew = sanitizeProfileName(newName)
  if (!safeNew) {
    throw new Error('New profile name cannot be empty.')
  }
  if (safeOld.toLowerCase() === safeNew.toLowerCase()) {
    const relative = relativeProfilePathFromName(safeOld)
    const content = await fs.readFile(absoluteProfilePath(relative), 'utf8')
    return { name: safeOld, path: relative, content }
  }
  const existing = await listLibraryProfiles()
  const conflict = existing
    .filter(name => name.toLowerCase() !== safeOld.toLowerCase())
    .some(name => name.toLowerCase() === safeNew.toLowerCase())
  if (conflict) {
    safeNew = await generateUniqueProfileName(safeNew)
  }
  const oldRelative = relativeProfilePathFromName(safeOld)
  const newRelative = relativeProfilePathFromName(safeNew)
  const oldAbsolute = absoluteProfilePath(oldRelative)
  const newAbsolute = absoluteProfilePath(newRelative)
  await ensureFileExists(oldAbsolute, '')
  await fs.rename(oldAbsolute, newAbsolute)
  const active = await getStartupProfilePath()
  if (active && active.toLowerCase() === oldRelative.toLowerCase()) {
    await setStartupProfilePath(newRelative)
  }
  const content = await fs.readFile(newAbsolute, 'utf8')
  return { name: safeNew, path: newRelative, content }
})

ipcMain.handle('library-load-profile', async (_event, name: string) => {
  const content = await loadLibraryProfile(name)
  return { name, content }
})

ipcMain.handle('library-delete-profile', async (_event, name: string) => {
  const fallback = await deleteLibraryProfile(name)
  return { success: true, fallback }
})

ipcMain.handle('recalibrate-gyro', async () => {
  const injected = await tryInjectConsoleCommand(STARTUP_COMMAND)
  if (injected) {
    startCalibrationCountdown(calibrationSecondsSetting)
    return { success: true }
  }
  await writeLog('Failed to inject OnStartUp.txt for recalibration.')
  return { success: false }
})

ipcMain.handle('launch-jsm', async (_event, calibrationSeconds = 5) => {
  calibrationSecondsSetting = calibrationSeconds
  await launchJoyShockMapper(calibrationSecondsSetting)
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

ipcMain.handle('get-calibration-seconds', async () => calibrationSecondsSetting)

ipcMain.handle('set-calibration-seconds', async (_event, seconds: number) => {
  await writeCalibrationSecondsToStartup(seconds)
  return calibrationSecondsSetting
})

ipcMain.handle('load-calibration-preset', async () => {
  await ensureRequiredFiles()
  const active = (await getStartupProfilePath()) ?? DEFAULT_PROFILE_RELATIVE
  const calibrationRelative = 'GyroConfigs/_3Dcalibrate.txt'
  const calibrationAbsolute = absoluteProfilePath(calibrationRelative)
  try {
    await fs.access(calibrationAbsolute)
  } catch {
    await writeLog(`Calibration preset not found at ${calibrationAbsolute}`)
    return { success: false, activeProfile: active }
  }
  const injected = await tryInjectConsoleCommand(calibrationRelative)
  return { success: injected, activeProfile: active, calibrationProfile: calibrationRelative }
})

ipcMain.handle('read-calibration-preset', async () => {
  await ensureRequiredFiles()
  const calibrationRelative = 'GyroConfigs/_3Dcalibrate.txt'
  const calibrationAbsolute = absoluteProfilePath(calibrationRelative)
  try {
    const content = await fs.readFile(calibrationAbsolute, 'utf8')
    return { success: true, calibrationProfile: calibrationRelative, content }
  } catch (err) {
    await writeLog(`Failed to read calibration preset: ${String(err)}`)
    return { success: false }
  }
})

ipcMain.handle('save-calibration-preset', async (_event, content: string) => {
  await ensureRequiredFiles()
  const calibrationRelative = 'GyroConfigs/_3Dcalibrate.txt'
  const calibrationAbsolute = absoluteProfilePath(calibrationRelative)
  try {
    await fs.writeFile(calibrationAbsolute, content ?? '', 'utf8')
    return { success: true }
  } catch (err) {
    await writeLog(`Failed to save calibration preset: ${String(err)}`)
    return { success: false }
  }
})

ipcMain.handle('calibration-run-command', async (_event, command: string) => {
  return runConsoleCommandWithOutput(command)
})
