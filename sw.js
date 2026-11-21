importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "pwabuilder-page";

const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// فتح التطبيق بقى فوري: بنعرض آخر نسخة محفوظة من الصفحة على طول، وفي نفس
// الوقت بنجيب أحدث نسخة من الشبكة ونخزّنها للفتحة الجاية. لو فيه إصدار جديد
// فحص الإصدار جوّه التطبيق بيظهر تنبيه التحديث، وزرار «تحديث» بيمسح الكاش
// وبيحمّل أحدث نسخة (doUpdate) — فمافيش نسخة قديمة ممكن تعلّق.
const PAGE_CACHE = "wpc-pages-v1";
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const pageCache = await caches.open(PAGE_CACHE);
      const cachedResp = await pageCache.match(event.request, { ignoreSearch: true });
      const networkPromise = (async () => {
        try {
          const preloadResp = await event.preloadResponse;
          const networkResp = preloadResp || await fetch(event.request);
          if (networkResp && networkResp.ok) pageCache.put(event.request, networkResp.clone());
          return networkResp;
        } catch (error) {
          return null;
        }
      })();
      if (cachedResp) {
        networkPromise.catch(() => {});
        return cachedResp;
      }
      const fresh = await networkPromise;
      if (fresh) return fresh;
      const cache = await caches.open(CACHE);
      return cache.match(offlineFallbackPage);
    })());
  }
});
