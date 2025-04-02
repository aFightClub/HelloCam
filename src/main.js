const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let mainWindow;
let pinnedWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
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

  const { shape, titleConfig, styleConfig } = options;

  // Get custom width from styleConfig or use default
  let width =
    styleConfig && styleConfig.width ? parseInt(styleConfig.width) : 400;
  let height = 0;
  let windowWidth = width; // Base window width (before adjustments)

  // Set appropriate height based on layout
  switch (shape) {
    case "modern":
      height = Math.round(width * 0.75); // 4:3 ratio
      break;
    case "compact":
      height = width; // Square-ish for compact view
      windowWidth = width + 120; // Add sidebar width for window size, content area stays at specified width
      break;
    case "cinematic":
      height = Math.round(width * 0.6); // 16:9 ratio
      break;
    default:
      height = Math.round(width * 0.75); // Default to 4:3
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
      titleConfig,
      styleConfig: {
        ...styleConfig,
        originalWidth: width, // Send original width before adjustments
      },
    });
  });

  // Set appropriate window shape
  switch (shape) {
    case "modern":
      pinnedWindow.setAspectRatio(windowWidth / height);
      pinnedWindow.setShape([
        {
          x: 0,
          y: 0,
          width: windowWidth,
          height,
          radius: 8, // Rounded corners
        },
      ]);
      break;
    case "compact":
      pinnedWindow.setAspectRatio(windowWidth / height);
      pinnedWindow.setShape([
        {
          x: 0,
          y: 0,
          width: windowWidth,
          height,
          radius: 8, // Rounded corners
        },
      ]);
      break;
    case "cinematic":
      pinnedWindow.setAspectRatio(windowWidth / height);
      pinnedWindow.setShape([
        {
          x: 0,
          y: 0,
          width: windowWidth,
          height,
          radius: 8, // Rounded corners
        },
      ]);
      break;
  }

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
