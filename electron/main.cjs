const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Prevent GPU process sandbox crashes on Windows 11 (e.g., Intel Arc Graphics:
// "GPU process exited unexpectedly: exit_code=-2147483645 / GPU process isn't usable")
// while keeping the Chromium renderer sandbox active.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

const isFallbackRelaunch = process.env.HERMES_SANDBOX_FALLBACK === '1';
if (isFallbackRelaunch) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let gpuCrashCount = 0;

  // Automatic fallback if the GPU process still crashes fatally on a host machine
  app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
      gpuCrashCount += 1;
      const hasNoSandboxFlag = process.argv.includes('--no-sandbox');
      if (gpuCrashCount >= 2 && !hasNoSandboxFlag && !isFallbackRelaunch) {
        process.env.HERMES_SANDBOX_FALLBACK = '1';
        app.relaunch({
          args: process.argv.slice(1).concat(['--disable-gpu', '--no-sandbox']),
        });
        app.exit(0);
      }
    }
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      show: false, // Don't show until ready to prevent flashing
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // Necessary if local files are loaded via file:// protocol restrictions sometimes
      },
      title: "HERMES V2.0.0",
      icon: path.join(__dirname, '../public/icon.png')
    });

    mainWindow = win;
    win.on('closed', () => {
      if (mainWindow === win) mainWindow = null;
    });

    // Optimize window showing to prevent white flash
    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
    });

    if (isDev) {
      win.loadURL('http://localhost:3000');
      win.webContents.openDevTools();
    } else {
      // Disable default menu in production for a cleaner app feel
      win.setMenu(null);
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
