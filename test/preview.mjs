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
    id:'2026-0417', displayNo:417, editCount:2, date:'2026-09-04',
    dist:'محمد القرشي', phone:'01067765483', region:'طنطا',
    status:'Received', customer:'ورشة النور للأخشاب', qty:9, total:52000,
    items:[
      {type:'Door', title:'باب A01', code:'A01', size:'70 cm', unit:'door', qty:6, unitPrice:5200, produced:2, frame:'10', dbror:'6×9', width:'70'},
      {type:'Door', title:'باب A05', code:'A05', size:'90 cm', unit:'door', qty:3, unitPrice:5400, produced:0, frame:'15', dbror:'6×9', width:'90'},
      {type:'Frame', title:'حلق A01', code:'A01', size:'10 cm', unit:'set', qty:4, unitPrice:780, produced:0},
      {type:'Accessory', title:'WPC Door Hinge', code:'', size:'', unit:'pc', qty:12, unitPrice:35, produced:0}
    ]
  }];
  // المعاينة بقت بتقرا من بيانات الشاشة مباشرة (مش من السيرفر)، فبنحطّها هناك
  state.admin.open = true;
  state.admin.rows = window.__orders;
  window.__orders.forEach(o => { state.admin.items[o.id] = o.items; });
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
    hasPdfBtn: !!o.querySelector('[data-act="rpv-pdf"]'),
    // شكل مستند «طلب أوردر» مش تقرير الأبواب المعلّقة
    isOrderDoc: o.textContent.includes('طلب أوردر') && !o.textContent.includes('تقرير الأبواب المعلّقة'),
    // شريط رقم الأوردر: في النص، أحمر، تقيل، وكبير
    band: (() => {
      // الطلب معدّل مرتين، فالرقم بيبان مركّب: «417/2»
      const el = [...o.querySelectorAll('div')].find(d => d.textContent.trim() === '417/2');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight, align: cs.textAlign };
    })(),
    hasEditBadge: o.textContent.includes('التعديل رقم 2 — بتاريخ'),
    // التعريب اللي اتصلّح قبل كده لازم يفضل شغّال في المعاينة
    setUnitAr: o.textContent.includes('4 طقم'),
    accNameAr: o.textContent.includes('مفصلة') && !o.textContent.includes('WPC Door Hinge')
  };
});
check('بنفس عرض الـ PDF (794px)', info && info.width === 794, info && String(info.width));
check('مصغّرة لتدخل في الشاشة', info && /scale\(0\./.test(info.scaled), info && info.scaled);
check('مفيش تمرير أفقي', info && !info.hScroll);
check('محتوى التقرير ظاهر', info && info.hasCustomer);
check('فيها زرار «تصدير PDF»', info && info.hasPdfBtn);
check('بشكل مستند «طلب أوردر»', info && info.isOrderDoc);
check('رقم الأوردر «417/2» ظاهر في النص', info && info.band && info.band.align === 'center');
check('رقم الأوردر أحمر', info && info.band && info.band.color === 'rgb(179, 38, 30)', info && info.band && info.band.color);
check('رقم الأوردر تقيل (900)', info && info.band && info.band.weight === '900', info && info.band && info.band.weight);
check('رقم الأوردر كبير (≥32px)', info && info.band && info.band.size >= 32, info && info.band && info.band.size + 'px');
check('سطر «التعديل رقم N — بتاريخ» ظاهر', info && info.hasEditBadge);
check('الحلق الكامل «طقم» مش «عود»', info && info.setUnitAr);
check('اسم الإكسسوار متعرّب', info && info.accNameAr);
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
