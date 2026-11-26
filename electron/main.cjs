const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const {
  resolveStartupPlan,
  markPendingStartup,
  markStartupHealthy,
  recordRuntimeEscalation,
  clearStaleGpuCaches,
  sanitizeRelaunchArgs,
} = require('./startupCompat.cjs');

const isDev = process.env.NODE_ENV === 'development';

const DEFAULT_MODULES = {
  core: true,
  postprocess: true,
  agente_jesus: true,
};

function readInstalledModulesManifest() {
  const candidates = [
    path.join(process.resourcesPath || '', 'modules.json'),
    path.join(__dirname, '../modules.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        return {
          core: parsed.core !== false,
          postprocess:
            parsed.postprocess !== undefined
              ? parsed.postprocess !== false
              : parsed.propellant_char !== false,
          agente_jesus: parsed.agente_jesus !== false,
        };
      }
    } catch {
      // Fallback to defaults if unreadable
    }
  }
  return DEFAULT_MODULES;
}

function getSafeUserDataDir() {
  try {
    return app.getPath('userData');
  } catch {
    return path.join(os.tmpdir(), 'hermes-simulator');
  }
}

function applyCompatibilitySwitches(mode) {
  // Mitigate Windows 11 Intel Arc / CIG / occlusion crashes in Chromium child processes
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-features', 'RendererCodeIntegrity,CalculateNativeWinOcclusion');
  }

  if (mode === 'no-sandbox') {
    app.commandLine.appendSwitch('no-sandbox');
  } else if (mode === 'software-gl') {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'swiftshader');
    app.commandLine.appendSwitch('enable-unsafe-swiftshader');
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    app.disableHardwareAcceleration();
  }
}

const userDataDir = getSafeUserDataDir();
const startupPlan = resolveStartupPlan(userDataDir, process.argv.slice(1), process.env);
applyCompatibilitySwitches(startupPlan.mode);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Only the lock-owning instance purges corrupt caches and arms the startup crash watchdog
  if (startupPlan.shouldClearGpuCaches) {
    clearStaleGpuCaches(userDataDir);
  }
  markPendingStartup(userDataDir, startupPlan);

  let mainWindow = null;
  let gpuCrashCount = 0;
  let startupHealthy = false;
  let isRelaunching = false;
  let healthyTimer = null;

  ipcMain.on('hermes:get-installed-modules-sync', (event) => {
    event.returnValue = readInstalledModulesManifest();
  });

  function isSafeExternalMailto(rawUrl) {
    if (typeof rawUrl !== 'string') return false;
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'mailto:';
    } catch {
      return false;
    }
  }

  function isAllowedInternalUrl(targetUrl) {
    if (typeof targetUrl !== 'string') return false;
    if (isDev) {
      return targetUrl.startsWith('http://localhost:3000') || targetUrl.startsWith('http://127.0.0.1:3000');
    }
    const distDirUrl = pathToFileURL(path.resolve(__dirname, '../dist')).href;
    return targetUrl.startsWith(distDirUrl) || targetUrl.startsWith('data:text/html');
  }

  function loadRecoveryFallbackPage(win, reasonDetail) {
    if (!win || win.isDestroyed()) return;
    const safeReason = String(reasonDetail || 'Error gráfico o de carga inicial')
      .replace(/[<>&"']/g, '');
    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>HERMES V2.1.0 - Recuperación</title>
<style>
  body { margin:0; font-family: system-ui, -apple-system, sans-serif; background:#0b1120; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { max-width:540px; padding:28px; border-radius:12px; background:#111827; border:1px solid #334155; }
  h1 { margin:0 0 10px; font-size:20px; color:#f8fafc; }
  p { margin:0 0 14px; font-size:14px; line-height:1.5; color:#94a3b8; }
  code { display:block; padding:10px; border-radius:8px; background:#020617; color:#cbd5e1; font-size:12px; margin-bottom:14px; word-break:break-word; }
</style>
</head>
<body>
  <div class="card">
    <h1>HERMES V2.1.0 — Modo de recuperación</h1>
    <p>El entorno gráfico o de renderizado encontró un problema inesperado y se ha activado el modo seguro.</p>
    <code>${safeReason}</code>
    <p>Cierra esta ventana y vuelve a abrir HERMES: el sistema ajustará automáticamente el perfil gráfico compatible para tu equipo.</p>
  </div>
</body>
</html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {});
  }

  function triggerCompatRelaunch(reason) {
    if (isRelaunching) return;
    if (startupPlan.mode === 'software-gl') return;

    isRelaunching = true;
    if (healthyTimer) {
      clearTimeout(healthyTimer);
      healthyTimer = null;
    }

    const nextMode = recordRuntimeEscalation(userDataDir, startupPlan.mode, reason);
    clearStaleGpuCaches(userDataDir);

    const extraArgs = nextMode === 'no-sandbox' ? ['--no-sandbox'] : ['--software-gl'];
    const baseArgs = sanitizeRelaunchArgs(process.argv.slice(1));

    // Release single-instance lock BEFORE relaunch so the child instance never quits on a held lock
    app.releaseSingleInstanceLock();
    app.relaunch({
      args: baseArgs.concat(extraArgs),
    });
    app.exit(0);
  }

  app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
      gpuCrashCount += 1;
      if (startupPlan.mode !== 'software-gl' && (!startupHealthy || gpuCrashCount >= 2)) {
        triggerCompatRelaunch(`gpu-${details.reason || 'crashed'}`);
      }
    }
  });

  app.on('render-process-gone', (_event, webContents, details) => {
    if (details.reason === 'clean-exit') return;
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents === webContents) {
      if (!mainWindow.isVisible()) mainWindow.show();
      loadRecoveryFallbackPage(mainWindow, `Proceso de interfaz terminado (${details.reason})`);
    }
  });

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      createWindow();
    }
  });

  function createWindow() {
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      backgroundColor: '#0f172a',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: startupPlan.mode === 'default',
        webSecurity: false, // Required for Vite <script type="module" crossorigin> on file:// while preserving user localStorage; enforced via strict CSP below
        allowRunningInsecureContent: false,
        webviewTag: false,
        navigateOnDragDrop: false,
        preload: path.join(__dirname, 'preload.cjs'),
      },
      title: 'HERMES V2.1.0',
      icon: path.join(__dirname, isDev ? `../public/${iconFile}` : `../dist/${iconFile}`),
    });

    mainWindow = win;
    let hasShown = false;
    let fallbackShowTimer = null;

    const showWindowSafely = () => {
      if (win.isDestroyed()) return;
      if (!hasShown) {
        hasShown = true;
        if (fallbackShowTimer) {
          clearTimeout(fallbackShowTimer);
          fallbackShowTimer = null;
        }
        win.maximize();
        win.show();
      }
    };

    // Never allow BrowserWindow to remain hidden as a background lock-holding zombie if GPU/ready-to-show stalls
    fallbackShowTimer = setTimeout(() => {
      showWindowSafely();
    }, 3500);

    win.on('closed', () => {
      if (fallbackShowTimer) {
        clearTimeout(fallbackShowTimer);
        fallbackShowTimer = null;
      }
      if (healthyTimer) {
        clearTimeout(healthyTimer);
        healthyTimer = null;
      }
      if (mainWindow === win) mainWindow = null;
    });

    win.once('ready-to-show', () => {
      showWindowSafely();
    });

    win.webContents.once('did-finish-load', () => {
      showWindowSafely();
      healthyTimer = setTimeout(() => {
        if (!win.isDestroyed() && !isRelaunching) {
          startupHealthy = true;
          markStartupHealthy(userDataDir, startupPlan.mode);
        }
      }, 1200);
    });

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      showWindowSafely();
      loadRecoveryFallbackPage(win, `Fallo al cargar la aplicación (${errorCode}: ${errorDescription})`);
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalMailto(url)) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });

    win.webContents.on('will-navigate', (event, url) => {
      if (isAllowedInternalUrl(url)) return;
      event.preventDefault();
      if (isSafeExternalMailto(url)) {
        shell.openExternal(url).catch(() => {});
      }
    });

    win.webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    if (isDev) {
      win.loadURL('http://localhost:3000');
      win.webContents.openDevTools();
    } else {
      win.setMenu(null);
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  app.whenReady().then(() => {
    // Deny sensitive OS permissions globally (desktop simulator has no camera/mic/geolocation usage)
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);

    // Enforce strict offline CSP on packaged file:// assets to block remote script/network execution
    if (!isDev) {
      const cspPolicy =
        "default-src 'self' file: data: blob:; script-src 'self' file:; style-src 'self' 'unsafe-inline' file:; img-src 'self' data: blob: file:; font-src 'self' data: file:; connect-src 'self' data: blob: file:; object-src 'none'; base-uri 'self';";
      session.defaultSession.webRequest.onHeadersReceived({ urls: ['file://*/*'] }, (details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [cspPolicy],
          },
        });
      });
    }

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
