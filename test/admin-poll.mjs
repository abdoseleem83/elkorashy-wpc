// الفحص الخلفي لشاشة المصنع. كل نداء بيقرا شيت الطلبات كله — وده أبطأ حاجة في
// التطبيق. مستمع "رجوع التطبيق قدام" كان بيتسجّل جوّه startAdminPolling، والخروج
// بيوقّف المؤقّت بس مابيشيلش المستمع — فكل دخول جديد كان بيضيف واحد كمان.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// دخول وخروج ٤ مرات، وبعدين نرجّع التطبيق قدام مرة واحدة
const r = await pg.evaluate(async()=>{
  state.admin.pw='x'; state.admin.open=true;
  let calls=0;
  window.jsonp = ()=>{ calls++; return Promise.resolve({ok:true, orders:[]}); };
  const logout = ()=>{ const btn=document.createElement('button');
    btn.dataset.act='adm-logout'; document.body.appendChild(btn); btn.click(); btn.remove(); };
  for(let i=0;i<4;i++){ state.admin.pw='x'; startAdminPolling(); logout(); }
  state.admin.pw='x'; startAdminPolling();
  // بنعدّ مرات دخول adminPoll نفسها، مش النداءات اللي بتوصل السيرفر — القفل
  // اللي جوّه بيبلع الزيادة، فعدّ النداءات لوحده كان هيخفي التسريب.
  const real = window.adminPoll; let entered = 0;
  window.adminPoll = function(){ entered++; return real.apply(this, arguments); };
  document.dispatchEvent(new Event('visibilitychange'));   // التطبيق رجع قدام
  await new Promise(r=>setTimeout(r,300));
  window.adminPoll = real;
  return { دخلت: entered };
});
check('رجوع التطبيق قدام = مستمع واحد مش واحد لكل دخول',
  r.دخلت===1, r.دخلت + ' مستمع');

// بعد الخروج نهائيًا، رجوع التطبيق قدام مايعملش فحص خالص
const r2 = await pg.evaluate(async()=>{
  let calls=0; window.jsonp = ()=>{ calls++; return Promise.resolve({ok:true, orders:[]}); };
  const btn=document.createElement('button');
  btn.dataset.act='adm-logout'; document.body.appendChild(btn); btn.click(); btn.remove();
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r=>setTimeout(r,300));
  return calls;
});
check('بعد الخروج مفيش فحص خلفي خالص', r2===0, String(r2));

// نداءين في نفس اللحظة = قراية واحدة للشيت
const r3 = await pg.evaluate(async()=>{
  state.admin.pw='x';
  let calls=0;
  window.jsonp = ()=>{ calls++; return new Promise(res=>setTimeout(()=>res({ok:true, orders:[]}), 150)); };
  adminPoll(); adminPoll(); adminPoll();
  await new Promise(r=>setTimeout(r,500));
  return calls;
});
check('تلات نداءات مع بعض = قراية واحدة للشيت', r3===1, String(r3));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
