// رقم الطلب لازم يبقى واحد في كل مكان: شاشة الموزع، شاشة المصنع، والمستند المطبوع.
// قبل الإصلاح الشاشات كانت بتعرض الكود الداخلي (2026-0417) والمستند بيعرض
// الرقم التسلسلي (417) — رقمين مختلفين لنفس الطلب.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.APP_URL || 'http://localhost:8100/index.html';
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const check = (n, ok, x='') => { console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

await pg.goto(URL, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1300);

// ---- شاشة الموزع «تابع طلبك» ----
const dist = await pg.evaluate(() => {
  state.orders = [
    { id:'2026-0417', displayNo:417, editCount:2, ts:Date.now(), name:'محمد', phone:'01', region:'طنطا',
      customer:'ورشة النور', total:5000, items:[{kind:'door',title:'باب A01',qty:6}] },
    { id:'2026-0418', displayNo:418, editCount:0, ts:Date.now(), name:'محمد', phone:'01', region:'طنطا',
      customer:'نجارة الأمل', total:2000, items:[{kind:'door',title:'باب A05',qty:2}] },
    // طلب قديم لسه ما وصلوش رقم من السيرفر — لازم يقع على الكود الداخلي من غير ما يكسر
    { id:'2026-0419', ts:Date.now(), name:'محمد', phone:'01', region:'طنطا',
      customer:'عميل', total:1000, items:[{kind:'door',title:'باب',qty:1}] }
  ];
  state.tab = 'orders'; renderNow();
  return [...document.querySelectorAll('.oid')].map(e => e.textContent.trim());
});
check('الطلب المعدّل بيبان «417/2»', dist[0] === '417/2', dist[0]);
check('الطلب العادي بيبان «418»', dist[1] === '418', dist[1]);
check('الطلب اللي مالوش رقم بيقع على الكود الداخلي', dist[2] === '#2026-0419', dist[2]);
check('الكود الداخلي مش ظاهر للمعدّل', !dist[0].includes('2026'), dist[0]);
check('بادج «معدّل» ظاهر مرة واحدة',
  (await pg.evaluate(() => (document.getElementById('view').textContent.match(/معدّل/g)||[]).length)) === 1);

// ---- شاشة المصنع ----
const adm = await pg.evaluate(() => {
  state.admin.open = true;
  state.admin.rows = [
    { id:'2026-0417', displayNo:417, editCount:2, date:'2026-09-04', dist:'محمد', phone:'01',
      region:'طنطا', status:'Received', customer:'ورشة النور', qty:6, total:5000 }
  ];
  state.admin.groupOpen['ورشة النور'] = true;
  state.tab = 'admin'; renderNow();
  return [...document.querySelectorAll('.oid')].map(e => e.textContent.trim());
});
check('شاشة المصنع بتعرض نفس الرقم «417/2»', adm.includes('417/2'), adm.join(' , '));

// ---- المستند ----
const doc = await pg.evaluate(() => {
  const o = buildAdminDocOrder_(
    { id:'2026-0417', displayNo:417, editCount:2, editedAt:'2026-09-04', date:'2026-08-28',
      dist:'محمد', phone:'01', region:'طنطا', customer:'ورشة النور', total:5000 },
    [{ type:'Door', title:'باب A01', code:'A01', size:'70 cm', unit:'door', qty:6, unitPrice:5200, produced:0 }]
  );
  const p = document.getElementById('paper');
  p.innerHTML = docHTML(o, 'order');
  return [...p.querySelectorAll('div')]
    .filter(d => getComputedStyle(d).fontSize === '38px')
    .map(d => d.textContent.trim());
});
check('المستند بيعرض نفس الرقم «417/2»', doc.includes('417/2'), doc.join(' , '));
check('الرقم واحد في الشاشتين والمستند', dist[0] === adm[0] && adm[0] === doc[0],
      `الموزع ${dist[0]} · المصنع ${adm[0]} · المستند ${doc[0]}`);

check('مفيش أخطاء صفحة', errs.length === 0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail ? 1 : 0);
