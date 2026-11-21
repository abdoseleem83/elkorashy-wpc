// منطق توزيع الرصيد على العملاء (تقرير العملاء + المطلوب تصنيعه) — Node بس، من غير متصفح.
import fs from 'fs';
const ExcelJS = null;
const src = fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const a = src.indexOf('function buildAllocationData_');
const bMark = 'async function exportAllocDoorsExcel_'; const b0 = src.indexOf(bMark);
const b = src.indexOf('\n}\n', b0)+3;
const code = src.slice(a,b);
const dw = src.slice(src.indexOf('function doorWidthGroup_'), src.indexOf('}\n', src.indexOf('function doorWidthGroup_'))+2);
const saved = {};
const ctx = { state:{stock:{rows:[]}} };
const stubs = {
  ExcelJS, Blob, console, state: ctx.state,
  DOORS:[{code:'A01',name:'أرو'},{code:'A02',name:'خشبي'},{code:'A03',name:'بني'}],
  ASSETS:{logo:''}, COMPANY_AR:'شركة', esc:s=>String(s), CUST_TINTS_:[{line:'#1080C0',head:'#EAF2FA'},{line:'#C08A3E',head:'#FBF0E1'}],
  stockFor:(c,w)=>{ const r=ctx.state.stock.rows.find(x=>x.code===c&&Number(x.size)===Number(w)); return r?r.qty:0; },
  isoLocal_:()=>'T', toast:m=>{saved.toast=m}, needLibs_:async()=>true,
  shareOrDownload_: async (blob,name)=>{ saved.name=name; saved.buf=Buffer.from(await blob.arrayBuffer()); },
  loadStock: async()=>{}, fetchPendingOrders_: async()=>ctx.orders, withBusy_: async(m,e,f)=>f() };
const ar = src.slice(src.indexOf('function applyReceived_'), src.indexOf('\n}\n', src.indexOf('function applyReceived_'))+3);
const fn = new Function(...Object.keys(stubs), dw+'\n'+ar+'\n'+code+'\nreturn {applyReceived_,buildAllocationData_,allocToMakeCodes_,allocCustomersHTML_,allocDoorsHTML_,buildAllocCustomersExcel_,buildAllocDoorsExcel_,exportAllocDoorsExcel_};');
ctx.__x = fn(...Object.values(stubs));
const X = ctx.__x; let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

ctx.state.stock.rows=[{code:'A02',size:'70',qty:20},{code:'A01',size:'80',qty:0}];
const I=(code,size,qty,produced=0)=>({type:'Door',code,size,qty,produced});
// الترتيب في المصفوفة معكوس عمدًا: الأحدث الأول
const orders=[
  {id:'W2',date:'2026-11-02',customer:'عبد الخالق',status:'Received',items:[I('A02','70 cm',7)]},
  {id:'W1',date:'2026-11-01',customer:'ربيع موسى',status:'Received',items:[I('A02','70 cm',15), I('A01','80 cm',3), I('A03','75x209 cm (custom)',2)]},
  {id:'W3',date:'2026-10-30',customer:'ملغي',status:'Cancelled',items:[I('A02','70 cm',50)]},
  {id:'W4',date:'2026-10-30',customer:'مسلّم',status:'Delivered',items:[I('A02','70 cm',50)]},
  {id:'W5',date:'2026-11-03',customer:'ربيع موسى',status:'In Progress',items:[I('A02','70 cm',4,4), {type:'Frame',code:'A02',size:'10 cm',qty:9}]},
];
const d = X.buildAllocationData_(orders);
const c1=d.cell('70','A02','ربيع موسى'), c2=d.cell('70','A02','عبد الخالق');
check('ربيع (الأقدم) ياخد 15 من 20 ومتبقي صفر', c1.req===15&&c1.got===15&&c1.rem===0, JSON.stringify(c1));
check('عبد الخالق ياخد 5 ومتبقي 2', c2.req===7&&c2.got===5&&c2.rem===2, JSON.stringify(c2));
check('إجمالي المطلوب تصنيعه لـ A02/70 = 2', d.sum('70','A02').rem===2);
check('الملغي والمسلّم مستبعدين', d.custBy['70'].join()==='ربيع موسى,عبد الخالق', d.custBy['70'].join());
check('اللي اتنتج بالكامل (4 من 4) مايتحسبش', d.cell('70','A02','ربيع موسى').req===15);
check('رصيد صفر → كله يتصنّع', d.cell('80','A01','ربيع موسى').rem===3 && d.cell('80','A01','ربيع موسى').got===0);
check('المقاس الخاص بيتصنّع كله (من غير رصيد)', d.cell('خاص','A03','ربيع موسى').rem===2);
check('ترتيب المقاسات: 70 ثم 80 ثم خاص', d.sizes.join()==='70,80,خاص', d.sizes.join());
check('إجمالي عام: مطلوب 27 متاح 20 يتصنّع 7', d.grand.req===27&&d.grand.got===20&&d.grand.rem===7, JSON.stringify(d.grand));
check('الأكواد اللي عليها تصنيع', X.allocToMakeCodes_(d).join()==='A01,A02,A03', X.allocToMakeCodes_(d).join());
const h1=X.allocCustomersHTML_(d), h2=X.allocDoorsHTML_(d);
check('HTML تقرير العملاء فيه الأسماء والأقسام', h1.includes('ربيع موسى')&&h1.includes('عبد الخالق')&&h1.includes('مقاس 70')&&h1.includes('مقاسات خاصة'));
check('HTML تقرير التصنيع فيه الإجمالي 7', h2.includes('>7<'));

// أكتر من 3 عملاء → جدول تاني (تابع)
const many=[1,2,3,4].map(i=>({id:'M'+i,date:'2026-11-0'+i,customer:'ع'+i,status:'Received',items:[I('A01','90 cm',1)]}));
check('أكتر من 3 عملاء بيتقسم لجدولين (تابع)', X.allocCustomersHTML_(X.buildAllocationData_(many)).includes('(تابع)'));


// ---- المستلم / المتبقي: التقارير بتحسب على المتبقي للعميل ----
{
  ctx.state.stock.rows=[{code:'A02',size:'70',qty:20}];
  const raw=[
    {id:'R1',date:'2026-11-01',customer:'ربيع موسى',status:'Received',items:[
      {type:'Door',code:'A02',size:'70 cm',qty:15,produced:15,received:15},   // استلم كله → يختفي
      {type:'Door',code:'A01',size:'80 cm',qty:5,produced:5,received:3},     // استلم 3 → متبقي 2 وجاهز 2
      {type:'Door',code:'A03',size:'90 cm',qty:4,produced:1,received:3}]},   // استلم من غير إنتاج متسجّل → جاهز صفر
    {id:'R2',date:'2026-11-02',customer:'عبد الخالق',status:'Received',items:[{type:'Door',code:'A02',size:'70 cm',qty:7,produced:0}]}
  ];
  const out = X.applyReceived_(raw);
  const i1 = out[0].items;
  check('اللي اتسلّم كله بيختفي من التقارير', !i1.some(i=>i.code==='A02'));
  check('الكمية = المطلوب - المستلم (5-3=2) والجاهز بينقص بيه (5-3=2)', i1.find(i=>i.code==='A01').qty===2 && i1.find(i=>i.code==='A01').produced===2);
  check('الجاهز مابيبقاش سالب ولا أكبر من المتبقي', i1.find(i=>i.code==='A03').qty===1 && i1.find(i=>i.code==='A03').produced===0);
  check('الطلب الأصلي ما اتغيّرش (النسخة المعدّلة بس)', raw[0].items[1].qty===5 && raw[0].items[1].produced===5);
  check('الطلب اللي مفيهوش مستلم بيرجع هو هو', out[1]===raw[1]);
  // التوزيع بعد المستلم: ربيع استلم 15 → الـ20 كلها لعبد الخالق (7)
  const d2 = X.buildAllocationData_(out);
  const c = d2.cell('70','A02','عبد الخالق');
  check('بعد استلام ربيع، رصيد A02 كله متاح لعبد الخالق', c.req===7 && c.got===7 && c.rem===0, JSON.stringify(c));
  check('A01/80: المتبقي 2 وكله جاهز → مش مطلوب تصنيع ولا بيظهر في التوزيع', d2.cell('80','A01','ربيع موسى')===null);
  check('A03/90: المتبقي 1 ومفيش جاهز → بيتصنّع', d2.cell('90','A03','ربيع موسى').rem===1);
}
console.log(`\n${pass} نجح / ${fail} فشل`); process.exit(fail?1:0);
