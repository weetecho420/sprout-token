// Sprout Node desktop app: a small window plus a tray icon. Closing the window keeps the
// node running in the tray; it starts with the computer and uses almost no power
// (one tiny network request a minute, nothing in between).
const path = require('path');
const os = require('os');
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerMonitor, shell } = require('electron');
const api = require('./api');
const store = require('./store');
const { NodeRunner } = require('./runner');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const startHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;
let win = null;
let tray = null;
let quitting = false;
let runner = null;

const asset = (name) => path.join(__dirname, '..', 'assets', name);

function sproutTotal(nodes) {
  return nodes.reduce((s, n) => s + (n.earned || 0), 0);
}

function statusLabel(s) {
  switch (s.phase) {
    case 'online':
      return `Online · ${sproutTotal(s.nodes).toFixed(2)} $SPROUT earned`;
    case 'paused':
      return 'Paused';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'starting':
      return 'Starting…';
    case 'nolicense':
      return 'No license in this wallet';
    case 'pairing':
      return 'Waiting for pairing…';
    default:
      return 'Not paired';
  }
}

function openAtLogin() {
  return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
}

function setOpenAtLogin(on) {
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] });
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 560,
    show: false,
    title: 'Sprout Node',
    backgroundColor: '#0c100c',
    autoHideMenuBar: true,
    icon: asset('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (!startHidden) win.show();
  });
  // Closing the window hides it; the node keeps running in the tray.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  // Only open http(s) links, and only in the real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function refreshTray() {
  if (!tray) return;
  const s = runner.snapshot;
  const running = ['online', 'reconnecting', 'starting', 'nolicense'].includes(s.phase);
  tray.setToolTip(`Sprout Node: ${statusLabel(s)}`);
  tray.setImage(nativeImage.createFromPath(asset(s.phase === 'online' ? 'tray-on.png' : 'tray-off.png')));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: statusLabel(s), enabled: false },
      { type: 'separator' },
      { label: 'Open Sprout Node', click: showWindow },
      running
        ? { label: 'Pause node', click: () => runner.pause() }
        : s.phase === 'paused'
          ? { label: 'Resume node', click: () => runner.resume() }
          : { label: 'Pair this computer…', click: () => (showWindow(), runner.beginPairing()) },
      { type: 'separator' },
      {
        label: 'Start with computer',
        type: 'checkbox',
        checked: openAtLogin(),
        click: (item) => setOpenAtLogin(item.checked),
      },
      { type: 'separator' },
      { label: 'Quit Sprout Node', click: () => app.quit() },
    ])
  );
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide();

  runner = new NodeRunner({ api, store, deviceName: `${os.hostname()} (${process.platform === 'darwin' ? 'Mac' : 'PC'})` });
  runner.on('change', (s) => {
    win?.webContents.send('state', { ...s, openAtLogin: openAtLogin() });
    refreshTray();
  });
  // First successful pairing: start with the computer by default (can be switched off)
  runner.on('paired', () => {
    if (!openAtLogin()) setOpenAtLogin(true);
  });

  tray = new Tray(nativeImage.createFromPath(asset('tray-off.png')));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);

  ipcMain.handle('get-state', () => ({ ...runner.snapshot, openAtLogin: openAtLogin() }));
  ipcMain.handle('pair', () => runner.beginPairing());
  ipcMain.handle('cancel-pair', () => runner.cancelPairing());
  ipcMain.handle('pause', () => runner.pause());
  ipcMain.handle('resume', () => runner.resume());
  ipcMain.handle('unpair', () => runner.unpair());
  ipcMain.handle('set-open-at-login', (_e, on) => {
    setOpenAtLogin(on);
    refreshTray();
    return openAtLogin();
  });
  ipcMain.handle('open-link', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
  });

  // Check in right away after the computer wakes up or the network comes back
  powerMonitor.on('resume', () => setTimeout(() => runner.wake(), 5000));
  powerMonitor.on('unlock-screen', () => runner.wake());

  createWindow();
  runner.start();
  refreshTray();
});

app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('window-all-closed', (e) => e.preventDefault?.());

app.on('before-quit', async (e) => {
  if (quitting) return;
  quitting = true;
  e.preventDefault();
  await runner?.shutdown();
  app.quit();
});
