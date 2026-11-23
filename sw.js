/* App assets only. Orders, accounts, artwork and server requests never enter this cache. */
const SHELL_CACHE='wpc-shell-v283';
const RES_CACHE='wpc-resources-v283';
const CORE=['./index.html','./offline.html','./manifest.json','./img/logo.png','./img/mark.png','./html2canvas.js','./jspdf.js','./exceljs.js',...['A01','A02','A03','A04','A05','A06','A07','A08','A09','A010','A013'].map(c=>'./img/doors/'+c+'.jpg')];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);await c.addAll(CORE);})());});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const r=event.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin)return;
if(r.mode==='navigate'){event.respondWith((async()=>{const c=await caches.open(SHELL_CACHE);
  // النسخة المحفوظة بتتعرض فورًا — الفتح مبقاش مستني النت ولا باقة المستخدم،
  // ولو فيه نت بنحدّث النسخة المحفوظة في الخلفية للفتحة اللي بعدها.
  const cached=await c.match('./index.html');
  const net=(async()=>{try{const n=await fetch(r);if(n.ok&&n.headers.get('content-type')?.includes('text/html'))await c.put('./index.html',n.clone());return n;}catch(e){return null;}})();
  if(cached){event.waitUntil(net);return cached;}
  const n=await net;return n||await c.match('./offline.html');})());return;}
if(!/\/img\//.test(u.pathname)&&!/(?:html2canvas|jspdf|exceljs)\.js$/.test(u.pathname)&&!/(?:manifest\.json|icon-\d+\.png)$/.test(u.pathname))return;
event.respondWith((async()=>{const core=await caches.open(SHELL_CACHE),res=await caches.open(RES_CACHE),hit=await core.match(r,{ignoreSearch:true})||await res.match(r,{ignoreSearch:true});if(hit)return hit;const n=await fetch(r);if(n.ok)await res.put(r,n.clone());return n;})());});
