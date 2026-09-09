// رحلة الفلوس كاملة لطلب فيه مقاس خاص: من السلة → لسطور السيرفر → لتعديلات
// المصنع. كل خطوة ليها إجمالي، والاختبار بيقارن كل واحد باللي محسوب بالإيد.
// الفكرة إن كل جزء لوحده متختبر، لكن الغلط بيطلع في اللحامات بينهم.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs); if(!m) throw new Error('مالقيناش '+n); return m[0]; };
const NCOLS = 22;

const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ── ١) السلة: بابين خاص + باب عادي ─────────────────────────────────────
const سلة = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:1, height:'', frame:0, dbror:'', hafr:false,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:true, custom:{w:w, h:205, qty:2, frame:0, dbror:'', hafr:false,
      frameHeight:'', frameKind:null, frameRodQty:'', frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  return { أصناف: state.cart.map(it=>({ kind:it.kind, code:it.code, qty:it.qty,
             price: it.kind==='door'?it.unitPrice:it.price,
             sizeEn: it.sizeEn||'', spec: it.spec||'', doorHeight: it.doorHeight||'' })),
           إجمالي: cartTotal(), سعر_المقاس: priceForWidth(SIZES[0].w,false), قص: CUSTOM_EXTRA };
});
const سعر = سلة.سعر_المقاس, قص = سلة.قص;
const متوقع1 = سعر*1 + سعر*2 + قص*2;
check('إجمالي السلة = ٣ أبواب + قص لاتنين', سلة.إجمالي === متوقع1,
  `${سلة.إجمالي} مقابل ${متوقع1}`);
const بندCut = سلة.أصناف.find(x=>x.code==='CUT');
check('بند القص شايل مقاس الباب عشان السيرفر يربطه', !!(بندCut && بندCut.spec),
  JSON.stringify(بندCut));

// ── ٢) سطور السيرفر: نبنيها بنفس منطق newOrder ─────────────────────────
const ctx = { String, Number, Object, Array, RegExp, CUT_SERVICE_CODE_:'CUT',
  DOOR_STD_HEIGHT_:215, HEAD_ITEMS:new Array(NCOLS).fill('') };
vm.createContext(ctx);
vm.runInContext(grab('itemRowsForMany_')+'\n'+grab('itemRowsFor_')+'\n'
  +grab('doorRowNeedsCut_')+'\n'+grab('cutRowKey_')+'\n'+grab('syncCutRows_')
  +'\n'+grab('recomputeOrderTotals_'), ctx);

const سطور = سلة.أصناف.map(it=>{
  const r = new Array(NCOLS).fill('');
  r[0]='W1'; r[3] = it.kind==='door' ? 'Door' : 'Accessory'; r[5]=it.code||'';
  r[6] = it.kind==='door' ? it.sizeEn : it.spec;
  r[9] = it.kind==='door' ? 'door' : 'باب';
  r[10]=it.qty; r[11]=it.price; r[12]=it.qty*it.price;
  r[19]=it.doorHeight||'';
  return r;
});

function شيت(rows){
  return { rows, sh: {
    getLastRow: () => rows.length + 1,
    deleteRow: (n) => rows.splice(n-2,1),
    getRange: (r,c,nr,nc) => ({
      getValues: () => rows.slice(r-2, r-2+(nr||1)).map(x=>x.slice(c-1, c-1+(nc||1))),
      setValues: (v) => v[0].forEach((val,k)=>{ rows[r-2][c-1+k] = val; })
    })
  }};
}
function إجماليات(rows){
  const مكتوب = {};
  ctx.sheet_ = (name) => name==='Orders'
    ? { getRange: (r,c) => ({ setValue: v => { مكتوب[c]=v; } }) }
    : شيت(rows).sh;
  ctx.SHEET_ORDERS='Orders'; ctx.SHEET_ITEMS='Order_Items';
  ctx.HEAD_ORDERS=new Array(20).fill('');
  ctx.findRow_ = () => 5;
  ctx.itemRowsFor_ = (sh,id) => { const s=شيت(rows); return { rows:rows.slice(),
    rowNums: rows.map((_,i)=>i+2) }; };
  ctx.recomputeOrderTotals_('W1');
  return { قطع: مكتوب[8], عيدان: مكتوب[9], فلوس: مكتوب[10] };
}

let t = إجماليات(سطور);
check('إجمالي السيرفر = إجمالي السلة', t.فلوس === متوقع1, `${t.فلوس} مقابل ${متوقع1}`);
check('عدد القطع ٣ أبواب بس (من غير القص)', t.قطع === 3, String(t.قطع));

// ── ٣) المصنع بينقّص الخاص من ٢ لـ ١ ──────────────────────────────────
const s3 = شيت(سطور.map(r=>r.slice()));
const صف_خاص = s3.rows.findIndex(r=>/\(custom\)/i.test(String(r[6])));
s3.rows[صف_خاص][10] = 1; s3.rows[صف_خاص][12] = سعر;
ctx.itemRowsFor_ = () => ({ rows: s3.rows.slice(), rowNums: s3.rows.map((_,i)=>i+2) });
const غيّر = ctx.syncCutRows_(s3.sh, 'W1');
check('السيرفر قال إنه غيّر بند القص', غيّر === 1, String(غيّر));
t = إجماليات(s3.rows);
const متوقع3 = سعر*1 + سعر*1 + قص*1;
check('الإجمالي بعد التنقيص', t.فلوس === متوقع3, `${t.فلوس} مقابل ${متوقع3}`);

// ── ٤) المصنع بيحذف الباب الخاص خالص ──────────────────────────────────
const s4 = شيت(s3.rows.map(r=>r.slice()));
s4.rows.splice(s4.rows.findIndex(r=>/\(custom\)/i.test(String(r[6]))), 1);
ctx.itemRowsFor_ = () => ({ rows: s4.rows.slice(), rowNums: s4.rows.map((_,i)=>i+2) });
ctx.syncCutRows_(s4.sh, 'W1');
t = إجماليات(s4.rows);
check('بند القص اتشال مع الباب', !s4.rows.some(r=>String(r[5])==='CUT'));
check('الإجمالي بقى الباب العادي بس', t.فلوس === سعر, `${t.فلوس} مقابل ${سعر}`);

// ── ٥) عرض السعر لنفس الطلب: السطور بتجمع على الإجمالي المكتوب تحتها ──
const عرض = await pg.evaluate(({سعر, قص})=>{
  const باب = (custom,qty)=>({kind:'door', title:'باب A02 خشبي', code:'A02',
    sizeTxt: custom?('70×205 سم (مقاس خاص — مقاس الفتحة المعمارية)'):'70 سم',
    sizeEn: custom?'70x205 cm (custom)':'70 cm',
    unitPrice:سعر, qty, w:'', frame:0, dbror:'', frameHeight:0, doorHeight:0, note:''});
  const قصL = {kind:'acc', id:'CUT', code:'CUT', unit:'باب', qty:2, price:قص,
    title:'خدمة قص — 70×205 سم (مقاس خاص — مقاس الفتحة المعمارية)'};
  const o = { id:'W1', no:'1/1', name:'اسلام', phone:'01000000000', date:'2026-09-09',
              items:[باب(false,1), باب(true,2), قصL], total: سعر*3 + قص*2 };
  const html = docHTML(o,'quote',true);
  // بنقص من أول جدول الأصناف عشان أرقام الترويسة (زي الموبايل) ما تتحسبش
  const جدول = html.slice(html.indexOf('<tbody'));
  const أرقام = [...جدول.matchAll(/font-weight:700">([\d,\.]+)<\/td>/g)].map(m=>Number(m[1].replace(/,/g,'')));
  const تحت = /(\d[\d,\.]*) ج<\/td>/.exec(html);
  return { مجموع_السطور: أرقام.reduce((a,c)=>a+c,0),
           المكتوب: تحت ? Number(تحت[1].replace(/,/g,'')) : null };
}, {سعر, قص});
check('سطور عرض السعر بتجمع على الإجمالي المكتوب تحتها',
  عرض.مجموع_السطور === عرض.المكتوب, `${عرض.مجموع_السطور} مقابل ${عرض.المكتوب}`);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
