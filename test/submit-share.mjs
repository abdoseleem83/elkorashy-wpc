// بعد إرسال الطلب، صورة الأوردر بتتجهّز عشان الموزّع يبعتها على واتساب.
// لازم تستنى رد السيرفر الأول عشان تاخد الرقم التسلسلي (52) مش الكود الداخلي —
// وفي نفس الوقت المستخدم لازم يشوف إن فيه حاجة شغالة، مش يفتكر إنه خلص
// وفجأة شاشة المشاركة تفتح عليه بعد ٢٥ ثانية.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const run = (reply, delay) => pg.evaluate(async({reply, delay})=>{
  const ev=[]; const t0=Date.now();
  window.toast=m=>ev.push({نوع:'رسالة', m});
  window.shareOrderImage=(o)=>ev.push({نوع:'صورة', رقم:o.displayNo||null, نص:orderNoText_(o)});
  state.orders=[]; state.cart=[{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.profile={name:'محمد',phone:'01012345678',region:'طنطا'};
  state.customer={name:'ورشة',phone:''}; state.orderNote='';
  state.editingId=null; state.editingMeta=null;
  window.jsonp = () => new Promise((res,rej)=>setTimeout(()=>reply?res(reply):rej(new Error('النت قطع')), delay));
  submitOrder();
  await new Promise(r=>setTimeout(r, Math.round(delay/2)));
  const وسط = { انتظار: document.getElementById('busy').classList.contains('on'),
                 نص: document.getElementById('busyTxt').textContent };
  await new Promise(r=>setTimeout(r, delay + 400));
  return { ev, وسط, انتظار_بعد: document.getElementById('busy').classList.contains('on') };
}, {reply, delay});

// ١) السيرفر رد بالرقم — الصورة لازم تاخده
const r1 = await run({ok:true, displayNo:77, editCount:0}, 600);
const صورة1 = r1.ev.find(e=>e.نوع==='صورة');
check('الصورة اتجهّزت بالرقم التسلسلي مش الكود الداخلي',
  صورة1 && صورة1.رقم===77 && صورة1.نص==='77', JSON.stringify(صورة1));
check('شاشة الانتظار كانت شغالة أثناء الاستنى',
  r1.وسط.انتظار && /رقم الطلب/.test(r1.وسط.نص), JSON.stringify(r1.وسط));
check('واتقفلت بعد ما خلص', r1.انتظار_بعد===false, String(r1.انتظار_بعد));
check('الصورة اتجهّزت مرة واحدة بس',
  r1.ev.filter(e=>e.نوع==='صورة').length===1, String(r1.ev.filter(e=>e.نوع==='صورة').length));

// ٢) الرسالة بتستعمل orderNoText_ زي كل حتة تانية.
// الطلب الجديد: التوست بيظهر قبل ما السيرفر يرد، فالرقم التسلسلي لسه مش موجود
// و«#الكود الداخلي» هو الصح — دي مش حالة باج، دي الحقيقة في اللحظة دي.
const رسالة1 = r1.ev.find(e=>e.نوع==='رسالة');
check('طلب جديد: الرسالة بتقع على الكود الداخلي (الرقم لسه ما وصلش)',
  رسالة1 && /^اتسجّل طلب الأوردر #W\d{6}-/.test(String(رسالة1.m)), JSON.stringify(رسالة1));

// أما التعديل — الرقم موروث ومعروف من قبل ما نبعت، فلازم يبان
const r1b = await pg.evaluate(async()=>{
  const ev=[]; window.toast=m=>ev.push(m); window.shareOrderImage=()=>{};
  state.orders=[]; state.cart=[{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.profile={name:'محمد',phone:'01012345678',region:'طنطا'};
  state.customer={name:'ورشة',phone:''}; state.orderNote='';
  state.editingId='OLD1'; state.editingMeta=null; state.editingDate=isoLocal_();
  state.editingDisplayNo=52; state.editingEditCount=0;
  window.jsonp=()=>new Promise(r=>setTimeout(()=>r({ok:true, displayNo:52, editCount:1}),200));
  submitOrder();
  await new Promise(r=>setTimeout(r,900));
  return ev;
});
check('تعديل: الرسالة بتكتب الرقم الموروث 52/1 مش الكود الداخلي',
  r1b.some(m=>/اتحدّث الطلب 52\/1/.test(String(m))), JSON.stringify(r1b));

// ٣) النت قطع — الصورة لازم تتجهّز برضه (مايستناش للأبد) وشاشة الانتظار تتقفل
const r2 = await run(null, 600);
check('النت قطع: الصورة اتجهّزت برضه', r2.ev.some(e=>e.نوع==='صورة'),
  JSON.stringify(r2.ev.map(e=>e.نوع)));
check('النت قطع: شاشة الانتظار اتقفلت مش سايبة التطبيق مغطّى',
  r2.انتظار_بعد===false, String(r2.انتظار_بعد));
check('النت قطع: المستخدم اتنبّه إن الطلب لسه ما وصلش',
  r2.ev.some(e=>e.نوع==='رسالة' && /ما وصلش/.test(String(e.m))),
  JSON.stringify(r2.ev.filter(e=>e.نوع==='رسالة').map(e=>e.m)));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
