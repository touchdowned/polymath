/* PolyMath on the web: sign-in, account storage and the Claude proxy, behind the same window.desk API the desktop app uses. */
(() => {
const SB_URL = 'https://bsphvpcrnuzptrwoivtu.supabase.co';
const SB_KEY = 'sb_publishable_redu4JtzMA5FZdkyZ7jrUQ_gNPpAOj_';
const SITE = window.PM_SITE || (SB_URL + '/storage/v1/object/public/site/');
const VER = window.PM_VER || String(Date.now());
const CHUNK = 20 * 1024 * 1024;                 // PDFs are stored in 20 MB parts (the free plan caps single files at 50 MB)
const LOCAL_ONLY = /^tc:/;                      // derived caches stay on this device
const AS_FILE = /^satimg:/;                     // large images go to file storage instead of the database
// an email link (verify an email / reset a username password) landed here: take its one-time sign-in out of the address
// bar before the client sees it, so it never replaces the account that is signed in on this device
let LINK = null, LINKRT = '', LINKTYPE = '', LINKERR = '';
try { const h = new URLSearchParams(location.hash.slice(1));
  if (/^(magiclink|signup)$/.test(h.get('type') || '') && h.get('access_token')) { LINK = h.get('access_token'); LINKRT = h.get('refresh_token') || ''; LINKTYPE = h.get('type'); history.replaceState(null, '', location.origin + location.pathname + location.search); }
  else if (h.get('error_code') || h.get('error_description')) { LINKERR = /expired|invalid/i.test(h.get('error_code') + h.get('error_description')) ? 'That email link has expired or was already used. Send a new one.' : (h.get('error_description') || 'That link did not work.'); history.replaceState(null, '', location.origin + location.pathname + location.search); } } catch {}
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
let USER = null;
const NAME_DOMAIN = '@users.polymath.invalid';     // username accounts sign in with this stand-in address; no email is ever sent to it
const nameToEmail = (v) => { v = String(v || '').trim(); return v.includes('@') ? v : v.toLowerCase() + NAME_DOMAIN; };
async function acctFn(body, auth) {
  const h = { 'content-type': 'application/json', apikey: SB_KEY };
  if (auth) { const { data: { session } } = await sb.auth.getSession(); if (session) h.authorization = 'Bearer ' + session.access_token; }
  let r, j; try { r = await fetch(SB_URL + '/functions/v1/account', { method: 'POST', headers: h, body: JSON.stringify(Object.assign({}, body, { origin: location.origin })) }); j = await r.json(); } catch { throw new Error('Could not reach PolyMath. Check your connection.'); }
  if (!r.ok || j.error) { const e = new Error(j.error || ('Something went wrong (' + r.status + ').')); e.status = r.status; throw e; } return j;
}
let ACCT = { username: null, email: null, verified: true }; const acctCbs = [];
const isGuestUser = () => !!(USER && ((USER.user_metadata && USER.user_metadata.guest) || /^guest_[a-z0-9]+@users\.polymath\.invalid$/.test(USER.email || '')));
async function loadAcct() {
  if (isGuestUser()) { ACCT = { username: null, email: null, verified: false, guest: true }; return ACCT; }
  const isName = (USER.email || '').endsWith(NAME_DOMAIN);
  ACCT = { username: isName ? USER.email.slice(0, -NAME_DOMAIN.length) : null, email: isName ? null : USER.email, verified: !isName };
  if (isName) { try { ACCT = await acctFn({ action: 'status' }, true); } catch {} }
  return ACCT;
}

/* ---------------- local cache (IndexedDB, per account) ---------------- */
let dbp;
const ldb = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('polymath-web', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const lget = async (store, k) => { try { const db = await ldb(); return await new Promise((res) => { const q = db.transaction(store).objectStore(store).get(USER.id + '|' + k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch { return undefined; } };
const lset = async (store, k, v) => { try { const db = await ldb(); await new Promise((res) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).put(v, USER.id + '|' + k); t.oncomplete = res; t.onerror = res; }); } catch {} };
const ldel = async (store, k) => { try { const db = await ldb(); await new Promise((res) => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(USER.id + '|' + k); t.oncomplete = res; t.onerror = res; }); } catch {} };

/* ---------------- "Uploads & sharing" panel: every upload and share, its progress, and whether it worked ---------------- */
const JOBS = new Map();   // id -> { title, sub, pct (0..1 or null), state: run | ok | err | wait, retry }
const JOB_CSS = `#pmJobs{position:fixed;right:16px;bottom:16px;z-index:250;width:min(380px,calc(100vw - 32px));background:#fff;color:#111827;border-radius:18px;box-shadow:0 16px 44px rgba(0,0,0,.22);border:2px solid #eceef2;font:500 13.5px 'Plus Jakarta Sans',system-ui,sans-serif;overflow:hidden}
#pmJobs .jh{display:flex;align-items:center;gap:8px;padding:10px 12px 10px 14px;cursor:pointer;user-select:none}#pmJobs .jh b{flex:1;font-weight:800;font-size:14px}#pmJobs .jh small{color:#6b7280;font-weight:600}
#pmJobs .jh button{border:0;background:#f1f2f5;width:28px;height:28px;border-radius:50%;cursor:pointer;color:#374151;font-size:13px}
#pmJobs .jl{max-height:46vh;overflow:auto;border-top:1px solid #eceef2}#pmJobs.min .jl{display:none}
#pmJobs .jr{display:grid;grid-template-columns:26px 1fr auto;gap:2px 10px;padding:10px 14px;border-bottom:1px solid #f3f4f6;align-items:start}#pmJobs .jr:last-child{border-bottom:0}
#pmJobs .ji{grid-row:span 3;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:13px;margin-top:1px}
#pmJobs .run .ji{border:3px solid #e5e7eb;border-top-color:#7a5af8;animation:pmspin .8s linear infinite}#pmJobs .ok .ji{background:#dcfce7;color:#15803d}#pmJobs .err .ji{background:#fee2e2;color:#b91c1c}#pmJobs .wait .ji{background:#fef3c7;color:#b45309}
@keyframes pmspin{to{transform:rotate(360deg)}}
#pmJobs .jt{font-weight:700;line-height:1.3;overflow-wrap:anywhere}#pmJobs .js{color:#6b7280;font-size:12.5px;line-height:1.35;grid-column:2}#pmJobs .err .js{color:#b91c1c}#pmJobs .ok .js{color:#15803d}#pmJobs .wait .js{color:#b45309}
#pmJobs .jb{grid-column:2;height:6px;border-radius:4px;background:#eef0f4;overflow:hidden;margin-top:4px}#pmJobs .jb i{display:block;height:100%;background:#7a5af8;border-radius:4px;transition:width .3s}
#pmJobs .jb.ind i{width:35%!important;animation:pmind 1.2s ease-in-out infinite}@keyframes pmind{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
#pmJobs .ja{grid-column:3;grid-row:1;display:flex;gap:4px}#pmJobs .ja button{border:0;background:#f1f2f5;color:#374151;border-radius:8px;height:26px;padding:0 9px;font:700 12px 'Plus Jakarta Sans',system-ui;cursor:pointer}#pmJobs .ja .rt{background:#7a5af8;color:#fff}
@media (max-width:820px){#pmJobs{right:8px;left:8px;width:auto;bottom:calc(76px + env(safe-area-inset-bottom))}}
@media (prefers-color-scheme:dark){html:not([data-theme=light]) #pmJobs{background:#181b21;color:#f3f4f6;border-color:#2a2f38}html:not([data-theme=light]) #pmJobs .jl,html:not([data-theme=light]) #pmJobs .jr{border-color:#2a2f38}html:not([data-theme=light]) #pmJobs .jh button,html:not([data-theme=light]) #pmJobs .ja button{background:#2a2f38;color:#e5e7eb}html:not([data-theme=light]) #pmJobs .jb{background:#2a2f38}}html[data-theme=dark] #pmJobs{background:#181b21;color:#f3f4f6;border-color:#2a2f38}html[data-theme=dark] #pmJobs .jl,html[data-theme=dark] #pmJobs .jr{border-color:#2a2f38}html[data-theme=dark] #pmJobs .jh button,html[data-theme=dark] #pmJobs .ja button{background:#2a2f38;color:#e5e7eb}html[data-theme=dark] #pmJobs .jb{background:#2a2f38}`;
let jobsMin = false, jobsT = null;
function job(id, patch) {
  if (patch === null) { JOBS.delete(id); renderJobs(); return; }
  const j = Object.assign(JOBS.get(id) || { state: 'run', pct: null, t: Date.now() }, patch, { t: Date.now() });
  if (patch.state && patch.state !== 'err') j.retry = patch.retry || null;
  JOBS.set(id, j); if (j.state === 'err' || (j.state === 'run' && patch.title)) jobsMin = false; renderJobs(); return j;
}
function renderJobs() {
  clearTimeout(jobsT);
  let el = document.getElementById('pmJobs');
  if (!JOBS.size) { if (el) el.remove(); return; }
  if (!document.getElementById('pmJobsCss')) { const st = document.createElement('style'); st.id = 'pmJobsCss'; st.textContent = JOB_CSS; document.head.append(st); }
  if (!el) { el = document.createElement('div'); el.id = 'pmJobs'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.append(el); }
  const all = [...JOBS.entries()], run = all.filter(([, j]) => j.state === 'run').length, err = all.filter(([, j]) => j.state === 'err').length, wait = all.filter(([, j]) => j.state === 'wait').length;
  const head = run ? 'Working on ' + run + ' item' + (run > 1 ? 's' : '') + '…' : err ? err + ' didn\'t finish' : wait ? 'Waiting to finish' : 'All done ✓';
  el.classList.toggle('min', jobsMin);
  el.innerHTML = '<div class="jh"><b>Uploads & sharing</b><small>' + head + '</small><button class="jm" title="' + (jobsMin ? 'Show' : 'Hide') + '">' + (jobsMin ? '▴' : '▾') + '</button>' + (run ? '' : '<button class="jx" title="Close">✕</button>') + '</div><div class="jl">' +
    all.map(([id, j]) => '<div class="jr ' + j.state + '" data-id="' + encodeURIComponent(id) + '"><span class="ji">' + ({ ok: '✓', err: '!', wait: '…' }[j.state] || '') + '</span><span class="jt"></span><span class="ja">' + (j.state === 'err' && j.retry ? '<button class="rt">Retry</button>' : '') + (j.state !== 'run' ? '<button class="dx" title="Dismiss">✕</button>' : '') + '</span><span class="js"></span>' +
      (j.state === 'run' ? '<div class="jb' + (j.pct == null ? ' ind' : '') + '"><i style="width:' + Math.round(100 * Math.min(1, j.pct || 0)) + '%"></i></div>' : '') + '</div>').join('') + '</div>';
  el.querySelectorAll('.jr').forEach((r) => { const j = JOBS.get(decodeURIComponent(r.dataset.id)); r.querySelector('.jt').textContent = j.title || ''; r.querySelector('.js').textContent = j.sub || ''; });
  el.querySelector('.jh').onclick = (e) => { if (e.target.closest('.jx')) return; jobsMin = !jobsMin; renderJobs(); };
  const x = el.querySelector('.jx'); if (x) x.onclick = () => { for (const [id, j] of JOBS) if (j.state !== 'run') JOBS.delete(id); renderJobs(); };
  el.querySelectorAll('.dx').forEach((b) => b.onclick = () => { JOBS.delete(decodeURIComponent(b.closest('.jr').dataset.id)); renderJobs(); });
  el.querySelectorAll('.rt').forEach((b) => b.onclick = () => { const id = decodeURIComponent(b.closest('.jr').dataset.id); const j = JOBS.get(id); if (j && j.retry) { const f = j.retry; job(id, { state: 'run', sub: 'Trying again…', pct: null }); f(); } });
  if (!run && !err && !wait) jobsT = setTimeout(() => { for (const [id, j] of JOBS) if (j.state === 'ok') JOBS.delete(id); renderJobs(); }, 15000);   // everything worked: tidy up
}
let SKIP_UNLOAD = false;
window.addEventListener('beforeunload', (e) => { if (SKIP_UNLOAD) return; if ([...JOBS.values()].some((j) => j.state === 'run') || pending.size) { e.preventDefault(); e.returnValue = 'Uploads are still running. Leave anyway?'; return e.returnValue; } });

/* ---------------- synced key/value store ---------------- */
const pending = new Map();   // key -> {s, ts} | {del:true, ts}
const MINE = new Map();      // key -> time of this device's last upload, so its own changes are not mistaken for another device's
let LAST_SEEN = 0;           // newest change from the account this page has seen
let flushT = null, flushing = null;
const pendKey = () => 'pm-pending:' + USER.id;
const notePending = () => { try { localStorage.setItem(pendKey(), JSON.stringify([...pending.keys()])); } catch {} };
const filePath = (k) => USER.id + '/' + encodeURIComponent(k).replace(/%/g, '_') + '.txt';
// Postgres can't store the character \u0000 (it shows up in text pulled from some PDFs), so drop it before saving
const noNul = (t) => { let u = t, v; do { v = u; u = u.replace(/(^|[^\\])((?:\\\\)*)\\u0000/g, '$1$2'); } while (u !== v); return u; };
async function pushOne(k, p) {
  if (p.del) {
    if (AS_FILE.test(k)) await sb.storage.from('userdata').remove([filePath(k)]);
    else { const { error } = await sb.from('kv').delete().eq('key', k); if (error) throw error; }
    return;
  }
  if (AS_FILE.test(k)) { const { error } = await sb.storage.from('userdata').upload(filePath(k), new Blob([p.s], { type: 'text/plain' }), { upsert: true }); if (error) throw error; return; }
  const { error } = await sb.from('kv').upsert({ user_id: USER.id, key: k, value: JSON.parse(noNul(p.s)), updated_at: new Date(p.ts).toISOString() });
  if (error) throw error;
  MINE.set(k, p.ts);
}
async function flush() {
  if (flushing) return flushing;
  clearTimeout(flushT);
  flushing = (async () => {
    const items = [...pending.entries()]; const show = items.length >= 4 || JOBS.has('sync'); let done = 0, failed = 0, lastErr = '';
    if (show) job('sync', { title: 'Saving to your account', sub: items.length + ' items to save', pct: 0, state: 'run' });
    for (const [k, p] of items) {
      try { await pushOne(k, p); if (pending.get(k) === p) pending.delete(k); }
      catch (e) { failed++; lastErr = (e && e.message) || ''; console.log('sync failed', k, lastErr); }
      done++; if (show && (done % 5 === 0 || done === items.length)) job('sync', { sub: done + ' of ' + items.length + ' saved', pct: done / items.length });
    }
    notePending();
    if (pending.size) flushT = setTimeout(flush, 15000);
    if (show) job('sync', pending.size ? { state: 'wait', sub: pending.size + ' not saved yet' + (/fetch|network/i.test(lastErr) ? ' (no connection)' : '') + '. Retrying automatically every 15 seconds.' } : { state: 'ok', sub: 'Everything is saved to your account.' });
  })();
  try { await flushing; } finally { flushing = null; }
}
const queue = (k, p) => { if (LOCAL_ONLY.test(k)) return; pending.set(k, p); notePending(); clearTimeout(flushT); flushT = setTimeout(flush, 1500); };
// In the Windows app, big things (SAT images, caches) live on the computer's disk instead of cloud storage.
const NF = () => (window.pmNative && window.pmNative.files) || null;
const diskKey = (k) => 'kv/' + encodeURIComponent(k).replace(/%/g, '~') + '.txt';
const NOIMG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="760" height="140"><rect width="100%" height="100%" fill="#f4f6f8"/><text x="50%" y="46%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="17" fill="#6b7280">This picture hasn\'t reached your account yet.</text><text x="50%" y="66%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#9ca3af">Open the PolyMath Windows app once and it uploads it.</text></svg>');
async function storeGet(k) {
  const nf = NF();
  if (nf && (AS_FILE.test(k) || LOCAL_ONLY.test(k))) {
    const d = await nf.read(diskKey(k), true); if (d != null) return d;
    if (LOCAL_ONLY.test(k)) return null;
  }
  const c = await lget('kv', k);
  if (c && c.s != null) return c.s;
  if (c && c.missing && !(AS_FILE.test(k) && Date.now() - (c.ts || 0) > 120000)) return AS_FILE.test(k) && !nf ? JSON.stringify(NOIMG) : null;   // a missing picture is checked again after 2 minutes
  if (LOCAL_ONLY.test(k)) return null;
  try {
    if (AS_FILE.test(k)) {
      const { data, error } = await sb.storage.from('userdata').download(filePath(k));
      if (error || !data) { await lset('kv', k, { missing: true, ts: Date.now() }); return nf ? null : JSON.stringify(NOIMG); }
      const s = await data.text(); if (nf) await nf.write(diskKey(k), s); else await lset('kv', k, { s, ts: Date.now() }); return s;
    }
    const { data, error } = await sb.from('kv').select('value,updated_at').eq('key', k).maybeSingle();
    if (error) return null;
    if (!data) { await lset('kv', k, { missing: true, ts: Date.now() }); return null; }
    const s = JSON.stringify(data.value); await lset('kv', k, { s, ts: +new Date(data.updated_at) }); return s;
  } catch { return null; }
}
async function storeSet(k, s) {
  const nf = NF();
  if (nf && LOCAL_ONLY.test(k)) { await nf.write(diskKey(k), s); return true; }   // caches stay on the PC only
  if (nf && AS_FILE.test(k)) { await nf.write(diskKey(k), s); queue(k, { s, ts: Date.now() }); return true; }   // SAT pictures: on the PC and in the account
  const ts = Date.now(); await lset('kv', k, { s, ts }); queue(k, { s, ts }); return true;
}
async function storeDel(k) {
  const nf = NF(); if (nf && (AS_FILE.test(k) || LOCAL_ONLY.test(k))) { await nf.del(diskKey(k)); if (LOCAL_ONLY.test(k)) return true; }
  const ts = Date.now(); await lset('kv', k, { missing: true, ts }); queue(k, { del: true, ts }); return true;
}
// on start: anything another device changed more recently is dropped from this device's cache and re-read on demand
async function reconcile() {
  try {
    const keys = JSON.parse(localStorage.getItem(pendKey()) || '[]');
    for (const k of keys) { const c = await lget('kv', k); if (c && c.s != null) pending.set(k, { s: c.s, ts: c.ts }); else if (c && c.missing) pending.set(k, { del: true, ts: c.ts }); }
    if (pending.size) flush();
    const rows = []; let from = 0;
    for (;;) { const { data, error } = await sb.from('kv').select('key,updated_at').range(from, from + 999); if (error || !data) break; rows.push(...data); if (data.length < 1000) break; from += 1000; }
    for (const r of rows) { const t = +new Date(r.updated_at); if (t > LAST_SEEN) LAST_SEEN = t; if (pending.has(r.key)) continue; const c = await lget('kv', r.key); if (!c || (c.ts || 0) < +new Date(r.updated_at) - 1000) await ldel('kv', r.key); }
  } catch (e) { console.log('reconcile failed', e && e.message); }
}

/* ---------------- PDFs ----------------
   Website: saved to the account (private cloud storage, in 20 MB parts).
   Windows app: saved on the PC's disk only (free); books saved to the account are downloaded to the PC when the app opens,
   and any PC-only book can be uploaded to the account with one click so it opens everywhere. */
const bookFile = (id) => 'books/' + id + '.pdf';
let DEVICE = 'your Windows PC';
async function metaOf(id) { try { const s = await storeGet('libmeta:' + id); return s ? JSON.parse(s) : null; } catch { return null; } }
async function uploadParts(id, buf) {
  const parts = Math.max(1, Math.ceil(buf.length / CHUNK));
  for (let i = 0; i < parts; i++) {
    if (JOBS.has('book:' + id)) job('book:' + id, { pct: (i + .15) / parts, sub: (parts > 1 ? 'Part ' + (i + 1) + ' of ' + parts + ' · ' : '') + (buf.length / 1048576).toFixed(1) + ' MB' });
    const { error } = await sb.storage.from('books').upload(USER.id + '/' + id + '/part' + i, new Blob([buf.subarray(i * CHUNK, (i + 1) * CHUNK)], { type: 'application/octet-stream' }), { upsert: true });
    if (error) throw new Error(/payload too large|exceeded/i.test(error.message) ? 'This file is too big for your account storage.' : /fetch|network/i.test(error.message) ? 'No connection. Check your internet and retry.' : error.message);
    if (JOBS.has('book:' + id)) job('book:' + id, { pct: (i + 1) / parts });
  }
  return parts;
}
async function downloadParts(id, meta) {
  const out = new Uint8Array(meta.size); let at = 0;
  for (let i = 0; i < meta.parts; i++) { const { data, error } = await sb.storage.from('books').download(USER.id + '/' + id + '/part' + i); if (error || !data) return null; const b = new Uint8Array(await data.arrayBuffer()); out.set(b, at); at += b.length; }
  return out.buffer;
}
async function libSave(id, data) {
  try {
    const buf = new Uint8Array(data); const nf = NF();
    if (nf) {
      const r = await nf.write(bookFile(id), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)); if (r !== true) return { ok: false, error: (r && r.error) || 'Could not save to disk.' };
      const old = await metaOf(id);
      await storeSet('libmeta:' + id, JSON.stringify(old && old.parts ? { ...old, size: buf.length } : { local: true, device: DEVICE, size: buf.length }));
      return { ok: true, size: buf.length };
    }
    const parts = await uploadParts(id, buf);
    await storeSet('libmeta:' + id, JSON.stringify({ parts, size: buf.length }));
    await flush();
    await lset('files', id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    return { ok: true, size: buf.length };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}
async function libRead(id, opts) {
  const nf = NF();
  if (nf) { const d = await nf.read(bookFile(id)); if (d) return d; } else { const c = await lget('files', id); if (c) return c; }
  try {
    const meta = await metaOf(id); if (!meta) return null;
    if (!meta.parts) { if (meta.local && !nf && !(opts && opts.quiet)) alertMsg('This book is saved on ' + (meta.device || 'your PC') + ' only. To read it here, open PolyMath on that PC and tap "Upload to account".'); return null; }
    const buf = await downloadParts(id, meta); if (!buf) return null;
    if (nf) await nf.write(bookFile(id), buf); else await lset('files', id, buf);
    return buf;
  } catch { return null; }
}
async function libDel(id) {
  const nf = NF(); const meta = await metaOf(id);
  if (meta && meta.parts) { try { await sb.storage.from('books').remove([...Array(meta.parts).keys()].map(i => USER.id + '/' + id + '/part' + i)); } catch {} }
  if (nf) await nf.del(bookFile(id)); else await ldel('files', id);
  await storeDel('libmeta:' + id); return true;
}
// where is this book's PDF? 'account' (opens everywhere), 'pc' (only on a Windows PC), 'here' (on this PC, not in the account)
async function bookInfo(id) {
  const meta = await metaOf(id); const nf = NF(); const onDisk = nf ? await nf.exists(bookFile(id)) : false;
  if (meta && meta.parts) return { where: 'account', onDisk, size: meta.size };
  if (nf && onDisk) return { where: 'here', onDisk, size: meta ? meta.size : 0 };
  if (meta && meta.local) return { where: 'pc', device: meta.device, size: meta.size };
  return { where: 'none' };
}
async function uploadBook(id, name) {
  const nf = NF(); if (!nf) return { ok: false, error: 'Only the Windows app can upload a PC-only book.' };
  const d = await nf.read(bookFile(id)); if (!d) return { ok: false, error: 'The PDF is not on this PC.' };
  const J = 'book:' + id; job(J, { title: 'Uploading "' + (name || 'book') + '" to your account', sub: 'Starting…', pct: 0, state: 'run' });
  try { const buf = new Uint8Array(d); const parts = await uploadParts(id, buf); await storeSet('libmeta:' + id, JSON.stringify({ parts, size: buf.length })); await flush();
    job(J, { state: 'ok', sub: 'Uploaded. It now opens on all your devices.' }); return { ok: true }; }
  catch (e) { job(J, { state: 'err', sub: 'Upload failed: ' + (e.message || e), retry: () => uploadBook(id, name) }); return { ok: false, error: e.message || String(e) }; }
}
// Windows app, on open: upload SAT pictures that were saved only on this PC by older versions
async function backfillSatImages() {
  const nf = NF(); if (!nf) return;
  try {
    const cloud = new Set();
    for (let off = 0; ; off += 1000) { const { data, error } = await sb.storage.from('userdata').list(USER.id, { limit: 1000, offset: off }); if (error || !data) break; data.forEach(f => cloud.add(f.name)); if (data.length < 1000) break; }
    const banks = JSON.parse((await storeGet('sat:list')) || '[]') || []; let n = 0;
    for (const b of banks) { let d = null; try { d = JSON.parse((await storeGet('sat:' + b.id)) || 'null'); } catch {}
      for (const q of (d && d.questions) || []) { const k = 'satimg:' + q.id; if (cloud.has(filePath(k).split('/')[1]) || pending.has(k)) continue;
        const s = await nf.read(diskKey(k), true); if (s) { pending.set(k, { s, ts: Date.now() }); n++; } } }
    if (!n) return; notePending(); job('sync', { title: 'Saving SAT question pictures to your account', sub: n + ' pictures, so they show on your phone', pct: 0, state: 'run' });
    await flush();
  } catch (e) { console.log('sat backfill failed', e && e.message); }
}
// Windows app, on open: bring down books that were saved to the account (from the website or another PC)
async function pullAccountBooks() {
  const nf = NF(); if (!nf) return;
  try {
    const { data } = await sb.from('kv').select('key,value').like('key', 'libmeta:%');
    const want = []; for (const r of data || []) { const id = r.key.slice(8); if (r.value && r.value.parts && !(await nf.exists(bookFile(id)))) want.push([id, r.value]); }
    for (let i = 0; i < want.length; i++) {
      const [id, meta] = want[i]; alertMsg('Downloading ' + (want.length > 1 ? 'book ' + (i + 1) + ' of ' + want.length : 'a book') + ' from your account to this PC…');
      const buf = await downloadParts(id, meta); if (buf) await nf.write(bookFile(id), buf);
    }
    if (want.length) alertMsg(want.length + ' book' + (want.length > 1 ? 's' : '') + ' from your account ' + (want.length > 1 ? 'are' : 'is') + ' now on this PC.');
  } catch (e) { console.log('pull books failed', e && e.message); }
}

/* ---------------- settings and Claude (through the account's server function) ---------------- */
async function getSettings() {
  let { data } = await sb.from('settings').select('*').eq('user_id', USER.id).maybeSingle();
  if (!data) { await sb.from('settings').upsert({ user_id: USER.id }); data = { has_key: false, desmos_key: '', workspace_id: '', model: 'claude-sonnet-5-5', sat_model: 'claude-haiku-5-5' }; }
  const realKey = !!data.has_key; const mode = aiMode(); const local = (mode === 'local' || (mode === 'auto' && !realKey)) && (await localSupported()).ok;
  ENGINE = local ? 'local' : (realKey && mode !== 'local' ? 'claude' : 'none');
  return { hasAnthropicKey: ENGINE !== 'none', realKey, aiEngine: ENGINE, aiMode: mode, localModel: localModelKey(), localWhy: (await localSupported()).why, desmosKey: data.desmos_key || '', workspaceId: data.workspace_id || '', satModel: data.sat_model || 'claude-haiku-5-5', model: data.model || 'claude-sonnet-5-5' };
}

/* ---------------- free AI that runs on this device (WebLLM on the computer's graphics chip) ----------------
   Used by default when there is no Anthropic key, or always if you pick it in Settings. The model downloads once
   (1–5 GB, kept by the browser) and then works offline. Small models are weaker than Claude and cannot see pictures. */
let ENGINE = 'none';
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const LOCAL_MODELS = {
  tiny: { f16: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', gb: 0.9, ctx: 2048, label: 'Tiny: for phones, tablets and older computers (about 0.9 GB)' },
  small: { f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC', gb: 1.3, ctx: 4096, label: 'Small: fast, works on most computers (about 1.3 GB)' },
  medium: { f16: 'Qwen3.5-4B-q4f16_1-MLC', f32: 'Qwen3.5-4B-q4f32_1-MLC', gb: 2.6, ctx: 6144, label: 'Medium: smarter, needs a good graphics chip (about 2.6 GB)' },
  large: { f16: 'Qwen3-8B-q4f16_1-MLC', f32: 'Qwen3-8B-q4f32_1-MLC', gb: 4.8, ctx: 8192, label: 'Large: smartest, gaming PC or 16 GB Mac (about 4.8 GB)' },
};
const lsGet = (k, d) => { try { const v = localStorage.getItem('mr:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const aiMode = () => { const m = lsGet('aiMode', 'auto'); return ['auto', 'local', 'claude'].includes(m) ? m : 'auto'; };
/* Which model this device can hold. Phones and tablets get the tiny one: a web page there only gets about 1 GB of graphics
   memory, and going over makes the browser kill and reload the page. The choice is kept per device, never synced. */
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ORDER = ['tiny', 'small', 'medium', 'large'];
const devGet = (k, d) => { try { const v = localStorage.getItem('pm-dev:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const devSet = (k, v) => { try { (Storage.prototype.__pmSet || Storage.prototype.setItem).call(localStorage, 'pm-dev:' + k, JSON.stringify(v)); } catch {} };
function maxModel() {   // the biggest size this device may try
  if (MOBILE) return 'tiny';
  const mem = navigator.deviceMemory || 8;               // Chrome reports up to 8 (GB)
  let cap = mem <= 4 ? 'tiny' : mem < 8 ? 'small' : 'large';
  const crashed = devGet('llmCrash', {});                // sizes that already crashed here: stay below the smallest of them
  const worst = ORDER.findIndex(k => crashed[k]);
  if (worst > 0 && ORDER.indexOf(cap) >= worst) cap = ORDER[worst - 1];
  return cap;
}
const localModelKey = () => {
  const want = lsGet('localModel', MOBILE ? 'tiny' : 'small'), cap = maxModel();
  const k = LOCAL_MODELS[want] ? want : 'small';
  return ORDER.indexOf(k) > ORDER.indexOf(cap) ? cap : k;
};
// a load or answer that never finished means the page was killed (out of memory): remember it and step down next time
const CRASH_NOTE = (() => { try {
  const busy = devGet('llmBusy', null); if (!busy) return '';
  devSet('llmBusy', null); try { localStorage.removeItem('pm-dev:llmBusy'); } catch {}
  if (Date.now() - busy.t > 30 * 60e3) return '';
  const crashed = devGet('llmCrash', {}); crashed[busy.key] = (crashed[busy.key] || 0) + 1; devSet('llmCrash', crashed);
  if (busy.key === 'tiny') return 'The free AI ran out of memory on this device, so it is turned off here. Use an Anthropic key in Settings, or the free AI on a computer.';
  return 'The free AI was too big for this device, so PolyMath switched to a smaller size. Try again.';
} catch { return ''; } })();
const markBusy = (key) => devSet('llmBusy', { key, t: Date.now() });
const clearBusy = () => { try { localStorage.removeItem('pm-dev:llmBusy'); } catch {} };
let localCheck = null;
function localSupported() {
  return localCheck || (localCheck = (async () => {
    if (!('gpu' in navigator)) return { ok: false, why: 'This browser can\'t run the free AI (it needs WebGPU: Chrome or Edge on a computer, Safari on iPhone with iOS 26, or the PolyMath Windows app).' };
    if ((devGet('llmCrash', {}).tiny || 0) >= 1) return { ok: false, why: 'The free AI ran out of memory on this device. Use an Anthropic key in Settings, or the free AI on a computer.' };
    try { const ad = await navigator.gpu.requestAdapter(); if (!ad) return { ok: false, why: 'No graphics chip available for the free AI on this device.' }; return { ok: true, f16: ad.features.has('shader-f16') }; }
    catch { return { ok: false, why: 'The free AI could not start on this device.' }; }
  })());
}
let llm = null, llmKey = null, llmLoading = null;
function llmProgress(p, text) {
  let el = document.getElementById('pmLLM');
  if (p >= 1) { if (el) { el.querySelector('span').textContent = 'Free AI ready on this device.'; setTimeout(() => el.remove(), 1800); } return; }
  if (!el) { el = document.createElement('div'); el.id = 'pmLLM'; el.innerHTML = '<b>Setting up the free AI on this device</b><span></span><div><i></i></div><small>One-time download. After this it works even offline.</small>';
    const st = document.createElement('style'); st.textContent = '#pmLLM{position:fixed;left:16px;bottom:16px;z-index:200;width:min(360px,calc(100% - 32px));background:#fff;color:#111827;border:2px solid #ffc800;border-radius:16px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.2);font:500 13px "Plus Jakarta Sans",system-ui;display:flex;flex-direction:column;gap:6px}#pmLLM div{height:8px;border-radius:6px;background:#eee;overflow:hidden}#pmLLM i{display:block;height:100%;width:0;background:#ffc800;transition:width .3s}#pmLLM small{color:#6b7280}@media (max-width:820px){#pmLLM{bottom:90px}}';
    document.head.append(st); document.body.append(el); }
  el.querySelector('i').style.width = Math.round(p * 100) + '%'; el.querySelector('span').textContent = Math.round(p * 100) + '% · ' + String(text || '').replace(/\[.*?\]\s*/g, '').slice(0, 80);
}
async function llmEngine() {
  const key = localModelKey(); if (llm && llmKey === key) return llm;
  if (llmLoading && llmKey === key) return llmLoading;
  const sup = await localSupported(); if (!sup.ok) throw Object.assign(new Error(sup.why), { code: 'no_local' });
  llmKey = key; const M = LOCAL_MODELS[key]; const id = sup.f16 ? M.f16 : M.f32;
  llmLoading = (async () => {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
    try { const est = navigator.storage && await navigator.storage.estimate(); if (est && est.quota && est.quota - (est.usage || 0) < M.gb * 1.1e9) throw Object.assign(new Error('Not enough free space for the free AI: it needs about ' + M.gb + ' GB. Free up disk space or pick a smaller size in Settings.'), { quota: true }); } catch (e) { if (e.quota) throw e; }
    const webllm = await import(WEBLLM_URL);
    if (llm) { try { await llm.unload(); } catch {} llm = null; }
    llmProgress(0, 'Starting…');
    markBusy(key);   // if the page dies while loading, the next start knows this size is too big here
    const e = await webllm.CreateMLCEngine(id, { initProgressCallback: (r) => llmProgress(r.progress || 0, r.text) }, { context_window_size: M.ctx });
    clearBusy(); llmProgress(1); llm = e; return e;
  })();
  try { return await llmLoading; } catch (e) { clearBusy(); llmLoading = null; llmKey = null; const el = document.getElementById('pmLLM'); if (el) el.remove(); throw Object.assign(new Error(e.quota ? e.message : /quota/i.test(String(e.message || e)) ? 'Not enough free space for the free AI (it needs about ' + LOCAL_MODELS[key].gb + ' GB). Free up disk space or pick a smaller size in Settings.' : 'The free AI could not load: ' + (e.message || e)), { code: 'no_local' }); }
}
// turn a Claude-style request into a plain chat for the small model (no pictures, no tools), trimmed to fit its memory
function toLocalMessages(req) {
  const M = LOCAL_MODELS[localModelKey()]; const out = (req.max_tokens ? Math.min(req.max_tokens, 2000) : 1200); const budget = Math.max(2000, (M.ctx - out - 200) * 3);
  const flat = (c) => typeof c === 'string' ? c : (c || []).map(b => b.type === 'text' ? b.text : b.type === 'image' ? '[A picture was attached here. You cannot see pictures: say so briefly if it matters and ask the student to type the key part.]' : b.type === 'tool_result' ? 'Result: ' + (typeof b.content === 'string' ? b.content : JSON.stringify(b.content)) : '').filter(Boolean).join('\n');
  let msgs = (req.messages || []).map(m => ({ role: m.role, content: flat(m.content) })).filter(m => m.content);
  const sys = (req.system ? String(req.system) + '\n\n' : '') + 'You are running as a small model on the student\'s own device. Be accurate and brief. If you are not sure, say so.';
  // keep the newest turns; cut long text from the middle so the start and end both survive
  let total = sys.length + msgs.reduce((a, m) => a + m.content.length, 0);
  while (total > budget && msgs.length > 1) { total -= msgs[0].content.length; msgs.shift(); }
  if (total > budget) { const m = msgs[msgs.length - 1]; const keep = Math.max(800, budget - sys.length); const h = Math.floor(keep * .7); m.content = m.content.slice(0, h) + '\n[…]\n' + m.content.slice(-(keep - h)); }
  if (msgs[0] && msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '(continuing)' });
  return { messages: [{ role: 'system', content: sys }, ...msgs], max_tokens: out };
}
async function localSend(id, req, onText) {
  let eng; try { eng = await llmEngine(); } catch (e) { return { error: { code: e.code || 'no_local', message: e.message } }; }
  const { messages, max_tokens } = toLocalMessages(req);
  const json = /JSON/.test(String(req.system || '')) || /JSON object/.test(JSON.stringify(req.messages || []).slice(-3000));
  let text = '', aborted = false, shown = 0; running.set(id, { abort: () => { aborted = true; try { eng.interruptGenerate(); } catch {} } });
  markBusy(llmKey || localModelKey());
  try {
    const qwen = /^Qwen/.test(LOCAL_MODELS[llmKey || localModelKey()].f16);
    const it = await eng.chat.completions.create({ messages, stream: true, max_tokens, temperature: json ? 0.3 : 0.6, ...(json ? { response_format: { type: 'json_object' } } : {}), ...(qwen ? { extra_body: { enable_thinking: false } } : {}) });
    for await (const ch of it) { const d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (!d) continue; text += d; const clean = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, ''); if (onText && clean.length) { const add = clean.slice(shown); shown = clean.length; if (add) onText(add); } }
  } catch (e) { if (!aborted) return { error: { code: 'local_failed', message: 'The free AI stopped: ' + (e.message || e) }, content: [{ type: 'text', text }] }; }
  finally { running.delete(id); clearBusy(); }
  if (aborted) return { error: { code: 'cancelled', message: 'Stopped' }, content: [{ type: 'text', text }] };
  return { content: [{ type: 'text', text: text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }], stop_reason: 'end_turn', local: true };
}
async function fn(body, signal) {
  const { data: { session } } = await sb.auth.getSession();
  return fetch(SB_URL + '/functions/v1/claude', { method: 'POST', signal, headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + (session ? session.access_token : '') }, body: JSON.stringify(body) });
}
async function saveSettings(patch) {
  if (!ACCT.verified && ((patch.anthropicKey || '').trim() || (patch.desmosKey || '').trim() || (patch.workspaceId || '').trim())) { verifyEmail('add API keys'); return false; }
  if (typeof patch.anthropicKey === 'string') {
    const r = await fn({ action: 'save_key', key: patch.anthropicKey.trim() }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { alertMsg((j.error && j.error.message) || 'Could not save the key.'); }
  }
  const row = { user_id: USER.id, updated_at: new Date().toISOString() };
  if (typeof patch.desmosKey === 'string') row.desmos_key = patch.desmosKey.trim();
  if (typeof patch.model === 'string' && patch.model) row.model = patch.model;
  if (typeof patch.workspaceId === 'string') row.workspace_id = patch.workspaceId.trim();
  if (typeof patch.satModel === 'string' && /^claude-[a-z0-9-]+$/.test(patch.satModel)) row.sat_model = patch.satModel;
  await sb.from('settings').upsert(row); return true;
}
const alertMsg = (m) => { try { const t = document.getElementById('toast'); if (t) { t.textContent = m; t.hidden = false; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 5000); return; } } catch {} console.log(m); };
const running = new Map();
async function claudeSend(id, req, onText) {
  if ((ENGINE === 'local' && req.engine !== 'claude') || (req.engine === 'local' && (await localSupported()).ok)) return localSend(id, req, onText);   // engine:'claude' = needs Claude (e.g. it must see a picture)   // engine:'local' asks for the free AI when this device can run it
  const ctl = new AbortController(); running.set(id, ctl);
  try {
    let res;
    try { res = await fn({ action: 'messages', request: req }, ctl.signal); }
    catch (e) { return e && e.name === 'AbortError' ? { error: { code: 'cancelled', message: 'Stopped' } } : { error: { code: 'network', message: 'Could not reach the PolyMath server. Check your internet connection.' } }; }
    if (!res.ok || !(res.headers.get('content-type') || '').includes('event-stream')) {
      let j = {}; try { j = await res.json(); } catch {}
      return { error: (j && j.error) || { code: 'http_' + res.status, message: 'Request failed (' + res.status + ')' } };
    }
    const blocks = []; let stop = null, buf = ''; const dec = new TextDecoder(); const rd = res.body.getReader();
    for (;;) {
      let chunk; try { chunk = await rd.read(); } catch (e) { if (e && e.name === 'AbortError') return { error: { code: 'cancelled', message: 'Stopped' }, content: blocks.filter(Boolean) }; throw e; }
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true }); let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = raw.split('\n').find(l => l.startsWith('data:')); if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_start') { const b = { ...ev.content_block }; if (b.type === 'tool_use') { b._json = ''; b.input = {}; } if (b.type === 'text') b.text = b.text || ''; if (b.type === 'thinking') { b.thinking = b.thinking || ''; b.signature = b.signature || ''; } blocks[ev.index] = b; }
        else if (ev.type === 'content_block_delta') { const b = blocks[ev.index]; if (!b) continue; if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; if (onText) onText(ev.delta.text); } else if (ev.delta.type === 'input_json_delta') b._json += ev.delta.partial_json; else if (ev.delta.type === 'thinking_delta') b.thinking += ev.delta.thinking || ''; else if (ev.delta.type === 'signature_delta') b.signature += ev.delta.signature || ''; }   // thinking blocks go back to Claude exactly as received
        else if (ev.type === 'content_block_stop') { const b = blocks[ev.index]; if (b && b.type === 'tool_use') { try { b.input = b._json ? JSON.parse(b._json) : {}; } catch { b.input = {}; } delete b._json; } }
        else if (ev.type === 'message_delta') { if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; }
        else if (ev.type === 'error') return { error: { code: 'overloaded', message: (ev.error && ev.error.message) || 'Stream error' }, content: blocks.filter(Boolean) };
      }
    }
    return { content: blocks.filter(Boolean), stop_reason: stop };
  } finally { running.delete(id); }
}

/* ---------------- the shared 1v1 pool: SAT banks players agreed to share, and their question pictures ---------------- */
async function poolFn(body) {
  const { data: { session } } = await sb.auth.getSession();
  let r, j; try { r = await fetch(SB_URL + '/functions/v1/pool', { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + (session ? session.access_token : '') }, body: JSON.stringify(body) }); j = await r.json(); }
  catch { throw new Error('Could not reach PolyMath. Check your connection.'); }
  if (!r.ok || j.error) throw new Error(j.error || ('Error ' + r.status)); return j;
}
const POOL_IMGS = new Map();
function poolImg(path) {
  if (!path) return Promise.resolve(null);
  if (!POOL_IMGS.has(path)) POOL_IMGS.set(path, sb.storage.from('pool').download(path).then(async ({ data, error }) => { if (error || !data) { POOL_IMGS.delete(path); return null; }
    let t = (await data.text()).trim(); if (t.startsWith('"')) { try { t = JSON.parse(t); } catch {} }   // the app saves pictures as JSON text
    return /^data:image\//.test(t) ? t : null; }));
  return POOL_IMGS.get(path);
}

/* ---------------- install as an app, full screen, flushing ---------------- */
let installEvt = window.__pmBIP || null; const installCbs = [];
if ((/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !document.querySelector('link[rel=manifest]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = location.origin + '/manifest.webmanifest'; document.head.appendChild(l); }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; installCbs.forEach(f => f()); });
window.addEventListener('appinstalled', () => { installEvt = null; window.__pmInstalled = true; installCbs.forEach(f => f()); const g = document.getElementById('pmGet'); if (g) installedCard(g); });
const flushers = [];
const runFlush = async () => { for (const f of flushers) { try { await f(); } catch {} } await flush(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') runFlush(); else checkRemote(); });
window.addEventListener('focus', () => checkRemote());
setInterval(() => { if (document.visibilityState === 'visible') checkRemote(); }, 30000);
// another device (the Windows app, a phone) changed something: drop the old copies here and reload when it is safe
let remoteDirty = false, checking = false; const remoteKeys = new Set();
async function checkRemote() {
  if (!USER || checking) return; checking = true;
  try {
    const { data, error } = await sb.from('kv').select('key,updated_at').gt('updated_at', new Date(LAST_SEEN).toISOString()).limit(500);
    if (!error && data) for (const r of data) { const t = +new Date(r.updated_at); if (t > LAST_SEEN) LAST_SEEN = t;
      if (pending.has(r.key) || Math.abs((MINE.get(r.key) || 0) - t) < 1000) continue;
      if (r.key.startsWith('ls:')) { try { const v = (await sb.from('kv').select('value').eq('key', r.key).maybeSingle()).data; if (v && !LS_SKIP.test(r.key.slice(3))) { const ns = v.value; (Storage.prototype.__pmSet || Storage.prototype.setItem).call(localStorage, r.key.slice(3), typeof ns === 'string' ? ns : JSON.stringify(ns)); } } catch {} }
      await ldel('kv', r.key); remoteKeys.add(r.key); remoteDirty = true; }
    if (!remoteDirty || !window.__pmSoftRefresh) return;
    const done = await window.__pmSoftRefresh([...remoteKeys]);   // false = you are busy; try again in a bit
    if (done) { remoteKeys.clear(); remoteDirty = false; }
  } catch (e) { console.log('check failed', e && e.message); } finally { checking = false; }
}
window.addEventListener('pagehide', () => { runFlush(); });
const native = window.pmNative || null;     // the Windows app passes real window controls through
const fsCbs = [];
document.addEventListener('fullscreenchange', () => fsCbs.forEach(f => f(!!document.fullscreenElement)));

function installDesk() {
  window.desk = {
    getSettings, saveSettings,
    setFullscreen: async (on) => { if (native) return native.setFullscreen(on); try { if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen(); else if (!on && document.fullscreenElement) await document.exitFullscreen(); } catch {} return true; },
    toggleFullscreen: async () => { if (native) return native.toggleFullscreen(); try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {} return !!document.fullscreenElement; },
    isFullscreen: async () => native ? native.isFullscreen() : !!document.fullscreenElement,
    onFullscreen: (cb) => { if (native && native.onFullscreen) native.onFullscreen(cb); else fsCbs.push(cb); },
    claude: async (req, onText) => claudeSend(Math.random().toString(36).slice(2), req, onText),
    claudeStart: (req, onText) => { const id = Math.random().toString(36).slice(2); return { id, promise: claudeSend(id, req, onText) }; },
    claudeAbort: async (id) => { const c = running.get(id); if (c) c.abort(); return true; },
    unshareAll: async () => { const j = await poolFn({ action: 'unshare_all' }); return !!j.ok; },
    poolFn, poolImg, job,
    gradeFn: async (body) => { const { data: { session } } = await sb.auth.getSession(); let r, j; try { r = await fetch(SB_URL + '/functions/v1/grade', { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + (session ? session.access_token : '') }, body: JSON.stringify(body) }); j = await r.json(); } catch { throw new Error('Could not reach the grader. Check your connection.'); } if (!r.ok || j.error) throw new Error(j.error || ('Error ' + r.status)); return j; },
    rpc: async (name, args) => { const { data, error } = await sb.rpc(name, args || {}); if (error) throw new Error(error.message); return data; },
    aiEngine: () => ENGINE, localModels: () => LOCAL_MODELS, localModelKey, maxLocalModel: maxModel, localSupported, preloadLocal: () => llmEngine().then(() => true, (e) => ({ error: e.message })),
    claudeTest: async () => { try { const r = await fn({ action: 'test' }); return await r.json(); } catch { return { ok: false, code: 'network', message: 'Could not reach the PolyMath server.' }; } },
    libSave, libRead, libDel, storeGet, storeSet, storeDel, bookInfo, uploadBook,
    onFlush: (f) => flushers.push(f),
    account: {
      email: ACCT.username || USER.email,
      username: () => ACCT.username, verifiedEmail: () => ACCT.email,
      verified: () => !!ACCT.verified,
      guest: () => isGuestUser(), toAccount: () => guestToAccount(), nudge: (w) => guestNudge(w),
      verify: (why) => verifyEmail(why),
      onChange: (f) => acctCbs.push(f),
      signOut: async () => { await runFlush(); LEAVING = true; SKIP_UNLOAD = true; await sb.auth.signOut(); try { const rm = Storage.prototype.__pmRemove || Storage.prototype.removeItem; Object.keys(localStorage).filter(k => LS_SYNC.test(k) && !LS_SKIP.test(k)).forEach(k => rm.call(localStorage, k)); } catch {} location.reload(); },
      canInstall: () => !native && !isStandalone(),
      onInstallChange: (f) => installCbs.push(f),
      install: () => getApp(),
      localInfo: NF() ? () => NF().usage() : null,
      openFolder: () => NF() && NF().openFolder(),
    },
  };
}

/* ---------------- load the app itself ---------------- */
const loadScript = (src, attrs) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; Object.assign(s, attrs || {}); s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
// the app keeps small preferences (name, photo, daily goal, streak, activity log, panel sizes) in localStorage under "mr:".
// Those follow the account too: pulled in before the app starts, and pushed whenever they change.
const LS_SYNC = /^mr:/, LS_SKIP = /^mr:(satCalcW|stToolsW|stSideW|boardW|satZoom|featured|localModel)$/;   // per-device layout stays local
async function syncLocalStorage() {
  try {
    const { data } = await sb.from('kv').select('key,value').like('key', 'ls:%');
    for (const r of data || []) { const k = r.key.slice(3); if (LS_SKIP.test(k)) continue; try { Storage.prototype.setItem.call(localStorage, k, typeof r.value === 'string' ? r.value : JSON.stringify(r.value)); } catch {} }
  } catch (e) { console.log('preferences sync failed', e && e.message); }
  const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem; Storage.prototype.__pmRemove = rem; Storage.prototype.__pmSet = set;
  Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage && LS_SYNC.test(k) && !LS_SKIP.test(k)) queue('ls:' + k, { s: JSON.stringify(String(v)), ts: Date.now() }); };
  Storage.prototype.removeItem = function (k) { rem.call(this, k); if (this === localStorage && LS_SYNC.test(k) && !LS_SKIP.test(k)) queue('ls:' + k, { del: true, ts: Date.now() }); };
}
async function startApp() {
  bootMsg('Loading your library…');
  if (native && native.deviceName) { try { DEVICE = (await native.deviceName()) || DEVICE; } catch {} }
  await loadAcct();
  installDesk();
  await reconcile();
  await syncLocalStorage();
  const [css, shell] = await Promise.all([fetch(SITE + 'style.css?v=' + VER).then(r => r.text()), fetch(SITE + 'shell.html?v=' + VER).then(r => r.text())]);
  const base = document.createElement('base'); base.href = SITE; document.head.prepend(base);   // so assets/... resolve to the app's files
  for (const h of ['https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap']) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); }
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.getElementById('pmAuth') && document.getElementById('pmAuth').remove();
  document.body.insertAdjacentHTML('beforeend', shell);
  window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] }, svg: { fontCache: 'global' }, startup: { typeset: false } };
  window.PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  loadScript('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg-full.js', { async: true }).catch(() => {});
  await loadScript(SITE + 'app.js?v=' + VER);
  const b = document.getElementById('pmBoot'); if (b) b.remove();
  setTimeout(offerImport, 2500);
  if (CRASH_NOTE) setTimeout(() => alertMsg(CRASH_NOTE), 2500);
  watchForUpdates();
  setTimeout(() => { if (LINKMSG) alertMsg(LINKMSG); }, 1500);
  if (native) { setTimeout(pullAccountBooks, 4000); setTimeout(backfillSatImages, 9000); }
  if (native && !native.autoUpdate) setTimeout(oldAppNotice, 6000);   // Windows app from before it could update itself
  if (!native && !isStandalone()) { const f = document.querySelector('.side-foot'); if (f) { const bt = document.createElement('button'); bt.className = 'nav-i get-app'; bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg><span>Get the app</span>'; bt.onclick = getApp; f.prepend(bt); } }
}

/* ---------------- a new version was published: offer a refresh (never mid-match or mid-upload) ---------------- */
function watchForUpdates() {
  let shown = false, last = 0;
  const working = () => (window.__pmUploading && window.__pmUploading()) || document.getElementById('nmp') || document.getElementById('nboss') || document.querySelector('.share-ask, #pmVerify');
  const busy = () => working() || (window.__pmBusyNow && window.__pmBusyNow());
  const check = async () => {
    if (shown || Date.now() - last < 60e3) return; last = Date.now();
    let v; try { v = (await (await fetch(SITE + 'version.json?t=' + Date.now(), { cache: 'no-store' })).json()).v; } catch { return; }
    if (!v || v === VER) return;
    if (document.visibilityState === 'hidden' && !busy()) { location.reload(); return; }   // nobody is looking: just take the update
    shown = true; const bar = document.createElement('div'); bar.id = 'pmUpd';
    bar.innerHTML = '<span>PolyMath was updated.</span><button>Refresh</button><button class="x" aria-label="Later">✕</button>';
    const st = document.createElement('style'); st.textContent = '#pmUpd{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:300;display:flex;align-items:center;gap:10px;background:#111827;color:#fff;border-radius:999px;padding:8px 8px 8px 16px;font:600 14px "Plus Jakarta Sans",system-ui;box-shadow:0 10px 30px rgba(0,0,0,.3)}#pmUpd button{height:32px;border:0;border-radius:999px;background:#ffc800;color:#1a1a1a;font:800 13px "Plus Jakarta Sans",system-ui;padding:0 14px;cursor:pointer}#pmUpd .x{background:transparent;color:#9ca3af;padding:0 8px}';
    document.head.append(st); document.body.append(bar);
    bar.querySelector('button').onclick = async () => { if (working()) { alertMsg('Finish your match or upload first, then refresh.'); return; } try { await runFlush(); } catch {} location.reload(); };
    bar.querySelector('.x').onclick = () => bar.remove();
  };
  document.addEventListener('visibilitychange', check); window.addEventListener('focus', check); setInterval(check, 5 * 60e3);
}

/* ---------------- Windows app: move data from the older offline app into this account ---------------- */
async function offerImport() {
  const L = native && native.legacy; if (!L) return;
  try { if (await L.wasDone()) return; } catch { return; }
  if (localStorage.getItem('pm-import-skip:' + USER.id)) return;
  const { keys, pdfs } = await L.list(); const useful = keys.filter(k => !LOCAL_ONLY.test(k));
  if (!useful.length && !pdfs.length) return;
  let books = 0; try { books = (JSON.parse(await L.get('ws:list')) || []).length; } catch {}
  const box = document.createElement('div'); box.id = 'pmImport';
  box.innerHTML = `<div class="pi-card"><h2>Move your books into your account?</h2><p>This computer has <b>${books || pdfs.length} book${(books || pdfs.length) === 1 ? '' : 's'}</b>, your progress, SAT banks, notes and clips from the earlier offline PolyMath. Your progress and notes move to <b>${USER.email}</b>. The PDFs stay on this PC.</p>
    <div class="pi-prog" hidden><div class="pi-bar"><i></i></div><span></span></div><div class="pi-b"><button class="pi-go">Move them</button><button class="pi-later">Not now</button><button class="pi-never">Don't ask again</button></div></div>`;
  const st = document.createElement('style'); st.textContent = `#pmImport{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(0,0,0,.35);padding:16px;font-family:'Plus Jakarta Sans',system-ui}
    #pmImport .pi-card{width:min(520px,100%);background:var(--surface,#fff);color:var(--ink,#111);border:2px solid var(--line,#e5e7eb);border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px}
    #pmImport h2{margin:0;font:800 20px 'Plus Jakarta Sans',system-ui}#pmImport p{margin:0;color:var(--muted,#6b7280);font-size:14.5px;line-height:1.5}
    #pmImport .pi-b{display:flex;gap:8px;flex-wrap:wrap}#pmImport button{height:40px;border-radius:11px;border:2px solid var(--line,#e5e7eb);background:var(--surface,#fff);color:inherit;font:700 14px 'Plus Jakarta Sans',system-ui;padding:0 16px;cursor:pointer}
    #pmImport .pi-go{background:#10a37f;border-color:#10a37f;color:#fff}#pmImport .pi-bar{height:10px;border-radius:6px;background:var(--track,#eee);overflow:hidden}#pmImport .pi-bar i{display:block;height:100%;width:0;background:#10a37f;transition:width .2s}
    #pmImport .pi-prog{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted,#6b7280)}`;
  document.head.appendChild(st); document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('.pi-later').onclick = close;
  box.querySelector('.pi-never').onclick = () => { localStorage.setItem('pm-import-skip:' + USER.id, '1'); close(); };
  box.querySelector('.pi-go').onclick = async () => {
    box.querySelectorAll('button').forEach(x => x.disabled = true); const pr = box.querySelector('.pi-prog'); pr.hidden = false;
    const bar = pr.querySelector('i'), lab = pr.querySelector('span'); const total = useful.length + pdfs.length; let done = 0;
    const step = (t) => { done++; bar.style.width = Math.round(100 * done / total) + '%'; lab.textContent = t; };
    const mergeList = async (k, s) => { const cur = await storeGet(k); if (!cur) return s; try { const a = JSON.parse(cur) || [], b2 = JSON.parse(s) || []; const ids = new Set(a.map(x => x && x.id)); return JSON.stringify([...a, ...b2.filter(x => x && !ids.has(x.id))]); } catch { return s; } };
    try {
      for (const id of pdfs) { lab.textContent = 'Copying book ' + (pdfs.indexOf(id) + 1) + ' of ' + pdfs.length + '…'; const buf = await L.pdf(id); if (buf) { const r = await libSave(id, buf); if (!r.ok) throw new Error(r.error); } step('Copied book ' + (pdfs.indexOf(id) + 1) + ' of ' + pdfs.length); }
      for (const k of useful) { let s = await L.get(k); if (s == null) { step(''); continue; } if (k === 'ws:list' || k === 'sat:list' || k === 'sat:history') s = await mergeList(k, s); await storeSet(k, s); step('Saving ' + k.split(':')[0] + '…'); }
      lab.textContent = 'Finishing up…'; await flush();
      if (pending.size) throw new Error('Some items did not upload yet. Check your connection and try again.');
      await L.done(); lab.textContent = 'Done. Reloading…'; setTimeout(() => location.reload(), 800);
    } catch (e) { lab.textContent = 'Stopped: ' + (e.message || e) + ' Nothing on this computer was changed; you can try again.'; box.querySelectorAll('button').forEach(x => x.disabled = false); }
  };
}

/* ---------------- Get the app: Windows installer, or Add to Home Screen on phones ---------------- */
const UA = navigator.userAgent || '';
const isIOS = () => /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(UA);
const isWindows = () => /Windows NT/.test(UA) && !/Windows Phone/.test(UA);
const inAppBrowser = () => /; wv\)|FBAN|FBAV|Instagram|Snapchat|Line\/|GSA\/|TikTok|musical_ly|Twitter/i.test(UA);
const isChromeAndroid = () => isAndroid() && /Chrome\/\d/.test(UA) && !/SamsungBrowser|EdgA|OPR|Firefox|YaBrowser|DuckDuckGo/.test(UA) && !inAppBrowser();
const CHROME_INTENT = 'intent://' + location.host + '/#Intent;scheme=https;package=com.android.chrome;end';
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch { return false; } };
const SHARE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/></svg>';
const DOTS_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="vertical-align:-4px"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
const GA_CSS = `#pmGet{position:fixed;inset:0;z-index:120;display:grid;place-items:center;background:rgba(0,0,0,.4);padding:16px;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
#pmGet .g-card{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#111827;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
@media (prefers-color-scheme:dark){html:not([data-theme=light]) #pmGet .g-card{background:#181b21;color:#f3f4f6}html:not([data-theme=light]) #pmGet .g-step{background:#0f1115!important}}html[data-theme=dark] #pmGet .g-card{background:#181b21;color:#f3f4f6}html[data-theme=dark] #pmGet .g-step{background:#0f1115!important}
#pmGet h2{margin:0;font:800 21px 'Plus Jakarta Sans',system-ui;display:flex;align-items:center;gap:10px}#pmGet h2 img{width:36px;height:36px;border-radius:50%}
#pmGet p{margin:0;font-size:14.5px;line-height:1.5;color:#6b7280}#pmGet ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;counter-reset:s}
#pmGet .g-step{display:flex;gap:12px;align-items:flex-start;background:#f4f6f8;border-radius:14px;padding:12px 14px;font-size:15px;line-height:1.45}
#pmGet .g-step b.n{flex:none;width:26px;height:26px;border-radius:50%;background:#10a37f;color:#fff;display:grid;place-items:center;font-size:13px}
#pmGet .g-btns{display:flex;gap:8px;flex-wrap:wrap}#pmGet button{height:44px;border-radius:12px;border:2px solid #e5e7eb;background:transparent;color:inherit;font:800 14.5px 'Plus Jakarta Sans',system-ui;padding:0 18px;cursor:pointer}
#pmGet a.g-go{display:inline-flex;align-items:center;height:44px;border-radius:12px;padding:0 18px;font:800 14.5px 'Plus Jakarta Sans',system-ui;text-decoration:none;border:2px solid #ffc800}#pmGet .g-man{display:flex;flex-direction:column;gap:10px}
#pmGet .g-go{background:#ffc800;border-color:#ffc800;color:#1a1a1a;box-shadow:0 4px 0 #d9a400}#pmGet .g-go:disabled{opacity:.6}
#pmGet .g-bar{height:10px;border-radius:6px;background:#e5e7eb;overflow:hidden}#pmGet .g-bar i{display:block;height:100%;width:0;background:#10a37f;transition:width .2s}#pmGet small{color:#6b7280;font-size:12.5px;line-height:1.45}`;
function getApp(upgrade) { upgrade = upgrade === true;
  if (isAndroid() && !upgrade && installEvt) {   // Chrome is ready: show its own install sheet straight away, one tap
    const e = installEvt; installEvt = null; try { e.prompt(); } catch {}
    e.userChoice.then(c => { if (c && c.outcome === 'accepted') { getApp(); const g = document.getElementById('pmGet'); if (g) installedCard(g, true); } }).catch(() => {});
    return;
  }
  if (!document.getElementById('pmGetCss')) { const st = document.createElement('style'); st.id = 'pmGetCss'; st.textContent = GA_CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'pmGet'; const logo = SITE + 'assets/logo.png';
  const steps = (arr) => '<ol>' + arr.map((t, i) => '<li class="g-step"><b class="n">' + (i + 1) + '</b><span>' + t + '</span></li>').join('') + '</ol>';
  let body;
  if (isIOS()) body = '<p>Add PolyMath to your Home Screen. It opens full screen like an app, and you stay signed in.</p>' + steps(['Open this page in <b>Safari</b> (or Chrome on iOS 16.4+).', 'Tap the <b>Share</b> button ' + SHARE_SVG + ' at the bottom of the screen (top right on iPad).', 'Scroll down and tap <b>Add to Home Screen</b>.', 'Tap <b>Add</b>. PolyMath is now on your Home Screen.']) + '<div class="g-btns"><button class="g-close">Got it</button></div>';
  else if (isAndroid() && !isChromeAndroid()) body = '<p>Installing works best from <b>Chrome</b>. Tap below to open PolyMath there, then tap <b>Get the app</b> again.</p><div class="g-btns"><a class="g-go" href="' + CHROME_INTENT + '">Open in Chrome</a><button class="g-close">Not now</button></div><small>No Chrome? In this browser, open the menu and tap <b>Add to Home screen</b> or <b>Install</b>.</small>';
  else if (isAndroid()) body = '<p>Install PolyMath on your phone. It opens full screen like a normal app, and you stay signed in.</p><div class="g-btns"><button class="g-go g-and" disabled>Getting ready…</button><button class="g-close">Not now</button></div><div class="g-man" hidden><small>Chrome hasn’t offered the install yet. Do it from the menu instead:</small>' + steps(['Tap the menu ' + DOTS_SVG + ' at the top right.', 'Tap <b>Add to Home screen</b> (or <b>Install app</b>).', 'Choose <b>Install</b>, not "Create shortcut". A shortcut opens in a browser tab with the address bar.']) + '</div>';
  else if (upgrade) body = '<p>A new version of the Windows app is ready. Install it once and from then on PolyMath updates itself.</p><div class="g-prog" hidden><div class="g-bar"><i></i></div><small class="g-lab"></small></div><div class="g-btns"><button class="g-go g-win">Download update</button><button class="g-close g-later">Later</button></div><small>Then close PolyMath and open <b>PolyMath-Setup.exe</b> from your Downloads.</small>';
  else if (isWindows()) body = '<p>PolyMath as a Windows app. Books you add there are saved on your PC, so they don’t use up account space.</p><div class="g-prog" hidden><div class="g-bar"><i></i></div><small class="g-lab"></small></div><div class="g-btns"><button class="g-go g-win">Download for Windows</button><button class="g-close">Not now</button></div><small>Then open <b>PolyMath-Setup.exe</b>. If Windows says "Windows protected your PC", click <b>More info</b> → <b>Run anyway</b>.</small>';
  else body = '<p>The app is for Windows, iPhone and Android. On this computer, just use PolyMath here in your browser.</p><div class="g-btns"><button class="g-close">OK</button><button class="g-win2">Download the Windows app anyway</button></div><div class="g-prog" hidden><div class="g-bar"><i></i></div><small class="g-lab"></small></div>';
  el.innerHTML = '<div class="g-card"><h2><img src="' + logo + '" alt="">' + (upgrade ? 'Update PolyMath' : 'Get the PolyMath app') + '</h2>' + body + '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.g-close')) el.remove(); });
  const later = el.querySelector('.g-later'); if (later) later.addEventListener('click', () => { try { localStorage.setItem('pm-oldapp-later', String(Date.now() + 24 * 3600e3)); } catch {} });
  const and = el.querySelector('.g-and');
  if (and) {
    const ready = () => { if (installEvt && el.isConnected) { and.disabled = false; and.hidden = false; and.textContent = 'Install PolyMath'; el.querySelector('.g-man').hidden = true; } };
    installCbs.push(ready); ready();
    setTimeout(() => { if (!installEvt && el.isConnected && !window.__pmInstalled) { and.hidden = true; el.querySelector('.g-man').hidden = false; } }, 3500);
    and.onclick = async () => { if (!installEvt) return; const e = installEvt; installEvt = null; try { e.prompt(); const c = await e.userChoice; if (c && c.outcome === 'accepted') installedCard(el, true); } catch {} };
    if (navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then(a => { if (a && a.length && el.isConnected) installedCard(el); }).catch(() => {});
  }
  const win = el.querySelector('.g-win') || el.querySelector('.g-win2'); if (win) win.onclick = () => downloadInstaller(el, win);
}
function installedCard(el, fresh) {
  const c = el.querySelector('.g-card'); if (!c) return;
  c.innerHTML = '<h2><img src="' + SITE + 'assets/logo.png" alt="">' + (fresh ? 'Installing PolyMath' : 'PolyMath is installed') + '</h2><p>' + (fresh ? 'It will appear on your home screen in a few seconds. ' : '') + 'Open <b>PolyMath</b> from your home screen or app drawer. It opens full screen, and you stay signed in.</p><small>If an old PolyMath icon opens with an address bar, it is a shortcut, not the app: hold it, remove it, and use the new one.</small><div class="g-btns"><button class="g-close">Done</button></div>';
}
function oldAppNotice() {
  if (localStorage.getItem('pm-oldapp-later') > Date.now()) return;
  getApp(true);
}
async function downloadInstaller(el, btn) {
  const pr = el.querySelector('.g-prog'), bar = el.querySelector('.g-bar i'), lab = el.querySelector('.g-lab'); pr.hidden = false; btn.disabled = true;
  try {
    const m = await (await fetch(SITE + 'download/win.json?t=' + Date.now(), { cache: 'no-store' })).json();
    const parts = []; let got = 0;
    for (const p of m.parts) {
      const r = await fetch(SITE + 'download/' + p + '?v=' + m.version); if (!r.ok) throw new Error('download failed (' + r.status + ')');
      const rd = r.body.getReader(); const chunks = [];
      for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; bar.style.width = Math.round(100 * got / m.size) + '%'; lab.textContent = 'Downloading… ' + (got / 1048576).toFixed(0) + ' of ' + (m.size / 1048576).toFixed(0) + ' MB'; }
      parts.push(new Blob(chunks));
    }
    const blob = new Blob(parts, { type: 'application/octet-stream' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.file || 'PolyMath-Setup.exe'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    lab.innerHTML = 'Downloaded <b>' + (m.file || 'PolyMath-Setup.exe') + '</b> (version ' + m.version + '). Open it from your Downloads to install.'; btn.textContent = 'Download again'; btn.disabled = false;
  } catch (e) { lab.textContent = 'Could not download: ' + (e.message || e) + '. Try again in a moment.'; btn.disabled = false; }
}

/* ---------------- sign-in screen ---------------- */
function bootMsg(t) { const b = document.getElementById('pmBoot'); if (b) b.textContent = t; }
const AUTH_CSS = `
#pmAuth{position:fixed;inset:0;display:grid;place-items:center;background:#f4f6f8;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#111827;z-index:100;padding:16px}
#pmAuth .pa-card{width:min(400px,100%);background:#fff;border:2px solid #e5e7eb;border-radius:22px;padding:28px 26px;box-shadow:0 10px 40px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:12px}
#pmAuth .pa-logo{display:flex;align-items:center;gap:10px;font:800 24px 'Plus Jakarta Sans',system-ui}#pmAuth .pa-logo img{width:44px;height:44px;border-radius:50%}
#pmAuth h1{font:800 20px 'Plus Jakarta Sans',system-ui;margin:6px 0 0}#pmAuth p{margin:0;font-size:14px;color:#6b7280}
#pmAuth label{font:700 12.5px 'Plus Jakarta Sans',system-ui;color:#6b7280;margin-bottom:-6px}
#pmAuth input{height:44px;border:2px solid #e5e7eb;border-radius:12px;padding:0 14px;font:500 15px system-ui;outline:none}#pmAuth input:focus{border-color:#10a37f}
#pmAuth .pa-go{height:48px;border:0;border-radius:999px;background:#ffc800;color:#1a1a1a;font:800 16px 'Plus Jakarta Sans',system-ui;cursor:pointer;box-shadow:0 4px 0 #d9a400}#pmAuth .pa-go:disabled{opacity:.6}
#pmAuth .pa-alt{background:none;border:0;color:#4b5563;font:600 13.5px system-ui;cursor:pointer;text-decoration:underline;padding:2px}
#pmAuth .pa-msg{font-size:13.5px;min-height:18px}#pmAuth .pa-msg.err{color:#dc2626}#pmAuth .pa-msg.ok{color:#059669}
#pmAuth .pa-seg{display:grid;grid-template-columns:1fr 1fr;background:#eef0f3;border-radius:12px;padding:4px;gap:4px}#pmAuth .pa-seg button{height:36px;border:0;border-radius:9px;background:transparent;color:inherit;font:700 14px 'Plus Jakarta Sans',system-ui;cursor:pointer}#pmAuth .pa-seg button.on{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}
#pmAuth .pa-guest{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:4px}#pmAuth .pa-guest span{font-size:12px;color:#9ca3af}
#pmAuth .pa-gbtn{width:100%;height:44px;border-radius:999px;border:2px solid #e5e7eb;background:transparent;color:inherit;font:800 15px 'Plus Jakarta Sans',system-ui;cursor:pointer}#pmAuth .pa-gbtn:disabled{opacity:.6}
#pmAuth .pa-guest small{font-size:12px;color:#6b7280;text-align:center;line-height:1.4}
#pmAuth .pa-row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
@media (prefers-color-scheme:dark){html:not([data-theme=light]) #pmAuth{background:#0f1115;color:#f3f4f6}html:not([data-theme=light]) #pmAuth .pa-card{background:#181b21;border-color:#2a2f38;box-shadow:none}html:not([data-theme=light]) #pmAuth input{background:#0f1115;color:#f3f4f6;border-color:#2a2f38}html:not([data-theme=light]) #pmAuth .pa-alt{color:#c4c9d4}html:not([data-theme=light]) #pmAuth .pa-seg{background:#0f1115}html:not([data-theme=light]) #pmAuth .pa-seg button.on{background:#2a2f38;box-shadow:none}html:not([data-theme=light]) #pmAuth p,html:not([data-theme=light]) #pmAuth label{color:#9ca3af}}html[data-theme=dark] #pmAuth{background:#0f1115;color:#f3f4f6}html[data-theme=dark] #pmAuth .pa-card{background:#181b21;border-color:#2a2f38;box-shadow:none}html[data-theme=dark] #pmAuth input{background:#0f1115;color:#f3f4f6;border-color:#2a2f38}html[data-theme=dark] #pmAuth .pa-alt{color:#c4c9d4}html[data-theme=dark] #pmAuth .pa-seg{background:#0f1115}html[data-theme=dark] #pmAuth .pa-seg button.on{background:#2a2f38;box-shadow:none}html[data-theme=dark] #pmAuth p,html[data-theme=dark] #pmAuth label{color:#9ca3af}
#pmAuth input{color:inherit;background-color:transparent}#pmAuth input::placeholder{color:#9ca3af}`;
function authScreen(mode, opt) { opt = opt || {};
  const b = document.getElementById('pmBoot'); if (b) b.hidden = true;
  let el = document.getElementById('pmAuth');
  if (!el) { const st = document.createElement('style'); st.textContent = AUTH_CSS; document.head.appendChild(st); el = document.createElement('div'); el.id = 'pmAuth'; document.body.appendChild(el); }
  const kind = opt.kind || 'name';     // new accounts: username (no email needed) or email
  const T = { in: ['Sign in', 'Your books and progress are saved to your account.', 'Sign in'],
    up: ['Create your account', kind === 'name' ? 'Just a username and password. Play right away; add an email later to unlock the AI tutor and textbook uploads.' : 'Your books, progress and settings are saved to your account and follow you to any device.', 'Create account'],
    reset: ['Reset your password', 'Enter your email or username. We will email you a link to set a new password.', 'Send reset link'],
    newpw: ['Choose a new password', opt.username ? 'New password for <b>' + opt.username + '</b>.' : 'Enter a new password for your account.', 'Save password'] }[mode];
  const idField = mode === 'newpw' ? '' : mode === 'up'
    ? (kind === 'name' ? '<label for="paEmail">Username</label><input id="paEmail" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="3–20 letters, numbers or _">' : '<label for="paEmail">Email</label><input id="paEmail" type="email" autocomplete="email">')
    : '<label for="paEmail">Email or username</label><input id="paEmail" type="text" autocomplete="username" autocapitalize="none" spellcheck="false">';
  el.innerHTML = `<form class="pa-card" novalidate><div class="pa-logo"><img src="${SITE}assets/logo.png" alt="">PolyMath</div><h1>${T[0]}</h1><p>${T[1]}</p>
    ${mode === 'up' ? `<div class="pa-seg"><button type="button" data-k="name" class="${kind === 'name' ? 'on' : ''}">Username</button><button type="button" data-k="email" class="${kind === 'email' ? 'on' : ''}">Email</button></div>` : ''}
    ${idField}
    ${mode !== 'reset' ? `<label for="paPw">Password</label><input id="paPw" type="password" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" minlength="8">` : ''}
    <div class="pa-msg" id="paMsg"></div><button class="pa-go" id="paGo">${T[2]}</button>
    <div class="pa-row">${mode === 'in' ? '<button type="button" class="pa-alt" data-m="up">Create an account</button><button type="button" class="pa-alt" data-m="reset">Forgot password?</button>' : mode !== 'newpw' ? '<button type="button" class="pa-alt" data-m="in">I already have an account</button>' : ''}</div></form>`;
  if (mode === 'in' || mode === 'up') { const gb = document.createElement('div'); gb.className = 'pa-guest'; gb.innerHTML = '<span>or</span><button type="button" class="pa-gbtn">Play 1v1 as a guest</button><small>No account needed. Guest matches aren\'t ranked and other features stay locked.</small>';
    el.querySelector('.pa-card').appendChild(gb);
    gb.querySelector('button').onclick = async () => { const b = gb.querySelector('button'); b.disabled = true; b.textContent = 'Starting…';
      try { let c = null; try { c = JSON.parse(localStorage.getItem('pm-guest') || 'null'); } catch {}
        let r = c ? await sb.auth.signInWithPassword({ email: c.email, password: c.password }) : null;
        if (!c || (r && r.error)) { const j = await acctFn({ action: 'guest' }); c = { email: j.email, password: j.password }; try { localStorage.setItem('pm-guest', JSON.stringify(c)); } catch {} r = await sb.auth.signInWithPassword(c); }
        if (r.error) throw r.error; }
      catch (e) { msg(e.message || String(e)); b.disabled = false; b.textContent = 'Play 1v1 as a guest'; } }; }
  if (!native && !isStandalone()) { const g = document.createElement('button'); g.type = 'button'; g.className = 'pa-alt pa-get'; g.textContent = 'Get the PolyMath app'; g.onclick = getApp; el.querySelector('.pa-card').appendChild(g); }
  el.querySelectorAll('[data-m]').forEach(x => x.onclick = () => authScreen(x.dataset.m));
  el.querySelectorAll('[data-k]').forEach(x => x.onclick = () => authScreen('up', { kind: x.dataset.k }));
  const msg = (t, ok) => { const m = document.getElementById('paMsg'); m.textContent = t; m.className = 'pa-msg ' + (ok ? 'ok' : 'err'); };
  if (opt.note) msg(opt.note, !opt.bad);
  if (opt.id && document.getElementById('paEmail')) document.getElementById('paEmail').value = opt.id;
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const go = document.getElementById('paGo'); go.disabled = true; msg('');
    const id = ((document.getElementById('paEmail') || {}).value || '').trim(), pw = (document.getElementById('paPw') || {}).value || '';
    const isEmail = id.includes('@');
    try {
      if (mode === 'up' && kind === 'name' && !/^[A-Za-z0-9_]{3,20}$/.test(id)) throw new Error('Usernames are 3 to 20 letters, numbers or _ (no spaces).');
      if (mode === 'up' && kind === 'email' && !/^\S+@\S+\.\S+$/.test(id)) throw new Error('Enter your email address.');
      if ((mode === 'in' || mode === 'reset') && !id) throw new Error('Enter your email or username.');
      if (mode !== 'reset' && pw.length < 8) throw new Error('Use a password of at least 8 characters.');
      if (mode === 'in') { const { error } = await sb.auth.signInWithPassword({ email: nameToEmail(id), password: pw }); if (error) throw error; }
      else if (mode === 'up' && kind === 'name') { await acctFn({ action: 'signup', username: id, password: pw }); const { error } = await sb.auth.signInWithPassword({ email: nameToEmail(id), password: pw }); if (error) throw error; }
      else if (mode === 'up') { const { data, error } = await sb.auth.signUp({ email: id, password: pw, options: { emailRedirectTo: location.origin } }); if (error) throw error; if (!data.session) { msg('Check your email and click the link to confirm your account, then sign in here.', true); go.disabled = false; return; } }
      else if (mode === 'reset' && !isEmail) { const j = await acctFn({ action: 'reset_start', username: id }); msg('Reset link sent to ' + j.hint + '. Open it on any device.', true); go.disabled = false; return; }
      else if (mode === 'reset') { const { error } = await sb.auth.resetPasswordForEmail(id, { redirectTo: location.origin }); if (error) throw error; msg('Reset link sent. Check your email.', true); go.disabled = false; return; }
      else if (mode === 'newpw' && opt.ticket) { const j = await acctFn({ action: 'reset_finish', ticket: opt.ticket, password: pw }); msg('Password saved. Signing you in…', true); const { error } = await sb.auth.signInWithPassword({ email: nameToEmail(j.username), password: pw }); if (error) authScreen('in', { id: j.username, note: 'Password saved. Sign in with it now.' }); }
      else if (mode === 'newpw') { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; msg('Password saved.', true); }
    } catch (err) { msg(/Invalid login/i.test(err.message) ? (isEmail ? 'That email and password do not match.' : 'That username and password do not match.') : /not confirmed/i.test(err.message) ? 'Confirm your email first: click the link we sent you.' : err.message); go.disabled = false; }
  };
  setTimeout(() => { const f = (document.getElementById('paEmail') && !document.getElementById('paEmail').value) ? document.getElementById('paEmail') : document.getElementById('paPw'); f && f.focus(); }, 30);
}

/* ---------------- verify an email (username accounts): needed for API keys, Claude and textbook uploads ---------------- */
const VF_CSS = `#pmVerify{position:fixed;inset:0;z-index:130;display:grid;place-items:center;background:rgba(0,0,0,.45);padding:16px;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
#pmVerify .v-card{width:min(420px,100%);background:#fff;color:#111827;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
#pmVerify h2{margin:0;font:800 20px 'Plus Jakarta Sans',system-ui}#pmVerify p{margin:0;font-size:14.5px;line-height:1.5;color:#6b7280}
#pmVerify input{height:46px;border:2px solid #e5e7eb;border-radius:12px;padding:0 14px;font:500 16px system-ui;outline:none;background:transparent;color:inherit}#pmVerify input:focus{border-color:#10a37f}
#pmVerify .v-btns{display:flex;gap:8px;flex-wrap:wrap}#pmVerify button{height:44px;border-radius:12px;border:2px solid #e5e7eb;background:transparent;color:inherit;font:800 14.5px 'Plus Jakarta Sans',system-ui;padding:0 18px;cursor:pointer}
#pmVerify .v-go{background:#ffc800;border-color:#ffc800;color:#1a1a1a;box-shadow:0 4px 0 #d9a400}#pmVerify button:disabled{opacity:.6}
#pmVerify .v-msg{font-size:13.5px;min-height:18px;color:#dc2626}#pmVerify .v-msg.ok{color:#059669}
@media (prefers-color-scheme:dark){html:not([data-theme=light]) #pmVerify .v-card{background:#181b21;color:#f3f4f6}html:not([data-theme=light]) #pmVerify input{border-color:#2a2f38}html:not([data-theme=light]) #pmVerify p{color:#9ca3af}}html[data-theme=dark] #pmVerify .v-card{background:#181b21;color:#f3f4f6}html[data-theme=dark] #pmVerify input{border-color:#2a2f38}html[data-theme=dark] #pmVerify p{color:#9ca3af}`;
function verifyEmail(why) {
  if (ACCT.guest) { guestNudge(why); return; }
  if (ACCT.verified || document.getElementById('pmVerify')) return;
  if (!document.getElementById('pmVfCss')) { const st = document.createElement('style'); st.id = 'pmVfCss'; st.textContent = VF_CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'pmVerify';
  el.innerHTML = '<div class="v-card"><h2>Verify your email</h2><p>' + (why ? 'To ' + why + ', add' : 'Add') + ' an email to <b>' + (ACCT.username || 'your account') + '</b>. This unlocks API keys, the Claude tutor and textbook uploads. The Arena works without it.</p><input type="email" id="vfEmail" autocomplete="email" placeholder="you@example.com"><div class="v-msg" id="vfMsg"></div><div class="v-btns"><button class="v-go" id="vfGo">Send link</button><button class="v-close">Not now</button></div></div>';
  document.body.appendChild(el);
  let poll = 0; const close = () => { clearInterval(poll); el.remove(); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.v-close')) close(); });
  const m = (t, ok) => { const x = el.querySelector('#vfMsg'); x.textContent = t; x.className = 'v-msg' + (ok ? ' ok' : ''); };
  const go = el.querySelector('#vfGo'); setTimeout(() => el.querySelector('#vfEmail').focus(), 30);
  go.onclick = async () => {
    const email = el.querySelector('#vfEmail').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) return m('Enter your email address.');
    go.disabled = true; m('Sending…', true);
    try {
      await acctFn({ action: 'verify_start', email }, true);
      el.querySelector('.v-card').innerHTML = '<h2>Check your email</h2><p>We sent a link to <b>' + email.replace(/</g, '&lt;') + '</b>. Tap it on any device (your phone is fine). This screen updates by itself.</p><small style="color:#6b7280;font-size:12.5px">The email may say “Magic Link” or “Log In”. Check spam if it’s not there in a minute.</small><div class="v-msg" id="vfMsg"></div><div class="v-btns"><button class="v-go" id="vfCheck">I tapped the link</button><button class="v-close">Close</button></div>';
      const check = async (loud) => { await loadAcct(); if (ACCT.verified) { close(); acctCbs.forEach(f => { try { f(ACCT); } catch {} }); alertMsg('Email verified. AI and uploads are unlocked.'); } else if (loud) m('Not verified yet. Tap the link in the email first.'); };
      el.querySelector('#vfCheck').onclick = () => check(true);
      poll = setInterval(() => check(false), 5000);
    } catch (e) { m(e.message); go.disabled = false; }
  };
}

function guestNudge(why) {
  if (document.getElementById('pmVerify')) return;
  if (!document.getElementById('pmVfCss')) { const st = document.createElement('style'); st.id = 'pmVfCss'; st.textContent = VF_CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'pmVerify';
  el.innerHTML = '<div class="v-card"><h2>Make a free account</h2><p>Guests can only play 1v1, and guest matches aren\'t ranked.' + (why ? ' To ' + why + ', you need an account.' : '') + ' An account takes 10 seconds: just a username and password.</p><div class="v-btns"><button class="v-go" id="gnUp">Create account</button><button class="v-close">Keep playing</button></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.v-close')) el.remove(); });
  el.querySelector('#gnUp').onclick = () => guestToAccount();
}
async function guestToAccount() { LEAVING = true; SKIP_UNLOAD = true; pending.clear(); try { localStorage.removeItem('pm-guest'); } catch {} try { await sb.auth.signOut({ scope: 'local' }); } catch {} try { history.replaceState(null, '', location.origin + location.pathname + '#signup'); } catch { location.hash = 'signup'; } location.reload(); }

/* ---------------- an email link landed on this page ---------------- */
let LINKMSG = '';
async function handleLink() {
  if (LINKERR) { LINKMSG = LINKERR; return true; }
  if (!LINK) return true;
  bootMsg('Checking your email link…');
  try {
    const j = await acctFn({ action: 'finish', access_token: LINK });
    if (j.reset) { authScreen('newpw', { ticket: j.reset, username: j.username }); return 'reset'; }
    LINKMSG = 'Email verified: ' + j.verified + '. The AI tutor, API keys and textbook uploads are unlocked.';
  } catch (e) {
    if (e.status === 404 && LINKTYPE === 'signup' && LINKRT) { await sb.auth.setSession({ access_token: LINK, refresh_token: LINKRT }).catch(() => {}); return true; }   // an ordinary new-account confirmation
    LINKMSG = e.message;
  }
  if (started) { await loadAcct(); acctCbs.forEach(f => { try { f(ACCT); } catch {} }); }
  return true;
}

let started = false, holdBoot = false, LEAVING = false;
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { authScreen('newpw'); return; }
  if (holdBoot) return;
  if (event === 'SIGNED_OUT' && started && !LEAVING) { SKIP_UNLOAD = true; location.reload(); return; }   // never keep running without a session: every request would fail with 'permission denied'
  if (session && session.user && !started) { started = true; USER = session.user; startApp().catch(e => { bootMsg('PolyMath could not start: ' + e.message); console.error(e); }); }
});
handleLink().then((r) => {
  if (r === 'reset') { holdBoot = true; const un = sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' && session && !started) { holdBoot = false; started = true; USER = session.user; startApp().catch(e => bootMsg('PolyMath could not start: ' + e.message)); } }); return; }
  sb.auth.getSession().then(({ data }) => { if (!data.session && !/type=recovery/.test(location.hash)) { const up = location.hash === '#signup'; if (up) history.replaceState(null, '', location.origin + location.pathname); authScreen(up ? 'up' : 'in', LINKMSG ? { note: LINKMSG, bad: !/verified/.test(LINKMSG) } : {}); } else if (data.session && !started) { started = true; USER = data.session.user; startApp().catch(e => bootMsg('PolyMath could not start: ' + e.message)); } });
});
})();