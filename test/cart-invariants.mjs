// اختبار خصائص: بدل ما نجرّب حالات اخترناها بإيدينا، بنولّد آلاف السلات
// العشوائية ونتأكد إن القواعد الأساسية صحّت في كلها. القواعد دي لو اتكسرت
// معناها فلوس غلط أو شغل غلط في الورشة:
//   ١) إجمالي السلة = مجموع سطورها.
//   ٢) كمية «خدمة قص» لكل مقاس = مجموع كميات أبوابه المحتاجة قص.
//   ٣) مفيش بند قص من غير أبواب.
//   ٤) بند القص مايتكررش لنفس المقاس.
//   ٥) الباب الخاص سعره = سعر المقاس العادي (القص بند مستقل).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const out = await pg.evaluate(()=>{
  // مولّد أرقام ثابت عشان أي فشل يبقى قابل لإعادة التنفيذ
  let seed = 20260910;
  const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; };
  const pick = a => a[Math.floor(rnd()*a.length)];
  const بايظ = [];
  const سجّل = (why, لقطة) => { if(بايظ.length<5) بايظ.push({why, لقطة}); };

  const صنع_باب = ()=>{
    const s = pick(SIZES), خاص = rnd()<0.45, حفر = rnd()<0.2;
    const h = pick(['', '', '205', '240']);
    const doorHeight = خاص ? 0 : (h ? Number(h) : 0);
    const w = s.w;
    return { kind:'door', code:'A02', title:'باب A02'+(حفر?' (حفر)':''),
      sizeTxt: خاص ? (w+'×205 سم (مقاس خاص — مقاس الفتحة المعمارية)')
                   : (w+' سم'),
      sizeEn: خاص ? (w+'x205 cm (custom)') : (w+' cm'),
      unitPrice: priceForWidth(w, حفر), qty: 1+Math.floor(rnd()*5),
      w: خاص ? '' : String(w), frame:0, dbror:'', frameHeight:0,
      doorHeight, hafr:حفر, note:'' };
  };
  const صنع_إكسسوار = ()=>{ const a = pick(ACCESSORIES);
    return { kind:'acc', id:a.id, title:a.name, price:a.price, qty:1+Math.floor(rnd()*3), unit:a.unit }; };

  for(let دورة=0; دورة<600; دورة++){
    const عدد = 1 + Math.floor(rnd()*6);
    state.cart = [];
    for(let i=0;i<عدد;i++) state.cart.push(rnd()<0.75 ? صنع_باب() : صنع_إكسسوار());
    saveCart_();

    // تعديل عشوائي: تغيير كمية أو مسح صنف — زي ما بيحصل في الاستخدام
    if(rnd()<0.5 && state.cart.length){
      const i = Math.floor(rnd()*state.cart.length);
      if(!isCutLine_(state.cart[i])){
        if(rnd()<0.5) state.cart[i].qty = 1+Math.floor(rnd()*4);
        else state.cart.splice(i,1);
        saveCart_();
      }
    }

    const لقطة = ()=>state.cart.map(it=>({k:it.kind, c:it.code, s:it.sizeTxt||it.title, q:it.qty, p:it.kind==='door'?it.unitPrice:it.price}));

    // ١) الإجمالي = مجموع السطور
    const مجموع = state.cart.reduce((s,it)=>s+(it.kind==='door'?it.unitPrice:it.price)*it.qty, 0);
    if(Math.abs(cartTotal() - مجموع) > 0.001) سجّل('الإجمالي مش مجموع السطور', لقطة());

    // ٢+٣+٤) بنود القص مطابقة لأبوابها
    const محتاج = {};
    state.cart.forEach(it=>{ if(doorNeedsCut_(it)){
      const k = doorSizeText_(it.sizeTxt, it.doorHeight)||'';
      محتاج[k] = (محتاج[k]||0) + it.qty;
    }});
    const بنود = {};
    state.cart.filter(isCutLine_).forEach(it=>{
      const k = cutLineLabel_(it);
      if(بنود[k]!=null) سجّل('بند قص متكرر لنفس المقاس', لقطة());
      بنود[k] = it.qty;
    });
    Object.keys(محتاج).forEach(k=>{
      if(بنود[k] !== محتاج[k]) سجّل('كمية بند القص مش مطابقة لأبوابه', لقطة());
    });
    Object.keys(بنود).forEach(k=>{
      if(محتاج[k] == null) سجّل('بند قص من غير أبواب', لقطة());
    });

    // ٥) الباب الخاص بسعر المقاس العادي
    state.cart.forEach(it=>{
      if(it.kind!=='door') return;
      if(!/مقاس خاص/.test(it.sizeTxt||'')) return;
      const w = doorWH_(it.sizeEn, it.doorHeight).w;
      if(it.unitPrice !== priceForWidth(w, !!it.hafr)) سجّل('سعر الباب الخاص مش سعر المقاس', لقطة());
    });
  }
  state.cart = [];
  return بايظ;
});

check('٦٠٠ سلة عشوائية: كل القواعد صحّت', out.length===0,
  out.map(x=>x.why+' → '+JSON.stringify(x.لقطة)).join('\n   ').slice(0,600));
check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
