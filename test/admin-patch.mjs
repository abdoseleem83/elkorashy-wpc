// شاشة المصنع كانت بتتستبدل بالكامل مع كل ضغطة. مع ٣٠٠ طلب دي ~١٠٠ مللي على
// جهاز سريع وأضعافها على موبايل — وده اللي بيخلي كل ضغطة تبان بطيئة.
// دلوقتي: لو كارت عميل واحد بس هو اللي اتغيّر، بيتستبدل هو لوحده.
// الاختبار بيتأكد إن التحديث الجزئي **مايخفيش** أي تغيير، وإن الشكل لما يتغيّر
// (عميل زاد أو نقص) بترجع الرسمة الكاملة.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const تجهيز = () => pg.evaluate(()=>{
  window.toast=()=>{};
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.groupOpen={}; state.admin.itemsOpen={}; state.admin.items={};
  state.admin.rows = Array.from({length:60},(_,i)=>({id:'W'+i, displayNo:i+1, date:'2026-09-01',
    customer:'عميل '+(i%10), dist:'د', region:'ر', phone:'01', status:'Received', qty:5, total:500}));
  renderNow();
});

// ١) تغيير في كارت عميل واحد = الكروت التانية ما اتلمستش
await تجهيز();
{
  const r = await pg.evaluate(()=>{
    const قبل = {};
    document.querySelectorAll('[data-grp]').forEach(el=>{ قبل[el.dataset.grp] = el; });
    state.admin.groupOpen['عميل 3'] = true;      // فتحنا عميل واحد
    renderNow();
    const بعد = {};
    document.querySelectorAll('[data-grp]').forEach(el=>{ بعد[el.dataset.grp] = el; });
    const اتغيّروا = Object.keys(قبل).filter(k => قبل[k] !== بعد[k]);
    return { اتغيّروا, فتح: !!document.querySelector('[data-act="adm-preview"]'),
             عدد: Object.keys(بعد).length };
  });
  check('كارت واحد بس هو اللي اتستبدل', r.اتغيّروا.length===1 && r.اتغيّروا[0]==='عميل 3',
    r.اتغيّروا.join(' · '));
  check('والعميل فتح فعلاً', r.فتح);
  check('وباقي العملاء لسه في مكانهم', r.عدد===10, 'عدد='+r.عدد);
}

// ٢) كل التغييرات لازم تظهر (مش متخبّية ورا التحديث الجزئي)
{
  const r = await pg.evaluate(()=>{
    const ن = {};
    state.admin.rows[3].customer = 'عميل 3';     // تأكيد إنه في نفس الكارت
    state.admin.busy = 'W3'; renderNow();
    ن.مشغول = document.getElementById('view').innerHTML.includes('جارٍ الحفظ');
    state.admin.busy = null; renderNow();
    ن.رجع = !document.getElementById('view').innerHTML.includes('جارٍ الحفظ');
    state.admin.rows[3].status = 'Ready'; renderNow();
    ن.حالة = document.getElementById('view').textContent.includes('جاهز للتحميل');
    state.admin.delBusy = 'W3'; renderNow();
    ن.حذف_مشغول = !!document.querySelector('[data-act="adm-del"][disabled]');
    state.admin.delBusy = null; renderNow();
    return ن;
  });
  check('«جارٍ الحفظ» بتظهر مع التحديث الجزئي', r.مشغول);
  check('وبتختفي بعدها', r.رجع);
  check('تغيير حالة الطلب بيظهر', r.حالة);
  check('وزرار الحذف بيتقفل وقت الحذف', r.حذف_مشغول);
}

// ٣) عميل جديد ظهر أو عميل اختفى = رسمة كاملة (مش تحديث جزئي)
{
  const r = await pg.evaluate(()=>{
    state.admin.rows.push({id:'NEW', displayNo:999, date:'2026-09-09', customer:'عميل جديد خالص',
      dist:'د', region:'ر', phone:'01', status:'New', qty:1, total:100});
    renderNow();
    const ظهر = document.getElementById('view').textContent.includes('عميل جديد خالص');
    state.admin.rows = state.admin.rows.filter(o=>o.id!=='NEW');
    renderNow();
    const اختفى = !document.getElementById('view').textContent.includes('عميل جديد خالص');
    return { ظهر, اختفى, عدد: document.querySelectorAll('[data-grp]').length };
  });
  check('عميل جديد بيظهر', r.ظهر);
  check('والعميل اللي اتشال بيختفي', r.اختفى);
  check('والعدد رجع صح', r.عدد===10, 'عدد='+r.عدد);
}

// ٤) أسماء العملاء اللي فيها علامات غريبة ما تكسرش المحدّد
{
  const r = await pg.evaluate(()=>{
    state.admin.rows[0].customer = 'ورشة "النور" / 5 [ب]';
    renderNow();
    const ظهر = document.getElementById('view').textContent.includes('ورشة "النور" / 5 [ب]');
    state.admin.busy = state.admin.rows[0].id; renderNow();   // تغيير جوّه الكارت ده
    const لسه = document.getElementById('view').textContent.includes('ورشة "النور" / 5 [ب]');
    state.admin.busy = null; renderNow();
    return { ظهر, لسه };
  });
  check('اسم عميل فيه علامات غريبة شغّال', r.ظهر && r.لسه, JSON.stringify(r));
}

// ٥) التنقل بين التبويبات والرجوع
{
  const r = await pg.evaluate(()=>{
    const قبل = document.querySelectorAll('[data-grp]').length;
    state.tab='orders'; renderNow();
    const برّه = !document.querySelector('[data-grp]');
    state.tab='admin'; renderNow();
    return { برّه, رجعنا: document.querySelectorAll('[data-grp]').length === قبل, قبل };
  });
  check('التنقل بين التبويبات سليم', r.برّه && r.رجعنا, JSON.stringify(r));
}

// ٦) شاشة المخزن (مسار تاني في نفس الشاشة) ما تخلطش مع الكروت
{
  const r = await pg.evaluate(()=>{
    const قبل = document.querySelectorAll('[data-grp]').length;
    state.admin.viewStock = true; renderNow();
    const مخزن = !document.querySelector('[data-grp]');
    state.admin.viewStock = false; renderNow();
    const رجعنا = document.querySelectorAll('[data-grp]').length === قبل;
    return { مخزن, رجعنا, قبل };
  });
  check('شاشة المخزن والرجوع منها سليمين', r.مخزن && r.رجعنا, JSON.stringify(r));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
