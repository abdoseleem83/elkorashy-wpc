// المعاينة بتجيب أصناف الطلبات اللي لسه ماتحمّلتش. الاختبار بيتأكد إن النداءات
// بتمشي على دفعات من 4 (مش كلها مرة واحدة — عميل عنده 15 طلب كان هيبعت 15 نداء
// لـ Apps Script في نفس اللحظة)، وإن فشل طلب واحد مابيمنعش المعاينة من الفتح بالباقي.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ١٥ طلب لنفس العميل، مفيش أصناف محمّلة — لازم يتجابوا على دفعات من ٤
const r = await pg.evaluate(async()=>{
  state.admin.open = true;
  state.admin.rows = Array.from({length:15},(_,i)=>({
    id:'2026-'+String(i).padStart(4,'0'), displayNo:i+1, editCount:0, date:'2026-09-04',
    dist:'محمد', phone:'01', region:'طنطا', status:'Received',
    customer:'ورشة النور', qty:2, total:1000}));
  state.tab='admin';
  // نراقب عدد النداءات المتوازية في نفس اللحظة
  let live=0, peak=0, total=0;
  window.jsonp = () => { live++; total++; peak=Math.max(peak,live);
    return new Promise(res=>setTimeout(()=>{ live--; res({ok:true, items:[
      {type:'Door',title:'باب A01',code:'A01',size:'70 cm',unit:'door',qty:2,unitPrice:5200,produced:0}]}); }, 60)); };
  await previewCustomerOrder_('ورشة النور');
  return {peak, total, فتحت: !!document.getElementById('reportPreviewOverlay')};
});
check('المعاينة فتحت', r.فتحت);
check('كل الطلبات اتجابت', r.total === 15, String(r.total));
check('أقصى نداءات متوازية = 4 (مش 15)', r.peak <= 4, String(r.peak));

// طلب أصنافه فشلت — المعاينة لازم تفضل تفتح بالباقي
await pg.evaluate(()=>{ closeReportPreview_(); state.admin.items = {}; });
const r2 = await pg.evaluate(async()=>{
  let n=0;
  window.jsonp = () => { n++;
    if(n===3) return Promise.reject(new Error('النت قطع'));
    return Promise.resolve({ok:true, items:[
      {type:'Door',title:'باب A01',code:'A01',size:'70 cm',unit:'door',qty:2,unitPrice:5200,produced:0}]}); };
  await previewCustomerOrder_('ورشة النور');
  return {فتحت: !!document.getElementById('reportPreviewOverlay'),
          عدد_الأوراق: (document.getElementById('reportPreviewOverlay')||{textContent:''})
            .textContent.match(/طلب أوردر/g)?.length || 0};
});
check('طلب واحد فشل ← المعاينة لسه بتفتح', r2.فتحت);
check('باقي الطلبات ظاهرة', r2.عدد_الأوراق >= 14, String(r2.عدد_الأوراق));
check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
