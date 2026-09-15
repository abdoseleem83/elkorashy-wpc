// المالك ضاف إدخال أطوال عشرية (110.5) عشان الأطوال تتكتب زي ما هي. الاختبار
// ده بيتابع الرقم الكسري في الرحلة كلها: الشاشة → السلة → سطر السيرفر → ورجوع
// للتعديل. أي تقريب في نص الطريق معناه إن المصنع بيقطّع طول غير اللي اتطلب.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) تنظيف الإدخال: أرقام عربية، فاصلة عشرية، حروف، أكتر من نقطة
const إدخال = await pg.evaluate(()=>({
  عربي: decIn_('١٢٠٫٥'), فاصلة: decIn_('120,5'), حروف: decIn_('12a0.5b'),
  نقطتين: decIn_('120.5.7'), عادي: decIn_('220'), فاضي: decIn_('')
}));
check('الأرقام العربية بتتحوّل', إدخال.عربي === '120.5', إدخال.عربي);
check('الفاصلة بتبقى نقطة', إدخال.فاصلة === '120.5', إدخال.فاصلة);
check('الحروف بتتشال', إدخال.حروف === '120.5', إدخال.حروف);
check('نقطة واحدة بس', إدخال.نقطتين === '120.57', إدخال.نقطتين);
check('الرقم الصحيح زي ما هو', إدخال.عادي === '220', إدخال.عادي);

// ٢) العود بطول كسري: السلة لازم تحفظه زي ما هو مش مقرّب
const رحلة = await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  state.cart=[];
  state.fr={code:DOORS[0].code, cm:FRAMES[0].cm, kind:'rods', qty:1, rods:3, rodsCm:'220.5',
    jambCm:220, headerCm:110, extra:[], doorW:'', note:'', nonStd:false};
  addRod('frame');
  const سلة = state.cart[0];
  // زي ما السيرفر بيكتبه ويرجّعه
  const وحدة = 'rod ' + sلة_طول(سلة) + 'cm';
  function sلة_طول(x){ return x.rodCm; }
  adminEditOrderWith_({id:'W1',dist:'ا',phone:'01',customer:'ع',date:'2026-09-15'},
    [{type:'Frame', title:'f', code:'A01', size:سلة.spec, unit:وحدة, qty:3, unitPrice:سلة.price}]);
  return { سلة_طول: سلة.rodCm, سلة_وصف: سلة.spec, وحدة,
           رجوع_طول: state.cart[0].rodCm, تعريب: itemUnitAr_(وحدة) };
});
check('السلة بتحفظ الطول الكسري زي ما هو', رحلة.سلة_طول === 220.5, String(رحلة.سلة_طول));
check('والوصف بيكتبه صح', /220\.5 سم/.test(رحلة.سلة_وصف), رحلة.سلة_وصف);
check('وبيرجع من السيرفر من غير ما يتقرّب', رحلة.رجوع_طول === 220.5, String(رحلة.رجوع_طول));

// ٣) تعريب الوحدة: «عود 220.5 سم» مش «عود 220.5cmم»
check('وحدة العود بتتعرّب صح', رحلة.تعريب === 'عود 220.5 سم', رحلة.تعريب);
const وحدات = await pg.evaluate(()=>({
  صحيح: itemUnitAr_('rod 220cm'), مدموج: itemUnitAr_('rods'),
  باب: itemUnitAr_('door'), قطعة: itemUnitAr_('pc'), طقم: itemUnitAr_('set')
}));
check('ومفيش «cm» سايبة في أي وحدة',
  !/cm/i.test(Object.values(وحدات).join(' ')+رحلة.تعريب), JSON.stringify(وحدات));
check('الوحدات التانية زي ما هي',
  وحدات.صحيح==='عود 220 سم' && وحدات.مدموج==='عود' && وحدات.باب==='باب' && وحدات.قطعة==='قطعة',
  JSON.stringify(وحدات));

// ٤) المقاس الخاص بأبعاد كسرية بيتقرا ويتعرّب صح
const خاص = await pg.evaluate(()=>({
  تحليل: doorWH_('85.5x205.5 cm (custom)', 0),
  عربي: arabicSizeText_('85.5x205.5 cm (custom)'),
  عادي: doorWH_('90.5 cm', 0)
}));
check('المقاس الخاص الكسري بيتحلّل صح',
  خاص.تحليل.w===85.5 && خاص.تحليل.h===205.5, JSON.stringify(خاص.تحليل));
check('وبيتعرّب صح', /85\.5×205\.5 سم/.test(خاص.عربي), خاص.عربي);


// ٥) ومستند المصنع كمان لازم يقرا الطول الكسري صح
const مستند = await pg.evaluate(()=>{
  const it = adminDocItem_({ type:'Frame', title:'f', code:'A01',
    size:'10 سم — 220.5 سم — A01', unit:'rod 220.5cm', qty:3, unitPrice:260.36 }, null);
  return { rodCm: it.rodCm, isSet: it.isSet };
});
check('مستند المصنع بيقرا طول العود الكسري', مستند.rodCm === '220.5', String(مستند.rodCm));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
