// معاينة طلب العميل في شاشة المصنع — الزرار جنب PDF.
// بتعرض نفس محتوى الـ PDF على الشاشة من غير ما تشغّل html2canvas ولا jsPDF،
// فبتفتح فورًا. الاختبار بيتأكد إنها بتفتح بنفس عرض A4 (794px) مصغّر ليدخل في
// الشاشة من غير تمرير أفقي، وإنها بتقفل بـ Escape وبالضغط بره.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const URL = process.env.APP_URL || 'http://localhost:8100/index.html';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const check = (n, ok, extra='') => { console.log((ok?'✅':'❌')+' '+n+(extra?'  — '+extra:'')); ok?pass++:fail++; };

await pg.goto(URL, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);

// بيانات بشكل السيرفر بالظبط، وبنستبدل الجلب عشان الاختبار ما يحتاجش الباك إند
await pg.evaluate(() => {
  window.__orders = [{
    id:'X1', date:'2026-09-04', dist:'محمد القرشي', phone:'01067765483', region:'طنطا',
    status:'Received', customer:'ورشة النور للأخشاب', qty:9, total:52000,
    items:[
      {type:'Door', title:'باب A01', code:'A01', size:'70 cm', unit:'door', qty:6, unitPrice:5200, produced:2, frame:'10', dbror:'6×9', width:'70'},
      {type:'Door', title:'باب A05', code:'A05', size:'90 cm', unit:'door', qty:3, unitPrice:5400, produced:0, frame:'15', dbror:'6×9', width:'90'}
    ]
  }];
  window.fetchPendingOrders_ = async () => window.__orders;
  window.loadStock = async () => {};
});

// المكتبات التقيلة لازم تفضل غير محمّلة — دي أهم فايدة في المعاينة
const libsBefore = await pg.evaluate(() => typeof html2canvas !== 'undefined' || !!window.jspdf);

await pg.evaluate(() => previewCustomerOrder_('ورشة النور للأخشاب'));
await pg.waitForTimeout(2000);

check('المعاينة فتحت', !!(await pg.$('#reportPreviewOverlay')));

const info = await pg.evaluate(() => {
  const o = document.getElementById('reportPreviewOverlay');
  if (!o) return null;
  const page = o.querySelector('.rpv-page'), sc = o.querySelector('.rpv-scroll');
  return {
    width: page.offsetWidth,
    scaled: page.style.transform,
    hScroll: sc.scrollWidth > sc.clientWidth + 2,
    hasCustomer: o.textContent.includes('ورشة النور'),
    hasPdfBtn: !!o.querySelector('[data-act="rpv-pdf"]')
  };
});
check('بنفس عرض الـ PDF (794px)', info && info.width === 794, info && String(info.width));
check('مصغّرة لتدخل في الشاشة', info && /scale\(0\./.test(info.scaled), info && info.scaled);
check('مفيش تمرير أفقي', info && !info.hScroll);
check('محتوى التقرير ظاهر', info && info.hasCustomer);
check('فيها زرار «تصدير PDF»', info && info.hasPdfBtn);
check('المكتبات التقيلة ما اتحمّلتش',
  !libsBefore && !(await pg.evaluate(() => typeof html2canvas !== 'undefined' || !!window.jspdf)));

await pg.keyboard.press('Escape');
await pg.waitForTimeout(400);
check('Escape بيقفل المعاينة', !(await pg.$('#reportPreviewOverlay')));

// الضغط بره المعاينة بيقفلها كمان
await pg.evaluate(() => previewCustomerOrder_('ورشة النور للأخشاب'));
await pg.waitForTimeout(1600);
await pg.mouse.click(206, 890);   // منطقة فاضية تحت التقرير
await pg.waitForTimeout(400);
check('الضغط بره بيقفل المعاينة', !(await pg.$('#reportPreviewOverlay')));

check('مفيش أخطاء صفحة', errs.length === 0, errs.join(' | '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail ? 1 : 0);
