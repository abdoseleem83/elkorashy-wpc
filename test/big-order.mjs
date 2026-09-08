// الطلب الكبير (١٥ صنف = رابط ١٦ ألف حرف) بيتبعت POST بـ no-cors — يعني
// التطبيق مش شايف رد السيرفر خالص. الدالة كانت بترجّع null = «مش متأكدين»،
// و null مكانش بيتعامل معاه كفشل في أي مكان:
//   • الطلب القديم كان بيتمسح على طول
//   • والجديد بيتشال من قايمة المعلّق فمايتبعتش تاني
// يعني لو الـPOST فشل في صمت، الطلب يروح بالكامل. ده اللي ضيّع طلب ٧٠.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// طلب زي اللي في البلاغ بالظبط: ١٥ صنف، ٣٠٦ باب
const طلب_كبير = () => pg.evaluate(()=>{
  const صنف=(code,w,qty)=>({kind:'door', title:'باب '+code+' خشبي', titleEn:'WPC Door '+code,
    code, img:'img/doors/'+code+'.jpg', sizeTxt:w+' سم', sizeEn:w+' cm', unitPrice:5800, qty,
    w, frame:15, dbror:'6×9', frameHeight:0, doorHeight:215, hafr:false, millEn:'', note:'', produced:0});
  const items = Array.from({length:15},(_,i)=>صنف('A0'+(i%10), [90,80,65][i%3], 20+i));
  return { id:'W260908-BIG001', ts:Date.now(), name:'ربيع موسي', phone:'01002242422',
    region:'دمياط', warehouse:'مصنع إنشاص', customer:'ربيع موسى', customerPhone:'',
    note:'', items, total:1774800, displayNo:70, editCount:3, replacesId:'W260907-OLD002',
    editedAt:'2026-09-08' };
});
const o = await طلب_كبير();

const حجم = await pg.evaluate((o)=>{
  const url = APPS_SCRIPT_URL+'?action=newOrder&payload='+encodeURIComponent(JSON.stringify(o));
  return { طول: url.length, يعدّي_POST: url.length >= 7500 };
}, o);
check('الطلب الكبير فعلًا بيعدّي على مسار POST', حجم.يعدّي_POST, حجم.طول+' حرف');

// ═══ ١) الـPOST اتبعت والسيرفر استلمه فعلاً ═══
const r1 = await pg.evaluate(async(o)=>{
  state.orders=[o];
  window.fetch = ()=>Promise.resolve({ok:true});
  window.jsonp = ()=>Promise.resolve({ok:true, orders:[{id:o.id, displayNo:70, editCount:3}]});
  const res = await sendOrderToServer_(o);
  return { res, رقم: state.orders[0].displayNo };
}, o);
check('لما السيرفر يستلمه فعلاً → بيرجّع نجاح مؤكد', r1.res===true, String(r1.res));
check('وبياخد الرقم التسلسلي من التأكيد', r1.رقم===70, String(r1.رقم));

// ═══ ٢) الـPOST «نجح» بس السيرفر ما استلمش — لازم يتعامل كفشل ═══
const r2 = await pg.evaluate(async(o)=>{
  state.orders=[o];
  window.fetch = ()=>Promise.resolve({ok:true});          // الـPOST مارماش
  window.jsonp = ()=>Promise.resolve({ok:true, orders:[]}); // بس الطلب مش هناك
  const res = await sendOrderToServer_(o);
  return { res };
}, o);
check('الـPOST من غير وصول فعلي = فشل مش نجاح', r2.res===false, String(r2.res));

// ═══ ٣) الأثر الحقيقي: الطلب القديم مايتمسحش لما مانتأكدش ═══
const r3 = await pg.evaluate(async(o)=>{
  window.toast=()=>{}; window.shareOrderImage=()=>{};
  localStorage.removeItem('wpc_pending_cancel'); localStorage.removeItem('wpc_pending_sync');
  localStorage.removeItem('wpc_sent_ids'); localStorage.removeItem('wpc_deleted_ids');
  const نداءات=[];
  window.fetch = ()=>{ نداءات.push('POST الطلب الجديد'); return Promise.resolve({ok:true}); };
  window.jsonp = (u)=>{ const s=decodeURIComponent(String(u));
    if(s.includes('cancelOrder')){ نداءات.push('حذف القديم'); return Promise.resolve({ok:true}); }
    return Promise.resolve({ok:true, orders:[]});   // التأكيد بيقول: مش موجود
  };
  state.orders=[]; state.cart = o.items.slice();
  state.profile={name:o.name,phone:o.phone,region:o.region};
  state.customer={name:o.customer,phone:''}; state.orderNote='';
  state.editingId='W260907-OLD002'; state.editingDate=isoLocal_();
  state.editingDisplayNo=70; state.editingEditCount=2; state.editingMeta=null;
  submitOrder();
  await new Promise(r=>setTimeout(r,13000));   // التأكيد بياخد ٩ ثواني (٣ محاولات)
  return { نداءات, معلّق: loadPendingSync_(),
           حذف_مؤجّل: JSON.parse(localStorage.getItem('wpc_pending_cancel')||'[]').length };
}, o);
check('الطلب القديم ما اتمسحش لما ما اتأكدناش من وصول الجديد',
  !r3.نداءات.includes('حذف القديم'), JSON.stringify(r3.نداءات));
check('والجديد فضل في قايمة المعلّق عشان يتبعت تاني',
  r3.معلّق.length===1, JSON.stringify(r3.معلّق));
check('ونية حذف القديم اتأجّلت لحد ما الجديد يوصل',
  r3.حذف_مؤجّل===1, String(r3.حذف_مؤجّل));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
