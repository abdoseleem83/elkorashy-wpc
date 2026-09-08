// لما يجي طلب جديد للمصنع لازم يبان بوضوح: شارة على التبويب + إشعار + نافذة
// منبثقة تفضل قدامه. الإشعار الوحيد اللي كان موجود قبل كده رسالة توست بتختفي
// في أقل من ٣ ثواني — والمصنع بيشتغل على ماكينة والتليفون جنبه، فسهل تفوته.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const طلب = (id,no,dist,qty)=>({id, displayNo:no, editCount:0, date:'2026-09-08',
  dist, phone:'01', region:'ط', status:'New', customer:'ورشة '+dist, qty, total:qty*100});

const poll = (rows) => pg.evaluate(async(rows)=>{
  state.admin.pw='x';
  const إشعارات=[];
  window.Notification = undefined;               // مفيش إذن إشعارات → بيقع على التوست
  const old=window.toast; window.toast=m=>إشعارات.push(m);
  window.jsonp = ()=>Promise.resolve({ok:true, orders:rows});
  await adminPoll();
  window.toast=old;
  const ov = document.getElementById('newOrdersOverlay');
  return { إشعارات, نافذة: !!ov, نص_النافذة: ov ? ov.innerText.replace(/\s+/g,' ') : '',
           شارة: (document.getElementById('admBadge')||{}).hidden===false,
           عدد_الشارة: (document.getElementById('admBadge')||{}).textContent };
}, rows);

// ١) أول تشغيلة على جهاز جديد: الموجود مايبانش كأنه جديد
await pg.evaluate(()=>localStorage.removeItem('wpc_admin_seen'));
const r1 = await poll([طلب('A1',10,'محمد',3), طلب('A2',11,'أحمد',2), طلب('A3',12,'سيد',1)]);
check('أول تشغيلة: مفيش نافذة بقايمة كل الطلبات القديمة', !r1.نافذة, r1.نص_النافذة.slice(0,60));

// ٢) طلب واحد جديد بعد كده
const r2 = await poll([طلب('A1',10,'محمد',3), طلب('A2',11,'أحمد',2), طلب('A3',12,'سيد',1), طلب('NEW1',13,'كريم',5)]);
check('طلب جديد: النافذة بتفتح', r2.نافذة);
check('وفيها رقم الطلب', /13/.test(r2.نص_النافذة), r2.نص_النافذة.slice(0,90));
check('واسم صاحب الحساب', /كريم/.test(r2.نص_النافذة), r2.نص_النافذة.slice(0,90));
check('وعدد القطع', /5 قطعة/.test(r2.نص_النافذة), r2.نص_النافذة.slice(0,90));
check('وفيها زرار يفتح شاشة المصنع', /افتح شاشة المصنع/.test(r2.نص_النافذة));
check('والشارة على التبويب ظهرت', r2.شارة, 'عدد: '+r2.عدد_الشارة);
check('وفيه إشعار كمان', r2.إشعارات.some(m=>/طلب جديد/.test(String(m))), JSON.stringify(r2.إشعارات));

// ٣) تلات طلبات مع بعض = نافذة واحدة مش تلاتة
await pg.evaluate(()=>{ const o=document.getElementById('newOrdersOverlay'); if(o) o.remove(); });
const r3 = await poll([طلب('A1',10,'محمد',3), طلب('B1',20,'س',1), طلب('B2',21,'ع',2), طلب('B3',22,'ن',3)]);
const عدد_النوافذ = await pg.evaluate(()=>document.querySelectorAll('#newOrdersOverlay').length);
check('٣ طلبات مع بعض = نافذة واحدة', عدد_النوافذ===1, String(عدد_النوافذ));
check('بتقول «٣ طلبات جديدة»', /3 طلبات جديدة/.test(r3.نص_النافذة), r3.نص_النافذة.slice(0,70));
check('وبتعرض التلاتة', /20/.test(r3.نص_النافذة) && /21/.test(r3.نص_النافذة) && /22/.test(r3.نص_النافذة),
  r3.نص_النافذة.slice(0,110));
check('وإشعار واحد مش تلاتة',
  r3.إشعارات.filter(m=>/طلبات جديدة|طلب جديد/.test(String(m))).length===1, JSON.stringify(r3.إشعارات));

// ٤) زرار «افتح شاشة المصنع» بيشتغل ويصفّر الشارة
const r4 = await pg.evaluate(async()=>{
  document.getElementById('newOrdersOpen').click();
  await new Promise(r=>setTimeout(r,250));
  return { تبويب: state.tab, نافذة: !!document.getElementById('newOrdersOverlay'),
           شارة_مخفية: (document.getElementById('admBadge')||{}).hidden };
});
check('الزرار بيفتح شاشة المصنع', r4.تبويب==='admin', r4.تبويب);
check('وبيقفل النافذة', !r4.نافذة);
check('وبيصفّر الشارة', r4.شارة_مخفية===true, String(r4.شارة_مخفية));

// ٥) تغيير حالة طلب موجود مش «طلب جديد»
await pg.evaluate(()=>{ const o=document.getElementById('newOrdersOverlay'); if(o) o.remove(); });
const r5 = await poll([Object.assign(طلب('A1',10,'محمد',3), {status:'Ready'})]);
check('تغيير الحالة مابيفتحش نافذة طلب جديد', !r5.نافذة, r5.نص_النافذة.slice(0,60));
check('بس بيبعت إشعار بالتغيير', r5.إشعارات.some(m=>/تم تعديله/.test(String(m))), JSON.stringify(r5.إشعارات));

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
