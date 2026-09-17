// الـservice worker فيه مسار احتياطي بيرجّع رد ٥٠٤ لما مفيش نت ومفيش نسخة
// متخزّنة. المسار ده عمره ما اشتغل: الكود كان `cached || network || 504`
// وnetwork وعد (Promise) — يعني دايمًا "صح" — فالرد الاحتياطي ما بيتنفّذش،
// والـSW بيرجّع null والمتصفح يرمي خطأ شبكة.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain'};
const srv = http.createServer((req,res)=>{
  const clean = req.url.split('?')[0];
  const file = path.join(ROOT, clean === '/' ? 'index.html' : clean.replace(/^\//,''));
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404, {'Content-Type':'text/plain'}); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r=>srv.listen(0,r));
const PORT = srv.address().port;
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:412,height:915}});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(`http://localhost:${PORT}/index.html`, {waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>navigator.serviceWorker && navigator.serviceWorker.controller, null, {timeout:15000})
  .catch(()=>{});
check('الـservice worker مسيطر على الصفحة',
  await pg.evaluate(()=>!!(navigator.serviceWorker && navigator.serviceWorker.controller)));

// اقطع النت فعليًا: بنقفل السيرفر نفسه، لأن وضع «أوفلاين» في المتصفح
// مابيأثرش على نداءات الـservice worker
await ctx.setOffline(true);
await new Promise(r=>srv.close(r));
const ردود = await pg.evaluate(async ()=>{
  const out = {};
  const جرّب = async (u)=>{
    try{ const r = await fetch(u, {cache:'no-store'}); return {status:r.status}; }
    catch(e){ return {error:String(e.message||e)}; }
  };
  out.ملف_غير_متخزّن = await جرّب('./لا-يوجد-' + Date.now() + '.txt');
  out.الصفحة        = await جرّب('./index.html');
  return out;
});
check('الملف اللي مش متخزّن بيرجع ٥٠٤ بدل خطأ شبكة',
  ردود.ملف_غير_متخزّن.status === 504, JSON.stringify(ردود.ملف_غير_متخزّن));
check('والصفحة نفسها لسه بتيجي من الكاش وانت أوفلاين',
  ردود.الصفحة.status === 200, JSON.stringify(ردود.الصفحة));

// والمانيفست المتخزّن لسه بيرجع وانت أوفلاين
const مانيفست = await pg.evaluate(async ()=>{
  try{ const r = await fetch('./manifest.json'); return r.status; }
  catch(e){ return String(e.message||e); }
});
check('المانيفست المتخزّن لسه بيرجع أوفلاين', مانيفست === 200, String(مانيفست));
check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));

await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
