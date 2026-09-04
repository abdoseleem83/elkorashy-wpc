// سباقات الحالة: عمليات غير متزامنة بتعدّل نفس البيانات في نفس الوقت.
// دي أصعب نوع باج يتلاقى بالقراءة، لأنه بيعتمد على التوقيت.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ---------- ١) الفحص الخلفي بيرد وسط تعديل كمية ----------
const r1 = await pg.evaluate(async()=>{
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows=[{id:'A1',displayNo:1,editCount:0,date:'2026-09-04',dist:'م',phone:'01',
    region:'ط',status:'Received',customer:'ع1',qty:5,total:100}];
  state.admin.items['A1']=[{type:'Door',title:'باب',code:'A01',size:'70 cm',unit:'door',qty:5,unitPrice:100,produced:0}];
  state.admin.itemsOpen['A1']=true; state.admin.groupOpen['ع1']=true;
  state.admin.qtyEditOpen['A1']=true;
  renderNow();
  // المستخدم بيكتب كمية جديدة
  state.admin.qtyEdit['A1:0']='3';
  const inp=document.querySelector('[data-act="item-qty-set"]');
  if(inp){ inp.focus(); }
  const before=document.activeElement?.dataset?.act;
  // الفحص الخلفي بيرد ببيانات جديدة في نفس اللحظة
  window.jsonp = async()=>({ok:true, orders:[{id:'A1',displayNo:1,editCount:0,date:'2026-09-04',
    dist:'م',phone:'01',region:'ط',status:'In Progress',customer:'ع1',qty:5,total:100}]});
  await adminPoll();
  await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,50)));
  return { الفوكس_قبل:before, الفوكس_بعد:document.activeElement?.dataset?.act,
           الكمية_المكتوبة:state.admin.qtyEdit['A1:0'] };
});
check('الفحص الخلفي ما ضيّعش الفوكس أثناء الكتابة',
  r1.الفوكس_قبل==='item-qty-set' && r1.الفوكس_بعد==='item-qty-set', `${r1.الفوكس_قبل} → ${r1.الفوكس_بعد}`);
check('الكمية اللي المستخدم كتبها ما اتمسحتش', r1.الكمية_المكتوبة==='3', r1.الكمية_المكتوبة);

// ---------- ٢) ضغطتين على «معاينة» ورا بعض ----------
const r2 = await pg.evaluate(async()=>{
  closeReportPreview_(); state.admin.items={};
  let calls=0;
  window.jsonp = () => { calls++; return new Promise(res=>setTimeout(()=>res({ok:true, items:[
    {type:'Door',title:'باب',code:'A01',size:'70 cm',unit:'door',qty:2,unitPrice:100,produced:0}]}), 120)); };
  previewCustomerOrder_('ع1');           // من غير await
  previewCustomerOrder_('ع1');           // ضغطة تانية فورًا
  previewCustomerOrder_('ع1');
  await new Promise(r=>setTimeout(r,900));
  return { نداءات:calls, طبقات:document.querySelectorAll('#reportPreviewOverlay').length };
});
check('ضغطتين على «معاينة» = نداء واحد مش تلاتة', r2.نداءات===1, String(r2.نداءات));
check('طبقة معاينة واحدة مش مكرّرة', r2.طبقات===1, String(r2.طبقات));

// ---------- ٣) إعادة إرسال الطلبات المعلّقة مرتين في نفس اللحظة ----------
const r3 = await pg.evaluate(async()=>{
  closeReportPreview_();
  state.orders=[{id:'P1',ts:Date.now(),name:'م',phone:'01012345678',region:'ط',
    items:[{kind:'door',title:'باب',qty:1}],total:1}];
  savePendingSync_(['P1']);
  let sends=0;
  window.jsonp = () => { sends++; return new Promise(res=>setTimeout(()=>res({ok:true, displayNo:9}), 150)); };
  retryPendingOrders_(); retryPendingOrders_(); retryPendingOrders_();
  await new Promise(r=>setTimeout(r,800));
  return { مرات_الإرسال:sends, لسه_معلق:loadPendingSync_().length };
});
check('الطلب المعلّق اتبعت مرة واحدة مش تلاتة', r3.مرات_الإرسال===1, String(r3.مرات_الإرسال));
check('اتشال من قايمة المعلّق', r3.لسه_معلق===0, String(r3.لسه_معلق));

// ---------- ٤) تبديل تبويب أثناء تحميل شاشة المصنع ----------
const r4 = await pg.evaluate(async()=>{
  let resolve; window.jsonp = () => new Promise(r=>{resolve=r;});
  state.admin.rows=null; state.admin.open=false; state.tab='admin';
  adminLoad();
  state.tab='new'; renderNow();                 // المستخدم بدّل تبويب
  resolve({ok:true, orders:[{id:'B1',displayNo:1,date:'2026-09-04',dist:'م',phone:'01',
    region:'ط',status:'New',customer:'ع2',qty:1,total:1}]});
  await new Promise(r=>setTimeout(r,400));
  return { التبويب:state.tab, فيه_طلبات:(state.admin.rows||[]).length };
});
check('الرد المتأخر ما رجّعش المستخدم لشاشة المصنع', r4.التبويب==='new', r4.التبويب);
check('البيانات اتخزّنت برضه للمرة الجاية', r4.فيه_طلبات===1, String(r4.فيه_طلبات));

check('مفيش أخطاء صفحة', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
