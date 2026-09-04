// الكيبورد العربي على الموبايل بيكتب أرقام هندية (٠١٢٣٤٥٦٧٨٩) مش لاتينية.
// الموزع بيكتب رقمه ٠١٠١٢٣٤٥٦٧٨ — رقم صح — وكان بيترفض من غير سبب واضح.
// وأخطر: لو اتسجّل كده، السيرفر كان بيمسح الرقم كله فمايلاقيش طلباته أبدًا.
// الاختبار ده بيغطّي الواجهة (متصفح) والباك إند (node لوحده).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

let pass = 0, fail = 0;
const check = (n, ok, x='') => { console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ═══ الباك إند: digitsOnly_ ═══
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const fn = /function digitsOnly_\(v\) \{[\s\S]*?\n\}/.exec(gs)[0];
const digitsOnly_ = new Function('v', fn.replace(/^function digitsOnly_\(v\) \{/, '').replace(/\}$/, ''));

const cases = [
  ['٠١٠١٢٣٤٥٦٧٨',  '01012345678', 'أرقام عربية'],
  ['۰۱۰۱۲۳۴۵۶۷۸',  '01012345678', 'أرقام فارسية'],
  ['01012345678',   '01012345678', 'أرقام لاتينية'],
  ["'01012345678", '01012345678', 'مع فاصلة عليا من الشيت'],
  ['٠١٠1234567٨',  '01012345678', 'مختلط'],
  ['+20 101 234 5678', '201012345678', 'بكود الدولة ومسافات'],
  ['', '', 'فاضي'],
  [null, '', 'null'],
];
console.log('── الباك إند: digitsOnly_ ──');
cases.forEach(([inp, want, label]) => {
  const got = digitsOnly_(inp);
  check(label, got === want, `${JSON.stringify(inp)} → ${JSON.stringify(got)}`);
});

// المطابقة بآخر ٩ أرقام: رقم متسجّل بالعربي لازم يطابق طلب بالاتيني
const stored = digitsOnly_("'٠١٠١٢٣٤٥٦٧٨");
const asked  = digitsOnly_('01012345678');
check('رقم متسجّل بالعربي بيطابق بحث بالاتيني',
  stored.slice(-9) === asked.slice(-9) && stored.slice(-9) !== '',
  `${stored} ↔ ${asked}`);

// ═══ الواجهة ═══
console.log('\n── الواجهة ──');
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(async()=>{
  state.tab='new'; renderNow();
  await new Promise(r=>setTimeout(r,300));
  const el = document.querySelector('[data-act="prof"][data-k="phone"]');
  el.value = '٠١٠١٢٣٤٥٦٧٨';
  el.dispatchEvent(new Event('input', {bubbles:true}));
  await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,60)));
  return {
    عربي: phoneOk('٠١٠١٢٣٤٥٦٧٨'),
    فارسي: phoneOk('۰۱۰۱۲۳۴۵۶۷۸'),
    مختلط: phoneOk('٠١٠1234567٨'),
    لاتيني: phoneOk('01012345678'),
    قصير_مرفوض: !phoneOk('٠١٠١٢٣٤'),
    غلط_مرفوض: !phoneOk('٠٢٠١٢٣٤٥٦٧٨'),
    اتخزّن: state.profile.phone
  };
});
check('رقم بأرقام عربية بيتقبل', r.عربي);
check('رقم بأرقام فارسية بيتقبل', r.فارسي);
check('رقم مختلط بيتقبل', r.مختلط);
check('رقم لاتيني لسه بيتقبل', r.لاتيني);
check('رقم عربي قصير لسه بيترفض', r.قصير_مرفوض);
check('رقم عربي مش موبايل لسه بيترفض', r.غلط_مرفوض);
check('بيتخزّن لاتيني عشان يطابق السيرفر', r.اتخزّن === '01012345678', r.اتخزّن);
check('مفيش أخطاء', errs.length===0, errs.join(' | '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail ? 1 : 0);
