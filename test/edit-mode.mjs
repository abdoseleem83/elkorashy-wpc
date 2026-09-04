// الدخول في وضع تعديل الطلب من مسارين: الموزّع من «تابع طلبك»، والمصنع من شاشته.
// كل واحد كان بيظبّط نفس الحقول لوحده — ومسار الموزّع مكانش بيصفّر editingMeta.
// النتيجة: لو المصنع بدأ تعديل وساب الشاشة من غير إلغاء، الطلب اللي الموزّع
// يعدّله بعد كده كان بياخد بيانات صاحب الطلب اللي قبله.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) الحقول الخمسة كلها بتتظبط من المسارين
const r1 = await pg.evaluate(()=>{
  window.toast=()=>{};
  const o = {id:'X1', ts: new Date('2026-08-01T09:00:00').getTime(), displayNo:52, editCount:2, items:[]};
  // مسار الموزّع
  state.editingMeta = {name:'حد تاني', customer:'عميل تاني'};   // بقايا من تعديل قبله
  enterEditMode_(o);
  const موزّع = {id:state.editingId, no:state.editingDisplayNo, cnt:state.editingEditCount,
                  date:state.editingDate, meta:state.editingMeta};
  // مسار المصنع
  enterEditMode_({id:'X2', displayNo:7, editCount:0}, {
    date:'2026-07-15', meta:{name:'محمد', phone:'01012345678', region:'طنطا', customer:'ورشة', customerPhone:''}});
  const مصنع = {id:state.editingId, no:state.editingDisplayNo, cnt:state.editingEditCount,
                 date:state.editingDate, meta:state.editingMeta};
  return {موزّع, مصنع};
});
check('مسار الموزّع بيظبّط رقم الطلب وعدّاد التعديل',
  r1.موزّع.no===52 && r1.موزّع.cnt===2, `no=${r1.موزّع.no} cnt=${r1.موزّع.cnt}`);
check('وبياخد تاريخ الطلب الأصلي بالتوقيت المحلي',
  r1.موزّع.date==='2026-08-01', r1.موزّع.date);
check('وبيصفّر بيانات صاحب الطلب — مابيرثش اللي قبله',
  r1.موزّع.meta===null, JSON.stringify(r1.موزّع.meta));
check('مسار المصنع بيحتفظ ببيانات صاحب الطلب',
  r1.مصنع.meta && r1.مصنع.meta.name==='محمد', JSON.stringify(r1.مصنع.meta));
check('وبياخد التاريخ اللي اتبعتله', r1.مصنع.date==='2026-07-15', r1.مصنع.date);

// ٢) الأثر الحقيقي: الطلب الجديد بياخد بيانات الموزّع مش بيانات اللي قبله
const r2 = await pg.evaluate(()=>{
  window.toast=()=>{};
  state.profile = {name:'أحمد الموزّع', phone:'01099998888', region:'المنصورة'};
  state.customer = {name:'ورشة أحمد', phone:''};
  state.cart = [{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  // المصنع بدأ تعديل وساب الشاشة من غير إلغاء
  state.editingMeta = {name:'خالد', phone:'01011112222', region:'طنطا', customer:'ورشة خالد', customerPhone:''};
  // الموزّع بيعدّل طلبه هو
  enterEditMode_({id:'MINE', ts:Date.now(), displayNo:3, editCount:0, items:[]});
  const d = draftOrder();
  return {name:d.name, phone:d.phone, region:d.region, customer:d.customer};
});
check('الطلب اتنسب للموزّع صاحبه', r2.name==='أحمد الموزّع', r2.name);
check('بموبايله هو', r2.phone==='01099998888', r2.phone);
check('ومنطقته هو', r2.region==='المنصورة', r2.region);
check('وصاحب الأوردر بتاعه هو', r2.customer==='ورشة أحمد', r2.customer);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
