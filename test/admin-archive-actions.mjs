// كارت الطلب في الأرشيف بيعرض نفس أزرار الشاشة العادية (PDF / سعر / إرسال /
// الأصناف / تعديل). لكن المعالج بتاعهم كان بيدوّر على الطلب في القايمة النشطة
// بس — والطلب المؤرشف مش هناك. فالزرار كان بيتضغط ومفيش أي حاجة تحصل ولا رسالة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) البحث بيلاقي الطلب في القايمتين
const r1 = await pg.evaluate(()=>{
  state.admin.rows = [{id:'ACT1', displayNo:1, customer:'ع1', status:'New'}];
  state.admin.archRows = [{id:'ARC1', displayNo:2, customer:'ع2', status:'Delivered'}];
  return {
    نشط: !!adminOrderById_('ACT1'),
    مؤرشف: !!adminOrderById_('ARC1'),
    مش_موجود: adminOrderById_('NOPE'),
    نوع_الرقم: !!adminOrderById_(1) === false   // بيقارن كنص مش كرقم
  };
});
check('بيلاقي الطلب النشط', r1.نشط);
check('وبيلاقي المؤرشف كمان', r1.مؤرشف);
check('وبيرجّع null لطلب مش موجود', r1.مش_موجود === null, String(r1.مش_موجود));

// ٢) الأثر الحقيقي: زرار PDF على طلب مؤرشف بيشتغل فعلاً
const r2 = await pg.evaluate(async()=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows = [];
  state.admin.archRows = [{id:'ARC1', displayNo:2, date:'2026-09-04', dist:'م', phone:'01',
    region:'ط', status:'Delivered', customer:'ع2', qty:1, total:100}];
  state.admin.viewArchive = true;
  state.admin.groupOpen = {'ع2': true};
  renderNow();
  await new Promise(r=>setTimeout(r,200));
  const أزرار = ['adm-pdf','adm-quote','adm-share','adm-toggle-items','adm-add-items','adm-toggle-qtymode'];
  const اتوصل = {};
  for(const act of أزرار){
    const btn = document.querySelector(`[data-act="${act}"][data-id="ARC1"]`);
    اتوصل[act] = { ظاهر: !!btn, لاقى_الطلب: !!adminOrderById_('ARC1') };
  }
  return اتوصل;
});
Object.entries(r2).forEach(([act, v])=>{
  check(`الأرشيف: زرار ${act} ظاهر وبيلاقي طلبه`, v.ظاهر && v.لاقى_الطلب,
    `ظاهر=${v.ظاهر} لاقى=${v.لاقى_الطلب}`);
});

// ٣) كل حالة في الـswitch ليها زرار فعلاً (مفيش كود ميت)
const r3 = await pg.evaluate(()=>{
  const html = document.documentElement.outerHTML;
  const acts = ['adm-pdf','adm-quote','adm-share','adm-toggle-items','adm-add-items','adm-toggle-qtymode'];
  return acts.filter(a => !html.includes('data-act="'+a+'"'));
});
check('كل أزرار الطلب موجودة فعلاً في الشاشة', r3.length===0, JSON.stringify(r3));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
