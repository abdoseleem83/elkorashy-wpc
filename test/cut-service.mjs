// طلب صاحب المصنع: «يفضل السعر زي ما هو ونحط تحت البند خدمة قص او ارتفاع
// تبان مش تنضاف علي السعر». يعني المقاس الخاص لازم ياخد سعر المقاس العادي
// بالظبط (من غير CUSTOM_EXTRA القديمة)، و«خدمة قص» تتكتب كملحوظة تحت الصنف.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0];
  // نفس العرض بالظبط: مرة كمقاس عادي ومرة كمقاس خاص
  const w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:1, height:'', frame:0, dbror:'', hafr:false,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:true, custom:{w:w, h:215, qty:1, frame:0, dbror:'', hafr:false,
      frameHeight:'', frameKind:null, frameRodQty:'', frameForDoors:''} };
  const old=window.toast; window.toast=()=>{};
  addDoor();
  window.toast=old;
  const عادي = state.cart.find(it=>!/مقاس خاص/.test(it.sizeTxt||''));
  const خاص  = state.cart.find(it=>/مقاس خاص/.test(it.sizeTxt||''));
  return {
    سعر_العادي: عادي && عادي.unitPrice,
    سعر_الخاص:  خاص  && خاص.unitPrice,
    ملحوظة_الخاص: (خاص && خاص.note) || '',
    سعر_الدالة: priceForWidth(w, false),
    شاشة_الأسعار_فيها_إضافة_خاص: (function(){
      state.tab='admin'; state.adminView='prices';
      openAdminPrices(); const html = viewAdminPrices();
      return /إضافة المقاس الخاص/.test(html);
    })()
  };
});

check('المقاس الخاص بنفس سعر المقاس العادي',
  r.سعر_الخاص === r.سعر_العادي && r.سعر_الخاص === r.سعر_الدالة,
  `عادي=${r.سعر_العادي} خاص=${r.سعر_الخاص} دالة=${r.سعر_الدالة}`);
check('«خدمة قص» مكتوبة كملحوظة تحت الصنف الخاص',
  /خدمة قص/.test(r.ملحوظة_الخاص), r.ملحوظة_الخاص || '(فاضية)');
check('صف «إضافة المقاس الخاص» اتشال من شاشة الأسعار',
  r.شاشة_الأسعار_فيها_إضافة_خاص === false);

// الارتفاع غير الاستاندر: بيبان في نص المقاس ومش بيزوّد السعر
const h = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:1, height:'240', frame:0, dbror:'', hafr:false,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:false, custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,
      frameKind:null,frameRodQty:'',frameForDoors:''} };
  const old=window.toast; window.toast=()=>{};
  addDoor();
  window.toast=old;
  const it = state.cart[0];
  return { سعر: it && it.unitPrice, أساسي: priceForWidth(w,false),
           نص: it ? doorSizeText_(it.sizeTxt, it.doorHeight) : '' };
});
check('الارتفاع غير الاستاندر مش بيزوّد السعر', h.سعر === h.أساسي, `${h.سعر} مقابل ${h.أساسي}`);
check('الارتفاع بيبان في نص المقاس', /ارتفاع 240/.test(h.نص), h.نص);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\n${pass} نجح · ${fail} فشل`);
process.exit(fail?1:0);
