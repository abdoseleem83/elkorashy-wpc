// دمج أعواد الحلق في سطر واحد (قوائم + عوارض بأطوال مختلفة) شغّال في السلة،
// لكن السطر ده لما بيرجع من السيرفر للتعديل كان بيفقد علامته — فالسلة تعرضه
// «٩ عود × ٢٠٠ سم» والحقيقة إن ٣ منهم عوارض ١٢٠ سم. المصنع ممكن يقطّع تلات
// أعواد أطول ٨٠ سم من اللازم. الأطوال موجودة في وصف الصنف بس مكانتش بتتعرض.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// السيرفر مابيكتبش طول واحد على سطر أعواده مختلفة
check('السيرفر بيكتب وحدة «rods» للسطر المدموج مش «rod 200cm»',
  /it\.customSet \? 'rods'/.test(gs));

const مدموج = (unit, size) => ({ type:'Frame', title:'Door Frame 10 cm', code:'A01',
  size, unit, qty:9, unitPrice:204.2, produced:0 });

const r = await pg.evaluate(({وحدة_جديدة, وحدة_قديمة})=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  const جرّب = (صنف)=>{
    adminEditOrderWith_({ id:'W1', dist:'ا', phone:'01', customer:'ع', date:'2026-09-15' }, [صنف]);
    const it = state.cart[0];
    const spec = (viewCart().match(/<div class="spec">([\s\S]*?)<\/div>/)||[])[1] || '';
    return { customSet: !!it.customSet, rodCm: it.rodCm, عرض: spec.replace(/<[^>]*>/g,' ') };
  };
  return { جديد: جرّب(وحدة_جديدة), قديم: جرّب(وحدة_قديمة) };
}, {
  وحدة_جديدة: مدموج('rods', 'قائم 200 سم × 6 + عارضة حلق علوية 120 سم × 3 — A01'),
  وحدة_قديمة: مدموج('rod 200cm', 'قائم 200 سم × 6 + عارضة حلق علوية 120 سم × 3 — A01')
});

for(const [اسم, v] of [['بالوحدة الجديدة', r.جديد], ['وللطلبات القديمة اللي على الشيت', r.قديم]]){
  check('السطر المدموج بيرجع بعلامته '+اسم, v.customSet === true);
  check('ومابيدّعيش طول واحد لكل الأعواد '+اسم, !v.rodCm, String(v.rodCm));
  check('والسلة بتعرض الأطوال بالتفصيل '+اسم,
    /قائم 200 سم × 6/.test(v.عرض) && /عارضة حلق علوية 120 سم × 3/.test(v.عرض), v.عرض.trim());
  check('ومابتقولش «× 200 سم» على التسعة '+اسم, !/9 عود × 200/.test(v.عرض), v.عرض.trim());
}

// الأعواد العادية والبرور مايتلخبطوش مع الدمج
const عادي = await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  const جرّب = (صنف)=>{ adminEditOrderWith_({id:'W2',dist:'ا',phone:'01',customer:'ع',date:'2026-09-15'},[صنف]);
    const it=state.cart[0]; return { customSet: !!it.customSet, rodCm: it.rodCm }; };
  return {
    أعواد: جرّب({type:'Frame', title:'f', code:'A01', size:'10 سم — 220 سم — A01', unit:'rod 220cm', qty:4, unitPrice:100}),
    برور:  جرّب({type:'Bror',  title:'b', code:'A01', size:'6×9 — 215 سم — A01', unit:'rod 215cm', qty:3, unitPrice:80})
  };
});
check('الأعواد العادية مش بتتحسب مدموجة', عادي.أعواد.customSet===false && عادي.أعواد.rodCm===220,
  JSON.stringify(عادي.أعواد));
check('والبرور «6×9» مابيتلخبطش مع علامة الدمج', عادي.برور.customSet===false && عادي.برور.rodCm===215,
  JSON.stringify(عادي.برور));

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
