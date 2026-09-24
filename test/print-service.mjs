// «طباعة»: خدمة تالتة على الباب، اختيار صريح من الموزّع (زي التدعيم) لكن
// بتبان في عرض السعر للعميل بس (زي القص) — مش في ورقة شغل المصنع.
// الاختبار بيتأكد كمان إن جدول SERVICE_LINES_ بقى فعلاً المصدر الوحيد:
// أي بند تالت كان بياخد سعر التدعيم غلط من الثلاثية القديمة في servicePrice_.
import fs from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ١) سعر كل خدمة بييجي من مفتاحها هي — مش من ثلاثية
const أسعار = await pg.evaluate(()=>({
  cut: servicePrice_('CUT'), wood: servicePrice_('WOOD'), print: servicePrice_('PRINT'),
  CUSTOM_EXTRA, WOOD_EXTRA, PRINT_EXTRA,
  مجهول: servicePrice_('NOPE')
}));
check('سعر القص من مفتاحه', أسعار.cut===أسعار.CUSTOM_EXTRA, String(أسعار.cut));
check('سعر التدعيم من مفتاحه', أسعار.wood===أسعار.WOOD_EXTRA, String(أسعار.wood));
check('سعر الطباعة من مفتاحه مش من التدعيم',
  أسعار.print===أسعار.PRINT_EXTRA && أسعار.print!==أسعار.WOOD_EXTRA,
  `طباعة=${أسعار.print} تدعيم=${أسعار.wood}`);
check('الطباعة ٢٠٠ ج افتراضيًا', أسعار.PRINT_EXTRA===200, String(أسعار.PRINT_EXTRA));
check('كود مش في الجدول = صفر، مش سعر خدمة تانية', أسعار.مجهول===0, String(أسعار.مجهول));

// ٢) اختيار الطباعة على الباب → بند مستقل بكميته
const r = await pg.evaluate(()=>{
  state.cart = [];
  const d = DOORS[0], w = SIZES[0].w;
  state.pick = { code:d.code, sizes:{ [w]:{qty:3, height:'', frame:0, dbror:'', hafr:false, wood:false, print:true,
                   frameKind:null, frameRodQty:'', frameForDoors:''} },
    customOn:false, custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,wood:false,print:false,
      frameKind:null,frameRodQty:'',frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  const باب = state.cart.find(it=>it.kind==='door');
  const بند = state.cart.find(it=>it.code==='PRINT');
  return { سعر_الباب:باب&&باب.unitPrice, أساسي:priceForWidth(w,false), علامة:باب&&باب.print,
           موجود:!!بند, كمية:بند&&بند.qty, سعر:بند&&بند.price, عنوان:بند&&بند.title,
           إجمالي:cartTotal(), قيمة:PRINT_EXTRA };
});
check('سعر الباب مابيتغيّرش بالطباعة', r.سعر_الباب===r.أساسي, `${r.سعر_الباب} مقابل ${r.أساسي}`);
check('علامة الطباعة بتتحفظ على سطر الباب', r.علامة===true);
check('بند «طباعة» اتضاف بكمية الأبواب', r.موجود && r.كمية===3, `كمية=${r.كمية}`);
check('وعنوانه فيه مقاس الباب', /^طباعة\s*—\s*\d+\s*سم/.test(r.عنوان||''), r.عنوان);
check('سعره سعر الطباعة', r.سعر===r.قيمة, String(r.سعر));
check('وبيتحسب في الإجمالي', r.إجمالي === r.أساسي*3 + r.قيمة*3, String(r.إجمالي));

// ٣) بيبان في عرض السعر بس (زي القص) — مش في ورقة المصنع
const أين = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02 خشبي', code:'A02', sizeTxt:'70 سم', sizeEn:'70 cm',
    unitPrice:5200, qty:2, w:'70', frame:0, dbror:'', frameHeight:0, doorHeight:0, print:true, note:''};
  const طبع = {kind:'acc', id:'PRINT', code:'PRINT', unit:'باب', qty:2, price:200,
    title:'طباعة — 70 سم', spec:'70 cm'};
  const خشب = {kind:'acc', id:'WOOD', code:'WOOD', unit:'باب', qty:2, price:300,
    title:'تدعيم خشب — 70 سم', spec:'70 cm'};
  const o = { id:'P1', no:'1/1', name:'اسلام', phone:'01000000000', date:'2026-09-10',
              items:[باب, طبع, خشب], total:5200*2+400+600 };
  return { عرض: /طباعة/.test(docHTML(o,'quote',true)),
           ورقة: /طباعة/.test(docHTML(o,'order',true)),
           خشب_ورقة: /تدعيم خشب/.test(docHTML(o,'order',true)),
           واتساب: /طباعة/.test(buildMessage(o)),
           quoteOnly: quoteOnlyLine_(طبع) };
});
check('الطباعة بتبان في عرض السعر للعميل', أين.عرض===true);
check('ومابتبانش في ورقة المصنع (زي القص)', أين.ورقة===false);
check('والتدعيم فاضل بيبان في ورقة المصنع زي ما هو', أين.خشب_ورقة===true);
check('ومابتتبعتش في رسالة الواتساب للمصنع', أين.واتساب===false);
check('quoteOnlyLine_ شايفاها بند عرض سعر', أين.quoteOnly===true);

// ٤) بتمشي مع الباب: الكمية تتغيّر، والبند يتشال لما الاختيار يتلغي
const مزامنة = await pg.evaluate(()=>{
  state.cart = [];
  state.cart.push({kind:'door', code:'A01', sizeTxt:'90 سم', sizeEn:'90 cm', unitPrice:5000, qty:2, print:true});
  saveCart_();
  const أول = state.cart.find(it=>it.code==='PRINT');
  state.cart.find(it=>it.kind==='door').qty = 5; saveCart_();
  const بعد = state.cart.find(it=>it.code==='PRINT');
  state.cart.find(it=>it.kind==='door').print = false; saveCart_();
  const بعد_الإلغاء = state.cart.filter(it=>it.code==='PRINT').length;
  state.cart = [];
  return { أول:أول&&أول.qty, كمية:بعد&&بعد.qty, بعد_الإلغاء };
});
check('البند بيتولّد مع الباب', مزامنة.أول===2, String(مزامنة.أول));
check('كميته بتمشي مع كمية الباب', مزامنة.كمية===5, String(مزامنة.كمية));
check('وبيتشال لما الاختيار يتلغي', مزامنة.بعد_الإلغاء===0);

// ٥) سعره واحد في كل المستويات (زي القص والتدعيم)
const مستويات = await pg.evaluate(()=>{
  const مفتاح = tierKeyFor_({title:'طباعة — 70 سم', code:'PRINT'},'acc');
  return { مفتاح, جملة: tierPrice(PRINT_EXTRA,'acc','dist',مفتاح),
           عميل: tierPrice(PRINT_EXTRA,'acc','showroom',مفتاح), قيمة: PRINT_EXTRA };
});
check('البند بيتربط بمفتاح الطباعة', مستويات.مفتاح==='printExtra', String(مستويات.مفتاح));
check('سعره واحد في الجملة والعميل',
  مستويات.جملة===مستويات.قيمة && مستويات.عميل===مستويات.قيمة,
  `جملة=${مستويات.جملة} عميل=${مستويات.عميل}`);

// ٦) شاشة الأسعار فيها صف للطباعة، والتعديل بيمسك
const شاشة = await pg.evaluate(()=>{
  openAdminPrices();
  const html = viewAdminPrices();
  const pe = state.admin.priceEdit;
  return { صف: /طباعة \(لكل باب\)/.test(html), له_ثلاثي: !!(pe && pe.printExtra),
           جملة: pe && pe.printExtra && pe.printExtra.dist };
});
check('شاشة الأسعار فيها صف «طباعة»', شاشة.صف===true);
check('وله خانة جملة/عميل زي الباقي', شاشة.له_ثلاثي===true && شاشة.جملة===200, String(شاشة.جملة));

// ٧) مش بيتعدّ كقطعة بتتصنّع
const عدّ = await pg.evaluate(()=>{
  const باب = {kind:'door', title:'باب A02', code:'A02', sizeTxt:'70 سم', sizeEn:'70 cm',
    unitPrice:5200, qty:2, w:'70', frame:0, dbror:'', frameHeight:0, doorHeight:0, print:true, note:''};
  const طبع = {kind:'acc', id:'PRINT', code:'PRINT', unit:'باب', qty:2, price:200, title:'طباعة — 70 سم'};
  const o = { id:'P2', no:'2', name:'ا', phone:'01', date:'2026-09-10', items:[باب,طبع], total:10800 };
  return /الإجمالي الكلي<\/b><\/span><b>(\d+) قطعة/.exec(docHTML(o,'order',true));
});
check('إجمالي القطع بيعدّ الأبواب بس', عدّ && عدّ[1]==='2', عدّ ? عدّ[1] : 'مالقيناش');

// ٨) تعديل طلب من شاشة المصنع مابيضيّعش علامة الطباعة
const تعديل = await pg.evaluate(()=>{
  const its = [
    {type:'Door', title:'WPC Door A01 - Arrow', code:'A01', size:'90 cm', unit:'door', qty:2, unitPrice:5000},
    {type:'Accessory', title:'طباعة — 90 سم', code:'PRINT', unit:'باب', qty:2, unitPrice:200},
    {type:'Accessory', title:'تدعيم خشب — 90 سم', code:'WOOD', unit:'باب', qty:2, unitPrice:300}
  ];
  const o = {id:'P3', dist:'ا', phone:'01', date:'2026-09-10'};
  const old=window.toast; window.toast=()=>{}; adminEditOrderWith_(o, its); window.toast=old;
  const باب = state.cart.find(it=>it.kind==='door');
  const بنود = state.cart.filter(it=>it.kind==='acc').map(it=>it.code||it.id);
  const out = { طباعة: باب && باب.print, تدعيم: باب && باب.wood, بنود };
  state.cart = []; state.edit = null; state.editing = false;
  return out;
});
check('علامة «طباعة» بترجع على الباب بعد التعديل', تعديل.طباعة===true);
check('وعلامة «تدعيم» فاضلة شغّالة زي ما هي', تعديل.تدعيم===true);
check('والبندين الاتنين فاضلين في السلة', تعديل.بنود.includes('PRINT') && تعديل.بنود.includes('WOOD'),
  تعديل.بنود.join(','));

// ٩) السيرفر شايف PRINT بند خدمة (مش قطعة بتتصنّع)
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
check('السيرفر عارف كود PRINT', /var PRINT_SERVICE_CODE_ = 'PRINT'/.test(gs));
check('و isServiceCode_ بتشمله',
  /function isServiceCode_[\s\S]{0,260}PRINT_SERVICE_CODE_/.test(gs));
check('ومزامنة بنود الخدمة بتعامله زي التدعيم (اختيار) مش زي القص (استنتاج)',
  /String\(c\.row\[5\]\) !== CUT_SERVICE_CODE_/.test(gs));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
