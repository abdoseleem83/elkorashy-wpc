// المطلوب: لما الطلب يتعدّل، القديم يتمسح ويفضل الجديد بس، وعليه علامة تعديل.
// الاختبار ده بيثبّت السلوك ده في كل مكان بيبان فيه الطلب.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(async()=>{
  window.toast=()=>{}; window.shareOrderImage=()=>{};
  const نداءات=[];
  window.jsonp=(u)=>{ const s=decodeURIComponent(String(u));
    نداءات.push(s.includes('cancelOrder')?'حذف القديم':'إرسال الجديد');
    return Promise.resolve({ok:true, displayNo:52, editCount:1}); };
  state.orders=[{id:'OLD1', ts:Date.now(), displayNo:52, editCount:0, name:'محمد',
    phone:'01012345678', region:'طنطا', items:[{kind:'door',title:'باب',qty:1,unitPrice:100}], total:100}];
  state.track.rows=[{id:'OLD1', status:'New', displayNo:52}];
  state.profile={name:'محمد',phone:'01012345678',region:'طنطا'};
  state.customer={name:'ورشة',phone:''}; state.orderNote='';
  state.cart=[{kind:'door',title:'باب',qty:3,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.editingId='OLD1'; state.editingDate=isoLocal_();
  state.editingDisplayNo=52; state.editingEditCount=0; state.editingMeta=null;
  submitOrder();
  await new Promise(r=>setTimeout(r,700));
  const جديد = state.orders[0];
  state.tab='orders'; renderNow();
  await new Promise(r=>setTimeout(r,250));
  const شاشة = document.body.innerText;
  return {
    عدد: state.orders.length,
    القديم_على_الجهاز: state.orders.some(x=>x.id==='OLD1'),
    القديم_في_قايمة_السيرفر: (state.track.rows||[]).some(x=>x.id==='OLD1'),
    جديد: {رقم: orderNoText_(جديد), عدّاد: جديد.editCount, يحل_محل: جديد.replacesId, id: جديد.id},
    نداءات,
    شاشة_فيها_معدّل: /معدّل/.test(شاشة),
    شاشة_فيها_الرقم: /52\/1/.test(شاشة),
    شاشة_فيها_القديم: شاشة.includes('OLD1'),
    شاشة_نص: شاشة.replace(/\s+/g,' ').slice(0,400),
    رسالة_واتساب: buildMessage(جديد)
  };
});

check('على الجهاز فضل طلب واحد بس', r.عدد===1, String(r.عدد));
check('الطلب القديم اتشال من الجهاز', !r.القديم_على_الجهاز);
check('واتشال من نسخة قايمة السيرفر المحفوظة كمان', !r.القديم_في_قايمة_السيرفر);
check('الجديد رقمه 52/1 (نفس الرقم + عدّاد التعديل)', r.جديد.رقم==='52/1', r.جديد.رقم);
check('وعدّاد التعديل ١', r.جديد.عدّاد===1, String(r.جديد.عدّاد));
check('وبيسجّل إنه بيحل محل القديم', r.جديد.يحل_محل==='OLD1', String(r.جديد.يحل_محل));
check('وله كود داخلي جديد مستقل', r.جديد.id!=='OLD1', r.جديد.id);
check('السيرفر: الجديد اتبعت الأول وبعده حذف القديم',
  JSON.stringify(r.نداءات)===JSON.stringify(['إرسال الجديد','حذف القديم']), JSON.stringify(r.نداءات));
check('شاشة «تابع طلبك»: علامة «معدّل» ظاهرة', r.شاشة_فيها_معدّل);
check('وفيها الرقم 52/1', r.شاشة_فيها_الرقم);
check('ومفيهاش الكود الداخلي للطلب القديم (الموزّع مايعرفوش)',
  !r.شاشة_فيها_القديم, 'لسه ظاهر في الشاشة');
check('وبدلها بتقول «تعديل على 52» بالرقم اللي الموزّع يعرفه',
  /تعديل على 52/.test(r.شاشة_نص||''), (r.شاشة_نص||'').slice(0,120));
check('رسالة الواتساب فيها الرقم المعدّل', /رقم الطلب: 52\/1/.test(r.رسالة_واتساب),
  String(r.رسالة_واتساب).split('\n')[1]);
check('ورسالة الواتساب بتقول إنه تعديل على 52', /تعديل على الطلب رقم: 52\n/.test(r.رسالة_واتساب),
  (String(r.رسالة_واتساب).split('\n').find(l=>/تعديل على/.test(l))||''));

// المستند المطبوع
const doc = await pg.evaluate(()=>{
  const el=document.createElement('div');
  el.innerHTML = docHTML({id:'X1', ts:Date.now(), displayNo:52, editCount:1, replacesId:'OLD1',
    editedAt:'2026-09-08', name:'محمد', phone:'01', region:'ط', customer:'ورشة',
    items:[{kind:'door', title:'باب', sizeTxt:'70 سم', w:70, qty:3}], total:300}, 'order', false);
  return el.textContent.replace(/\s+/g,' ');
});
check('المستند المطبوع مكتوب عليه «معدّل»', /معدّل/.test(doc), doc.slice(0,150));
check('والمستند فيه الرقم 52/1', /52\/1/.test(doc), doc.slice(0,150));
check('والمستند بيقول «بدل الطلب رقم 52» مش الكود الداخلي',
  /بدل الطلب رقم 52/.test(doc) && !/OLD1/.test(doc), doc.slice(0,160));

// السيرفر: الحذف بيمسح الصف وأصنافه
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const blk = /if \(action === 'cancelOrder'\)[\s\S]*?\n    \}/.exec(gs)[0];
check('السيرفر بيمسح صف الطلب القديم فعلاً', /shCO\.deleteRow\(rCO\)/.test(blk));
check('وبيمسح أصنافه معاه', /clearItemRows_\(shICO/.test(blk));
check('وبيرجّع رصيد المخزن', /restoreStockForOrderId_/.test(blk));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
