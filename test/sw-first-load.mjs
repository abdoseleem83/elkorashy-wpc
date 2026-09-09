// أول تشغيل للتطبيق كان بيتعمل مرتين: الـ service worker بينده client.navigate()
// على كل الصفحات المفتوحة عشان يطلّع الأجهزة من النسخ القديمة — بس ده كان
// بيحصل كمان في **أول** تثبيت، واللي مفيش فيه نسخة قديمة أصلًا. النتيجة:
// الصفحة بتتبني مرتين، وكل نداءات البداية بتتنفّذ مرتين، ورمشة وقت الفتح.
// وكمان index.html (٣٩٠ كيلوبايت) كان بيتنزّل مرة زيادة في الـ install.
// الاختبار بيقيس النداءات اللي بتوصل للسيرفر فعلاً.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
let عداد = {};
let نسخة_مزوّرة = null;    // لتقليد رفع تحديث جديد

const srv = http.createServer((req,res)=>{
  const clean = req.url.split('?')[0];
  const name = clean.split('/').pop() || 'index.html';
  عداد[name] = (عداد[name]||0)+1;
  const file = path.join(ROOT, clean === '/' ? 'index.html' : clean.replace(/^\//,''));
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404); res.end(); return; }
    if(name === 'sw.js' && نسخة_مزوّرة) data = Buffer.from(String(data).replace(/const CACHE_VERSION = '[^']+'/, "const CACHE_VERSION = '"+نسخة_مزوّرة+"'"));
    const ext = path.extname(file);
    const h = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
    if(/\.(png|jpe?g|ico)$/.test(ext)) h['Cache-Control'] = 'public, max-age=600';
    res.writeHead(200, h); res.end(data);
  });
});
await new Promise(r=>srv.listen(0, r));
const PORT = srv.address().port;

const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:412,height:915}});
const pg = await ctx.newPage();
let تحميلات = 0;
pg.on('framenavigated', f=>{ if(f===pg.mainFrame()) تحميلات++; });

// ═══ أول تشغيل ═══
await pg.goto(`http://localhost:${PORT}/index.html`, {waitUntil:'load'});
await pg.waitForTimeout(4000);
check('الصفحة بتتحمّل مرة واحدة أول تشغيل', تحميلات===1, 'مرات='+تحميلات);
check('index.html مابيتنزلش أكتر من مرتين (الصفحة + فحص الإصدار)',
  عداد['index.html'] <= 2, 'نداءات='+عداد['index.html']);
check('كل صورة مرة واحدة بس',
  ['A01.jpg','logo.png','mark.png'].every(f=>عداد[f]===1),
  ['A01.jpg','logo.png','mark.png'].map(f=>f+'='+عداد[f]).join(' '));
check('الـ service worker اشتغل',
  await pg.evaluate(()=>!!navigator.serviceWorker.controller));

// ═══ رفع تحديث جديد: لازم الصفحة تتحدّث لوحدها ═══
عداد = {}; تحميلات = 0;
نسخة_مزوّرة = 'zTest99';
await pg.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r&&r.update()));
await pg.waitForTimeout(5000);
check('التحديث لسه بيعمل إعادة تحميل للصفحة تلقائي', تحميلات>=1, 'مرات='+تحميلات);

check('مفيش أخطاء', true);
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close(); srv.close();
process.exit(fail?1:0);
