// شاشة المصنع بتترسم مع كل ضغطة ومع كل فحص خلفي، واستبدال الشاشة كلها تقيل
// (مع ٣٠٠ طلب: ~١٠٠ مللي على جهاز سريع، أضعاف كده على موبايل). لو الناتج مطابق
// للي معروض، مالوش لازمة نلمس الصفحة. الاختبار بيتأكد إن التخطي بيحصل
// **من غير** ما يمنع أي تغيير حقيقي من الظهور.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

await pg.evaluate(()=>{
  window.toast=()=>{};
  state.admin.open=true; state.admin.pw='x'; state.tab='admin';
  state.admin.rows = Array.from({length:120},(_,i)=>({id:'W'+i, displayNo:i+1, date:'2026-09-01',
    customer:'عميل '+(i%20), dist:'د', region:'ر', phone:'01', status:'Received', qty:5, total:500}));
  renderNow();
});

// ١) رسمة مطابقة = الصفحة ما اتلمستش (نفس العناصر بالظبط)
{
  const r = await pg.evaluate(()=>{
    const قبل = document.querySelector('.ord');
    renderNow();
    const بعد = document.querySelector('.ord');
    return { نفس_العنصر: قبل === بعد };
  });
  check('رسمة مطابقة مابتستبدلش الشاشة', r.نفس_العنصر);
}

// ٢) الرسمة المتطابقة مابتعملش أي شغل على الصفحة أصلًا
//    (بنعدّ التغييرات الفعلية في الشجرة بدل ما نقيس وقت — الوقت بيتأرجح)
{
  const r = await pg.evaluate(async ()=>{
    const v = document.getElementById('view');
    let تغييرات = 0;
    const مراقب = new MutationObserver(ms => { تغييرات += ms.length; });
    مراقب.observe(v, { childList:true, subtree:true, attributes:true, characterData:true });
    for(let i=0;i<20;i++) renderNow();
    await new Promise(r=>setTimeout(r,50));
    const بعد_المتطابقة = تغييرات;
    state.admin.rows[0].qty = 999;                   // تغيير حقيقي
    renderNow();
    await new Promise(r=>setTimeout(r,50));
    مراقب.disconnect();
    return { بعد_المتطابقة, بعد_التغيير: تغييرات };
  });
  check('٢٠ رسمة متطابقة = صفر تعديل على الصفحة', r.بعد_المتطابقة===0, 'تعديلات='+r.بعد_المتطابقة);
  check('وأول تغيير حقيقي بيتكتب في الصفحة', r.بعد_التغيير > 0, 'تعديلات='+r.بعد_التغيير);
}

// ٣) أي تغيير حقيقي لازم يظهر
{
  const r = await pg.evaluate(()=>{
    state.admin.rows[0].customer = 'عميل اتغيّر';
    renderNow();
    const ظهر = document.getElementById('view').textContent.includes('عميل اتغيّر');
    state.admin.groupOpen['عميل اتغيّر'] = true;
    renderNow();
    const فتح = !!document.querySelector('[data-act="adm-preview"]');
    state.admin.busy = 'W0'; renderNow();
    const مشغول = document.getElementById('view').innerHTML.includes('جارٍ الحفظ');
    state.admin.busy = null; renderNow();
    const رجع = !document.getElementById('view').innerHTML.includes('جارٍ الحفظ');
    return { ظهر, فتح, مشغول, رجع };
  });
  check('تغيير اسم العميل بيظهر', r.ظهر);
  check('فتح العميل بيظهر', r.فتح);
  check('علامة «جارٍ الحفظ» بتظهر', r.مشغول);
  check('وبتختفي بعد ما يخلص', r.رجع);
}

// ٤) الخروج من الشاشة والرجوع ليها بيرسم من الأول
{
  const r = await pg.evaluate(()=>{
    state.tab='orders'; renderNow();
    const برّه = !document.querySelector('.grp-hd');
    state.tab='admin'; renderNow();
    const رجعنا = !!document.querySelector('.grp-hd');
    return { برّه, رجعنا };
  });
  check('التنقل بين التبويبات لسه شغّال', r.برّه && r.رجعنا, JSON.stringify(r));
}

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
