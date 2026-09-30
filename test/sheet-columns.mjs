// أرقام الأعمدة في كود السيرفر مكتوبة ثوابت (COL_ITEM_PRODUCED = 19…).
// أول ما حد يزوّد عمود في نص الجدول، الثوابت دي بتشاور على أعمدة تانية —
// والكتابة بتروح للخانة الغلط في صمت: «الكمية المنتجة» تتكتب فوق «متاح؟»،
// أو حالة الطلب تتكتب فوق ملاحظة المصنع. الاختبار ده بيربط كل ثابت باسم
// عموده المتوقّع، وبيتأكد إن طول أي صف بيتكتب = عدد الأعمدة بالظبط.
import fs from 'node:fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const arr = n => eval('['+new RegExp('var '+n+'\\s*=\\s*\\[([\\s\\S]*?)\\];').exec(gs)[1]+']');
const HEAD_ITEMS = arr('HEAD_ITEMS'), HEAD_ORDERS = arr('HEAD_ORDERS');
const cols = {}; { const re=/var (COL_[A-Z_]+)\s*=\s*(\d+);/g; let m; while((m=re.exec(gs))) cols[m[1]]=Number(m[2]); }

const أعمدة_الأصناف = { COL_ITEM_AVAIL:'Available', COL_ITEM_WIDTH:'Width (cm)',
  COL_ITEM_PRODUCED:'Produced Qty', COL_ITEM_DOORHEIGHT:'Door Height (cm)' };
const أعمدة_الطلبات = { COL_STATUS:'Status', COL_NOTE:'Note to Distributor', COL_UPDATED:'Status Updated',
  COL_ARCHIVED:'Archived', COL_CUSTOMER:'Customer', COL_ORDNOTE:'Order Note',
  COL_CUST_PHONE:'Customer Phone', COL_SUPERSEDED:'Superseded', COL_REPLACES:'Replaces Order',
  COL_DISPLAY_NO:'Display No', COL_EDIT_COUNT:'Edit Count', COL_EDITED_AT:'Edited At' };

Object.keys(أعمدة_الأصناف).forEach(k=>{
  check(`${k} على عمود «${أعمدة_الأصناف[k]}»`, HEAD_ITEMS[cols[k]-1] === أعمدة_الأصناف[k],
    `${cols[k]} → ${HEAD_ITEMS[cols[k]-1]}`);
});
Object.keys(أعمدة_الطلبات).forEach(k=>{
  check(`${k} على عمود «${أعمدة_الطلبات[k]}»`, HEAD_ORDERS[cols[k]-1] === أعمدة_الطلبات[k],
    `${cols[k]} → ${HEAD_ORDERS[cols[k]-1]}`);
});

// itemsFromRows_ بتقرا بأرقام — مايخرجش عن حدود الجدول
const كتلة = /function itemsFromRows_\([\s\S]*?\n\}/.exec(gs)[0];
const أقصى = [...كتلة.matchAll(/r\[(\d+)\]/g)].map(m=>Number(m[1])).reduce((a,b)=>Math.max(a,b),0);
check('itemsFromRows_ مابتقراش برّه الجدول', أقصى === HEAD_ITEMS.length - 1,
  `أقصى index ${أقصى} من ${HEAD_ITEMS.length - 1}`);

// صف الطلب اللي بيتكتب في saveOrder_ لازم يبقى بطول أعمدة Orders الأصلية
// (آخر أعمدة بتتكتب لوحدها بعدين — العدد المكتوب هنا ١٩)
const كتلة_الحفظ = /function saveOrder_\([\s\S]*?\n\}/.exec(gs)[0];
const صف_الطلب = /var rowO = \[([\s\S]*?)\n  \];/.exec(كتلة_الحفظ)[1];
const عدد_خانات = صف_الطلب.split('\n').filter(l=>l.trim() && !/^\s*\/\//.test(l)).length;
check('صف الطلب بيغطّي الأعمدة الأساسية من غير زيادة',
  عدد_خانات === cols.COL_CUST_PHONE, `${عدد_خانات} خانة — آخر عمود بيتكتب ${cols.COL_CUST_PHONE}`);
check('والباقي بيتكتب بأعمدته بالاسم (مش بامتداد الصف)',
  /COL_REPLACES\)\.setValue/.test(كتلة_الحفظ) && /COL_DISPLAY_NO, 1, 2\)/.test(كتلة_الحفظ));

// صف الصنف: عدد الخانات = عدد أعمدة Order_Items
const صف_الصنف = /lines\.push\(\[([\s\S]*?)\n    \]\);/.exec(كتلة_الحفظ)[1];
let عمق=0, خانات=1;
for(const ch of صف_الصنف){ if('([{'.includes(ch)) عمق++; else if(')]}'.includes(ch)) عمق--;
                            else if(ch===',' && عمق===0) خانات++; }
check('صف الصنف طوله = عدد أعمدة الجدول', خانات === HEAD_ITEMS.length,
  `${خانات} من ${HEAD_ITEMS.length}`);
check('والكتابة بتستعمل HEAD_ITEMS.length مش رقم ثابت',
  /shI\.getRange\([\s\S]{0,60}HEAD_ITEMS\.length\)/.test(كتلة_الحفظ));

// ⚠️ readOrderRows_ بتقرا عمودين متفرّقين وبتلزق بينهم فجوة ٣ خانات عشان
// المؤشرات تفضل مطابقة لترتيب الجدول. أي عمود جديد قبل «Pricing Terms»
// بيزحلق كل حاجة — وكل شاشات المصنع تقرا بيانات غلط في صمت.
check('فجوة readOrderRows_ على الأعمدة التقيلة بالظبط',
  HEAD_ORDERS[12]==='Pricing Terms' && HEAD_ORDERS[13]==='Message' && HEAD_ORDERS[14]==='Status Updated',
  HEAD_ORDERS.slice(12,15).join(' | '));
const كتلة_القراية = /function readOrderRows_\([\s\S]*?\n\}/.exec(gs)[0];
// ⚠️ القراية بقت مشتقّة من الأسامي مش أرقام مكتوبة. الفحص بقى: مفيش أي رقم
// عمود مكتوب بالنص جواها، والفجوة بتتحسب من GAP_COLS_.
check('مفيش رقم عمود مكتوب بالنص في readOrderRows_',
  !/getRange\(2,\s*(?!1,)\d+/.test(كتلة_القراية) && !/n,\s*\d+\)/.test(كتلة_القراية),
  (كتلة_القراية.match(/getRange\([^)]*\)/g)||[]).join(' · '));
check('والفجوة بتتحسب من GAP_COLS_ مش خانات مكتوبة',
  /GAP_FIRST_COL_/.test(كتلة_القراية) && /GAP_COLS_\.length/.test(كتلة_القراية)
  && !/concat\(\['', '', ''\]/.test(كتلة_القراية));
check('ولو الفجوة مش ورا بعض، بتقرا الجدول كله بدل ما تترزّع',
  /if \(!GAP_FIRST_COL_\) return sh\.getRange\(2, 1, n, HEAD_ORDERS\.length\)/.test(كتلة_القراية));

// GAP_FIRST_COL_ مشتق فعلاً — بننفّذه على جدول فيه عمود زيادة ونشوف بيزحزح
const كتلة_الفجوة = /var GAP_COLS_[\s\S]*?\n\}\)\(\);/.exec(gs)[0];
const فجوة = H => new Function('HEAD_ORDERS', كتلة_الفجوة + ' return GAP_FIRST_COL_;')(H);
check('موضع الفجوة مشتق: بيطابق الجدول الحالي', فجوة(HEAD_ORDERS) === 13, String(فجوة(HEAD_ORDERS)));
check('وبيزحزح لوحده لو عمود زاد قبلها',
  فجوة(['X'].concat(HEAD_ORDERS)) === 14, String(فجوة(['X'].concat(HEAD_ORDERS))));
check('وبيرجّع صفر (= اقرا الكل) لو الأعمدة ماعادتش ورا بعض',
  فجوة(['Pricing Terms','Z','Message','Status Updated']) === 0);

// ⚠️ الأعمدة اللي كانت أرقام مكتوبة جوه getRange. دي بقت مسمّاة، وهنا
// بنربط كل واحدة باسم عمودها — ده الفحص اللي كان ناقص وسمح بالثقب.
const أعمدة_مسمّاة = { COL_DATE:'Date', COL_PHONE:'Phone', COL_TOTAL_QTY:'Total Qty',
  COL_TOTAL_RODS:'Total Rods', COL_TOTAL_AMT:'Total Amount' };
Object.keys(أعمدة_مسمّاة).forEach(k=>{
  check(`${k} على عمود «${أعمدة_مسمّاة[k]}»`, HEAD_ORDERS[cols[k]-1] === أعمدة_مسمّاة[k],
    `${cols[k]} → ${HEAD_ORDERS[cols[k]-1]}`);
});
check('COL_ITEM_QTY على عمود «Qty»', HEAD_ITEMS[cols.COL_ITEM_QTY-1] === 'Qty',
  `${cols.COL_ITEM_QTY} → ${HEAD_ITEMS[cols.COL_ITEM_QTY-1]}`);
// الكتابة بتحط تلات خانات ورا بعض من COL_ITEM_QTY — لازم يكونوا التلاتة دول
check('والتلاتة ورا بعض: Qty / Unit Price / Line Total',
  HEAD_ITEMS.slice(cols.COL_ITEM_QTY-1, cols.COL_ITEM_QTY+2).join('|') === 'Qty|Unit Price|Line Total',
  HEAD_ITEMS.slice(cols.COL_ITEM_QTY-1, cols.COL_ITEM_QTY+2).join('|'));

const HEAD_STOCK = arr('HEAD_STOCK');
check('COL_STOCK_QTY على عمود «Qty»', HEAD_STOCK[cols.COL_STOCK_QTY-1] === 'Qty',
  String(HEAD_STOCK[cols.COL_STOCK_QTY-1]));
check('COL_STOCK_UPDATED على عمود «Updated»', HEAD_STOCK[cols.COL_STOCK_UPDATED-1] === 'Updated',
  String(HEAD_STOCK[cols.COL_STOCK_UPDATED-1]));

// ═══ وأخيرًا: مفيش رقم عمود جديد متناثر تاني ═══
// أي getRange(<صف>, <رقم>) برقم صريح مكان العمود هو نفس الثقب من أول الأول.
// العمود ١ مستثنى: قراية/كتابة صف كامل من أوله، مافيهاش أي افتراض عن ترتيب
// الأعمدة. واللي بره ده لازم يبقى ثابت مسمّى. والتعليقات بتتشال الأول عشان
// شرح زي «(getRange(r, 8)…)» ما يعدّيش كأنه كود.
const كود = gs.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const متناثر = [...كود.matchAll(/getRange\(\s*[A-Za-z_$][\w$]*\s*,\s*(\d+)\s*[,)]/g)]
  .filter(m=>m[1] !== '1').map(m=>m[0].trim());
check('مفيش getRange برقم عمود مكتوب بالنص (غير العمود ١)',
  متناثر.length===0, متناثر.join(' · '));

// مؤشرات list المكتوبة بالأرقام
const list_idx = { 0:'Order No', 1:'Date', 3:'Distributor', 4:'Phone', 5:'Region',
                   7:'Total Qty', 8:'Total Rods', 9:'Total Amount', 10:'Status', 11:'Note to Distributor' };
const غلط = Object.keys(list_idx).filter(i=>HEAD_ORDERS[Number(i)] !== list_idx[i]);
check('مؤشرات «list» الرقمية على أعمدتها الصح', غلط.length===0,
  غلط.map(i=>i+' → '+HEAD_ORDERS[Number(i)]).join(' · '));

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
