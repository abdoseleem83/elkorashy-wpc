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
  const html = docHTML(o,'quote',true);
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

// ٥) طلب قديم (اتعمل قبل ما القص يبقى بند) — المعاينة لازم توّلد السطر
//    من الباب نفسه، وتزوّد الإجمالي. ده الطلب اللي في بلاغ صاحب المصنع بالظبط.
const قديم = await pg.evaluate(()=>{
  const w = SIZES[0].w, سعر = priceForWidth(w,false);
  const باب = {kind:'door', title:'باب A03 أرو', code:'A03',
    sizeTxt:w+'×205 سم (مقاس خاص — مقاس الفتحة المعمارية)', sizeEn:w+'x205 cm (custom)',
    unitPrice:سعر, qty:2, w:'', frame:15, dbror:'9×6', frameHeight:0, doorHeight:0, note:''};
  const o = { id:'old1', no:'9/1', name:'اسلام عونى', phone:'1', date:'2026-09-09',
              items:[باب], total:سعر*2 };
  const html = docHTML(o,'quote',true);
  return { فيه_قص: /خدمة قص/.test(html),
           الإجمالي_الجديد: new RegExp(money(سعر*2 + CUSTOM_EXTRA*2)).test(html),
           الإجمالي_القديم_اختفى: !new RegExp('>\\s*'+money(سعر*2)+' ج').test(html),
           الأصل_ما_اتغيّرش: o.items.length===1 && o.total===سعر*2 };
});
check('طلب قديم من غير بند: المعاينة بتولّده', قديم.فيه_قص === true);
check('والإجمالي بيزيد بقيمته', قديم.الإجمالي_الجديد === true);
check('من غير ما نلمس الطلب المتخزّن نفسه', قديم.الأصل_ما_اتغيّرش === true);

// ٦) طلب بتسعير قديم (الـ٣٠٠ كانت جوه سعر الباب) — ممنوع نحسبها تاني
const أقدم = await pg.evaluate(()=>{
  const w = SIZES[0].w, سعر = priceForWidth(w,false) + CUSTOM_EXTRA;   // تسعير ما قبل v164
  const باب = {kind:'door', title:'باب A03 أرو', code:'A03',
    sizeTxt:w+'×205 سم (مقاس خاص — مقاس الفتحة المعمارية)', sizeEn:w+'x205 cm (custom)',
    unitPrice:سعر, qty:2, w:'', frame:15, dbror:'9×6', frameHeight:0, doorHeight:0, note:''};
  const o = { id:'old2', no:'8/1', name:'ا', phone:'1', date:'2026-09-09',
              items:[باب], total:سعر*2 };
  const html = docHTML(o,'quote',true);
  return { فيه_قص: /خدمة قص/.test(html), مشمول: /مشمول/.test(html),
           الإجمالي_ما_زادش: new RegExp(money(سعر*2)+' ج').test(html) };
});
check('التسعير القديم: السطر بيبان برضه للمصنع', أقدم.فيه_قص === true);
check('بس مكتوب عليه «مشمول» — مش بيتحسب مرتين', أقدم.مشمول === true);
check('والإجمالي ما زادش', أقدم.الإجمالي_ما_زادش === true);

// ٧) البند بيبان في عرض السعر بس — مش في ورقة الأوردر ولا رسالة الواتساب
const أين = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02 خشبي', code:'A02',
    sizeTxt:'90×206 سم (مقاس خاص — مقاس الفتحة المعمارية)', sizeEn:'90x206 cm (custom)',
    unitPrice:6000, qty:1, w:'', frame:15, dbror:'9×6', frameHeight:0, doorHeight:0, note:''};
  const قص = {kind:'acc', id:'CUT', code:'CUT', unit:'باب', qty:1, price:300,
    title:'خدمة قص — 90×206 سم (مقاس خاص — مقاس الفتحة المعمارية)'};
  const o = { id:'q1', no:'72/1', name:'ا', phone:'1', date:'2026-09-09',
              items:[باب, قص], total:6300 };
  return { عرض_سعر: /خدمة قص/.test(docHTML(o,'quote',true)),
           ورقة_الأوردر: /خدمة قص/.test(docHTML(o,'order',true)),
           إجمالي_الورقة_ما_اتغيّرش: new RegExp(money(6300)+' ج').test(docHTML(o,'order',true)),
           رسالة: /خدمة قص/.test(buildMessage(o)) };
});
check('بيبان في عرض السعر', أين.عرض_سعر === true);
check('مش بيبان في ورقة الأوردر', أين.ورقة_الأوردر === false);
check('وإجمالي ورقة الأوردر زي ما هو', أين.إجمالي_الورقة_ما_اتغيّرش === true);
check('ومش بيبان في رسالة الواتساب', أين.رسالة === false);

// ٨) سعر خدمة القص واحد في كل المستويات — «سعر عميل» مابيزوّدش عليه نص جنيه
const مستويات = await pg.evaluate(()=>{
  const it = { title:'خدمة قص — 90×206 سم', unitPrice:CUSTOM_EXTRA, qty:1 };
  const مفتاح = tierKeyFor_(it,'acc');
  return { مفتاح,
    جملة: tierPrice(CUSTOM_EXTRA,'acc','dist',مفتاح),
    عميل: tierPrice(CUSTOM_EXTRA,'acc','showroom',مفتاح),
    القيمة: CUSTOM_EXTRA };
});
check('البند بيتربط بمفتاح خدمة القص', مستويات.مفتاح === 'customExtra');
check('سعره واحد في الجملة والعميل', مستويات.جملة === مستويات.القيمة && مستويات.عميل === مستويات.القيمة,
  `جملة=${مستويات.جملة} عميل=${مستويات.عميل}`);

// ٩) تعديل طلب قديم (سعر الباب شامل الـ٣٠٠) — ممنوع نضيف بند قص فوقه،
//    لأن ده كان هيتسجّل في الطلب نفسه ويتحسب على العميل مرتين.
const تعديل = await pg.evaluate(()=>{
  const w = SIZES[0].w;
  const قديم = { kind:'door', title:'باب A02 خشبي', code:'A02',
    sizeTxt:w+'×205 سم (مقاس خاص — مقاس الفتحة المعمارية)', sizeEn:w+'x205 cm (custom)',
    unitPrice: priceForWidth(w,false) + CUSTOM_EXTRA, qty:2, w:'', frame:0, dbror:'',
    frameHeight:0, doorHeight:0, note:'' };
  state.cart = [قديم]; saveCart_();
  const بعد_القديم = state.cart.filter(it=>/خدمة قص/.test(it.title||'')).length;

  const جديد = Object.assign({}, قديم, { unitPrice: priceForWidth(w,false) });
  state.cart = [جديد]; saveCart_();
  const بعد_الجديد = state.cart.filter(it=>/خدمة قص/.test(it.title||'')).length;

  // ولو البند موجود أصلاً في الطلب، بيفضل حتى لو الأسعار اتغيّرت بعدين
  state.cart = [قديم, {kind:'acc', id:'CUT', code:'CUT', unit:'باب', qty:2, price:300,
    title:'خدمة قص — '+قديم.sizeTxt}];
  saveCart_();
  const بند_موجود = state.cart.filter(it=>/خدمة قص/.test(it.title||''));
  state.cart = [];
  return { بعد_القديم, بعد_الجديد, بند_باقي: بند_موجود.length, سعره: بند_موجود[0] && بند_موجود[0].price };
});
check('تسعير قديم: مافيش بند قص بيتزاد على الطلب', تعديل.بعد_القديم === 0);
check('تسعير حالي: البند بيتزاد عادي', تعديل.بعد_الجديد === 1);
check('بند موجود أصلاً بيفضل بسعره', تعديل.بند_باقي === 1 && تعديل.سعره === 300,
  `${تعديل.بند_باقي} · ${تعديل.سعره}`);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\n${pass} نجح · ${fail} فشل`);
process.exit(fail?1:0);
