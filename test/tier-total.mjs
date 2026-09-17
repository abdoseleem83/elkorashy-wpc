// المصنع بيقدر يطبع نفس الطلب بمستويات سعر مختلفة (جملة / معرض / عميل).
// السطور بتتسعّر بالمستوى المختار، لكن الإجمالي كان بيتاخد من الشيت زي ما هو —
// وهو دايمًا إجمالي الجملة. يعني ورقة عرض السعر سطورها مابتجمعش على إجماليها.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  const o = { id:'T1', date:'2026-09-04', dist:'محمد', phone:'01012345678', region:'طنطا',
              customer:'ورشة النور', total: 1000 };   // إجمالي الجملة المتخزّن
  const its = [
    {type:'Door',  title:'باب', code:'A01', size:'70 cm', unit:'door', qty:2, unitPrice:300, produced:0},
    {type:'Frame', title:'حلق', code:'F10', size:'10 cm', unit:'set',  qty:1, unitPrice:400, produced:0}
  ];
  const out = {};
  ['dist','showroom'].forEach(tier=>{
    const doc = buildAdminDocOrder_(o, its, tier);
    const مجموع_السطور = doc.items.reduce((s,it)=>s + it.unitPrice * it.qty, 0);
    out[tier] = { الإجمالي: doc.total, مجموع_السطور,
                  الأسعار: doc.items.map(it=>it.unitPrice) };
  });
  // من غير مستوى خالص (الحالة الافتراضية)
  out.بدون = (()=>{ const d = buildAdminDocOrder_(o, its, null); return { الإجمالي: d.total }; })();
  return out;
});

check('الجملة: الإجمالي زي ما هو من الشيت', r.dist.الإجمالي === 1000, String(r.dist.الإجمالي));
check('من غير مستوى: الإجمالي زي ما هو برضه', r.بدون.الإجمالي === 1000, String(r.بدون.الإجمالي));

['showroom'].forEach(tier=>{
  const t = r[tier];
  check(`${tier}: أسعار السطور اتغيّرت فعلاً عن الجملة`,
    JSON.stringify(t.الأسعار) !== JSON.stringify(r.dist.الأسعار),
    `جملة ${JSON.stringify(r.dist.الأسعار)} · ${tier} ${JSON.stringify(t.الأسعار)}`);
  check(`${tier}: الإجمالي = مجموع السطور المطبوعة`,
    t.الإجمالي === t.مجموع_السطور,
    `إجمالي ${t.الإجمالي} · مجموع ${t.مجموع_السطور}`);
  check(`${tier}: الإجمالي مابقاش إجمالي الجملة القديم`,
    t.الإجمالي !== 1000, String(t.الإجمالي));
});

check('مفيش أخطاء', errs.length===0, errs.join(' | '));

// ⚠️ باج: أول ما المصنع يحفظ «سعر عميل» لمقاس، الباب الحفر كان بياخد نفس
// السعر — يعني زيادة الحفر (٦٠٠ ج للباب) بتختفي من عرض سعر العميل بالكامل.
const حفر = await pg.evaluate(()=>{
  window.toast=()=>{}; window.render=()=>{};
  const w = SIZES[0].w;
  const طلب = { id:'H1', dist:'م', phone:'01', customer:'ع', date:'2026-09-17', total:0,
    items:[
      { type:'Door', code:'A01', title:'WPC Door A01 (Carved)', milling:'Carved', size:w+' cm',
        unit:'door', qty:2, unitPrice:priceForWidth(w,true), produced:0, width:w },
      { type:'Door', code:'A01', title:'WPC Door A01', milling:'', size:w+' cm',
        unit:'door', qty:1, unitPrice:priceForWidth(w,false), produced:0, width:w }
    ] };
  const أسعار = () => {
    const doc = buildAdminDocOrder_(طلب, طلب.items, 'showroom');
    return { حفر: doc.items[0].unitPrice, عادي: doc.items[1].unitPrice, إجمالي: doc.total };
  };
  const بدون_حفظ = أسعار();
  TIER_OVERRIDES.showroom.sizes[w] = 6000;          // المصنع حفظ سعر عميل للمقاس
  const بعد_حفظ = أسعار();
  TIER_OVERRIDES.showroom.hafrExtra = 800;          // وحفظ زيادة حفر للعميل كمان
  const بزيادة_حفر = أسعار();
  TIER_OVERRIDES.showroom.sizes = {}; TIER_OVERRIDES.showroom.hafrExtra = null;
  return { بدون_حفظ, بعد_حفظ, بزيادة_حفر, HAFR: HAFR_EXTRA };
});
check('من غير أسعار محفوظة: الحفر أغلى من العادي بزيادة الحفر',
  حفر.بدون_حفظ.حفر - حفر.بدون_حفظ.عادي === حفر.HAFR, JSON.stringify(حفر.بدون_حفظ));
check('وبعد ما المصنع يحفظ سعر عميل للمقاس، الحفر لسه أغلى',
  حفر.بعد_حفظ.حفر - حفر.بعد_حفظ.عادي === حفر.HAFR, JSON.stringify(حفر.بعد_حفظ));
check('ولو حفظ زيادة حفر للعميل، بتتستعمل هي',
  حفر.بزيادة_حفر.حفر - حفر.بزيادة_حفر.عادي === 800, JSON.stringify(حفر.بزيادة_حفر));
check('وإجمالي المستند بيتحسب بنفس الأسعار',
  Math.abs(حفر.بعد_حفظ.إجمالي - (حفر.بعد_حفظ.حفر*2 + حفر.بعد_حفظ.عادي)) < 0.01,
  JSON.stringify(حفر.بعد_حفظ));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
