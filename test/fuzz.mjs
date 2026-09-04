// اختبار عشوائي مكثّف لدوال التحليل والحساب اللي بتغذّي مستندات المصنع:
// تحليل المقاسات، الجاهز/المتبقي، التسعير، أرقام الموبايل، الهروب من HTML.
// آلاف الحالات — بما فيها مدخلات بايظة (فاضي، null، عربي، محاولات حقن).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const out = await pg.evaluate(() => {
  const bad = [];
  const note = (fn, inp, got, why) => bad.push({fn, inp: JSON.stringify(inp), got: JSON.stringify(got), why});

  // ---------- ١) doorWH_ : تحليل المقاس لعرض وارتفاع ----------
  // الصيغ اللي السيرفر بيخزّنها: "70 cm" أو "75x209 cm (custom)"
  for (let w = 40; w <= 200; w++) {
    const r = doorWH_(w + ' cm', 0);
    if (r.w !== w) note('doorWH_', w+' cm', r, 'العرض غلط');
    if (r.h !== DOOR_STD_HEIGHT) note('doorWH_', w+' cm', r, 'الارتفاع مش الاستاندر');
    const r2 = doorWH_(w + ' cm', 205);
    if (r2.h !== 205) note('doorWH_', [w+' cm', 205], r2, 'الارتفاع المخصص اتجاهل');
    for (const h of [180, 205, 209, 240]) {
      const c = doorWH_(w + 'x' + h + ' cm (custom)', 0);
      if (c.w !== w || c.h !== h) note('doorWH_', w+'x'+h+' cm (custom)', c, 'مقاس خاص اتحلّل غلط');
    }
  }
  // مدخلات بايظة لازم ترجع فاضي من غير ما ترمي
  for (const junk of ['', null, undefined, '  ', 'abc', '70', '70cm', 'cm 70', '70 سم',
                      '70 x cm', 'x209 cm (custom)', '<script>', '٧٠ cm', '-70 cm', '70.5 cm']) {
    let r; try { r = doorWH_(junk, 0); } catch(e){ note('doorWH_', junk, 'رمى: '+e.message, 'مرمّاش المفروض'); continue; }
    if (typeof r !== 'object' || !('w' in r) || !('h' in r)) note('doorWH_', junk, r, 'شكل الرد غلط');
  }

  // ---------- ٢) arabicSizeText_ : تعريب المقاس ----------
  for (let w = 40; w <= 200; w++) {
    if (arabicSizeText_(w + ' cm') !== w + ' سم') note('arabicSizeText_', w+' cm', arabicSizeText_(w+' cm'), 'مااتعرّبش');
  }
  // اللي مش على الصيغة لازم يرجع زي ما هو (مش يتبهدل)
  for (const s of ['6x9', '6×9', '', 'حلق كامل', '10 سم']) {
    if (arabicSizeText_(s) !== s) note('arabicSizeText_', s, arabicSizeText_(s), 'اتغيّر وهو المفروض يفضل زي ما هو');
  }

  // ---------- ٣) itemProdPending_ : الجاهز والمتبقي ----------
  for (let q = 0; q <= 50; q++) {
    for (const p of [-5, 0, 1, q-1, q, q+1, q+100, null, undefined, NaN, '3', '']) {
      const r = itemProdPending_({qty:q, produced:p});
      if (r.produced < 0) note('itemProdPending_', {q,p}, r, 'الجاهز بالسالب');
      if (r.produced > q) note('itemProdPending_', {q,p}, r, 'الجاهز أكبر من المطلوب');
      if (r.pending < 0) note('itemProdPending_', {q,p}, r, 'المتبقي بالسالب');
      if (r.produced + r.pending !== q) note('itemProdPending_', {q,p}, r, 'الجاهز + المتبقي ≠ المطلوب');
    }
  }

  // ---------- ٤) priceForWidth : السعر لازم يزيد مع المقاس مايقلّش ----------
  let prev = 0;
  for (let w = 1; w <= 200; w++) {
    const p = priceForWidth(w, false);
    if (!(p > 0)) note('priceForWidth', w, p, 'سعر مش موجب');
    if (p < prev) note('priceForWidth', w, p, 'السعر قلّ مع إن المقاس كبر');
    prev = p;
    const ph = priceForWidth(w, true);
    if (ph - p !== HAFR_EXTRA) note('priceForWidth', w, {p, ph}, 'فرق الحفر مش ثابت');
  }

  // ---------- ٥) rodPrice : سعر العود بالمتر الطولي ----------
  for (const perM of [117.81, 144.14, 170.47, 0, 1000]) {
    for (const cm of [110, 220, 226, 300, 1, 0, null, undefined, '220']) {
      const r = rodPrice(perM, cm);
      if (!isFinite(r)) note('rodPrice', {perM, cm}, r, 'نتيجة مش رقم');
      if (r < 0) note('rodPrice', {perM, cm}, r, 'سعر بالسالب');
      // لازم يكون مقرّب لخانتين عشريتين
      if (Math.abs(r * 100 - Math.round(r * 100)) > 1e-9) note('rodPrice', {perM, cm}, r, 'مش مقرّب لقرشين');
    }
  }
  // ٢٢٠ سم لازم يبقى ضعف ١١٠ سم بالظبط
  for (const perM of [117.81, 144.14, 170.47]) {
    const a = rodPrice(perM, 110), c = rodPrice(perM, 220);
    if (Math.abs(c - a*2) > 0.02) note('rodPrice', perM, {c110:a, c220:c}, '٢٢٠ مش ضعف ١١٠');
  }

  // ---------- ٦) phoneOk : أرقام الموبايل المصرية ----------
  const okPhones = ['01012345678','01112345678','01212345678','01512345678','1012345678'];
  const badPhones = ['0101234567','010123456789','02012345678','','abc','٠١٠١٢٣٤٥٦٧٨',
                     '0101234567a','+201012345678'];
  okPhones.forEach(p => { if (!phoneOk(p)) note('phoneOk', p, false, 'رقم صحيح اترفض'); });
  badPhones.forEach(p => { if (phoneOk(p)) note('phoneOk', p, true, 'رقم غلط اتقبل'); });

  // ---------- ٧) money : تنسيق الفلوس ----------
  for (const v of [0, 1, 0.5, 0.005, 1234.567, 1e6, -5, null, undefined, NaN, '1234']) {
    const m = money(v);
    if (typeof m !== 'string') note('money', v, m, 'مش نص');
    if (/[٠-٩]/.test(m)) note('money', v, m, 'أرقام عربية في مكان بيتقارن فيه بالإنجليزي');
  }

  // ---------- ٨) esc : الهروب من HTML ----------
  const attacks = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>',
                   "'; drop table--", '&lt;', '<>&"\''];
  attacks.forEach(a => {
    const e = esc(a);
    if (/[<>]/.test(e)) note('esc', a, e, 'لسه فيه < أو >');
    if (/["']/.test(e)) note('esc', a, e, 'لسه فيه علامات تنصيص');
  });

  // ---------- ٩) sortSizeKeys_ : ترتيب المقاسات ----------
  const keys = ['100 سم','70 سم','90 سم','80 سم','75×209 سم (مقاس خاص — مقاس الفتحة المعمارية)'];
  const sorted = sortSizeKeys_(keys.slice());
  if (sorted.length !== keys.length) note('sortSizeKeys_', keys, sorted, 'ضاعت مقاسات في الترتيب');
  // القاعدة: المقاسات الاستاندر مرتّبة تصاعدي الأول، والمقاسات الخاصة في الآخر (عن قصد)
  const isStd = k => /^\d+\s*سم$/.test(k);
  const stdNums = sorted.filter(isStd).map(k => parseInt(k));
  for (let i = 1; i < stdNums.length; i++)
    if (stdNums[i] < stdNums[i-1]) note('sortSizeKeys_', keys, sorted, 'الاستاندر مش مرتّب تصاعدي');
  const firstCustom = sorted.findIndex(k => !isStd(k));
  if (firstCustom !== -1 && sorted.slice(firstCustom).some(isStd))
    note('sortSizeKeys_', keys, sorted, 'مقاس استاندر جه بعد مقاس خاص');

  // ---------- ١٠) orderNoText_ : رقم الطلب ----------
  const cases = [
    [{displayNo:52, editCount:0}, '52'], [{displayNo:52, editCount:1}, '52/1'],
    [{displayNo:52, editCount:'2'}, '52/2'], [{displayNo:52}, '52'],
    [{id:'X1'}, '#X1'], [{id:'X1', displayNo:'', editCount:3}, '#X1'],
  ];
  cases.forEach(([o, want]) => { const g = orderNoText_(o); if (g !== want) note('orderNoText_', o, g, 'المتوقع '+want); });

  return bad;
});

console.log(out.length === 0
  ? '✅ كل الفحوصات العشوائية نجحت — مفيش أي حالة بايظة'
  : '❌ ' + out.length + ' حالة بايظة:');
const seen = new Set();
out.forEach(x => { const k = x.fn+'|'+x.why; if (seen.has(k)) return; seen.add(k);
  console.log(`  • ${x.fn}(${x.inp}) → ${x.got}   [${x.why}]`); });
if (out.length > seen.size) console.log(`  (اتعرضت ${seen.size} حالة مميزة من ${out.length})`);
await b.close();
process.exit(out.length ? 1 : 0);
