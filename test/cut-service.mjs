// طلب صاحب المصنع: «قدام خدمة القص او الارتفاع حط العدد والسعر واضرب كأنها صنف».
// يعني: سعر الباب يفضل زي المقاس العادي، و«خدمة قص» تبقى بند مستقل تحت الباب
// بكميته وسعره وإجماليه — للمقاس الخاص وللارتفاع غير الاستاندر.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) المقاس الخاص: الباب بسعر المقاس العادي + بند قص مستقل
const r = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:1, height:'', frame:0, dbror:'', hafr:false,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:true, custom:{w:w, h:215, qty:2, frame:0, dbror:'', hafr:false,
      frameHeight:'', frameKind:null, frameRodQty:'', frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  const عادي = state.cart.find(it=>it.kind==='door' && !/مقاس خاص/.test(it.sizeTxt||''));
  const خاص  = state.cart.find(it=>it.kind==='door' && /مقاس خاص/.test(it.sizeTxt||''));
  const قص   = state.cart.find(it=>/خدمة قص/.test(it.title||''));
  return { سعر_العادي:عادي&&عادي.unitPrice, سعر_الخاص:خاص&&خاص.unitPrice,
           سعر_الدالة:priceForWidth(w,false), ملحوظة_الخاص:(خاص&&خاص.note)||'',
           قص_موجود:!!قص, قص_كمية:قص&&قص.qty, قص_سعر:قص&&قص.price,
           قص_وحدة:قص&&قص.unit, قص_عنوان:قص&&قص.title,
           إضافة_القص:CUSTOM_EXTRA, إجمالي_السلة:cartTotal() };
});
check('سعر الباب الخاص = سعر المقاس العادي',
  r.سعر_الخاص === r.سعر_العادي && r.سعر_الخاص === r.سعر_الدالة,
  `عادي=${r.سعر_العادي} خاص=${r.سعر_الخاص}`);
check('مفيش «خدمة قص» مدسوسة في ملحوظة الباب', !/خدمة قص/.test(r.ملحوظة_الخاص));
check('بند «خدمة قص» موجود بكميته', r.قص_موجود && r.قص_كمية===2, `كمية=${r.قص_كمية}`);
check('سعر البند = سعر خدمة القص المظبوط', r.قص_سعر === r.إضافة_القص,
  `${r.قص_سعر} مقابل ${r.إضافة_القص}`);
check('البند بيتحسب في إجمالي السلة',
  r.إجمالي_السلة === r.سعر_العادي*1 + r.سعر_الخاص*2 + r.قص_سعر*2,
  String(r.إجمالي_السلة));

// ٢) الارتفاع غير الاستاندر كمان بياخد بند قص، والباب سعره مابيتغيّرش
const h = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:3, height:'240', frame:0, dbror:'', hafr:false,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:false, custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,
      frameKind:null,frameRodQty:'',frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  const باب = state.cart.find(it=>it.kind==='door');
  const قص  = state.cart.find(it=>/خدمة قص/.test(it.title||''));
  return { سعر:باب&&باب.unitPrice, أساسي:priceForWidth(w,false),
           قص_كمية:قص&&قص.qty, عنوان:قص&&قص.title };
});
check('الارتفاع غير الاستاندر مش بيغيّر سعر الباب', h.سعر === h.أساسي, `${h.سعر} مقابل ${h.أساسي}`);
check('وبياخد بند «خدمة قص» بكمية الأبواب', h.قص_كمية===3, String(h.قص_كمية));
check('عنوان البند فيه مقاس الباب وارتفاعه', /ارتفاع 240/.test(h.عنوان||''), h.عنوان);

// ٣) تعديل السلة: البند بيتعاد بناؤه — مابيتكررش ومابيفضلش يتيم
const sync = await pg.evaluate(()=>{
  const قبل = state.cart.filter(it=>/خدمة قص/.test(it.title||'')).length;
  const i = state.cart.findIndex(it=>it.kind==='door');
  state.cart[i].qty = 5; saveCart_();
  const بعد_التعديل = state.cart.find(it=>/خدمة قص/.test(it.title||''));
  state.cart = state.cart.filter(it=>it.kind!=='door'); saveCart_();
  return { قبل, كمية_بعد_التعديل: بعد_التعديل && بعد_التعديل.qty,
           بعد_مسح_الباب: state.cart.filter(it=>/خدمة قص/.test(it.title||'')).length };
});
check('كمية البند بتمشي مع كمية الباب', sync.كمية_بعد_التعديل===5, String(sync.كمية_بعد_التعديل));
check('البند بيتشال لما الباب يتشال', sync.بعد_مسح_الباب===0);

// ٤) المستند: البند بيتحط تحت مجموعة مقاس الباب بالعدد والسعر والإجمالي
const doc = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02 خشبي', code:'A02',
    sizeTxt:'90×206 سم (مقاس خاص — مقاس الفتحة المعمارية)', sizeEn:'90x206 cm (custom)',
    unitPrice:6000, qty:2, w:'', frame:15, dbror:'9×6', frameHeight:0, doorHeight:0, note:''};
  const عادي = Object.assign({}, باب, {sizeTxt:'90 سم', sizeEn:'90 cm', qty:1});
  const قص = {kind:'acc', id:'CUT', code:'CUT', unit:'باب', qty:2, price:300,
    title:'خدمة قص — 90×206 سم (مقاس خاص — مقاس الفتحة المعمارية)',
    titleEn:'خدمة قص — 90×206 سم (مقاس خاص — مقاس الفتحة المعمارية)'};
  const جوان = {kind:'acc', id:'gsk', title:'جوان', unit:'متر', qty:5, price:6};
  const o = { id:'x1', no:'72/1', name:'اسلام عونى', phone:'1', date:'2026-09-09',
              items:[باب, عادي, قص, جوان], total:19230 };
  const html = docHTML(o,'order',true);
  const نص = html.replace(/<[^>]*>/g,'|');
  // ترتيب: مجموعة المقاس الخاص → الباب → بند القص → مجموعة الإكسسوارات
  const iباب = html.indexOf('باب A02 خشبي'), iقص = html.indexOf('خدمة قص');
  const iإكس = html.indexOf('إكسسوارات'), iجوان = html.indexOf('جوان');
  return { القص_بعد_الباب: iقص > iباب, القص_قبل_الإكسسوارات: iقص < iإكس,
           الجوان_بعد_الإكسسوارات: iجوان > iإكس,
           فيه_600: /600/.test(نص), عدد_القص: (html.match(/خدمة قص/g)||[]).length };
});
check('بند القص تحت الباب بتاعه في المستند', doc.القص_بعد_الباب === true);
check('ومش نازل مع الإكسسوارات', doc.القص_قبل_الإكسسوارات === true && doc.الجوان_بعد_الإكسسوارات === true);
check('البند مكتوب مرة واحدة وباسم مختصر جوه مجموعته', doc.عدد_القص===1, String(doc.عدد_القص));
check('وإجماليه متضروب (2 × 300 = 600)', doc.فيه_600 === true);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\n${pass} نجح · ${fail} فشل`);
process.exit(fail?1:0);
