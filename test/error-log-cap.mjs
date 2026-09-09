// تبويب الأخطاء كان بيكبر للأبد: أي مشكلة متكررة بتكتب سطر جديد كل مرة.
// حد الخلايا في جوجل شيت مشترك بين كل التبويبات، فالسجل المتضخّم ممكن يزاحم
// الطلبات نفسها. الاختبار بيشغّل logError_ فعليًا على شيت وهمي.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const src = /function logError_\(err\) \{[\s\S]*?\n\}/.exec(gs);
const keep = Number(/var ERR_KEEP_ = (\d+)/.exec(gs)[1]);
check('لقينا الدالة والحد', !!src && keep>0, 'الحد='+keep);

function شغّل(عدد_مرات, بادئ){
  const rows = [['Timestamp','Error']];
  for(let i=0;i<بادئ;i++) rows.push([new Date(), 'قديم '+i]);
  let مسحات = 0;
  const sh = {
    appendRow: r => rows.push(r),
    getLastRow: () => rows.length,
    deleteRows: (pos, n) => { مسحات++; rows.splice(pos-1, n); },
    setRightToLeft(){}, setFrozenRows(){}
  };
  const ctx = { SHEET_ERRORS:'Errors', ERR_KEEP_: keep, String, Date, Number,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: ()=>sh, insertSheet: ()=>sh }) } };
  vm.createContext(ctx);
  vm.runInContext(src[0], ctx);
  for(let i=0;i<عدد_مرات;i++) vm.runInContext('logError_("خطأ ' + i + '")', ctx);
  return { سطور: rows.length-1, مسحات, أول: rows[1] && rows[1][1], آخر: rows[rows.length-1][1] };
}

{
  const r = شغّل(5, 0);
  check('الأخطاء بتتسجّل عادي تحت الحد', r.سطور===5 && r.مسحات===0, JSON.stringify(r));
}
{
  const r = شغّل(20, keep);            // الشيت مليان خلاص + ٢٠ خطأ جديد
  check('السجل مابيعدّيش الحد', r.سطور===keep, 'سطور='+r.سطور+' الحد='+keep);
  check('والأقدم هو اللي بيتمسح', !/قديم 0/.test(String(r.أول)), 'أول سطر: '+r.أول);
  check('وآخر خطأ لسه موجود', /خطأ 19/.test(String(r.آخر)), 'آخر سطر: '+r.آخر);
}
{
  const r = شغّل(1, keep + 300);       // شيت متضخّم من نسخة قديمة
  check('شيت متضخّم بيترجع للحد بمسح واحد', r.سطور===keep && r.مسحات===1,
    'سطور='+r.سطور+' مسحات='+r.مسحات);
}
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
