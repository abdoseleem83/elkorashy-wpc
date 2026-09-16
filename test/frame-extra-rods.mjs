// الحلق بأطوال مخصوصة + أعواد إضافية: السطر المدموج لازم يفضل صادق في كل رحلته —
// في السلة، على الشيت، ولما يرجع للتعديل. لو ضاع منه طول واحد المصنع يقطّع غلط.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const أضف = (fr)=>pg.evaluate((fr)=>{
  window.toast=()=>{}; window.render=()=>{};
  const f = FRAMES[0];
  state.fr = Object.assign({ cm:f.cm, code:DOORS[0].code, kind:'full', qty:1, nonStd:true,
    jamb:2, header:1, jambCm:220, headerCm:110, extra:[], rods:'', rodsCm:'', doorW:'', note:'' }, fr);
  addRod('frame');
  return { سلة: JSON.parse(JSON.stringify(state.cart)), إجمالي: cartTotal() };
}, fr);

await pg.evaluate(()=>{ state.cart=[]; });

// ═══ ٢ طقم بأطوال مخصوصة + عودين إضافيين بطول كسري ═══
const r = await أضف({ qty:2, jambCm:200, headerCm:120, extra:[{cm:180.5, qty:2}] });
const line = r.سلة[0];
check('سطر واحد بس للطلب كله', r.سلة.length===1, JSON.stringify(r.سلة.map(x=>x.spec)));
check('عدد الأعواد = ٤ قوائم + ٢ عوارض + ٢ إضافي = ٨', line.qty===8, String(line.qty));
check('عدد الأطقم محفوظ على السطر', line.setsQty===2, String(line.setsQty));
check('الأطوال التلاتة كلها مكتوبة في الوصف',
  /قائم 200 سم × 4/.test(line.spec) && /عارضة حلق علوية 120 سم × 2/.test(line.spec)
  && /عود 180\.5 سم × 2/.test(line.spec), line.spec);
check('الطول الكسري ما اتقرّبش لـ١٨٠ أو ١٨١', /180\.5/.test(line.spec) && line.extra[0].cm===180.5,
  JSON.stringify(line.extra));

// إجمالي السطر لازم يساوي مجموع أسعار الأعواد بالظبط — مش تقريب
const مضبوط = await pg.evaluate(()=>{ const f=FRAMES[0];
  return Math.round((rodPrice(f.price,200)*4 + rodPrice(f.price,120)*2 + rodPrice(f.price,180.5)*2)*100)/100; });
check('إجمالي السطر = مجموع الأعواد الحقيقي (مش تقريب متوسط السعر)',
  Math.abs(line.price*line.qty - مضبوط) < 0.01, `${line.price*line.qty} مقابل ${مضبوط}`);
check('الإجمالي العام كمان مظبوط', Math.abs(r.إجمالي - مضبوط) < 0.01, `${r.إجمالي} مقابل ${مضبوط}`);

// ═══ نفس المواصفة تاني: تندمج في نفس السطر بالعدد والأطقم ═══
const r2 = await أضف({ qty:2, jambCm:200, headerCm:120, extra:[{cm:180.5, qty:2}] });
check('نفس المواصفة ما بتعملش سطر جديد', r2.سلة.length===1, String(r2.سلة.length));
check('العدد اتجمع (٨ + ٨ = ١٦)', r2.سلة[0].qty===16, String(r2.سلة[0].qty));
check('وعدد الأطقم اتجمع (٢ + ٢ = ٤)', r2.سلة[0].setsQty===4, String(r2.سلة[0].setsQty));

// مواصفة مختلفة = سطر مستقل، ما تندمجش بالغلط
const r3 = await أضف({ qty:1, jambCm:200, headerCm:120, extra:[{cm:170, qty:1}] });
check('مواصفة مختلفة = سطر مستقل', r3.سلة.length===2, JSON.stringify(r3.سلة.map(x=>x.qty)));

// ═══ الرحلة الكاملة: شيت ← سلة ← سحب للتعديل ← إضافة تاني ═══
const دورة = await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  adminEditOrderWith_({id:'W1',dist:'ا',phone:'01',customer:'ع',date:'2026-09-15'},[
    {type:'Frame', title:'Door Frame 10 cm', code:'A01', unit:'rods', qty:8, unitPrice:206.315,
     size:'قائم 200 سم × 4 + عارضة حلق علوية 120 سم × 2 + عود 180.5 سم × 2'}
  ]);
  const مستورد = JSON.parse(JSON.stringify(state.cart[0]));
  editCartLine(0);                       // المستخدم سحب السطر عشان يعدّله
  const شاشة = JSON.parse(JSON.stringify(state.fr));
  addRod('frame');                       // وضغط «إضافة» من غير ما يغيّر حاجة
  return { مستورد, شاشة, بعد: JSON.parse(JSON.stringify(state.cart[0])) };
});
check('السطر المدموج بيرجع من الشيت بأطواله', دورة.مستورد.jambCm===200 && دورة.مستورد.headerCm===120,
  JSON.stringify([دورة.مستورد.jambCm, دورة.مستورد.headerCm]));
check('والعود الإضافي الكسري راجع معاه',
  (دورة.مستورد.extra||[]).length===1 && دورة.مستورد.extra[0].cm===180.5 && دورة.مستورد.extra[0].qty===2,
  JSON.stringify(دورة.مستورد.extra));
check('وعدد الأطقم اتحسب صح من الوصف', دورة.مستورد.setsQty===2, String(دورة.مستورد.setsQty));
check('وسُمك الحلق ما ضاعش', دورة.مستورد.frCm===10, String(دورة.مستورد.frCm));
check('شاشة التعديل بتفتح على الأطوال الحقيقية مش ٢٢٠/١١٠',
  دورة.شاشة.jambCm===200 && دورة.شاشة.headerCm===120 && دورة.شاشة.qty===2,
  JSON.stringify([دورة.شاشة.jambCm, دورة.شاشة.headerCm, دورة.شاشة.qty]));
check('وإعادة الإضافة بترجّع نفس السطر بالظبط',
  دورة.بعد.qty===8 && /قائم 200 سم × 4/.test(دورة.بعد.spec) && /عود 180\.5 سم × 2/.test(دورة.بعد.spec),
  دورة.بعد.qty+' — '+دورة.بعد.spec);

// ═══ سطر «الحلق الكامل» ما يتحوّلش لأعواد لما يرجع للتعديل ═══
const طقم = await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  adminEditOrderWith_({id:'W2',dist:'ا',phone:'01',customer:'ع',date:'2026-09-15'},[
    {type:'Frame', title:'Full Door Frame 10 cm', code:'A01', unit:'set', qty:5, unitPrice:550,
     size:'حلق كامل 10 سم — A01'}
  ]);
  const it = JSON.parse(JSON.stringify(state.cart[0]));
  const عرض = (viewCart().match(/<div class="spec">([\s\S]*?)<\/div>/)||[])[1]||'';
  return { it, عرض: عرض.replace(/<[^>]*>/g,' '), اسم: arabicItemTitle_(
    {type:'Frame', code:'A01', size:'حلق كامل 10 سم — A01'}) };
});
check('سطر الحلق الكامل بيرجع بعلامة الطقم', طقم.it.isSet===true, JSON.stringify(طقم.it.isSet));
check('والسلة بتقول «٥ طقم» مش «٥ عود»', /5 طقم/.test(طقم.عرض) && !/5 عود/.test(طقم.عرض), طقم.عرض.trim());
check('واسم الصنف في المستندات مش مكرر («حلق حلق كامل … — A01 — A01»)',
  طقم.اسم === 'حلق كامل 10 سم — A01', طقم.اسم);

// ═══ الفلوس اللي بتتخزّن لازم تبقى بالقرش — مش 7199.499999999999 ═══
const فلوس = await pg.evaluate(()=>{
  window.toast=()=>{}; window.render=()=>{};
  const f=FRAMES[0];
  state.cart=[];
  state.fr={cm:f.cm,code:DOORS[0].code,kind:'full',qty:3,nonStd:true,jamb:2,header:1,
            jambCm:200,headerCm:120,extra:[{cm:180.5,qty:1}],rods:'',rodsCm:'',doorW:'',note:''};
  addRod('frame');
  const خانات = n => { const p=String(n).split('.')[1]; return p ? p.length : 0; };
  const مضبوط_الحلق = Math.abs(cartTotal() - (rodPrice(f.price,200)*6 + rodPrice(f.price,120)*3
                                              + rodPrice(f.price,180.5)));
  // سلة بأسعار بتطلّع كسور تايهة من ضرب الفاصلة العائمة (0.1×3 = 0.30000000000000004)
  state.cart = [{kind:'acc', id:'X', code:'X', title:'صنف', price:205.0483, qty:7, unit:'قطعة'},
                {kind:'acc', id:'Y', code:'Y', title:'صنف٢', price:0.1, qty:3, unit:'قطعة'},
                {kind:'acc', id:'Z', code:'Z', title:'صنف٣', price:0.2, qty:1, unit:'قطعة'}];
  const o = draftOrder();
  return { سطر:خانات(linePrice(state.cart[0])), إجمالي:خانات(cartTotal()),
           طلب:خانات(o.total), قيمة:cartTotal(),
           مضبوط: مضبوط_الحلق };
});
check('إجمالي السطر بالقرش (خانتين عشريتين على الأكتر)', فلوس.سطر<=2, String(فلوس.سطر));
check('وإجمالي السلة كمان', فلوس.إجمالي<=2, String(فلوس.إجمالي)+' — '+فلوس.قيمة);
check('والمبلغ اللي بيتبعت للسيرفر', فلوس.طلب<=2, String(فلوس.طلب));
check('والتقريب ما ضيّعش قرش من المجموع الحقيقي', فلوس.مضبوط < 0.01, String(فلوس.مضبوط));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
