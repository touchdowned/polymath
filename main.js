const { app, BrowserWindow, ipcMain, safeStorage, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep everything saved under the app's earlier names (keys, PDFs, notes, progress).
(() => {
  try {
    const appData = app.getPath('appData');
    const newDir = path.join(appData, 'PolyMath');
    if (!fs.existsSync(newDir)) {
      for (const old of ['PolyStudy', 'Margin Reader']) {
        const oldDir = path.join(appData, old);
        if (fs.existsSync(oldDir)) { fs.cpSync(oldDir, newDir, { recursive: true, errorOnExist: false, force: false }); break; }
      }
    }
    app.setPath('userData', newDir);
  } catch { /* fall back to the default folder */ }
})();
// Windows groups the taskbar button and picks its icon by this ID.
if (process.platform === 'win32') app.setAppUserModelId('com.polymath.app');

const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API = process.env.MR_API_BASE || 'https://api.anthropic.com';

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; }
}
function writeSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS()), { recursive: true });
  fs.writeFileSync(SETTINGS(), JSON.stringify(s, null, 2));
}
function seal(text) {
  if (!text) return '';
  if (safeStorage.isEncryptionAvailable()) return 'enc:' + safeStorage.encryptString(text).toString('base64');
  return 'raw:' + Buffer.from(text).toString('base64');
}
function unseal(v) {
  if (!v) return '';
  try {
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    if (v.startsWith('raw:')) return Buffer.from(v.slice(4), 'base64').toString();
  } catch { /* unreadable on this machine */ }
  return '';
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    title: 'PolyMath',
    backgroundColor: '#121815',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  // Give the window a moment to finish saving notes and answers before it closes.
  let flushed = false;
  win.on('close', (e) => {
    if (flushed || win.webContents.isDestroyed()) return;
    e.preventDefault();
    win.webContents.send('app:flush');
    setTimeout(() => { flushed = true; if (!win.isDestroyed()) win.close(); }, 2000);
  });
  ipcMain.removeAllListeners('app:flushed');
  ipcMain.on('app:flushed', () => { flushed = true; if (win && !win.isDestroyed()) win.close(); });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // Every outside link opens in the normal browser, never inside the study window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  if (process.env.MR_SMOKE) {
    win.webContents.on('console-message', (_e, level, message, line, source) => console.log('[renderer]', level, message, source + ':' + line));
    win.webContents.on('did-finish-load', () => {
      if (process.env.MR_SMOKE_PDF) {
        const b64 = fs.readFileSync(process.env.MR_SMOKE_PDF).toString('base64');
        setTimeout(() => win.webContents.executeJavaScript(`(()=>{const bin=atob('${b64}');const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const f=new File([u],'Test Calculus.pdf',{type:'application/pdf'});const dt=new DataTransfer();dt.items.add(f);window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,cancelable:true}))})()`), 1500);
      }
      const smokeJs = process.env.MR_SMOKE_JS_FILE ? fs.readFileSync(process.env.MR_SMOKE_JS_FILE, 'utf8') : process.env.MR_SMOKE_JS;
      if (smokeJs) setTimeout(() => win.webContents.executeJavaScript(smokeJs).catch(err => console.log('[smoke-js]', err)), 2500);
    });
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.MR_SMOKE, img.toPNG());
      app.quit();
    }, +(process.env.MR_SMOKE_WAIT || 5000)));
  }
  const fsSend = () => { try { win.webContents.send('fullscreen:changed', win.isFullScreen()); } catch (e) {} };
  win.on('enter-full-screen', fsSend); win.on('leave-full-screen', fsSend);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
}

/* ---------- settings ---------- */
ipcMain.handle('settings:get', () => {
  const s = readSettings();
  return {
    hasAnthropicKey: !!unseal(s.anthropicKey),
    desmosKey: unseal(s.desmosKey),
    workspaceId: s.workspaceId || '',
    satModel: s.satModel || 'claude-haiku-5-5',
    model: s.model || DEFAULT_MODEL
  };
});
ipcMain.handle('settings:save', (_e, patch) => {
  const s = readSettings();
  if (typeof patch.anthropicKey === 'string') s.anthropicKey = seal(patch.anthropicKey.trim());
  if (typeof patch.desmosKey === 'string') s.desmosKey = seal(patch.desmosKey.trim());
  if (typeof patch.model === 'string' && patch.model) s.model = patch.model;
  if (typeof patch.workspaceId === 'string') s.workspaceId = patch.workspaceId.trim();
  if (typeof patch.satModel === 'string' && /^claude-[a-z0-9-]+$/.test(patch.satModel)) s.satModel = patch.satModel;
  writeSettings(s);
  return true;
});
/* ---------- textbook PDFs live as real files, not in browser storage ---------- */
const LIB = () => path.join(app.getPath('userData'), 'library');
const libFile = (id) => { if (!/^[\w-]{1,80}$/.test(String(id))) throw new Error('bad id'); return path.join(LIB(), id + '.pdf'); };
ipcMain.handle('lib:save', async (_e, id, data) => {
  try {
    const file = libFile(id);
    await fs.promises.mkdir(LIB(), { recursive: true });
    const buf = Buffer.from(data);
    await fs.promises.writeFile(file + '.tmp', buf);
    await fs.promises.rename(file + '.tmp', file);
    const st = await fs.promises.stat(file);
    return st.size === buf.length ? { ok: true, size: st.size } : { ok: false, error: 'The saved file came out the wrong size.' };
  } catch (err) { return { ok: false, error: (err && err.message) || String(err) }; }
});
ipcMain.handle('lib:read', async (_e, id) => {
  try { const b = await fs.promises.readFile(libFile(id)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } catch { return null; }
});
ipcMain.handle('lib:del', async (_e, id) => { try { await fs.promises.unlink(libFile(id)); } catch {} return true; });
/* ---------- all other app data (courses, page-text cache, SAT banks and images, clips, notes...) as JSON files ----------
   Browser storage for a file:// app has a small quota and fails silently when it fills up, which lost saved courses. */
const STORE = () => path.join(app.getPath('userData'), 'store');
const storeFile = (k) => { const s = String(k); if (!s || s.length > 200) throw new Error('bad key'); return path.join(STORE(), s.replace(/[^\w-]/g, (c) => '~' + c.charCodeAt(0).toString(16)) + '.json'); };
ipcMain.handle('store:get', async (_e, k) => { try { return await fs.promises.readFile(storeFile(k), 'utf8'); } catch { return null; } });
ipcMain.handle('store:set', async (_e, k, str) => {
  try {
    const file = storeFile(k); await fs.promises.mkdir(STORE(), { recursive: true });
    const tmp = file + '.' + process.pid + '.' + Date.now() + Math.random().toString(36).slice(2, 6) + '.tmp';
    await fs.promises.writeFile(tmp, String(str), 'utf8'); await fs.promises.rename(tmp, file); return true;
  } catch (err) { return { error: (err && err.message) || String(err) }; }
});
ipcMain.handle('store:del', async (_e, k) => { try { await fs.promises.unlink(storeFile(k)); } catch {} return true; });
ipcMain.handle('fullscreen:set', (_e, on) => { if (win) win.setFullScreen(!!on); return true; });
ipcMain.handle('fullscreen:toggle', () => { if (win) win.setFullScreen(!win.isFullScreen()); return win ? win.isFullScreen() : false; });
ipcMain.handle('fullscreen:get', () => (win ? win.isFullScreen() : false));

/* ---------- Claude API (streaming) ---------- */
function apiHeaders(s, key) {
  const h = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  if (s.workspaceId) h['anthropic-workspace-id'] = s.workspaceId;
  return h;
}
function errCode(status, msg) {
  if (/workspace/i.test(msg || '')) return 'needs_workspace';
  return status === 401 ? 'bad_key' : status === 403 ? 'forbidden' : status === 429 ? 'rate_limited' : status === 529 || status >= 500 ? 'overloaded' : status === 400 ? 'bad_request' : 'http_' + status;
}
ipcMain.handle('claude:test', async () => {
  const s = readSettings();
  const key = unseal(s.anthropicKey);
  if (!key) return { ok: false, code: 'no_key', message: 'No Anthropic key saved yet.' };
  try {
    const res = await fetch(API + '/v1/models?limit=1', { headers: apiHeaders(s, key) });
    if (res.ok) return { ok: true };
    let msg = ''; try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch {}
    return { ok: false, code: errCode(res.status, msg), message: msg || 'Request failed (' + res.status + ')' };
  } catch { return { ok: false, code: 'network', message: 'Could not reach Anthropic. Check your internet connection.' }; }
});
const running = new Map();
ipcMain.handle('claude:abort', (_e, id) => { const c = running.get(id); if (c) c.abort(); return true; });

ipcMain.handle('claude:send', async (e, id, req) => {
  const s = readSettings();
  const key = unseal(s.anthropicKey);
  if (!key) return { error: { code: 'no_key', message: 'Add your Anthropic API key in Settings to use the tutor.' } };
  const ctl = new AbortController();
  running.set(id, ctl);
  const send = (type, data) => { if (!e.sender.isDestroyed()) e.sender.send('claude:event', id, type, data); };
  try {
    const body = {
      model: (typeof req.model === 'string' && /^claude-[a-z0-9-]+$/.test(req.model)) ? req.model : (s.model || DEFAULT_MODEL),
      max_tokens: Math.max(64, Math.min(8000, +req.max_tokens || 2000)),
      stream: true,
      system: req.system,
      messages: req.messages
    };
    if (req.tools && req.tools.length) body.tools = req.tools;
    const res = await fetch(API + '/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: apiHeaders(s, key),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch {}
      const code = errCode(res.status, msg);
      return { error: { code, message: msg || 'Request failed (' + res.status + ')' } };
    }
    // Parse the server-sent event stream into content blocks.
    const blocks = [];
    let stop = null, buf = '';
    const decoder = new TextDecoder();
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = raw.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_start') {
          const b = { ...ev.content_block };
          if (b.type === 'tool_use') { b._json = ''; b.input = {}; }
          if (b.type === 'text') b.text = b.text || '';
          if (b.type === 'thinking') { b.thinking = b.thinking || ''; b.signature = b.signature || ''; }
          blocks[ev.index] = b;
        } else if (ev.type === 'content_block_delta') {
          const b = blocks[ev.index];
          if (!b) continue;
          if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; send('text', ev.delta.text); }
          else if (ev.delta.type === 'input_json_delta') b._json += ev.delta.partial_json;
          else if (ev.delta.type === 'thinking_delta') b.thinking += ev.delta.thinking || '';
          else if (ev.delta.type === 'signature_delta') b.signature += ev.delta.signature || '';
        } else if (ev.type === 'content_block_stop') {
          const b = blocks[ev.index];
          if (b && b.type === 'tool_use') { try { b.input = b._json ? JSON.parse(b._json) : {}; } catch { b.input = {}; } delete b._json; }
        } else if (ev.type === 'message_delta') {
          if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        } else if (ev.type === 'error') {
          return { error: { code: 'overloaded', message: (ev.error && ev.error.message) || 'Stream error' }, content: blocks.filter(Boolean) };
        }
      }
    }
    return { content: blocks.filter(Boolean), stop_reason: stop };
  } catch (err) {
    if (err && err.name === 'AbortError') return { error: { code: 'cancelled', message: 'Stopped' } };
    return { error: { code: 'network', message: 'Could not reach Anthropic. Check your internet connection.' } };
  } finally {
    running.delete(id);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
