// معاينة الطلب الواحد (زرار «معاينة» على كارت الطلب في شاشة المصنع)،
// وخانة الملاحظات العامة ولونها المميّز في كل الشاشات والمستند.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915},deviceScaleFactor:2})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ــــ شاشة المصنع: طلب واحد بملاحظة عامة ــــ
await pg.evaluate(()=>{
  state.admin.open = true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows = [{id:'2026-0070', displayNo:70, editCount:0, date:'2026-09-06',
    dist:'محمد القرشي', phone:'01067765483', region:'طنطا', status:'Received',
    customer:'ورشة النور', qty:6, total:31000, ordNote:'التسليم قبل الجمعة والحلق أبيض'}];
  state.admin.items['2026-0070'] = [
    {type:'Door',title:'باب A01',code:'A01',size:'90 cm',unit:'door',qty:6,unitPrice:5200,produced:0,frame:'10',dbror:'6×9',width:'90'}];
  state.admin.groupOpen['ورشة النور'] = true;
  render();
});
await pg.waitForTimeout(700);

// الملاحظة لازم تبان على سطر الطلب في كارت العميل — من غير ما نفتح الطلب
{
  const غير_مفتوح = await pg.evaluate(()=>{ state.admin.groupOpen={}; renderNow();
    const n = document.querySelector('.grp-note');
    return { نص: n?n.textContent.trim():'', مفتوح: !!document.querySelector('.grp-ord ~ .ord') };
  });
  check('الملاحظة ظاهرة على سطر الطلب في كارت العميل',
    /التسليم قبل الجمعة/.test(غير_مفتوح.نص), غير_مفتوح.نص);
  await pg.evaluate(()=>{ state.admin.groupOpen['ورشة النور']=true; renderNow(); });
  await pg.waitForTimeout(300);
}

const prevBtn = await pg.$('[data-act="adm-preview"][data-id="2026-0070"]');
check('زرار معاينة موجود على كارت الطلب', !!prevBtn);

// الملاحظة بلون مميّز في كارت المصنع
const admNote = await pg.$('.ordnote');
check('الملاحظة ظاهرة بصندوق مميّز في شاشة المصنع', !!admNote);
if(admNote){
  const bg = await admNote.evaluate(el=>getComputedStyle(el).backgroundColor);
  const txt = await admNote.textContent();
  check('نص الملاحظة صحيح', txt.includes('التسليم قبل الجمعة'), txt.trim().slice(0,60));
  check('لون خلفية الملاحظة مميّز (مش أبيض)', bg!=='rgba(0, 0, 0, 0)' && bg!=='rgb(255, 255, 255)', bg);
}

// ــــ فتح المعاينة لطلب واحد ــــ
if(prevBtn) await prevBtn.click();
await pg.waitForTimeout(1200);
const ov = await pg.$('#reportPreviewOverlay');
check('المعاينة فتحت للطلب الواحد', !!ov);
if(ov){
  const title = await (await pg.$('.rpv-bar b')).textContent();
  check('عنوان المعاينة رقم الطلب مش اسم العميل', title.includes('70') && !title.includes('ورشة'), title);
  const pages = await pg.$$eval('.rpv-page > div', els=>els.length);
  check('صفحة واحدة بس (الطلب المعروض)', pages===1, 'عدد='+pages);
  const pdfId = await pg.$eval('[data-act="rpv-pdf"]', el=>el.dataset.id||'');
  check('زرار PDF في المعاينة مربوط بالطلب نفسه', pdfId==='2026-0070', pdfId);
  const noteInDoc = await pg.$eval('.rpv-page', el=>el.textContent.includes('ملاحظات عامة على الأوردر'));
  check('الملاحظة العامة مطبوعة في المستند', noteInDoc);
  await pg.click('[data-act="rpv-close"]');
}

// ــــ نموذج الطلب عند الموزّع: الخانة بصندوق ملوّن ــــ
await pg.evaluate(()=>{
  state.admin.open=false; state.tab='cart';
  state.cart = [{type:'Door',title:'باب A01',code:'A01',size:'90 cm',sizeTxt:'90 سم',unit:'door',qty:2,unitPrice:5200}];
  render();
});
await pg.waitForTimeout(700);
const box = await pg.$('.ordnote-box');
check('خانة الملاحظات العامة في نموذج الطلب بصندوق ملوّن', !!box);
if(box){
  const bg = await box.evaluate(el=>getComputedStyle(el).backgroundColor);
  check('خلفية الخانة مميّزة', bg!=='rgba(0, 0, 0, 0)' && bg!=='rgb(255, 255, 255)', bg);
  check('فيه textarea جوّه الصندوق', !!(await box.$('[data-act="ord-note"]')));
}

check('مفيش أخطاء جافاسكريبت', errs.length===0, errs.join(' | '));
console.log(`\n${pass} نجح / ${fail} فشل`);
await b.close();
process.exit(fail?1:0);
