// شكل v185: التبويبات نزلت تحت الشاشة والهيدر بقى شريط زجاجي.
// أي حاجة ثابتة تحت (التبويبات / شريط الإجمالي / التوست) ممكن تغطّي محتوى
// المستخدم محتاجه — الاختبار ده بيتأكد إنهم متراصّين فوق بعض من غير تغطية.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:412,height:915}});
const pg = await ctx.newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const صندوق = sel => pg.evaluate(s=>{
  const el=document.querySelector(s); if(!el) return null;
  const r=el.getBoundingClientRect();
  return {top:Math.round(r.top), bottom:Math.round(r.bottom), left:Math.round(r.left),
          right:Math.round(r.right), h:Math.round(r.height),
          fixed:getComputedStyle(el).position==='fixed', vh:window.innerHeight};
}, sel);

// ═══ التبويبات تحت وثابتة ═══
const nav = await صندوق('#tabs');
check('شريط التبويبات ثابت (مابيتحركش مع التمرير)', nav && nav.fixed===true, JSON.stringify(nav));
check('ومكانه تحت الشاشة', nav && Math.abs(nav.bottom - nav.vh) <= 2, `${nav&&nav.bottom} من ${nav&&nav.vh}`);
check('ومساحة اللمس كافية (٤٤ بكسل على الأقل لكل زرار)',
  (await pg.evaluate(()=>[...document.querySelectorAll('#tabs button')]
     .every(b=>b.getBoundingClientRect().height>=44))), '');
check('التبويبات الأربعة لسه ظاهرة', (await pg.$$('#tabs button:not([hidden])')).length===4);

// ═══ الهيدر: الإصدار وزراير التحديث/التثبيت ═══
check('رقم الإصدار ظاهر في الهيدر', /^v\d+/.test((await pg.textContent('#vsVer')||'').trim()),
  await pg.textContent('#vsVer'));
check('زرار التحديث لسه موجود', (await pg.$$('[data-act="update"]')).length===1);
check('وزرار التثبيت كمان', (await pg.$$('#vsInstall[data-act="install"]')).length===1);
check('الهيدر فوق وثابت مش بيغطّي التبويبات',
  (await pg.evaluate(()=>{ const t=document.querySelector('.top').getBoundingClientRect();
    const n=document.getElementById('tabs').getBoundingClientRect(); return t.bottom < n.top; })));

// ═══ شريط الإجمالي فوق التبويبات مش تحتها ═══
await pg.evaluate(()=>{
  window.toast=()=>{};
  state.cart=[{kind:'door',code:'A01',title:'باب',sizeTxt:'70 سم',sizeEn:'70 cm',w:70,qty:2,unitPrice:5400}];
  state.tab='new'; render();
});
await pg.waitForTimeout(400);
const bar = await صندوق('#bar');
check('شريط الإجمالي بان لما السلة فيها حاجة', bar && bar.h>0, JSON.stringify(bar));
check('وقاعد فوق التبويبات بالظبط من غير تداخل',
  bar && nav && Math.abs(bar.bottom - nav.top) <= 2, `${bar&&bar.bottom} مقابل ${nav&&nav.top}`);

// ═══ آخر كارت في الصفحة ما يتغطّاش ═══
const مغطّى = await pg.evaluate(()=>{
  window.scrollTo(0, document.body.scrollHeight);
  const cards=[...document.querySelectorAll('#view>.card')];
  if(!cards.length) return 'مفيش كروت';
  const last=cards[cards.length-1].getBoundingClientRect();
  const bar=document.getElementById('bar');
  const حاجز = (bar && !bar.hidden ? bar.getBoundingClientRect().top
                                   : document.getElementById('tabs').getBoundingClientRect().top);
  return last.bottom <= حاجز + 1 ? null : Math.round(last.bottom - حاجز)+'px متغطّيين';
});
check('آخر كارت بيخلص فوق الشريط السفلي', مغطّى===null, String(مغطّى));

// ═══ التوست فوق الشريط السفلي ═══
const toast = await pg.evaluate(()=>{
  const t=document.getElementById('toast'); t.classList.add('show'); t.textContent='تجربة';
  const r=t.getBoundingClientRect();
  const bar=document.getElementById('bar');
  const حاجز=(bar && !bar.hidden ? bar.getBoundingClientRect().top
                                 : document.getElementById('tabs').getBoundingClientRect().top);
  t.classList.remove('show');
  return {bottom:Math.round(r.bottom), حاجز:Math.round(حاجز)};
});
check('التوست بيبان فوق شريط الإجمالي/التبويبات', toast.bottom <= toast.حاجز + 1,
  JSON.stringify(toast));

// ═══ الهوية: ألوان الخشب ═══
const ألوان = await pg.evaluate(()=>{
  const cs=getComputedStyle(document.documentElement);
  return { brand:cs.getPropertyValue('--brand').trim(), bg:cs.getPropertyValue('--bg').trim(),
           body:getComputedStyle(document.body).backgroundColor };
});
check('اللون الأساسي بقى بُني الخشب', ألوان.brand.toUpperCase()==='#A6642F', ألوان.brand);
check('وخلفية التطبيق بيج دافي', ألوان.bg.toUpperCase()==='#F7F2EC', ألوان.bg);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
