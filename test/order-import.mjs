// استرجاع طلب من نص. الطلب ممكن يضيع من الجهاز ومن السيرفر مع بعض (طلب كبير
// فشل إرساله في صمت). المستند المطبوع بيبقى فيه كل التفاصيل — فبدل ما الموزّع
// يدخّل ١٥ صنف تاني بالإيد، بيلزق النص ويراجع ويحفظ.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const استرجع = (نص) => pg.evaluate((نص)=>{
  state.cart=[]; save('wpc_cart',[]);
  state.profile={name:'',phone:'',region:''}; state.customer={name:'',phone:''};
  const msgs=[]; const old=window.toast; window.toast=m=>msgs.push(m);
  window.prompt=()=>نص;
  importOrderText_();
  window.toast=old;
  return { أصناف: state.cart.length, قطع: state.cart.reduce((n,i)=>n+(Number(i.qty)||0),0),
           بروفايل: state.profile, عميل: state.customer.name, تبويب: state.tab, رسائل: msgs,
           محفوظ: JSON.parse(localStorage.getItem('wpc_cart')||'[]').length };
}, نص);

// نبني نفس الطلب اللي في البلاغ
const نص_الطلب = await pg.evaluate(()=>{
  const عادي=(code,w,qty)=>{ const d=DOORS.find(x=>x.code===code);
    return {kind:'door', title:'باب '+d.code+' '+d.name, titleEn:'WPC Door '+d.code+' - '+d.en,
      code:d.code, img:d.img, sizeTxt:w+' سم', sizeEn:w+' cm', unitPrice:priceForWidth(w,false),
      qty, w, frame:15, dbror:'6×9', frameHeight:0, frameKind:'full', frameRodQty:'',
      frameForDoors:'', note:'', doorHeight:215, hafr:false, millEn:''}; };
  return JSON.stringify({ items:[عادي('A010',90,35), عادي('A04',80,20)],
    profile:{name:'ربيع موسي', phone:'01002242422', region:'دمياط'},
    customer:{name:'ربيع موسى', phone:''} });
});

const r = await استرجع(نص_الطلب);
check('الأصناف رجعت للسلة', r.أصناف===2, String(r.أصناف));
check('بالكميات الصح', r.قطع===55, String(r.قطع));
check('واتحفظت على الجهاز', r.محفوظ===2, String(r.محفوظ));
check('وبيانات الحساب رجعت',
  r.بروفايل.name==='ربيع موسي' && r.بروفايل.phone==='01002242422' && r.بروفايل.region==='دمياط',
  JSON.stringify(r.بروفايل));
check('وصاحب الأوردر رجع', r.عميل==='ربيع موسى', r.عميل);
check('والشاشة فتحت على السلة', r.تبويب==='cart', r.تبويب);
check('والرسالة بتقول يراجع قبل ما يحفظ',
  r.رسائل.some(m=>/راجعهم/.test(String(m))), JSON.stringify(r.رسائل));

// مصفوفة أصناف لوحدها (من غير بيانات حساب) برضه بتشتغل
const r2 = await استرجع(await pg.evaluate(()=>JSON.stringify([
  {kind:'door', title:'باب', code:'A01', sizeTxt:'70 سم', qty:3, unitPrice:100}])));
check('مصفوفة أصناف لوحدها بتشتغل', r2.أصناف===1 && r2.قطع===3, `${r2.أصناف} صنف`);

// نصوص بايظة مابتكسرش حاجة
for(const [نص, وصف] of [['كلام','نص مش JSON'], ['{}','JSON فاضي'],
                        ['{"items":[]}','مفيش أصناف'], ['[{"qty":0}]','صنف من غير كمية']]){
  const rb = await استرجع(نص);
  check(`${وصف}: السلة فضلت فاضية ومعاها رسالة`,
    rb.أصناف===0 && rb.رسائل.length===1, JSON.stringify(rb.رسائل));
}

// إلغاء الاسترجاع مايعملش حاجة
const r3 = await pg.evaluate(()=>{
  state.cart=[{kind:'door',title:'قديم',qty:1}];
  window.prompt=()=>null; window.toast=()=>{};
  importOrderText_();
  return state.cart.length;
});
check('الإلغاء مابيمسحش السلة اللي موجودة', r3===1, String(r3));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
