const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  someEvent: async (arg) => ipcRenderer.invoke("some-event", arg),

  // Window control
  toggleAlwaysOnTop: async () => ipcRenderer.invoke("toggle-always-on-top"),
  setWindowShape: async (options) =>
    ipcRenderer.invoke("set-window-shape", options),

  // Pinned window functionality
  createPinnedWindow: async (options) =>
    ipcRenderer.invoke("create-pinned-window", options),
  closePinnedWindow: async () => ipcRenderer.invoke("close-pinned-window"),
  isPinnedWindowOpen: async () => ipcRenderer.invoke("is-pinned-window-open"),

  // Receive pinned window configuration
  onPinnedWindowConfig: (callback) => {
    ipcRenderer.on("pinned-window-config", (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners("pinned-window-config");
    };
  },

  // Zoom functionality
  createZoomWindow: async (area) =>
    ipcRenderer.invoke("create-zoom-window", area),

  // Listen for zoom area data
  onSetZoomArea: (callback) => {
    ipcRenderer.on("set-zoom-area", (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners("set-zoom-area");
    };
  },

  // Auto-update functionality
  checkForUpdates: async () => ipcRenderer.invoke("check-for-updates"),
});
