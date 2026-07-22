// Service worker — تطبيق أبواب WPC
// ⚠️ لما تعدّل أي ملف، غيّر رقم CACHE_VERSION تحت عشان المتصفح ياخد النسخة الجديدة
// بدل ما يفضل شغال على القديمة المخزّنة.
const CACHE_VERSION = 'v4';
const CACHE_NAME = 'elkorashy-wpc-' + CACHE_VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './images/logo.jpg',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/A01.jpg', './images/A02.jpg', './images/A03.jpg', './images/A04.jpg',
  './images/A05.jpg', './images/A06.jpg', './images/A07.jpg', './images/A08.jpg',
  './images/A09.jpg', './images/A10.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('elkorashy-wpc-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // الصور والأيقونات: من الكاش الأول (أسرع وبتشتغل أوفلاين)
  if (/\.(jpg|jpeg|png|webp|svg)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // باقي الملفات: من الشبكة الأول عشان التحديثات توصل، والكاش احتياطي
  e.respondWith(
    fetch(req).then(res => {
      caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
