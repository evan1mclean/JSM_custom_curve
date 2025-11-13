"use strict";
const electron = require("electron");
const electronAPI = {
  launchJSM: (calibrationSeconds = 5) => electron.ipcRenderer.invoke("launch-jsm", calibrationSeconds),
  terminateJSM: () => electron.ipcRenderer.invoke("terminate-jsm"),
  saveKeymapFile: (text) => electron.ipcRenderer.invoke("save-keymap", text),
  loadKeymapFile: () => electron.ipcRenderer.invoke("load-keymap"),
  minimizeTemporarily: () => electron.ipcRenderer.invoke("minimize-temporarily"),
  applyKeymap: (text) => electron.ipcRenderer.invoke("apply-keymap", text),
  recalibrateGyro: () => electron.ipcRenderer.invoke("recalibrate-gyro")
};
const telemetryListeners = /* @__PURE__ */ new Set();
electron.ipcRenderer.on("telemetry-sample", (_event, payload) => {
  telemetryListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error("[telemetry] renderer listener failed", err);
    }
  });
});
const calibrationListeners = /* @__PURE__ */ new Set();
electron.ipcRenderer.on("calibration-status", (_event, payload) => {
  calibrationListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error("[calibration] renderer listener failed", err);
    }
  });
});
const telemetryAPI = {
  onSample: (callback) => {
    if (typeof callback !== "function") {
      return () => {
      };
    }
    telemetryListeners.add(callback);
    return () => telemetryListeners.delete(callback);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  ...electronAPI,
  onCalibrationStatus: (callback) => {
    if (typeof callback !== "function") {
      return () => {
      };
    }
    calibrationListeners.add(callback);
    return () => calibrationListeners.delete(callback);
  }
});
electron.contextBridge.exposeInMainWorld("telemetry", telemetryAPI);
