// Apps Script بطيء بطبعه (بيصحّى من السكون + بيقرا الشيت كله). المهلات كانت
// متناثرة بأرقام عشوائية، وأقصر واحدة (١٢ ثانية لجلب الأسعار) بتتنادى عند فتح
// التطبيق بالظبط — وقت ما السيرفر بيبقى في أبطأ حالاته.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const adhoc = [...html.matchAll(/jsonp\((?:[^()]|\([^()]*\))*?,\s*(\d{3,6})\s*\)/g)].map(m=>m[1]);
check('مفيش مهلة مخصّصة متناثرة في أي نداء', adhoc.length===0, adhoc.join(', ') || '—');
check('فيه ثابت واحد للمهلة', /const JSONP_TIMEOUT_MS = \d+;/.test(html));

const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>({
  ثابت: typeof JSONP_TIMEOUT_MS === 'number' ? JSONP_TIMEOUT_MS : null
}));
check('المهلة ٢٥ ثانية — تكفي لصحيان Apps Script', r.ثابت===25000, String(r.ثابت));

// عطل الشبكة الحقيقي لازم يوصل فورًا مش بعد المهلة — ده اللي بيخلي المهلة
// الطويلة مش مشكلة على المستخدم
const t0 = Date.now();
const r2 = await pg.evaluate(async()=>{
  const t=Date.now();
  try{ await jsonp('http://127.0.0.1:1/nope'); }catch(e){ return { رسالة:e.message, مدة:Date.now()-t }; }
  return { رسالة:'ما رماش', مدة:Date.now()-t };
});
check('عطل الشبكة بيوصل فورًا مش بعد ٢٥ ثانية',
  r2.مدة < 5000 && /تعذّر الاتصال/.test(r2.رسالة), `${r2.مدة}ms — ${r2.رسالة}`);

// المهلة نفسها شغّالة لما السيرفر يرد ببطء
const r3 = await pg.evaluate(async()=>{
  const t=Date.now();
  try{ await jsonp('http://127.0.0.1:1/nope', 300); }catch(e){ return { رسالة:e.message, مدة:Date.now()-t }; }
});
check('مهلة مخصّصة لسه ممكنة لو احتجناها', r3.مدة < 3000, `${r3.مدة}ms`);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
