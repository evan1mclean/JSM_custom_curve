import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import * as dgram from "node:dgram";
import { spawn } from "node:child_process";
createRequire(import.meta.url);
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
const TELEMETRY_PORT = 8974;
const BIN_DIR = path.join(process.env.APP_ROOT, "bin");
const STARTUP_FILE = path.join(BIN_DIR, "OnStartUp.txt");
const JSM_EXECUTABLE = path.join(BIN_DIR, process.platform === "win32" ? "JoyShockMapper.exe" : "JoyShockMapper");
async function ensureStartupFileExists() {
  try {
    await fs.access(STARTUP_FILE);
  } catch {
    await fs.mkdir(BIN_DIR, { recursive: true });
    await fs.writeFile(STARTUP_FILE, "", "utf8");
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
async function saveStartupFile(content) {
  await ensureStartupFileExists();
  await fs.writeFile(STARTUP_FILE, content ?? "", "utf8");
}
async function loadStartupFile() {
  try {
    await ensureStartupFileExists();
    const data = await fs.readFile(STARTUP_FILE, "utf8");
    return data;
  } catch {
    return "";
  }
}
function launchJoyShockMapper(calibrationSeconds = 5) {
  if (jsmProcess) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    try {
      jsmProcess = spawn(JSM_EXECUTABLE, [], {
        cwd: BIN_DIR,
        windowsHide: true,
        stdio: "ignore"
      });
      jsmProcess.once("error", (err) => {
        jsmProcess = null;
        reject(err);
      });
      jsmProcess.once("spawn", () => {
        resolve();
      });
      jsmProcess.once("exit", () => {
        jsmProcess = null;
        const countdownElMessage = "";
        if (win && !win.isDestroyed()) {
          win.webContents.send("jsm-exited", countdownElMessage);
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
function createWindow() {
  win = new BrowserWindow({
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
    createWindow();
  }
});
app.whenReady().then(async () => {
  await ensureStartupFileExists();
  startTelemetryListener();
  createWindow();
  setTimeout(() => {
    launchJoyShockMapper().catch((err) => console.error("Auto-launch failed", err));
  }, 500);
});
app.on("will-quit", () => {
  stopTelemetryListener();
  if (jsmProcess) {
    jsmProcess.kill();
  }
});
ipcMain.handle("save-startup", async (_event, text) => {
  await saveStartupFile(text ?? "");
  return true;
});
ipcMain.handle("load-startup", async () => {
  return loadStartupFile();
});
ipcMain.handle("launch-jsm", async (_event, calibrationSeconds = 5) => {
  await launchJoyShockMapper(calibrationSeconds);
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
