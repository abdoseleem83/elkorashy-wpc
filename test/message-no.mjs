// رسالة الواتساب اللي بتروح للمصنع كانت بتكتب الكود الداخلي
// (#W260904-1234ABC) بينما المستند المطبوع وكل شاشات التطبيق بيكتبوا الرقم
// التسلسلي (52). يعني نفس الطلب ليه رقمين مختلفين — واحد على واتساب وواحد
// على الورق، والمصنع بيدوّر على رقم مش موجود.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const msg = (o) => pg.evaluate((o)=>buildMessage(Object.assign({
  id:'W260904-1234ABC', name:'محمد', region:'طنطا', phone:'01012345678',
  items:[{kind:'door', title:'باب A01', sizeTxt:'70 سم', qty:2}], total:1000
}, o)), o);

// ١) طلب عادي فيه رقم تسلسلي
const m1 = await msg({displayNo:52, editCount:0});
check('الرسالة فيها الرقم التسلسلي', /رقم الطلب: 52/.test(m1), m1.split('\n')[1]);
check('والكود الداخلي معاه للرجوع ليه', /الكود الداخلي: W260904-1234ABC/.test(m1), m1.split('\n')[1]);
check('نفس الرقم اللي التطبيق بيعرضه',
  (await pg.evaluate(()=>orderNoText_({displayNo:52, editCount:0}))) === '52');

// ٢) طلب معدّل — الرقم المركّب زي المستند
const m2 = await msg({displayNo:52, editCount:2, replacesId:'W260901-0001XYZ'});
check('الطلب المعدّل: 52/2 زي المستند', /رقم الطلب: 52\/2/.test(m2), m2.split('\n')[1]);
check('والنسخة اللي قبلها 52/1 مش الكود الداخلي',
  /تعديل على الطلب رقم: 52\/1/.test(m2), (m2.split('\n').find(l=>/تعديل على/.test(l))||''));

// ٣) أول تعديل: النسخة اللي قبله رقمها العادي
const m3 = await msg({displayNo:52, editCount:1, replacesId:'W260901-0001XYZ'});
check('أول تعديل: 52/1 والنسخة اللي قبله 52',
  /رقم الطلب: 52\/1/.test(m3) && /تعديل على الطلب رقم: 52\n/.test(m3),
  m3.split('\n').slice(1,3).join(' | '));

// ٤) طلب لسه ما وصلش السيرفر (مفيش رقم تسلسلي) — الكود الداخلي هو الوحيد المتاح
const m4 = await msg({displayNo:'', editCount:0});
check('طلب لسه ما اترقّمش: بيقع على الكود الداخلي',
  /رقم الطلب: #W260904-1234ABC/.test(m4), m4.split('\n')[1]);
check('من غير تكرار الكود مرتين', (m4.match(/W260904-1234ABC/g)||[]).length===1, m4.split('\n')[1]);

check('مفيش أخطاء', errs.length===0, errs.join(' | '));
console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
