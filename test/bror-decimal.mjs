// طول عود البرور كان بيتقرّب لسنتي صحيح: Math.round(lenM*100).
// يعني عود ٢.٢٦٥ م بيتسجّل ٢٢٧ سم — نص سنتي بيضيع من كل عود، والسعر
// (سعر المتر × الطول) بيطلع غلط على الطلب كله. الحلق بيقبل الكسور من زمان،
// والبرور لأ. الاختبار بيتأكد إنهم بقوا زي بعض.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) التحويل من متر لسنتي بيسيب الكسر
const تحويل = await pg.evaluate(()=>({
  نص_سنتي: brRodCm_(2.265),
  ربع: brRodCm_(2.2625),
  صحيح: brRodCm_(3),
  افتراضي: brRodCm_(BROR_ROD_M_DEFAULT),
  // float ماينفعش يسيب 226.49999999999997 في الطلب
  عائم: brRodCm_(2.2649999999999997),
  فاضي: brRodCm_(0),
  سالب: brRodCm_(-5)
}));
check('٢.٢٦٥ م = ٢٢٦.٥ سم (مش ٢٢٧)', تحويل.نص_سنتي===226.5, String(تحويل.نص_سنتي));
check('٢.٢٦٢٥ م = ٢٢٦.٢٥ سم', تحويل.ربع===226.25, String(تحويل.ربع));
check('الطول الصحيح زي ما هو', تحويل.صحيح===300, String(تحويل.صحيح));
check('الطول الافتراضي مااتغيّرش', تحويل.افتراضي===226, String(تحويل.افتراضي));
check('مفيش ذيل عشري من الفاصلة العائمة', تحويل.عائم===226.5, String(تحويل.عائم));
check('صفر/سالب مابيبقاش طول سالب', تحويل.فاضي>0 && تحويل.سالب>0,
  `${تحويل.فاضي} / ${تحويل.سالب}`);

// ٢) الإضافة للسلة بتحفظ الكسر — في الطول والسعر والوصف
const سطر = await pg.evaluate(()=>{
  state.cart = [];
  state.br = {size:'6×9', code:'A01', rods:3, lenM:'2.265'};
  const old=window.toast; window.toast=()=>{}; addRod('bror'); window.toast=old;
  const it = state.cart.find(x=>x.kind==='bror');
  const perM = (BRORS.find(x=>x.size==='6×9')||{}).price;
  state.cart = [];
  return { rodCm:it.rodCm, price:it.price, qty:it.qty, spec:it.spec,
           title:it.title, titleEn:it.titleEn,
           متوقع: Math.round(perM*2.265*100)/100 };
});
check('الطول المتسجّل ٢٢٦.٥ سم', سطر.rodCm===226.5, String(سطر.rodCm));
check('السعر محسوب على الطول الحقيقي', سطر.price===سطر.متوقع, `${سطر.price} مقابل ${سطر.متوقع}`);
check('الكسر باين في وصف الصنف', /226\.5\s*سم/.test(سطر.spec||''), سطر.spec);
check('وفي الاسم العربي والإنجليزي', /226\.5/.test(سطر.title||'') && /226\.5/.test(سطر.titleEn||''),
  سطر.titleEn);

// ٣) الخانة بتقبل الفاصلة العربية/العادية زي خانات الحلق
const كتابة = await pg.evaluate(()=>{
  const جرب = v => { const el = {value:v, dataset:{}}; return decIn_(v); };
  return { عربية: decIn_('٢٫٢٦٥'), فاصلة: decIn_('2,265'), أرقام_عربية: decIn_('٣') };
});
check('الفاصلة العشرية العربية بتتفهم', كتابة.عربية==='2.265', كتابة.عربية);
check('والفاصلة العادية كمان', كتابة.فاصلة==='2.265', كتابة.فاصلة);
check('والأرقام العربية', كتابة.أرقام_عربية==='3', كتابة.أرقام_عربية);

// ٤) الخانة في الشاشة بقت نصية بعلامة عشرية (زي خانة طول عود الحلق) مش number
//    — input[type=number] بيرفض «٢٫٢٦٥» وبيقصّ الكسر حسب الـstep
await pg.click('[data-act="sec"][data-s="bror"]');
await pg.waitForTimeout(250);
const خانة = await pg.evaluate(()=>{
  const el = document.querySelector('[data-act="br-lenM"]');
  return el ? { type:el.getAttribute('type'), mode:el.getAttribute('inputmode'),
                step:el.getAttribute('step'), موجودة:true } : { موجودة:false };
});
check('خانة طول عود البرور موجودة في الشاشة', خانة.موجودة===true);
check('وبقت نصية بعلامة عشرية زي خانة الحلق',
  خانة.type==='text' && خانة.mode==='decimal', `${خانة.type}/${خانة.mode}`);
check('ومفيش step بيقصّ الكسر', !خانة.step, String(خانة.step));

// والخانة بتعدّي القيمة على decIn_ (مش على el.value خام)
const مرّرت = await pg.evaluate(()=>{
  state.br.lenM = '';
  const el = document.querySelector('[data-act="br-lenM"]');
  el.value = '٢٫٢٦٥';
  el.dispatchEvent(new Event('input', {bubbles:true}));
  return state.br.lenM;
});
check('الكتابة بالعربي بتتحوّل لرقم صالح في الحال', مرّرت==='2.265', String(مرّرت));

// ٥) الرحلة كاملة: الطلب المبعوت للسيرفر بيحمل الطول الكسري، والتعديل بيرجّعه
const رحلة = await pg.evaluate(()=>{
  state.cart = [];
  state.br = {size:'6×9', code:'A01', rods:2, lenM:'2.265'};
  const old=window.toast; window.toast=()=>{}; addRod('bror'); window.toast=old;
  const it = state.cart.find(x=>x.kind==='bror');
  const unit = 'rod ' + (it.rodCm||220) + 'cm';
  // نفس الشكل اللي السيرفر بيخزّنه ويرجّعه
  const its = [{type:'Bror', title:it.titleEn, code:it.code, size:it.spec, unit,
                qty:it.qty, unitPrice:it.price}];
  const o = {id:'B1', dist:'ا', phone:'01', date:'2026-09-10'};
  window.toast=()=>{}; adminEditOrderWith_(o, its); window.toast=old;
  const رجع = state.cart.find(x=>x.kind==='bror');
  const out = { unit, عربي: itemUnitAr_(unit), رجع: رجع && رجع.rodCm };
  state.cart = []; state.edit = null; state.editing = false;
  return out;
});
check('الوحدة اللي بتتسجّل فيها الكسر', رحلة.unit==='rod 226.5cm', رحلة.unit);
check('وبتتعرّب صح للمصنع', رحلة.عربي==='عود 226.5 سم', رحلة.عربي);
check('والتعديل بيرجّع نفس الطول مش ٢٢٦', رحلة.رجع===226.5, String(رحلة.رجع));

// ٦) عدد العيدان فاضل صحيح (زي الحلق بالظبط — العدد مش بيتكسّر)
const عدد = await pg.evaluate(()=>{
  state.cart = [];
  state.br = {size:'6×9', code:'A01', rods:'2.6', lenM:'2.26'};
  const old=window.toast; window.toast=()=>{}; addRod('bror'); window.toast=old;
  const it = state.cart.find(x=>x.kind==='bror');
  state.cart = [];
  return it && it.qty;
});
check('عدد العيدان فاضل رقم صحيح', عدد===3, String(عدد));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
