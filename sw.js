// ⚠️ مهم: غيّر رقم النسخة دي في كل مرة ترفع تحديث جديد.
// ده اللي بيخلي المتصفح يرمي الكاش القديم ويجيب الملفات الجديدة.
const CACHE_VERSION = 'v128';
const CACHE_NAME = 'elkorashy-wpc-' + CACHE_VERSION;
// كاش منفصل للمكتبات الخارجية — مش بيتمسح مع كل تحديث للتطبيق، لأن روابطها فيها
// رقم إصدار ثابت. لو كانت جوه الكاش العادي كانت هتتحمّل من النت من أول وجديد
// مع كل نسخة جديدة نرفعها، وده اللي إحنا عايزين نتفاداه.
const LIB_CACHE = 'elkorashy-libs-v1';

// ⚠️ الأصول اتقسمت لقسمين — ودي كانت مشكلة حقيقية:
// قبل كده كل حاجة (بما فيها 412 كيلوبايت صور وأيقونات) كانت في قايمة واحدة بتتجدّد
// بالكامل مع كل CACHE_VERSION، والكاش القديم بيتمسح في activate. يعني كل تحديث
// بترفعه كان بينزّل الصور كلها من أول وجديد على كل جهاز — وهي أصلاً عمرها ما بتتغيّر.
//
// دلوقتي:
//  • APP_SHELL  → في الكاش المرقّم، بيتجدّد مع كل نسخة (صغير: HTML + manifest)
//  • STATIC     → في كاش دايم، بيتنزّل أول مرة بس، ومابيتمسحش مع التحديثات
// لو غيّرت صورة فعلاً، زوّد ASSET_VERSION تحت عشان تتجدّد.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json'
];

const ASSET_VERSION = 'a1';
const ASSET_CACHE   = 'elkorashy-assets-' + ASSET_VERSION;
const STATIC = [
  './icon-192.png',
  './icon-512.png',
  './img/logo.png',
  './img/mark.png',
  './img/doors/A01.jpg',
  './img/doors/A02.jpg',
  './img/doors/A03.jpg',
  './img/doors/A04.jpg',
  './img/doors/A05.jpg',
  './img/doors/A06.jpg',
  './img/doors/A07.jpg',
  './img/doors/A08.jpg',
  './img/doors/A09.jpg',
  './img/doors/A010.jpg',
  './img/doors/A015.jpg'
];

self.addEventListener('install', (event) => {
  // 🔑 دي أهم سطر في الملف: النسخة الجديدة بتفرض نفسها فورًا من غير ما تستنى
  // إذن من الصفحة ولا تستنى التابات تتقفل. ده اللي بيخرّج الأجهزة العالقة على
  // نسخة قديمة من غير ما المستخدم يعمل أي حاجة.
  self.skipWaiting();
  event.waitUntil((async () => {
    // ١) قشرة التطبيق — بتتجدّد إجباريًا مع كل نسخة
    const shell = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(u =>
      fetch(u, { cache: 'no-store' })
        .then(r => (r && r.ok) ? shell.put(u, r) : null)
        .catch(() => null)
    ));

    // ٢) الصور والأيقونات — بننزّل الناقص بس. اللي متخزّن خلاص بيتساب زي ما هو،
    //    فالتحديث العادي مابينزّلش ولا بايت صور.
    const assets = await caches.open(ASSET_CACHE);
    await Promise.all(STATIC.map(async u => {
      if (await assets.match(u)) return;             // موجود خلاص
      try {
        const r = await fetch(u);
        if (r && r.ok) await assets.put(u, r);
      } catch (e) {}
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // امسح كل الكاشات القديمة بتاعة النسخ السابقة
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('elkorashy-') && k !== CACHE_NAME && k !== LIB_CACHE && k !== ASSET_CACHE)
          .map(k => caches.delete(k))
    );
    // خد السيطرة على كل الصفحات المفتوحة فورًا من غير ما تستنى إعادة فتح
    await self.clients.claim();

    // اقفل/حدّث كل الصفحات المفتوحة عشان تشتغل بالكود الجديد على طول.
    // النسخ القديمة من index.html مش بتعرف تعمل reload لوحدها، فبنعملهولها احنا.
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      if ('navigate' in client) client.navigate(client.url).catch(() => {});
    });
  })());
});

// الصفحة بتبعتلنا الرسالة دي أول ما تلاقي نسخة جديدة مستنية،
// فبنشتغل على طول بدل ما نفضل في حالة waiting لأجل غير مسمى.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // مانتدخلش خالص في نداءات Apps Script — لازم تروح للنت دايمًا
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleusercontent.com')) {
    return;
  }

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // ✅ Network-first للـ HTML: ده اللي يضمن إن أي تحديث بترفعه يوصل للناس فورًا
    // (بدل ما الكاش يرجّع نسخة index.html قديمة).
    event.respondWith((async () => {
      try {
        // 🔑 طبقتين لازم نتخطاهم مع بعض عشان التحديث يوصل:
        //  ١) كاش المتصفح المحلي  → بنتخطاه بـ cache:'no-store'
        //  ٢) كاش CDN بتاع GitHub Pages (Fastly) → ده مابيتأثرش بـ no-store لأنه
        //     بره الجهاز أصلًا، وبيفضل يرجّع النسخة القديمة لحد ما مدته تخلص.
        //     الحل الوحيد المضمون: نضيف باراميتر فريد للرابط، فيبقى "رابط جديد"
        //     مالوش نسخة مخزّنة عند الـ CDN فيجيبه من السيرفر مباشرة.
        const bust = url.pathname + '?_v=' + Date.now();
        let fresh;
        try {
          fresh = await fetch(bust, { cache: 'no-store' });
          if (!fresh || !fresh.ok) throw new Error('bad');
        } catch (e1) {
          fresh = await fetch(req, { cache: 'no-store' });   // احتياطي
        }
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        // مفيش نت → رجّع آخر نسخة متخزنة عشان التطبيق يفضل شغال أوفلاين
        const cached = await caches.match(req);
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }

  // مكتبات الـ CDN (html2canvas / jsPDF / ExcelJS): الرابط فيه رقم الإصدار فمحتواه ثابت
  // للأبد — فالأفضل cache-first: أول تحميل بس من النت وبعدها فورية أوفلاين.
  // ⚠️ كان فيه باج هنا: الرد بتاع الـ CDN بيجي "opaque" وحالته 0 مش 200، فالشرط القديم
  // (status === 200) كان بيرفض يخزّنه — يعني المكتبات ماكانتش بتتكاش أصلًا وكانت
  // بتتحمّل من النت كل مرة. الشرط الجديد بيقبل الردود الـ opaque كمان.
  const cacheable = res => res && (res.ok || res.type === 'opaque');

  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith((async () => {
      const c = await caches.open(LIB_CACHE);
      const cached = await c.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (cacheable(res)) c.put(req, res.clone()).catch(() => {});
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // الصور والأيقونات: cache-first من الكاش الدايم. محتواها ثابت، فمافيش داعي نسأل
  // الشبكة عنها كل مرة — وده كمان بيخلي التطبيق يفتح أوفلاين بصوره كاملة.
  if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const assets = await caches.open(ASSET_CACHE);
      const hit = await assets.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (cacheable(res)) assets.put(req, res.clone()).catch(() => {});
        return res;
      } catch (e) {
        const any = await caches.match(req, { ignoreSearch: true });   // كاش قديم من نسخة سابقة
        return any || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // أي حاجة تانية: stale-while-revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if (cacheable(res)) {
        caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);
    return cached || network || new Response('', { status: 504 });
  })());
});
