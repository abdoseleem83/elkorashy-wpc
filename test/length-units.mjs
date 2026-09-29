// شاشة «حلق فقط» كانت بالسنتي بس، و«برور فقط» بالمتر بس — والموزّع اللي بيفكّر
// بالوحدة التانية كان بيحوّل في دماغه (مصدر غلطات أطوال). دلوقتي فيه زرار وحدة
// في الشاشتين، والتطبيق بيحسب ويسجّل بالسنتي دايمًا.
// وكمان: عدد الأعواد بقى يقبل كسور (نص عود تكملة) زي الأطوال بالظبط.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ ١) التحويل نفسه ═══
const c = await pg.evaluate(()=>({
  م: lenToCm_('2.265','m'), سم: lenToCm_('226.5','cm'),
  عربي: lenToCm_('٢٫٢٦٥','m'), فاصلة: lenToCm_('2,265','m'),
  عائم: lenToCm_('2.265','m')===226.5,
  رجوع_م: lenFromCm_(220,'m'), رجوع_سم: lenFromCm_(220,'cm'),
  رجوع_كسر: lenFromCm_(226.5,'m'),
  صفر: lenFromCm_(0,'m'),
  وحدة_مجهولة: lenToCm_('220','zz'),        // المجهول = سنتيمتر (الافتراضي)
  لبل: [lenUnitLbl_('cm'), lenUnitLbl_('m'), lenUnitLbl_('zz')]
}));
check('٢.٢٦٥ م = ٢٢٦.٥ سم', c.م===226.5, String(c.م));
check('٢٢٦.٥ سم = ٢٢٦.٥ سم', c.سم===226.5, String(c.سم));
check('الفاصلة العربية والعادية بيتفهموا', c.عربي===226.5 && c.فاصلة===226.5, `${c.عربي}/${c.فاصلة}`);
check('مفيش ذيل عشري من الفاصلة العائمة', c.عائم===true);
check('٢٢٠ سم بترجع ٢.٢ م', c.رجوع_م==='2.2', c.رجوع_م);
check('وبترجع ٢٢٠ لو الوحدة سم', c.رجوع_سم==='220', c.رجوع_سم);
check('والكسر بيرجع صح', c.رجوع_كسر==='2.265', c.رجوع_كسر);
check('صفر = خانة فاضية مش «0»', c.صفر==='', JSON.stringify(c.صفر));
check('وحدة مش معروفة = سنتيمتر', c.وحدة_مجهولة===220, String(c.وحدة_مجهولة));
check('أسماء الوحدات', c.لبل.join('/')==='سم/م/سم', c.لبل.join('/'));

// ═══ ٢) عدد الأعواد بقى يقبل كسور ═══
const q = await pg.evaluate(()=>({
  نص: rodQty_('2.5'), عربي: rodQty_('٢٫٥'), صحيح: rodQty_('3'),
  صفر: rodQty_('0'), فاضي: rodQty_(''), سالب: rodQty_('-2'),
  تقريب: rodQty_('2.5555')
}));
check('٢.٥ عود بيتقبل', q.نص===2.5, String(q.نص));
check('وبالأرقام العربية', q.عربي===2.5, String(q.عربي));
check('والعدد الصحيح زي ما هو', q.صحيح===3, String(q.صحيح));
check('صفر وفاضي = صفر', q.صفر===0 && q.فاضي===0, `${q.صفر}/${q.فاضي}`);
check('ومفيش عدد سالب أبدًا', q.سالب>=0, String(q.سالب));
check('التقريب لجزء من مية', q.تقريب===2.56, String(q.تقريب));

// ═══ ٣) حلق: أعواد حرة بالمتر + عدد كسري ═══
const fr = await pg.evaluate(()=>{
  state.cart=[];
  state.fr={cm:10, code:'A01', doorW:'', kind:'rods', qty:1, nonStd:false, jamb:2, header:1,
            jambCm:220, headerCm:110, extra:[], rods:'2.5', rodsCm:'2.205', note:'', unit:'m'};
  const old=window.toast; window.toast=()=>{}; addRod('frame'); window.toast=old;
  const it=state.cart.find(x=>x.kind==='frame');
  const out={rodCm:it.rodCm, qty:it.qty, price:it.price, spec:it.spec, title:it.title,
             متوقع:Math.round(FRAMES.find(f=>f.cm===10).price*2.205*100)/100};
  state.cart=[];
  return out;
});
check('الطول المكتوب بالمتر بيتسجّل بالسنتي', fr.rodCm===220.5, String(fr.rodCm));
check('وعدد الأعواد الكسري بيتسجّل زي ما هو', fr.qty===2.5, String(fr.qty));
check('والسعر محسوب على الطول الحقيقي', fr.price===fr.متوقع, `${fr.price} مقابل ${fr.متوقع}`);
check('والوصف بالسنتي (اللي المصنع بيقراه)', /220\.5\s*سم/.test(fr.spec), fr.spec);

// ═══ ٤) برور: الطول بالسنتي + عدد كسري ═══
const br = await pg.evaluate(()=>{
  state.cart=[];
  state.br={size:'6×9', code:'A01', rods:'1.5', len:'226.5', unit:'cm'};
  const old=window.toast; window.toast=()=>{}; addRod('bror'); window.toast=old;
  const it=state.cart.find(x=>x.kind==='bror');
  const out={rodCm:it.rodCm, qty:it.qty, price:it.price, spec:it.spec,
             متوقع:Math.round(BRORS.find(x=>x.size==='6×9').price*2.265*100)/100};
  state.cart=[];
  return out;
});
check('برور: الطول المكتوب بالسنتي بيتسجّل زي ما هو', br.rodCm===226.5, String(br.rodCm));
check('وعدد العيدان الكسري', br.qty===1.5, String(br.qty));
check('والسعر مظبوط', br.price===br.متوقع, `${br.price} مقابل ${br.متوقع}`);

// ═══ ٥) حلق كامل: أطوال بالمتر + أطقم كسرية ═══
const fs = await pg.evaluate(()=>{
  state.cart=[];
  state.fr={cm:10, code:'A01', doorW:'', kind:'full', qty:'1.5', nonStd:true, jamb:2, header:1,
            jambCm:'2.2', headerCm:'1.1', extra:[{cm:'1.805',qty:'2'}], rods:'', rodsCm:'', note:'', unit:'m'};
  const old=window.toast; window.toast=()=>{}; addRod('frame'); window.toast=old;
  const it=state.cart.find(x=>x.kind==='frame');
  const out={qty:it.qty, setsQty:it.setsQty, jambCm:it.jambCm, headerCm:it.headerCm,
             extra:it.extra, spec:it.spec};
  state.cart=[];
  return out;
});
check('الأطوال المكتوبة بالمتر اتسجّلت بالسنتي', fs.jambCm===220 && fs.headerCm===110,
  `${fs.jambCm}/${fs.headerCm}`);
check('والعود الإضافي كمان', fs.extra.length===1 && fs.extra[0].cm===180.5, JSON.stringify(fs.extra));
check('عدد الأطقم الكسري بيتسجّل', fs.setsQty===1.5, String(fs.setsQty));
check('وإجمالي الأعواد = ١.٥×٢ قائم + ١.٥ عارضة + ٢ عود', fs.qty===6.5, String(fs.qty));

// ═══ ٦) الوصف المدموج بكسور بيرجع صح للتعديل (مفيش نص عود بيضيع) ═══
const rt = await pg.evaluate(()=>{
  const br = parseFrameBreakdown_('قائم 220 سم × 3 + عارضة حلق علوية 110 سم × 1.5 + عود 180.5 سم × 2');
  const صحيح = parseFrameBreakdown_('قائم 220 سم × 4 + عارضة حلق علوية 110 سم × 2');
  return { جامب:br.jambQty, هيدر:br.headerQty, إضافي:br.extra,
           صحيح:{جامب:صحيح.jambQty, هيدر:صحيح.headerQty, أطقم:صحيح.setsQty} };
});
check('العدد الكسري في الوصف بيتقرا كامل', rt.جامب===3 && rt.هيدر===1.5,
  `قائم=${rt.جامب} عارضة=${rt.هيدر}`);
check('والعود الإضافي بطوله الكسري', rt.إضافي.some(x=>x.cm===180.5 && x.qty===2), JSON.stringify(rt.إضافي));
check('والأوصاف الصحيحة القديمة زي ما هي', rt.صحيح.جامب===4 && rt.صحيح.هيدر===2 && rt.صحيح.أطقم===2,
  JSON.stringify(rt.صحيح));

// ═══ ٧) تبديل الوحدة بيحوّل اللي مكتوب (مش بيغيّر معناه) ═══
await pg.click('[data-act="sec"][data-s="frame"]');
await pg.waitForTimeout(250);
const sw = await pg.evaluate(async()=>{
  state.fr.unit='cm'; state.fr.nonStd=true; state.fr.jambCm='220'; state.fr.headerCm='110';
  state.fr.rodsCm='226.5'; state.fr.extra=[{cm:'180.5',qty:'2'}]; renderNow();
  const اضغط = u => { const el=document.querySelector(`[data-act="fr-unit"][data-u="${u}"]`); el.click(); };
  اضغط('m');
  const بعد_متر = {unit:state.fr.unit, jamb:state.fr.jambCm, header:state.fr.headerCm,
                   rods:state.fr.rodsCm, extra:state.fr.extra[0].cm};
  اضغط('cm');
  const رجوع = {unit:state.fr.unit, jamb:state.fr.jambCm, header:state.fr.headerCm,
                rods:state.fr.rodsCm, extra:state.fr.extra[0].cm};
  return { بعد_متر, رجوع };
});
check('التبديل للمتر بيحوّل كل الأطوال',
  sw.بعد_متر.unit==='m' && sw.بعد_متر.jamb==='2.2' && sw.بعد_متر.header==='1.1'
  && sw.بعد_متر.rods==='2.265' && sw.بعد_متر.extra==='1.805',
  JSON.stringify(sw.بعد_متر));
check('والرجوع للسنتي بيرجّعهم زي ما كانوا',
  sw.رجوع.unit==='cm' && sw.رجوع.jamb==='220' && sw.رجوع.header==='110'
  && sw.رجوع.rods==='226.5' && sw.رجوع.extra==='180.5',
  JSON.stringify(sw.رجوع));

// ═══ ٨) بعد الإضافة، الافتراضيات بترجع بوحدة الشاشة (مش ٢٢٠ متر) ═══
const def = await pg.evaluate(()=>{
  state.cart=[];
  state.fr={cm:10, code:'A01', doorW:'', kind:'full', qty:'1', nonStd:false, jamb:2, header:1,
            jambCm:'2.2', headerCm:'1.1', extra:[], rods:'', rodsCm:'', note:'', unit:'m'};
  const old=window.toast; window.toast=()=>{}; addRod('frame'); window.toast=old;
  const out={unit:state.fr.unit, jamb:state.fr.jambCm, header:state.fr.headerCm};
  state.cart=[];
  return out;
});
check('الافتراضيات بعد الإضافة بتتكتب بالمتر لو الشاشة بالمتر',
  def.unit==='m' && def.jamb==='2.2' && def.header==='1.1', JSON.stringify(def));

// ═══ ٩) تعديل سطر من السلة بيرجّع الوحدة سم (الأطوال المحفوظة بالسنتي) ═══
const ed = await pg.evaluate(()=>{
  state.cart=[];
  state.fr={cm:10, code:'A01', doorW:'', kind:'rods', qty:1, nonStd:false, jamb:2, header:1,
            jambCm:220, headerCm:110, extra:[], rods:'2', rodsCm:'2.205', note:'', unit:'m'};
  const old=window.toast; window.toast=()=>{}; addRod('frame');
  const i = state.cart.findIndex(x=>x.kind==='frame');
  editCartLine(i); window.toast=old;
  const out={unit:state.fr.unit, rodsCm:state.fr.rodsCm, rods:state.fr.rods};
  restorePulledLine_(true); state.cart=[];
  return out;
});
check('التعديل بيرجّع الطول بالسنتي مع وحدة سم (مفيش تحويل مزدوج)',
  ed.unit==='cm' && Number(ed.rodsCm)===220.5, JSON.stringify(ed));

// ═══ ١٠) البرور كمان: التعديل بيرجّع سم ═══
const edb = await pg.evaluate(()=>{
  state.cart=[];
  state.br={size:'6×9', code:'A01', rods:'2', len:'2.265', unit:'m'};
  const old=window.toast; window.toast=()=>{}; addRod('bror');
  const i = state.cart.findIndex(x=>x.kind==='bror');
  editCartLine(i); window.toast=old;
  const out={unit:state.br.unit, len:state.br.len};
  restorePulledLine_(true); state.cart=[];
  return out;
});
check('برور: التعديل بيرجّع الطول بالسنتي مع وحدة سم',
  edb.unit==='cm' && Number(edb.len)===226.5, JSON.stringify(edb));

// ═══ ١١) الخانات كلها نصية بعلامة عشرية (مفيش step بيقصّ الكسر) ═══
await pg.click('[data-act="sec"][data-s="frame"]');
await pg.waitForTimeout(250);
const حقول = await pg.evaluate(()=>{
  state.fr.kind='rods'; state.fr.nonStd=true; renderNow();   // render() مؤجّلة لإطار جاي
  const خد = a => { const el=document.querySelector(`[data-act="${a}"]`);
    return el ? {t:el.getAttribute('type'), m:el.getAttribute('inputmode'), s:el.getAttribute('step')} : null; };
  return { rods:خد('fr-rods'), rodsCm:خد('fr-rodsCm'),
           وحدة: !!document.querySelector('[data-act="fr-unit"]') };
});
check('زرار وحدة الطول موجود في شاشة الحلق', حقول.وحدة===true);
check('خانة عدد الأعواد بقت عشرية',
  حقول.rods && حقول.rods.t==='text' && حقول.rods.m==='decimal' && !حقول.rods.s,
  JSON.stringify(حقول.rods));
check('وخانة الطول كمان', حقول.rodsCm && حقول.rodsCm.t==='text' && حقول.rodsCm.m==='decimal',
  JSON.stringify(حقول.rodsCm));

await pg.click('[data-act="sec"][data-s="bror"]');
await pg.waitForTimeout(250);
const حقولB = await pg.evaluate(()=>{
  const خد = a => { const el=document.querySelector(`[data-act="${a}"]`);
    return el ? {t:el.getAttribute('type'), m:el.getAttribute('inputmode'), s:el.getAttribute('step')} : null; };
  return { rods:خد('br-rods'), len:خد('br-len'), وحدة: !!document.querySelector('[data-act="br-unit"]') };
});
check('زرار وحدة الطول موجود في شاشة البرور', حقولB.وحدة===true);
check('خانة عدد العيدان بقت عشرية',
  حقولB.rods && حقولB.rods.t==='text' && حقولB.rods.m==='decimal' && !حقولB.rods.s,
  JSON.stringify(حقولB.rods));
check('وخانة الطول اسمها br-len', حقولB.len && حقولB.len.t==='text', JSON.stringify(حقولB.len));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
