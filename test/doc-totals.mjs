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

// ٤) «جاهز/متبقي» اتشالوا من ورقة الأوردر — دول أرقام متابعة إنتاج، مكانها
// شاشة المصنع مش المستند اللي بيروح للموزّع.
const t4 = await txt([باب(70,5,2), باب(80,3,3)]);
check('ورقة الأوردر مافيهاش «جاهز»', !/جاهز/.test(t4), t4);
check('ولا «متبقي»', !/متبقي/.test(t4), t4);
check('لكن الإجمالي لسه موجود', /الإجمالي الكلي\s*8 قطعة/.test(t4), t4);

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

// وجدول الأصناف نفسه كمان: مافيش عمود جاهز ولا متبقي، والصفوف ما اتزحلقتش
const ورقةـبـ = (priced, frameHeight) => pg.evaluate(({priced, frameHeight})=>{
  const o = { id:'D1', dist:'م', phone:'01000000000', customer:'ع', date:'2026-09-15',
    items:[{kind:'door', sizeTxt:'70 سم', sizeEn:'70 cm', w:70, qty:5, produced:2, unitPrice:100,
            title:'باب A01', frame:10, frameHeight, dbror:'6×9'}] };
  const el = document.createElement('div');
  el.innerHTML = docHTML(o, 'order', priced);
  const جدول = el.querySelector('table:has(thead)') || el.querySelector('thead').closest('table');
  const رؤوس = [...جدول.querySelectorAll('thead th')].map(x=>x.textContent.trim());
  const أعمدة = [...جدول.querySelectorAll('tbody tr')].map(tr=>tr.children.length);
  const مجموعة = جدول.querySelector('tbody td[colspan]');
  return { رؤوس, أعمدة, colspan: مجموعة ? Number(مجموعة.getAttribute('colspan')) : 0 };
}, {priced, frameHeight});
const ورقة = await ورقةـبـ(false, 0);
const ورقةُ_مسعّرة = await ورقةـبـ(true, 205);
check('مفيش عمود «جاهز» ولا «متبقي» في جدول الأوردر',
  !ورقة.رؤوس.includes('جاهز') && !ورقة.رؤوس.includes('متبقي'), ورقة.رؤوس.join(' | '));
check('عدد خلايا الصف = عدد الأعمدة بالظبط',
  ورقة.أعمدة.filter(n=>n>1).length>0 && ورقة.أعمدة.filter(n=>n>1).every(n=>n===ورقة.رؤوس.length),
  ورقة.رؤوس.length+' رؤوس مقابل '+JSON.stringify(ورقة.أعمدة));
check('وعنوان المجموعة بيغطّي الجدول كله', ورقة.colspan===ورقة.رؤوس.length,
  ورقة.colspan+' مقابل '+ورقة.رؤوس.length);

check('ونفس الكلام في النسخة المسعّرة (بارتفاع حلق وسعر)',
  !ورقةُ_مسعّرة.رؤوس.includes('جاهز') && !ورقةُ_مسعّرة.رؤوس.includes('متبقي')
  && ورقةُ_مسعّرة.colspan===ورقةُ_مسعّرة.رؤوس.length
  && ورقةُ_مسعّرة.أعمدة.filter(n=>n>1).every(n=>n===ورقةُ_مسعّرة.رؤوس.length),
  ورقةُ_مسعّرة.رؤوس.join(' | ')+' — colspan '+ورقةُ_مسعّرة.colspan);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
