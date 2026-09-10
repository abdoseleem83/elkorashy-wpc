// «تدعيم خشب»: اختيار على الباب بيتحوّل لبند مستقل بكميته وسعره.
// الفرق عن «خدمة قص»: القص المصنع بيعرفه من المقاس نفسه، لكن التدعيم مش باين
// من أي حاجة — فلازم يوصل للمصنع في ورقة الشغل، مش في عرض السعر بس.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) اختيار التدعيم على باب عادي → بند مستقل، وسعر الباب زي ما هو
const r = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:3, height:'', frame:0, dbror:'', hafr:false, wood:true,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:false, custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,wood:false,
      frameKind:null,frameRodQty:'',frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  const باب = state.cart.find(it=>it.kind==='door');
  const بند = state.cart.find(it=>/تدعيم خشب/.test(it.title||''));
  return { سعر_الباب:باب&&باب.unitPrice, أساسي:priceForWidth(w,false),
           موجود:!!بند, كمية:بند&&بند.qty, سعر:بند&&بند.price, كود:بند&&بند.code,
           قيمة:WOOD_EXTRA, إجمالي:cartTotal() };
});
check('سعر الباب مابيتغيّرش بالتدعيم', r.سعر_الباب === r.أساسي, `${r.سعر_الباب} مقابل ${r.أساسي}`);
check('بند «تدعيم خشب» اتضاف بكمية الأبواب', r.موجود && r.كمية===3, `كمية=${r.كمية}`);
check('سعره ٣٠٠ ج للباب', r.سعر === r.قيمة && r.قيمة === 300, `${r.سعر}`);
check('وبيتحسب في الإجمالي', r.إجمالي === r.أساسي*3 + 300*3, String(r.إجمالي));

// ٢) بيبان في ورقة الأوردر **و** في عرض السعر (عكس خدمة القص)
const أين = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02 خشبي', code:'A02', sizeTxt:'70 سم', sizeEn:'70 cm',
    unitPrice:5200, qty:2, w:'70', frame:0, dbror:'', frameHeight:0, doorHeight:0, wood:true, note:''};
  const خشب = {kind:'acc', id:'WOOD', code:'WOOD', unit:'باب', qty:2, price:300,
    title:'تدعيم خشب — 70 سم', spec:'70 cm'};
  const قص = {kind:'acc', id:'CUT', code:'CUT', unit:'باب', qty:2, price:300,
    title:'خدمة قص — 70 سم', spec:'70 cm'};
  const o = { id:'W1', no:'1/1', name:'اسلام', phone:'01000000000', date:'2026-09-10',
              items:[باب, خشب, قص], total:5200*2+600+600 };
  return { عرض_خشب: /تدعيم خشب/.test(docHTML(o,'quote',true)),
           ورقة_خشب: /تدعيم خشب/.test(docHTML(o,'order',true)),
           عرض_قص:  /خدمة قص/.test(docHTML(o,'quote',true)),
           ورقة_قص: /خدمة قص/.test(docHTML(o,'order',true)) };
});
check('التدعيم بيبان في عرض السعر', أين.عرض_خشب === true);
check('والأهم: بيبان في ورقة الأوردر للمصنع', أين.ورقة_خشب === true);
check('القص فاضل في عرض السعر بس زي ما هو', أين.عرض_قص===true && أين.ورقة_قص===false);

// ٣) بيمشي مع الباب: الكمية تتغيّر، والبند يتشال لما الباب يتشال
const مزامنة = await pg.evaluate(()=>{
  const i = state.cart.findIndex(it=>it.kind==='door');
  state.cart[i].qty = 5; saveCart_();
  const بعد = state.cart.find(it=>/تدعيم خشب/.test(it.title||''));
  // إلغاء الاختيار من الباب → البند يتشال
  state.cart[i].wood = false; saveCart_();
  const بعد_الإلغاء = state.cart.filter(it=>/تدعيم خشب/.test(it.title||'')).length;
  state.cart = [];
  return { كمية: بعد && بعد.qty, بعد_الإلغاء };
});
check('كمية البند بتمشي مع كمية الباب', مزامنة.كمية===5, String(مزامنة.كمية));
check('البند بيتشال لما الاختيار يتلغي', مزامنة.بعد_الإلغاء===0);

// ٤) سعره واحد في كل المستويات (زي القص) — «سعر عميل» مايزوّدش نص جنيه
const مستويات = await pg.evaluate(()=>{
  const it = { title:'تدعيم خشب — 70 سم', code:'WOOD' };
  const مفتاح = tierKeyFor_(it,'acc');
  return { مفتاح, جملة: tierPrice(WOOD_EXTRA,'acc','dist',مفتاح),
           عميل: tierPrice(WOOD_EXTRA,'acc','showroom',مفتاح), قيمة: WOOD_EXTRA };
});
check('البند بيتربط بمفتاح التدعيم', مستويات.مفتاح === 'woodExtra', String(مستويات.مفتاح));
check('سعره واحد في الجملة والعميل',
  مستويات.جملة===مستويات.قيمة && مستويات.عميل===مستويات.قيمة,
  `جملة=${مستويات.جملة} عميل=${مستويات.عميل}`);

// ٥) شاشة الأسعار فيها صف للتدعيم يتعدّل منه
const شاشة = await pg.evaluate(()=>{
  openAdminPrices();
  return { فيه_صف: /تدعيم خشب \(لكل باب\)/.test(viewAdminPrices()) };
});
check('شاشة الأسعار فيها صف «تدعيم خشب»', شاشة.فيه_صف === true);

// ٦) مش بيتعدّ كقطعة بتتصنّع
const عدّ = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02', code:'A02', sizeTxt:'70 سم', sizeEn:'70 cm',
    unitPrice:5200, qty:2, w:'70', frame:0, dbror:'', frameHeight:0, doorHeight:0, wood:true, note:''};
  const خشب = {kind:'acc', id:'WOOD', code:'WOOD', unit:'باب', qty:2, price:300, title:'تدعيم خشب — 70 سم'};
  const o = { id:'W2', no:'2', name:'ا', phone:'01', date:'2026-09-10', items:[باب,خشب], total:11000 };
  const html = docHTML(o,'order',true);
  return { قطع: /الإجمالي الكلي<\/b><\/span><b>(\d+) قطعة/.exec(html) };
});
check('إجمالي القطع بيعدّ الأبواب بس', عدّ.قطع && عدّ.قطع[1]==='2',
  عدّ.قطع ? عدّ.قطع[1] : 'مالقيناش');

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
