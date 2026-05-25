const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window-set-always-on-top', flag),
  resizeWindow: (width, height) => ipcRenderer.send('window-resize', width, height),
});
