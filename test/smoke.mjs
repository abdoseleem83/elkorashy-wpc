import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const URL=process.env.APP_URL || 'http://localhost:8100/index.html';
const b = await chromium.launch();
let pass=0, fail=0;
const check=(name,ok,extra='')=>{ console.log((ok?'✅':'❌')+' '+name+(extra?'  — '+extra:'')); ok?pass++:fail++; };

async function newPage(){
  const pg = await (await b.newContext({viewport:{width:412,height:915},acceptDownloads:true})).newPage();
  pg.on('pageerror',e=>{ console.log('   ⚠️ خطأ صفحة:', e.message); fail++; });
  await pg.goto(URL,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(900);
  const s=await pg.$('.gateskip'); if(s){await s.click(); await pg.waitForTimeout(300);}
  return pg;
}
async function fillProfile(pg){
  await pg.fill('[data-act="prof"][data-k="name"]','محمد القرشي');
  await pg.fill('[data-act="prof"][data-k="phone"]','01012345678');
  await pg.fill('[data-act="cust-name"]','ورشة النور');
}
async function addDoor(pg){
  await pg.click('.secnav button'); await pg.waitForTimeout(300);
  await pg.click('[data-act="pick-door"]'); await pg.waitForTimeout(400);
  await pg.click('[data-act="toggle-size"]'); await pg.waitForTimeout(300);
  await pg.click('[data-act="size-frame"]'); await pg.click('[data-act="size-dbror"]'); await pg.waitForTimeout(300);
  await pg.click('[data-act="add-door"]'); await pg.waitForTimeout(500);
}

console.log('\n══ ١. الفتح والتنقل ══');
{ const pg=await newPage();
  check('المكتبات التقيلة مش محمّلة عند الفتح',
    await pg.evaluate(()=>typeof html2canvas==='undefined' && !window.jspdf && typeof ExcelJS==='undefined'));
  check('التبويبات الأربعة ظاهرة', (await pg.$$('#tabs button:not([hidden])')).length===4);
  check('شارة السلة مخفية وهي فاضية',
    await pg.evaluate(()=>document.getElementById('cartBadge').classList.contains('zero')));
  for(const t of ['cart','orders','admin','new']){ await pg.click(`[data-tab="${t}"]`); await pg.waitForTimeout(350); }
  check('التنقل بين كل التبويبات من غير أخطاء', true);
  await pg.context().close(); }

console.log('\n══ ٢. الكيبورد والفوكس ══');
{ const pg=await newPage();
  await pg.click('[data-tab="admin"]'); await pg.waitForTimeout(400);
  const pw=await pg.$('[data-act="adm-pw"]'); await pw.click();
  await pg.keyboard.type('1234'); await pg.waitForTimeout(300);
  check('الكتابة في خانة كلمة السر ما بتضيعش الفوكس',
    await pg.evaluate(()=>document.activeElement?.dataset?.act)==='adm-pw',
    'القيمة: '+await pw.inputValue());
  await pg.context().close(); }

console.log('\n══ ٣. السلة والتعديل ══');
{ const pg=await newPage(); await fillProfile(pg); await addDoor(pg);
  check('الصنف اتضاف للسلة', await pg.evaluate(()=>state.cart.length)===1);
  await pg.click('[data-tab="cart"]'); await pg.waitForTimeout(400);
  await pg.click('[data-act="edit-line"]'); await pg.waitForTimeout(500);
  check('«تعديل» بيسحب الصنف', await pg.evaluate(()=>state.cart.length)===0);
  await pg.click('[data-tab="orders"]'); await pg.waitForTimeout(450);
  check('الخروج من غير إكمال بيرجّع الصنف', await pg.evaluate(()=>state.cart.length)===1);
  await pg.click('[data-tab="new"]'); await pg.waitForTimeout(450);
  check('شاشة الاختيار اتصفّرت (مفيش تكرار)',
    (await pg.$$('[data-act^="add-"]:not([disabled])')).length===0);
  await pg.context().close(); }

console.log('\n══ ٤. التصدير ══');
{ const pg=await newPage(); await fillProfile(pg); await addDoor(pg);
  await pg.evaluate(()=>{ state.orders=[{id:'T1',ts:Date.now(),name:'محمد',phone:'01012345678',
    region:'طنطا',warehouse:'إنشاص',status:'New',total:5000,items:JSON.parse(JSON.stringify(state.cart))}]; });
  // مكتبات التصدير بتتحمّل من CDN. لو الشبكة مقفولة (بروكسي/أوفلاين) القسم ده
  // مش بيقدر يشتغل — بنقول "اتخطّى" بدل ما نطلّع فشل وهمي يخبّي فشل حقيقي.
  const libsOk = await pg.evaluate(async()=>{
    try{ return await needLibs_('exceljs','html2canvas','jspdf'); }catch(e){ return false; }
  });
  if(!libsOk){
    console.log('⏭️  اتخطّى قسم التصدير — مكتبات الـCDN مش واصلة من الشبكة دي');
    await pg.context().close();
  } else {
  let d = pg.waitForEvent('download',{timeout:30000});
  await pg.evaluate(()=>exportExcel(state.orders,'اختبار'));
  await (await d).saveAs('/tmp/suite.xlsx');
  check('تصدير الإكسيل شغّال', fs.statSync('/tmp/suite.xlsx').size>4000,
        Math.round(fs.statSync('/tmp/suite.xlsx').size/1024)+' كيلوبايت');
  d = pg.waitForEvent('download',{timeout:45000});
  await pg.evaluate(()=>makeDoc(state.orders[0],'order'));
  await (await d).saveAs('/tmp/suite.pdf');
  check('تصدير الـ PDF شغّال', fs.statSync('/tmp/suite.pdf').size>20000,
        Math.round(fs.statSync('/tmp/suite.pdf').size/1024)+' كيلوبايت');
  check('شاشة الانتظار اتقفلت في الآخر',
    await pg.evaluate(()=>!document.getElementById('busy').classList.contains('on')));
  await pg.context().close(); } }

console.log('\n══ ٥. معرّف الجهاز ══');
{ const pg=await newPage();
  const id=await pg.evaluate(()=>deviceId_());
  check('ثابت في نفس الجلسة', id===await pg.evaluate(()=>deviceId_()));
  check('محفوظ في التخزين', await pg.evaluate(()=>localStorage.getItem('wpc_dev'))===id);
  check('بيتبعت مع نداءات المصنع',
    (await pg.evaluate(()=>{state.admin.pw='x'; return admParams_();})).includes('dev='));
  await pg.context().close(); }

console.log(`\n${'═'.repeat(34)}\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
