// Service worker — ELKORASHI DOORS / WPC
// ⚠️ غيّر CACHE_VERSION مع كل تعديل عشان المتصفح ياخد النسخة الجديدة
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'elkorashy-wpc-' + CACHE_VERSION;

const CORE = [
  './','./index.html','./manifest.json',
  './images/logo.png','./images/mark.png',
  './images/icon-192.png','./images/icon-512.png',
  './images/A01.jpg','./images/A02.jpg','./images/A03.jpg','./images/A04.jpg','./images/A05.jpg',
  './images/A06.jpg','./images/A07.jpg','./images/A08.jpg','./images/A09.jpg','./images/A10.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.allSettled(CORE.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('elkorashy-wpc-') && k !== CACHE_NAME).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // مكتبات الـ CDN (PDF / إكسيل): من الكاش لو اتحمّلت قبل كده
  if (url.origin !== self.location.origin) {
    if (/cdnjs|fonts\.(googleapis|gstatic)/.test(url.hostname)) {
      e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
          return res;
        }).catch(() => hit))
      );
    }
    return;
  }

  if (/\.(jpg|jpeg|png|webp|svg)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    }).catch(() => hit)));
    return;
  }

  e.respondWith(fetch(req).then(res => {
    caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
