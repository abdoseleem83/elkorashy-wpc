// readOrderRows_ بتقرا جدول الطلبات على قطعتين وبتعدّي تلات أعمدة تقيلة
// (Pricing Terms / Message / Status Updated) عشان مش محتاجينها في القايمة.
// الأرقام كانت مكتوبة بالنص: اقرا ١٢ عمود، ابدأ التاني من ١٦، حط ٣ خانات
// فاضية في النص.
//
// الترزيع مكانش هو الخطر (مؤشر الخرج = العمود الفعلي، فالاتنين بيزحزحوا
// مع بعض). الخطر إن الخانات الفاضية بتتحط على الأعمدة ١٣ و١٤ و١٥ **الفعلية**
// أيًا كانت. فأول ما حد يزوّد عمود في نص الجدول، تلات أعمدة تانية خلاص
// بتتقري فاضية على طول — مثلًا «Note to Distributor» (ملاحظة المصنع للموزّع)
// تختفي من كل طلب، والعمود الجديد نفسه يرجع فاضي. مفيش أي خطأ، مفيش أي
// علامة — بس بيانات ناقصة في كل مكان.
//
// دلوقتي موضع الفجوة مشتق من أسامي الأعمدة، فبيزحزح معاها.
import fs from 'node:fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');

// شيت مزيّف: كل خانة فيها اسم عمودها عشان نعرف اللي وقع مكان مين
function شيت(headers, صفوف){
  return {
    getLastRow: () => صفوف.length + 1,
    getRange: (r, c, n, w) => ({
      getValues: () => صفوف.slice(r-2, r-2+n).map(row => row.slice(c-1, c-1+w))
    })
  };
}

function شغّل(headers, صفوف){
  const ctx = { HEAD_ORDERS: headers };
  vm.createContext(ctx);
  const كتلة = /var GAP_COLS_[\s\S]*?\n\}\)\(\);/.exec(gs)[0];
  const دالة = /function readOrderRows_\([\s\S]*?\n\}/.exec(gs)[0];
  vm.runInContext(كتلة + '\n' + دالة, ctx);
  ctx.__sh = شيت(headers, صفوف);
  return vm.runInContext('readOrderRows_(__sh)', ctx);
}

const HEAD = ['Order No','Date','Time','Distributor','Phone','Region','Warehouse',
  'Total Qty','Total Rods','Total Amount','Status','Note to Distributor',
  'Pricing Terms','Message','Status Updated',
  'Archived','Customer','Order Note','Customer Phone','Superseded','Replaces Order',
  'Display No','Edit Count','Edited At'];

// ═══ ١) الجدول الحالي ═══
const صف = HEAD.map(h => 'قيمة:' + h);
let r = شغّل(HEAD, [صف]);
const GAP = ['Pricing Terms','Message','Status Updated'];
const مؤشر = h => HEAD.indexOf(h);
check('كل خانة في مؤشرها الصح', r[0].length === HEAD.length, `${r[0].length} من ${HEAD.length}`);
['Order No','Status','Archived','Customer','Display No','Edited At'].forEach(h=>{
  check(`«${h}» بيتقري صح`, r[0][مؤشر(h)] === 'قيمة:' + h, String(r[0][مؤشر(h)]));
});
['Pricing Terms','Message','Status Updated'].forEach(h=>{
  check(`«${h}» بيتعدّى (فاضي) — ده المقصود`, r[0][مؤشر(h)] === '', String(r[0][مؤشر(h)]));
});

// ═══ ٢) حد زوّد عمود في نص الجدول — ده اللي كان بيكسر كل حاجة ═══
const HEAD2 = HEAD.slice(0, 12).concat(['Delivery Window'], HEAD.slice(12));
const صف2 = HEAD2.map(h => 'قيمة:' + h);
r = شغّل(HEAD2, [صف2]);
const مؤشر2 = h => HEAD2.indexOf(h);
check('بعد زيادة عمود: الطول لسه صح', r[0].length === HEAD2.length, `${r[0].length} من ${HEAD2.length}`);
['Status','Archived','Customer','Display No','Delivery Window'].forEach(h=>{
  check(`وبعد الزيادة «${h}» لسه في مكانه`, r[0][مؤشر2(h)] === 'قيمة:' + h, String(r[0][مؤشر2(h)]));
});
check('والفجوة زحزحت معاه',
  r[0][مؤشر2('Pricing Terms')] === '' && r[0][مؤشر2('Message')] === ''
  && r[0][مؤشر2('Status Updated')] === '');

// ═══ ٢ب) عمود جديد قبل الفجوة — الحالة اللي كانت بتبلّع ٣ أعمدة ═══
const HEAD2b = HEAD.slice(0, 6).concat(['Branch'], HEAD.slice(6));
r = شغّل(HEAD2b, [HEAD2b.map(h => 'قيمة:' + h)]);
const مؤشر2b = h => HEAD2b.indexOf(h);
// اللي كان بيتبلّع في الكود القديم: الأعمدة الفعلية ١٣ و١٤ و١٥ بعد الزحزقة
['Note to Distributor','Branch','Archived','Status'].forEach(h=>{
  check(`عمود في النص: «${h}» مش بيرجع فاضي`,
    r[0][مؤشر2b(h)] === 'قيمة:' + h, JSON.stringify(r[0][مؤشر2b(h)]));
});
check('ومحدش غير التلاتة التقيلة بيرجع فاضي',
  r[0].every((v,i)=> GAP.includes(HEAD2b[i]) ? v === '' : v === 'قيمة:' + HEAD2b[i]),
  r[0].map((v,i)=>v===''?HEAD2b[i]:null).filter(Boolean).join(' · '));

// ═══ ٣) الأعمدة التقيلة ماعادتش ورا بعض → اقرا الكل بدل ما تترزّع ═══
const HEAD3 = ['Order No','Date','Pricing Terms','Region','Message','Status Updated','Status'];
const صف3 = HEAD3.map(h => 'قيمة:' + h);
r = شغّل(HEAD3, [صف3]);
check('مش ورا بعض: بتقرا الجدول كله',
  r[0].length === HEAD3.length && r[0].every((v,i)=>v === 'قيمة:' + HEAD3[i]),
  JSON.stringify(r[0]));

// ═══ ٤) جدول فاضي ═══
check('جدول فاضي بيرجّع قايمة فاضية', JSON.stringify(شغّل(HEAD, [])) === '[]');

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
