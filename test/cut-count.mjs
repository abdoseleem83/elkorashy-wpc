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

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
