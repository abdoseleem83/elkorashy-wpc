// تعديل الطلب = طلب جديد + حذف القديم من عند المصنع.
// الخطر: لو الاتنين اتبعتوا مع بعض والجديد فشل، المصنع بيفضل من غير أي نسخة
// من الطلب خالص — لا القديم ولا الجديد.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// تجهيز: سلة فيها صنف، وطلب قديم بنعدّله
const prep = () => pg.evaluate(()=>{
  localStorage.removeItem('wpc_pending_cancel');
  localStorage.removeItem('wpc_pending_sync');
  state.orders = [];
  state.cart = [{kind:'door',title:'باب',code:'A01',sizeTxt:'70 سم',qty:1,unitPrice:100}];
  state.profile = {name:'محمد', phone:'01012345678', region:'طنطا'};
  state.customer = {name:'ورشة', phone:''};
  state.orderNote=''; state.editingMeta=null;
  state.editingId='OLD9'; state.editingDate=isoLocal_();
  state.editingDisplayNo=52; state.editingEditCount=0;
});

// ١) الطلب الجديد فشل يوصل → القديم مايتمسحش، ونية الحذف تتسجّل
await prep();
const r1 = await pg.evaluate(async()=>{
  const calls=[];
  window.toast=()=>{};
  window.jsonp = (u)=>{ const s=decodeURIComponent(String(u));
    calls.push(s.includes('action=cancelOrder') ? 'cancel' : 'newOrder');
    return Promise.reject(new Error('offline')); };
  submitOrder();
  await new Promise(r=>setTimeout(r,600));
  return { النداءات: calls, نية_الحذف: JSON.parse(localStorage.getItem('wpc_pending_cancel')||'[]') };
});
check('أمر حذف القديم ما اتبعتش والجديد لسه ما وصلش',
  !r1.النداءات.includes('cancel'), JSON.stringify(r1.النداءات));
check('نية حذف القديم اتسجّلت عشان تتنفّذ بعدين',
  r1.نية_الحذف.length===1 && r1.نية_الحذف[0].prevId==='OLD9', JSON.stringify(r1.نية_الحذف));

// ٢) لما الطلب المعلّق يوصل → القديم يتمسح
const r2 = await pg.evaluate(async()=>{
  const calls=[]; window.toast=()=>{};
  window.jsonp = (u)=>{ const s=decodeURIComponent(String(u));
    calls.push(s.includes('action=cancelOrder') ? 'cancel' : 'newOrder');
    return Promise.resolve({ok:true, displayNo:52, editCount:1}); };
  await retryPendingOrders_();
  return { النداءات: calls,
           نية_الحذف: JSON.parse(localStorage.getItem('wpc_pending_cancel')||'[]'),
           معلّق: JSON.parse(localStorage.getItem('wpc_pending_sync')||'[]') };
});
check('أول ما الطلب يوصل، القديم بيتمسح', r2.النداءات.includes('cancel'), JSON.stringify(r2.النداءات));
check('نية الحذف اتشالت بعد التنفيذ', r2.نية_الحذف.length===0, JSON.stringify(r2.نية_الحذف));
check('الطلب اتشال من قايمة المعلّق', r2.معلّق.length===0, JSON.stringify(r2.معلّق));

// ٣) الحالة العادية: النت شغّال → الجديد يوصل والقديم يتمسح بالترتيب
await prep();
const r3 = await pg.evaluate(async()=>{
  const calls=[]; window.toast=()=>{};
  window.jsonp = (u)=>{ const s=decodeURIComponent(String(u));
    calls.push(s.includes('action=cancelOrder') ? 'cancel' : 'newOrder');
    return new Promise(res=>setTimeout(()=>res({ok:true, displayNo:52, editCount:1}), 40)); };
  submitOrder();
  await new Promise(r=>setTimeout(r,600));
  return { النداءات: calls, نية_الحذف: JSON.parse(localStorage.getItem('wpc_pending_cancel')||'[]') };
});
check('الجديد الأول وبعده الحذف — بالترتيب ده',
  JSON.stringify(r3.النداءات)===JSON.stringify(['newOrder','cancel']), JSON.stringify(r3.النداءات));
check('مفيش نية حذف متعلّقة', r3.نية_الحذف.length===0, JSON.stringify(r3.نية_الحذف));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
