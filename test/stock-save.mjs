// حفظ أرصدة المخزن: المصنع بيكتب أرقام كتير ويضغط حفظ، وكل رصيد بيتبعت لوحده.
// الخطر: لو واحد فشل، الأرقام كلها كانت بتتمسح والشاشة ترجع من السيرفر —
// فالرقم اللي فشل بيختفي من غير ما حد يعرف أنهي صنف.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const setup = async () => pg.evaluate(()=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin'; state.admin.viewStock=true;
  const c1 = DOORS[0].code, c2 = DOORS[1].code, w = SIZES[0].w;
  state.stock.rows = [{code:c1,size:String(w),qty:10},{code:c2,size:String(w),qty:20}];
  state.stock.at = Date.now();
  state.admin.stockDraft = { [c1+'|'+w]: '11', [c2+'|'+w]: '22' };
  return {c1, c2, w};
});

// ١) واحد نجح وواحد فشل
const ids = await setup();
const r1 = await pg.evaluate(async({c1,c2,w})=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  window.jsonp = (u) => Promise.resolve(
    decodeURIComponent(String(u)).includes('code='+c2) ? {ok:false, error:'x'} : {ok:true});
  await saveStockDrafts();
  window.toast = old;
  return { المسوّدات: state.admin.stockDraft, الرسالة: msgs.join(' | ') };
}, ids);
check('الرقم اللي فشل فضل مكتوب على الشاشة',
  r1.المسوّدات[ids.c2+'|'+ids.w]==='22', JSON.stringify(r1.المسوّدات));
check('الرقم اللي نجح اتشال من المسوّدات',
  r1.المسوّدات[ids.c1+'|'+ids.w]===undefined, JSON.stringify(r1.المسوّدات));
check('الرسالة بتقول أنهي صنف فشل', r1.الرسالة.includes(ids.c2), r1.الرسالة);

// ٢) كلهم نجحوا — المسوّدات تتفضّى
await setup();
const r2 = await pg.evaluate(async()=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  window.jsonp = () => Promise.resolve({ok:true});
  await saveStockDrafts();
  window.toast = old;
  return { عدد: Object.keys(state.admin.stockDraft).length, الرسالة: msgs.join(' | ') };
});
check('لما الكل ينجح المسوّدات تتفضّى', r2.عدد===0, String(r2.عدد));
check('الرسالة مفيهاش كلمة فشل', !/فشل/.test(r2.الرسالة), r2.الرسالة);

// ٣) الكل فشل — مفيش رقم بيضيع
await setup();
const r3 = await pg.evaluate(async()=>{
  const old=window.toast; window.toast=()=>{};
  window.jsonp = () => Promise.resolve({ok:false});
  await saveStockDrafts();
  window.toast = old;
  return Object.keys(state.admin.stockDraft).length;
});
check('لما الكل يفشل الأرقام كلها تفضل', r3===2, String(r3));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
