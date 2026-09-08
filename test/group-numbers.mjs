// كارت العميل في شاشة المصنع كان بيعرض عدد الطلبات والقطع والإجمالي بس —
// من غير أرقام الطلبات ولا تواريخها ولا أيامها. فالمصنع لازم يفتح كل عميل عشان يدوّر على
// رقم معيّن، ومايقدرش يتأكد إن طلب وصل ولا لأ من غير ما يفتح.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin'; state.admin.groupOpen={};
  const ط=(id,no,ec,cust,qty,d)=>({id,displayNo:no,editCount:ec,date:d,dist:cust,
    phone:'01',region:'دمياط',status:'New',customer:cust,qty,total:qty*100});
  state.admin.rows=[
    ط('a1',70,3,'ربيع موسى',306,'2026-09-08'), ط('a2',66,0,'ربيع موسى',50,'2026-09-02'),
    ط('a3',61,1,'ربيع موسى',30,'2026-08-27'), ط('b1',72,0,'محمد رمزى',20,'2026-09-07'),
    ط('c1','',0,'عميل جديد',5,'2026-09-05')];   // آخر واحد لسه مالوش رقم تسلسلي
  renderNow();
  const نص = document.body.innerText.replace(/\s+/g,' ');
  return { نص, كروت: document.querySelectorAll('[data-act="adm-toggle-group"]').length };
});

check('كل العملاء ظاهرين', r.كروت===3, String(r.كروت));
check('رقم الطلب المعدّل ظاهر بشكله الكامل 70/3', /70\/3/.test(r.نص), r.نص.slice(0,140));
check('وباقي أرقام العميل ظاهرة معاه', /66/.test(r.نص) && /61\/1/.test(r.نص), r.نص.slice(0,140));
check('وأرقام العملاء التانيين ظاهرة', /72/.test(r.نص));
// التاريخ بيترسم بأرقام عربية وبينهم علامات اتجاه RTL — بنفحص الشكل نفسه
const تواريخ = (r.نص.match(/[٠-٩]{2}[\u200e\u200f]*\/[\u200e\u200f]*[٠-٩]{2}[\u200e\u200f]*\/[\u200e\u200f]*[٠-٩]{4}/g)||[]);
check('التاريخ ظاهر جنب كل رقم', تواريخ.length>=5, تواريخ.length+' تاريخ: '+تواريخ.slice(0,3).join(' · '));
check('وكل طلب بتاريخه هو مش نفس التاريخ للكل',
  new Set(تواريخ).size>=4, [...new Set(تواريخ)].join(' · '));
// واسم اليوم جنب كل تاريخ
const أيام = (r.نص.match(/الأحد|الاتنين|التلات|الأربع|الخميس|الجمعة|السبت/g)||[]);
check('اسم اليوم ظاهر مع كل طلب', أيام.length>=5, أيام.length+' يوم: '+أيام.join(' · '));
check('الطلب اللي لسه مالوش رقم بيبان بكوده الداخلي',
  /#c1/.test(r.نص), r.نص.slice(r.نص.indexOf('عميل جديد'), r.نص.indexOf('عميل جديد')+60));
check('العدادات القديمة لسه موجودة',
  /3 طلب/.test(r.نص) && /386 قطعة/.test(r.نص), r.نص.slice(0,120));

// الأرقام ظاهرة والمجموعة مقفولة — ده المقصود
const مقفولة = await pg.evaluate(()=>{
  const قبل = document.body.innerText.includes('70/3');
  return { قبل, مفتوحة: !!state.admin.groupOpen['ربيع موسى'] };
});
check('الأرقام بتبان من غير ما تفتح العميل', مقفولة.قبل && !مقفولة.مفتوحة,
  `ظاهر=${مقفولة.قبل} مفتوح=${مقفولة.مفتوحة}`);

// الضغط على الكارت لسه بيفتح الأصناف زي ما كان
const بعد = await pg.evaluate(async()=>{
  document.querySelector('[data-act="adm-toggle-group"]').click();
  await new Promise(r=>setTimeout(r,250));
  return !!state.admin.groupOpen['ربيع موسى'];
});
check('الضغط على الكارت لسه بيفتح العميل', بعد===true, String(بعد));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
