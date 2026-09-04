// زرار «أضف عود برور» لازم يقول بالظبط اللي هيتضاف. addRod بتقرّب العدد
// (Math.round) لكن الزرار كان بيعرض الرقم زي ما اتكتب — «أضف 2.5 عود» وبتتضاف ٣.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const probe = (rods) => pg.evaluate(async(rods)=>{
  state.tab='new'; state.newSection='bror'; renderNow();
  await new Promise(r=>setTimeout(r,250));
  state.br.code = DOORS[0].code; state.br.size = BRORS[0].size; state.br.rods = rods;
  refreshRodBtn('add-br');
  const btn = document.querySelector('[data-act="add-br"]');
  // كام عود بيتضاف فعلاً؟
  state.cart = [];
  window.toast = ()=>{};
  addRod('bror');
  const اتضاف = state.cart.reduce((n,it)=>n+(Number(it.qty)||0), 0);
  return { نص: btn ? btn.textContent.trim() : null, معطّل: btn ? btn.disabled : null, اتضاف };
}, rods);

for(const [rods, متوقع] of [['3',3], ['2.5',3], ['2.4',2], ['1',1]]){
  const r = await probe(rods);
  const رقم_الزرار = (String(r.نص).match(/(\d+(?:\.\d+)?)/)||[])[1];
  check(`«${rods}» → الزرار بيقول ${متوقع} والإضافة ${متوقع}`,
    Number(رقم_الزرار)===متوقع && r.اتضاف===متوقع,
    `الزرار "${r.نص}" · اتضاف ${r.اتضاف}`);
}

const صفر = await probe('0');
check('صفر: الزرار متعطّل ومفيش إضافة', صفر.معطّل===true && صفر.اتضاف===0,
  `معطّل=${صفر.معطّل} اتضاف=${صفر.اتضاف}`);
const فاضي = await probe('');
check('فاضي: الزرار متعطّل', فاضي.معطّل===true, String(فاضي.معطّل));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
