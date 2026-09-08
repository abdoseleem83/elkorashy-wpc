// مسح سطور الطلب قبل إعادة كتابته: كان بيمسح سطر سطر — طلب فيه ٢٠ سطر = ٢٠ نداء
// لـ Sheets على مسار بيتنفّذ مع كل حفظ. الاختبار بيشغّل الدالة فعليًا على شيت وهمي.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const src = /function clearItemRows_\(sh, id\) \{[\s\S]*?\n\}/.exec(gs);
check('لقينا الدالة', !!src);

// شيت وهمي: صف رقم ١ ترويسة، والباقي معرّفات الطلبات
function شيت(معرفات){
  const st = { rows: ['HEAD'].concat(معرفات), نداءات:0 };
  const sh = {
    getLastRow: () => st.rows.length,
    getRange: (r,c,n) => ({ getValues: () => st.rows.slice(r-1, r-1+n).map(v=>[v]) }),
    deleteRows: (pos, howMany) => { st.نداءات++; st.rows.splice(pos-1, howMany); },
    deleteRow: (pos) => { st.نداءات++; st.rows.splice(pos-1, 1); }
  };
  return { sh, st };
}
function شغّل(معرفات, id){
  const { sh, st } = شيت(معرفات);
  const ctx = { sh, id, String, Number };
  vm.createContext(ctx);
  vm.runInContext(src[0] + '\nclearItemRows_(sh, id);', ctx);
  return { باقي: st.rows.slice(1), نداءات: st.نداءات };
}

{ // كتلة متجاورة (الحالة العادية — سطور الطلب بتتكتب مع بعض)
  const r = شغّل(['A','A','B','B','B','C'], 'B');
  check('بيمسح كل سطور الطلب', r.باقي.join('')==='AAC', r.باقي.join(''));
  check('بنداء واحد بس للكتلة المتجاورة', r.نداءات===1, 'نداءات='+r.نداءات);
}
{ // سطور متفرقة (لو حد رتّب الشيت بالإيد)
  const r = شغّل(['B','A','B','C','B'], 'B');
  check('بيمسح السطور المتفرقة كمان', r.باقي.join('')==='AC', r.باقي.join(''));
  check('نداء لكل كتلة', r.نداءات===3, 'نداءات='+r.نداءات);
}
{ // الطلب في آخر الشيت
  const r = شغّل(['A','B','B'], 'B');
  check('كتلة في آخر الشيت', r.باقي.join('')==='A' && r.نداءات===1, r.باقي.join('')+' نداءات='+r.نداءات);
}
{ // الطلب في أول سطر بعد الترويسة
  const r = شغّل(['B','B','A'], 'B');
  check('كتلة في أول الشيت', r.باقي.join('')==='A' && r.نداءات===1, r.باقي.join('')+' نداءات='+r.نداءات);
}
{ // طلب مش موجود = مفيش مسح
  const r = شغّل(['A','C'], 'B');
  check('طلب مش موجود = مفيش مسح', r.باقي.join('')==='AC' && r.نداءات===0, 'نداءات='+r.نداءات);
}
{ // شيت فاضي
  const r = شغّل([], 'B');
  check('شيت فاضي مايكسرش', r.باقي.length===0 && r.نداءات===0);
}
{ // طلب كبير: ٢٠ سطر = نداء واحد (ده بيت القصيد)
  const r = شغّل(['A'].concat(Array(20).fill('BIG')).concat(['C']), 'BIG');
  check('طلب ٢٠ سطر: نداء واحد بدل ٢٠', r.باقي.join('')==='AC' && r.نداءات===1,
    'باقي='+r.باقي.join('')+' نداءات='+r.نداءات);
}
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
