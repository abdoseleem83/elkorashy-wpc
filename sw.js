/* App assets only. Orders, accounts, artwork and server requests never enter this cache. */
const SHELL_CACHE='wpc-shell-v377';
const RES_CACHE='wpc-resources-v377';
const CORE=['./index.html','./offline.html','./manifest.json','./img/logo.png','./img/mark.png','./html2canvas.js','./jspdf.js','./exceljs.js','./data-images.js',...['A01','A02','A03','A04','A05','A06','A07','A08','A09','A010','A013'].map(c=>'./img/doors/'+c+'.jpg')];
// no-cache: بدونه ممكن التثبيت يلتقط index قديم من كاش HTTP فيختلط القديم بالجديد (اتلاحظ في اختبار الترحيل v286→v287)
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);await c.addAll(CORE.map(u=>new Request(u,{cache:'no-cache'})));})());});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keep=new Set([SHELL_CACHE,RES_CACHE]);const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith('wpc-shell-')||k.startsWith('wpc-resources-'))&&!keep.has(k)).map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const r=event.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin)return;
if(r.mode==='navigate'){event.respondWith((async()=>{const c=await caches.open(SHELL_CACHE);
  // v287: طلب المستخدم — قفل وفتح يجيب آخر نسخة على طول. بنجرب الشبكة الأول بسقف
  // 1.5 ثانية؛ لو النت فصل أو بطيء بنرجع للنسخة المحفوظة فورًا ونحدّثها في الخلفية.
  const cached=await c.match('./index.html');
  const keep=n=>{if(n.ok&&n.headers.get('content-type')?.includes('text/html'))c.put('./index.html',n.clone());};
  try{
    const n=await Promise.race([fetch(r),new Promise((_,rj)=>setTimeout(()=>rj(new Error('slow-net')),1500))]);
    if(n&&n.ok&&n.headers.get('content-type')?.includes('text/html')){keep(n);return n;}
  }catch(e){}
  if(cached){const bg=fetch(r).then(keep).catch(()=>{});event.waitUntil(bg);return cached;}
  return await c.match('./offline.html');})());return;}
if(!/\/img\//.test(u.pathname)&&!/(?:html2canvas|jspdf|exceljs|data-images)\.js$/.test(u.pathname)&&!/(?:manifest\.json|icon-\d+\.png)$/.test(u.pathname))return;
event.respondWith((async()=>{const core=await caches.open(SHELL_CACHE),res=await caches.open(RES_CACHE),hit=await core.match(r,{ignoreSearch:true})||await res.match(r,{ignoreSearch:true});if(hit)return hit;const n=await fetch(r);if(n.ok)await res.put(r,n.clone());return n;})());});
