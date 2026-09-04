// مصر UTC+2/+3. toISOString() بتدّي التوقيت العالمي، فأي شغل بعد نص الليل
// (١٢ لـ ٢ أو ٣ الفجر) كان بيتسجّل بتاريخ اليوم اللي فات.
// أخطر نتيجة: تعديل الطلب في الوقت ده كان بيرجّع تاريخ الطلب نفسه يوم لورا،
// وكل تعديل تاني يرجّعه يوم كمان.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const b = await chromium.launch();
// ١ الفجر بتوقيت القاهرة يوم ٥ سبتمبر = ٢٢:٠٠ بالتوقيت العالمي يوم ٤ سبتمبر
const ctx = await b.newContext({viewport:{width:412,height:915}, timezoneId:'Africa/Cairo'});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  const at = new Date('2026-09-04T22:00:00Z').getTime();   // ٥ سبتمبر ١:٠٠ في القاهرة
  return {
    التاريخ_المحلي: isoLocal_(at),
    التاريخ_العالمي: new Date(at).toISOString().slice(0,10),
    النهاردة_شكلها_صح: /^\d{4}-\d{2}-\d{2}$/.test(isoLocal_()),
    وقت_بايظ: isoLocal_('xxx'),
    الظهر_عادي: isoLocal_(new Date('2026-09-04T09:00:00Z').getTime())
  };
});
check('طلب الساعة ١ الفجر بياخد تاريخ يومه مش اللي فات', r.التاريخ_المحلي==='2026-09-05',
  `محلي ${r.التاريخ_المحلي} · عالمي ${r.التاريخ_العالمي}`);
check('الفرق ده كان بيحصل فعلاً', r.التاريخ_العالمي==='2026-09-04');
check('تاريخ النهاردة شكله صح', r.النهاردة_شكلها_صح, r.النهاردة_شكلها_صح?'':'—');
check('وقت بايظ بيرجّع فاضي مش Invalid Date', r.وقت_بايظ==='', JSON.stringify(r.وقت_بايظ));
check('نص النهار زي ما هو', r.الظهر_عادي==='2026-09-04', r.الظهر_عادي);

// التعديل: تاريخ الطلب مالوش يرجع لورا
const r2 = await pg.evaluate(()=>{
  const ts = new Date('2026-09-04T22:00:00Z').getTime();
  const d1 = isoLocal_(ts);                                  // التعديل الأول
  const ts2 = new Date(d1 + 'T12:00:00').getTime();          // زي ما draftOrder بيعمل
  const d2 = isoLocal_(ts2);                                 // التعديل التاني
  return {d1, d2};
});
check('تعديل ورا تعديل ما بيرجّعش التاريخ لورا', r2.d1===r2.d2, `${r2.d1} → ${r2.d2}`);
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
