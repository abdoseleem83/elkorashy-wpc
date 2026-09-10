// «كام باب جاهز» بيتعرض للموزّع من بيانات السيرفر. الدمج كان بالترتيب:
// الصنف رقم ١ عندي = الصنف رقم ١ عند السيرفر. طيب لو المصنع حذف صنف من
// النص؟ سطور السيرفر بتزحلق، ونسخة الموزّع زي ما هي — فأرقام «الجاهز»
// بتتحط على أصناف تانية خالص. الموزّع يقرا إن باب جاهز وهو مش جاهز.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  const باب = (code,sizeEn,qty)=>({kind:'door', code, title:'باب '+code, sizeEn,
    sizeTxt:sizeEn, unitPrice:5000, qty, produced:0, doorHeight:0});
  const o = { id:'W1', items:[ باب('A01','90 cm',4), باب('A02','70 cm',6),
              {kind:'acc', code:'CUT', spec:'90x205 cm (custom)', title:'خدمة قص', qty:2, price:300, produced:0} ] };

  // السيرفر: الصنف الأول (A01) اتحذف من المصنع، والباقي ليه أرقام إنتاج
  state.track.rows = [{ id:'W1', items:[
    { type:'Door', code:'A02', size:'70 cm', doorHeight:'', qty:6, produced:6 },
    { type:'Accessory', code:'CUT', size:'90x205 cm (custom)', doorHeight:'', qty:2, produced:0 }
  ]}];

  const out = mergeProducedFromTrack_(JSON.parse(JSON.stringify(o)));
  return out.items.map(it=>({ code:it.code, produced:it.produced }));
});
check('الصنف اللي اتحذف من السيرفر مابياخدش رقم إنتاج غيره',
  r[0].code==='A01' && !r[0].produced, JSON.stringify(r[0]));
check('كل صنف بياخد رقم الإنتاج بتاعه هو',
  r[1].code==='A02' && r[1].produced===6, JSON.stringify(r[1]));

// وترتيب مختلف على السيرفر لازم يتطابق صح كمان
const r2 = await pg.evaluate(()=>{
  const باب = (code,sizeEn,qty)=>({kind:'door', code, title:'باب '+code, sizeEn,
    sizeTxt:sizeEn, unitPrice:5000, qty, produced:0, doorHeight:0});
  const o = { id:'W2', items:[ باب('A01','90 cm',4), باب('A02','70 cm',6) ] };
  state.track.rows = [{ id:'W2', items:[
    { type:'Door', code:'A02', size:'70 cm', doorHeight:'', qty:6, produced:2 },
    { type:'Door', code:'A01', size:'90 cm', doorHeight:'', qty:4, produced:4 }
  ]}];
  return mergeProducedFromTrack_(JSON.parse(JSON.stringify(o)))
    .items.map(it=>it.code+':'+it.produced);
});
check('الترتيب المقلوب بيتطابق بالهوية مش بالمكان', r2.join(',')==='A01:4,A02:2', r2.join(','));

// صنفين متطابقين تمامًا: كل واحد بياخد سطره بالترتيب
const r3 = await pg.evaluate(()=>{
  const باب = (qty)=>({kind:'door', code:'A01', title:'باب A01', sizeEn:'90 cm',
    sizeTxt:'90 cm', unitPrice:5000, qty, produced:0, doorHeight:0});
  const o = { id:'W3', items:[ باب(2), باب(3) ] };
  state.track.rows = [{ id:'W3', items:[
    { type:'Door', code:'A01', size:'90 cm', doorHeight:'', qty:2, produced:1 },
    { type:'Door', code:'A01', size:'90 cm', doorHeight:'', qty:3, produced:3 }
  ]}];
  return mergeProducedFromTrack_(JSON.parse(JSON.stringify(o)))
    .items.map(it=>String(it.produced));
});
check('الأصناف المتطابقة كل واحد بياخد سطره', r3.join(',')==='1,3', r3.join(','));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
