const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let mainWindow;
let pinnedWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: false,
    center: true,
  });

  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle IPC messages from renderer process
ipcMain.handle("some-event", async (event, arg) => {
  return "Response from main process";
});

// Create pinned webcam window
ipcMain.handle("create-pinned-window", (event, options) => {
  if (pinnedWindow) {
    pinnedWindow.close();
    pinnedWindow = null;
  }

  const { shape, styleConfig } = options;

  // Get custom width from styleConfig or use default
  let width =
    styleConfig && styleConfig.width ? parseInt(styleConfig.width) : 400;
  let height = 0;
  let windowWidth = width; // Base window width (before adjustments)

  // Set appropriate height based on aspect ratio
  switch (shape) {
    case "widescreen":
      height = Math.round(width * (9 / 16)); // 16:9 ratio
      break;
    case "square":
      height = width; // 1:1 ratio
      break;
    case "portrait":
      height = Math.round(width * (16 / 9)); // 9:16 ratio
      break;
    default:
      height = Math.round(width * (9 / 16)); // Default to 16:9
  }

  pinnedWindow = new BrowserWindow({
    width: windowWidth,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pinnedWindow.loadFile(path.join(__dirname, "../public/pinned.html"));

  pinnedWindow.webContents.on("did-finish-load", () => {
    pinnedWindow.webContents.send("pinned-window-config", {
      shape,
      styleConfig: {
        ...styleConfig,
        originalWidth: width, // Send original width before adjustments
      },
    });
  });

  // Set appropriate window shape based on aspect ratio
  pinnedWindow.setAspectRatio(windowWidth / height);

  // Apply rounded corners based on border radius
  let cornerRadius = 8;
  if (styleConfig && styleConfig.borderRadius) {
    // Convert percentage to pixels with a max of 20px
    cornerRadius = Math.min(
      Math.round(
        (parseInt(styleConfig.borderRadius) / 100) *
          Math.min(windowWidth, height)
      ),
      20
    );
  }

  pinnedWindow.setShape([
    {
      x: 0,
      y: 0,
      width: windowWidth,
      height,
      radius: cornerRadius,
    },
  ]);

  return { success: true };
});

// Close pinned window
ipcMain.handle("close-pinned-window", () => {
  if (pinnedWindow) {
    pinnedWindow.close();
    pinnedWindow = null;
    return true;
  }
  return false;
});

// Check if pinned window exists
ipcMain.handle("is-pinned-window-open", () => {
  return pinnedWindow !== null && !pinnedWindow.isDestroyed();
});

// Toggle always on top
ipcMain.handle("toggle-always-on-top", (event) => {
  const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
  return !isAlwaysOnTop;
});

// Set window shape
ipcMain.handle("set-window-shape", (event, { shape, width, height }) => {
  let newWidth = width || mainWindow.getSize()[0];
  let newHeight = height || mainWindow.getSize()[1];

  switch (shape) {
    case "circle":
      newWidth = Math.min(newWidth, newHeight);
      newHeight = newWidth;
      mainWindow.setSize(newWidth, newHeight);
      mainWindow.setAspectRatio(1);
      mainWindow.setShape([
        {
          x: 0,
          y: 0,
          width: newWidth,
          height: newHeight,
          radius: newWidth / 2,
        },
      ]);
      break;
    case "square":
      newWidth = Math.min(newWidth, newHeight);
      newHeight = newWidth;
      mainWindow.setSize(newWidth, newHeight);
      mainWindow.setAspectRatio(1);
      mainWindow.setShape([
        {
          x: 0,
          y: 0,
          width: newWidth,
          height: newHeight,
          radius: 0,
        },
      ]);
      break;
    case "rounded":
      mainWindow.setSize(newWidth, newHeight);
      mainWindow.setAspectRatio(newWidth / newHeight);
      mainWindow.setShape([
        {
          x: 0,
          y: 0,
          width: newWidth,
          height: newHeight,
          radius: 20,
        },
      ]);
      break;
    default:
      mainWindow.setSize(newWidth, newHeight);
      mainWindow.setAspectRatio(0);
      mainWindow.setShape([]);
  }

  return { shape, width: newWidth, height: newHeight };
});

// Create zoomed window
let zoomWindow = null;
ipcMain.handle("create-zoom-window", (event, { x, y, width, height }) => {
  if (zoomWindow) {
    zoomWindow.close();
  }

  const display = screen.getDisplayNearestPoint({ x, y });
  const scaleFactor = display.scaleFactor || 1;

  zoomWindow = new BrowserWindow({
    width: 300,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  zoomWindow.loadFile(path.join(__dirname, "../public/zoom.html"));
  zoomWindow.webContents.on("did-finish-load", () => {
    zoomWindow.webContents.send("set-zoom-area", {
      x,
      y,
      width,
      height,
      scaleFactor,
    });
  });

  return { success: true };
});
