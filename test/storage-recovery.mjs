// «في طلبات اختفت لما عملت تحديث» — أخطر بلاغ في المشروع.
// السبب المحتمل: الـService Worker بيعمل reload إجباري لكل الصفحات مع كل نسخة
// جديدة. لو ده حصل وسط كتابة قايمة الطلبات، الـJSON بيتقطع — و load() كانت
// بترجّع قايمة فاضية في صمت، وأول حفظ بعدها بيكتب الفاضي فوق المخرب.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const URL_ = process.env.APP_URL || 'http://localhost:8100/index.html';

// ═══ ١) JSON مقطوع في النص — لازم يترجّع أكبر عدد ممكن ═══
{
  const ctx = await b.newContext({viewport:{width:412,height:915}});
  const pg = await ctx.newPage();
  await pg.goto(URL_,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1200);
  // نبني قايمة حقيقية ونقطعها زي ما بيحصل لما الكتابة تتقطع
  const مقطوع = await pg.evaluate(()=>{
    const o = i => ({id:'W'+i, ts:Date.now(), displayNo:i, name:'محمد', phone:'01012345678',
      region:'طنطا', items:[{kind:'door',title:'باب',qty:2,unitPrice:100}], total:200});
    const كامل = JSON.stringify([o(1),o(2),o(3),o(4),o(5)]);
    return كامل.slice(0, Math.floor(كامل.length * 0.72));   // اتقطع في النص
  });
  await pg.evaluate(t=>localStorage.setItem('wpc_orders', t), مقطوع);
  await pg.reload({waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1500);
  const r = await pg.evaluate(()=>({
    عدد: state.orders.length,
    أرقام: state.orders.map(o=>o.displayNo),
    الأصل_محفوظ: !!localStorage.getItem('wpc_orders_corrupt'),
    مشاكل: _storeProblems_.length
  }));
  check('JSON مقطوع: رجّع الطلبات السليمة بدل ما يضيّعها كلها', r.عدد>0, `${r.عدد} طلب — ${JSON.stringify(r.أرقام)}`);
  check('والأصل المخرب اتحفظ عشان ينفع يترجع يدويًا', r.الأصل_محفوظ);
  check('والتطبيق سجّل إن فيه مشكلة (مش سكت عليها)', r.مشاكل>0, String(r.مشاكل));
  const msg = await pg.evaluate(()=>new Promise(res=>{
    const t=document.getElementById('toast');
    const i=setInterval(()=>{ if(t.classList.contains('show')){ clearInterval(i); res(t.textContent); } },100);
    setTimeout(()=>{ clearInterval(i); res(''); },4000);
  }));
  check('والمستخدم شاف رسالة بتقول اللي حصل', /مقطوعة|مخربة/.test(msg), msg.slice(0,80));
  await ctx.close();
}

// ═══ ٢) الفاضي مايتكتبش فوق المخرب قبل ما نحاول نرجّعه ═══
{
  const ctx = await b.newContext({viewport:{width:412,height:915}});
  const pg = await ctx.newPage();
  await pg.goto(URL_,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1200);
  await pg.evaluate(()=>localStorage.setItem('wpc_orders','[{"id":"A","displayNo":1},{"id":"B"'));
  await pg.reload({waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1400);
  const r = await pg.evaluate(()=>({
    عدد: state.orders.length,
    الأصل: localStorage.getItem('wpc_orders_corrupt')
  }));
  check('طلب واحد سليم + واحد مقطوع → رجّع السليم', r.عدد===1, String(r.عدد));
  check('والأصل كامل زي ما كان', r.الأصل==='[{"id":"A","displayNo":1},{"id":"B"', String(r.الأصل));
  await ctx.close();
}

// ═══ ٣) المساحة امتلت: القص لازم يقول للمستخدم مش يسكت ═══
{
  const ctx = await b.newContext({viewport:{width:412,height:915}});
  const pg = await ctx.newPage();
  await pg.goto(URL_,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1200);
  const r = await pg.evaluate(()=>{
    const msgs=[]; const old=window.toast; window.toast=(m)=>msgs.push(m);
    const real = Storage.prototype.setItem;
    let أول = true;
    Storage.prototype.setItem = function(k,v){
      if(k==='wpc_orders' && أول){ أول=false; const e=new Error('QuotaExceededError');
        e.name='QuotaExceededError'; throw e; }
      return real.apply(this, arguments);
    };
    const قايمة = Array.from({length:40},(_,i)=>({id:'W'+i, displayNo:i}));
    state.orders = قايمة.slice();
    const ok = save('wpc_orders', قايمة);
    Storage.prototype.setItem = real; window.toast = old;
    return { ok, msgs, باقي: state.orders.length };
  });
  check('القص بيحصل عشان الطلب الجديد يتحفظ', r.ok===true && r.باقي<40, `${r.باقي} من 40`);
  check('والمستخدم اتنبّه إن طلبات قديمة اتشالت',
    r.msgs.some(m=>/مساحة/.test(String(m)) && /طلب قديم/.test(String(m))), JSON.stringify(r.msgs));
  check('والرسالة بتطمّنه إنها لسه عند المصنع',
    r.msgs.some(m=>/عند المصنع/.test(String(m))), JSON.stringify(r.msgs));
  await ctx.close();
}

// ═══ ٤) التخزين السليم مايتلمسش ═══
{
  const ctx = await b.newContext({viewport:{width:412,height:915}});
  const pg = await ctx.newPage();
  await pg.goto(URL_,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1200);
  await pg.evaluate(()=>localStorage.setItem('wpc_orders', JSON.stringify(
    [{id:'A',displayNo:1},{id:'B',displayNo:2},{id:'C',displayNo:3}])));
  await pg.reload({waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1400);
  const r = await pg.evaluate(()=>({ عدد: state.orders.length,
    مشاكل: _storeProblems_.length, نسخة_مخربة: !!localStorage.getItem('wpc_orders_corrupt') }));
  check('التخزين السليم بيتقرا عادي', r.عدد===3, String(r.عدد));
  check('من غير ما يتسجّل أي مشكلة', r.مشاكل===0, String(r.مشاكل));
  check('ومن غير ما يتعمل نسخة مخربة', !r.نسخة_مخربة);
  await ctx.close();
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
