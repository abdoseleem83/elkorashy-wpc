// التطبيق: المعاينة لازم تجيب أصناف كل طلبات العميل في نداء واحد،
// وتفضل شغّالة لو السيرفر لسه القديم (مابيعرفش ids).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const تجهيز = (وضع) => pg.evaluate((وضع)=>{
  window.toast=()=>{};
  window.__نداءات = [];
  state.admin.open=true; state.admin.pw='x'; state.tab='admin'; state.admin.items={};
  state.admin.rows = Array.from({length:7},(_,i)=>({id:'W'+i, displayNo:i+1, date:'2026-09-01',
    customer:'ورشة النور', dist:'د', phone:'01', region:'ر', status:'New', qty:5, total:500}));
  window.jsonp = async (url)=>{
    window.__نداءات.push(url);
    const m = /[?&]ids=([^&]*)/.exec(url);
    if(m){
      if(وضع === 'سيرفر_قديم') return { ok:true };          // مايعرفش ids
      const ids = decodeURIComponent(m[1]).split(',');
      const itemsById = {};
      ids.forEach(id => itemsById[id] = [{type:'Door',title:'باب '+id,code:'A01',size:'90 cm',unit:'door',qty:2,unitPrice:100,produced:0}]);
      return { ok:true, itemsById };
    }
    const one = /[?&]id=([^&]*)/.exec(url);
    return { ok:true, items:[{type:'Door',title:'باب '+decodeURIComponent(one[1]),code:'A01',size:'90 cm',unit:'door',qty:2,unitPrice:100,produced:0}] };
  };
}, وضع);

// ١) الوضع العادي: نداء واحد لكل الطلبات
await تجهيز('جديد');
await pg.evaluate(()=>previewCustomerOrder_('ورشة النور'));
await pg.waitForTimeout(900);
{
  const r = await pg.evaluate(()=>({
    نداءات: window.__نداءات.length,
    فيه_ids: window.__نداءات.filter(u=>/[?&]ids=/.test(u)).length,
    محمّل: Object.keys(state.admin.items).length,
    معاينة: !!document.getElementById('reportPreviewOverlay')
  }));
  check('نداء واحد بس لسبع طلبات', r.نداءات===1, 'نداءات='+r.نداءات);
  check('وبيستعمل ids', r.فيه_ids===1);
  check('وأصناف كل الطلبات اتحمّلت', r.محمّل===7, 'محمّل='+r.محمّل);
  check('والمعاينة فتحت', r.معاينة);
  await pg.evaluate(()=>closeReportPreview_());
}

// ٢) سيرفر قديم مايعرفش ids: لازم يرجع للنداء لكل طلب بدل ما المعاينة تطلع فاضية
await تجهيز('سيرفر_قديم');
await pg.evaluate(()=>previewCustomerOrder_('ورشة النور'));
await pg.waitForTimeout(1500);
{
  const r = await pg.evaluate(()=>({
    محمّل: Object.keys(state.admin.items).length,
    نداءات: window.__نداءات.length,
    معاينة: !!document.getElementById('reportPreviewOverlay')
  }));
  check('سيرفر قديم: بيرجع لنداء لكل طلب', r.محمّل===7, 'محمّل='+r.محمّل);
  check('والمعاينة فتحت برضه', r.معاينة, 'نداءات='+r.نداءات);
  await pg.evaluate(()=>closeReportPreview_());
}

// ٣) الأصناف المحمّلة خلاص مابتتجابش تاني
await تجهيز('جديد');
await pg.evaluate(()=>{ state.admin.items['W0']=[{type:'Door',title:'قديم',qty:1}]; window.__نداءات=[]; });
await pg.evaluate(()=>loadOrderItemsMany_(['W0']));
await pg.waitForTimeout(300);
{
  const r = await pg.evaluate(()=>({ نداءات: window.__نداءات.length, عنوان: state.admin.items['W0'][0].title }));
  check('المحمّل قبل كده مابيتجابش تاني', r.نداءات===0 && r.عنوان==='قديم', JSON.stringify(r));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
