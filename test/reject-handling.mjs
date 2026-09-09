// السيرفر بقى يقدر يرفض الطلب (شكل غلط، أو حد استخدام). الرفضين دول مختلفين:
//   • رفض مؤقت (حد استخدام / نت) → إعادة المحاولة هي الحل
//   • رفض دائم (شكل الطلب غلط)   → إعادة المحاولة عمرها ما هتنجح
// من غير التفرقة دي التطبيق بيقول «لسه ما وصلش، هنحاول تاني» ويفضل يحاول
// للأبد على طلب السيرفر رافضه — والموزّع مستني على الفاضي.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const طلب = () => ({ id:'W-TEST', displayNo:0, ts:Date.now(), phone:'01000000000',
  items:[{kind:'door', title:'باب', qty:1, unitPrice:100}] });

// كل حالة بكود طلب مستقل: الطلب اللي اترفض رفض دائم بيفضل متسجّل كده عن قصد،
// فلو استعملنا نفس الكود في الحالة اللي بعدها هيتشال غلط
const جرّب = (رد, كود) => pg.evaluate(async ([رد, كود])=>{
  window.__toasts = [];
  window.toast = m => window.__toasts.push(m);
  window.jsonp = () => Promise.resolve(رد);
  const o = { id:كود, displayNo:0, ts:Date.now(), phone:'01000000000',
    items:[{kind:'door', title:'باب', qty:1, unitPrice:100}] };
  state.orders = [o];
  localStorage.setItem('wpc_pending_sync', JSON.stringify([]));
  localStorage.setItem('wpc_sent_ids', JSON.stringify([]));
  const ok = await syncOrder_(o);
  return { ok, رسائل: window.__toasts, معلّق: loadPendingSync_() };
}, [رد, كود]);

// ١) رفض دائم: شكل الطلب غلط
{
  const r = await جرّب({ ok:false, error:'عدد الأصناف أكبر من المسموح', permanent:true }, 'W-PERM');
  check('الرفض الدائم مش بيتحسب نجاح', r.ok !== true, String(r.ok));
  check('والموزّع بيعرف إن المصنع رفض الطلب',
    r.رسائل.some(m=>/رفض/.test(m)), r.رسائل.join(' | '));
  check('والرسالة فيها السبب الحقيقي',
    r.رسائل.some(m=>/عدد الأصناف/.test(m)), r.رسائل.join(' | '));
  check('والطلب مابيفضلش في طابور إعادة المحاولة للأبد',
    r.معلّق.length===0, JSON.stringify(r.معلّق));
}

// ٢) رفض مؤقت: حد الاستخدام
{
  const r = await جرّب({ ok:false, error:'محاولات كتير في وقت قصير — استنى شوية وجرّب تاني' }, 'W-TEMP');
  check('الرفض المؤقت مش بيتحسب نجاح', r.ok !== true, String(r.ok));
  check('والرسالة بتقول السبب وإننا هنحاول تاني',
    r.رسائل.some(m=>/محاولات كتير/.test(m) && /هنحاول تاني/.test(m)), r.رسائل.join(' | '));
  check('والطلب فاضل في الطابور عشان يتبعت تاني',
    r.معلّق.length===1, JSON.stringify(r.معلّق));
}

// ٣) نجاح عادي
{
  const r = await جرّب({ ok:true, displayNo:77, editCount:0 }, 'W-OK');
  check('النجاح بيشيل الطلب من الطابور', r.ok===true && r.معلّق.length===0,
    'ok='+r.ok+' معلّق='+JSON.stringify(r.معلّق));
}

// ٤) طابور إعادة المحاولة مايعلّقش على طلب مرفوض رفض دائم
{
  const r = await pg.evaluate(async ()=>{
    window.__toasts = []; window.toast = m => window.__toasts.push(m);
    let نداءات = 0;
    window.jsonp = () => { نداءات++; return Promise.resolve({ ok:false, error:'كود الطلب مش صحيح', permanent:true }); };
    const o = { id:'W-BAD', displayNo:0, ts:Date.now(), phone:'01', items:[{kind:'door',qty:1}] };
    state.orders = [o];
    localStorage.setItem('wpc_sent_ids', JSON.stringify([]));
    localStorage.setItem('wpc_pending_sync', JSON.stringify(['W-BAD']));
    await retryPendingOrders_();
    const بعد_الأولى = loadPendingSync_().length;
    await retryPendingOrders_();          // محاولة تانية — المفروض مفيش نداء جديد
    return { بعد_الأولى, بعد_التانية: loadPendingSync_().length, نداءات,
             رسائل: window.__toasts };
  });
  check('الطلب المرفوض رفض دائم بيتشال من الطابور', r.بعد_الأولى===0, String(r.بعد_الأولى));
  check('ومابيتحاولش تاني بعد كده', r.نداءات===1, 'نداءات='+r.نداءات);
  check('والموزّع اتقاله السبب', r.رسائل.some(m=>/رفض/.test(m)), r.رسائل.join(' | '));
}

// ٥) الطلب المرفوض مايرجعش للطابور حتى لو نسخة تانية من التطبيق حفظت القايمة
{
  const r = await pg.evaluate(()=>{
    // نقلّد نسخة تانية بتحاول ترجّع الطلب المرفوض للطابور
    savePendingSync_(['W-PERM']);
    return loadPendingSync_();
  });
  check('الطلب المرفوض مايرجعش للطابور من نسخة تانية', !r.includes('W-PERM'), JSON.stringify(r));
}

// ٦) السيرفر بيعلّم الرفض الدائم فعلاً
{
  const fs = await import('node:fs');
  const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
  check('السيرفر بيعلّم أخطاء شكل الطلب بـ permanent',
    (gs.match(/permanent: true/g)||[]).length >= 2,
    (gs.match(/permanent: true/g)||[]).length + ' مكان');
  check('وحد الاستخدام مش معلّم permanent (عشان يتحاول تاني)',
    !/RATE_MSG_[^}]*permanent/.test(gs));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
