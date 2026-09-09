// عقد التطبيق مع السيرفر: كل أكشن بيناديه التطبيق لازم يكون موجود في السيرفر،
// وكل باراميتر بيبعته لازم يكون السيرفر بيقراه بنفس الاسم.
// اختلاف حرف واحد في اسم باراميتر = فشل صامت: السيرفر بيرد ok والقيمة بتضيع.
// (ده بالظبط شكل الباجات اللي بتظهر بعد أسابيع ومحدش عارف منين).
import fs from 'fs';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gs   = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');

// ═══ ١) كل أكشن بيناديه التطبيق موجود في السيرفر ═══
const أكشنات_السيرفر = new Set(
  [...gs.matchAll(/action === '([a-zA-Z]+)'/g)].map(m=>m[1]));
const أكشنات_التطبيق = new Set([
  ...[...html.matchAll(/action=([a-zA-Z]+)/g)].map(m=>m[1]),
  ...[...html.matchAll(/action:\s*'([a-zA-Z]+)'/g)].map(m=>m[1])
]);
const ناقصة = [...أكشنات_التطبيق].filter(a=>!أكشنات_السيرفر.has(a));
check('كل أكشن بيناديه التطبيق موجود في السيرفر',
  ناقصة.length===0, ناقصة.join(', ') || [...أكشنات_التطبيق].length+' أكشن');

// ═══ ٢) الباراميترات: اللي التطبيق بيبعته لكل أكشن مقابل اللي السيرفر بيقراه ═══
// كتلة كل أكشن في السيرفر
function كتلة_السيرفر(action){
  const i = gs.indexOf("action === '"+action+"'");
  if(i < 0) return '';
  // لحد بداية الأكشن اللي بعده (أو آخر doGet)
  const بعده = gs.indexOf("if (action === '", i+10);
  return gs.slice(i, بعده > 0 ? بعده : i + 6000);
}
// الباراميترات اللي التطبيق بيبعتها لأكشن معيّن (من كل النداءات في الملف)
function باراميترات_التطبيق(action){
  const out = new Set();
  // نداءات jsonp: بندوّر على مقطع الرابط اللي فيه الأكشن
  const re = new RegExp("action=" + action + "[^;]{0,600}", 'g');
  for(const m of html.matchAll(re)){
    for(const p of m[0].matchAll(/[?&]([a-zA-Z]+)=/g)) out.add(p[1]);
  }
  // نداءات adminAction_: params:'&x=...' جوه كتلة فيها action:'اسم'
  const re2 = new RegExp("action:\\s*'" + action + "'[\\s\\S]{0,600}?\\n\\s*\\}\\)", 'g');
  for(const m of html.matchAll(re2)){
    for(const p of m[0].matchAll(/&([a-zA-Z]+)=/g)) out.add(p[1]);
  }
  out.delete('action'); out.delete('callback');
  return [...out];
}

const تجاهل = new Set(['callback','action','payload']);   // payload بيتقري بأسمه في كل مكان
const مشاكل = [];
for(const action of أكشنات_التطبيق){
  if(!أكشنات_السيرفر.has(action)) continue;
  const كتلة = كتلة_السيرفر(action);
  const يقراهم = new Set([...كتلة.matchAll(/e\.parameter\.([a-zA-Z]+)/g)].map(m=>m[1]));
  // list و newOrder بيتقروا كمان في أماكن مشتركة (checkAdminPw_ بتاخد pw و dev)
  ['pw','dev'].forEach(p=>يقراهم.add(p));
  for(const p of باراميترات_التطبيق(action)){
    if(تجاهل.has(p)) continue;
    if(!يقراهم.has(p)) مشاكل.push(action + ' → ' + p);
  }
}
check('كل باراميتر بيتبعت، السيرفر بيقراه بنفس الاسم',
  مشاكل.length===0, مشاكل.join(' · '));

// ═══ ٣) الحقول اللي السيرفر بيرجّعها والتطبيق بيعتمد عليها ═══
{
  // saveOrder_ بترجّع displayNo و editCount — والتطبيق بيخزّنهم على الطلب
  check('السيرفر بيرجّع رقم الطلب وعدّاد التعديل بعد الحفظ',
    /displayNo: displayNo, editCount: editCount/.test(gs) &&
    /d\.displayNo/.test(html) && /d\.editCount/.test(html));
  // list بترجّع orders، وorderItems بترجّع items أو itemsById
  check('list بترجّع orders والتطبيق بيقراها',
    /reply\(\{ ok: true, orders:/.test(gs) && /d\.orders/.test(html));
  check('orderItems بترجّع items و itemsById والتطبيق بيقرا الاتنين',
    /items: itemsFromRows_/.test(gs) && /itemsById: byIdOM/.test(gs) &&
    /d\.items/.test(html) && /d\.itemsById/.test(html));
  check('stock بترجّع stock والتطبيق بيقراها',
    /reply\(\{ ok: true, stock: outST \}/.test(gs) && /d\.stock/.test(html));
}

// ═══ ٤) الحالات: التطبيق مايبعتش حالة السيرفر مايعرفهاش ═══
{
  const مسموحة = new Set(
    /var VALID_STATUSES = \[([^\]]+)\]/.exec(gs)[1].split(',').map(s=>s.trim().replace(/'/g,'')));
  const بتاعة_التطبيق = new Set([
    ...[...html.matchAll(/const FLOW = \[([^\]]+)\]/g)].flatMap(m=>m[1].split(',').map(s=>s.trim().replace(/'/g,''))),
    ...Object.keys({}), 'New','Cancelled'
  ]);
  const غريبة = [...بتاعة_التطبيق].filter(s=>s && !مسموحة.has(s));
  check('كل حالة بيستعملها التطبيق مقبولة عند السيرفر',
    غريبة.length===0, غريبة.join(', ') || [...بتاعة_التطبيق].join(' · '));
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
