// جلب الأصناف كان أبطأ حاجة في شاشة المصنع:
//  ١) السيرفر كان بيقرا كل أعمدة كل سطور تبويب الأصناف عشان يطلّع سطور طلب واحد.
//  ٢) المعاينة كانت بتبعت نداء لكل طلب، و Apps Script بينفّذهم واحد ورا التاني.
// الاختبار بيشغّل كود السيرفر فعليًا على شيت وهمي ويعدّ القراءات.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs); if(!m) throw new Error('مالقيناش '+n); return m[0]; };

const NCOLS = 22;
// شيت وهمي بيسجّل كل قراية: كام سطر وكام عمود
function شيت(معرفات){
  const قراءات = [];
  const rows = معرفات.map((id,i)=>{
    const r = new Array(NCOLS).fill('');
    r[0]=id; r[3]='Door'; r[5]='A0'+(i%3); r[10]=i+1; r[11]=100; r[12]=100*(i+1); r[17]='90';
    return r;
  });
  return { قراءات, sh: {
    getLastRow: () => rows.length + 1,
    getRange: (r,c,n,w) => { قراءات.push({سطور:n, أعمدة:w||1});
      return { getValues: () => rows.slice(r-2, r-2+n).map(x=>x.slice(c-1, c-1+(w||1))) }; }
  }};
}
function ctxFor(sh){
  const ctx = { sh, HEAD_ITEMS:new Array(NCOLS).fill(''), String, Number, Object, Array };
  vm.createContext(ctx);
  vm.runInContext(grab('itemRowsFor_') + '\n' + grab('itemRowsForMany_') + '\n' + grab('itemsFromRows_'), ctx);
  return ctx;
}

// ١) طلب واحد وسط ٢٠٠٠ سطر: مانقراش الشيت كله بكل أعمدته
{
  const معرفات = [];
  for(let i=0;i<2000;i++) معرفات.push('W'+Math.floor(i/10));   // ١٠ سطور لكل طلب
  const { sh, قراءات } = شيت(معرفات);
  const ctx = ctxFor(sh);
  const res = vm.runInContext('itemRowsFor_(sh, "W50")', ctx);
  check('رجّع سطور الطلب الصح', res.rows.length===10 && res.rows.every(r=>r[0]==='W50'), 'عدد='+res.rows.length);
  const خلايا = قراءات.reduce((s,q)=>s+q.سطور*q.أعمدة, 0);
  const كامل = 2000*NCOLS;
  check('ما قراش الشيت كله (خلايا أقل بكتير)', خلايا < كامل/8, 'خلايا='+خلايا+' بدل '+كامل);
  check('قراية عمود واحد + كتلة الطلب بس', قراءات.length===2 && قراءات[0].أعمدة===1,
    JSON.stringify(قراءات));
}

// ٢) عشر طلبات مرة واحدة: قراية واحدة للعمود مش عشرة
{
  const معرفات = [];
  for(let i=0;i<2000;i++) معرفات.push('W'+Math.floor(i/10));
  const { sh, قراءات } = شيت(معرفات);
  const ctx = ctxFor(sh);
  const عايزين = Array.from({length:10},(_,i)=>'W'+(i*3));
  const map = vm.runInContext('itemRowsForMany_(sh, '+JSON.stringify(عايزين)+')', ctx);
  check('رجّع أصناف كل الطلبات المطلوبة',
    عايزين.every(id=>map[id] && map[id].rows.length===10), Object.keys(map).length+' طلب');
  const قراءات_عمود = قراءات.filter(q=>q.أعمدة===1).length;
  check('قراية واحدة بس لعمود المعرّف مهما كان عدد الطلبات', قراءات_عمود===1, 'قراءات عمود='+قراءات_عمود);
  check('وكتلة لكل طلب بس', قراءات.length===11, 'إجمالي القراءات='+قراءات.length);
}

// ٣) طلب مش موجود
{
  const { sh } = شيت(['A','A','B']);
  const ctx = ctxFor(sh);
  const res = vm.runInContext('itemRowsFor_(sh, "ZZ")', ctx);
  check('طلب مش موجود = صفر سطور', res.rows.length===0);
}

// ٤) سطور متفرقة لنفس الطلب
{
  const { sh } = شيت(['A','B','A','C','A']);
  const ctx = ctxFor(sh);
  const res = vm.runInContext('itemRowsFor_(sh, "A")', ctx);
  check('السطور المتفرقة بترجع كلها وبالترتيب', res.rows.length===3 && res.rowNums.join(',')==='2,4,6',
    res.rowNums.join(','));
}

// ٥) itemsFromRows_ بتطلّع نفس شكل البيانات اللي التطبيق مستنيها
{
  const { sh } = شيت(['A','A']);
  const ctx = ctxFor(sh);
  const its = vm.runInContext('itemsFromRows_(itemRowsFor_(sh, "A").rows)', ctx);
  check('شكل الصنف صح', its.length===2 && its[0].type==='Door' && its[0].qty===1 && its[0].avail===true,
    JSON.stringify(its[0]).slice(0,90));
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
