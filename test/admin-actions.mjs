// خمس عمليات في شاشة المصنع (الكمية / الجاهز / الحذف / الإتاحة / بيانات الطلب)
// كانوا بيكرروا نفس الهيكل حرف بحرف — علامة «مشغول»، النداء، فحص الرد، الرسالة،
// معالجة الخطأ، التصفير، إعادة الرسم. الاختبار ده بيتأكد إن التوحيد ما غيّرش
// سلوك أي واحدة فيهم، وأهم حاجة: إن «مشغول» بتتصفّر حتى لما السيرفر يفشل —
// لأن نسيانها معناها إن الصف يفضل معطّل والمصنع مايقدرش يكمّل شغل.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const prep = () => pg.evaluate(()=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows = [{id:'A1', displayNo:1, customer:'ع1', date:'2026-09-01', qty:5, rods:0, total:500}];
  state.admin.archRows = [{id:'ARC1', displayNo:9, customer:'ع9', date:'2026-08-01', qty:1, rods:0, total:100}];
  state.admin.items = { A1:[{type:'Door',title:'باب',code:'A01',size:'70 cm',unit:'door',qty:5,unitPrice:100,produced:1,avail:true}] };
  state.admin.qtyEdit = {'A1:0':'3'}; state.admin.prodEdit = {'A1:0':'2'}; state.admin.metaEdit = {A1:{}};
  ['prodBusy','qtyBusy','itemBusy','itemDelBusy','metaBusy'].forEach(k=>state.admin[k]=null);
});

// ═══ المسار الناجح ═══
console.log('── لما السيرفر يرد صح ──');
const okCases = [
  ['الكمية',        "setItemQty_('A1',0,3)",      {ok:true, qty:3, produced:1, totals:{qty:3, rods:0, total:300}}],
  ['الجاهز',        "setItemProduced('A1',0,2)",  {ok:true, produced:2}],
  ['الإتاحة',       "setItemAvail('A1',0,false)", {ok:true}],
  ['بيانات الطلب',  "saveOrderMeta_('A1','ورشة جديدة','2026-09-05')", {ok:true, customer:'ورشة جديدة', date:'2026-09-05'}],
  ['حذف الصنف',     "deleteOrderItem_('A1',0)",   {ok:true, totals:{qty:0, rods:0, total:0}}],
];
for(const [label, call, reply] of okCases){
  await prep();
  const r = await pg.evaluate(async({call, reply})=>{
    const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
    let sent=null;
    window.jsonp=(u)=>{ sent=decodeURIComponent(String(u)); return Promise.resolve(reply); };
    await eval(call);
    window.toast=old;
    const busy = ['prodBusy','qtyBusy','itemBusy','itemDelBusy','metaBusy'].map(k=>state.admin[k]);
    return { sent, msgs, busy,
      صنف: (state.admin.items.A1||[])[0] || null,
      صف: state.admin.rows[0] };
  }, {call, reply});
  check(`${label}: اتبعت للسيرفر بكلمة السر`, /pw=x/.test(String(r.sent)), String(r.sent).slice(0,50));
  check(`${label}: رسالة نجاح مفيهاش كلمة تعذّر`,
    r.msgs.length===1 && !/تعذّر/.test(r.msgs[0]), JSON.stringify(r.msgs));
  check(`${label}: علامة «مشغول» اتصفّرت`, r.busy.every(v=>v===null), JSON.stringify(r.busy));
}

// النتائج المطبَّقة على الحالة
await prep();
const applied = await pg.evaluate(async()=>{
  window.toast=()=>{};
  window.jsonp=()=>Promise.resolve({ok:true, qty:3, produced:1, totals:{qty:3,rods:0,total:300}});
  await setItemQty_('A1',0,3);
  const بعد_الكمية = { qty: state.admin.items.A1[0].qty, إجمالي: state.admin.rows[0].total,
                        مسوّدة: state.admin.qtyEdit['A1:0'] };
  window.jsonp=()=>Promise.resolve({ok:true, customer:'ورشة جديدة', date:'2026-09-05'});
  await saveOrderMeta_('A1','ورشة جديدة','2026-09-05');
  const بعد_البيانات = { عميل: state.admin.rows[0].customer, تاريخ: state.admin.rows[0].date,
                          مسوّدة: state.admin.metaEdit['A1'] };
  return { بعد_الكمية, بعد_البيانات };
});
check('الكمية اتحدّثت والإجمالي معاها والمسوّدة اتمسحت',
  applied.بعد_الكمية.qty===3 && applied.بعد_الكمية.إجمالي===300 && applied.بعد_الكمية.مسوّدة===undefined,
  JSON.stringify(applied.بعد_الكمية));
check('بيانات الطلب اتحدّثت والمسوّدة اتمسحت',
  applied.بعد_البيانات.عميل==='ورشة جديدة' && applied.بعد_البيانات.تاريخ==='2026-09-05'
  && applied.بعد_البيانات.مسوّدة===undefined, JSON.stringify(applied.بعد_البيانات));

// ═══ المسار الفاشل — دي الحتة المهمة ═══
console.log('\n── لما السيرفر يفشل ──');
for(const [label, call] of okCases.map(c=>[c[0], c[1]])){
  await prep();
  const r = await pg.evaluate(async({call})=>{
    const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
    window.jsonp=()=>Promise.reject(new Error('النت قطع'));
    await eval(call);
    window.toast=old;
    return { msgs, busy: ['prodBusy','qtyBusy','itemBusy','itemDelBusy','metaBusy'].map(k=>state.admin[k]) };
  }, {call});
  check(`${label}: علامة «مشغول» اتصفّرت رغم الفشل`, r.busy.every(v=>v===null), JSON.stringify(r.busy));
  check(`${label}: المصنع شاف رسالة خطأ فيها السبب`,
    r.msgs.length===1 && /تعذّر/.test(r.msgs[0]) && /النت قطع/.test(r.msgs[0]), JSON.stringify(r.msgs));
}

// رد فيه ok:false ورسالة من السيرفر
await prep();
const r2 = await pg.evaluate(async()=>{
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  window.jsonp=()=>Promise.resolve({ok:false, error:'الطلب مش موجود'});
  await deleteOrderItem_('A1',0);
  window.toast=old;
  return { msgs, busy:state.admin.itemDelBusy, لسه_موجود:(state.admin.items.A1||[]).length };
});
check('رد ok:false بيوصّل رسالة السيرفر للمصنع',
  /الطلب مش موجود/.test(String(r2.msgs[0])), JSON.stringify(r2.msgs));
check('والصنف ما اتحذفش من الشاشة لأن الحذف فشل', r2.لسه_موجود===1, String(r2.لسه_موجود));
check('و«مشغول» اتصفّرت', r2.busy===null, String(r2.busy));

// ═══ تحميل أصناف الطلب: الفرق بين «فاضي» و«ما قدرناش نجيبه» ═══
console.log('\n── تحميل الأصناف ──');
const load = (reply) => pg.evaluate(async({reply})=>{
  state.admin.open=true; state.admin.pw='x'; state.admin.items={};
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  window.jsonp = () => reply==='fail' ? Promise.reject(new Error('النت قطع')) : Promise.resolve(reply);
  const done = await withOrderItems_({id:'Z1'}, ()=>{});
  window.toast=old;
  return { msgs, done, انتظار: document.getElementById('busy').classList.contains('on') };
}, {reply});

const l1 = await load('fail');
check('النت قطع: الرسالة بتقول السبب الحقيقي',
  /تعذّر تحميل/.test(String(l1.msgs[0])) && /النت قطع/.test(String(l1.msgs[0])), JSON.stringify(l1.msgs));
check('النت قطع: الشغل ما اتنفّذش', l1.done===false, String(l1.done));

const l2 = await load({ok:true, items:[]});
check('الطلب فاضي فعلاً: رسالة مختلفة',
  /مفيش أصناف/.test(String(l2.msgs[0])) && !/تعذّر/.test(String(l2.msgs[0])), JSON.stringify(l2.msgs));

const l3 = await pg.evaluate(async()=>{
  state.admin.items={}; window.toast=()=>{};
  window.jsonp = () => Promise.resolve({ok:true, items:[{type:'Door',title:'باب',qty:1}]});
  let got=null;
  const done = await withOrderItems_({id:'Z2'}, its=>{ got=its.length; });
  return { done, got };
});
check('فيه أصناف: الشغل اتنفّذ عليها', l3.done===true && l3.got===1, JSON.stringify(l3));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
