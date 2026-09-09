// المقاس الخاص مش متتبّع في المخزون عن قصد (الباب بيتقص من لوح، مش صنف جاهز
// على الرف). لكن شارة «متاح/غير متاح» في تقرير العملاء وفي الإكسل كانت
// بتدوّر على الرصيد بنص المقاس الكامل ("90x205 cm (custom)") — مالهوش سطر في
// المخزن، فبترجع صفر، فالشارة بتطلع «غير متاح» أحمر على كل باب مقاس خاص.
// شارة إنذار بتشتغل غلط دايمًا = المصنع بيبطّل ياخد باله منها.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const r = await pg.evaluate(()=>{
  state.stock.rows = [
    { code:'A02', size:'90', qty:7 },
    { code:'A02', size:'70', qty:0 }
  ];
  return {
    عادي_متاح:   stockStatus_('A02','90 cm',3),
    عادي_جزئي:   stockStatus_('A02','90 cm',20),
    عادي_خلصان:  stockStatus_('A02','70 cm',1),
    خاص:         stockStatus_('A02','90x205 cm (custom)',2),
    خاص_عربي:    stockStatus_('A02','90×205 سم (مقاس خاص)',2)
  };
});
check('الباب العادي المتوفر: متاح', r.عادي_متاح && r.عادي_متاح.label==='متاح',
  JSON.stringify(r.عادي_متاح));
check('الكمية أكبر من الرصيد: جزئي', r.عادي_جزئي && /جزئي/.test(r.عادي_جزئي.label),
  JSON.stringify(r.عادي_جزئي));
check('الرصيد صفر: غير متاح', r.عادي_خلصان && r.عادي_خلصان.label==='غير متاح',
  JSON.stringify(r.عادي_خلصان));
check('المقاس الخاص مايتقالش عليه «غير متاح»',
  !(r.خاص && r.خاص.label==='غير متاح'), JSON.stringify(r.خاص));
check('ولا حتى بصيغته العربية',
  !(r.خاص_عربي && r.خاص_عربي.label==='غير متاح'), JSON.stringify(r.خاص_عربي));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
