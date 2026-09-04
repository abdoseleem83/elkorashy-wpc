// الأسعار كانت متخزّنة في متصفح المصنع بس. يعني لما المصنع يعدّل سعر، الموزّعين
// كلهم يفضلوا شايفين السعر القديم المكتوب جوّه التطبيق لحد ما تترفع نسخة جديدة.
// دلوقتي الشيت هو المصدر الواحد: المصنع بيكتب فيه، وكل الأجهزة بتقرا منه.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ═══ الباك إند ═══
console.log('── الباك إند ──');
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
check('فيه شيت للأسعار', /var SHEET_PRICES = 'Prices'/.test(gs));
check('القراية مفتوحة من غير كلمة سر',
  /if \(action === 'prices'\)[\s\S]{0,400}?reply\(\{ ok: true, prices/.test(gs));
const setBlock = /if \(action === 'setPrices'\)[\s\S]*?\n    \}/.exec(gs)[0];
check('الكتابة بكلمة سر المصنع بس', /checkAdminPw_\(e\.parameter\.pw/.test(setBlock));
check('بيتأكد إن الشكل JSON صالح قبل ما يكتب', /JSON\.parse\(payloadPR\)/.test(setBlock));
check('بيرفض أي حاجة مش كائن (فمفيش معادلة تتكتب في الخانة)',
  /payloadPR\.charAt\(0\) !== '\{'/.test(setBlock));
check('الكتابة جوّه قفل', /LockService\.getScriptLock/.test(setBlock) && /releaseLock/.test(setBlock));

// ═══ الواجهة ═══
console.log('\n── الواجهة ──');
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) موزّع بيفتح التطبيق → بياخد أسعار المصنع من السيرفر
const r1 = await pg.evaluate(async()=>{
  localStorage.removeItem('wpc_prices'); localStorage.removeItem('wpc_prices_dirty');
  const w = SIZES[0].w;
  const before = SIZES[0].price;
  window.jsonp = () => Promise.resolve({ok:true, at:'2026-09-04',
    prices:{ dist:{ sizes:{ [w]: before + 555 } } }});
  await syncPricesFromServer_();
  return { قبل: before, بعد: SIZES[0].price, متخزّن: !!localStorage.getItem('wpc_prices') };
});
check('السعر الجديد من السيرفر بقى شغّال على جهاز الموزّع',
  r1.بعد === r1.قبل + 555, `${r1.قبل} → ${r1.بعد}`);
check('واتخزّن على الجهاز عشان يشتغل أوفلاين', r1.متخزّن);

// ٢) مفيش نت → بيكمّل بآخر أسعار محفوظة، مش بيرجع للمكتوب في التطبيق
const r2 = await pg.evaluate(async()=>{
  const kept = SIZES[0].price;
  window.jsonp = () => Promise.reject(new Error('offline'));
  await syncPricesFromServer_();
  return { لسه: SIZES[0].price, كان: kept };
});
check('من غير نت الأسعار المحفوظة بتفضل', r2.لسه === r2.كان, `${r2.كان} → ${r2.لسه}`);

// ٣) المصنع بيحفظ → بتترفع للسيرفر بكلمة السر
const r3 = await pg.evaluate(async()=>{
  state.admin.pw='secret'; state.admin.open=true;
  localStorage.removeItem('wpc_prices_dirty');
  let sent=null; window.toast=()=>{};
  window.jsonp = (u)=>{ sent=decodeURIComponent(String(u)); return Promise.resolve({ok:true}); };
  openAdminPrices();
  state.admin.priceEdit.sizes[SIZES[0].w].dist = 9999;
  saveAdminPrices();
  await new Promise(r=>setTimeout(r,300));
  return { اتبعت: sent, دِرتي: JSON.parse(localStorage.getItem('wpc_prices_dirty')||'false') };
});
check('الحفظ بيرفع الأسعار للسيرفر', /action=setPrices/.test(String(r3.اتبعت)));
check('وبيبعت كلمة السر', /pw=secret/.test(String(r3.اتبعت)));
check('والسعر الجديد جوّه اللي اتبعت', /9999/.test(String(r3.اتبعت)));
check('مفيش علامة "لسه ما اترفعش" بعد النجاح', r3.دِرتي === false, String(r3.دِرتي));

// ٤) الرفع فشل → علامة، والقراية مابتمسحش تعديل المصنع
const r4 = await pg.evaluate(async()=>{
  state.admin.pw='secret';
  window.toast=()=>{};
  window.jsonp = ()=>Promise.reject(new Error('offline'));
  openAdminPrices();
  state.admin.priceEdit.sizes[SIZES[0].w].dist = 4321;
  saveAdminPrices();
  await new Promise(r=>setTimeout(r,300));
  const dirty = JSON.parse(localStorage.getItem('wpc_prices_dirty')||'false');
  // دلوقتي السيرفر رجع، بس بأسعار قديمة — لازم مايمسحش تعديل المصنع
  let asked = [];
  window.jsonp = (u)=>{ const s=String(u); asked.push(s.includes('setPrices')?'push':'pull');
    return s.includes('setPrices') ? Promise.reject(new Error('offline'))
                                   : Promise.resolve({ok:true, prices:{dist:{sizes:{[SIZES[0].w]: 1}}}}); };
  await syncPricesFromServer_();
  return { دِرتي: dirty, السعر: SIZES[0].price, النداءات: asked };
});
check('الرفع اللي فشل بيتعلّم عليه', r4.دِرتي === true, String(r4.دِرتي));
check('القراية ما مسحتش تعديل المصنع اللي لسه ما اترفعش',
  r4.السعر === 4321, String(r4.السعر));
check('بتحاول ترفع الأول قبل ما تقرا', r4.النداءات[0]==='push' && !r4.النداءات.includes('pull'),
  JSON.stringify(r4.النداءات));

// ٥) أول ما النت يرجع، الرفع بينجح والعلامة بتتشال
const r5 = await pg.evaluate(async()=>{
  window.toast=()=>{};
  window.jsonp = (u)=> String(u).includes('setPrices')
    ? Promise.resolve({ok:true})
    : Promise.resolve({ok:true, prices:{dist:{sizes:{[SIZES[0].w]: 4321}}}});
  await syncPricesFromServer_();
  return { دِرتي: JSON.parse(localStorage.getItem('wpc_prices_dirty')||'false'), السعر: SIZES[0].price };
});
check('أول ما النت يرجع الأسعار بتترفع', r5.دِرتي === false, String(r5.دِرتي));
check('والسعر فضل زي ما المصنع حطه', r5.السعر === 4321, String(r5.السعر));

// ٦) موزّع عادي (مش المصنع) مايرفعش أسعار
const r6 = await pg.evaluate(async()=>{
  state.admin.pw=''; state.admin.open=false;
  let sent=null; window.jsonp=(u)=>{ sent=String(u); return Promise.resolve({ok:true}); };
  const ok = await pushPricesToServer_({dist:{}}, true);
  return { اتبعت: sent, رجّع: ok };
});
check('الموزّع العادي مايقدرش يرفع أسعار', r6.اتبعت===null && r6.رجّع===false, String(r6.اتبعت));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
