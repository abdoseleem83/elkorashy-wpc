// تعديل الطلب بيعمل طلب جديد وبيلغي القديم — بس الإلغاء مابيتنفّذش غير لما
// الجديد يتأكد وصوله. طيب لو الموزّع عدّل الطلب **مرتين** والنت واقع؟
//   أ → ب (ب لسه ما وصلش، والنية: ألغي أ لما ب يوصل)
//   ب → ج (ب اتشال من الجهاز خالص لأنه اتبدل)
// ب عمره ما هيوصل، يعني نية إلغاء «أ» عمرها ما هتتنفّذ — والمصنع يفضل شايف
// الطلب الأصلي أ + الطلب الجديد ج. طلب مكرر عند المصنع.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  localStorage.removeItem('wpc_pending_cancel');
  // أ → ب: ب ما وصلش، فالنية اتسجّلت
  savePendingCancel_({ prevId:'A', phone:'01', newId:'B', admin:false });
  const بعد_الأول = loadPendingCancels_().map(c=>c.prevId+'→'+c.newId);

  // ب → ج: الطلب ب بيتشال من الجهاز وبيتعمل مكانه ج
  transferPendingCancel_ && transferPendingCancel_('B','C');
  const بعد_التاني = loadPendingCancels_().map(c=>c.prevId+'→'+c.newId);

  return { بعد_الأول, بعد_التاني };
});
check('نية إلغاء «أ» اتسجّلت لما ب اتأخر', r.بعد_الأول.join(',')==='A→B', r.بعد_الأول.join(','));
check('لما ب اتبدل بـ ج، النية اتنقلت لـ ج مش ضاعت',
  r.بعد_التاني.join(',')==='A→C', r.بعد_التاني.join(','));

// وبعد ما ج يوصل فعلاً، الإلغاء بيتنفّذ على أ (مش على ب اللي عمره ما وصل)
const نُفّذ = await pg.evaluate(async ()=>{
  const نداءات = [];
  window.jsonp = async (url)=>{ نداءات.push(url); return { ok:true }; };
  await runPendingCancelFor_('C');
  return { نداءات, باقي: loadPendingCancels_().length };
});
check('الإلغاء اتنفّذ على الطلب الأصلي أ',
  نُفّذ.نداءات.some(u=>/action=cancelOrder/.test(u) && /id=A(&|$)/.test(u)),
  نُفّذ.نداءات.join(' | ').slice(0,160));
check('والنية اتشالت بعد ما اتنفّذت', نُفّذ.باقي===0, String(نُفّذ.باقي));


// طلبين قديمين مستنيين نفس الطلب الجديد (تعديل ورا تعديل والنت واقع):
// أ→ج (منقولة) و ب→ج (المباشرة). لازم الاتنين يتنفّذوا.
const اتنين = await pg.evaluate(async ()=>{
  localStorage.removeItem('wpc_pending_cancel');
  savePendingCancel_({ prevId:'A', phone:'01', newId:'B' });
  transferPendingCancel_('B','C');
  savePendingCancel_({ prevId:'B', phone:'01', newId:'C' });
  const قبل = loadPendingCancels_().map(c=>c.prevId+'→'+c.newId);
  const نداءات = [];
  window.jsonp = async (url)=>{ نداءات.push(url); return { ok:true }; };
  await runPendingCancelFor_('C');
  return { قبل, ألغى: نداءات.filter(u=>/action=cancelOrder/.test(u))
             .map(u=>(/[?&]id=([^&]+)/.exec(u)||[])[1]),
           باقي: loadPendingCancels_().length };
});
check('النيتين الاتنين اتسجّلوا من غير ما واحدة تمسح التانية',
  اتنين.قبل.join(',')==='A→C,B→C', اتنين.قبل.join(','));
check('الاتنين اتلغوا لما ج وصل',
  اتنين.ألغى.join(',')==='A,B', اتنين.ألغى.join(','));
check('والقايمة فضيت', اتنين.باقي===0, String(اتنين.باقي));

// اللي فشل بس هو اللي بيفضل في القايمة عشان يتحاول تاني
const فشل = await pg.evaluate(async ()=>{
  localStorage.removeItem('wpc_pending_cancel');
  savePendingCancel_({ prevId:'A', phone:'01', newId:'C' });
  savePendingCancel_({ prevId:'B', phone:'01', newId:'C' });
  window.jsonp = async (url)=>{
    if(/[?&]id=A(&|$)/.test(url)) throw new Error('النت اتقطع');
    return { ok:true };
  };
  await runPendingCancelFor_('C');
  return loadPendingCancels_().map(c=>c.prevId+'→'+c.newId);
});
check('اللي فشل بس بيفضل مستني محاولة تانية', فشل.join(',')==='A→C', فشل.join(','));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
