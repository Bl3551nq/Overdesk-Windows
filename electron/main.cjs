const { app, BrowserWindow, ipcMain, shell, Tray, Menu, screen, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Enforce single instance lock to prevent duplicate backend processes and enable taskbar restoration
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      try {
        mainWindow.webContents.send('app-restore');
      } catch (err) {}
    }
  });
}

// Set Application User Model ID for Windows 10/11 taskbar icon integration
if (process.platform === 'win32') {
  app.setAppUserModelId('com.overdesk.assistant');
}

// Configurable Production Hosted App URL for Silent Updates in Electron (Option 2)
// This enables automatic hot updates to the frontend without requiring end-users to reinstall the app.
const PRODUCTION_REMOTE_URL = 'https://ais-pre-ygovsfhsdgrmphae242d6v-579262669550.europe-west2.run.app';

let mainWindow;
let tray = null;
let isBubbleState = false;

function createTray() {
  const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Show Overdesk', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            try {
              mainWindow.webContents.send('app-restore');
            } catch (err) {}
          }
        } 
      },
      { 
        label: 'Hide to Tray', 
        click: () => {
          if (mainWindow) mainWindow.hide();
        } 
      },
      { type: 'separator' },
      { 
        label: 'Quit', 
        click: () => {
          app.isQuitting = true;
          app.quit();
        } 
      }
    ]);
    
    tray.setToolTip('Overdesk - Floating Assistant');
    tray.setContextMenu(contextMenu);
    
    // Toggle on double-click or single-click, safely restoring if minimized
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          try {
            mainWindow.webContents.send('app-restore');
          } catch (err) {}
          try {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
          } catch (err) {}
        } else if (mainWindow.isVisible()) {
          if (isBubbleState) {
            try {
              mainWindow.webContents.send('app-restore');
            } catch (err) {}
          } else {
            mainWindow.hide();
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
          try {
            mainWindow.webContents.send('app-restore');
          } catch (err) {}
          try {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
          } catch (err) {}
        }
      }
    });
  } catch (err) {
    console.error('Failed to create tray:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    minWidth: 240,
    maxWidth: 1000,
    minHeight: 280,
    maxHeight: 1600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false, // Disabling native shadow avoids Windows drop shadow bounding boxes clipping the transparent rounded card
    acceptFirstMouse: true, // Clicking on inactive window triggers actions immediately
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      backgroundThrottling: false, // Keep event loop running smoothly so blurred hover is immediate
    },
  });

  // Enable always-on-top over other full-screen apps on macOS if needed
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Load the application
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, attempt to load the remote hosted URL first for silent updates (Option 2)
    // If the server is unreachable, offline, or returns a 404/503 (e.g., container scaled down), we fallback to local bundled assets.
    let fallbackTriggered = false;

    const triggerLocalFallback = (reason) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn(`[Auto-Update Fallback] Loading local index.html. Reason: ${reason}`);
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    };

    // Standard load failure listener (e.g. TCP/DNS connection errors)
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (fallbackTriggered) return;
      if (validatedURL && (validatedURL.startsWith(PRODUCTION_REMOTE_URL) || validatedURL === 'about:blank')) {
        triggerLocalFallback(`Page load failed: ${errorDescription} (${errorCode})`);
      }
    });

    // Preflight health check to verify the remote URL is alive & healthy (status code 200)
    const checkRemoteHealthy = async (url) => {
      if (typeof fetch === 'undefined') return false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout for serverless cold-starts

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        clearTimeout(timeoutId);
        
        // Ensure we got a successful response (status code 200-299)
        return response.ok;
      } catch (err) {
        return false;
      }
    };

    checkRemoteHealthy(PRODUCTION_REMOTE_URL).then((isHealthy) => {
      if (fallbackTriggered) return;

      if (isHealthy) {
        console.log('[Auto-Update] Remote server is healthy. Checking for silent updates...');
        mainWindow.loadURL(PRODUCTION_REMOTE_URL).catch((err) => {
          triggerLocalFallback(`loadURL failed: ${err.message || err}`);
        });
      } else {
        triggerLocalFallback('Remote health check failed (server offline, scaled down, or returned HTTP error)');
      }
    });
  }

  // Intercept open links to boot default system web browser (e.g. Gumroad purchase pages)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept close events to hide instead of destroying
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Clear click-through ignore mode when window loses focus so the user can focus it on the first click
  mainWindow.on('blur', () => {
    try {
      mainWindow.setIgnoreMouseEvents(false);
    } catch (err) {}
  });

  mainWindow.on('focus', () => {
    try {
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    } catch (err) {}
  });

  mainWindow.on('restore', () => {
    try {
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      try {
        mainWindow.webContents.send('app-restore');
      } catch (err) {}
    } catch (err) {}
  });

  mainWindow.on('minimize', () => {
    try {
      mainWindow.setIgnoreMouseEvents(false);
    } catch (err) {}
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Auto-approve media (microphone) permissions so voice recognition works flawlessly out of the box
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) => {
      if (permission === 'media') {
        return true;
      }
      return false;
    });
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      try {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } catch (err) {}
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window controls IPC handling
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window-set-minimized-state', (event, minimized) => {
  isBubbleState = minimized;
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('window-set-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag, 'screen-saver');
  }
});

// Dynamic resizing handler to fit rounded card contents & drop shadow Glow perfectly
ipcMain.on('window-resize', (event, width, height) => {
  if (mainWindow) {
    const targetW = Math.round(width);
    const targetH = Math.round(height);
    if (targetW <= 120 && targetH <= 120) {
      mainWindow.setMinimumSize(targetW, targetH);
      mainWindow.setSize(targetW, targetH);
    } else {
      mainWindow.setMinimumSize(240, 280);
      const w = Math.max(240, Math.min(1000, targetW));
      const h = Math.max(280, Math.min(1600, targetH));
      mainWindow.setSize(w, h);
    }
  }
});

ipcMain.on('window-set-ignore-mouse-events', (event, ignore, options) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('window-move-by-delta', (event, dx, dy) => {
  if (mainWindow) {
    const pos = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(pos[0] + dx), Math.round(pos[1] + dy));
  }
});

let isCustomDragging = false;
let customDragInterval = null;

ipcMain.on('window-drag-start', (event) => {
  if (!mainWindow) return;

  // Use native operating system dragging for buttery smooth, zero-latency window manipulation (Windows & macOS)
  if (typeof mainWindow.performDrag === 'function') {
    mainWindow.performDrag();
    return;
  }

  // Fallback custom interval-based dragging if performDrag is not supported (e.g., standard Linux)
  if (isCustomDragging) return;
  isCustomDragging = true;
  
  const cursorStart = screen.getCursorScreenPoint();
  const winStart = mainWindow.getPosition();
  
  if (customDragInterval) {
    clearInterval(customDragInterval);
  }
  
  customDragInterval = setInterval(() => {
    if (!isCustomDragging || !mainWindow) {
      if (customDragInterval) {
        clearInterval(customDragInterval);
        customDragInterval = null;
      }
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const nx = winStart[0] + (cursor.x - cursorStart.x);
    const ny = winStart[1] + (cursor.y - cursorStart.y);
    mainWindow.setPosition(Math.round(nx), Math.round(ny));
  }, 10);
});

ipcMain.on('window-drag-end', () => {
  isCustomDragging = false;
  if (customDragInterval) {
    clearInterval(customDragInterval);
    customDragInterval = null;
  }
});

// --- Auto-Updater Setup for Windows/macOS Binary Upgrades ---
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  console.log('[Auto-Updater] Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[Auto-Updater] Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('updater-message', `New version available: v${info.version || ''}. Downloading...`);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Auto-Updater] No new updates found:', info);
});

autoUpdater.on('error', (err) => {
  console.error('[Auto-Updater] Error checking for updates:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('updater-message', `Downloading update: ${progressObj.percent.toFixed(0)}%`);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Auto-Updater] Update downloaded successfully');
  if (mainWindow) {
    mainWindow.webContents.send('updater-downloaded', `Version v${info.version || ''} downloaded! Ready to install.`);
  }
});

ipcMain.on('restart-to-update', () => {
  try {
    autoUpdater.quitAndInstall();
  } catch (err) {
    console.error('[Auto-Updater] Failed to quit and install:', err);
  }
});

// Trigger automatic check on startup (delay by 3 seconds so everything loaded) + repeating timer every 4 hours
app.whenReady().then(() => {
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[Auto-Updater] Catch on startup check:', err);
    });
  }, 3000);

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[Auto-Updater] Catch on interval check:', err);
    });
  }, 4 * 60 * 60 * 1000);
});

// ══ GUMROAD LICENSE ACTIVATION MACHINE ENFORCEMENT ══

function getMachineId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
    os.totalmem(),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const ENCRYPTION_KEY = crypto.scryptSync('overdesk-license-key-encryption-secret', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  if (textParts.length < 2) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function getLicenseFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'license.enc');
}

function getStoredLicenseData() {
  const licenseFilePath = getLicenseFilePath();
  try {
    if (fs.existsSync(licenseFilePath)) {
      const encryptedData = fs.readFileSync(licenseFilePath, 'utf8');
      const decryptedData = decrypt(encryptedData);
      return JSON.parse(decryptedData);
    }
  } catch (err) {
    console.error('Failed to read or decrypt license file:', err);
  }
  return {};
}

function storeLicenseData(licenseKey, machineId) {
  const licenseFilePath = getLicenseFilePath();
  try {
    const existing = getStoredLicenseData();
    existing[licenseKey] = machineId;
    const encryptedData = encrypt(JSON.stringify(existing));
    fs.writeFileSync(licenseFilePath, encryptedData, 'utf8');
  } catch (err) {
    console.error('Failed to write license file:', err);
  }
}

async function validateLicenseHandler(event, licenseKey) {
  if (!licenseKey) {
    return { ok: false, error: 'License key is required.' };
  }

  const currentMachineId = getMachineId();
  const storedData = getStoredLicenseData();
  const storedMachineId = storedData ? storedData[licenseKey] : null;

  // Always call Gumroad with increment_uses_count: false after the first activation so the count stays at 1 and is only used as a flag
  const incrementUsesCount = !storedMachineId;

  try {
    const params = new URLSearchParams();
    params.append('product_permalink', 'app');
    params.append('license_key', licenseKey);
    params.append('increment_uses_count', incrementUsesCount ? 'true' : 'false');

    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { ok: false, error: data.message || 'The license key is invalid or expired.' };
    }

    // If data.purchase.refunded === true, return { ok: false, error: 'This license has been refunded and is no longer valid.' }
    if (data.purchase && data.purchase.refunded === true) {
      return { ok: false, error: 'This license has been refunded and is no longer valid.' };
    }

    const uses = data.uses || 0;

    // If uses > 1 AND the stored machine ID does not match the current machine ID, return error
    if (uses > 1 && storedMachineId && storedMachineId !== currentMachineId) {
      return {
        ok: false,
        error: 'This license key is already activated on another device. Contact support to transfer.'
      };
    }

    // If uses === 1 OR the machine ID matches, return { ok: true }
    if (uses === 1 || storedMachineId === currentMachineId) {
      if (!storedMachineId) {
        storeLicenseData(licenseKey, currentMachineId);
      }
      return { ok: true };
    }

    // Default fallback if uses > 1 but we somehow didn't have storedMachineId yet and it shouldn't be blocked, 
    // or any other edge case:
    if (!storedMachineId) {
      storeLicenseData(licenseKey, currentMachineId);
    }
    return { ok: true };
  } catch (err) {
    console.error('License validation failed:', err);
    return { ok: false, error: 'Network verification failed. Please check your connection or try again.' };
  }
}

// Register hooks
ipcMain.handle('validateLicense', validateLicenseHandler);
ipcMain.handle('validate-license', validateLicenseHandler);

