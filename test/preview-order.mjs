// المعاينة في شاشة المصنع: لازم تفتح من البيانات اللي في الشاشة من غير أي نداء
// للسيرفر، وتعرض رقم الطلب المعدّل بالشكل «52/2» مع تاريخ التعديل.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915},deviceScaleFactor:2})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
const calls=[]; pg.on('request',r=>{ const u=r.url(); if(u.includes('action=')) calls.push(u.match(/action=(\w+)/)[1]); });
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// نحاكي شاشة المصنع بعد ما حمّلت الطلبات (زي الواقع)
await pg.evaluate(()=>{
  state.admin.open = true;
  state.admin.rows = [
    {id:'2026-0052', displayNo:52, editCount:2, editedAt:'2026-09-04', date:'2026-08-28',
     dist:'محمد القرشي', phone:'01067765483', region:'طنطا', status:'Received',
     customer:'ورشة النور للأخشاب', qty:9, total:52000},
    {id:'2026-0061', displayNo:61, editCount:0, date:'2026-09-01',
     dist:'محمد القرشي', phone:'01067765483', region:'طنطا', status:'New',
     customer:'ورشة النور للأخشاب', qty:4, total:20000}
  ];
  // أصناف الطلبين محمّلة خلاص (زي لما المصنع يفتح «الأصناف»)
  state.admin.items['2026-0052'] = [
    {type:'Door',title:'باب A01',code:'A01',size:'70 cm',unit:'door',qty:6,unitPrice:5200,produced:2,frame:'10',dbror:'6×9',width:'70'},
    {type:'Frame',title:'حلق A01',code:'A01',size:'10 cm',unit:'set',qty:4,unitPrice:780,produced:0}
  ];
  state.admin.items['2026-0061'] = [
    {type:'Door',title:'باب A05',code:'A05',size:'90 cm',unit:'door',qty:4,unitPrice:5400,produced:0,frame:'15',dbror:'6×9',width:'90'}
  ];
});
calls.length = 0;
const t0 = Date.now();
await pg.evaluate(()=>previewCustomerOrder_('ورشة النور للأخشاب'));
await pg.waitForTimeout(1500);
const took = Date.now()-t0;

let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

check('المعاينة فتحت', !!(await pg.$('#reportPreviewOverlay')));
check('مفيش أي نداء للسيرفر (البيانات موجودة)', calls.length===0, calls.length? calls.join(', '):'صفر نداء');
check('فتحت بسرعة (أقل من 2 ثانية)', took < 2000, took+'ms');

const r = await pg.evaluate(()=>{
  const o=document.getElementById('reportPreviewOverlay'); if(!o) return null;
  const t=o.textContent;
  const nums=[...o.querySelectorAll('div')].filter(d=>/^\d+(\/\d+)?$/.test(d.textContent.trim())&&getComputedStyle(d).fontSize==='38px')
    .map(d=>d.textContent.trim());
  return {الأرقام:nums, نص:t,
    فيه_معدل: t.includes('التعديل رقم 2 — بتاريخ'),
    فيه_تاريخ_التعديل: t.includes('04/09/2026'),
    عنوان_معدّل: t.includes('رقم طلب الأوردر — معدّل'),
    الطلبين: (t.match(/طلب أوردر/g)||[]).length};
});
check('رقم الطلب المعدّل «52/2»', r && r.الأرقام.includes('52/2'), r && r.الأرقام.join(' , '));
check('الطلب غير المعدّل رقمه عادي «61»', r && r.الأرقام.includes('61'));
check('مكتوب «التعديل رقم 2 — بتاريخ»', r && r.فيه_معدل);
check('تاريخ التعديل (مش تاريخ الطلب)', r && r.فيه_تاريخ_التعديل);
check('العنوان بيقول «معدّل»', r && r.عنوان_معدّل);
check('الطلبين الاتنين ظاهرين', r && r.الطلبين===2, r && String(r.الطلبين));
check('مفيش أخطاء', errs.length===0, errs.join(' | '));

await pg.screenshot({path:'/tmp/t3.png'});
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
