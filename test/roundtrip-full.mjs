// دورة كاملة لطلب غني بكل أنواع الأصناف:
//   السلة → saveOrder_ الحقيقي (على شيت وهمي) → itemsFromRows_ → رجوع للسلة
//   (نفس مسار «تعديل الطلب» من شاشة المصنع) → إرسال تاني.
// كل تعديل بيمرّ بالدورة دي، فأي حقل بيضيع أو بيتغيّر في الطريق معناه إن
// الطلب بيتشوّه مع كل تعديل: مقاس ناقص، سعر متغيّر، أو بند خدمة بيضيع.
// أهم فحص هنا هو التالت: الدورة التانية لازم تطلّع **نفس** سطور الشيت بالظبط.
import fs from 'node:fs';
import vm from 'node:vm';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs);
                    if(!m) throw new Error('مالقيناش '+n); return m[0]; };

const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ ١) سلة فيها كل نوع صنف في التطبيق ═══
const طلب = await pg.evaluate(()=>{
  window.toast=()=>{}; window.render=()=>{};
  state.cart=[];
  state.profile={name:'محمد',phone:'01000000000',region:'طنطا'};
  state.customer={name:'الخليفة جروب',phone:'01111111111'};
  state.pick={code:'A01',sizes:{'70':{qty:3,height:'205',frame:10,frameHeight:'212',dbror:'6×9',
              hafr:true,wood:true,frameKind:null,frameRodQty:'',frameForDoors:''}},
    customOn:false,note:'ملحوظة — على الباب',
    custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,wood:false,frameKind:null,frameRodQty:'',frameForDoors:''}};
  addDoor();
  state.pick={code:'A02',sizes:{},customOn:true,note:'',
    custom:{w:'85',h:'225',qty:2,frame:15,frameHeight:'',dbror:'8×4',hafr:false,wood:false,
            frameKind:'rods',frameRodQty:'4',frameForDoors:'2'}};
  addDoor();
  const f=FRAMES[0];
  state.fr={cm:f.cm,code:'A01',kind:'full',qty:2,nonStd:false,jamb:2,header:1,jambCm:220,headerCm:110,extra:[],rods:'',rodsCm:'',doorW:'70',note:''};
  addRod('frame');                                  // حلق كامل (أطقم)
  state.fr={cm:f.cm,code:'A01',kind:'full',qty:1,nonStd:true,jamb:2,header:1,jambCm:200,headerCm:120,
            extra:[{cm:180.5,qty:2}],rods:'',rodsCm:'',doorW:'',note:'ملحوظة حلق'};
  addRod('frame');                                  // حلق بأطوال مخصوصة (سطر مدموج)
  state.fr={cm:f.cm,code:'A01',kind:'rods',qty:1,nonStd:false,jamb:2,header:1,jambCm:220,headerCm:110,
            extra:[],rods:'3',rodsCm:'240.5',doorW:'',note:''};
  addRod('frame');                                  // أعواد حرة بطول كسري
  state.br={size:BRORS[0].size,code:'A01',rods:5,lenM:2.15};
  addRod('bror');
  state.pd={code:'A01',qty:4}; addPanel();
  state.acc={}; state.acc[ACCESSORIES[0].id]=3; addAccessories();
  return draftOrder();
});

// ═══ ٢) كود السيرفر الحقيقي على شيت وهمي ═══
const شيت = { Orders: [], Order_Items: [] };
const mkSheet = name => ({
  getLastRow: () => شيت[name].length + 1,
  appendRow: r => شيت[name].push(r.slice()),
  getRange: (row, col, nr, nc) => ({
    getValues: () => { const out=[];
      for(let i=0;i<(nr||1);i++){ const src=شيت[name][row-2+i]||[], line=[];
        for(let j=0;j<(nc||1);j++) line.push(src[col-1+j]===undefined?'':src[col-1+j]);
        out.push(line); }
      return out; },
    setValues: vals => vals.forEach((line,i)=>{ const idx=row-2+i;
      if(!شيت[name][idx]) شيت[name][idx]=[];
      line.forEach((v,j)=>{ شيت[name][idx][col-1+j]=v; }); }),
    setValue: v => { const idx=row-2; if(!شيت[name][idx]) شيت[name][idx]=[]; شيت[name][idx][col-1]=v; },
    setBackground: ()=>{}
  })
});
const ctx = {
  String, Number, Object, Array, Date, JSON, RegExp, Math, isNaN, parseFloat,
  Utilities:{ formatDate:(d,tz,f)=> f==='yyyy-MM-dd' ? d.toISOString().slice(0,10) : d.toISOString().slice(11,16) },
  sheet_: n => mkSheet(n), adjustStockForItems_: ()=>{},
  nextOrderDisplayNo_: ()=>501, findRow_: ()=>-1, clearItemRows_: ()=>{}
};
['TZ','SHEET_ORDERS','SHEET_ITEMS','CUT_SERVICE_CODE_','WOOD_SERVICE_CODE_','PRICE_NOTE',
 'COL_STATUS','COL_NOTE','COL_REPLACES','COL_DISPLAY_NO','COL_EDITED_AT'].forEach(n=>{
  const m = new RegExp('var '+n+'\\s*=\\s*(.+?);').exec(gs); if(m) ctx[n]=eval(m[1]);
});
const arr = n => eval('['+new RegExp('var '+n+'\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(gs)[1]+']');
ctx.HEAD_ORDERS = arr('HEAD_ORDERS'); ctx.HEAD_ITEMS = arr('HEAD_ITEMS');
vm.createContext(ctx);
vm.runInContext([grab('isServiceCode_'),grab('sanitizeCell_'),grab('sanitizeRow_'),
                 grab('warehouseEn_'),grab('digitsOnly_'),grab('saveOrder_'),
                 grab('itemsFromRows_')].join('\n'), ctx);
ctx.saveOrder_(طلب);
const rows1 = شيت.Order_Items.map(r=>r.slice());
const items = ctx.itemsFromRows_(rows1);

check('كل الأصناف اتكتبت على الشيت', rows1.length === طلب.items.length,
  `${rows1.length} من ${طلب.items.length}`);
check('بند القص والتدعيم اتكتبوا بأكوادهم',
  items.filter(it=>String(it.code)==='CUT').length===2 &&
  items.filter(it=>String(it.code)==='WOOD').length===1,
  JSON.stringify(items.map(it=>it.code)));

// ═══ ٣) رجوع للسلة زي «تعديل الطلب» من شاشة المصنع ═══
const بصمة = it => ({k:it.kind, c:it.code||'', q:Number(it.qty)||0,
  p:Number(it.kind==='door'?it.unitPrice:it.price)||0, s:it.sizeTxt||it.spec||'',
  set:!!it.isSet, cs:!!it.customSet, fr:it.frame||'', frh:it.frameHeight||'',
  db:it.dbror||'', dh:it.doorHeight||'', w:it.w||'', wood:!!it.wood, hafr:!!it.hafr,
  note:it.note||'', dw:it.doorW||''});
const بعد = await pg.evaluate(({items, طلب})=>{
  window.toast=()=>{}; window.busy=()=>{}; window.render=()=>{};
  adminEditOrderWith_({id:طلب.id, dist:طلب.name, phone:طلب.phone, region:طلب.region,
                       customer:طلب.customer, date:'2026-09-16', displayNo:501, editCount:0}, items);
  const بصمة = it => ({k:it.kind, c:it.code||'', q:Number(it.qty)||0,
    p:Number(it.kind==='door'?it.unitPrice:it.price)||0, s:it.sizeTxt||it.spec||'',
    set:!!it.isSet, cs:!!it.customSet, fr:it.frame||'', frh:it.frameHeight||'',
    db:it.dbror||'', dh:it.doorHeight||'', w:it.w||'', wood:!!it.wood, hafr:!!it.hafr,
    note:it.note||'', dw:it.doorW||''});
  return { بصمات: state.cart.map(بصمة), إجمالي: cartTotal() };
}, {items, طلب});

const قبل = طلب.items.map(بصمة);
check('عدد الأصناف زي ما هو بعد الرجوع', بعد.بصمات.length === قبل.length,
  `${بعد.بصمات.length} من ${قبل.length}`);
const مختلف = [];
قبل.forEach((a,i)=>{ const c=بعد.بصمات[i]||{};
  if(JSON.stringify(a)!==JSON.stringify(c)) مختلف.push({i, قبل:a, بعد:c}); });
check('كل حقول كل صنف رجعت زي ما هي (مقاس/سعر/كمية/حلق/برور/ارتفاع/ملاحظة)',
  مختلف.length===0, JSON.stringify(مختلف.slice(0,2)));
check('إجمالي الطلب ما اتغيّرش ولا قرش',
  Math.abs(بعد.إجمالي - طلب.total) < 0.005, `${بعد.إجمالي} مقابل ${طلب.total}`);

// ═══ ٤) الدورة التانية لازم تطلّع نفس سطور الشيت بالظبط ═══
const طلب2 = await pg.evaluate(()=>draftOrder());
شيت.Order_Items.length = 0; شيت.Orders.length = 0;
ctx.saveOrder_(طلب2);
const rows2 = شيت.Order_Items;
const بدون_معرف = r => r.slice(3);   // من غير رقم الطلب والتاريخ واسم الموزّع
const فروق = [];
rows1.forEach((r,i)=>{ const a=JSON.stringify(بدون_معرف(r)), c=JSON.stringify(بدون_معرف(rows2[i]||[]));
  if(a!==c) فروق.push({i, قبل:a, بعد:c}); });
check('تعديل الطلب مرتين مابيغيّرش سطوره على الشيت',
  rows1.length===rows2.length && فروق.length===0,
  فروق.length ? JSON.stringify(فروق[0]) : `${rows1.length} مقابل ${rows2.length}`);
check('والإجمالي كمان ثابت', Math.abs(Number(طلب2.total) - Number(طلب.total)) < 0.005,
  `${طلب2.total} مقابل ${طلب.total}`);

// ⚠️ باج اتمسك من الاختبار ده: عمود «الحفر» كان بيضيع مع أول تعديل، والاسم
// العربي بيتبني منه — فالباب بيبقى «باب A01 أرو» من غير «(حفر)» وسعره لسه
// سعر الحفر. الاختبار بيتأكد إن العلامة عايشة بعد دورتين.
const items2 = ctx.itemsFromRows_(rows2);
const بابـحفر = items2.find(it=>String(it.code)==='A01' && String(it.type)==='Door');
check('علامة الحفر عايشة في عمودها بعد التعديل',
  String(بابـحفر && بابـحفر.milling || '').trim() !== '', JSON.stringify(بابـحفر && بابـحفر.milling));
const اسم = await pg.evaluate(it=>arabicItemTitle_(it), بابـحفر);
check('والاسم العربي لسه بيقول «(حفر)»', /\(حفر\)/.test(اسم), اسم);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
