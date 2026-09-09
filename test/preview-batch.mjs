// المعاينة بتجيب أصناف الطلبات اللي لسه ماتحمّلتش.
// قبل كده كانت بتبعت نداء لكل طلب (على دفعات من ٤). Apps Script بينفّذ نداءات
// نفس المستخدم واحد ورا التاني، فعميل عنده ١٥ طلب = ١٥ انتظار ورا بعض.
// دلوقتي: نداء واحد بكل المعرّفات (على دفعات كبيرة عشان الرابط ما يطولش).
// والاختبار كمان بيتأكد إن فشل نداء مابيمنعش المعاينة من الفتح بالباقي.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const تجهيز = () => pg.evaluate(()=>{
  state.admin.open = true; state.tab='admin'; state.admin.items = {};
  state.admin.rows = Array.from({length:15},(_,i)=>({
    id:'2026-'+String(i).padStart(4,'0'), displayNo:i+1, editCount:0, date:'2026-09-04',
    dist:'محمد', phone:'01', region:'طنطا', status:'Received',
    customer:'ورشة النور', qty:2, total:1000}));
});

// ١) ١٥ طلب = نداءات قليلة جدًا، ومفيش نداءين في نفس اللحظة
await تجهيز();
const r = await pg.evaluate(async()=>{
  let live=0, peak=0, total=0;
  window.jsonp = (url) => { live++; total++; peak=Math.max(peak,live);
    const ids = decodeURIComponent((/[?&]ids=([^&]*)/.exec(url)||[])[1]||'').split(',').filter(Boolean);
    return new Promise(res=>setTimeout(()=>{ live--;
      const itemsById={}; ids.forEach(id=>itemsById[id]=[{type:'Door',title:'باب '+id,code:'A01',size:'70 cm',unit:'door',qty:2,unitPrice:5200,produced:0}]);
      res({ok:true, itemsById}); }, 40)); };
  await previewCustomerOrder_('ورشة النور');
  return {peak, total, محمّل:Object.keys(state.admin.items).length,
          فتحت: !!document.getElementById('reportPreviewOverlay')};
});
check('المعاينة فتحت', r.فتحت);
check('أصناف كل الطلبات اتحمّلت', r.محمّل === 15, String(r.محمّل));
check('نداءات قليلة بدل ١٥', r.total <= 2, 'نداءات='+r.total);
check('ومفيش نداءين في نفس اللحظة', r.peak === 1, 'أقصى تزامن='+r.peak);

// ٢) النداء المجمّع فشل → بنرجع لنداء لكل طلب، والمعاينة تفضل تفتح
await pg.evaluate(()=>closeReportPreview_());
await تجهيز();
const r2 = await pg.evaluate(async()=>{
  window.jsonp = (url) => {
    if(/[?&]ids=/.test(url)) return Promise.reject(new Error('النت قطع'));   // المجمّع بيفشل
    const one = decodeURIComponent((/[?&]id=([^&]*)/.exec(url)||[])[1]||'');
    if(one.endsWith('0002')) return Promise.reject(new Error('الطلب ده فشل'));
    return Promise.resolve({ok:true, items:[{type:'Door',title:'باب '+one,code:'A01',size:'70 cm',unit:'door',qty:2,unitPrice:5200,produced:0}]});
  };
  await previewCustomerOrder_('ورشة النور');
  const ov = document.getElementById('reportPreviewOverlay');
  return {فتحت: !!ov, محمّل:Object.keys(state.admin.items).length,
          عدد_الأوراق: (ov ? ov.textContent.match(/طلب أوردر/g)||[] : []).length};
});
check('فشل النداء المجمّع ← بيرجع لنداء لكل طلب', r2.محمّل === 14, 'محمّل='+r2.محمّل);
check('والمعاينة لسه بتفتح', r2.فتحت);
check('وباقي الطلبات ظاهرة', r2.عدد_الأوراق >= 14, String(r2.عدد_الأوراق));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
