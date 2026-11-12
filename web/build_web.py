#!/usr/bin/env python3
"""Build the web version of PolyMath from the desktop source and upload the app files to Supabase Storage (bucket "site").
Usage: build_web.py [--upload]   (uploading needs the temporary site-upload policy to be enabled)"""
import json, os, shutil, re, sys, time, io, hashlib, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist-web')
SITE = os.path.join(OUT, 'site')        # -> Supabase Storage, public bucket "site"
VERCEL = os.path.join(OUT, 'vercel')    # -> Vercel: tiny loader, manifest, service worker, icons
SB_URL = 'https://bsphvpcrnuzptrwoivtu.supabase.co'
SB_ANON = os.environ.get('SB_ANON', '')

def w(path, data, mode='w'):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode) as f: f.write(data)

html = open(os.path.join(ROOT, 'app', 'index.html'), encoding='utf-8').read()
css = html[html.index('<style>') + 7: html.index('</style>')]
body = html[html.index('<body>') + 6: html.index('</body>')]
body = re.sub(r'<script[\s\S]*?</script>', '', body)          # scripts are loaded by web.js
w(os.path.join(SITE, 'style.css'), css)
w(os.path.join(SITE, 'shell.html'), body)
w(os.path.join(SITE, 'app.js'), open(os.path.join(ROOT, 'app', 'app.js'), encoding='utf-8').read())
w(os.path.join(SITE, 'web.js'), open(os.path.join(ROOT, 'web', 'web.js'), encoding='utf-8').read())
shutil.rmtree(os.path.join(SITE, 'assets'), ignore_errors=True); os.makedirs(os.path.join(SITE, 'assets'), exist_ok=True)
for name in ('logo.png', 'logo-full.png', 'boss-miss.png', 'boss-hard.png', 'coach.png'):
    im = Image.open(os.path.join(ROOT, 'app', 'assets', name)).convert('RGBA')
    im.thumbnail((256, 256) if name.startswith('logo') else (520, 520)); im.save(os.path.join(SITE, 'assets', name), optimize=True)
ver = hashlib.sha1(b''.join(open(os.path.join(SITE, f), 'rb').read() for f in ('style.css', 'shell.html', 'app.js', 'web.js'))).hexdigest()[:10]
w(os.path.join(SITE, 'version.json'), json.dumps({'v': ver, 'built': int(time.time())}))

# ---- Vercel side (rarely changes) ----
logo = Image.open(os.path.join(ROOT, 'app', 'assets', 'logo.png')).convert('RGBA')
for s in (192, 512):
    bg = Image.new('RGBA', (s, s), (255, 255, 255, 0)); im = logo.copy(); im.thumbnail((s, s)); bg.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
    bg = bg.quantize(colors=48, method=Image.Quantize.FASTOCTREE)
    os.makedirs(os.path.join(SITE, 'icons'), exist_ok=True); bg.save(os.path.join(SITE, 'icons', f'icon-{s}.png'), optimize=True)
# maskable icon for Android: logo inside the safe zone on a solid background, so the launcher can crop it to any shape
mk = Image.new('RGBA', (512, 512), (255, 255, 255, 255)); im = logo.copy(); im.thumbnail((320, 320)); mk.paste(im, ((512 - im.width) // 2, (512 - im.height) // 2), im)
mk.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT).save(os.path.join(SITE, 'icons', 'icon-maskable-512.png'), optimize=True)
os.makedirs(VERCEL, exist_ok=True)
ICON = SB_URL + '/storage/v1/object/public/site/icons/'
w(os.path.join(VERCEL, 'manifest.webmanifest'), json.dumps({
    'id': '/', 'name': 'PolyMath', 'short_name': 'PolyMath', 'lang': 'en', 'dir': 'ltr', 'orientation': 'any', 'display_override': ['standalone'],
    'prefer_related_applications': False, 'related_applications': [{'platform': 'webapp', 'url': 'https://polymath-liard.vercel.app/manifest.webmanifest'}], 'description': 'Turn any textbook into a course you can master. SAT practice with Desmos and an AI tutor.',
    'start_url': '/', 'scope': '/', 'display': 'standalone',
    'background_color': '#f4f6f8', 'theme_color': '#10a37f',
    'icons': [{'src': ICON + 'icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'}, {'src': ICON + 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}, {'src': ICON + 'icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=1))
w(os.path.join(VERCEL, 'index.html'), f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PolyMath</title><meta name="description" content="Turn any textbook into a course you can master.">
<link rel="icon" href="{SB_URL}/storage/v1/object/public/site/icons/icon-192.png"><link rel="apple-touch-icon" href="{SB_URL}/storage/v1/object/public/site/icons/icon-192.png">
<meta name="theme-color" content="#10a37f"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="PolyMath">
<style>html,body{{margin:0;background:#f4f6f8}}@media (prefers-color-scheme:dark){{html,body{{background:#0f1115}}}}
#pmBoot{{position:fixed;inset:0;display:grid;place-items:center;font:600 15px system-ui,sans-serif;color:#6b7280}}</style>
<script>
// phones and tablets: offer the installable app right away (computers use the Windows app instead), and keep Chrome's install offer for the Get the app button
(function(){{var m=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(m){{var l=document.createElement('link');l.rel='manifest';l.href=location.origin+'/manifest.webmanifest';document.head.appendChild(l)}}
window.addEventListener('beforeinstallprompt',function(e){{e.preventDefault();window.__pmBIP=e}});window.addEventListener('appinstalled',function(){{window.__pmBIP=null;window.__pmInstalled=true}})}})();
</script></head>
<body><div id="pmBoot">Loading PolyMath…</div>
<script>
window.PM_SITE='{SB_URL}/storage/v1/object/public/site/';
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){{}});
fetch(PM_SITE+'version.json?t='+Date.now(),{{cache:'no-store'}}).then(function(r){{return r.json()}}).catch(function(){{return{{v:String(Date.now())}}}}).then(function(v){{
  window.PM_VER=v.v;var a=document.createElement('script');a.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  a.onload=function(){{var s=document.createElement('script');s.src=PM_SITE+'web.js?v='+v.v;document.head.appendChild(s)}};
  a.onerror=function(){{document.getElementById('pmBoot').textContent='PolyMath could not load. Check your internet connection.'}};document.head.appendChild(a)}});
</script></body></html>
''')
w(os.path.join(VERCEL, 'sw.js'), '''// PolyMath service worker: network first, cached copy when offline. Account data and Claude calls are never cached.
const C='pm-v2';
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  const ok=u.origin===location.origin||/\\/storage\\/v1\\/object\\/public\\/site\\//.test(u.pathname)&&!/version\\.json|\\/download\\//.test(u.pathname)||/(^|\\.)(cdnjs\\.cloudflare\\.com|cdn\\.jsdelivr\\.net|fonts\\.googleapis\\.com|fonts\\.gstatic\\.com)$/.test(u.hostname);
  if(!ok)return;
  e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(C).then(x=>x.put(r,c))}return res}).catch(()=>caches.match(r).then(m=>m||Response.error())))});
''')
w(os.path.join(VERCEL, 'vercel.json'), json.dumps({'headers': [
    {'source': '/(index.html|sw.js|)', 'headers': [{'key': 'Cache-Control', 'value': 'no-cache'}]},
    {'source': '/(.*)', 'headers': [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}, {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'}]}]}, indent=1))
print('built version', ver)

if '--upload' in sys.argv:
    if not SB_ANON: sys.exit('set SB_ANON')
    types = {'.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.html': 'text/plain; charset=utf-8', '.json': 'application/json', '.png': 'image/png'}
    for dp, _, fs in os.walk(SITE):
        for f in fs:
            p = os.path.join(dp, f); rel = os.path.relpath(p, SITE).replace(os.sep, '/')
            if rel.startswith('download/') and '--installer' not in sys.argv: continue   # Windows installer parts: only with --installer
            data = open(p, 'rb').read(); ext = os.path.splitext(f)[1]
            req = urllib.request.Request(f'{SB_URL}/storage/v1/object/site/{rel}', data=data, method='POST', headers={
                'apikey': SB_ANON, 'authorization': 'Bearer ' + SB_ANON, 'content-type': types.get(ext, 'application/octet-stream'),
                'x-upsert': 'true', 'cache-control': 'max-age=0' if rel in ('version.json', 'download/win.json') else 'max-age=31536000'})
            try:
                with urllib.request.urlopen(req) as r: print('uploaded', rel, r.status, len(data))
            except urllib.error.HTTPError as e: print('FAILED', rel, e.code, e.read()[:200])
