// Manual smoke test: `xvfb-run npx electron test/smoke.electron.js`
// Starts the real app, takes a screenshot of the window and quits.
const path = require('path');
const { app, BrowserWindow } = require('electron');
require('../src/main.js');
app.whenReady().then(() => {
  setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    win.show();
    await new Promise((r) => setTimeout(r, 1500));
    const img = await win.webContents.capturePage();
    require('fs').writeFileSync(process.env.SMOKE_OUT || path.join(__dirname, 'smoke.png'), img.toPNG());
    console.log('SMOKE_OK', win.getTitle());
    app.exit(0);
  }, 2500);
});
