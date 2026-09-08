// خصم رصيد المخزون: بيتنفّذ فعلًا (مش فحص نصوص) على شيت وهمي.
// الباج: لو الشيت فيه صفين بنفس (الكود|المقاس) — وده بيحصل لو حد ضاف صف بالإيد —
// الخصم كان بيتطبّق على الصفين، يعني خصم مضاعف من رصيد حقيقي.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const src = /function adjustStockForItems_\(items, dir\)\{[\s\S]*?\n\}/.exec(gs);
check('لقينا الدالة في apps_script.gs', !!src);

// شيت وهمي: صفوف [كود، مقاس، كمية، تاريخ] وبنسجّل الكتابة اللي اتعملت
function مصنع_شيت(rows){
  const state = { rows: rows.map(r=>r.slice()), كتابات:0 };
  const sh = {
    getLastRow: () => state.rows.length + 1,
    getRange: (r,c,n,w) => ({
      getValues: () => state.rows.map(x=>x.slice()),
      setValues: (v) => { state.كتابات++; state.rows = v.map(x=>x.slice()); }
    })
  };
  return { sh, state };
}

function شغّل(rows, items, dir){
  const { sh, state } = مصنع_شيت(rows);
  const ctx = { sheet_: () => sh, SHEET_STOCK:'Stock', HEAD_STOCK:['Code','Size','Qty','Updated'], Number, String, Object, Date };
  vm.createContext(ctx);
  vm.runInContext(src[0] + '\nadjustStockForItems_(' + JSON.stringify(items) + ', ' + dir + ');', ctx);
  return state;
}

// ١) الحالة العادية: صف واحد لكل صنف
{
  const r = شغّل([['A01','70',10,''],['A02','90',20,'']],
                 [{kind:'door',code:'A01',w:'70',qty:3}], -1);
  check('الخصم العادي شغّال', r.rows[0][2]===7, 'رصيد='+r.rows[0][2]);
  check('والصنف التاني ما اتلمسش', r.rows[1][2]===20, 'رصيد='+r.rows[1][2]);
}

// ٢) سطرين في نفس الطلب بنفس الكود والمقاس → الكميات بتتجمع وتتخصم مرة
{
  const r = شغّل([['A01','70',10,'']],
                 [{kind:'door',code:'A01',w:'70',qty:3},{kind:'door',code:'A01',w:'70',qty:2}], -1);
  check('سطرين بنفس الصنف = خصم مجمّع مرة واحدة', r.rows[0][2]===5, 'رصيد='+r.rows[0][2]);
}

// ٣) الباج: صفين في الشيت بنفس (الكود|المقاس) → لازم الخصم يحصل مرة واحدة بس
{
  const r = شغّل([['A01','70',10,''],['A01','70',4,'']],
                 [{kind:'door',code:'A01',w:'70',qty:3}], -1);
  check('صف مكرر في الشيت: الخصم مرة واحدة بس',
    r.rows[0][2]===7 && r.rows[1][2]===4, 'أول صف='+r.rows[0][2]+' تاني صف='+r.rows[1][2]);
}

// ٤) الرجوع (+1) بنفس القاعدة
{
  const r = شغّل([['A01','70',10,''],['A01','70',4,'']],
                 [{kind:'door',code:'A01',w:'70',qty:3}], +1);
  check('الرجوع كمان مرة واحدة', r.rows[0][2]===13 && r.rows[1][2]===4,
    'أول صف='+r.rows[0][2]+' تاني صف='+r.rows[1][2]);
}

// ٥) المقاس الخاص (من غير عرض) والأصناف غير الأبواب مش متتبّعين
{
  const r = شغّل([['A01','70',10,'']],
                 [{kind:'door',code:'A01',w:'',qty:3},{kind:'frame',code:'A01',w:'70',qty:5}], -1);
  check('المقاس الخاص والحلق مش بيأثروا على المخزون', r.rows[0][2]===10 && r.كتابات===0,
    'رصيد='+r.rows[0][2]+' كتابات='+r.كتابات);
}

// ٦) صنف مش في الشيت خالص = مفيش كتابة
{
  const r = شغّل([['A01','70',10,'']], [{kind:'door',code:'ZZZ',w:'70',qty:3}], -1);
  check('صنف مش في جدول الأرصدة = مفيش كتابة', r.كتابات===0, 'كتابات='+r.كتابات);
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
