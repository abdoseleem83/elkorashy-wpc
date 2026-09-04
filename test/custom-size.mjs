// المقاس الخاص. شرط تفعيل زرار «أضف» والمعاينة كان مختلف عن شرط الإضافة الفعلية:
// الزرار بيشوف العرض والارتفاع بس، والإضافة بتشوف الكمية كمان. فلو الموزّع مسح
// خانة الكمية عشان يكتب رقم تاني وضغط أضف — الباب الخاص بيتشال في صمت.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// بيجهّز اختيار: باب + مقاس عادي + مقاس خاص بكمية معيّنة
const setup = (qty) => pg.evaluate((qty)=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:2, frame:0, dbror:'', hafr:false} },
    customOn:true, custom:{w:85, h:215, qty, frame:0, dbror:'', hafr:false,
      frameHeight:'', frameKind:null, frameRodQty:'', frameForDoors:''} };
  return { جاهز: customReady_(state.pick) };
}, qty);

const addAndCount = () => pg.evaluate(()=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  addDoor();
  window.toast=old;
  return { عدد_السلة: state.cart.length,
           فيه_خاص: state.cart.some(it=>/مقاس خاص/.test(it.sizeTxt||'')),
           الرسائل: msgs };
});

// ١) كمية صحيحة → الاتنين بيتضافوا
let r = await setup(3);
check('كمية ٣: جاهز للإضافة', r.جاهز === true);
let a = await addAndCount();
check('العادي والخاص الاتنين اتضافوا', a.عدد_السلة===2 && a.فيه_خاص,
  `${a.عدد_السلة} صنف · خاص=${a.فيه_خاص}`);

// ٢) خانة الكمية اتمسحت → مش جاهز، والزرار والمعاينة لازم يعرفوا
r = await setup('');
check('كمية فاضية: مش جاهز', r.جاهز === false);
const hint = await pg.evaluate(()=>currentSummary());
check('التنبيه بيقول الكمية ناقصة', /كمية/.test(String(hint)), String(hint));

// والإضافة فعلاً مابتضيّعش حاجة في صمت: العادي بيتضاف والخاص لأ، مع رسالة
const a2 = await pg.evaluate(()=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  addDoor(); window.toast=old;
  return { فيه_خاص: state.cart.some(it=>/مقاس خاص/.test(it.sizeTxt||'')) };
});
check('الخاص الناقص مابيتضافش (زي ما التنبيه قال)', a2.فيه_خاص === false);

// ٣) كمية صفر → نفس الحاجة
r = await setup(0);
check('كمية صفر: مش جاهز', r.جاهز === false);

// ٤) لا عرض ولا ارتفاع
r = await pg.evaluate(()=>{
  state.pick = { code:DOORS[0].code, sizes:{}, customOn:true,
    custom:{w:'', h:215, qty:2, frame:0, dbror:''} };
  const بدون_عرض = customReady_(state.pick);
  state.pick.custom.w = 85; state.pick.custom.h = '';
  const بدون_ارتفاع = customReady_(state.pick);
  state.pick.customOn = false; state.pick.custom.h = 215;
  const مقفول = customReady_(state.pick);
  return { بدون_عرض, بدون_ارتفاع, مقفول };
});
check('من غير عرض: مش جاهز', r.بدون_عرض === false);
check('من غير ارتفاع: مش جاهز', r.بدون_ارتفاع === false);
check('المقاس الخاص مقفول: مش جاهز', r.مقفول === false);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
