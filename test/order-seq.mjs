// ترقيم الطلبات: العدّاد متخزّن في خصائص السكريبت. أول مرة بيشتغل لازم يبدأ من
// بعد أكبر رقم اتصرف فعلاً. كان بياخده من عدد صفوف الشيت — وتعديل الطلب بيمسح
// صفوف، فالعدد أقل من أكبر رقم، والترقيم كان بيرجع لورا ويكرّر أرقام.
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const COL = Number(/var COL_DISPLAY_NO = (\d+)/.exec(gs)[1]);
const grab = n => new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs)[0];

// شيت وهمي: ٥ طلبات اتصرفلها الأرقام ١..١٠، لكن ٥ منهم اتمسحوا بالتعديل
const sheet = (nums) => ({
  getLastRow: () => nums.length + 1,
  getRange: (row, col, numRows) => ({
    getValues: () => { if(col !== COL) throw new Error('عمود غلط: '+col);
      return nums.slice(row-2, row-2+numRows).map(v=>[v]); }
  })
});

const props = { store: {},
  getProperty(k){ return k in this.store ? this.store[k] : null; },
  setProperty(k,v){ this.store[k] = String(v); } };
const scope = {
  COL_DISPLAY_NO: COL,
  PropertiesService: { getScriptProperties: () => props }
};
const src = grab('maxOrderDisplayNo_') + '\n' + grab('nextOrderDisplayNo_') + '\nreturn nextOrderDisplayNo_;';
const nextOrderDisplayNo_ = new Function(...Object.keys(scope), src)(...Object.values(scope));

// الطلبات الباقية أرقامها ٢ و٤ و٧ و٩ و١٠ (الباقي اتمسح بالتعديل)
const sh = sheet([2,4,7,9,10]);
check('أول رقم جديد بعد أكبر رقم موجود مش بعد عدد الصفوف',
  nextOrderDisplayNo_(sh) === 11, 'رجّع '+props.store.ORDER_DISPLAY_NO_SEQ);
check('اللي بعده بيزيد واحد', nextOrderDisplayNo_(sh) === 12);
check('العدّاد اتخزّن', props.store.ORDER_DISPLAY_NO_SEQ === '12', props.store.ORDER_DISPLAY_NO_SEQ);

// شيت فاضي
props.store = {};
check('شيت فاضي بيبدأ من ١', nextOrderDisplayNo_(sheet([])) === 1);

// قيم فاضية أو نص في العمود ماتوقعش الحساب
props.store = {};
check('قيم فاضية/نص في العمود مابتكسرش الترقيم',
  nextOrderDisplayNo_(sheet(['', null, 'x', 7, ''])) === 8);

// العدّاد موجود خلاص — مايتقراش الشيت تاني
props.store = { ORDER_DISPLAY_NO_SEQ: '50' };
check('لما العدّاد موجود بيكمّل منه من غير ما يقرا الشيت',
  nextOrderDisplayNo_({ getLastRow: () => { throw new Error('مالوش يقرا الشيت'); } }) === 51);

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
