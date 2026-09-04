// شاشة المصنع لازم تفتح فورًا من آخر نسخة محفوظة وتتحدّث في الخلفية،
// بدل ما تفضل فاضية بتلف لحد ما Apps Script يرد (بطيء بطبعه).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.APP_URL || 'http://localhost:8100/index.html';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const check = (n, ok, x='') => { console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

await pg.goto(URL, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1300);

const ROWS = [
  { id:'2026-0052', displayNo:52, editCount:1, editedAt:'2026-09-04', date:'2026-08-28',
    dist:'محمد القرشي', phone:'01067765483', region:'طنطا', status:'Received',
    customer:'ورشة النور للأخشاب', qty:9, total:52000 },
  { id:'2026-0061', displayNo:61, editCount:0, date:'2026-09-01',
    dist:'أحمد سعيد', phone:'01011112222', region:'المحلة', status:'New',
    customer:'نجارة الأمل', qty:4, total:20000 }
];

// نحاكي جلسة سابقة ناجحة: القايمة اتحفظت في الكاش
await pg.evaluate(rows => { saveAdminCache_(rows); }, ROWS);
check('الكاش اتحفظ', !!(await pg.evaluate(() => loadAdminCache_())));

// دلوقتي نفتح الشاشة والسيرفر مش بيرد (زي نت بطيء) — لازم تفتح فورًا من الكاش
await pg.evaluate(() => {
  window.__resolveList = null;
  window.jsonp = () => new Promise(res => { window.__resolveList = res; });   // معلّق عمدًا
  state.admin.pw = '1234';
  state.tab = 'admin';
});
const t0 = Date.now();
await pg.evaluate(() => { adminLoad(); });          // من غير await — بنقيس اللحظة الأولى
await pg.waitForTimeout(600);
const took = Date.now() - t0;

const st = await pg.evaluate(() => ({
  open: state.admin.open,
  count: (state.admin.rows||[]).length,
  stale: !!state.admin.staleAt,
  loading: state.admin.loading,
  text: document.getElementById('view').textContent
}));
check('الشاشة فتحت والسيرفر لسه ما ردّش', st.open, took + 'ms');
check('الطلبات ظاهرة من الكاش', st.count === 2, String(st.count));
check('متعلّم إنها نسخة محفوظة', st.stale);
check('بيوضّح للمستخدم إنه بيحدّث', st.text.includes('بيتحدّث من المصنع دلوقتي'));
check('أسماء العملاء ظاهرة', st.text.includes('ورشة النور') && st.text.includes('نجارة الأمل'));

// السيرفر رد أخيرًا ببيانات جديدة
await pg.evaluate(() => window.__resolveList({ ok:true, orders:[
  { id:'2026-0070', displayNo:70, editCount:0, date:'2026-09-05', dist:'موزع جديد',
    phone:'01099998888', region:'كفر الشيخ', status:'New', customer:'عميل جديد', qty:2, total:9000 }
]}));
await pg.waitForTimeout(700);
const st2 = await pg.evaluate(() => ({
  count: (state.admin.rows||[]).length,
  stale: !!state.admin.staleAt,
  text: document.getElementById('view').textContent,
  cached: (loadAdminCache_()||{rows:[]}).rows.length
}));
check('البيانات اتحدّثت من السيرفر', st2.count === 1 && st2.text.includes('عميل جديد'));
check('علامة «نسخة محفوظة» اختفت', !st2.stale);
check('الكاش اتحدّث للنسخة الجديدة', st2.cached === 1, String(st2.cached));

// الخروج بيمسح بيانات المصنع من الجهاز
await pg.evaluate(() => clearAdminCache_());
check('الخروج بيمسح الكاش', !(await pg.evaluate(() => loadAdminCache_())));

check('مفيش أخطاء صفحة', errs.length === 0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail ? 1 : 0);
