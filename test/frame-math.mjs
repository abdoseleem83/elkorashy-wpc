// الحلق أخطر حتة ماديًا: الطقم الواحد = قائمين + عارضة علوية = ٣ عيدان.
// أي غلط في العدد أو التسعير معناه إن المصنع يقطّع خشب غلط.
// دي كانت أول مرة يتكتب عليها اختبار.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const add = (fr) => pg.evaluate((fr)=>{
  state.cart = []; window.toast = ()=>{};
  const f = FRAMES[0];
  state.fr = Object.assign({ code:DOORS[0].code, cm:f.cm, kind:'full', qty:1,
    jambCm:220, headerCm:110, extra:[], rods:'', rodsCm:'', doorW:'', note:'', nonStd:false }, fr);
  addRod('frame');
  return { سطور: state.cart.map(it=>({ عنوان:it.title, كمية:it.qty, طقم:!!it.isSet,
             طول:it.rodCm, سعر:it.price })),
           إجمالي: cartTotal(),
           باقي_الكمية: state.fr.qty };
}, fr);

// ═══ الحلق الكامل الاستاندر: سطر واحد بالأطقم ═══
const r1 = await add({ qty:5 });
check('٥ أطقم = سطر واحد مكتوب «طقم» مش «عود»',
  r1.سطور.length===1 && r1.سطور[0].طقم===true && r1.سطور[0].كمية===5,
  JSON.stringify(r1.سطور));
check('العنوان بيقول «حلق كامل»', /حلق كامل/.test(r1.سطور[0].عنوان), r1.سطور[0].عنوان);

// سعر الطقم = قائمين ٢٢٠ + عارضة ١١٠
const r1p = await pg.evaluate(()=>{
  const f = FRAMES[0];
  return { متوقع: Math.round((rodPrice(f.price,220)*2 + rodPrice(f.price,110))*100)/100 };
});
check('سعر الطقم = قائمين ٢٢٠ سم + عارضة ١١٠ سم',
  r1.سطور[0].سعر === r1p.متوقع, `${r1.سطور[0].سعر} مقابل ${r1p.متوقع}`);
check('الإجمالي = سعر الطقم × ٥', Math.abs(r1.إجمالي - r1p.متوقع*5) < 0.01,
  `${r1.إجمالي} مقابل ${r1p.متوقع*5}`);

// ═══ مقاسات غير استاندر: بيتفكّ لقوائم وعوارض ═══
const r2 = await add({ qty:3, jambCm:200, headerCm:120 });
const قوائم = r2.سطور.find(x=>/قائم/.test(x.عنوان));
const عوارض = r2.سطور.find(x=>/عارضة/.test(x.عنوان));
check('٣ أطقم غير استاندر = ٦ قوائم', قوائم && قوائم.كمية===6, JSON.stringify(r2.سطور.map(x=>x.كمية)));
check('و٣ عوارض علوية', عوارض && عوارض.كمية===3, JSON.stringify(r2.سطور.map(x=>x.كمية)));
check('القائم بطوله المطلوب ٢٠٠ سم', قوائم && قوائم.طول===200, String(قوائم && قوائم.طول));
check('والعارضة ١٢٠ سم', عوارض && عوارض.طول===120, String(عوارض && عوارض.طول));
check('مفيش سطر مكتوب عليه «طقم» في الحالة دي',
  !r2.سطور.some(x=>x.طقم), JSON.stringify(r2.سطور.map(x=>x.طقم)));

// ═══ الإضافة مرتين بتتجمّع مش بتتكرر ═══
const r3 = await pg.evaluate(()=>{
  state.cart = []; window.toast = ()=>{};
  const f = FRAMES[0];
  state.fr = { code:DOORS[0].code, cm:f.cm, kind:'full', qty:2, jambCm:220, headerCm:110,
    extra:[], rods:'', rodsCm:'', doorW:'', note:'', nonStd:false };
  addRod('frame');
  state.fr.qty = 3;                       // زوّد ٣ كمان بنفس المواصفات
  addRod('frame');
  return { سطور: state.cart.length, كمية: state.cart[0].qty };
});
check('إضافتين بنفس المواصفات = سطر واحد بـ٥ أطقم',
  r3.سطور===1 && r3.كمية===5, `${r3.سطور} سطر · ${r3.كمية} طقم`);

// ═══ الكمية بتترجع لواحد بعد الإضافة ═══
check('الكمية بترجع ١ بعد الإضافة (مايتضافش مرتين بالغلط)', r1.باقي_الكمية===1, String(r1.باقي_الكمية));

// ═══ كمية صفر أو ناقصة ═══
const r4 = await pg.evaluate(()=>{
  state.cart=[]; const msgs=[]; window.toast=m=>msgs.push(m);
  const f = FRAMES[0];
  state.fr = { code:DOORS[0].code, cm:f.cm, kind:'full', qty:0, jambCm:220, headerCm:110,
    extra:[], rods:'', rodsCm:'', doorW:'', note:'', nonStd:false };
  addRod('frame');
  const صفر = { سلة:state.cart.length, رسائل:msgs.slice() };
  msgs.length=0; state.fr.code=''; state.fr.qty=2;
  addRod('frame');
  return { صفر, بدون_كود:{ سلة:state.cart.length, رسائل:msgs.slice() } };
});
check('كمية صفر: مفيش إضافة ومعاها رسالة', r4.صفر.سلة===0 && r4.صفر.رسائل.length===1,
  JSON.stringify(r4.صفر.رسائل));
check('من غير كود باب: مفيش إضافة ومعاها رسالة',
  r4.بدون_كود.سلة===0 && /كود الباب/.test(String(r4.بدون_كود.رسائل[0])), JSON.stringify(r4.بدون_كود.رسائل));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
