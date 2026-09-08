// «في طلبات اختفت لما عملت تحديث — الجديدة بتاريخ اليوم».
// السبب: التطبيق ممكن يكون مفتوح في أكتر من مكان (مثبّت + تاب في المتصفح)، وكل
// نسخة شايلة القايمة في ذاكرتها. كل مسارات الحفظ كانت بتكتب فوق التخزين كله —
// فأول ما نسخة قديمة تحفظ أي حاجة، بتمسح اللي التانية ضافته. والطلب الجديد
// بيتحط في أول القايمة، فاللي بيضيع هو الأحدث.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const URL_ = process.env.APP_URL || 'http://localhost:8100/index.html';
const ctx = await b.newContext({viewport:{width:412,height:915}});   // نفس الأصل = نفس التخزين
const A = await ctx.newPage(), B = await ctx.newPage();
const errs=[]; A.on('pageerror',e=>errs.push('A: '+e.message)); B.on('pageerror',e=>errs.push('B: '+e.message));
for(const p of [A,B]) await p.goto(URL_,{waitUntil:'domcontentloaded'});
await A.waitForTimeout(1500); await B.waitForTimeout(1500);

const ids = (p) => p.evaluate(()=>{
  try{ return (JSON.parse(localStorage.getItem('wpc_orders')||'[]')).map(o=>o.id); }catch(e){ return ['PARSE_FAIL']; }
});
// ⚠️ التصفير لازم يمسح التخزين نفسه — saveOrders_ بتدمج مع الموجود عن قصد،
// فتصفير الذاكرة لوحده مابيمسحش اللي في التخزين من الاختبار اللي فات.
const مبدئي = ()=>[{id:'OLD1',ts:1000,displayNo:1,items:[]},{id:'OLD2',ts:900,displayNo:2,items:[]}];
const reset = async () => {
  await A.evaluate(o=>{
    localStorage.removeItem('wpc_deleted_ids');
    localStorage.setItem('wpc_orders', JSON.stringify(o));
    state.orders = JSON.parse(JSON.stringify(o));
  }, مبدئي());
  await B.evaluate(o=>{ state.orders = JSON.parse(JSON.stringify(o)); }, مبدئي());
};

// ═══ ١) السيناريو اللي حصل بالظبط ═══
await reset();
await B.evaluate(()=>{ state.orders.unshift({id:'TODAY1',ts:Date.now(),displayNo:52,items:[]}); saveOrders_(state.orders); });
check('التبويب B بعت طلب النهاردة', (await ids(B)).includes('TODAY1'), JSON.stringify(await ids(B)));
await A.evaluate(()=>saveOrders_(state.orders));      // نسخة قديمة بتحفظ أي حاجة
const بعد = await ids(A);
check('طلب النهاردة ما اتمسحش من النسخة القديمة', بعد.includes('TODAY1'), JSON.stringify(بعد));
check('والقديم لسه موجود معاه', بعد.includes('OLD1') && بعد.includes('OLD2'), JSON.stringify(بعد));
check('والأحدث في الأول', بعد[0]==='TODAY1', JSON.stringify(بعد));
check('ذاكرة النسخة القديمة اتحدّثت كمان',
  (await A.evaluate(()=>state.orders.map(o=>o.id))).includes('TODAY1'),
  JSON.stringify(await A.evaluate(()=>state.orders.map(o=>o.id))));

// ═══ ٢) الحذف المقصود مايرجعش ═══
await reset();
const حذف = await A.evaluate(()=>{
  window.confirm=()=>true; window.toast=()=>{};
  const btn=document.createElement('button');
  btn.dataset.act='ord-del'; btn.dataset.id='OLD2';
  document.body.appendChild(btn); btn.click(); btn.remove();
  return state.orders.map(o=>o.id);
});
check('الحذف شال الطلب من الذاكرة', !حذف.includes('OLD2'), JSON.stringify(حذف));
await B.evaluate(()=>saveOrders_(state.orders));      // B لسه شايفه في ذاكرته
const بعد_الحذف = await ids(B);
check('الطلب المحذوف عن قصد ما رجعش بالدمج', !بعد_الحذف.includes('OLD2'), JSON.stringify(بعد_الحذف));
check('والباقي لسه موجود', بعد_الحذف.includes('OLD1'), JSON.stringify(بعد_الحذف));

// ═══ ٣) الطلب اللي اتلغى بالتعديل مايرجعش ═══
await reset();
await A.evaluate(async()=>{
  window.toast=()=>{}; window.shareOrderImage=()=>{};
  window.jsonp=()=>Promise.resolve({ok:true, displayNo:1, editCount:1});
  state.cart=[{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.profile={name:'محمد',phone:'01012345678',region:'طنطا'};
  state.customer={name:'ورشة',phone:''}; state.orderNote='';
  state.editingId='OLD1'; state.editingDate=isoLocal_();
  state.editingDisplayNo=1; state.editingEditCount=0; state.editingMeta=null;
  submitOrder();
  await new Promise(r=>setTimeout(r,600));
});
await B.evaluate(()=>saveOrders_(state.orders));      // B لسه شايف OLD1
const بعد_التعديل = await ids(B);
check('الطلب اللي اتلغى بالتعديل ما رجعش', !بعد_التعديل.includes('OLD1'), JSON.stringify(بعد_التعديل));
check('والطلب المعدّل الجديد موجود', بعد_التعديل.length>0 && بعد_التعديل.some(id=>/^W\d/.test(id)),
  JSON.stringify(بعد_التعديل));

// ═══ ٤) الحد الأقصى ٨٠ طلب لسه شغّال بعد الدمج ═══
await A.evaluate(()=>{
  localStorage.removeItem('wpc_deleted_ids'); localStorage.removeItem('wpc_orders');
  state.orders = Array.from({length:79},(_,i)=>({id:'X'+i, ts:1000-i, items:[]}));
  saveOrders_(state.orders);
});
await B.evaluate(()=>{
  state.orders = Array.from({length:10},(_,i)=>({id:'Y'+i, ts:2000-i, items:[]}));
  saveOrders_(state.orders);
});
const حد = await ids(B);
check('الدمج مابيعديش حد الـ٨٠ طلب', حد.length===80, String(حد.length));
check('والأحدث هو اللي بيفضل', حد[0]==='Y0', حد.slice(0,3).join(','));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
