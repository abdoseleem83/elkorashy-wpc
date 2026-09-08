// الطلب اللي بيتبعت تاني (إعادة إرسال، أو محاولة من طابور الانتظار) كان بياخد
// رقم تسلسلي جديد كل مرة، لأن التطبيق مش دايمًا بيعرف الرقم اللي اتصرف —
// الطلب الكبير بيتبعت بـ POST والرد مايوصلش. النتيجة: الرقم اللي المصنع شايفه
// على الورق يتغيّر، وأرقام بتتحرق على الفاضي.
// الاختبار بيشغّل الجزء ده من saveOrder_ فعليًا على شيت وهمي.
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const COL_NO = Number(/var COL_DISPLAY_NO = (\d+)/.exec(gs)[1]);
const COL_ED = Number(/var COL_EDIT_COUNT  = (\d+)/.exec(gs)[1]);

// الجزء اللي بيقرّر الرقم — من التعليق لحد كتابة الرقم في الشيت
const block = /  var displayNo = o\.displayNo[\s\S]*?setValues\(\[\[displayNo, editCount\]\]\);/.exec(gs);
check('لقينا منطق الترقيم في saveOrder_', !!block);

function شغّل({ payload, صف_موجود, رقم_في_الشيت, تعديلات_في_الشيت }){
  const مكتوب = {};
  let نداء_عدّاد = 0;
  const shO = {
    getRange: (row, col, nr, nc) => ({
      getValues: () => [[رقم_في_الشيت, تعديلات_في_الشيت]],
      setValues: (v) => { مكتوب.no = v[0][0]; مكتوب.ed = v[0][1]; },
      setValue: () => {}
    })
  };
  const scope = {
    o: payload, shO, existing: صف_موجود, rowIdxRepl: صف_موجود || 9,
    COL_DISPLAY_NO: COL_NO, COL_EDIT_COUNT: COL_ED,
    nextOrderDisplayNo_: () => { نداء_عدّاد++; return 100; },
    sanitizeCell_: x=>x, Number, String
  };
  new Function(...Object.keys(scope), block[0])(...Object.values(scope));
  return { ...مكتوب, عدّاد: نداء_عدّاد };
}

// ١) طلب جديد بالكامل → رقم جديد من العدّاد
{
  const r = شغّل({ payload:{}, صف_موجود:0 });
  check('طلب جديد بياخد رقم من العدّاد', r.no===100 && r.ed===0 && r.عدّاد===1, JSON.stringify(r));
}

// ٢) الباج: نفس الطلب اتبعت تاني من غير رقم، والصف موجود وله رقم ٧٠
{
  const r = شغّل({ payload:{}, صف_موجود:5, رقم_في_الشيت:70, تعديلات_في_الشيت:0 });
  check('إعادة الإرسال بتحافظ على نفس الرقم', r.no===70, 'الرقم بقى '+r.no);
  check('وماتحرقش رقم جديد من العدّاد', r.عدّاد===0, 'نداءات العدّاد='+r.عدّاد);
}

// ٣) وكمان بتحافظ على عدّاد التعديل اللي في الشيت
{
  const r = شغّل({ payload:{}, صف_موجود:5, رقم_في_الشيت:70, تعديلات_في_الشيت:3 });
  check('وبتحافظ على عدّاد التعديل', r.no===70 && r.ed===3, JSON.stringify(r));
}

// ٤) التعديل (رقم موروث جاي من التطبيق) لسه شغّال زي ما هو
{
  const r = شغّل({ payload:{displayNo:52, editCount:2}, صف_موجود:0 });
  check('التعديل بياخد الرقم الموروث وعدّاده', r.no===52 && r.ed===2 && r.عدّاد===0, JSON.stringify(r));
}

// ٥) صف موجود من غير رقم (بيانات قديمة) → ياخد رقم جديد عادي
{
  const r = شغّل({ payload:{}, صف_موجود:5, رقم_في_الشيت:'', تعديلات_في_الشيت:'' });
  check('صف قديم من غير رقم بياخد رقم جديد', r.no===100 && r.عدّاد===1, JSON.stringify(r));
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
