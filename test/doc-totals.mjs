// مربّع الإجماليات في المستند — ده اللي المصنع بيقرا منه أرقام القطع اللي
// هيقطّعها. المشكلة: طقم الحلق بيتعدّ كقطعة واحدة وهو فعليًا ٣ عيدان.
// مابنغيّرش الحساب (المصنع اتعوّد عليه) — بنوضّح الطقم كام عود صراحة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const txt = (items) => pg.evaluate((items)=>{
  const el = document.createElement('div');
  el.innerHTML = docTotalsHTML({items});
  return el.textContent.replace(/\s+/g,' ').trim();
}, items);

const باب = (w,qty,produced=0)=>({kind:'door', sizeTxt:w+' سم', w, qty, produced});

// ١) أبواب بس
const t1 = await txt([باب(70,5), باب(80,3)]);
check('إجمالي الأبواب صح', /إجمالي الأبواب\s*8 باب/.test(t1), t1);
check('الإجمالي الكلي صح', /الإجمالي الكلي\s*8 قطعة/.test(t1), t1);
check('مفيش سطر أطقم لما مفيش حلق', !/طقم/.test(t1), t1);

// ٢) أبواب + أطقم حلق — دي الحتة المهمة
const t2 = await txt([باب(70,5), {kind:'frame', isSet:true, qty:3, title:'حلق كامل'}]);
check('الإجمالي الكلي لسه بنفس الحساب القديم (٥+٣)', /الإجمالي الكلي\s*8 قطعة/.test(t2), t2);
check('وفيه سطر بيوضّح إن الـ٣ أطقم = ٩ عيدان',
  /منهم 3 طقم حلق\s*= 9 عود/.test(t2), t2);
check('إجمالي الأبواب مابيتأثرش بالحلق', /إجمالي الأبواب\s*5 باب/.test(t2), t2);

// ٣) حلق مفكوك لعيدان (مش أطقم) — مالوش سطر توضيح
const t3 = await txt([باب(70,2), {kind:'frame', qty:6, rodCm:220, title:'قائم'}]);
check('العيدان المفكوكة مالهاش سطر أطقم', !/طقم/.test(t3), t3);
check('وبتتعدّ عادي في الإجمالي', /الإجمالي الكلي\s*8 قطعة/.test(t3), t3);

// ٤) الجاهز والمتبقي
const t4 = await txt([باب(70,5,2), باب(80,3,3)]);
check('الجاهز = مجموع المنتَج', /جاهز\s*5 قطعة/.test(t4), t4);
check('المتبقي = الكلي − الجاهز', /متبقي\s*3 قطعة/.test(t4), t4);

// ٥) مفيش أبواب خالص → المربّع مابيظهرش
const t5 = await txt([{kind:'frame', isSet:true, qty:2}]);
check('مفيش أبواب: المربّع مابيتعرضش أصلاً', t5==='', JSON.stringify(t5));

// ٦) الثابت متطابق مع اللي الحلق بيتفكّ بيه فعلاً
const r6 = await pg.evaluate(()=>{
  state.cart=[]; window.toast=()=>{};
  const f = FRAMES[0];
  state.fr = { code:DOORS[0].code, cm:f.cm, kind:'full', qty:4, jambCm:200, headerCm:120,
    extra:[], rods:'', rodsCm:'', doorW:'', note:'', nonStd:false };
  addRod('frame');   // غير استاندر → بيتفكّ
  const عيدان = state.cart.reduce((n,it)=>n+it.qty,0);
  return { عيدان, متوقع: 4*RODS_PER_SET };
});
check('٤ أطقم مفكوكة = ٤ × الثابت من العيدان',
  r6.عيدان === r6.متوقع && r6.متوقع === 12, `${r6.عيدان} مقابل ${r6.متوقع}`);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
