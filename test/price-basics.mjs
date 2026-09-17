// فحص تغطية كشف إن أخطر دالتين في التسعير مش متغطّيتين بأي اختبار:
//   • priceForWidth: لو علامة «<=» بقت «<» الباب ٩٠ سم بياخد سعر الـ١٠٠
//     (٦٠٠ ج زيادة على كل باب) — وماكانش فيه اختبار بيسقط.
//   • rodPrice: لو القسمة على ١٠٠ اتشالت، سعر العود بيتضرب ×١٠٠ — وبرضه
//     ماكانش فيه اختبار بيسقط (الاختبار القديم كان بيحسب المتوقّع بنفس
//     الدالة، يعني بيقارن الحاجة بنفسها).
// الأرقام هنا مربوطة بمعنى الوحدة (سعر المتر × الطول بالسم)، مش بجدول
// الأسعار — فلو المصنع غيّر سعر مقاس الاختبار مايسقطش.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  const sizes = SIZES.map(s=>({w:s.w, price:s.price}));
  const آخر = sizes[sizes.length-1];
  return {
    sizes,
    مطابق: sizes.map(s=>priceForWidth(s.w, false)),
    // مقاس بين اتنين: لازم ياخد سعر المقاس **الأكبر منه** (بنقرّب لفوق)
    بينهم: sizes.slice(1).map(s=>({ w:s.w-1, سعر:priceForWidth(s.w-1,false), متوقع:s.price })),
    أكبر_من_الكل: { سعر:priceForWidth(آخر.w+30,false), متوقع:آخر.price },
    حفر: sizes.map(s=>priceForWidth(s.w,true) - priceForWidth(s.w,false)),
    HAFR: HAFR_EXTRA,
    عود: { متر100_طول220: rodPrice(100,220), متر50_طول110: rodPrice(50,110),
           متر_طول100: rodPrice(77.5,100), افتراضي: rodPrice(100,0), كسري: rodPrice(100,180.5) },
    خدمات: { قص: servicePrice_('CUT'), تدعيم: servicePrice_('WOOD'),
             ثوابت: {CUSTOM_EXTRA, WOOD_EXTRA} },
    فلوس: [money(1234.567), money(1234.5), money(0.005), money(5400)]
  };
});

check('كل مقاس بياخد سعره هو بالظبط',
  r.sizes.every((s,i)=>r.مطابق[i]===s.price), JSON.stringify(r.مطابق));
check('المقاس اللي بين اتنين بياخد سعر الأكبر (تقريب لفوق)',
  r.بينهم.every(x=>x.سعر===x.متوقع), JSON.stringify(r.بينهم));
check('وأكبر من كل المقاسات بياخد سعر آخر مقاس',
  r.أكبر_من_الكل.سعر === r.أكبر_من_الكل.متوقع, JSON.stringify(r.أكبر_من_الكل));
check('فرق الحفر ثابت على كل المقاسات',
  r.حفر.every(d=>d===r.HAFR) && r.HAFR>0, JSON.stringify(r.حفر)+' — '+r.HAFR);

check('سعر العود = سعر المتر × الطول بالمتر (١٠٠ج/م × ٢٢٠سم = ٢٢٠)',
  r.عود.متر100_طول220 === 220, String(r.عود.متر100_طول220));
check('و٥٠ج/م × ١١٠سم = ٥٥', r.عود.متر50_طول110 === 55, String(r.عود.متر50_طول110));
check('وطول متر = سعر المتر زي ما هو', r.عود.متر_طول100 === 77.5, String(r.عود.متر_طول100));
check('وطول فاضي بياخد الافتراضي ٢٢٠ سم', r.عود.افتراضي === 220, String(r.عود.افتراضي));
check('والطول الكسري بيتحسب بكسره (١٨٠.٥ سم)', r.عود.كسري === 180.5, String(r.عود.كسري));

check('سعر خدمة القص = الثابت المتسجّل', r.خدمات.قص === r.خدمات.ثوابت.CUSTOM_EXTRA,
  JSON.stringify(r.خدمات));
check('وسعر التدعيم كمان', r.خدمات.تدعيم === r.خدمات.ثوابت.WOOD_EXTRA, JSON.stringify(r.خدمات));

check('عرض الفلوس بيقرّب لقرشين', r.فلوس[0]==='1,234.57' && r.فلوس[1]==='1,234.5',
  JSON.stringify(r.فلوس));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
