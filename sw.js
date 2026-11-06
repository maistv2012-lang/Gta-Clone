// Versioned, scope-owned cache. A successful HTTP status alone does not prove
// a navigation is the game: preview gateways can return empty placeholder HTML.
const FAMILY = 'christchurch:' + self.registration.scope + ':';
const CACHE = FAMILY + 'render-v4';

async function validShell(response) {
  if (!response || !response.ok || !(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) return false;
  const text = await response.clone().text();
  return text.includes('Grand Theft Christchurch') && /\bid\s*=\s*(?:"start"|'start'|start(?=[\s>]))/.test(text) && /\bid\s*=\s*(?:"playbtn"|'playbtn'|playbtn(?=[\s>]))/.test(text);
}

function recoveryPage() {
  return new Response(`<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Grand Theft Christchurch</title>
<style>html,body{margin:0;min-height:100%;background:#090d13;color:white;font-family:Arial,sans-serif}
#start{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;box-sizing:border-box;background:#090d13}
h1{color:#ffd24a;font-size:28px}p{max-width:32em;line-height:1.5}button{padding:14px 24px;margin:8px;border-radius:8px;font-size:18px}button:disabled{opacity:.5}</style>
</head><body><main id="start"><h1>Grand Theft Christchurch</h1>
<p id="map-status" role="alert">Não foi possível carregar a tela inicial da Prévia.</p>
<p>O servidor não está acessível ou a página armazenada está incompleta. Verifique a conexão e tente novamente.</p>
<button id="playbtn" disabled>▶ PLAY</button><button id="retry-load" onclick="location.reload()">Tentar novamente</button>
</main></body></html>`, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store', 'x-christchurch-recovery': 'invalid-or-unavailable-navigation' } });
}

async function network(request, shell = false) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Preview server timed out')); }, 20000);
      }),
      (async () => {
        const response = await fetch(request, { signal: controller.signal });
        if (shell && !await validShell(response)) throw new Error('Invalid game HTML from preview server');
        return response;
      })(),
    ]);
  } finally { clearTimeout(timer); }
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(['.', 'index.html', 'manifest.json', 'icon.svg'].map(async path => {
      const request = new Request(new URL(path, self.registration.scope));
      try {
        const html = path === '.' || path === 'index.html';
        const response = await network(request, html);
        if (response.ok && (!html || await validShell(response))) await cache.put(request, response);
      } catch { /* A first visit must not depend on successful precaching. */ }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith(FAMILY) && key !== CACHE) || ['christchurch-v1', 'christchurch-startup-v2'].includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const navigation = event.request.mode === 'navigate';
    try {
      const response = await network(event.request, navigation);
      const isMap = new URL(event.request.url).pathname.endsWith('/data/christchurch.json');
      if (response.ok && (!isMap || (response.headers.get('content-type') || '').includes('json'))) {
        event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (navigation) {
        if (await validShell(cached)) return cached;
        // A previously cached index can recover another equivalent entry URL,
        // but never use an empty response or another application's caches.
        const index = await cache.match(new URL('index.html', self.registration.scope));
        if (await validShell(index)) return index;
        console.warn('Christchurch preview navigation recovery:', error.message);
        return recoveryPage();
      }
      return cached || Response.error();
    }
  })());
});
