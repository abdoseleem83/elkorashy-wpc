// بند «خدمة قص» بيتحسب في الفلوس بس. لو اتعدّ كقطعة، عدّاد القطع اللي المصنع
// بيقطّع عليه بيزيد — وده رقم بيتبني عليه شغل ورشة فعلي.
// الاختبار بيشغّل كود السيرفر نفسه (recomputeOrderTotals_) على شيت وهمي.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs); if(!m) throw new Error('مالقيناش '+n); return m[0]; };

const NCOLS = 22;
// [id, date, name, type, item, code, size, ..., unit(9), qty(10), unitPrice(11), lineTotal(12)]
const سطر = (type, code, unit, qty, price) => {
  const r = new Array(NCOLS).fill('');
  r[0]='W1'; r[3]=type; r[5]=code; r[9]=unit; r[10]=qty; r[11]=price; r[12]=qty*price;
  return r;
};
const سطور = [
  سطر('Door','A02','door',4,5700),          // ٤ أبواب
  سطر('Frame','','set',2,900),              // طقم حلق = ٦ عيدان
  سطر('Accessory','CUT','باب',4,300),       // خدمة قص — مش قطعة
  سطر('Accessory','gsk','متر',5,6)          // إكسسوار عادي = ٥ قطع
];

const مكتوب = {};
const ctx = {
  String, Number, Object, Array,
  SHEET_ITEMS:'Order_Items', SHEET_ORDERS:'Orders',
  HEAD_ITEMS:new Array(NCOLS).fill(''), HEAD_ORDERS:new Array(20).fill(''),
  CUT_SERVICE_CODE_:'CUT',
  sheet_: () => ({}),
  itemRowsFor_: () => ({ rows: سطور }),
  findRow_: () => 5
};
ctx.sheet_ = (name) => name==='Orders'
  ? { getRange: (r,c) => ({ setValue: v => { مكتوب[c]=v; } }) }
  : {};
vm.createContext(ctx);
vm.runInContext(grab('recomputeOrderTotals_'), ctx);
ctx.recomputeOrderTotals_('W1');

// العمود ٨ = عدد القطع، ٩ = العيدان، ١٠ = الإجمالي
check('عدد القطع من غير بند القص', مكتوب[8] === 9, `${مكتوب[8]} (المفروض ٤ باب + ٥ إكسسوار)`);
check('العيدان زي ما هي', مكتوب[9] === 6, String(مكتوب[9]));
check('الإجمالي شامل فلوس القص',
  مكتوب[10] === 4*5700 + 2*900 + 4*300 + 5*6, String(مكتوب[10]));

// وكمان في إنشاء الطلب نفسه (newOrder) — نفس القاعدة
const كود = /var items = o\.items \|\| \[\];[\s\S]*?\n  \}/.exec(gs)[0];
const ctx2 = { String, Number, o:{ items:[
  {kind:'door', qty:4}, {kind:'frame', isSet:true, qty:2},
  {kind:'acc', code:'CUT', qty:4}, {kind:'acc', code:'gsk', qty:5}
]}, CUT_SERVICE_CODE_:'CUT' };
vm.createContext(ctx2);
vm.runInContext(كود, ctx2);
check('نفس القاعدة وقت إنشاء الطلب', ctx2.qty === 9, `${ctx2.qty}`);
check('والعيدان', ctx2.rods === 6, String(ctx2.rods));


// ── بند القص لازم يمشي مع الباب لما المصنع يعدّل من شاشته ──────────────
// المصنع بيقدر يحذف باب أو ينقّص كميته. لو بند القص فضل بكميته القديمة،
// العميل بيدفع قص لأبواب مش موجودة — فلوس بتتحسب على حاجة ماتعملتش.
function شيتCut(سطور){
  const rows = سطور.map(r=>r.slice());
  const عمليات = [];
  return { rows, عمليات, sh: {
    getLastRow: () => rows.length + 1,
    deleteRow: (n) => { عمليات.push('حذف '+n); rows.splice(n-2,1); },
    getRange: (r,c,nr,nc) => ({
      getValues: () => rows.slice(r-2, r-2+(nr||1)).map(x=>x.slice(c-1, c-1+(nc||1))),
      setValues: (v) => { عمليات.push('كتابة '+r);
        v[0].forEach((val,k)=>{ rows[r-2][c-1+k] = val; }); }
    })
  }};
}
const بابC = (size, h, qty) => { const r=new Array(NCOLS).fill('');
  r[0]='W9'; r[3]='Door'; r[5]='A02'; r[6]=size; r[10]=qty; r[11]=5700; r[12]=qty*5700; r[19]=h; return r; };
const قصC = (size, h, qty) => { const r=new Array(NCOLS).fill('');
  r[0]='W9'; r[3]='Accessory'; r[5]='CUT'; r[6]=size; r[10]=qty; r[11]=300; r[12]=qty*300; r[19]=h; return r; };

function شغّل(سطور){
  const s = شيتCut(سطور);
  const c = { String, Number, Object, Array, RegExp,
    CUT_SERVICE_CODE_:'CUT', DOOR_STD_HEIGHT_:215, HEAD_ITEMS:new Array(NCOLS).fill('') };
  vm.createContext(c);
  vm.runInContext(grab('itemRowsForMany_')+'\n'+grab('itemRowsFor_')+'\n'
    +grab('doorRowNeedsCut_')+'\n'+grab('cutRowKey_')+'\n'+grab('syncCutRows_'), c);
  c.syncCutRows_(s.sh, 'W9');
  return s.rows;
}

// ١) الكمية نقصت من ٣ لـ ١ → بند القص ينقص لـ ١
let r = شغّل([ بابC('90x206 cm (custom)','',1), قصC('90x206 cm (custom)','',3) ]);
check('كمية البند مشيت مع الباب', r[1] && r[1][10]===1 && r[1][12]===300,
  r[1] ? `${r[1][10]} × ${r[1][11]} = ${r[1][12]}` : 'اتشال');

// ٢) الباب اتحذف خالص → البند يتشال
r = شغّل([ قصC('90x206 cm (custom)','',3) ]);
check('البند اتشال لما الباب اتشال', r.length===0, String(r.length));

// ٣) مقاسين مختلفين — كل بند يمشي مع مقاسه هو
r = شغّل([ بابC('90x206 cm (custom)','',2), بابC('90 cm',240,5),
           قصC('90x206 cm (custom)','',9), قصC('90 cm',240,9) ]);
check('كل بند مع مقاسه', r[2][10]===2 && r[3][10]===5, `${r[2][10]} و ${r[3][10]}`);

// ٤) باب عادي بارتفاع استاندر مالوش قص — والبند بتاعه يتشال
r = شغّل([ بابC('90 cm',215,4), قصC('90 cm',215,4) ]);
check('الارتفاع الاستاندر مالوش بند قص', r.length===1 && r[0][3]==='Door');

// ٥) مفيش تغيير مطلوب → مفيش أي كتابة على الشيت
{
  const s = شيتCut([ بابC('90x206 cm (custom)','',2), قصC('90x206 cm (custom)','',2) ]);
  const c = { String, Number, Object, Array, RegExp,
    CUT_SERVICE_CODE_:'CUT', DOOR_STD_HEIGHT_:215, HEAD_ITEMS:new Array(NCOLS).fill('') };
  vm.createContext(c);
  vm.runInContext(grab('itemRowsForMany_')+'\n'+grab('itemRowsFor_')+'\n'
    +grab('doorRowNeedsCut_')+'\n'+grab('cutRowKey_')+'\n'+grab('syncCutRows_'), c);
  c.syncCutRows_(s.sh, 'W9');
  check('مفيش كتابة من غير داعي', s.عمليات.length===0, s.عمليات.join('، '));
}

console.log(`\nالنتيجة النهائية: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
