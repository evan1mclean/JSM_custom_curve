"use strict";
const electron = require("electron");
const electronAPI = {
  launchJSM: (calibrationSeconds = 5) => electron.ipcRenderer.invoke("launch-jsm", calibrationSeconds),
  terminateJSM: () => electron.ipcRenderer.invoke("terminate-jsm"),
  minimizeTemporarily: () => electron.ipcRenderer.invoke("minimize-temporarily"),
  recalibrateGyro: () => electron.ipcRenderer.invoke("recalibrate-gyro"),
  getProfiles: () => electron.ipcRenderer.invoke("get-profiles"),
  loadProfile: (profileId) => electron.ipcRenderer.invoke("load-profile", profileId),
  applyProfile: (profileId, text) => electron.ipcRenderer.invoke("apply-profile", profileId, text),
  setActiveProfile: (profileId) => electron.ipcRenderer.invoke("set-active-profile", profileId),
  renameProfile: (profileId, name) => electron.ipcRenderer.invoke("rename-profile", profileId, name),
  copyProfile: (sourceId, targetId) => electron.ipcRenderer.invoke("copy-profile", sourceId, targetId),
  getCalibrationSeconds: () => electron.ipcRenderer.invoke("get-calibration-seconds"),
  setCalibrationSeconds: (seconds) => electron.ipcRenderer.invoke("set-calibration-seconds", seconds)
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
