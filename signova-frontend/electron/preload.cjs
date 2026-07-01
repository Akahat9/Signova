const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('signovaDesktop', {
  openCallWindow: (mode) => ipcRenderer.invoke('call-window:open', mode),
  compactCallWindow: () => ipcRenderer.invoke('call-window:compact'),
  restoreCallWindow: () => ipcRenderer.invoke('call-window:restore'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});
