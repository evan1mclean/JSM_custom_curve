import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import * as dgram from "node:dgram";
import { spawn } from "node:child_process";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let telemetrySocket = null;
let latestTelemetryPacket = null;
let jsmProcess = null;
let calibrationTimer = null;
let calibrationSecondsSetting = 5;
const TELEMETRY_PORT = 8974;
const BIN_DIR = path.join(process.env.APP_ROOT, "bin");
const STARTUP_FILE = path.join(BIN_DIR, "OnStartUp.txt");
const PROFILE_SLOTS = [1, 2, 3];
const PROFILES_FILE = path.join(BIN_DIR, "profiles.json");
const STARTUP_COMMAND = "OnStartUp.txt";
const JSM_EXECUTABLE = path.join(BIN_DIR, process.platform === "win32" ? "JoyShockMapper.exe" : "JoyShockMapper");
const CONSOLE_INJECTOR = path.join(BIN_DIR, process.platform === "win32" ? "jsm-console-injector.exe" : "jsm-console-injector");
const LOG_FILE = path.join(process.env.APP_ROOT, "jsm-gui.log");
const WINDOW_STATE_FILE = path.join(process.env.APP_ROOT, "window-state.json");
const DEFAULT_PROFILES = {
  activeProfile: 1,
  profiles: PROFILE_SLOTS.map((id) => ({ id, name: `Profile ${id}` }))
};
const PROFILE_FILENAME = (id) => `keymap_0${id}.txt`;
const PROFILE_PATH = (id) => path.join(BIN_DIR, PROFILE_FILENAME(id));
async function writeLog(message) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
  try {
    await fs.appendFile(LOG_FILE, line, "utf8");
  } catch (err) {
    console.error("Failed to write log entry", err);
  }
}
async function ensureFileExists(filePath, defaultContent = "") {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, defaultContent, "utf8");
  }
}
async function ensureProfilesFile() {
  try {
    await fs.access(PROFILES_FILE);
  } catch {
    await fs.writeFile(PROFILES_FILE, JSON.stringify(DEFAULT_PROFILES, null, 2), "utf8");
  }
}
function sanitizeProfilesState(state) {
  if (!state || !Array.isArray(state.profiles)) {
    return DEFAULT_PROFILES;
  }
  const names = PROFILE_SLOTS.map((id) => {
    const entry = state.profiles.find((p) => p.id === id);
    return {
      id,
      name: entry?.name?.trim()?.substring(0, 50) || `Profile ${id}`
    };
  });
  const active = PROFILE_SLOTS.includes(state.activeProfile) ? state.activeProfile : 1;
  return { activeProfile: active, profiles: names };
}
async function loadProfilesState() {
  await ensureProfilesFile();
  try {
    const raw = await fs.readFile(PROFILES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeProfilesState(parsed);
    if (sanitized !== parsed) {
      await saveProfilesState(sanitized);
    }
    return sanitized;
  } catch {
    await saveProfilesState(DEFAULT_PROFILES);
    return DEFAULT_PROFILES;
  }
}
async function saveProfilesState(state) {
  const sanitized = sanitizeProfilesState(state);
  await fs.writeFile(PROFILES_FILE, JSON.stringify(sanitized, null, 2), "utf8");
}
function normalizeProfileId(input, fallback = 1) {
  const candidate = Number(input);
  if (PROFILE_SLOTS.includes(candidate)) {
    return candidate;
  }
  return fallback;
}
async function updateStartupProfile(profileId) {
  await ensureFileExists(STARTUP_FILE, "");
  const filename = PROFILE_FILENAME(profileId);
  const data = await fs.readFile(STARTUP_FILE, "utf8").catch(() => "");
  const lines = data.split(/\r?\n/);
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^keymap_0[1-3]\.txt$/i.test(lines[i].trim())) {
      lines[i] = filename;
      replaced = true;
    }
  }
  if (!replaced) {
    lines.push(filename);
  }
  await fs.writeFile(STARTUP_FILE, lines.join("\n"), "utf8");
}
async function loadProfileContent(profileId) {
  await ensureFileExists(PROFILE_PATH(profileId), "");
  return fs.readFile(PROFILE_PATH(profileId), "utf8");
}
async function saveProfileContent(profileId, content) {
  await ensureFileExists(PROFILE_PATH(profileId), "");
  await fs.writeFile(PROFILE_PATH(profileId), content ?? "", "utf8");
}
async function setActiveProfile(profileId) {
  const state = await loadProfilesState();
  if (state.activeProfile === profileId) {
    return state;
  }
  const next = { ...state, activeProfile: profileId };
  await saveProfilesState(next);
  await updateStartupProfile(profileId);
  return next;
}
async function renameProfile(profileId, name) {
  const state = await loadProfilesState();
  const nextName = name?.trim()?.substring(0, 50) || `Profile ${profileId}`;
  const next = {
    ...state,
    profiles: state.profiles.map((profile) => profile.id === profileId ? { ...profile, name: nextName } : profile)
  };
  await saveProfilesState(next);
  return next;
}
async function copyProfile(source, target) {
  if (source === target) {
    return;
  }
  const content = await loadProfileContent(source);
  await saveProfileContent(target, content);
}
async function ensureRequiredFiles() {
  await fs.mkdir(BIN_DIR, { recursive: true });
  await ensureFileExists(STARTUP_FILE, "");
  for (const slot of PROFILE_SLOTS) {
    await ensureFileExists(PROFILE_PATH(slot), "");
  }
  const state = await loadProfilesState();
  await updateStartupProfile(state.activeProfile);
}
async function loadCalibrationSecondsFromStartup() {
  try {
    const data = await fs.readFile(STARTUP_FILE, "utf8");
    const match = data.match(/SLEEP\s+(\d+)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value) && value >= 0) {
        calibrationSecondsSetting = value;
        return;
      }
    }
  } catch {
  }
  calibrationSecondsSetting = 5;
}
async function writeCalibrationSecondsToStartup(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  calibrationSecondsSetting = safe;
  try {
    let data = await fs.readFile(STARTUP_FILE, "utf8");
    if (/SLEEP\s+\d+/i.test(data)) {
      data = data.replace(/SLEEP\s+\d+/i, `SLEEP ${safe}`);
    } else if (/RESTART_GYRO_CALIBRATION/i.test(data)) {
      data = data.replace(/RESTART_GYRO_CALIBRATION/i, (match) => `${match}
SLEEP ${safe}`);
    } else if (/FINISH_GYRO_CALIBRATION/i.test(data)) {
      data = data.replace(/FINISH_GYRO_CALIBRATION/i, (match) => `SLEEP ${safe}
${match}`);
    } else {
      data += `
SLEEP ${safe}
FINISH_GYRO_CALIBRATION`;
    }
    await fs.writeFile(STARTUP_FILE, data, "utf8");
  } catch (err) {
    console.error("Failed to update calibration seconds", err);
    throw err;
  }
}
async function loadWindowState() {
  try {
    const contents = await fs.readFile(WINDOW_STATE_FILE, "utf8");
    const parsed = JSON.parse(contents);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        width: typeof parsed.width === "number" ? parsed.width : void 0,
        height: typeof parsed.height === "number" ? parsed.height : void 0,
        x: typeof parsed.x === "number" ? parsed.x : void 0,
        y: typeof parsed.y === "number" ? parsed.y : void 0
      };
    }
  } catch {
  }
  return {};
}
async function saveWindowState(bounds) {
  try {
    await fs.writeFile(WINDOW_STATE_FILE, JSON.stringify(bounds), "utf8");
  } catch (err) {
    console.error("Failed to persist window bounds", err);
  }
}
function startTelemetryListener() {
  if (telemetrySocket) {
    return;
  }
  telemetrySocket = dgram.createSocket("udp4");
  telemetrySocket.on("error", (err) => {
    console.warn("[telemetry] socket error", err);
  });
  telemetrySocket.on("message", (msg) => {
    try {
      latestTelemetryPacket = JSON.parse(msg.toString("utf8"));
      if (win && !win.isDestroyed()) {
        win.webContents.send("telemetry-sample", latestTelemetryPacket);
      }
    } catch (err) {
      console.warn("[telemetry] failed to parse payload", err);
    }
  });
  telemetrySocket.bind(TELEMETRY_PORT, "127.0.0.1", () => {
    console.log(`[telemetry] listening on udp://127.0.0.1:${TELEMETRY_PORT}`);
  });
}
function broadcastCalibrationStatus(calibrating, seconds) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("calibration-status", { calibrating, seconds });
  }
}
function startCalibrationCountdown(seconds) {
  if (calibrationTimer) {
    clearInterval(calibrationTimer);
    calibrationTimer = null;
  }
  if (seconds <= 0) {
    broadcastCalibrationStatus(false);
    return;
  }
  let remaining = seconds;
  broadcastCalibrationStatus(true, remaining);
  calibrationTimer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      broadcastCalibrationStatus(true, remaining);
    } else {
      clearInterval(calibrationTimer);
      calibrationTimer = null;
      broadcastCalibrationStatus(false);
    }
  }, 1e3);
}
function stopTelemetryListener() {
  if (telemetrySocket) {
    telemetrySocket.close();
    telemetrySocket = null;
  }
}
async function tryInjectConsoleCommand(command) {
  if (process.platform !== "win32") {
    return false;
  }
  if (!jsmProcess || !jsmProcess.pid) {
    return false;
  }
  try {
    await fs.access(CONSOLE_INJECTOR);
  } catch {
    await writeLog("Console injector executable not found; cannot inject command.");
    return false;
  }
  return new Promise((resolve) => {
    const injector = spawn(CONSOLE_INJECTOR, [String(jsmProcess.pid), command], {
      cwd: BIN_DIR,
      windowsHide: true,
      stdio: "ignore"
    });
    injector.once("error", async (err) => {
      await writeLog(`Console injector failed to start: ${String(err)}`);
      resolve(false);
    });
    injector.once("exit", async (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        await writeLog(`Console injector exited with code ${code}`);
        resolve(false);
      }
    });
  });
}
function launchJoyShockMapper(calibrationSeconds = 5) {
  if (jsmProcess) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    try {
      const proc = spawn(JSM_EXECUTABLE, [], {
        cwd: BIN_DIR,
        windowsHide: true,
        stdio: ["pipe", "ignore", "ignore"]
      });
      jsmProcess = proc;
      proc.once("error", (err) => {
        if (proc === jsmProcess) {
          jsmProcess = null;
        }
        reject(err);
      });
      proc.once("spawn", () => {
        resolve();
      });
      proc.once("exit", () => {
        if (proc === jsmProcess) {
          jsmProcess = null;
        }
        if (win && !win.isDestroyed()) {
          win.webContents.send("jsm-exited", "");
        }
      });
      if (calibrationSeconds > 0) {
        startCalibrationCountdown(calibrationSeconds);
      } else {
        broadcastCalibrationStatus(false);
      }
      if (win) {
        setTimeout(() => {
          if (!win) return;
          if (win.isMinimized()) {
            win.restore();
          }
          win.focus();
        }, 500);
      }
    } catch (err) {
      jsmProcess = null;
      reject(err);
    }
  });
}
function terminateJoyShockMapper() {
  if (!jsmProcess) {
    broadcastCalibrationStatus(false);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const proc = jsmProcess;
    const cleanup = () => {
      if (proc === jsmProcess) {
        jsmProcess = null;
      }
      if (calibrationTimer) {
        clearInterval(calibrationTimer);
        calibrationTimer = null;
      }
      broadcastCalibrationStatus(false);
      resolve();
    };
    proc.once("exit", cleanup);
    proc.kill();
  });
}
async function createWindow() {
  const state = await loadWindowState();
  win = new BrowserWindow({
    width: state.width ?? 1200,
    height: state.height ?? 900,
    x: state.x,
    y: state.y,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
    if (latestTelemetryPacket) {
      win?.webContents.send("telemetry-sample", latestTelemetryPacket);
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.on("close", () => {
    if (!win) {
      return;
    }
    const bounds = win.getBounds();
    saveWindowState(bounds);
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    terminateJoyShockMapper().finally(() => {
      app.quit();
      win = null;
    });
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((err) => console.error("Failed to recreate window", err));
  }
});
app.whenReady().then(async () => {
  await ensureRequiredFiles();
  await loadCalibrationSecondsFromStartup();
  startTelemetryListener();
  await createWindow();
  setTimeout(() => {
    launchJoyShockMapper(calibrationSecondsSetting).catch((err) => console.error("Auto-launch failed", err));
  }, 500);
});
app.on("will-quit", () => {
  stopTelemetryListener();
  if (jsmProcess) {
    jsmProcess.kill();
  }
});
ipcMain.handle("get-profiles", async () => {
  return loadProfilesState();
});
ipcMain.handle("load-profile", async (_event, profileId) => {
  const state = await loadProfilesState();
  const id = normalizeProfileId(profileId, state.activeProfile);
  return loadProfileContent(id);
});
ipcMain.handle("apply-profile", async (_event, profileId, content) => {
  const state = await loadProfilesState();
  const id = normalizeProfileId(profileId, state.activeProfile);
  await saveProfileContent(id, content ?? "");
  const injected = await tryInjectConsoleCommand(PROFILE_FILENAME(id));
  if (injected) {
    return { restarted: false };
  }
  await writeLog(`Console injection unavailable; leaving ${PROFILE_FILENAME(id)} pending.`);
  return { restarted: false };
});
ipcMain.handle("set-active-profile", async (_event, profileId) => {
  const state = await loadProfilesState();
  const id = normalizeProfileId(profileId, state.activeProfile);
  return setActiveProfile(id);
});
ipcMain.handle("rename-profile", async (_event, profileId, name) => {
  const state = await loadProfilesState();
  const id = normalizeProfileId(profileId, state.activeProfile);
  return renameProfile(id, name ?? "");
});
ipcMain.handle("copy-profile", async (_event, sourceId, targetId) => {
  const state = await loadProfilesState();
  const source = normalizeProfileId(sourceId, state.activeProfile);
  const target = normalizeProfileId(targetId, state.activeProfile);
  await copyProfile(source, target);
  return loadProfilesState();
});
ipcMain.handle("recalibrate-gyro", async () => {
  const injected = await tryInjectConsoleCommand(STARTUP_COMMAND);
  if (injected) {
    startCalibrationCountdown(calibrationSecondsSetting);
    return { success: true };
  }
  await writeLog("Failed to inject OnStartUp.txt for recalibration.");
  return { success: false };
});
ipcMain.handle("launch-jsm", async (_event, calibrationSeconds = 5) => {
  calibrationSecondsSetting = calibrationSeconds;
  await launchJoyShockMapper(calibrationSecondsSetting);
});
ipcMain.handle("terminate-jsm", async () => {
  await terminateJoyShockMapper();
});
ipcMain.handle("minimize-temporarily", () => {
  if (!win) return;
  win.minimize();
  setTimeout(() => {
    if (!win) return;
    win.restore();
    win.focus();
  }, 2500);
});
ipcMain.handle("get-calibration-seconds", async () => calibrationSecondsSetting);
ipcMain.handle("set-calibration-seconds", async (_event, seconds) => {
  await writeCalibrationSecondsToStartup(seconds);
  return calibrationSecondsSetting;
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
