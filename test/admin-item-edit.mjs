// تعديل كمية الصنف والكمية الجاهزة من شاشة المصنع.
// كان فيه فحص مكتوب بس عمره ما بيشتغل: Math.max(1, …) قبل الفحص، فالصفر
// كان بيتحوّل ١ في صمت. والكمية الجاهزة مكانش عليها فحص أصلاً على الشاشة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// بيشغّل زرار الحفظ بقيمة معيّنة ويرجّع: اتبعت للسيرفر ولا لأ، وبأي قيمة، وإيه الرسالة
const run = (act, field, value) => pg.evaluate(({act, field, value})=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.items['A1']=[{type:'Door',title:'باب',code:'A01',size:'70 cm',unit:'door',
    qty:5, unitPrice:100, produced:1}];
  state.admin[field]={'A1:0': value};
  const msgs=[]; const oldToast=window.toast; window.toast=m=>msgs.push(m);
  let sent=null;
  window.jsonp=(u)=>{ sent=decodeURIComponent(String(u)); return Promise.resolve({ok:true, produced:0, totals:null}); };
  const el={dataset:{act, id:'A1', idx:'0'}};
  document.body.dispatchEvent(Object.assign(new CustomEvent('x'),{}));
  // ننده المعالج زي ما الضغطة بتعمل بالظبط
  const btn=document.createElement('button');
  btn.dataset.act=act; btn.dataset.id='A1'; btn.dataset.idx='0';
  document.body.appendChild(btn); btn.click(); btn.remove();
  window.toast=oldToast;
  return { اتبعت: sent, الرسائل: msgs };
}, {act, field, value});

// ── كمية الصنف ──
const q0 = await run('adm-qty-save','qtyEdit','0');
check('كمية صفر بترفض ومابتتبعتش', q0.اتبعت===null && q0.الرسائل.some(m=>/أكبر من صفر/.test(m)),
  JSON.stringify(q0.الرسائل));
const qx = await run('adm-qty-save','qtyEdit','كلام');
check('كمية بحروف بترفض', qx.اتبعت===null, String(qx.اتبعت).slice(0,60));
const qn = await run('adm-qty-save','qtyEdit','-3');
check('كمية بالسالب بترفض', qn.اتبعت===null, String(qn.اتبعت).slice(0,60));
const q7 = await run('adm-qty-save','qtyEdit','7');
check('كمية صحيحة بتتبعت', /qty=7/.test(String(q7.اتبعت)), String(q7.اتبعت).slice(-40));
const qa = await run('adm-qty-save','qtyEdit','٧');
check('كمية بأرقام عربية بتتقبل', /qty=7/.test(String(qa.اتبعت)), String(qa.اتبعت).slice(-40));

// ── الكمية الجاهزة ──
const p9 = await run('adm-prod-save','prodEdit','9');
check('جاهز أكتر من المطلوب بيترفض مع رسالة',
  p9.اتبعت===null && p9.الرسائل.some(m=>/مايزيدش/.test(m)), JSON.stringify(p9.الرسائل));
const p3 = await run('adm-prod-save','prodEdit','3');
check('جاهز جوّه الحد بيتبعت', /produced=3/.test(String(p3.اتبعت)), String(p3.اتبعت).slice(-40));
const p0 = await run('adm-prod-save','prodEdit','0');
check('جاهز صفر مسموح (إلغاء الإنتاج)', /produced=0/.test(String(p0.اتبعت)), String(p0.اتبعت).slice(-40));
const px = await run('adm-prod-save','prodEdit','');
check('جاهز فاضي بيترفض', px.اتبعت===null, String(px.اتبعت).slice(0,60));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
