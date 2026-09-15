// بلاغ من المصنع: «المعدّل القديم مش بيختفي بعد التعديل».
// الطلب اللي دخل التنفيذ مينفعش يتلغى تلقائي (عن قصد — المصنع يمكن يكون بدأ
// شغل فيه)، فالسيرفر بيحط عليه علامة في الشيت. المشكلة إن العلامة دي كانت
// بتتكتب وخلاص — عمرها ما رجعت للتطبيق. فالمصنع شايف الطلب القديم والجديد
// جنب بعض من غير أي تفسير، ومش عارف إن المفروض يحذف القديم بنفسه.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');

// ١) السيرفر بيرجّع العلامة في قايمة المصنع
check('السيرفر بيرجّع علامة «اتعدّل» في الـ list',
  /superseded:\s*isAdmin \? String\(rows\[i\]\[COL_SUPERSEDED - 1\]/.test(gs));
check('وللمصنع بس — الموزّع مايشوفهاش', /superseded:\s*isAdmin \?[^:]*: ''/.test(gs));

const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ٢) شاشة المصنع بتعرض التحذير بوضوح
const شاشة = await pg.evaluate(()=>{
  state.admin.pw='x'; state.admin.open=true; state.admin.rows=[
    { id:'W1', displayNo:86, editCount:1, status:'In Progress', dist:'اسلام', phone:'01',
      date:'2026-09-14', qty:64, total:50112, customer:'البنا',
      superseded:'⚠️ الطلب ده اتعدّل — بدّله الطلب رقم #W2 — من فضلك احذف السطر ده يدويًا' },
    { id:'W2', displayNo:86, editCount:2, status:'New', dist:'اسلام', phone:'01',
      date:'2026-09-14', qty:64, total:50112, customer:'البنا', replacesId:'W1', superseded:'' }
  ];
  state.admin.groupOpen = { 'البنا': true };   // الكروت بتتعرض لما مجموعة العميل تتفتح
  const html = viewAdmin();
  const i1 = html.indexOf('اتعدّل وعنده نسخة جديدة');
  return { فيه_تحذير: i1 > -1, مرة_واحدة: (html.match(/اتعدّل وعنده نسخة جديدة/g)||[]).length };
});
check('التحذير بيبان على الطلب القديم', شاشة.فيه_تحذير === true);
check('وعلى القديم بس مش على الجديد', شاشة.مرة_واحدة === 1, String(شاشة.مرة_واحدة));

// ٣) نافذة التأكد بقت أوسع — الطلب الكبير بياخد وقته
const تأكيد = await pg.evaluate(()=>{
  const src = verifyOrderArrived_.toString();
  return { محاولات: /tries \|\| 6/.test(src), بسقف: /Math\.min\(6000/.test(src) };
});
check('التأكد بقى ٦ محاولات بدل ٣', تأكيد.محاولات === true);
check('وبسقف انتظار عشان ماتطولش بلا نهاية', تأكيد.بسقف === true);

// ٤) التوست مابقاش يقول «اتلغى» قبل ما الإلغاء يحصل
const كود = await pg.evaluate(()=>submitOrder.toString());
check('شاشة المصنع بتستنى نتيجة الإلغاء قبل ما تحدّث القايمة',
  /await إلغاء_القديم/.test(كود) && /adminLoad\(\)/.test(كود));
check('والرسالة بتفرّق بين «اتلغى» و«لسه موجود»',
  /اتلغى الطلب القديم/.test(كود) && /لسه موجود/.test(كود));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
