const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Map();
ipcRenderer.on('claude:event', (_e, id, type, data) => {
  const fn = listeners.get(id);
  if (fn) fn(type, data);
});

contextBridge.exposeInMainWorld('desk', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  setFullscreen: (on) => ipcRenderer.invoke('fullscreen:set', on),
  toggleFullscreen: () => ipcRenderer.invoke('fullscreen:toggle'),
  isFullscreen: () => ipcRenderer.invoke('fullscreen:get'),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen:changed', (_e, on) => cb(on)),
  // One API request. onText receives streamed text pieces. Resolves {content, stop_reason} or {error}.
  claude: async (req, onText) => {
    const id = Math.random().toString(36).slice(2);
    listeners.set(id, (type, data) => { if (type === 'text' && onText) onText(data); });
    const p = ipcRenderer.invoke('claude:send', id, req);
    p.id = id;
    try { return await p; } finally { listeners.delete(id); }
  },
  claudeStart: (req, onText) => {
    const id = Math.random().toString(36).slice(2);
    listeners.set(id, (type, data) => { if (type === 'text' && onText) onText(data); });
    const promise = ipcRenderer.invoke('claude:send', id, req).finally(() => listeners.delete(id));
    return { id, promise };
  },
  claudeAbort: (id) => ipcRenderer.invoke('claude:abort', id),
  claudeTest: () => ipcRenderer.invoke('claude:test'),
  libSave: (id, data) => ipcRenderer.invoke('lib:save', id, data),
  storeGet: (k) => ipcRenderer.invoke('store:get', k),
  storeSet: (k, str) => ipcRenderer.invoke('store:set', k, str),
  storeDel: (k) => ipcRenderer.invoke('store:del', k),
  libRead: (id) => ipcRenderer.invoke('lib:read', id),
  libDel: (id) => ipcRenderer.invoke('lib:del', id),
  onFlush: (fn) => ipcRenderer.on('app:flush', async () => { try { await fn(); } catch {} ipcRenderer.send('app:flushed'); })
});
