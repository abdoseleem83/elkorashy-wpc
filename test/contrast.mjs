// الشكل الغامق جاب مشكلة مالهاش علاقة بالمنطق: كلام بلون غامق على خلفية غامقة.
// أسامي العملاء في شاشة المصنع كانت شبه مخفية (لون كحلي مكتوب بالنص من أيام
// الشكل الفاتح). الاختبار ده بيمشي على كل كلمة معروضة في الشاشة ويحسب نسبة
// التباين بينها وبين خلفيتها — ولو فيه حاجة مش مقروءة بيسقط ويقول هي فين.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// نسبة التباين بمعادلة WCAG
await pg.addInitScript(()=>{});
const فحص = () => pg.evaluate(()=>{
  const رقم = c=>{ const m=String(c).match(/[\d.]+/g)||[]; return m.map(Number); };
  const شفاف = c=>{ const v=رقم(c); return !v.length || (v.length>3 && v[3]===0); };
  const لمعان = ([r,g,b])=>{
    const f=v=>{ v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); };
    return .2126*f(r)+.7152*f(g)+.0722*f(b);
  };
  const نسبة=(a,b)=>{ const l1=لمعان(a), l2=لمعان(b); const [h,lo]=l1>l2?[l1,l2]:[l2,l1];
                      return (h+.05)/(lo+.05); };
  // العناصر اللي خلفيتها تدرّج لوني (gradient) مش بنقدر نحسبها بدقة — بنعدّيها
  const تدرّج = el=>{
    for(let n=el; n && n!==document.documentElement; n=n.parentElement){
      if(getComputedStyle(n).backgroundImage!=='none') return true;
      if(!شفاف(getComputedStyle(n).backgroundColor)) return false;
    }
    return false;
  };
  const خلفية = el=>{
    for(let n=el; n && n!==document.documentElement; n=n.parentElement){
      const bg=getComputedStyle(n).backgroundColor;
      if(!شفاف(bg)){ const v=رقم(bg); if(v.length<4 || v[3]>=.85) return v.slice(0,3); }
    }
    const v=رقم(getComputedStyle(document.body).backgroundColor);
    return v.length?v.slice(0,3):[255,255,255];
  };
  const سيئة=[];
  document.querySelectorAll('body *').forEach(el=>{
    if(el.closest('#paper')) return;                    // ورقة الـPDF بيضا بطبيعتها
    const cs=getComputedStyle(el);
    if(cs.display==='none' || cs.visibility==='hidden' || Number(cs.opacity)<.9) return;
    if(el.disabled) return;
    if(تدرّج(el)) return;
    const r=el.getBoundingClientRect(); if(!r.width || !r.height) return;
    // بس العناصر اللي فيها نص مكتوب فيها هي نفسها (مش في ولادها)
    const نص=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
    if(نص.length<2) return;
    const لون=رقم(cs.color).slice(0,3);
    const ن=نسبة(لون, خلفية(el));
    if(ن < 3) سيئة.push({نص:نص.slice(0,28), لون:cs.color, نسبة:Math.round(ن*100)/100,
                         عنصر:el.tagName.toLowerCase()+(el.className?'.'+String(el.className).split(' ')[0]:'')});
  });
  return سيئة;
});

// ١) شاشة الطلب الجديد
let سيئة = await فحص();
check('شاشة «طلب جديد»: كل الكلام مقروء', سيئة.length===0, JSON.stringify(سيئة.slice(0,4)));

// ٢) السلة
await pg.evaluate(()=>{ window.toast=()=>{};
  state.cart=[{kind:'door',code:'A01',title:'باب A01 — 70 سم',sizeTxt:'70 سم',sizeEn:'70 cm',w:70,qty:2,
               unitPrice:5400,frame:10,dbror:'6×9',note:'حفر جانبي'}];
  saveCart_(); state.tab='cart'; render(); });
await pg.waitForTimeout(400);
سيئة = await فحص();
check('شاشة «السلة»: كل الكلام مقروء', سيئة.length===0, JSON.stringify(سيئة.slice(0,4)));

// ٣) شاشة المصنع — دي اللي كانت فيها المشكلة
await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{};
  Object.assign(state.admin, {open:true, loading:false, groupOpen:{'محمد زكي':true}, prodEdit:{}, qtyEdit:{},
    rows:[{id:'B2', no:33, date:'2026-09-01', ts:Date.now(), status:'Ready', dist:'محمد زكي',
           phone:'01000000001', region:'المحلة', customer:'محمد زكي', qty:64, total:341600, editCount:1,
           items:[{type:'Door', code:'A01', title:'Door A01', size:'70 cm', qty:64, produced:60, unitPrice:5400}]}]});
  state.admin.openOrder='B2';
  state.tab='admin'; render();
});
await pg.waitForTimeout(500);
سيئة = await فحص();
check('شاشة «المصنع»: كل الكلام مقروء (أسامي العملاء والأرقام)',
  سيئة.length===0, JSON.stringify(سيئة.slice(0,5)));

// ٤) متابعة الطلبات
await pg.evaluate(()=>{
  state.orders=[{id:'O1',no:142,date:'2026-09-14',ts:Date.now(),status:'In Progress',name:'محمد',
    phone:'01000000000',region:'طنطا',customer:'أحمد',editCount:1,replacesId:'O0',prevNo:141,
    items:[{kind:'door',code:'A01',title:'باب',sizeTxt:'70 سم',qty:5,unitPrice:5400}],total:27000}];
  state.tab='orders'; render(); });
await pg.waitForTimeout(400);
سيئة = await فحص();
check('شاشة «تابع طلبك»: كل الكلام مقروء', سيئة.length===0, JSON.stringify(سيئة.slice(0,4)));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
