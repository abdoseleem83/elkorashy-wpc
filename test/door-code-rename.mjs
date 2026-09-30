// الباب A015 اتغيّر كوده لـA013. الطلبات القديمة (في الشيت وعلى الأجهزة) لسه
// فيها A015 — ولو التطبيق ما عرفهوش: الاسم العربي والصورة بيضيعوا من الطلب
// والمستندات، ورصيد المخزن بيتقسم نصين (قديم على A015 وجديد على A013)
// والمصنع يبيع من رصيد مش موجود. الاختبار بيغطّي الاتنين: الكود الجديد شغّال،
// والقديم لسه بيتفهم.
import fs from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const b = await chromium.launch();
const pg = await (await b.newContext({viewport:{width:412,height:915}})).newPage();
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(process.env.APP_URL || 'http://localhost:8100/index.html',{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1300);

// ═══ ١) الكتالوج بقى A013 ومفيش A015 خالص ═══
const كتالوج = await pg.evaluate(()=>({
  أكواد: DOORS.map(d=>d.code),
  الباب: DOORS.find(d=>d.code==='A013'),
  فيه_قديم: DOORS.some(d=>d.code==='A015'),
  صورة: (ASSETS.doors||{}).A013
}));
check('A013 موجود في الكتالوج', !!كتالوج.الباب, JSON.stringify(كتالوج.أكواد));
check('ومفيش A015 خالص', كتالوج.فيه_قديم===false);
check('واسمه زي ما هو', كتالوج.الباب && كتالوج.الباب.name==='أرو فاتح', كتالوج.الباب&&كتالوج.الباب.name);
check('وصورته اتغيّر اسمها معاه', كتالوج.صورة==='img/doors/A013.jpg', كتالوج.صورة);

// ═══ ٢) الكود القديم لسه بيتفهم (طلبات قديمة) ═══
const قديم = await pg.evaluate(()=>({
  طبيع: [doorCode_('A015'), doorCode_('A013'), doorCode_(' A015 '), doorCode_('A01'), doorCode_('')],
  باب: doorByCode('A015'),
  اسم_من_الشيت: arabicItemTitle_({type:'Door', code:'A015', title:'WPC Door A015 - Light Arrow'}),
  اسم_جديد: arabicItemTitle_({type:'Door', code:'A013', title:'WPC Door A013 - Light Arrow'})
}));
check('A015 بيتحوّل لـA013', قديم.طبيع[0]==='A013', قديم.طبيع[0]);
check('والمسافات الزايدة مابتكسرهاش', قديم.طبيع[2]==='A013', قديم.طبيع[2]);
check('والأكواد التانية زي ما هي', قديم.طبيع[1]==='A013' && قديم.طبيع[3]==='A01' && قديم.طبيع[4]==='');
check('doorByCode بترجّع الباب الصح للكود القديم',
  قديم.باب && قديم.باب.code==='A013' && قديم.باب.name==='أرو فاتح', JSON.stringify(قديم.باب));
check('⚠️ طلب قديم بيتعرض بالكود الجديد مش بيضيع اسمه',
  قديم.اسم_من_الشيت==='باب A013 أرو فاتح', قديم.اسم_من_الشيت);
check('والجديد زيه بالظبط', قديم.اسم_جديد===قديم.اسم_من_الشيت, قديم.اسم_جديد);

// ═══ ٣) رصيد المخزن: القديم والجديد رصيد واحد مش اتنين ═══
const مخزن = await pg.evaluate(()=>{
  state.stock.rows = [{code:'A015', size:'90', qty:7}, {code:'A01', size:'90', qty:3}];
  const بالقديم = stockFor('A015','90'), بالجديد = stockFor('A013','90');
  state.stock.rows = [{code:'A013', size:'90', qty:7}];
  const عكسي = stockFor('A015','90');
  state.stock.rows = [];
  return { بالقديم, بالجديد, عكسي };
});
check('⚠️ رصيد متسجّل بـA015 بيبان لما تسأل بـA013', مخزن.بالجديد===7, String(مخزن.بالجديد));
check('والسؤال بالكود القديم بيرجّع نفس الرصيد', مخزن.بالقديم===7, String(مخزن.بالقديم));
check('والعكس كمان (رصيد جديد وسؤال قديم)', مخزن.عكسي===7, String(مخزن.عكسي));

// ═══ ٤) طلب قديم يتفتح للتعديل → يترجع بالكود الجديد ═══
const تعديل = await pg.evaluate(()=>{
  const its = [{type:'Door', title:'WPC Door A015 - Light Arrow', code:'A015', size:'90 cm',
                unit:'door', qty:2, unitPrice:5000, width:'90'}];
  const old=window.toast; window.toast=()=>{};
  adminEditOrderWith_({id:'R1', dist:'ا', phone:'01', date:'2026-09-30'}, its);
  window.toast=old;
  const باب = state.cart.find(x=>x.kind==='door');
  const out = { code:باب.code, title:باب.title, img:باب.img };
  state.cart=[]; state.edit=null; state.editing=false;
  return out;
});
check('⚠️ الطلب القديم بيرجع بالكود الجديد (فالحفظ بينضّفه)', تعديل.code==='A013', تعديل.code);
check('واسمه صح', تعديل.title==='باب A013 أرو فاتح', تعديل.title);
check('وصورته مش فاضية', /A013\.jpg$/.test(تعديل.img||''), تعديل.img);

// ═══ ٥) طلب جديد بيتسجّل بالكود الجديد ═══
const جديد = await pg.evaluate(()=>{
  state.cart=[];
  const w = SIZES[0].w;
  state.pick = { code:'A013', sizes:{ [w]:{qty:1,height:'',frame:0,dbror:'',hafr:false,wood:false,print:false,
                 frameKind:null,frameRodQty:'',frameForDoors:''} }, customOn:false,
    custom:{w:'',h:'',qty:1,frame:null,frameHeight:'',dbror:null,hafr:false,wood:false,print:false,
            frameKind:null,frameRodQty:'',frameForDoors:''} };
  const old=window.toast; window.toast=()=>{}; addDoor(); window.toast=old;
  const it = state.cart.find(x=>x.kind==='door');
  const out = { code:it.code, title:it.title, titleEn:it.titleEn };
  state.cart=[];
  return out;
});
check('الطلب الجديد كوده A013', جديد.code==='A013', جديد.code);
check('ومفيش A015 في أي اسم', !/A015/.test(جديد.title+جديد.titleEn), جديد.title+' / '+جديد.titleEn);

check('مفيش أخطاء JS', errs.length===0, errs.join(' | '));
await b.close();

// ═══ ٦) الملفات: الصورة والسيرفر ═══
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
check('ملف الصورة اسمه اتغيّر', fs.existsSync(new URL('../img/doors/A013.jpg', import.meta.url)));
check('والقديم مابقاش موجود', !fs.existsSync(new URL('../img/doors/A015.jpg', import.meta.url)));
check('الكاش بيجيب الصورة الجديدة', /A013\.jpg/.test(sw) && !/A015\.jpg/.test(sw));
check('ورقم إصدار الأصول اتزوّد (عشان الأجهزة تجيبها)', /ASSET_VERSION = 'a2'/.test(sw));

const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
check('السيرفر عنده نفس خريطة الأكواد', /DOOR_CODE_ALIASES_ = \{ 'A015': 'A013' \}/.test(gs));
check('ومطابقة المخزن بتعدّي عليها',
  /var codeAS = doorCode_\(itAS\.code\)/.test(gs) && /var k = doorCode_\(rowsAS\[jAS\]\[0\]\)/.test(gs));
check('وقايمة الأرصدة بترجع بالكود الجديد', /var codeST = doorCode_\(valsST\[iST\]\[0\]\)/.test(gs));
check('وتحديث الرصيد بيلاقي الصف القديم',
  /var codeSS = doorCode_\(e\.parameter\.code\)/.test(gs) && /if \(doorCode_\(rowsSS\[jSS\]\[0\]\) === codeSS/.test(gs));
check('وفيه دالة تنضيف الشيت (تشغيل يدوي)', /function renameDoorCodesOnce\(\)/.test(gs));
check('وبتكتب على عمود Colour Code مش عمود تاني',
  /HEAD_ITEMS\.indexOf\('Colour Code'\) \+ 1/.test(gs));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
