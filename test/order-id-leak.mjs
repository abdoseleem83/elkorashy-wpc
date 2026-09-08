// الكود الداخلي للطلب (W260908-050013J9E) حاجة داخلية — الموزّع والمصنع
// بيتعاملوا بالرقم التسلسلي (52 · 52/1). الباج ده اتصلّح تلات مرات في أماكن
// مختلفة (الواتساب، التوست، «بدل الطلب») لأنه كان بيتكتب بالإيد في كل مكان.
// الاختبار ده بيقفل الباب: أي نص عربي جديد بيلزق o.id فيه هيفشل هنا.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

// ═══ فحص المصدر: مفيش نص عربي بيلزق الكود الداخلي ═══
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// ⚠️ الكاشف ده اتصلّح تلات مرات:
//  ١) كان بيقف عند السطر الجديد → ما شافش تسريب جوّه قالب متعدد السطور.
//  ٢) وسّعته للسطور → طلّع نتايج كاذبة من data-id (الكود الداخلي هو المفتاح
//     الصح للأزرار) ومن التعليقات.
//  ٣) وبعدين من أسماء متغيّرات عربية في الكود نفسه (اتمسح/عندنا/زيادة).
// القاعدة الصح: نفحص النصوص اللي جوّه علامات التنصيص بس — لأن ده بس اللي
// بيتعرض للمستخدم. وبناخد القوالب كاملة (حتى لو متعددة السطور).
const نصوص = [];
for(const m of html.matchAll(/`(?:[^`\\]|\\.)*`/gs)) نصوص.push(m[0]);       // قوالب
for(const m of html.matchAll(/'(?:[^'\\\n]|\\.)*'/g))   نصوص.push(m[0]);      // '...'
for(const m of html.matchAll(/"(?:[^"\\\n]|\\.)*"/g))   نصوص.push(m[0]);      // "..."
const تسريبات = [];
for(const نص of نصوص){
  if(!/[؀-ۿ]/.test(نص)) continue;                 // مفيش عربي = مش نص بيتعرض
  let نظيف = نص.replace(/data-[a-z-]+="[^"]*"/g, '');     // data-id مش تسريب
  // o.id كباراميتر لدالة (مش أول وآخر حاجة) مش عرض — زي fn(o.id, x, y)
  نظيف = نظيف.replace(/\w+_?\(\s*o\.id\s*,[^)]*\)/g, '');
  if(!/\bo\.id\b|\bstate\.editingId\b/.test(نظيف)) continue;
  if(/الكود الداخلي/.test(نظيف)) continue;                // مقصود
  const حول = نظيف.replace(/\s+/g,' ');
  const عند = Math.max(0, حول.search(/\bo\.id\b|\bstate\.editingId\b/) - 45);
  تسريبات.push(حول.slice(عند, عند+95));
}
check('مفيش نص عربي بيعرض الكود الداخلي للمستخدم',
  تسريبات.length===0, تسريبات.join(' | '));

const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ الرسائل الفعلية ═══
const o = {id:'W260908-ABC123X', displayNo:52, editCount:1, replacesId:'OLD9',
  dist:'محمد', name:'محمد', phone:'01012345678', region:'ط',
  items:[{kind:'door',title:'باب',sizeTxt:'70 سم',qty:1,unitPrice:100}], total:100};

await pg.evaluate((o)=>{
  state.editingId = o.id; state.editingDisplayNo = 52; state.editingEditCount = 1;
  state.cart = [{kind:'door',title:'باب',qty:1,unitPrice:100,code:'A01',sizeTxt:'70 سم'}];
  state.profile = {name:'محمد', phone:'01012345678', region:'طنطا'};
  state.customer = {name:'ورشة', phone:''};
}, o);
await pg.click('[data-tab="cart"]');      // الضغط الحقيقي — تغيير الحالة لوحده مابيرسمش
await pg.waitForTimeout(400);

const r = await pg.evaluate((o)=>{
  const out = {};
  out.شريط_التعديل = (document.body.innerText.match(/بتعدّل الطلب[^\n]*/)||[''])[0];
  // حذف الطلب من الجهاز
  const msgs=[]; const oldT=window.toast; window.toast=m=>msgs.push(m);
  state.orders=[o]; window.confirm=()=>true;
  const btn=document.createElement('button');
  btn.dataset.act='ord-del'; btn.dataset.id=o.id;
  document.body.appendChild(btn); btn.click(); btn.remove();
  out.حذف = msgs.slice(); window.toast=oldT;
  // عنوان مشاركة الصورة + اسم الملف
  out.رقم = orderNoText_(o);
  out.رقم_السابق = prevOrderNoText_(o);
  return out;
}, o);

check('شريط «بتعدّل الطلب» بيعرض 52/1 مش الكود',
  /بتعدّل الطلب\s*52\/1/.test(r.شريط_التعديل) && !/W260908/.test(r.شريط_التعديل), r.شريط_التعديل);
check('رسالة حذف الطلب بالرقم مش بالكود',
  r.حذف.some(m=>/اتحذف الطلب 52\/1/.test(String(m))) && !r.حذف.some(m=>/W260908/.test(String(m))),
  JSON.stringify(r.حذف));
check('رقم النسخة اللي قبل التعديل = 52', r.رقم_السابق==='52', r.رقم_السابق);

// ═══ الطلب اللي لسه مالوش رقم: الكود الداخلي هو الصح ═══
const r2 = await pg.evaluate(()=>{
  const جديد = {id:'W260908-NEW999', displayNo:'', editCount:0};
  return { نص: orderNoText_(جديد) };
});
check('طلب لسه مالوش رقم: بيقع على الكود الداخلي (وده الصح)',
  r2.نص==='#W260908-NEW999', r2.نص);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
