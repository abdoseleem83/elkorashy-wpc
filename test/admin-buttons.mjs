// زرارين كانوا مفقودين من شاشة المصنع: PDF للطلب الواحد، وتعليم الصنف «غير متاح».
// الدوال والمعالجات كانت موجودة وشغّالة — الأزرار بس هي اللي مكانتش موجودة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915},deviceScaleFactor:2})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
await pg.evaluate(()=>{
  state.admin.open = true;
  state.admin.rows = [{id:'2026-0052', displayNo:52, editCount:0, date:'2026-09-04',
    dist:'محمد القرشي', phone:'01067765483', region:'طنطا', status:'Received',
    customer:'ورشة النور للأخشاب', qty:9, total:52000}];
  state.admin.items['2026-0052'] = [
    {type:'Door', title:'باب A01', code:'A01', size:'70 cm', unit:'door', qty:6, unitPrice:5200, produced:2, avail:true},
    {type:'Frame', title:'حلق A01', code:'A01', size:'10 cm', unit:'set', qty:4, unitPrice:780, produced:0, avail:false}
  ];
  state.admin.itemsOpen['2026-0052'] = true;
  state.admin.groupOpen['ورشة النور للأخشاب'] = true;
  state.tab='admin'; renderNow();
});
await pg.waitForTimeout(600);
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

check('زرار PDF للطلب الواحد ظاهر', (await pg.$$('[data-act="adm-pdf"]')).length === 1);
const av = await pg.$$('[data-act="adm-item-avail"]');
check('زرار «متاح» لكل صنف', av.length === 2, String(av.length));
const r = await pg.evaluate(()=>{
  const v=document.getElementById('view');
  const btns=[...v.querySelectorAll('[data-act="adm-item-avail"]')];
  return {
    عمود_متاح: v.textContent.includes('متاح'),
    الصنف_غير_المتاح_متعلّم: v.textContent.includes('غير متاح — '),
    قيم_الزراير: btns.map(x=>x.dataset.avail),
    كلاس_الزراير: btns.map(x=>x.className.includes('act-send')?'أخضر':'أحمر')
  };
});
check('عمود «متاح» في الترويسة', r.عمود_متاح);
check('الصنف غير المتاح متعلّم في اسمه', r.الصنف_غير_المتاح_متعلّم);
check('الزرار بيقلب الحالة (0 للمتاح، 1 لغير المتاح)', r.قيم_الزراير.join(',')==='0,1', r.قيم_الزراير.join(','));
check('لون الزرار بيفرّق بينهم', r.كلاس_الزراير.join(',')==='أخضر,أحمر', r.كلاس_الزراير.join(','));

// وضع تعديل الكميات مالوش عمود متاح
await pg.evaluate(()=>{ state.admin.qtyEditOpen['2026-0052']=true; renderNow(); });
await pg.waitForTimeout(400);
check('وضع تعديل الكميات من غير عمود متاح',
  (await pg.$$('[data-act="adm-item-avail"]')).length === 0);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
