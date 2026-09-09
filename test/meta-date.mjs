// تاريخ الطلب لما المصنع يعدّله: الكود كان بيعمل new Date('2026-09-08T00:00:00')
// وبعدين يفرمته بتوقيت القاهرة. لكن new Date على نص بيتقري **بتوقيت مشروع
// الأبس سكريبت** — اللي مش بالضرورة توقيت القاهرة. لو توقيت المشروع مقدّم عن
// القاهرة (طوكيو مثلاً)، التاريخ كان بيرجع يوم لورا: المصنع يكتب ٨/٩ ويتخزّن ٧/٩.
// الاختبار بيشغّل الجزء ده فعليًا وبيقلّد توقيتين مختلفين.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const block = /if \(e\.parameter\.date\) \{[\s\S]*?\n        \}/.exec(gs);
check('لقينا منطق التاريخ في setOrderMeta', !!block);

// شيت وهمي بيسجّل اللي اتكتب
function شغّل(تاريخ, فرق_ساعات_المشروع){
  let مكتوب = null, رد = null;
  const ctx = {
    e: { parameter: { date: تاريخ, id: 'A1' } },
    shOM: { getRange: () => ({ setValue: v => { مكتوب = v; } }) },
    rOM: 5, TZ: 'Africa/Cairo', Number, String, RegExp,
    reply: (o) => { رد = o; return o; },
    cb: '',
    // بيقلّد توقيت مشروع مختلف: التاريخ اللي من غير منطقة بيتقري بالتوقيت ده
    Date: class extends global.Date {
      constructor(...a){
        if(a.length===1 && typeof a[0]==='string' && /T\d/.test(a[0]) && !/[Zz+]/.test(a[0])){
          const ز = فرق_ساعات_المشروع >= 0 ? '+' : '-';
          const س = String(Math.abs(فرق_ساعات_المشروع)).padStart(2,'0');
          super(a[0] + ز + س + ':00');
        } else super(...a);
      }
    },
    Utilities: { formatDate: (d) => {   // فرمتة بتوقيت القاهرة (+2)
      const t = new global.Date(d.getTime() + 2*3600*1000);
      return t.toISOString().slice(0,10);
    }}
  };
  vm.createContext(ctx);
  vm.runInContext('(function(){ ' + block[0] + ' })()', ctx);
  return { مكتوب, رد };
}

// المشروع بتوقيت القاهرة (+2) — الحالة العادية
{
  const r = شغّل('2026-09-08', 2);
  check('التاريخ بيتخزّن زي ما هو (توقيت المشروع = القاهرة)', r.مكتوب === '2026-09-08', String(r.مكتوب));
}
// المشروع بتوقيت طوكيو (+9) — ده اللي كان بيكسر
{
  const r = شغّل('2026-09-08', 9);
  check('ونفس التاريخ حتى لو توقيت المشروع مقدّم (طوكيو)', r.مكتوب === '2026-09-08', String(r.مكتوب));
}
// المشروع بتوقيت لوس أنجلوس (-7)
{
  const r = شغّل('2026-09-08', -7);
  check('ونفس التاريخ لو توقيت المشروع متأخر', r.مكتوب === '2026-09-08', String(r.مكتوب));
}
// تواريخ مش صالحة بتترفض بدل ما تتكتب
['2026-9-8', '08/09/2026', 'اليوم', '2026-13-01', '2026-09-45', '=CMD()'].forEach(t=>{
  const r = شغّل(t, 2);
  check('التاريخ الغلط بيترفض: ' + t, r.مكتوب === null && r.رد && r.رد.ok === false,
    'اتكتب: ' + String(r.مكتوب));
});

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
