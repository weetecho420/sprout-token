// The only bridge between the window and the node. The page gets these functions and nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sprout', {
  getState: () => ipcRenderer.invoke('get-state'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  pair: () => ipcRenderer.invoke('pair'),
  cancelPair: () => ipcRenderer.invoke('cancel-pair'),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  unpair: () => ipcRenderer.invoke('unpair'),
  setOpenAtLogin: (on) => ipcRenderer.invoke('set-open-at-login', on),
  openLink: (url) => ipcRenderer.invoke('open-link', url),
});
