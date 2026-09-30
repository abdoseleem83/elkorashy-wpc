// الباج اللي ده بيحميها: المستخدم بينسخ apps_script.gs مرة، وبعد كده بنعدّل
// السكربت وهو مش فاكر إنه لازم يعمل Deploy ▸ New version تاني. التطبيق
// بيفضل شغّال والسيرفر ناقص حاجة — فتطلع أعراض غريبة (رصيد باب مش لاقيه،
// تعديل صنف بيترفض بـ«الأصناف اتغيّرت من جهاز تاني») وحد مش هيربطها بالسكربت.
// دلوقتي السيرفر بيقول نسخته في الـping والتطبيق بيقارن ويقول للمصنع.
import fs from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gs   = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');

// ═══ ١) الطرفين متفقين على نفس الرقم ═══
const srv  = /var SRV_BUILD_ = '([^']+)'/.exec(gs);
const want = /const SRV_BUILD_WANT = '([^']+)'/.exec(html);
check('السكربت بيعرف نسخته', !!srv, srv && srv[1]);
check('والتطبيق بيعرف النسخة اللي محتاجها', !!want, want && want[1]);
check('والرقمين متساويين — لو اتنسوا، الفحص ده هو اللي يقول',
  !!srv && !!want && srv[1] === want[1], `السكربت ${srv&&srv[1]} · التطبيق ${want&&want[1]}`);

// ═══ ٢) الـping بيرجّع الرقم فعلاً ═══
const ping = /if \(action === 'ping'\) \{[\s\S]*?\n    \}/.exec(gs);
check('رد الـping فيه srv', !!ping && /srv:\s*SRV_BUILD_/.test(ping[0]));

// ═══ ٣) التطبيق: السطر بيظهر في الحالات الصح بس ═══
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

const حالة = await pg.evaluate(async(WANT)=>{
  const نتيجة = {};
  const جهّز = () => {
    state.admin.open = true; state.admin.pw = 'x'; state.tab = 'admin';
    state.admin.rows = [{id:'A1', displayNo:1, customer:'ع', date:'2026-09-01', qty:1, total:10}];
  };
  const نص = () => { جهّز(); renderNow(); return document.getElementById('view').textContent; };

  state.admin.srv = undefined;      نتيجة.لسه = نص();
  state.admin.srv = WANT;           نتيجة.تمام = نص();
  state.admin.srv = 'v199';         نتيجة.قديم = نص();
  state.admin.srv = '';             نتيجة.مافيه = نص();
  state.admin.srv = null; state.admin.srvErr = 'انتهى الوقت';
                                    نتيجة.مجهول = نص();

  // والفحص بيتنادى فعلاً مع دخول المصنع
  const روابط = [];
  window.jsonp = (url)=>{ روابط.push(url); return Promise.resolve({ok:true, orders:[], srv:WANT}); };
  window.toast = ()=>{};
  state.admin.srv = undefined; state.admin.srvChecking = false;
  await adminLoad();
  await new Promise(r=>setTimeout(r,60));
  نتيجة.نادى = روابط.some(u=>/action=ping/.test(u));
  نتيجة.بعدالنداء = state.admin.srv;
  return نتيجة;
}, want[1]);

const عبارة = 'Deploy';
check('قبل ما نسأل: مفيش سطر (مش بنفزّع حد على الفاضي)', !حالة.لسه.includes(عبارة));
check('السكربت متظبّط: مفيش سطر كمان', !حالة.تمام.includes(عبارة));
check('سكربت قديم: السطر بيظهر وبيقول النسخة', حالة.قديم.includes(عبارة) && حالة.قديم.includes('v199'));
check('سكربت مابيرجّعش srv خالص (أقدم من كل ده): السطر بيظهر',
  حالة.مافيه.includes(عبارة));
check('مفيش رد: بيقول «مش قادرين نتأكد» مش «تمام»',
  حالة.مجهول.includes(عبارة) && حالة.مجهول.includes('مش قادرين'));
check('دخول المصنع بينادي الفحص', حالة.نادى === true);
check('والرد بيتسجّل', حالة.بعدالنداء === want[1], String(حالة.بعدالنداء));
check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
await b.close();
process.exit(fail?1:0);
