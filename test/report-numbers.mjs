// تقارير المصنع (الإكسيل والـ PDF الشاملة) كان الفحص الوحيد عليها إن الملف
// اتولد وحجمه معقول — محدش فتح الملف وراجع الأرقام اللي جواه. التقارير دي
// المصنع بيشتغل بيها فعليًا، وأي غلطة في الجمع بتوصل للورشة.
// الاختبار ده بيولّد الملف من التطبيق، وبيفكّه ويقرا خلاياه، ويقارن الأرقام
// باللي محسوب بالإيد من نفس البيانات.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:1200,height:900},acceptDownloads:true})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1500);

// بيانات معروفة: عميلين، أبواب بكميات ومنتَج معروف
const بيانات = await pg.evaluate(()=>{
  window.toast=()=>{}; window.busy=()=>{};
  const باب = (code,size,qty,produced,w) => ({type:'Door', title:'باب '+code, code, size, unit:'door',
    qty, produced, unitPrice:5000, frame:'10', dbror:'6×9', width:String(w)});
  const طلبات = [
    { id:'W1', displayNo:1, date:'2026-09-01', customer:'ورشة النور', dist:'موزع', phone:'01',
      status:'Received', items:[ باب('A01','90 cm',10,4,90), باب('A02','70 cm',5,5,70) ] },
    { id:'W2', displayNo:2, date:'2026-09-02', customer:'ورشة النور', dist:'موزع', phone:'01',
      status:'In Progress', items:[ باب('A01','90 cm',6,0,90) ] },
    { id:'W3', displayNo:3, date:'2026-09-03', customer:'نجارة الأمل', dist:'موزع', phone:'02',
      status:'New', items:[ باب('A05','80 cm',7,2,80) ] },
    // طلب ملغي وطلب من غير أبواب — الاتنين المفروض يتشالوا من التقرير
    { id:'W4', displayNo:4, date:'2026-09-04', customer:'ملغي', dist:'م', phone:'03',
      status:'Cancelled', items:[ باب('A01','90 cm',99,0,90) ] },
    { id:'W5', displayNo:5, date:'2026-09-05', customer:'إكسسوارات بس', dist:'م', phone:'04',
      status:'New', items:[ {type:'Frame', title:'حلق', code:'A01', size:'10 cm', unit:'set', qty:8} ] }
  ];
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.stock = { rows:[], at: Date.now() };
  const d = buildPendingDoorsData_(طلبات);
  return { تقرير: d.map(c=>({ اسم:c.name, إجمالي:c.total })), عدد:d.length };
});

// الحساب بالإيد: ورشة النور = ١٠+٥+٦ = ٢١ · نجارة الأمل = ٧
check('العملاء اللي في التقرير: الملغي والإكسسوارات اتشالوا',
  بيانات.عدد===2 && بيانات.تقرير.map(c=>c.اسم).join('|')==='ورشة النور|نجارة الأمل',
  JSON.stringify(بيانات.تقرير));
check('إجمالي أبواب ورشة النور = ٢١', بيانات.تقرير[0].إجمالي===21, String(بيانات.تقرير[0].إجمالي));
check('إجمالي أبواب نجارة الأمل = ٧', بيانات.تقرير[1].إجمالي===7, String(بيانات.تقرير[1].إجمالي));

// ═══ دمج أصناف العميل: نفس الحساب اللي التقارير كلها (إكسيل و PDF) بتطلع منه ═══
const دمج = await pg.evaluate(()=>{
  const باب = (code,size,qty,produced,w) => ({type:'Door', title:'باب '+code, code, size, unit:'door',
    qty, produced, unitPrice:5000, frame:'10', dbror:'6×9', width:String(w)});
  const طلبات = [
    { id:'W1', displayNo:1, date:'2026-09-01', customer:'ورشة النور', dist:'موزع', phone:'01',
      status:'Received', items:[ باب('A01','90 cm',10,4,90), باب('A02','70 cm',5,5,70) ] },
    { id:'W2', displayNo:2, date:'2026-09-02', customer:'ورشة النور', dist:'موزع', phone:'01',
      status:'In Progress', items:[ باب('A01','90 cm',6,0,90) ] },
    { id:'W3', displayNo:3, date:'2026-09-03', customer:'نجارة الأمل', dist:'موزع', phone:'02',
      status:'New', items:[ باب('A05','80 cm',7,2,80) ] }
  ];
  const data = buildPendingDoorsData_(طلبات);
  return data.map(c=>{
    const items = mergedCustomerItems_(c);
    let total=0, produced=0;
    items.forEach(it=>{ total+=it.qty; produced+=it.produced; });
    return {
      اسم: c.name,
      أصناف: items.map(it=>({ كود:it.code, مقاس:it.size, كمية:it.qty, جاهز:it.produced })),
      إجمالي: total, جاهز: produced, متبقي: total-produced,
      عدد_الجاهز: items.filter(it=>it.produced>0).length,
      عدد_المتبقي: items.filter(it=>(it.qty-it.produced)>0).length
    };
  });
});

// ورشة النور: A01 اتكرر في طلبين (١٠+٦=١٦ كمية، ٤+٠=٤ جاهز) + A02 (٥ كمية، ٥ جاهز)
{
  const c = دمج[0];
  check('الصنف المكرر في طلبين بيتدمج في سطر واحد',
    c.أصناف.length===2, JSON.stringify(c.أصناف));
  const a01 = c.أصناف.find(x=>x.كود==='A01');
  check('وكميته = مجموع الطلبين (١٦)', a01 && a01.كمية===16, JSON.stringify(a01));
  check('والجاهز بيتجمع صح (٤)', a01 && a01.جاهز===4, JSON.stringify(a01));
  check('إجمالي العميل ٢١ = مجموع الأصناف بعد الدمج',
    c.إجمالي===21, String(c.إجمالي));
  check('الجاهز ٩ والمتبقي ١٢', c.جاهز===9 && c.متبقي===12, 'جاهز='+c.جاهز+' متبقي='+c.متبقي);
  check('الصنف المكتمل (٥ من ٥) بيظهر في الجاهز ومايظهرش في المتبقي',
    c.عدد_الجاهز===2 && c.عدد_المتبقي===1,
    'جاهز='+c.عدد_الجاهز+' متبقي='+c.عدد_المتبقي);
}
{
  const c = دمج[1];
  check('العميل التاني: ٧ كمية، ٢ جاهز، ٥ متبقي',
    c.إجمالي===7 && c.جاهز===2 && c.متبقي===5, JSON.stringify(c));
}

// المقاس الخاص بيتحط في مجموعة لوحده وبيتعدّ في الإجمالي
{
  const r = await pg.evaluate(()=>{
    const data = buildPendingDoorsData_([{ id:'X', displayNo:9, date:'2026-09-01', customer:'ع', dist:'م',
      phone:'01', status:'New', items:[
        {type:'Door', title:'باب', code:'A01', size:'90 cm', unit:'door', qty:3, produced:0, width:'90'},
        {type:'Door', title:'باب خاص', code:'A01', size:'مقاس خاص 65×210', unit:'door', qty:2, produced:0}
      ]}]);
    return { إجمالي:data[0].total, مجموعات:data[0].perOrder[0].widths };
  });
  check('المقاس الخاص بيتعدّ في الإجمالي (٣+٢=٥)', r.إجمالي===5, String(r.إجمالي));
  check('وبيتحط في مجموعة «خاص» لوحده', r.مجموعات.includes('خاص'), r.مجموعات.join(','));
}

// الكمية الجاهزة أكبر من المطلوبة (بيانات بايظة من الشيت) مالازمش تطلّع متبقي بالسالب
{
  const r = await pg.evaluate(()=>{
    const data = buildPendingDoorsData_([{ id:'Y', displayNo:9, date:'2026-09-01', customer:'ع', dist:'م',
      phone:'01', status:'New', items:[
        {type:'Door', title:'باب', code:'A01', size:'90 cm', unit:'door', qty:3, produced:99, width:'90'}
      ]}]);
    const it = mergedCustomerItems_(data[0])[0];
    return { كمية:it.qty, جاهز:it.produced, متبقي:it.qty-it.produced };
  });
  check('الجاهز مايزيدش عن المطلوب', r.جاهز <= r.كمية, JSON.stringify(r));
  check('والمتبقي مايبقاش بالسالب', r.متبقي >= 0, JSON.stringify(r));
}

// ═══ ملف الإكسيل نفسه — بيتخطى لو مكتبة ExcelJS مش متاحة في البيئة ═══
const مكتبة = await pg.evaluate(async ()=>{
  try{ return await needLibs_('exceljs'); }catch(e){ return false; }
});
if(!مكتبة){
  console.log('⏭️  تخطّينا فحص ملف الإكسيل نفسه — مكتبة ExcelJS (cdnjs) محجوبة في البيئة دي');
} else {
  const dl = pg.waitForEvent('download', {timeout:60000});
  await pg.evaluate(async ()=>{
    const باب = (code,size,qty,produced,w) => ({type:'Door', title:'باب '+code, code, size, unit:'door',
      qty, produced, unitPrice:5000, frame:'10', dbror:'6×9', width:String(w)});
    await buildPendingDoorsExcel_([
      { id:'W1', displayNo:1, date:'2026-09-01', customer:'ورشة النور', dist:'م', phone:'01',
        status:'Received', items:[ باب('A01','90 cm',10,4,90), باب('A02','70 cm',5,5,70) ] },
      { id:'W2', displayNo:2, date:'2026-09-02', customer:'ورشة النور', dist:'م', phone:'01',
        status:'In Progress', items:[ باب('A01','90 cm',6,0,90) ] },
      { id:'W3', displayNo:3, date:'2026-09-03', customer:'نجارة الأمل', dist:'م', phone:'02',
        status:'New', items:[ باب('A05','80 cm',7,2,80) ] }
    ]);
  });
  const file = '/tmp/report-numbers.xlsx';
  await (await dl).saveAs(file);
  check('ملف الإكسيل اتولد', fs.statSync(file).size > 4000,
    Math.round(fs.statSync(file).size/1024)+' كيلوبايت');
  const خلايا = JSON.parse(execFileSync('python3', ['-c', `
import zipfile, re, json
z = zipfile.ZipFile('${'/tmp/report-numbers.xlsx'}')
shared = []
if 'xl/sharedStrings.xml' in z.namelist():
    s = z.read('xl/sharedStrings.xml').decode('utf-8')
    shared = [re.sub('<[^>]+>','', m) for m in re.findall(r'<si>(.*?)</si>', s, re.S)]
sheet = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
out = []
for ref, t, v in re.findall(r'<c [^>]*r="([A-Z]+\\d+)"(?:[^>]* t="(\\w+)")?[^>]*>(?:<v>(.*?)</v>)?', sheet):
    if not v: continue
    if t == 's':
        try: v = shared[int(v)]
        except Exception: pass
    out.append([ref, v])
print(json.dumps(out, ensure_ascii=False))
`]).toString());
  const نصوص = خلايا.map(c=>String(c[1]));
  check('أسماء العملاء في الملف',
    نصوص.some(v=>v.includes('ورشة النور')) && نصوص.some(v=>v.includes('نجارة الأمل')));
  check('أقسام الجاهز والمتبقي في الملف',
    نصوص.some(v=>v.includes('جاهز للتسليم')) && نصوص.some(v=>v.includes('متبقي')));
  const عمودD = خلايا.filter(c=>/^D\d+$/.test(c[0])).map(c=>Number(c[1])).filter(n=>!isNaN(n));
  check('مجموع الكميات في الملف = ٢٨ (جاهز ١١ + متبقي ١٧)',
    عمودD.reduce((a,c)=>a+c,0)===28, 'قيم='+عمودD.join(','));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
