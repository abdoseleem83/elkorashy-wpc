// «اخترت حلق لكن مش لاقي إرسال الطلب — هو لازم أكون مختار باب؟»
// لأ. الحلق بيتطلب لوحده، بس اللون (كود الباب) إجباري عشان المصنع يعرف
// يصنّعه بأنهي لون — وزرار الإضافة كان مكتوب عليه «اختر كود الباب أولاً»،
// وده بيتقرا كإن لازم تختار **باب**. الاختبار بيمشي الرحلة كاملة:
// حلق متر واحد من غير أي باب → السلة → زرار الإرسال.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ ١) القسم بيقول صريح إن مفيش لزوم لباب ═══
await pg.click('[data-act="sec"][data-s="frame"]');
await pg.waitForTimeout(250);
const شرح = await pg.evaluate(()=>{
  const t = document.querySelector('#view').textContent;
  return { مش_لازم: /مش لازم تختار باب/.test(t), لون: /اللون \(كود الباب\)/.test(t),
           متر: /حتة حلق متر/.test(t) };
});
check('القسم بيقول «مش لازم تختار باب»', شرح.مش_لازم===true);
check('والعنوان بقى «اللون (كود الباب)» مش «كود الباب»', شرح.لون===true);
check('وفيه شرح لحالة «حتة حلق متر بس»', شرح.متر===true);

// ═══ ٢) من غير لون: الزرار مقفول ونصّه بيقول لون مش باب ═══
const قبل = await pg.evaluate(()=>{
  state.fr.code=''; state.fr.kind='rods'; state.fr.rods='1'; state.fr.rodsCm='1'; state.fr.unit='m';
  renderNow();
  const btn = document.querySelector('[data-act="add-fr"]');
  return { معطّل: btn.disabled, نص: btn.textContent.trim() };
});
check('من غير لون الزرار معطّل', قبل.معطّل===true);
check('ونصّه بيطلب اللون، مش «كود الباب»',
  /اللون/.test(قبل.نص) && !/^اختر كود الباب/.test(قبل.نص), قبل.نص);

// ═══ ٣) حتة حلق متر واحد من غير أي باب في السلة ═══
const بعد = await pg.evaluate(()=>{
  state.cart = [];
  state.fr.code = DOORS[0].code;      // اللون بس
  state.fr.kind='rods'; state.fr.unit='m'; state.fr.rodsCm='1'; state.fr.rods='1';
  renderNow();
  const btn = document.querySelector('[data-act="add-fr"]');
  const نص = btn.textContent.trim(), معطّل = btn.disabled;
  const old=window.toast; window.toast=()=>{}; btn.click(); window.toast=old;
  const it = state.cart.find(x=>x.kind==='frame');
  return { نص, معطّل, أصناف: state.cart.length,
           أبواب: state.cart.filter(x=>x.kind==='door').length,
           rodCm: it && it.rodCm, qty: it && it.qty, price: it && it.price };
});
check('أول ما تختار اللون الزرار يفتح', بعد.معطّل===false, بعد.نص);
check('الإضافة اشتغلت من غير أي باب في السلة',
  بعد.أصناف===1 && بعد.أبواب===0, `أصناف=${بعد.أصناف} أبواب=${بعد.أبواب}`);
check('وطول العود متر واحد = ١٠٠ سم', بعد.rodCm===100, String(بعد.rodCm));
check('والعدد عود واحد', بعد.qty===1, String(بعد.qty));

// ═══ ٤) الشريط السفلي بيظهر وبيقول إنه للإرسال ═══
const شريط = await pg.evaluate(()=>{
  state.tab='new'; renderNow();
  const bar = document.getElementById('bar');
  const btn = bar.querySelector('[data-act="go-cart"]');
  return { ظاهر: !bar.hidden, نص: btn.textContent.trim(),
           عدد: document.getElementById('barCount').textContent.trim() };
});
check('شريط السلة بيظهر بعد الإضافة', شريط.ظاهر===true);
check('وبيقول إنه للمراجعة والإرسال', /إرسال/.test(شريط.نص), شريط.نص);
check('وبيعرض عدد الأصناف', /1 صنف/.test(شريط.عدد), شريط.عدد);

// ═══ ٥) زرار الإرسال نفسه موجود في السلة بطلب فيه حلق بس ═══
const سلة = await pg.evaluate(()=>{
  state.tab='cart'; renderNow();
  const btn = document.querySelector('[data-act="submit"]');
  return { موجود: !!btn, نص: btn ? btn.textContent.trim() : null,
           فيه_حلق: /حلق/.test(document.querySelector('#view').textContent) };
});
check('زرار إرسال الطلب موجود في السلة', سلة.موجود===true);
check('ونصّه واضح', /إرسال طلب الأوردر/.test(سلة.نص||''), سلة.نص);
check('والطلب فيه سطر الحلق', سلة.فيه_حلق===true);

// ═══ ٦) نفس الحكاية في البرور ═══
await pg.evaluate(()=>{ state.cart=[]; state.tab='new'; renderNow(); });
await pg.click('[data-act="sec"][data-s="bror"]');
await pg.waitForTimeout(250);
const برور = await pg.evaluate(()=>{
  const t = document.querySelector('#view').textContent;
  state.br.code=''; renderNow();
  const btn = document.querySelector('[data-act="add-br"]');
  return { مش_لازم: /مش لازم تختار باب/.test(t), نص: btn.textContent.trim() };
});
check('قسم البرور كمان بيقول «مش لازم تختار باب»', برور.مش_لازم===true);
check('وزرّاره بيطلب اللون', /اللون/.test(برور.نص), برور.نص);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
