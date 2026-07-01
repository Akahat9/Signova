const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
let callWindow;

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    transparent: false,
    backgroundColor: '#f8fbfd',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const developmentUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000';
  if (!app.isPackaged && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(developmentUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createCallWindow(mode = 'video') {
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.show();
    callWindow.focus();
    return;
  }

  callWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    backgroundColor: '#f7fbff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const developmentUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000';
  if (!app.isPackaged && process.env.ELECTRON_START_URL) {
    callWindow.loadURL(`${developmentUrl}?signovaCall=${encodeURIComponent(mode)}`);
  } else {
    callWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'), { query: { signovaCall: mode } });
  }

  callWindow.once('ready-to-show', () => callWindow?.show());
  callWindow.on('closed', () => { callWindow = null; });
}

ipcMain.handle('call-window:open', (_event, mode) => createCallWindow(mode));
ipcMain.handle('call-window:compact', (event) => {
  const targetWindow = getSenderWindow(event);
  if (!targetWindow) return;
  const { workArea } = screen.getDisplayNearestPoint(targetWindow.getBounds());
  const width = 520;
  const height = 305;
  targetWindow.setAlwaysOnTop(true, 'floating');
  targetWindow.setMinimumSize(width, height);
  targetWindow.setBounds({
    x: workArea.x + workArea.width - width - 18,
    y: workArea.y + workArea.height - height - 18,
    width,
    height,
  }, true);
});
ipcMain.handle('call-window:restore', (event) => {
  const targetWindow = getSenderWindow(event);
  if (!targetWindow) return;
  targetWindow.setAlwaysOnTop(false);
  targetWindow.setMinimumSize(760, 560);
  targetWindow.setSize(1500, 920, true);
  targetWindow.center();
  targetWindow.focus();
});
ipcMain.handle('window:minimize', (event) => getSenderWindow(event)?.minimize());
ipcMain.handle('window:toggle-maximize', (event) => {
  const targetWindow = getSenderWindow(event);
  if (!targetWindow) return false;
  if (targetWindow.isMaximized()) targetWindow.unmaximize();
  else targetWindow.maximize();
  return targetWindow.isMaximized();
});
ipcMain.handle('window:close', (event) => getSenderWindow(event)?.close());

app.whenReady().then(createWindow);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
