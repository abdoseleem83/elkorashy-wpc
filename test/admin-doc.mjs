// مستند المصنع بيتبني من بيانات السيرفر (إنجليزية) — بيتأكد إن الوحدات والمقاسات
// بتتعرّب صح، وخصوصًا إن «الحلق الكامل» بيتكتب «طقم» مش «عود» (الطقم = ٣ عيدان).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = process.env.APP_URL || 'http://localhost:8100/index.html';
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL,{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1200);

const rows = await pg.evaluate(()=>{
  const order = {id:'X1', date:'2026-09-04', dist:'محمد', phone:'01', region:'طنطا', total:0, customer:'ورشة'};
  const items = [
    {type:'Frame',     title:'حلق A01', code:'A01', size:'10 cm', unit:'set',       qty:5, unitPrice:780, produced:0},
    {type:'Bror',      title:'برور A01', code:'A01', size:'6x9',  unit:'rod 226cm', qty:8, unitPrice:120, produced:0},
    {type:'Accessory', title:'Smart Lock', code:'', size:'',      unit:'pc',        qty:4, unitPrice:450, produced:0},
  ];
  const p=document.getElementById('paper');
  p.innerHTML = docHTML(buildAdminDocOrder_(order, items),'order');
  // جدول الأصناف هو اللي فيه ترويسة بعمود «الكمية» — بنمسك صفوفه بس،
  // مش صفوف جدول بيانات العميل اللي فوق.
  const tbl = [...document.querySelectorAll('#paper table')]
    .find(t => t.textContent.includes('الكمية'));
  return [...tbl.querySelectorAll('tr')]
    .map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim()))
    .filter(c=>c.length>3 && /^\d+$/.test(c[0]));   // صفوف الأصناف بس (أولها رقم مسلسل)
});
let pass=0, fail=0;
const check=(n,ok,extra='')=>{ console.log((ok?'✅':'❌')+' '+n+(extra?'  — '+extra:'')); ok?pass++:fail++; };

const qtyCol = rows.map(r=>r[2]);
check('الحلق الكامل بيتكتب «طقم» مش «عود»', qtyCol[0]==='5 طقم', qtyCol[0]);
check('البرور بالعود',                        qtyCol[1]==='8 عود', qtyCol[1]);
check('الإكسسوار «قطعة» مش «pc»',              qtyCol[2]==='4 قطعة', qtyCol[2]);
check('مقاس الحلق متعرّب',                     rows[0][1].includes('10 سم'), rows[0][1]);
check('مفيش أي «cm» إنجليزي في المستند',       !rows.some(r=>r.join(' ').includes(' cm')));
check('مفيش أخطاء صفحة',                       errs.length===0, errs.join(' | '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
