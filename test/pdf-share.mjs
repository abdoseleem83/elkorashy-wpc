// كل التقارير والمستندات لازم تعدّي على شاشة المشاركة على الموبايل (واتساب/درايف)
// وترجع لتنزيل عادي على الكمبيوتر. كانت خيار اختياري (share:true) واتنين من
// أربع نداءات نسيوه — منهم مستند الطلب وعرض السعر، أهم ورقتين بيبعتهم المصنع.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ═══ كل نداءات الـPDF متسقة ═══
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// `await canvasToPdf_(...)` بس — مش تعريف الدالة نفسه
const calls = [...html.matchAll(/await canvasToPdf_\(canvas[^;]*\)/g)].map(m=>m[0]);
check('فيه أربع نداءات PDF زي ما متوقع', calls.length===4, String(calls.length));
check('مفيش نداء بيطلب تنزيل مباشر (share:false)',
  !calls.some(c=>/share\s*:\s*false/.test(c)), calls.filter(c=>/share/.test(c)).join(' | ') || '—');
check('المشاركة بقت الافتراضي مش خيار',
  /if\(opts\.share !== false\)/.test(html));

const b = await chromium.launch();
const ctx = await b.newContext({acceptDownloads:true});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ على الموبايل: شاشة المشاركة ═══
const r1 = await pg.evaluate(async()=>{
  const seen = {};
  navigator.canShare = () => true;
  navigator.share = (d) => { seen.files = (d.files||[]).map(f=>f.name); seen.title = d.title; return Promise.resolve(); };
  const ok = await shareOrDownload_(new Blob(['x']), 'طلب_1.pdf', 'طلب أوردر');
  delete navigator.share; delete navigator.canShare;
  return { ok, seen };
});
check('لما الجهاز يدعم المشاركة: بتتفتح شاشة المشاركة مش تنزيل',
  r1.ok === true && r1.seen.files[0]==='طلب_1.pdf', JSON.stringify(r1.seen));

// ═══ العميل قفل شاشة المشاركة: مش خطأ ومفيش تنزيل ═══
const r2 = await pg.evaluate(async()=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  navigator.canShare = () => true;
  navigator.share = () => { const e=new Error('cancel'); e.name='AbortError'; return Promise.reject(e); };
  const ok = await shareOrDownload_(new Blob(['x']), 'طلب_2.pdf', 'ط');
  delete navigator.share; delete navigator.canShare;
  window.toast=old;
  return { ok, msgs };
});
check('العميل قفل شاشة المشاركة: مابيتحسبش خطأ',
  r2.ok === true && r2.msgs.length===0, JSON.stringify(r2));

// ═══ على الكمبيوتر: تنزيل عادي ═══
// اسم لاتيني عشان نتأكد إن الاسم نفسه بيوصل — كروم بيبدّل الأسماء العربية
const dl = pg.waitForEvent('download',{timeout:8000});
const r3 = await pg.evaluate(()=>{
  const msgs=[]; window.toast=m=>msgs.push(m);
  return shareOrDownload_(new Blob(['x']), 'report.pdf', 'تقرير').then(ok=>({ok, msgs}));
});
const d = await dl;
check('على الكمبيوتر: بينزّل عادي بنفس الاسم', d.suggestedFilename()==='report.pdf', d.suggestedFilename());
check('وبيقول للمستخدم إن الملف اتحمّل', r3.ok===false && /اتحمّل/.test(String(r3.msgs[0])), JSON.stringify(r3.msgs));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
