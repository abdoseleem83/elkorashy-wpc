// الطلبات المعلّقة: طلب فشل يوصل المصنع بيتسجّل في قايمة ويتبعت تاني أول ما النت يرجع.
// الخطر: لو الموزع بعت طلب جديد وهو مستني الرد، الكتابة فوق القايمة كانت بتمسحه.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) طلب جديد فشل وسط إعادة المحاولة — لازم يفضل في القايمة
const r1 = await pg.evaluate(async()=>{
  const mk = id => ({id, ts:Date.now(), name:'م', phone:'01012345678', region:'ط',
    items:[{kind:'door',title:'باب',qty:1}], total:1});
  state.orders = [mk('OLD1'), mk('NEW1')];
  savePendingSync_(['OLD1']);
  window.jsonp = () => new Promise(res=>setTimeout(()=>res({ok:true, displayNo:1}), 200));
  const p = retryPendingOrders_();                 // بدأت، ومستنية الرد
  await new Promise(r=>setTimeout(r,60));
  // الموزع بعت طلب جديد وفشل وهي لسه شغالة
  const pend = loadPendingSync_(); pend.push('NEW1'); savePendingSync_(pend);
  await p;
  return { القايمة: loadPendingSync_() };
});
check('الطلب الجديد ما اتمسحش من قايمة المعلّق', r1.القايمة.includes('NEW1'), JSON.stringify(r1.القايمة));
check('الطلب القديم اللي وصل اتشال', !r1.القايمة.includes('OLD1'), JSON.stringify(r1.القايمة));

// ٢) اللي فشل بيفضل، واللي نجح بيتشال
const r2 = await pg.evaluate(async()=>{
  const mk = id => ({id, ts:Date.now(), name:'م', phone:'01012345678', region:'ط',
    items:[{kind:'door',title:'باب',qty:1}], total:1});
  state.orders = [mk('A'), mk('B')];
  savePendingSync_(['A','B']);
  window.jsonp = (u) => new Promise(res=>setTimeout(()=>res(
    decodeURIComponent(String(u)).includes('"id":"A"') ? {ok:false, error:'x'} : {ok:true, displayNo:2}), 60));
  await retryPendingOrders_();
  return loadPendingSync_();
});
check('اللي نجح اتشال واللي فشل فضل', JSON.stringify(r2)===JSON.stringify(['A']), JSON.stringify(r2));

// ٣) طلب اتمسح من الجهاز مايفضلش معلّق للأبد
const r3 = await pg.evaluate(async()=>{
  state.orders = [];
  savePendingSync_(['GHOST']);
  window.jsonp = () => Promise.resolve({ok:true});
  await retryPendingOrders_();
  return loadPendingSync_();
});
check('طلب مش موجود على الجهاز بيتشال من القايمة', r3.length===0, JSON.stringify(r3));

// ٤) الصفحة اتقفلت وسط الإرسال — الطلب لازم يفضل مسجّل معلّق
const r4 = await pg.evaluate(async()=>{
  const mk = id => ({id, ts:Date.now(), name:'م', phone:'01012345678', region:'ط',
    items:[{kind:'door',title:'باب',qty:1}], total:1});
  state.orders = [mk('MID1')];
  savePendingSync_([]);
  window.jsonp = () => new Promise(()=>{});          // الرد عمره ما بيجي (النت علّق / الصفحة اتقفلت)
  syncOrder_(state.orders[0]);                        // من غير await
  await new Promise(r=>setTimeout(r,150));
  return loadPendingSync_();                          // في اللحظة دي بالظبط
});
check('الطلب مسجّل معلّق وهو لسه بيتبعت', r4.includes('MID1'), JSON.stringify(r4));

// ٥) الإرسال نجح → بيتشال من المعلّق
const r5 = await pg.evaluate(async()=>{
  const mk = id => ({id, ts:Date.now(), name:'م', phone:'01012345678', region:'ط',
    items:[{kind:'door',title:'باب',qty:1}], total:1});
  state.orders = [mk('OK1')]; savePendingSync_([]);
  window.toast = ()=>{};
  window.jsonp = () => Promise.resolve({ok:true, displayNo:3});
  await syncOrder_(state.orders[0]);
  return loadPendingSync_();
});
check('لما يوصل بيتشال من المعلّق', r5.length===0, JSON.stringify(r5));

// ٦) إعادة المحاولة ما بتبعتش طلب لسه بيتبعت (مفيش نسخة مكررة عند المصنع)
const r6 = await pg.evaluate(async()=>{
  const mk = id => ({id, ts:Date.now(), name:'م', phone:'01012345678', region:'ط',
    items:[{kind:'door',title:'باب',qty:1}], total:1});
  state.orders = [mk('DUP1')]; savePendingSync_([]);
  window.toast = ()=>{};
  let sends = 0;
  window.jsonp = () => { sends++; return new Promise(res=>setTimeout(()=>res({ok:true, displayNo:4}), 300)); };
  const p = syncOrder_(state.orders[0]);
  await new Promise(r=>setTimeout(r,60));
  await retryPendingOrders_();                        // بتلاقيه في القايمة
  await p;
  return { مرات_الإرسال: sends, معلّق: loadPendingSync_() };
});
check('الطلب اتبعت مرة واحدة مش مرتين', r6.مرات_الإرسال===1, String(r6.مرات_الإرسال));
check('واتشال من المعلّق في الآخر', r6.معلّق.length===0, JSON.stringify(r6.معلّق));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
